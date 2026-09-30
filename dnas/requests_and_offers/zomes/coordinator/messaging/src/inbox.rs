use hdk::prelude::*;
use messaging_integrity::{EntryTypes, LinkTypes, ReadMarker};

use crate::blocks::{get_blocks, is_blocked};
use crate::external_calls::{check_if_entity_is_accepted, get_agent_user};
use crate::message::MessageBody;

/// A decrypted message, as the UI wants it.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Message {
  /// The action hash of the stored entry, which is also what a nudge carries.
  pub hash: ActionHash,
  /// Who wrote it, from the action rather than from the payload.
  pub from: AgentPubKey,
  /// Which agent the copy was encrypted to. For an inbox read this is one of mine;
  /// for a sent read it is the recipient's.
  pub to: AgentPubKey,
  pub at: Timestamp,
  pub conversation_id: String,
  pub content: String,
}

/// One item in this agent's inbox.
///
/// `Unreadable` is a fault here, unlike in `get_message`. Every `Inbox` link points at a
/// message that was encrypted **to this agent**, so failing to decrypt one means
/// something is wrong: the encryption arguments the wrong way round, a sender that
/// encrypted to the wrong key, or corrupt data. Dropping it silently would hide exactly
/// that class of bug, so it is returned and logged instead, with enough to chase it.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum InboxEntry {
  Read(Message),
  Unreadable {
    hash: ActionHash,
    from: AgentPubKey,
    at: Timestamp,
  },
}

/// Everything addressed to this agent that it is willing to show.
///
/// Two filters, both on the reading side on purpose:
///
/// - **Blocked authors are dropped.** Blocking is private to this chain, so no other
///   node can apply it.
/// - **Authors who are not accepted members *now* are dropped.** The sender-side check
///   in `send_message` passed when the message was written, but a status can change
///   afterwards, and a modified client could have skipped it. The recipient's own node
///   decides what the recipient sees.
///
/// A message that fails to decrypt comes back as `InboxEntry::Unreadable` and is logged
/// at `warn!`, because in this direction it is a fault rather than a filter. The whole
/// call does not fail: one bad message should not hide the rest of somebody's inbox.
#[hdk_extern]
pub fn get_inbox(_: ()) -> ExternResult<Vec<InboxEntry>> {
  let me = agent_info()?.agent_initial_pubkey;

  let link_type_filter = LinkTypes::Inbox
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  // Network rather than Local: a message may have been written by a peer since this
  // agent last gossiped, and an inbox that only reports what is already local would
  // silently miss it.
  let links = get_links(
    LinkQuery::new(me.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  let mut out = Vec::new();

  // Both of these were once per message, which meant a full chain scan and two
  // cross-zome calls per message. The interface calls this on every app open, so the
  // block list is read once and each distinct author is checked once.
  let blocked = get_blocks(())?.blocked;
  let mut acceptance: Vec<(AgentPubKey, bool)> = Vec::new();

  for link in links {
    let Some(hash) = link.target.clone().into_action_hash() else {
      continue;
    };
    let Some(record) = get(hash.clone(), GetOptions::default())? else {
      continue;
    };

    let from = record.action().author().clone();
    if blocked.contains(&from) {
      continue;
    }

    let accepted = match acceptance.iter().find(|(agent, _)| agent == &from) {
      Some((_, known)) => *known,
      None => {
        let checked = is_accepted_now(from.clone())?;
        acceptance.push((from.clone(), checked));
        checked
      }
    };
    if !accepted {
      continue;
    }

    let at = record.action().timestamp();

    match decrypt_body(&record, me.clone(), from.clone())? {
      Some(body) => out.push(InboxEntry::Read(Message {
        hash,
        from,
        to: me.clone(),
        at,
        conversation_id: body.conversation_id,
        content: body.content,
      })),
      None => {
        // A fault, not a filter: this message was linked to this agent's own inbox, so
        // it was encrypted to this agent. Surfaced rather than dropped, so that a
        // decrypt-order mistake cannot hide as an empty inbox.
        warn!(
          "Inbox message {hash:?} from {from:?} could not be decrypted, though every \
           inbox link is encrypted to this agent"
        );
        out.push(InboxEntry::Unreadable { hash, from, at });
      }
    }
  }

  out.sort_by_key(|entry| match entry {
    InboxEntry::Read(m) => m.at,
    InboxEntry::Unreadable { at, .. } => *at,
  });
  Ok(out)
}

/// What happened when this agent tried to read one message.
///
/// The outcomes are kept apart on purpose. "Not held" and "held but not readable" are
/// the difference between the DHT not having reached this agent and the encryption
/// actually working, and only the second is evidence for the privacy claim. Collapsing
/// them into one empty answer makes that claim untestable.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type")]
pub enum MessageRead {
  /// Not on this agent's shard, or no such action.
  NotFound,
  /// Held, and deliberately not shown: the author is blocked, or is not an accepted
  /// member now.
  Withheld,
  /// Held, and this agent cannot decrypt it. The normal case for a copy encrypted to
  /// somebody else, including another of this member's own agents.
  Unreadable,
  /// Held and readable.
  Read(Message),
}

/// One message by its action hash, which is what a nudge carries.
///
/// The nudge path needs this: a recipient is told only a hash and has to fetch the
/// thing itself. It applies the same read-side filters as `get_inbox`, and reports which
/// outcome it reached.
#[hdk_extern]
pub fn get_message(hash: ActionHash) -> ExternResult<MessageRead> {
  let me = agent_info()?.agent_initial_pubkey;

  let Some(record) = get(hash.clone(), GetOptions::default())? else {
    return Ok(MessageRead::NotFound);
  };

  let from = record.action().author().clone();

  // One of my own. The counterparty is whoever the `Inbox` link named, which this
  // function does not know and `get_sent` does, so it cannot be decrypted from here.
  if from == me {
    return Ok(MessageRead::Unreadable);
  }

  if is_blocked(&from)? || !is_accepted_now(from.clone())? {
    return Ok(MessageRead::Withheld);
  }

  match decrypt_body(&record, me.clone(), from.clone())? {
    Some(body) => Ok(MessageRead::Read(Message {
      hash,
      from,
      to: me,
      at: record.action().timestamp(),
      conversation_id: body.conversation_id,
      content: body.content,
    })),
    None => Ok(MessageRead::Unreadable),
  }
}

/// Everything this agent has sent, read from its own chain.
///
/// No extra public links exist for this: the `Inbox` link actions are already on the
/// sender's chain, and each one's base names the recipient agent it was for. Reading
/// them locally is why a sender does not need to publish a second index of its own
/// messages.
///
/// The same shared secret decrypts in both directions, so a sender reads its own
/// message by passing itself as recipient and the other agent as sender. Only from the
/// agent that sent it, though: see `send_message`.
#[hdk_extern]
pub fn get_sent(_: ()) -> ExternResult<Vec<Message>> {
  let me = agent_info()?.agent_initial_pubkey;

  let records = query(
    ChainQueryFilter::new()
      .include_entries(false)
      .action_type(ActionType::CreateLink),
  )?;

  let mut out = Vec::new();

  for link_record in records {
    let Action::CreateLink(create_link) = link_record.action() else {
      continue;
    };

    // Only this zome's Inbox links.
    match LinkTypes::from_type(create_link.zome_index, create_link.link_type)? {
      Some(LinkTypes::Inbox) => (),
      _ => continue,
    }

    let Some(to) = create_link.base_address.clone().into_agent_pub_key() else {
      continue;
    };
    let Some(hash) = create_link.target_address.clone().into_action_hash() else {
      continue;
    };
    let Some(record) = get(hash.clone(), GetOptions::default())? else {
      continue;
    };

    match decrypt_body(&record, me.clone(), to.clone())? {
      Some(body) => out.push(Message {
        hash,
        from: me.clone(),
        to,
        at: record.action().timestamp(),
        conversation_id: body.conversation_id,
        content: body.content,
      }),
      None => {
        // The same reasoning as `get_inbox`: every `Inbox` link on this chain was written
        // by this agent, so a message it cannot decrypt is a fault rather than somebody
        // else's mail. The return type stays `Vec<Message>` until the interface bundle
        // needs to show these.
        warn!(
          "Sent message {hash:?} to {to:?} could not be decrypted, though this agent \
           encrypted it"
        );
      }
    }
  }

  out.sort_by_key(|m| m.at);
  Ok(out)
}

/// Record how far this agent has read in one conversation.
///
/// A private entry on this agent's own chain, so unread counts survive a restart
/// without publishing anything about reading habits.
#[hdk_extern]
pub fn mark_read(input: ReadMarker) -> ExternResult<()> {
  create_entry(&EntryTypes::ReadMarker(input))?;
  Ok(())
}

/// The latest read position per conversation, newest wins.
#[hdk_extern]
pub fn get_read_markers(_: ()) -> ExternResult<Vec<ReadMarker>> {
  let records = query(
    ChainQueryFilter::new()
      .include_entries(true)
      .action_type(ActionType::Create),
  )?;

  let mut latest: Vec<ReadMarker> = Vec::new();

  for record in records {
    let Some(EntryType::App(def)) = record.action().entry_type() else {
      continue;
    };
    let Some(entry) = record.entry().as_option() else {
      continue;
    };
    if let Some(EntryTypes::ReadMarker(marker)) =
      EntryTypes::deserialize_from_type(*def.zome_index, def.entry_index, entry)?
    {
      match latest
        .iter_mut()
        .find(|m| m.conversation_id == marker.conversation_id)
      {
        Some(existing) if existing.up_to < marker.up_to => *existing = marker,
        Some(_) => (),
        None => latest.push(marker),
      }
    }
  }

  Ok(latest)
}

/// Decrypt one stored message, or `None` if this agent cannot read it.
///
/// `mine` is whichever of the two keys belongs to this agent, and `other` is the
/// counterparty. **Decryption takes `(recipient, sender)`, the reverse of
/// `ed_25519_x_salsa20_poly1305_encrypt`'s `(sender, recipient)`**, and it lives in
/// hdi rather than hdk. The shared secret is the same in both directions, which is
/// what lets a sender read its own message by passing itself as the recipient.
fn decrypt_body(
  record: &Record,
  mine: AgentPubKey,
  other: AgentPubKey,
) -> ExternResult<Option<MessageBody>> {
  let Some(entry) = record.entry().as_option() else {
    return Ok(None);
  };
  let Some(EntryType::App(def)) = record.action().entry_type() else {
    return Ok(None);
  };
  let Some(EntryTypes::EncryptedMessage(message)) =
    EntryTypes::deserialize_from_type(*def.zome_index, def.entry_index, entry)?
  else {
    return Ok(None);
  };

  // A failure here is expected for a copy encrypted to one of this member's other
  // agents, so it is not an error.
  let Ok(plaintext) = ed_25519_x_salsa20_poly1305_decrypt(mine, other, message.encrypted) else {
    return Ok(None);
  };

  match ExternIO(plaintext.as_ref().to_vec()).decode::<MessageBody>() {
    Ok(body) => Ok(Some(body)),
    Err(_) => Ok(None),
  }
}

/// Whether an agent is an accepted member right now.
///
/// No profile, or a profile that is not accepted, both mean "do not show their
/// messages". Either is a reason to skip rather than to fail the read.
fn is_accepted_now(agent: AgentPubKey) -> ExternResult<bool> {
  let links = get_agent_user(agent)?;
  let Some(link) = links.first() else {
    return Ok(false);
  };
  let Some(user_hash) = link.target.clone().into_action_hash() else {
    return Ok(false);
  };
  check_if_entity_is_accepted("users".to_string(), user_hash)
}
