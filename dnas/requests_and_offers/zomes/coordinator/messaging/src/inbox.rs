use hdk::prelude::*;
use messaging_integrity::{EntryTypes, LinkTypes};

use crate::cases::CaseRef;
use crate::external_calls::{check_if_entity_is_accepted, get_agent_user};
use crate::message::MessageBody;
use crate::roles::{holds_role, RoleDirection, RoleRef};

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
  pub content: String,
  /// Which role this is addressed to, or sent as. `None` on a personal message, and the
  /// only thing that separates role traffic from chat: `get_inbox` drops every message
  /// that has one.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub role: Option<RoleRef>,
  /// Which way it travels. A label for the interface, never an authorisation.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub direction: Option<RoleDirection>,
  /// Which case it belongs to, and what it did to it.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub case: Option<CaseRef>,
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

/// Everything addressed to this agent that it is willing to show, as personal chat.
///
/// Three filters, all on the reading side on purpose:
///
/// - **Authors who are not accepted members *now* are dropped.** The sender-side check
///   in `send_message` passed when the message was written, but a status can change
///   afterwards, and a modified client could have skipped it. The recipient's own node
///   decides what the recipient sees.
/// - **A message whose author is claiming a role they do not hold now is dropped**, in
///   `read_inbox_entries`. Decision 11: the role label is checked on read, never trusted
///   from inside the ciphertext.
/// - **Every role message is dropped here**, for everyone. Role traffic never mixes with
///   personal messages (decision 12): a holder reaches it through `get_role_inbox`, and
///   a member through `get_my_role_correspondence`.
///
/// **Blocking is not one of these any more.** It was, from private `Block` entries on
/// this agent's chain, and the comment here used to claim that made it private. That was
/// false: a private entry hides its content but not its timing, and a `Block` committed
/// moments after a message arrived named who had been blocked to anyone watching, since
/// there was usually only one candidate. Blocking is now the reader's own app's business,
/// applied once to this read and to every other.
///
/// The last filter is unconditional, where #301's was administrators-only. It no longer
/// depends on who is asking, so `get_inbox` makes no cross-zome call of its own.
///
/// A message that fails to decrypt comes back as `InboxEntry::Unreadable` and is logged
/// at `warn!`, because in this direction it is a fault rather than a filter. Those stay:
/// a role lives inside the ciphertext, so an entry that will not decrypt cannot be known
/// to be a role message, and dropping it here would hide the one fault the inbox exists
/// to surface. The whole call does not fail either: one bad message should not hide the
/// rest of somebody's inbox.
#[hdk_extern]
pub fn get_inbox(_: ()) -> ExternResult<Vec<InboxEntry>> {
  let me = agent_info()?.agent_initial_pubkey;

  Ok(
    read_inbox_entries(&me)?
      .into_iter()
      .filter(|entry| !matches!(entry, InboxEntry::Read(m) if m.role.is_some()))
      .collect(),
  )
}

/// Whether a role message's author is claiming the role, decided only from facts the
/// author cannot choose.
///
/// **Pure, and the reason it is pure.** This used to read the body's `direction` label,
/// which the sender writes. `send_role_message` derives that label honestly, but a
/// modified client can write whatever it likes, so a reader that believes it is trusting
/// the sender about the sender. Two things here are not the sender's to choose: whether
/// the body carries an event, and whether the action's author is the `User` the case is
/// keyed to. Everything else is a label.
///
/// So a message is making a claim when it carries an event, **or when its author is not
/// the case's opener**. Writing on your own case claims nothing; writing on anybody
/// else's is acting as the role, and the author has to hold it.
///
/// An author whose `User` cannot be resolved, or a role message with no case, both answer
/// `true`: the author cannot be shown to be the opener, so they are made to prove the role
/// instead. Fail closed.
pub(crate) fn claims_the_role(
  has_event: bool,
  author_user: Option<&ActionHash>,
  opener: Option<&ActionHash>,
) -> bool {
  if has_event {
    return true;
  }
  match (author_user, opener) {
    (Some(author), Some(opener)) => author != opener,
    _ => true,
  }
}

/// Whether a message's role label is one its author is entitled to make right now.
///
/// Decision 11: the role label inside a ciphertext is a claim, and every reader tests it
/// against the DHT at the moment of reading, never trusting what is in the body.
///
/// `memo` caches **`holds_role` itself**, not this function's answer. The difference
/// matters: whether a message makes a claim depends on the message, while whether its
/// author holds the role depends only on the author. Caching this function per
/// `(author, role)` would let one message that makes no claim record `true` for an author
/// and so wave through their next message that does — exactly what a removed
/// administrator needs for their old replies to stay readable.
fn role_claim_stands(
  message_role: &Option<RoleRef>,
  case: &Option<CaseRef>,
  author: &AgentPubKey,
  author_user: Option<&ActionHash>,
  memo: &mut Vec<(AgentPubKey, RoleRef, bool)>,
) -> ExternResult<bool> {
  let Some(role) = message_role else {
    return Ok(true);
  };
  let has_event = case.as_ref().is_some_and(|c| c.event.is_some());
  if !claims_the_role(has_event, author_user, case.as_ref().map(|c| &c.opener)) {
    return Ok(true);
  }

  if let Some((_, _, known)) = memo
    .iter()
    .find(|(agent, r, _)| agent == author && r == role)
  {
    return Ok(*known);
  }
  let checked = holds_role(author, role)?;
  memo.push((author.clone(), role.clone(), checked));
  Ok(checked)
}

/// An author's `User` and whether it is accepted, looked up once per agent.
///
/// One cross-zome pair per distinct author rather than per message, which matters because
/// a case carries many messages from the same few people. Both facts come from the same
/// `get_agent_user` call, so resolving the `User` for the role check costs nothing beyond
/// the acceptance check that was already happening.
pub(crate) struct AuthorFacts(Vec<(AgentPubKey, Option<ActionHash>, bool)>);

impl AuthorFacts {
  pub(crate) fn new() -> Self {
    Self(Vec::new())
  }

  fn lookup(&mut self, agent: &AgentPubKey) -> ExternResult<(Option<ActionHash>, bool)> {
    if let Some((_, user, accepted)) = self.0.iter().find(|(a, _, _)| a == agent) {
      return Ok((user.clone(), *accepted));
    }
    let user = get_agent_user(agent.clone())?
      .first()
      .and_then(|link| link.target.clone().into_action_hash());
    // No profile, or a profile that is not accepted, both mean "do not show their
    // messages". Either is a reason to skip rather than to fail the read.
    let accepted = match &user {
      Some(user) => check_if_entity_is_accepted("users".to_string(), user.clone())?,
      None => false,
    };
    self.0.push((agent.clone(), user.clone(), accepted));
    Ok((user, accepted))
  }

  pub(crate) fn user(&mut self, agent: &AgentPubKey) -> ExternResult<Option<ActionHash>> {
    Ok(self.lookup(agent)?.0)
  }

  fn accepted(&mut self, agent: &AgentPubKey) -> ExternResult<bool> {
    Ok(self.lookup(agent)?.1)
  }
}

/// Every message addressed to `me` that survives the read-side filters, oldest first.
///
/// Split out of `get_inbox` so that `get_role_inbox` and `get_my_role_correspondence`
/// run the *same* filters rather than copies that have to be kept in step. The cost is
/// that each of them decrypts messages it then discards; the alternative is three
/// block-and-acceptance implementations that can drift apart, which is the more
/// expensive mistake.
///
/// Role messages are **not** filtered out here. This is the shared read, and the three
/// callers want different slices of it: `get_inbox` drops every role message, the other
/// two keep only role messages. What is filtered here is the author's role *claim*, so
/// that no caller can forget to.
pub(crate) fn read_inbox_entries(me: &AgentPubKey) -> ExternResult<Vec<InboxEntry>> {
  let me = me.clone();

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
  let mut authors = AuthorFacts::new();
  // Same reasoning for the role check: one cross-zome call per (author, role) whose role
  // is actually in question, rather than one per message. A case with forty notes from
  // two admins costs two.
  let mut role_claims: Vec<(AgentPubKey, RoleRef, bool)> = Vec::new();

  for link in links {
    let Some(hash) = link.target.clone().into_action_hash() else {
      continue;
    };
    let Some(record) = get(hash.clone(), GetOptions::default())? else {
      continue;
    };

    let from = record.action().author().clone();

    if !authors.accepted(&from)? {
      continue;
    }

    let at = record.action().timestamp();

    match decrypt_body(&record, me.clone(), from.clone())? {
      Some(body) => {
        // Withheld, not returned: the author is claiming a role they do not hold now.
        // Cached per (author, role), because one case carries many messages from the
        // same few holders.
        let author_user = authors.user(&from)?;
        if !role_claim_stands(
          &body.role,
          &body.case,
          &from,
          author_user.as_ref(),
          &mut role_claims,
        )? {
          continue;
        }

        out.push(InboxEntry::Read(Message {
          hash,
          from,
          to: me.clone(),
          at,
          content: body.content,
          role: body.role,
          direction: body.direction,
          case: body.case,
        }))
      }
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
  /// Held, and deliberately not shown: the author is not an accepted member now, or is
  /// claiming a role they do not hold. **Blocking is not among these any more**, and is
  /// applied by the reader's own app instead.
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

  let mut authors = AuthorFacts::new();
  if !authors.accepted(&from)? {
    return Ok(MessageRead::Withheld);
  }

  // No early return for a message of this agent's own. #301 had one, because for a
  // personal message the counterparty is whoever the `Inbox` link named and this function
  // does not know it. That is still true, and `decrypt_body` reaches the same answer by
  // itself: passing `(me, me)` derives the wrong shared secret for a message encrypted to
  // somebody else, so it fails and returns `Unreadable` exactly as the early return did.
  //
  // Removing it is what lets a sender read their **own copy of a role message**, which is
  // encrypted `(me, me)` and so does decrypt. Without this, a holder could not fetch
  // their own case event from a nudge.
  match decrypt_body(&record, me.clone(), from.clone())? {
    Some(body) => {
      // The same role check `get_inbox` applies. A reply or an event from somebody who
      // no longer holds the role is withheld, whichever path reads it.
      let mut memo = Vec::new();
      let author_user = authors.user(&from)?;
      if !role_claim_stands(
        &body.role,
        &body.case,
        &from,
        author_user.as_ref(),
        &mut memo,
      )? {
        return Ok(MessageRead::Withheld);
      }
      Ok(MessageRead::Read(Message {
        hash,
        from,
        to: me,
        at: record.action().timestamp(),
        content: body.content,
        role: body.role,
        direction: body.direction,
        case: body.case,
      }))
    }
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
        content: body.content,
        role: body.role,
        direction: body.direction,
        case: body.case,
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

#[cfg(test)]
mod tests {
  use super::*;

  fn user(byte: u8) -> ActionHash {
    ActionHash::from_raw_36(vec![byte; 36])
  }

  /// The rule this file exists to get right, as a table.
  ///
  /// `claims_the_role` is pure so that it can be proven here rather than argued about.
  /// An honest zome cannot send a body with a forged `opener`, so a Sweettest cannot
  /// produce the case these assertions cover: `send_role_message` fills the opener in
  /// from the caller's own `User`. The rule still has to hold against a client that does
  /// not, which is what a unit test is for. The same reasoning as the integrity zome's
  /// pure checks.
  ///
  /// **To make this go red:** in `claims_the_role`, return `false` instead of comparing
  /// author with opener, which is what trusting the body's `direction` label amounted
  /// to. The forged-opener case and the holder-replying case both flip.
  #[test]
  fn a_message_claims_the_role_unless_its_author_opened_the_case() {
    let alice = user(1);
    let bob = user(2);

    // A member writing on their own case claims nothing, and stands without holding
    // anything. This is the ordinary report, and the reason the check cannot simply
    // require the role of every role message.
    assert!(
      !claims_the_role(false, Some(&alice), Some(&alice)),
      "writing on your own case is not claiming the role"
    );

    // The gap this rule closes: a body that carries somebody else's `User` as the opener
    // and no event. Under the old reading it was labelled `toHolders`, claimed nothing,
    // and was filed into that member's case by every reader.
    assert!(
      claims_the_role(false, Some(&bob), Some(&alice)),
      "writing on another member's case is acting as the role, whatever the body says"
    );

    // Any event is holder-only, including one on your own case.
    assert!(
      claims_the_role(true, Some(&alice), Some(&alice)),
      "a case event always claims the role, even on your own case"
    );
    assert!(
      claims_the_role(true, Some(&bob), Some(&alice)),
      "a case event on someone else's case claims the role"
    );

    // Fail closed. Neither of these can be shown to be the opener, so both are made to
    // prove the role instead of being waved through.
    assert!(
      claims_the_role(false, None, Some(&alice)),
      "an author with no resolvable User cannot be shown to be the opener"
    );
    assert!(
      claims_the_role(false, Some(&alice), None),
      "a role message with no case has no opener to match against"
    );
  }
}
