use administration_integrity::*;
use hdk::prelude::*;
use utils::{
  errors::{AdministrationError, CommonError},
  EntityActionHash, EntityActionHashAgents, EntityAgent,
};

#[hdk_extern]
pub fn register_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  if check_if_entity_is_administrator(EntityActionHash {
    entity_original_action_hash: input.entity_original_action_hash.clone(),
    entity: input.entity.clone(),
  })? {
    return Err(AdministrationError::AlreadyAdmin.into());
  }

  let path = Path::from(format!("{}.administrators", input.entity));
  create_link(
    path.path_entry_hash()?,
    input.entity_original_action_hash.clone(),
    LinkTypes::AllAdministrators,
    (),
  )?;

  for agent_pubkey in input.agent_pubkeys.clone() {
    create_link(
      agent_pubkey.clone(),
      path.path_entry_hash()?,
      LinkTypes::AgentAdministrators,
      (),
    )?;
  }

  Ok(true)
}

#[hdk_extern]
pub fn add_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  if !check_if_agent_is_administrator(EntityAgent {
    entity: input.entity.clone(),
    agent_pubkey: agent_info()?.agent_initial_pubkey,
  })? {
    return Err(AdministrationError::Unauthorized.into());
  }

  register_administrator(input)?;
  Ok(true)
}

#[hdk_extern]
pub fn get_all_administrators_links(entity: String) -> ExternResult<Vec<Link>> {
  let path = Path::from(format!("{}.administrators", entity));
  let links = get_links(
    GetLinksInputBuilder::try_new(path.path_entry_hash()?, LinkTypes::AllAdministrators)?.build(),
  )?;
  Ok(links)
}

#[hdk_extern]
pub fn check_if_entity_is_administrator(input: EntityActionHash) -> ExternResult<bool> {
  let links = get_all_administrators_links(input.entity)?;
  if links
    .iter()
    .any(|link| link.target == input.entity_original_action_hash.clone().into())
  {
    return Ok(true);
  }
  Ok(false)
}

#[hdk_extern]
pub fn check_if_agent_is_administrator(input: EntityAgent) -> ExternResult<bool> {
  let agent_administrator_links = get_links(
    GetLinksInputBuilder::try_new(input.agent_pubkey, LinkTypes::AgentAdministrators)?.build(),
  )?;
  if !agent_administrator_links.is_empty() {
    return Ok(true);
  }

  Ok(false)
}

#[hdk_extern]
pub fn remove_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  if !check_if_agent_is_administrator(EntityAgent {
    entity: input.entity.clone(),
    agent_pubkey: agent_info()?.agent_initial_pubkey,
  })? {
    return Err(AdministrationError::Unauthorized.into());
  }

  let administrators_links = get_all_administrators_links(input.entity.clone())?;
  if administrators_links.len() == 1 {
    return Err(AdministrationError::LastAdmin.into());
  }

  let administrator_link = administrators_links
    .iter()
    .find(|link| link.target == input.entity_original_action_hash.clone().into())
    .ok_or(CommonError::LinkNotFound("administrator".to_string()))?;

  delete_link(administrator_link.create_link_hash.clone())?;

  for agent_pubkey in input.agent_pubkeys.clone() {
    let links = get_links(
      GetLinksInputBuilder::try_new(agent_pubkey, LinkTypes::AgentAdministrators)?.build(),
    )?;

    let link = links
      .first()
      .ok_or(CommonError::LinkNotFound("administrator".to_string()))?;

    delete_link(link.create_link_hash.clone())?;
  }

  Ok(true)
}
