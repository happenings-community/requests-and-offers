use administration_integrity::*;
use hdk::prelude::*;
use utils::{
  errors::{AdministrationError, CommonError},
  DnaProperties, EntityActionHash, EntityActionHashAgents, EntityAgent,
};

/// Returns `true` if `agent` matches the network progenitor public key in DNA properties.
///
/// This is the extern-exposed counterpart of the integrity-layer `is_progenitor` helper.
/// Use this when you need to check another agent's progenitor status from the coordinator.
#[hdk_extern]
pub fn check_if_agent_is_progenitor(agent: AgentPubKey) -> ExternResult<bool> {
  match DnaProperties::get_progenitor_pubkey()? {
    Some(progenitor_pubkey) => Ok(agent == progenitor_pubkey),
    None => Ok(false),
  }
}

/// Returns `true` if the calling agent is the network progenitor.
///
/// Convenience extern that checks the caller's own public key against the progenitor key
/// stored in DNA properties. Equivalent to `check_if_agent_is_progenitor(agent_info()?.agent_initial_pubkey)`.
#[hdk_extern]
pub fn is_progenitor(_: ()) -> ExternResult<bool> {
  utils::check_if_progenitor()
}

/// Internal helper — not exposed as an extern. Called only by `add_administrator`
/// (which enforces the progenitor-or-existing-admin gate) and from within this
/// coordinator via cross-zome call through `add_administrator`.
///
/// Creates the `AllAdministrators` path link and one `AgentAdministrators` link per agent
/// public key in `input.agent_pubkeys`. Idempotent: returns `false` without writing if
/// the entity is already an administrator.
fn register_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  if check_if_entity_is_administrator(EntityActionHash {
    entity_original_action_hash: input.entity_original_action_hash.clone(),
    entity: input.entity.clone(),
  })? {
    // Idempotent: already an admin, nothing to do.
    return Ok(false);
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

/// Adds a new administrator for the entity specified in `input`.
///
/// The caller must be either the network progenitor or an existing administrator of the
/// given entity type. Returns `Err(AdministrationError::Unauthorized)` otherwise.
///
/// Delegates to [`register_administrator`] which is idempotent (safe to call if the entity
/// is already an administrator).
#[hdk_extern]
pub fn add_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  let caller = agent_info()?.agent_initial_pubkey;
  let is_admin = check_if_agent_is_administrator(EntityAgent {
    entity: input.entity.clone(),
    agent_pubkey: caller.clone(),
  })?;
  let is_prog = utils::check_if_progenitor()?;
  // Bootstrap: only active when no progenitor_pubkey is configured (dev mode).
  // When a progenitor key IS set, only the progenitor may bypass the admin-membership
  // check. This prevents any early caller from seizing the first-admin seat before the
  // progenitor connects in a production deployment.
  let progenitor_configured = DnaProperties::get_progenitor_pubkey()?.is_some();
  let is_bootstrap =
    !progenitor_configured && get_all_administrators_links(input.entity.clone())?.is_empty();

  if !is_admin && !is_prog && !is_bootstrap {
    return Err(AdministrationError::Unauthorized.into());
  }

  register_administrator(input)?;
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
/// The caller must be an existing administrator. Returns `Err(AdministrationError::Unauthorized)`
/// otherwise. Returns `Err(AdministrationError::LastAdmin)` if removing this administrator
/// would leave the entity with no administrators (preventing lock-out).
///
/// Deletes the `AllAdministrators` link for the entity and all `AgentAdministrators` links
/// for each agent public key in `input.agent_pubkeys`.
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

  delete_link(
    administrator_link.create_link_hash.clone(),
    GetOptions::default(),
  )?;

  for agent_pubkey in input.agent_pubkeys.clone() {
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
