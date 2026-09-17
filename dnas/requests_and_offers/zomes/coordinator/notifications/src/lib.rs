use hdk::prelude::*;
use std::collections::HashSet;
use notifications_integrity::*;
use utils::{
  errors::{CommonError, UsersError}, external_local_call, find_original_action_hash,
  get_all_revisions_for_entry, EntityActionHash, OriginalActionHash,
};

/// Rate limits. DNA properties in the next revision; constants for the draft.
/// See NOTIFICATION_ARCHITECTURE.md section 11.
const UNCONNECTED_PER_DAY: usize = 10;
const CONNECTED_PER_DAY: usize = 100;
const DAY_MICROS: i64 = 24 * 60 * 60 * 1_000_000;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreateNotificationInput {
  pub kind: NotificationKind,
  pub recipient: AgentPubKey,
  pub subject: Option<AnyLinkableHash>,
  pub payload: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RetractNotificationInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
}

/// Mirrors messaging::SendMessageInput without a crate dependency.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct SendMessageInput {
  stream_id: String,
  content: String,
  agents: Vec<AgentPubKey>,
}

const SIGNAL_STREAM: &str = "notifications";

fn my_user_hash() -> ExternResult<Option<ActionHash>> {
  let me = agent_info()?.agent_initial_pubkey;
  let links: Vec<Link> = external_local_call("get_agent_user", "users_organizations", me)?;
  Ok(links.first().and_then(|l| l.target.clone().into_action_hash()))
}

fn ensure_accepted() -> ExternResult<()> {
  let Some(user_hash) = my_user_hash()? else {
    return Err(UsersError::UserProfileRequired.into());
  };
  let accepted: bool = external_local_call(
    "check_if_entity_is_accepted",
    "administration",
    EntityActionHash {
      entity: "users".to_string(),
      entity_original_action_hash: OriginalActionHash(user_hash),
    },
  )?;
  if !accepted {
    return Err(CommonError::InvalidData("only accepted members may notify".to_string()).into());
  }
  Ok(())
}

fn latest_notification(original: ActionHash) -> ExternResult<Option<(Record, Notification)>> {
  let mut revisions = get_all_revisions_for_entry(
    OriginalActionHash(original),
    LinkTypes::NotificationUpdates,
  )?;
  // Link order is not guaranteed; the latest revision is the newest action.
  revisions.sort_by_key(|r| r.action().timestamp());
  let Some(record) = revisions.into_iter().last() else {
    return Ok(None);
  };
  let entry: Option<Notification> = record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?;
  Ok(entry.map(|n| (record, n)))
}

fn inbox_links(agent: AgentPubKey) -> ExternResult<Vec<Link>> {
  let filter = LinkTypes::RecipientInbox
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  get_links(LinkQuery::new(agent, filter), GetStrategy::Network)
}

/// Every agent holding an Open InterestMarker addressed to me. One inbox walk.
/// Two markers, one each way, are a connection; see section 12.
fn connected_peers() -> ExternResult<HashSet<AgentPubKey>> {
  let me = agent_info()?.agent_initial_pubkey;
  let mut peers = HashSet::new();
  for link in inbox_links(me)? {
    let Some(hash) = link.target.into_action_hash() else { continue };
    if let Some((_, n)) = latest_notification(hash)? {
      if n.kind == NotificationKind::InterestMarker && n.state == NotificationState::Open {
        peers.insert(n.actor);
      }
    }
  }
  Ok(peers)
}

#[hdk_extern]
pub fn is_connected(other: AgentPubKey) -> ExternResult<bool> {
  Ok(connected_peers()?.contains(&other))
}

/// Counts this agent's own Notification creates in the last 24 hours, from the
/// local source chain. Connected tier: only sends to `to`. Unconnected tier:
/// sends to every recipient this agent is not connected to, so pings to
/// connected peers do not draw on the stranger budget.
fn my_recent_count(to: &AgentPubKey, peers: &HashSet<AgentPubKey>) -> ExternResult<usize> {
  let connected = peers.contains(to);
  let now = sys_time()?.as_micros();
  let filter = ChainQueryFilter::new()
    .entry_type(UnitEntryTypes::Notification.try_into()?)
    .include_entries(true)
    .action_type(ActionType::Create);
  let mut count = 0usize;
  for record in query(filter)? {
    if now - record.action().timestamp().as_micros() > DAY_MICROS {
      continue;
    }
    let entry: Option<Notification> = record.entry().to_app_option().map_err(CommonError::Serialize)?;
    let Some(n) = entry else { continue };
    let Recipient::Agent(ref recipient) = n.recipient else { continue };
    if connected {
      if recipient == to {
        count += 1;
      }
    } else if !peers.contains(recipient) {
      count += 1;
    }
  }
  Ok(count)
}

fn already_open_on(subject: &Option<AnyLinkableHash>, to: &AgentPubKey) -> ExternResult<bool> {
  let me = agent_info()?.agent_initial_pubkey;
  for link in inbox_links(to.clone())? {
    let Some(hash) = link.target.into_action_hash() else { continue };
    if let Some((_, n)) = latest_notification(hash)? {
      if n.actor == me && n.subject == *subject && n.state == NotificationState::Open {
        return Ok(true);
      }
    }
  }
  Ok(false)
}

#[hdk_extern]
pub fn create_notification(input: CreateNotificationInput) -> ExternResult<Record> {
  ensure_accepted()?;
  let me = agent_info()?.agent_initial_pubkey;
  if input.recipient == me {
    return Err(CommonError::InvalidData("cannot notify yourself".to_string()).into());
  }
  if already_open_on(&input.subject, &input.recipient)? {
    return Err(CommonError::InvalidData("an open notification on this subject already exists".to_string()).into());
  }
  let peers = connected_peers()?;
  let limit = if peers.contains(&input.recipient) { CONNECTED_PER_DAY } else { UNCONNECTED_PER_DAY };
  if my_recent_count(&input.recipient, &peers)? >= limit {
    return Err(CommonError::InvalidData("notification rate limit reached".to_string()).into());
  }

  let notification = Notification {
    kind: input.kind,
    recipient: Recipient::Agent(input.recipient.clone()),
    subject: input.subject.clone(),
    actor: me,
    state: NotificationState::Open,
    payload: input.payload,
    created_at: sys_time()?,
  };
  let hash = create_entry(&EntryTypes::Notification(notification))?;

  create_link(input.recipient.clone(), hash.clone(), LinkTypes::RecipientInbox, ())?;
  if let Some(subject) = input.subject {
    create_link(subject, hash.clone(), LinkTypes::SubjectNotifications, ())?;
  }

  // Live-signal layer: best effort, and absent until #213 lands. The DHT
  // entry is the source of truth either way.
  let signal = SendMessageInput {
    stream_id: SIGNAL_STREAM.to_string(),
    content: hash.to_string(),
    agents: vec![input.recipient],
  };
  if let Err(e) = external_local_call::<_, ()>("send_message", "messaging", signal) {
    warn!("notification signal not sent: {:?}", e);
  }

  get(hash, GetOptions::default())?.ok_or(CommonError::RecordNotFound("notification".to_string()).into())
}

/// Every Open notification addressed to me, latest revision of each.
#[hdk_extern]
pub fn get_my_notifications(_: ()) -> ExternResult<Vec<Record>> {
  let me = agent_info()?.agent_initial_pubkey;
  let mut out = Vec::new();
  for link in inbox_links(me)? {
    let Some(hash) = link.target.into_action_hash() else { continue };
    if let Some((record, n)) = latest_notification(hash)? {
      if n.state == NotificationState::Open {
        out.push(record);
      }
    }
  }
  Ok(out)
}

/// Notifications I have marked seen, as original action hashes.
#[hdk_extern]
pub fn get_seen_notification_hashes(_: ()) -> ExternResult<Vec<ActionHash>> {
  let filter = ChainQueryFilter::new()
    .entry_type(UnitEntryTypes::SeenMarker.try_into()?)
    .include_entries(true);
  let mut out = Vec::new();
  for record in query(filter)? {
    let entry: Option<SeenMarker> = record.entry().to_app_option().map_err(CommonError::Serialize)?;
    if let Some(m) = entry {
      out.push(m.notification_hash);
    }
  }
  Ok(out)
}

#[hdk_extern]
pub fn mark_seen(notification_hash: ActionHash) -> ExternResult<ActionHash> {
  let original = find_original_action_hash(notification_hash)?;
  create_entry(&EntryTypes::SeenMarker(SeenMarker { notification_hash: original.0 }))
}

/// Actor withdraws. State update plus an update-chain link, never a delete.
#[hdk_extern]
pub fn retract_notification(input: RetractNotificationInput) -> ExternResult<Record> {
  let me = agent_info()?.agent_initial_pubkey;
  let original = find_original_action_hash(input.original_action_hash)?;
  let Some((_, current)) = latest_notification(original.0.clone())? else {
    return Err(CommonError::RecordNotFound("notification".to_string()).into());
  };
  if current.actor != me {
    return Err(UsersError::NotAuthor.into());
  }
  let updated = Notification { state: NotificationState::Retracted, ..current };
  let new_hash = update_entry(input.previous_action_hash, &EntryTypes::Notification(updated))?;
  create_link(original.0, new_hash.clone(), LinkTypes::NotificationUpdates, ())?;
  get(new_hash, GetOptions::default())?.ok_or(CommonError::RecordNotFound("notification".to_string()).into())
}
