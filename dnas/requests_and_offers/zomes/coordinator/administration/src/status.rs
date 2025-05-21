use administration_integrity::*;
use chrono::Duration;
use hdk::prelude::*;
use status::*;
use utils::{
  errors::{AdministrationError, CommonError, StatusError},
  get_all_revisions_for_entry, EntityActionHash, EntityAgent,
};

use crate::administration::check_if_agent_is_administrator;

#[hdk_extern]
pub fn create_status(input: EntityActionHash) -> ExternResult<Record> {
  let links = get_links(
    GetLinksInputBuilder::try_new(
      input.entity_original_action_hash.clone(),
      LinkTypes::EntityStatus,
    )?
    .build(),
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
    input.entity_original_action_hash,
    status_hash,
    LinkTypes::EntityStatus,
    (),
  )?;

  Ok(record)
}

#[hdk_extern]
fn get_entity_status_link(input: EntityActionHash) -> ExternResult<Link> {
  let links = get_links(
    GetLinksInputBuilder::try_new(
      input.entity_original_action_hash.clone(),
      LinkTypes::EntityStatus,
    )?
    .build(),
  )?;

  let link = links
    .first()
    .ok_or(CommonError::LinkNotFound("status".to_string()))?;

  Ok(link.clone())
}

#[hdk_extern]
pub fn get_latest_status_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::AllStatuses)?.build(),
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

#[hdk_extern]
pub fn get_latest_status_record_for_entity(
  input: EntityActionHash,
) -> ExternResult<Option<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(
      input.entity_original_action_hash.clone(),
      LinkTypes::EntityStatus,
    )?
    .build(),
  )?;

  if !links.is_empty() {
    get_latest_status_record(
      links[0]
        .clone()
        .target
        .into_action_hash()
        .ok_or(CommonError::ActionHashNotFound("status".to_string()))?,
    )
  } else {
    Ok(None)
  }
}

#[hdk_extern]
pub fn get_latest_status_for_entity(input: EntityActionHash) -> ExternResult<Option<Status>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(
      input.entity_original_action_hash.clone(),
      LinkTypes::EntityStatus,
    )?
    .build(),
  )?;

  let latest_status: Option<Status> = if !links.is_empty() {
    get_latest_status(
      links[0]
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

pub fn delete_accepted_entity_link(input: EntityActionHash) -> ExternResult<bool> {
  let path = Path::from(format!("{}.status.accepted", input.entity));
  let links = get_links(
    GetLinksInputBuilder::try_new(path.path_entry_hash()?, LinkTypes::AcceptedEntity)?.build(),
  )?;
  let link = links
    .iter()
    .find(|link| link.target == input.entity_original_action_hash.clone().into());

  if let Some(link) = link {
    delete_link(ActionHash::from(link.clone().create_link_hash))?;
  }

  Ok(true)
}

#[hdk_extern]
pub fn get_accepted_entities(entity: String) -> ExternResult<Vec<Link>> {
  let path = Path::from(format!("{}.status.accepted", entity));
  get_links(
    GetLinksInputBuilder::try_new(path.path_entry_hash()?, LinkTypes::AcceptedEntity)?.build(),
  )
}

#[hdk_extern]
pub fn check_if_entity_is_accepted(input: EntityActionHash) -> ExternResult<bool> {
  let entity_is_accepted = get_accepted_entities(input.entity.clone())?
    .into_iter()
    .any(|link| link.target == input.entity_original_action_hash.clone().into());

  Ok(entity_is_accepted)
}

#[hdk_extern]
pub fn get_all_revisions_for_status(original_status_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let records = get_all_revisions_for_entry(original_status_hash, LinkTypes::StatusUpdates)?;

  Ok(records)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateInput {
  pub entity: String,
  pub entity_original_action_hash: ActionHash,
  pub status_original_action_hash: ActionHash,
  pub status_previous_action_hash: ActionHash,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateEntityActionHash {
  pub entity: String,
  pub entity_original_action_hash: ActionHash,
  pub status_original_action_hash: ActionHash,
  pub status_previous_action_hash: ActionHash,
  pub new_status: Status,
}

#[hdk_extern]
pub fn update_entity_status(input: UpdateEntityActionHash) -> ExternResult<Record> {
  if !check_if_agent_is_administrator(EntityAgent {
    agent_pubkey: agent_info()?.agent_latest_pubkey.clone(),
    entity: input.entity.clone(),
  })? {
    return Err(AdministrationError::Unauthorized.into());
  }

  let action_hash: HoloHash<holo_hash::hash_type::Action> = update_entry(
    input.status_previous_action_hash.clone(),
    input.new_status.clone(),
  )?;
  create_link(
    input.status_original_action_hash.clone(),
    action_hash.clone(),
    LinkTypes::StatusUpdates,
    (),
  )?;

  let entity_link_hash = get_links(
    GetLinksInputBuilder::try_new(
      input.entity_original_action_hash.clone(),
      LinkTypes::EntityStatus,
    )?
    .build(),
  )?[0]
    .to_owned()
    .create_link_hash;

  delete_link(entity_link_hash)?;

  create_link(
    input.entity_original_action_hash.clone(),
    action_hash.clone(),
    LinkTypes::EntityStatus,
    (),
  )?;

  delete_accepted_entity_link(EntityActionHash {
    entity_original_action_hash: input.entity_original_action_hash.clone(),
    entity: input.entity.clone(),
  })?;

  if input.new_status.status_type == "accepted" {
    create_accepted_entity_link(EntityActionHash {
      entity_original_action_hash: input.entity_original_action_hash,
      entity: input.entity,
    })?;
  }

  let record = get(action_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::RecordNotFound("status".to_string()))?;

  Ok(record)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SuspendEntityInput {
  pub entity: String,
  pub entity_original_action_hash: ActionHash,
  pub status_original_action_hash: ActionHash,
  pub status_previous_action_hash: ActionHash,
  pub reason: String,
  pub duration_in_days: Option<i64>,
}

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

#[hdk_extern]
pub fn unsuspend_entity_if_time_passed(input: UpdateInput) -> ExternResult<bool> {
  let link = get_links(
    GetLinksInputBuilder::try_new(
      input.entity_original_action_hash.clone(),
      LinkTypes::EntityStatus,
    )?
    .build(),
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

#[hdk_extern]
pub fn delete_status(input: EntityActionHash) -> ExternResult<bool> {
  let link = get_entity_status_link(input.clone())?;

  delete_accepted_entity_link(EntityActionHash {
    entity_original_action_hash: input.entity_original_action_hash.clone(),
    entity: input.entity.clone(),
  })?;

  delete_link(link.create_link_hash)?;
  delete_entry(input.entity_original_action_hash)?;

  Ok(true)
}
