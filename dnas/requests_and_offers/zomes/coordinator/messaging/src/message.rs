use hdk::prelude::*;
use messaging_integrity::{EncryptedMessage, EntryTypes, LinkTypes};

use crate::cases::{CaseEvent, CaseKind, CaseRef, MAX_CASE_ID_BYTES};
use crate::external_calls::{check_if_entity_is_accepted, get_agent_user, get_user_agents};
use crate::roles::{require_enabled, require_holder, role_holders, RoleDirection, RoleRef};
use crate::{send_nudge, SendNudgeInput};

/// Returned when a member's agent keys cannot be found from this device right now.
///
/// **It never means the member has none.** A member cannot create a profile or a listing
/// without an agent key, so the list is never genuinely empty. What an empty lookup means
/// is that *this* device could not find them: `get_user_agents` reads links with
/// `GetStrategy::Network`, which `holochain_zome_types` 0.6 documents at
/// `src/entry.rs:91-104` as falling back to locally cached metadata, so with no network
/// and a cold cache it returns nothing at all.
///
/// The old wording, "That member has no agent keys", reported that as the recipient's
/// fault. It is a condition of this device, it passes on its own, and the caller should
/// wait and try again rather than tell the member something untrue. The interface matches
/// on this string to hold the message in its outbox, so **changing the text means
/// changing it there too** (`ui/src/lib/utils/messaging-threads.ts`).
/// **One line, no continuation.** A `\` continuation here once collapsed into four
/// spaces inside the sentence, which both test suites happily matched while the real
/// string did not. The UI test reads this literal straight out of this file, so it stays
/// on one line and stays easy to extract.
pub const DEVICES_NOT_FOUND: &str = "Could not reach that member's devices just now. The message has not been sent; try again in a moment.";

/// Largest plaintext this zome will encrypt and send.
///
/// Checked here, before encrypting, so an oversized message fails the call with a
/// clear error rather than being rejected later by validation, where the caller would
/// see a write failure instead of a reason. The integrity zome bounds the ciphertext
/// as well, because validation cannot trust that this check ran.
pub const MAX_CONTENT_BYTES: usize = 16 * 1024;

/// Largest send identifier this zome will accept. A UUID is 36 bytes.
pub const MAX_SEND_ID_BYTES: usize = 64;

/// What a sender hands in: one message for one member.
///
/// No conversation ID and no context. A thread is keyed by the counterparty alone
/// so plain chat is assumed and anything with a context is a card in the
/// interface rather than a field here.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageInput {
  /// The recipient's `User`, by its original action hash, not an agent key. A member
  /// may have several agents and each gets its own copy.
  pub to_user: ActionHash,
  pub content: String,
  /// This send's identity, chosen by the caller. See `MessageBody::send_id`.
  #[serde(default)]
  pub send_id: String,
  /// How far the sender has read in this conversation, if they are telling.
  #[serde(default)]
  pub read_up_to: Option<Timestamp>,
  /// A listing published from this conversation. Only valid with empty `content`.
  #[serde(default)]
  pub listing: Option<ActionHash>,
}

/// What a sender hands in for a role message: one message to every holder of a role.
///
/// The opener and the direction are worked out here, never taken from the caller.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SendRoleMessageInput {
  pub role: RoleRef,
  pub content: String,
  /// This send's identity, chosen by the caller. See `MessageBody::send_id`.
  #[serde(default)]
  pub send_id: String,
  /// Chosen by the sender. Never the whole key for a case: see `CaseRef::opener`.
  pub case_id: String,
  pub kind: CaseKind,
  /// The `User` whose case this acts on. `None` means the caller's own case, which is
  /// how a case is opened and how a member follows one up.
  #[serde(default)]
  pub opener: Option<ActionHash>,
  /// `None` for an ordinary message on the case. `Some` for one of the seven events,
  /// every one of which only a current holder may send.
  #[serde(default)]
  pub event: Option<CaseEvent>,
}

/// The plaintext that gets encrypted.
///
/// Everything that groups or labels a message travels inside the ciphertext rather than
/// beside it, so the DHT carries neither the grouping nor the fact that a message is a
/// report. What the DHT does carry for the life of the network is the action: author,
/// recipient via the `Inbox` link base, and timestamp.
///
/// The three role fields are absent on a personal message and `#[serde(default)]`, so a
/// body encoded without them still decodes. A decode failure surfaces as an `Unreadable`
/// inbox entry, which is the fault signal, and that is too high a price for a missing
/// optional field.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MessageBody {
  pub(crate) content: String,
  /// This send's identity, chosen by the sender.
  ///
  /// **Used only to match copies of the same message, never trusted for anything else.**
  /// One send becomes one entry per recipient agent, and a retry after a lost answer can
  /// add another, so every reader collapses by this and keeps the earliest. Keeping the
  /// earliest is what stops a sender reusing an id to replace something already sent.
  ///
  /// `#[serde(default)]` so a body written before send ids existed still decodes, with an
  /// empty id; those fall back to the older collapse rule.
  #[serde(default)]
  pub(crate) send_id: String,
  /// How far the sender has read in this conversation, riding along for free.
  ///
  /// A read receipt is a remote signal and leaves no record anywhere. This is the
  /// reliable half: the same high-water mark carried inside the next message to that
  /// person, so it arrives eventually without a second signal and without telling anyone
  /// watching that the reader was online.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub(crate) read_up_to: Option<Timestamp>,
  /// A listing published from inside this conversation.
  ///
  /// **Only ever on a card-only message, whose `content` is empty**, and shown as a card
  /// rather than as a tag on a chat message. That keeps alpha 2's rule that messages
  /// carry no context: this is how a card reaches the other person, not context on
  /// something someone wrote. `send_message` refuses a body carrying both.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub(crate) listing: Option<ActionHash>,
  /// Which role this is addressed to, or sent as. `None` for a personal message.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub(crate) role: Option<RoleRef>,
  /// Which way it travels. **Never trusted for authorisation**: computed at send, and
  /// kept so the interface can group a member's correspondence.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub(crate) direction: Option<RoleDirection>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub(crate) case: Option<CaseRef>,
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
  require_content_within_bound(&input.content)?;
  require_send_id_within_bound(&input.send_id)?;

  // **A message is text or a card, never both.** A listing travels on a card-only
  // message, which is how it reaches the other person without becoming a context tag on
  // something somebody wrote. Allowing both would quietly reintroduce the context that
  // alpha 2 removed from messages.
  if input.listing.is_some() && !input.content.is_empty() {
    return Err(wasm_error!(WasmErrorInner::Guest(
      "A message carries either text or a listing, never both. Send the listing as its \
       own card."
        .to_string()
    )));
  }

  let me = agent_info()?.agent_initial_pubkey;
  require_accepted_member(me.clone())?;

  let body = MessageBody {
    content: input.content,
    send_id: input.send_id,
    read_up_to: input.read_up_to,
    listing: input.listing,
    role: None,
    direction: None,
    case: None,
  };

  deliver(&me, &body, &[input.to_user])
}

/// Send one message to every holder of a role, and open or add to a case.
///
/// **A message to a role reaches every holder**, which is what gives
/// holders a channel between themselves and means a member's follow-up reaches all of
/// them. A holder's reply also reaches the member who opened the case.
///
/// Who may do what:
///
/// - **Any accepted member may write to a role.** That is how a case is opened and
///   followed up. The caller is not claiming to hold anything.
/// - **Only a current holder may reply as the role**, because that reply carries the
///   role's authority, and every reader re-checks it on read.
/// - **Only a current holder may send a case event.** Checked here and again on read,
///   because a status can change in between and a modified client could skip this.
///
/// The case's opener and the message's direction are worked out from the caller's own
/// `User`, never taken from the input: the direction is a label for the interface, and a
/// forged opener would otherwise let a member write into somebody else's case.
#[hdk_extern]
pub fn send_role_message(input: SendRoleMessageInput) -> ExternResult<Vec<SentMessage>> {
  require_content_within_bound(&input.content)?;
  require_send_id_within_bound(&input.send_id)?;
  if input.case_id.len() > MAX_CASE_ID_BYTES {
    return Err(wasm_error!(WasmErrorInner::Guest(format!(
      "Case ID is {} bytes, over the {MAX_CASE_ID_BYTES} byte limit",
      input.case_id.len()
    ))));
  }
  require_enabled(&input.role)?;

  let me = agent_info()?.agent_initial_pubkey;
  let my_user = require_accepted_member(me.clone())?;

  // `None` means my own case. A caller who names their own `User` explicitly means the
  // same thing, so both land on `ToHolders`.
  let opener = input.opener.unwrap_or_else(|| my_user.clone());
  let direction = if opener == my_user {
    RoleDirection::ToHolders
  } else {
    RoleDirection::FromHolder
  };

  if direction == RoleDirection::FromHolder {
    require_holder(&me, &input.role, "reply on another member's case as that role")?;
  }
  if input.event.is_some() {
    require_holder(&me, &input.role, "send a case event")?;
  }

  let holders = role_holders(&input.role, &[])?;
  if holders.is_empty() {
    return Err(wasm_error!(WasmErrorInner::Guest(
      "That role has no holders, so there is nowhere to deliver to".to_string()
    )));
  }

  // Holders, the sender, and on a reply the member who opened the case. The sender is
  // included deliberately: with a copy of their own message in their own inbox, every
  // participant reads the whole case from one inbox read, with no chain walk and no
  // duplicate copies to collapse.
  let mut recipients = holders;
  for user in [my_user, opener.clone()] {
    if !recipients.contains(&user) {
      recipients.push(user);
    }
  }

  let body = MessageBody {
    content: input.content,
    send_id: input.send_id,
    // A role message carries no read mark and no listing: role correspondence is its own
    // area, and a card belongs to the conversation it was published from.
    read_up_to: None,
    listing: None,
    role: Some(input.role),
    direction: Some(direction),
    case: Some(CaseRef {
      case_id: input.case_id,
      opener,
      kind: input.kind,
      event: input.event,
    }),
  };

  deliver(&me, &body, &recipients)
}

/// Refuse an oversized message before anything is encrypted.
///
/// Checked here, before encrypting, so the caller sees a reason rather than a write
/// failure from validation. The integrity zome bounds the ciphertext as well, because
/// validation cannot trust that this check ran.
/// Refuse an oversized send id before anything is encrypted.
fn require_send_id_within_bound(send_id: &str) -> ExternResult<()> {
  if send_id.len() > MAX_SEND_ID_BYTES {
    return Err(wasm_error!(WasmErrorInner::Guest(format!(
      "Send ID is {} bytes, over the {MAX_SEND_ID_BYTES} byte limit",
      send_id.len()
    ))));
  }
  Ok(())
}

fn require_content_within_bound(content: &str) -> ExternResult<()> {
  if content.len() > MAX_CONTENT_BYTES {
    return Err(wasm_error!(WasmErrorInner::Guest(format!(
      "Message content is {} bytes, over the {MAX_CONTENT_BYTES} byte limit",
      content.len()
    ))));
  }
  Ok(())
}

/// Encrypt and store one copy of `body` for every agent of every recipient `User`, then
/// nudge each one.
///
/// The stored entry is the delivery guarantee. The nudge is only timeliness, and it
/// carries the action hash alone, so a missed nudge costs the recipient nothing but a
/// later read.
///
/// One encrypted entry per recipient *agent*, because
/// `ed_25519_x_salsa20_poly1305_encrypt` encrypts to an agent key rather than to a
/// person. A member on two devices gets two entries, each readable by exactly one of
/// their agents. A role message to three admins who run two devices each is six entries.
///
/// Two consequences of encrypting per agent key, both accepted rather than worked
/// around. A sender can read their own sent messages only from the agent that sent them,
/// since only that agent's key derives the shared secret. And an agent added to a `User`
/// later cannot read anything sent before it existed, because no copy was encrypted to
/// it.
fn deliver(
  me: &AgentPubKey,
  body: &MessageBody,
  recipients: &[ActionHash],
) -> ExternResult<Vec<SentMessage>> {
  let plaintext = XSalsa20Poly1305Data::from(
    ExternIO::encode(body)
      .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Could not encode message: {e:?}"))))?
      .into_vec(),
  );

  let mut agents: Vec<AgentPubKey> = Vec::new();
  for user in recipients {
    for agent in get_user_agents(user.clone())? {
      if !agents.contains(&agent) {
        agents.push(agent);
      }
    }
  }
  if agents.is_empty() {
    return Err(wasm_error!(WasmErrorInner::Guest(
      DEVICES_NOT_FOUND.to_string()
    )));
  }

  let mut sent = Vec::with_capacity(agents.len());

  for agent in agents {
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
