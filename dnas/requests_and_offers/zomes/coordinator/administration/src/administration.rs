use administration_integrity::*;
use hdk::prelude::*;
use utils::{
  errors::{AdministrationError, CommonError},
  grants::{grant_tag, Ability, Role},
  EntityActionHash, EntityActionHashAgents, EntityAgent,
};

use crate::grants::{authority_for, require, revoke_all, write_grant};

/// Returns `true` if the calling agent is the network progenitor.
///
/// Checks the caller's own public key against the progenitor key stored in DNA properties.
/// Returns `false` when no progenitor key is configured (dev mode).
#[hdk_extern]
pub fn is_progenitor(_: ()) -> ExternResult<bool> {
  utils::check_if_progenitor()
}

/// Adds a new administrator for the entity specified in `input`.
///
/// Every administrator holds an `admin` grant. The caller's authority
/// for it is settled by [`authority_for`]: their own admin grant, or, for the first
/// administrators, the progenitor's signature over the grant, which is open to the
/// progenitor key and, where no key is configured, to the first user while there is no
/// administrator yet. Anyone else gets `Err(AdministrationError::Unauthorized)`.
///
/// Idempotent: an entity already in the index is left as it is. Otherwise one grant is
/// written per agent key, and the index links carry the grants in their tags, which is
/// what their validators check.
#[hdk_extern]
pub fn add_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  if check_if_entity_is_administrator(EntityActionHash {
    entity_original_action_hash: input.entity_original_action_hash.clone(),
    entity: input.entity.clone(),
  })? {
    return Ok(true);
  }

  let path = Path::from(format!("{}.administrators", input.entity));
  let mut first_grant = None;
  for agent_pubkey in input.agent_pubkeys.clone() {
    let authority = authority_for(Role::Admin, &None, &agent_pubkey)?;
    let grant = write_grant(Role::Admin, agent_pubkey.clone(), None, authority)?;
    create_link(
      agent_pubkey,
      path.path_entry_hash()?,
      LinkTypes::AgentAdministrators,
      grant_tag(&grant),
    )?;
    first_grant.get_or_insert(grant);
  }
  let roster_grant = first_grant
    .ok_or_else(|| CommonError::InvalidData("an administrator needs an agent key".to_string()))?;
  create_link(
    path.path_entry_hash()?,
    input.entity_original_action_hash.clone(),
    LinkTypes::AllAdministrators,
    grant_tag(&roster_grant),
  )?;

  Ok(true)
}

/// Returns all `AllAdministrators` links anchored to the `"{entity}.administrators"` path.
///
/// Each link's `target` is the original action hash of an administrator entity. Use
/// [`check_if_entity_is_administrator`] to test membership efficiently.
#[hdk_extern]
pub fn get_all_administrators_links(entity: String) -> ExternResult<Vec<Link>> {
  let path = Path::from(format!("{}.administrators", entity));
  let link_type_filter = LinkTypes::AllAdministrators
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path.path_entry_hash()?, link_type_filter),
    GetStrategy::Network,
  )?;
  Ok(links)
}

/// Returns `true` if the entity identified by `input.entity_original_action_hash` appears in the `AllAdministrators` link index for `input.entity`.
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

/// Returns `true` if `input.agent_pubkey` has at least one `AgentAdministrators` link,
/// indicating the agent is an administrator for `input.entity`.
///
/// This check queries the DHT via the agent's public key as the link base, which avoids
/// loading the full admin list used by [`check_if_entity_is_administrator`].
#[hdk_extern]
pub fn check_if_agent_is_administrator(input: EntityAgent) -> ExternResult<bool> {
  let link_type_filter = LinkTypes::AgentAdministrators
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let agent_administrator_links = get_links(
    LinkQuery::new(input.agent_pubkey, link_type_filter),
    GetStrategy::Network,
  )?;
  if !agent_administrator_links.is_empty() {
    return Ok(true);
  }

  Ok(false)
}

/// Removes an administrator from the entity specified in `input`.
///
/// The caller needs an admin grant. Returns `Err(AdministrationError::Unauthorized)`
/// otherwise. Returns `Err(AdministrationError::LastAdmin)` if removing this administrator
/// would leave the entity with no administrators (preventing lock-out).
///
/// Revokes each agent's admin grant, then deletes the `AllAdministrators` link for the
/// entity and all `AgentAdministrators` links for each agent public key in
/// `input.agent_pubkeys`. The grants stand as records; what they authorised stands.
#[hdk_extern]
pub fn remove_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  require(Ability::Grant(Role::Admin), None)?;

  let administrators_links = get_all_administrators_links(input.entity.clone())?;
  if administrators_links.len() == 1 {
    return Err(AdministrationError::LastAdmin.into());
  }

  let administrator_link = administrators_links
    .iter()
    .find(|link| link.target == input.entity_original_action_hash.clone().into())
    .ok_or(CommonError::LinkNotFound("administrator".to_string()))?;

  delete_link(
    administrator_link.create_link_hash.clone(),
    GetOptions::default(),
  )?;

  for agent_pubkey in input.agent_pubkeys.clone() {
    revoke_all(&agent_pubkey, Role::Admin, &None, "removed as administrator")?;

    let link_type_filter = LinkTypes::AgentAdministrators
      .try_into_filter()
      .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
    let links = get_links(
      LinkQuery::new(agent_pubkey, link_type_filter),
      GetStrategy::Network,
    )?;

    let link = links
      .first()
      .ok_or(CommonError::LinkNotFound("administrator".to_string()))?;

    delete_link(link.create_link_hash.clone(), GetOptions::default())?;
  }

  Ok(true)
}
