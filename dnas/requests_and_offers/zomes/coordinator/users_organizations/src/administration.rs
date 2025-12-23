use hdk::prelude::*;
use users_organizations_integrity::LinkTypes;
use utils::errors::AdministrationError;

use crate::external_calls::{check_if_agent_is_administrator, get_accepted_entities};

#[hdk_extern]
pub fn get_all_users(_: ()) -> ExternResult<Vec<Link>> {
  if !check_if_agent_is_administrator("network", agent_info()?.agent_initial_pubkey)? {
    return Err(AdministrationError::Unauthorized.into());
  }

  let path = Path::from("users");
  let link_type_filter = LinkTypes::AllUsers.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  get_links(LinkQuery::new(path.path_entry_hash()?, link_type_filter), GetStrategy::Network)
}

#[hdk_extern]
pub fn get_user_status_link(user_original_action_hash: ActionHash) -> ExternResult<Option<Link>> {
  let link_type_filter = LinkTypes::UserStatus.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(user_original_action_hash.clone(), link_type_filter), GetStrategy::Network)?;

  let link = links.first().cloned();

  Ok(link)
}

#[hdk_extern]
pub fn get_all_organizations_links(_: ()) -> ExternResult<Vec<Link>> {
  // Check if the agent is an administrator
  if check_if_agent_is_administrator("network", agent_info()?.agent_initial_pubkey)? {
    // Admin users can see all organizations
    let path = Path::from("organizations");
    let link_type_filter = LinkTypes::AllOrganizations.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
    get_links(LinkQuery::new(path.path_entry_hash()?, link_type_filter), GetStrategy::Network)
  } else {
    // Non-admin users can only see accepted organizations
    get_accepted_entities("organizations".to_string())
  }
}

#[hdk_extern]
pub fn get_organization_status_link(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Option<Link>> {
  let link_type_filter = LinkTypes::OrganizationStatus.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(organization_original_action_hash.clone(), link_type_filter), GetStrategy::Network)?;

  let link = links.first().cloned();

  Ok(link)
}
