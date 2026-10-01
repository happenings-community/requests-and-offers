use hdk::prelude::*;
use messaging_integrity::{EncryptedMessage, EntryTypes, LinkTypes};

use crate::external_calls::{
  check_if_entity_is_accepted, check_if_entity_is_administrator, get_agent_user, get_user_agents,
};
use crate::{send_nudge, SendNudgeInput};

/// Largest plaintext this zome will encrypt and send.
///
/// Checked here, before encrypting, so an oversized message fails the call with a
/// clear error rather than being rejected later by validation, where the caller would
/// see a write failure instead of a reason. The integrity zome bounds the ciphertext
/// as well, because validation cannot trust that this check ran.
pub const MAX_CONTENT_BYTES: usize = 16 * 1024;

/// Largest conversation ID this zome will send. Generous for an identifier: a UUID is
/// 36 bytes, and a hash-derived ID is under 60.
pub const MAX_CONVERSATION_ID_BYTES: usize = 256;

/// What a message is for.
///
/// **The kind lives inside the encryption, not beside it.** It is a field of
/// `MessageBody`, so a technical report is an ordinary `EncryptedMessage` on the DHT and
/// only the sender and the recipient can tell it apart from any other message. Putting
/// it on the entry, or in a link tag, would publish to the whole network that a member
/// had reported something.
///
/// `AdminReport` is a *technical* report, such as a message that could not be opened.
/// Conduct is a different route, to stewards, and comes later with the stewarding
/// module. Nothing here reports a conversation.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum MessageKind {
  #[default]
  Personal,
  AdminReport,
}

/// What a sender hands in: one message for one member, on one conversation.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageInput {
  /// The recipient's `User`, by its original action hash, not an agent key. A member
  /// may have several agents and each gets its own copy.
  pub to_user: ActionHash,
  pub conversation_id: String,
  pub content: String,
  /// Omitted by every existing caller, and by the interface for an ordinary message.
  #[serde(default)]
  pub kind: MessageKind,
}

/// The plaintext that gets encrypted. The conversation ID travels inside the
/// ciphertext rather than beside it, so the DHT does not carry the grouping.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MessageBody {
  pub(crate) conversation_id: String,
  pub(crate) content: String,
  /// `#[serde(default)]` so a body encrypted before this field existed still decodes,
  /// as `Personal`. There are no such bodies outside a test today, since #301 is
  /// unmerged, but a decode failure here would surface as an `Unreadable` inbox entry,
  /// which is the fault signal, and that is too high a price for one missing field.
  #[serde(default)]
  pub(crate) kind: MessageKind,
}

/// What `send_message` reports back: one entry per recipient agent.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SentMessage {
  pub agent: AgentPubKey,
  pub hash: ActionHash,
}

/// Store a message for each of the recipient's agents, then nudge them.
///
/// The stored entry is the delivery guarantee. The nudge is only timeliness, and it
/// carries the action hash alone, so a missed nudge costs the recipient nothing but a
/// later read.
///
/// One encrypted entry per recipient agent, because `ed_25519_x_salsa20_poly1305_encrypt`
/// encrypts to an agent key rather than to a person. A member on two devices gets two
/// entries, each readable by exactly one of their agents.
///
/// Two consequences of encrypting per agent key, both accepted rather than worked
/// around. A sender can read their own sent messages only from the agent that sent
/// them, since only that agent's key derives the shared secret. And an agent added to
/// a `User` later cannot read anything sent before it existed, because no copy was
/// encrypted to it.
#[hdk_extern]
pub fn send_message(input: SendMessageInput) -> ExternResult<Vec<SentMessage>> {
  if input.content.len() > MAX_CONTENT_BYTES {
    return Err(wasm_error!(WasmErrorInner::Guest(format!(
      "Message content is {} bytes, over the {MAX_CONTENT_BYTES} byte limit",
      input.content.len()
    ))));
  }
  if input.conversation_id.len() > MAX_CONVERSATION_ID_BYTES {
    return Err(wasm_error!(WasmErrorInner::Guest(format!(
      "Conversation ID is {} bytes, over the {MAX_CONVERSATION_ID_BYTES} byte limit",
      input.conversation_id.len()
    ))));
  }

  let me = agent_info()?.agent_initial_pubkey;
  require_accepted_member(me.clone())?;

  // A technical report may only be addressed to a network administrator. Without this
  // a member could mark any message as a report, and it would then be hidden from the
  // recipient's ordinary inbox by `get_inbox` while never appearing anywhere else,
  // because only an administrator has an admin area to see it in.
  if input.kind == MessageKind::AdminReport
    && !check_if_entity_is_administrator(input.to_user.clone())?
  {
    return Err(wasm_error!(WasmErrorInner::Guest(
      "A technical report can only be sent to a network administrator, and that member \
       is not one"
        .to_string()
    )));
  }

  let recipients = get_user_agents(input.to_user.clone())?;
  if recipients.is_empty() {
    return Err(wasm_error!(WasmErrorInner::Guest(
      "That member has no agent keys, so there is nowhere to deliver to".to_string()
    )));
  }

  let body = MessageBody {
    conversation_id: input.conversation_id,
    content: input.content,
    kind: input.kind,
  };
  let plaintext = XSalsa20Poly1305Data::from(
    ExternIO::encode(&body)
      .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Could not encode message: {e:?}"))))?
      .into_vec(),
  );

  let mut sent = Vec::with_capacity(recipients.len());

  for agent in recipients {
    // Encrypt: (sender, recipient). Note that decryption takes them the other way
    // round, (recipient, sender), and lives in hdi. Getting that order wrong fails
    // in a way that looks like a key problem.
    let encrypted =
      ed_25519_x_salsa20_poly1305_encrypt(me.clone(), agent.clone(), plaintext.clone())?;

    let hash = create_entry(&EntryTypes::EncryptedMessage(EncryptedMessage { encrypted }))?;

    // Base is the recipient's agent key, target is the action hash. Validation proves
    // the link's author wrote the message it points at.
    create_link(
      agent.clone(),
      hash.clone(),
      LinkTypes::Inbox,
      LinkTag::new(Vec::<u8>::new()),
    )?;

    sent.push(SentMessage {
      agent: agent.clone(),
      hash: hash.clone(),
    });

    // One nudge per entry, since each names a different hash. Best effort by design, so
    // a failure here must not undo the stored message: `?` would abort the call and roll
    // back entries already written, making delivery depend on the nudge it is supposed to
    // be independent of. In 0.6.1 `send_remote_signal` always returns Ok, so this cannot
    // bite today; the point is that the code should not rely on that.
    if let Err(e) = send_nudge(SendNudgeInput {
      hash: hash.clone(),
      agents: vec![agent.clone()],
    }) {
      warn!("Message {hash:?} was stored for {agent:?} but its nudge failed: {e:?}");
    }
  }

  Ok(sent)
}

/// Refuse anyone who is not an accepted member.
///
/// The same pattern the other domains use: find the agent's `User`, then ask
/// `administration` whether it is accepted. Follows
/// `coordinator/requests/src/request.rs`.
///
/// This is the sender-side check. The recipient re-checks on read, because a status
/// can change after a message is sent and a modified client could skip this.
pub fn require_accepted_member(agent: AgentPubKey) -> ExternResult<ActionHash> {
  let links = get_agent_user(agent)?;
  let Some(link) = links.first() else {
    return Err(wasm_error!(WasmErrorInner::Guest(
      "You need a member profile before you can send messages".to_string()
    )));
  };

  let user_hash = link.target.clone().into_action_hash().ok_or_else(|| {
    wasm_error!(WasmErrorInner::Guest(
      "A user link did not point at an action hash".to_string()
    ))
  })?;

  if !check_if_entity_is_accepted("users".to_string(), user_hash.clone())? {
    return Err(wasm_error!(WasmErrorInner::Guest(
      "Your member profile is not accepted yet, so you cannot send messages".to_string()
    )));
  }

  Ok(user_hash)
}
