use administration_integrity::*;
use hdk::prelude::*;
use utils::{
  errors::AdministrationError,
  EntityAgent, OriginalActionHash,
};

use crate::administration::check_if_agent_is_administrator;

/// The steward permission: supporting members, handling flags, and acting on cases.
/// Distinct from administration, which configures and deploys the network.
pub const PERMISSION_STEWARD: &str = "steward";

/// Input for granting or revoking a named permission.
///
/// Mirrors `EntityActionHashAgents`: the holder is identified by both their user entity
/// (for the roster index) and their agent key (for the membership query), because the
/// two link directions have different bases.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PermissionActionHashAgents {
  pub permission: String,
  pub holder_original_action_hash: OriginalActionHash,
  pub agent_pubkeys: Vec<AgentPubKey>,
}

/// Input for querying whether an agent holds a named permission.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentPermission {
  pub permission: String,
  pub agent_pubkey: AgentPubKey,
}

/// Returns the path entry hash for a named permission.
fn permission_path_hash(permission: &str) -> ExternResult<EntryHash> {
  Path::from(format!("permission.{}", permission)).path_entry_hash()
}

/// Returns every `AllPermissionHolders` link anchored to the `"permission.{name}"` path.
///
/// Each link target is the original action hash of a holder's user entity. This is the
/// public roster query: the steward role is deliberately visible.
#[hdk_extern]
pub fn get_all_permission_holders_links(permission: String) -> ExternResult<Vec<Link>> {
  let path_hash = permission_path_hash(&permission)?;
  let link_type_filter = LinkTypes::AllPermissionHolders
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path_hash, link_type_filter),
    GetStrategy::Network,
  )?;
  Ok(links)
}

/// Grants a named permission to one or more agents.
///
/// The caller must be an administrator. Granting is a single-signature act: the authority
/// gradient belongs on irreversible acts, not on role membership, and a grant is reversible
/// by [`revoke_permission`].
#[hdk_extern]
pub fn grant_permission(input: PermissionActionHashAgents) -> ExternResult<bool> {
  if !check_if_agent_is_administrator(EntityAgent {
    entity: "network".to_string(),
    agent_pubkey: agent_info()?.agent_initial_pubkey,
  })? {
    return Err(AdministrationError::Unauthorized.into());
  }

  let path_hash = permission_path_hash(&input.permission)?;

  create_link(
    path_hash.clone(),
    input.holder_original_action_hash.0.clone(),
    LinkTypes::AllPermissionHolders,
    (),
  )?;

  for agent_pubkey in input.agent_pubkeys {
    create_link(
      agent_pubkey,
      path_hash.clone(),
      LinkTypes::AgentPermissions,
      (),
    )?;
  }

  Ok(true)
}

/// Revokes a named permission from one or more agents.
///
/// The caller must be an administrator. There is no last-holder guard: a network may hold
/// zero stewards. The plural acts that require two stewards simply become impossible, since
/// there is nobody to concur.
#[hdk_extern]
pub fn revoke_permission(input: PermissionActionHashAgents) -> ExternResult<bool> {
  if !check_if_agent_is_administrator(EntityAgent {
    entity: "network".to_string(),
    agent_pubkey: agent_info()?.agent_initial_pubkey,
  })? {
    return Err(AdministrationError::Unauthorized.into());
  }

  let path_hash = permission_path_hash(&input.permission)?;

  let holder_links = get_all_permission_holders_links(input.permission.clone())?;
  for link in holder_links
    .iter()
    .filter(|link| link.target == input.holder_original_action_hash.0.clone().into())
  {
    delete_link(link.create_link_hash.clone(), GetOptions::default())?;
  }

  for agent_pubkey in input.agent_pubkeys {
    let link_type_filter = LinkTypes::AgentPermissions
      .try_into_filter()
      .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
    let links = get_links(
      LinkQuery::new(agent_pubkey, link_type_filter),
      GetStrategy::Network,
    )?;

    for link in links
      .iter()
      .filter(|link| link.target == path_hash.clone().into())
    {
      delete_link(link.create_link_hash.clone(), GetOptions::default())?;
    }
  }

  Ok(true)
}

/// Returns `true` if the agent holds the named permission.
///
/// Queries from the agent public key as the link base, which avoids loading the full holder
/// list. Does not fall back to the administrator check: an administrator who stewards holds
/// the permission explicitly and appears in the public roster, because authority nobody can
/// identify is authority nobody can question.
#[hdk_extern]
pub fn check_if_agent_has_permission(input: AgentPermission) -> ExternResult<bool> {
  let path_hash = permission_path_hash(&input.permission)?;

  let link_type_filter = LinkTypes::AgentPermissions
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(input.agent_pubkey, link_type_filter),
    GetStrategy::Network,
  )?;

  Ok(links.iter().any(|link| link.target == path_hash.clone().into()))
}
