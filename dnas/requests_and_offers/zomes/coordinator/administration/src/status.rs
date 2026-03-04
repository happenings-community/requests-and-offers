use administration_integrity::*;
use chrono::Duration;
use hdk::prelude::*;
use status::*;
use utils::{
  errors::{AdministrationError, CommonError, StatusError},
  find_original_action_hash, get_all_revisions_for_entry, EntityActionHash, EntityAgent,
  OriginalActionHash, PreviousActionHash,
};

use crate::administration::check_if_agent_is_administrator;

/// Creates the initial `Status` entry (always `"pending"`) for the entity identified by
/// `input.entity_original_action_hash`.
///
/// Guards against duplicate status creation: returns `Err(StatusError::AlreadyStatus)` if
/// an `EntityStatus` link already exists for the resolved original action hash.
///
/// On success, creates:
/// - A `Status` entry in state `"pending"`.
/// - An `AllStatuses` link from `"{entity}.status"` path → status action hash.
/// - An `EntityStatus` link from entity original action hash → status action hash.
#[hdk_extern]
pub fn create_status(input: EntityActionHash) -> ExternResult<Record> {
  // Resolve the original action hash in case we received an updated action hash
  let resolved_original_action_hash =
    find_original_action_hash(input.entity_original_action_hash.0.clone())?;

  let link_type_filter = LinkTypes::EntityStatus
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(resolved_original_action_hash.0.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  if !links.is_empty() {
    return Err(StatusError::AlreadyStatus.into());
  }

  let status_hash = create_entry(&EntryTypes::Status(Status::pending()))?;
  let record = get(status_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::RecordNotFound("status".to_string()))?;

  let path = Path::from(format!("{}.status", input.entity));
  create_link(
    path.path_entry_hash()?,
    status_hash.clone(),
    LinkTypes::AllStatuses,
    (),
  )?;

  create_link(
    resolved_original_action_hash,
    status_hash,
    LinkTypes::EntityStatus,
    (),
  )?;

  Ok(record)
}

/// Returns the `EntityStatus` link for the given entity's original action hash.
///
/// Returns `Err(CommonError::LinkNotFound)` if no status link exists yet.
#[hdk_extern]
fn get_entity_status_link(input: EntityActionHash) -> ExternResult<Link> {
  let link_type_filter = LinkTypes::EntityStatus
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(
      input.entity_original_action_hash.0.clone(),
      link_type_filter,
    ),
    GetStrategy::Network,
  )?;

  let link = links
    .first()
    .ok_or(CommonError::LinkNotFound("status".to_string()))?;

  Ok(link.clone())
}

/// Returns the most recent `Status` record for the given original status action hash.
///
/// Resolves the latest revision by selecting the `AllStatuses` link with the most recent
/// timestamp. Returns `Ok(None)` if no status record exists.
#[hdk_extern]
pub fn get_latest_status_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  let link_type_filter = LinkTypes::AllStatuses
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(original_action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_status_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("status".to_string()))?,
    None => original_action_hash.clone(),
  };
  get(latest_status_hash, GetOptions::default())
}

/// Returns the deserialized [`Status`] value of the latest revision for the given original
/// status action hash, or `Ok(None)` if the record has no app entry.
#[hdk_extern]
pub fn get_latest_status(original_action_hash: ActionHash) -> ExternResult<Option<Status>> {
  let latest_status_record = get_latest_status_record(original_action_hash)?;
  let latest_status_option: Option<Status> = latest_status_record
    .ok_or(CommonError::RecordNotFound("status".to_string()))?
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?;

  Ok(latest_status_option)
}

/// Returns the latest `Status` record for the entity identified by `input`, resolving
/// its status via the `EntityStatus` link.
///
/// Automatically resolves updated action hashes to the original action hash before querying.
/// Returns `Ok(None)` if the entity has no status link yet.
#[hdk_extern]
pub fn get_latest_status_record_for_entity(
  input: EntityActionHash,
) -> ExternResult<Option<Record>> {
  // Resolve the original action hash in case we received an updated action hash
  let resolved_original_action_hash =
    find_original_action_hash(input.entity_original_action_hash.0.clone())?;

  let link_type_filter = LinkTypes::EntityStatus
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(resolved_original_action_hash.0.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  if let Some(first_link) = links.first() {
    get_latest_status_record(
      first_link
        .clone()
        .target
        .into_action_hash()
        .ok_or(CommonError::ActionHashNotFound("status".to_string()))?,
    )
  } else {
    Ok(None)
  }
}

/// Returns the deserialized latest [`Status`] value for the entity identified by `input`.
///
/// Resolves updated action hashes to the original before querying. Returns `Ok(None)` if
/// the entity has no status link yet.
#[hdk_extern]
pub fn get_latest_status_for_entity(input: EntityActionHash) -> ExternResult<Option<Status>> {
  // Resolve the original action hash in case we received an updated action hash
  let resolved_original_action_hash =
    find_original_action_hash(input.entity_original_action_hash.0.clone())?;

  let link_type_filter = LinkTypes::EntityStatus
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(resolved_original_action_hash.0.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  let latest_status: Option<Status> = if let Some(first_link) = links.first() {
    get_latest_status(
      first_link
        .target
        .clone()
        .into_action_hash()
        .ok_or(CommonError::ActionHashNotFound("status".to_string()))?,
    )?
  } else {
    None
  };

  Ok(latest_status)
}

/// Creates an `AcceptedEntity` link from `"{entity}.status.accepted"` path → entity original
/// action hash, registering the entity in the accepted-entity index.
#[hdk_extern]
pub fn create_accepted_entity_link(input: EntityActionHash) -> ExternResult<bool> {
  let path = Path::from(format!("{}.status.accepted", input.entity));
  create_link(
    path.path_entry_hash()?,
    input.entity_original_action_hash,
    LinkTypes::AcceptedEntity,
    (),
  )?;
  Ok(true)
}

/// Removes the `AcceptedEntity` link for the given entity, unregistering it from the
/// accepted-entity index. No-ops if no matching link is found.
pub fn delete_accepted_entity_link(input: EntityActionHash) -> ExternResult<bool> {
  let path = Path::from(format!("{}.status.accepted", input.entity));
  let link_type_filter = LinkTypes::AcceptedEntity
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path.path_entry_hash()?, link_type_filter),
    GetStrategy::Network,
  )?;
  let link = links
    .iter()
    .find(|link| link.target == input.entity_original_action_hash.clone().into());

  if let Some(link) = link {
    delete_link(
      ActionHash::from(link.clone().create_link_hash),
      GetOptions::default(),
    )?;
  }

  Ok(true)
}

/// Returns all `AcceptedEntity` links anchored to `"{entity}.status.accepted"`, listing
/// the original action hashes of all currently accepted entities of the given type.
#[hdk_extern]
pub fn get_accepted_entities(entity: String) -> ExternResult<Vec<Link>> {
  let path = Path::from(format!("{}.status.accepted", entity));
  let link_type_filter = LinkTypes::AcceptedEntity
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  get_links(
    LinkQuery::new(path.path_entry_hash()?, link_type_filter),
    GetStrategy::Network,
  )
}

/// Returns `true` if the entity identified by `input.entity_original_action_hash` appears
/// in the `AcceptedEntity` index for `input.entity`.
#[hdk_extern]
pub fn check_if_entity_is_accepted(input: EntityActionHash) -> ExternResult<bool> {
  let entity_is_accepted = get_accepted_entities(input.entity.clone())?
    .into_iter()
    .any(|link| link.target == input.entity_original_action_hash.clone().into());

  Ok(entity_is_accepted)
}

/// Returns all historical `Status` revisions for the given original status action hash,
/// ordered by their position in the `StatusUpdates` link chain.
#[hdk_extern]
pub fn get_all_revisions_for_status(original_status_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let records = get_all_revisions_for_entry(
    OriginalActionHash(original_status_hash),
    LinkTypes::StatusUpdates,
  )?;

  Ok(records)
}

/// Input for status update operations that do not include a `new_status` field.
///
/// Used by unsuspend and time-check operations where the new status is computed
/// internally rather than supplied by the caller.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateInput {
  /// String identifier for the entity type (e.g., `"user"`, `"offer"`).
  pub entity: String,
  /// Original action hash of the entity whose status is being updated.
  pub entity_original_action_hash: OriginalActionHash,
  /// Original action hash of the entity's current `Status` entry.
  pub status_original_action_hash: OriginalActionHash,
  /// Action hash of the most recent `Status` revision (used as the update base).
  pub status_previous_action_hash: PreviousActionHash,
}

/// Input for `update_entity_status` and the suspend operations.
///
/// Extends [`UpdateInput`] with the `new_status` value to write.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateEntityActionHash {
  /// String identifier for the entity type (e.g., `"user"`, `"offer"`).
  pub entity: String,
  /// Original action hash of the entity whose status is being updated.
  pub entity_original_action_hash: OriginalActionHash,
  /// Original action hash of the entity's current `Status` entry.
  pub status_original_action_hash: OriginalActionHash,
  /// Action hash of the most recent `Status` revision (used as the update base).
  pub status_previous_action_hash: PreviousActionHash,
  /// The new `Status` value to write to the DHT.
  pub new_status: Status,
}

/// Updates the status of the entity identified by `input.entity_original_action_hash`.
///
/// Requires the caller to be an administrator of `input.entity`. Returns
/// `Err(AdministrationError::Unauthorized)` otherwise.
///
/// Two branches:
/// - **No existing status link** — creates a new `Status` entry plus `AllStatuses` and
///   `EntityStatus` links from scratch.
/// - **Existing status link** — updates the `Status` entry via `update_entry`, creates a
///   `StatusUpdates` chain link, then rotates the `EntityStatus` link to the new action hash.
///
/// In both cases, always removes any existing `AcceptedEntity` link and re-creates it only
/// if `input.new_status.status_type == "accepted"`.
#[hdk_extern]
pub fn update_entity_status(input: UpdateEntityActionHash) -> ExternResult<Record> {
  if !check_if_agent_is_administrator(EntityAgent {
    agent_pubkey: agent_info()?.agent_initial_pubkey.clone(),
    entity: input.entity.clone(),
  })? {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Resolve the original action hash in case we received an updated action hash
  let resolved_original_action_hash =
    find_original_action_hash(input.entity_original_action_hash.0.clone())?;

  // Check if entity has a status link using the resolved original action hash
  let link_type_filter = LinkTypes::EntityStatus
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let entity_links = get_links(
    LinkQuery::new(resolved_original_action_hash.0.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  let action_hash: HoloHash<holo_hash::hash_type::Action>;

  if entity_links.is_empty() {
    // Entity has no status yet, create initial status
    let new_status_hash = create_entry(&EntryTypes::Status(input.new_status.clone()))?;
    action_hash = new_status_hash;

    // Create the path link
    let path = Path::from(format!("{}.status", input.entity));
    create_link(
      path.path_entry_hash()?,
      action_hash.clone(),
      LinkTypes::AllStatuses,
      (),
    )?;

    // Create the entity status link using the resolved original action hash
    create_link(
      resolved_original_action_hash.clone(),
      action_hash.clone(),
      LinkTypes::EntityStatus,
      (),
    )?;
  } else {
    // Entity has existing status, update it
    action_hash = update_entry(
      input.status_previous_action_hash.into(),
      input.new_status.clone(),
    )?;

    create_link(
      input.status_original_action_hash,
      action_hash.clone(),
      LinkTypes::StatusUpdates,
      (),
    )?;

    // Update the entity status link
    let entity_link_hash = entity_links
      .first()
      .ok_or(CommonError::LinkNotFound("entity_status".to_string()))?
      .to_owned()
      .create_link_hash;

    delete_link(entity_link_hash, GetOptions::default())?;

    create_link(
      resolved_original_action_hash.clone(),
      action_hash.clone(),
      LinkTypes::EntityStatus,
      (),
    )?;
  }

  delete_accepted_entity_link(EntityActionHash {
    entity_original_action_hash: resolved_original_action_hash.clone(),
    entity: input.entity.clone(),
  })?;

  if input.new_status.status_type == "accepted" {
    create_accepted_entity_link(EntityActionHash {
      entity_original_action_hash: resolved_original_action_hash,
      entity: input.entity,
    })?;
  }

  let record = get(action_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::RecordNotFound("status".to_string()))?;

  Ok(record)
}

/// Input for suspension operations (temporary or indefinite).
#[derive(Serialize, Deserialize, Debug)]
pub struct SuspendEntityInput {
  /// String identifier for the entity type (e.g., `"user"`, `"offer"`).
  pub entity: String,
  /// Original action hash of the entity to suspend.
  pub entity_original_action_hash: OriginalActionHash,
  /// Original action hash of the entity's current `Status` entry.
  pub status_original_action_hash: OriginalActionHash,
  /// Action hash of the most recent `Status` revision (used as the update base).
  pub status_previous_action_hash: PreviousActionHash,
  /// Human-readable reason for the suspension; stored in the `Status` entry.
  pub reason: String,
  /// Suspension duration in days. Required for temporary suspension; must be `None` for
  /// indefinite suspension (use [`suspend_entity_indefinitely`] instead).
  pub duration_in_days: Option<i64>,
}

/// Suspends the entity temporarily for `input.duration_in_days` days.
///
/// Returns `Err(StatusError::DurationInDaysNotProvided)` if `duration_in_days` is `None`.
/// Delegates to [`update_entity_status`] with a `Status::suspend(reason, Some(...))` value.
#[hdk_extern]
pub fn suspend_entity_temporarily(input: SuspendEntityInput) -> ExternResult<bool> {
  let duration_in_days = match input.duration_in_days {
    Some(duration_in_days) => duration_in_days,
    None => {
      return Err(StatusError::DurationInDaysNotProvided.into());
    }
  };

  let duration = Duration::days(duration_in_days);
  let now = &sys_time()?;

  let update_status_input = UpdateEntityActionHash {
    entity: input.entity,
    entity_original_action_hash: input.entity_original_action_hash,
    status_original_action_hash: input.status_original_action_hash,
    status_previous_action_hash: input.status_previous_action_hash,
    new_status: Status::suspend(input.reason.as_str(), Some((duration, now))),
  };

  Ok(update_entity_status(update_status_input).is_ok())
}

/// Suspends the entity indefinitely (no expiry date).
///
/// Delegates to [`update_entity_status`] with a `Status::suspend(reason, None)` value.
/// `input.duration_in_days` is ignored.
#[hdk_extern]
pub fn suspend_entity_indefinitely(input: SuspendEntityInput) -> ExternResult<bool> {
  let update_status_input = UpdateEntityActionHash {
    entity: input.entity,
    entity_original_action_hash: input.entity_original_action_hash,
    status_original_action_hash: input.status_original_action_hash,
    status_previous_action_hash: input.status_previous_action_hash,
    new_status: Status::suspend(input.reason.as_str(), None),
  };

  Ok(update_entity_status(update_status_input).is_ok())
}

/// Checks whether the temporary suspension on the entity has elapsed and, if so,
/// transitions it back to `"accepted"`.
///
/// Reads the entity's current status via its `EntityStatus` link. If the status type is
/// `"suspended temporarily"` and less than 1 hour of suspension time remains, calls
/// [`update_entity_status`] with `Status::accept()` and returns `true`. Returns `false`
/// if the entity is not temporarily suspended or if the suspension period has not yet elapsed.
#[hdk_extern]
pub fn unsuspend_entity_if_time_passed(input: UpdateInput) -> ExternResult<bool> {
  let link_type_filter = LinkTypes::EntityStatus
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let link = get_links(
    LinkQuery::new(
      input.entity_original_action_hash.0.clone(),
      link_type_filter,
    ),
    GetStrategy::Network,
  )?;

  let link = match link.first() {
    Some(link) => link,
    None => return Err(CommonError::LinkNotFound("status".to_string()).into()),
  };

  let status_action_hash = link
    .clone()
    .target
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("status".to_string()))?;

  let mut status = get_latest_status(status_action_hash)?
    .ok_or(CommonError::EntryNotFound("status".to_string()))?;

  if status.status_type == "suspended temporarily" {
    let now = sys_time()?;
    let is_unsuspended = status.unsuspend_if_time_passed(&now);

    if !is_unsuspended {
      return Ok(false);
    }

    let update_status_input = UpdateEntityActionHash {
      entity: input.entity,
      entity_original_action_hash: input.entity_original_action_hash,
      status_original_action_hash: input.status_original_action_hash,
      status_previous_action_hash: input.status_previous_action_hash,
      new_status: status,
    };

    warn!("Status input: {:?}", update_status_input.new_status);

    update_entity_status(update_status_input)?;

    return Ok(true);
  }

  Ok(false)
}

/// Unconditionally unsuspends the entity by transitioning its status to `"accepted"`.
///
/// Unlike [`unsuspend_entity_if_time_passed`], this does not check the remaining suspension
/// duration. Use this for manual admin overrides of both temporary and indefinite suspensions.
#[hdk_extern]
pub fn unsuspend_entity(input: UpdateInput) -> ExternResult<bool> {
  let update_status_input = UpdateEntityActionHash {
    entity: input.entity,
    entity_original_action_hash: input.entity_original_action_hash,
    status_original_action_hash: input.status_original_action_hash,
    status_previous_action_hash: input.status_previous_action_hash,
    new_status: Status::accept(),
  };

  Ok(update_entity_status(update_status_input).is_ok())
}

/// Deletes the `EntityStatus` link and the underlying `Status` entry for the given entity.
///
/// Also removes any `AcceptedEntity` link so the entity no longer appears in the accepted
/// index. Note: `Status` entries themselves are immutable by integrity validation
/// (`validate_delete_status` always returns `Invalid`), so this operation will fail at the
/// DHT validation layer — this function exists for coordinator-level cleanup scenarios
/// where entry deletion is permitted by a future policy change.
#[hdk_extern]
pub fn delete_status(input: EntityActionHash) -> ExternResult<bool> {
  let link = get_entity_status_link(input.clone())?;

  delete_accepted_entity_link(EntityActionHash {
    entity_original_action_hash: input.entity_original_action_hash.clone(),
    entity: input.entity.clone(),
  })?;

  delete_link(link.create_link_hash, GetOptions::default())?;
  let hash: ActionHash = input.entity_original_action_hash.into();
  delete_entry(hash)?;

  Ok(true)
}
