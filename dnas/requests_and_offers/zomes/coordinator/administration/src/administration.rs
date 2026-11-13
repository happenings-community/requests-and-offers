use administration_integrity::*;
use hdk::prelude::*;
use utils::{
  errors::CommonError,
  grants::{grant_tag, Ability, Role},
  EntityActionHash, EntityActionHashAgents, EntityAgent,
};

use crate::grants::{
  authority_for, can_local, refuse_to_leave_no_administrator, require, revoke_all, write_grant,
};

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
/// progenitor key and, where no key is configured, to the first user while no agent
/// holds a live admin grant. Anyone else gets `Err(AdministrationError::Unauthorized)`
/// when there is a grant to write; when every key already holds one, nothing is written
/// and any caller gets `Ok(true)`.
///
/// Idempotent, key by key: a key that already holds a live admin grant is left as it is,
/// and one grant is written for each key that does not. The roster links carry the grants
/// in their tags, which is what their validators check.
#[hdk_extern]
pub fn add_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  if input.agent_pubkeys.is_empty() {
    return Err(CommonError::InvalidData("an administrator needs an agent key".to_string()).into());
  }

  // Asked of the grants, key by key, not of the roster: after `revoke_role` the
  // roster still lists an entity whose keys hold nothing, and returning early on
  // its word would leave them with nothing.
  let path = Path::from(format!("{}.administrators", input.entity));
  let mut first_grant = None;
  for agent_pubkey in input.agent_pubkeys.clone() {
    if can_local(&agent_pubkey, &Ability::Administer, &None)?.is_some() {
      continue;
    }
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

  // The roster entry for the listing, once, and only with a grant this call wrote:
  // its validator wants the link's author to have written the grant in its tag.
  let listed = check_if_entity_is_administrator(EntityActionHash {
    entity_original_action_hash: input.entity_original_action_hash.clone(),
    entity: input.entity.clone(),
  })?;
  if let (false, Some(roster_grant)) = (listed, first_grant) {
    create_link(
      path.path_entry_hash()?,
      input.entity_original_action_hash.clone(),
      LinkTypes::AllAdministrators,
      grant_tag(&roster_grant),
    )?;
  }

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
    .map_err(|e| CommonError::LinkError(e.to_string()))?;
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

/// Whether an agent administers the network now.
///
/// Answered from the chain of grants, by the same `can` every role-gated
/// write asks, and not from the `AgentAdministrators` roster link. The roster
/// is an index for listing administrators; read as a permission it was a
/// second source of truth, and a weaker one: a roster link is valid whenever
/// its tag carries an admin grant written by the link's author, which a
/// removed administrator's forged grant satisfies. One question, one reader.
///
/// `input.entity` is not read: `"network"` is the only entity administrators
/// have, and an admin grant has no narrower scope.
#[hdk_extern]
pub fn check_if_agent_is_administrator(input: EntityAgent) -> ExternResult<bool> {
  Ok(can_local(&input.agent_pubkey, &Ability::Administer, &None)?.is_some())
}

/// Removes an administrator from the entity specified in `input`.
///
/// The caller needs an admin grant. Returns `Err(AdministrationError::Unauthorized)`
/// otherwise. Returns `Err(AdministrationError::LastAdmin)` if removing this administrator
/// would leave the entity with no administrators (preventing lock-out).
///
/// Revokes each agent's admin grant, which is what ends the role, then tidies the
/// roster: the `AllAdministrators` link for the entity and the `AgentAdministrators`
/// links of each agent in `input.agent_pubkeys`. The grants stand as records; what
/// they authorised stands.
///
/// The roster is an index, so a roster link that is already gone is not an error. It
/// used to be, and since anyone can tombstone a roster link, one forged tombstone
/// would have made an administrator impossible to remove.
#[hdk_extern]
pub fn remove_administrator(input: EntityActionHashAgents) -> ExternResult<bool> {
  require(Ability::Grant(Role::Admin), None)?;

  if input.agent_pubkeys.is_empty() {
    return Err(CommonError::InvalidData("an administrator needs an agent key".to_string()).into());
  }
  // Counted from the live grants, not the roster: see `live_administrators`.
  refuse_to_leave_no_administrator(&input.agent_pubkeys)?;

  let administrators_links = get_all_administrators_links(input.entity.clone())?;

  // The grants first: they are the role. The caller's own key last, so an
  // administrator stepping down with several keys still holds the authority
  // to revoke each of the others.
  let me = agent_info()?.agent_initial_pubkey;
  let mut leaving = input.agent_pubkeys.clone();
  leaving.sort_by_key(|agent_pubkey| agent_pubkey == &me);
  for agent_pubkey in &leaving {
    revoke_all(agent_pubkey, Role::Admin, &None, "removed as administrator")?;
  }

  if let Some(administrator_link) = administrators_links
    .iter()
    .find(|link| link.target == input.entity_original_action_hash.clone().into())
  {
    delete_link(
      administrator_link.create_link_hash.clone(),
      GetOptions::default(),
    )?;
  }

  for agent_pubkey in input.agent_pubkeys {
    let link_type_filter = LinkTypes::AgentAdministrators
      .try_into_filter()
      .map_err(|e| CommonError::LinkError(e.to_string()))?;
    for link in get_links(
      LinkQuery::new(agent_pubkey, link_type_filter),
      GetStrategy::Network,
    )? {
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  Ok(true)
}
