use hdk::prelude::*;
use users_organizations_integrity::*;
use utils::errors::{CommonError, UsersError};

use crate::external_calls::create_status;

#[hdk_extern]
pub fn create_user(input: User) -> ExternResult<Record> {
  let record = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if !record.is_empty() {
    return Err(UsersError::UserAlreadyExists.into());
  }

  let user_hash = create_entry(&EntryTypes::User(input.clone()))?;

  let record = get(user_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("user".to_string()))?;

  let path = Path::from("users");
  create_link(
    path.path_entry_hash()?.clone(),
    user_hash.clone(),
    LinkTypes::AllUsers,
    (),
  )?;

  create_link(
    agent_info()?.agent_initial_pubkey,
    user_hash.clone(),
    LinkTypes::MyUser,
    (),
  )?;

  create_link(
    user_hash.clone(),
    agent_info()?.agent_initial_pubkey,
    LinkTypes::UserAgents,
    (),
  )?;

  // Create initial status (defaults to "pending")
  let created_status_record = create_status(user_hash.clone())?;

  create_link(
    user_hash.clone(),
    created_status_record.action_address().clone(),
    LinkTypes::UserStatus,
    (),
  )?;

  Ok(record)
}

#[hdk_extern]
pub fn get_latest_user_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  let link_type_filter = LinkTypes::UserUpdates.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(
    original_action_hash.clone(),
    link_type_filter
  ), GetStrategy::Network)?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_user_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("user".to_string()))?,
    None => original_action_hash.clone(),
  };
  get(latest_user_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_user(original_action_hash: ActionHash) -> ExternResult<User> {
  let record = get_latest_user_record(original_action_hash.clone())?
    .ok_or(CommonError::EntryNotFound("user".to_string()))?;

  record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("user".to_string()).into())
}

#[hdk_extern]
pub fn get_agent_user(author: AgentPubKey) -> ExternResult<Vec<Link>> {
  {
    let link_type_filter = LinkTypes::MyUser.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
    get_links(LinkQuery::new(author, link_type_filter), GetStrategy::Network)
  }
}

#[hdk_extern]
pub fn get_user_agents(user_original_action_hash: ActionHash) -> ExternResult<Vec<AgentPubKey>> {
  let link_type_filter = LinkTypes::UserAgents.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(
    user_original_action_hash,
    link_type_filter
  ), GetStrategy::Network)?;

  let agent_pubkeys: Vec<AgentPubKey> = links
    .iter()
    .filter_map(|link| link.target.clone().into_agent_pub_key())
    .collect();

  Ok(agent_pubkeys)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateUserInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
  pub updated_user: User,
}

#[hdk_extern]
pub fn update_user(input: UpdateUserInput) -> ExternResult<Record> {
  let original_record = must_get_valid_record(input.original_action_hash.clone())?;

  let author = original_record.action().author().clone();
  if author != agent_info()?.agent_initial_pubkey {
    return Err(UsersError::NotAuthor.into());
  }

  let updated_user_hash = update_entry(input.previous_action_hash.clone(), &input.updated_user)?;

  create_link(
    input.original_action_hash.clone(),
    updated_user_hash.clone(),
    LinkTypes::UserUpdates,
    (),
  )?;

  // Users don't have service type links - this was removed
  // update_service_type_links would be called here if needed for other entities

  let record = get(updated_user_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("user".to_string()))?;

  Ok(record)
}
