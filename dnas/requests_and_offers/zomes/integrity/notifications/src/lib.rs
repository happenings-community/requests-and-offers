use hdi::prelude::*;

/// Upper bound on the payload, in bytes. Sealed payloads will be larger than
/// their plaintext; this leaves headroom under lair's 8KB per-call ceiling.
pub const MAX_PAYLOAD_BYTES: usize = 4096;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(tag = "type", content = "value")]
pub enum Recipient {
  Agent(AgentPubKey),
  Role(String),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum NotificationKind {
  InterestMarker,
  Flag,
  JoinRequest,
  StatusChange,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum NotificationState {
  Open,
  Resolved,
  Retracted,
  Dismissed,
  Upheld,
}

/// One durable record of "something happened", addressed to a recipient.
/// See NOTIFICATION_ARCHITECTURE.md section 4. `payload` is plaintext in this
/// draft and will be sealed to the recipient in the next revision.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Notification {
  pub kind: NotificationKind,
  pub recipient: Recipient,
  pub subject: Option<AnyLinkableHash>,
  pub actor: AgentPubKey,
  pub state: NotificationState,
  pub payload: String,
  pub created_at: Timestamp,
}

/// Recipient-authored, private. Marks a notification as seen by this agent.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct SeenMarker {
  pub notification_hash: ActionHash,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  Notification(Notification),
  #[entry_type(visibility = "private")]
  SeenMarker(SeenMarker),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  /// Recipient agent key -> notification action hash. The recipient's inbox.
  RecipientInbox,
  /// Subject hash -> notification action hash. Everything about a thing.
  SubjectNotifications,
  /// Original action hash -> revision action hash. Same shape as StatusUpdates.
  NotificationUpdates,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_agent_joining(
  _agent_pub_key: AgentPubKey,
  _membrane_proof: &Option<MembraneProof>,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

fn validate_notification_fields(
  author: &AgentPubKey,
  n: &Notification,
) -> ExternResult<ValidateCallbackResult> {
  if n.actor != *author {
    return Ok(ValidateCallbackResult::Invalid(
      "notification actor must be the action author".into(),
    ));
  }
  if let Recipient::Agent(ref r) = n.recipient {
    if *r == n.actor {
      return Ok(ValidateCallbackResult::Invalid(
        "notification recipient must differ from actor".into(),
      ));
    }
  }
  if n.payload.len() > MAX_PAYLOAD_BYTES {
    return Ok(ValidateCallbackResult::Invalid("notification payload too large".into()));
  }
  Ok(ValidateCallbackResult::Valid)
}

/// Link deletion is refused for every link type. Retraction is a state update
/// on the entry, never removal of the index; the same stance as bucket links
/// elsewhere in the app.
fn refuse_link_delete() -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(
    "notification links are not deletable; retract the notification instead".into(),
  ))
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::StoreEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, action } => match app_entry {
        EntryTypes::Notification(n) => validate_notification_fields(&action.author, &n),
        EntryTypes::SeenMarker(_) => Ok(ValidateCallbackResult::Valid),
      },
      OpEntry::UpdateEntry { app_entry, action, .. } => match app_entry {
        // Admin resolutions (Dismissed, Upheld) will need must_get on the
        // original plus an admin check; coordinator-enforced in this draft.
        EntryTypes::Notification(n) => validate_notification_fields(&action.author, &n),
        EntryTypes::SeenMarker(_) => Ok(ValidateCallbackResult::Valid),
      },
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::RegisterDeleteLink { .. } => refuse_link_delete(),
    _ => Ok(ValidateCallbackResult::Valid),
  }
}
