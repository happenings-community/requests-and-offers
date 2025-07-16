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
  get_links(GetLinksInputBuilder::try_new(path.path_entry_hash()?, LinkTypes::AllUsers)?.build())
}

#[hdk_extern]
pub fn get_user_status_link(user_original_action_hash: ActionHash) -> ExternResult<Option<Link>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(user_original_action_hash.clone(), LinkTypes::UserStatus)?
      .build(),
  )?;

  let link = links.first().cloned();

  Ok(link)
}

#[hdk_extern]
pub fn get_all_organizations_links(_: ()) -> ExternResult<Vec<Link>> {
  // Check if the agent is an administrator
  if check_if_agent_is_administrator("network", agent_info()?.agent_initial_pubkey)? {
    // Admin users can see all organizations
    let path = Path::from("organizations");
    get_links(
      GetLinksInputBuilder::try_new(path.path_entry_hash()?, LinkTypes::AllOrganizations)?.build(),
    )
  } else {
    // Non-admin users can only see accepted organizations
    get_accepted_entities("organizations".to_string())
  }
}

#[hdk_extern]
pub fn get_organization_status_link(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Option<Link>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(
      organization_original_action_hash.clone(),
      LinkTypes::OrganizationStatus,
    )?
    .build(),
  )?;

  let link = links.first().cloned();

  Ok(link)
}
