use hdk::prelude::*;
use users_organizations_integrity::*;
use utils::{errors::UtilsError, EntityActionHash, OrganizationUser};
use WasmErrorInner::*;

use crate::{
  administration::get_organization_status_link,
  external_calls::{
    check_if_entity_is_accepted, create_status, delete_status, get_accepted_entities,
  },
  user::{get_agent_user, get_latest_user},
};

#[hdk_extern]
pub fn create_organization(organization: Organization) -> ExternResult<Record> {
  let user_links = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if user_links.is_empty() {
    return Err(wasm_error!(Guest(
      "You must first create a User profile".to_string()
    )));
  }

  let organization_hash = create_entry(&EntryTypes::Organization(organization.clone()))?;
  let record = get(organization_hash.clone(), GetOptions::default())?.ok_or(wasm_error!(Guest(
    "Could not find the newly created Organization profile".to_string()
  )))?;

  let path = Path::from("organizations");
  create_link(
    path.path_entry_hash()?,
    organization_hash.clone(),
    LinkTypes::AllOrganizations,
    (),
  )?;

  let created_status_record = create_status(organization_hash.clone())?;

  create_link(
    organization_hash.clone(),
    created_status_record.action_address().clone(),
    LinkTypes::OrganizationStatus,
    (),
  )?;

  create_link(
    user_links[0].target.clone(),
    organization_hash.clone(),
    LinkTypes::UserOrganizations,
    (),
  )?;

  create_link(
    organization_hash.clone(),
    user_links[0].target.clone(),
    LinkTypes::OrganizationMembers,
    (),
  )?;

  create_link(
    organization_hash,
    user_links[0].target.clone(),
    LinkTypes::OrganizationCoordinators,
    (),
  )?;

  Ok(record)
}

#[hdk_extern]
pub fn get_latest_organization_record(
  original_action_hash: ActionHash,
) -> ExternResult<Option<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::OrganizationUpdates)?
      .build(),
  )?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_organization_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(UtilsError::ActionHashNotFound("organization"))?,
    None => original_action_hash.clone(),
  };
  get(latest_organization_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_organization(original_action_hash: ActionHash) -> ExternResult<Organization> {
  let latest_organization_record = get_latest_organization_record(original_action_hash)?;
  let latest_organization: Organization = latest_organization_record
    .ok_or(wasm_error!(Guest(
      "Could not find the latest Organization profile".to_string()
    )))?
    .entry()
    .to_app_option()
    .map_err(|_| wasm_error!(Guest("Could not parse Organization".to_string())))?
    .ok_or(wasm_error!(Guest(
      "Could not find the latest Organization profile".to_string()
    )))?;

  Ok(latest_organization)
}

#[hdk_extern]
pub fn add_member_to_organization(input: OrganizationUser) -> ExternResult<bool> {
  if !check_if_agent_is_organization_coordinator(input.organization_original_action_hash.clone())? {
    return Err(wasm_error!(Guest(
      "Only coordinators can add other members".to_string()
    )));
  }

  if !is_organization_accepted(&input.organization_original_action_hash)? {
    return Err(wasm_error!(Guest(
      "Cannot add members to an organization that is not accepted".to_string()
    )));
  }

  if is_organization_member(input.clone())? {
    return Err(wasm_error!(Guest(
      "The invited user is already a member".to_string()
    )));
  }

  create_link(
    input.organization_original_action_hash.clone(),
    input.user_original_action_hash.clone(),
    LinkTypes::OrganizationMembers,
    (),
  )?;

  create_link(
    input.user_original_action_hash.clone(),
    input.organization_original_action_hash.clone(),
    LinkTypes::UserOrganizations,
    (),
  )?;

  Ok(true)
}

#[hdk_extern]
pub fn invite_member_to_organization(_input: OrganizationUser) -> ExternResult<bool> {
  todo!("invite_member_to_organization");
}

#[hdk_extern]
pub fn get_organization_members_links(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Vec<Link>> {
  get_links(
    GetLinksInputBuilder::try_new(
      organization_original_action_hash.clone(),
      LinkTypes::OrganizationMembers,
    )?
    .build(),
  )
}

#[hdk_extern]
pub fn get_organization_members(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Vec<User>> {
  let links = get_organization_members_links(organization_original_action_hash.clone())?;

  let users = links
    .into_iter()
    .map(|link| {
      get_latest_user(
        link
          .target
          .clone()
          .into_action_hash()
          .ok_or(UtilsError::ActionHashNotFound("user"))?,
      )
    })
    .collect::<ExternResult<Vec<User>>>()?;

  Ok(users)
}

#[hdk_extern]
pub fn is_organization_member(input: OrganizationUser) -> ExternResult<bool> {
  // Check OrganizationMembers links
  let org_member_links =
    get_organization_members_links(input.organization_original_action_hash.clone())?;

  let is_org_member = org_member_links.iter().any(|link| {
    link.target.clone().into_action_hash() == Some(input.user_original_action_hash.clone())
  });

  // Check UserOrganizations links
  let user_org_links = get_user_organizations_links(input.user_original_action_hash.clone())?;

  let is_user_org = user_org_links.iter().any(|link| {
    link.target.clone().into_action_hash() == Some(input.organization_original_action_hash.clone())
  });

  // Both links must exist for valid membership
  Ok(is_org_member && is_user_org)
}

#[hdk_extern]
pub fn get_user_organizations_links(
  user_original_action_hash: ActionHash,
) -> ExternResult<Vec<Link>> {
  get_links(
    GetLinksInputBuilder::try_new(
      user_original_action_hash.clone(),
      LinkTypes::UserOrganizations,
    )?
    .build(),
  )
}

#[hdk_extern]
pub fn get_user_organizations(
  user_original_action_hash: ActionHash,
) -> ExternResult<Vec<Organization>> {
  let links = get_user_organizations_links(user_original_action_hash.clone())?;

  let organizations = links
    .into_iter()
    .map(|link| {
      get_latest_organization(
        link
          .target
          .clone()
          .into_action_hash()
          .ok_or(UtilsError::ActionHashNotFound("organization"))?,
      )
    })
    .collect::<ExternResult<Vec<Organization>>>()?;

  Ok(organizations)
}

#[hdk_extern]
pub fn add_coordinator_to_organization(input: OrganizationUser) -> ExternResult<bool> {
  if !check_if_agent_is_organization_coordinator(input.organization_original_action_hash.clone())? {
    return Err(wasm_error!(Guest(
      "Only coordinators can add coordinators".to_string()
    )));
  }

  if !is_organization_accepted(&input.organization_original_action_hash)? {
    return Err(wasm_error!(Guest(
      "Cannot add coordinators to an organization that is not accepted".to_string()
    )));
  }

  // Add as member first if not already a member
  if !is_organization_member(input.clone())? {
    add_member_to_organization(input.clone())?;
  }

  let user_links = get_links(
    GetLinksInputBuilder::try_new(
      input.user_original_action_hash.clone(),
      LinkTypes::UserStatus,
    )?
    .build(),
  )?;

  if user_links.is_empty() {
    return Err(wasm_error!(Guest(
      "The user does not have a status".to_string()
    )));
  }

  if !check_if_entity_is_accepted(EntityActionHash {
    entity_original_action_hash: input.user_original_action_hash.clone(),
    entity: "users".to_string(),
  })? {
    return Err(wasm_error!(Guest(
      "Cannot add a coordinator that is not accepted".to_string()
    )));
  }

  if is_organization_coordinator(input.clone())? {
    return Err(wasm_error!(Guest(
      "The user is already a coordinator of this organization".to_string()
    )));
  }

  create_link(
    input.organization_original_action_hash,
    input.user_original_action_hash,
    LinkTypes::OrganizationCoordinators,
    (),
  )?;

  Ok(true)
}

#[hdk_extern]
pub fn invite_coordinator_to_organization(_input: OrganizationUser) -> ExternResult<bool> {
  todo!("invite_coordinator_to_organization");
}

#[hdk_extern]
pub fn get_organization_coordinators_links(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Vec<Link>> {
  get_links(
    GetLinksInputBuilder::try_new(
      organization_original_action_hash.clone(),
      LinkTypes::OrganizationCoordinators,
    )?
    .build(),
  )
}

#[hdk_extern]
pub fn get_organization_coordinators(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Vec<User>> {
  let links = get_organization_coordinators_links(organization_original_action_hash.clone())?;

  let users = links
    .into_iter()
    .map(|link| {
      get_latest_user(
        link
          .target
          .clone()
          .into_action_hash()
          .ok_or(UtilsError::ActionHashNotFound("user"))?,
      )
    })
    .collect::<ExternResult<Vec<User>>>()?;

  Ok(users)
}

#[hdk_extern]
pub fn is_organization_coordinator(input: OrganizationUser) -> ExternResult<bool> {
  let links = get_organization_coordinators_links(input.organization_original_action_hash.clone())?;

  let is_coordinator = links.into_iter().any(|link| {
    link.target.clone().into_action_hash() == Some(input.user_original_action_hash.clone())
  });

  Ok(is_coordinator)
}

#[hdk_extern]
pub fn check_if_agent_is_organization_coordinator(
  organization_original_action_hash: ActionHash,
) -> ExternResult<bool> {
  let agent_user_links = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if agent_user_links.is_empty() {
    return Err(wasm_error!(Guest(
      "Agent does not have a User profile".to_string()
    )));
  }

  let agent_user_action_hash = agent_user_links[0]
    .target
    .clone()
    .into_action_hash()
    .ok_or(UtilsError::ActionHashNotFound("user"))?;

  is_organization_coordinator(
    OrganizationUser {
      organization_original_action_hash,
      user_original_action_hash: agent_user_action_hash,
    }
    .clone(),
  )
}

#[hdk_extern]
pub fn leave_organization(original_action_hash: ActionHash) -> ExternResult<bool> {
  let agent_info = agent_info()?;
  let agent_user_links = get_agent_user(agent_info.agent_latest_pubkey.clone())?;

  if agent_user_links.is_empty() {
    return Err(wasm_error!(Guest(
      "The agent does not have a user profile".to_string()
    )));
  }

  let agent_user_action_hash = agent_user_links[0]
    .target
    .clone()
    .into_action_hash()
    .ok_or(UtilsError::ActionHashNotFound("user"))?;

  let organization_user = OrganizationUser {
    organization_original_action_hash: original_action_hash.clone(),
    user_original_action_hash: agent_user_action_hash.clone(),
  };

  let is_member = is_organization_member(organization_user.clone())?;

  if !is_member {
    return Err(wasm_error!(Guest(
      "The agent is not a member of this organization".to_string()
    )));
  }

  // Check coordinator status first
  let is_coordinator = is_organization_coordinator(organization_user.clone())?;
  if is_coordinator {
    let coordinator_links = get_organization_coordinators_links(original_action_hash.clone())?;
    if coordinator_links.len() <= 1 {
      return Err(wasm_error!(Guest(
        "Cannot leave organization as the last coordinator".to_string()
      )));
    }
    // Remove coordinator status first if not the last coordinator
    remove_organization_coordinator(organization_user.clone())?;
  }

  // Get both sets of links before deleting anything
  let user_organizations_links = get_user_organizations_links(agent_user_action_hash.clone())?;
  let organization_members_links = get_organization_members_links(original_action_hash.clone())?;

  // Delete UserOrganizations link
  for link in user_organizations_links {
    if let Some(hash) = link.target.clone().into_action_hash() {
      if hash == original_action_hash {
        delete_link(link.create_link_hash)?;
        break;
      }
    }
  }

  // Delete OrganizationMembers link
  for link in organization_members_links.clone() {
    if let Some(hash) = link.target.clone().into_action_hash() {
      if hash == agent_user_action_hash {
        delete_link(link.create_link_hash)?;
        break;
      }
    }
  }

  // If this was the last member and we got here (meaning we weren't the last coordinator),
  // delete the organization
  if organization_members_links.len() <= 1 {
    delete_organization(original_action_hash)?;
  }

  Ok(true)
}

#[hdk_extern]
pub fn remove_organization_member(input: OrganizationUser) -> ExternResult<bool> {
  if !check_if_agent_is_organization_coordinator(input.organization_original_action_hash.clone())? {
    return Err(wasm_error!(Guest(
      "Only coordinators can remove members".to_string()
    )));
  }

  if !is_organization_accepted(&input.organization_original_action_hash)? {
    return Err(wasm_error!(Guest(
      "Cannot remove members from an organization that is not accepted".to_string()
    )));
  }

  if !is_organization_member(input.clone())? {
    return Err(wasm_error!(Guest(
      "The user is not a member of this organization".to_string()
    )));
  }

  if is_organization_coordinator(input.clone())? {
    return Err(wasm_error!(Guest(
      "Cannot remove a coordinator. Remove coordinator role first".to_string()
    )));
  }

  let members_links =
    get_organization_members_links(input.organization_original_action_hash.clone())?;
  if members_links.len() <= 1 {
    return Err(wasm_error!(Guest(
      "Cannot remove the last member of an organization".to_string()
    )));
  }

  let link = members_links
    .into_iter()
    .find(|link| {
      link.target.clone().into_action_hash() == Some(input.user_original_action_hash.clone())
    })
    .ok_or(wasm_error!(Guest(
      "Could not find the member link".to_string()
    )))?;

  delete_link(link.create_link_hash)?;

  let user_organizations_links =
    get_user_organizations_links(input.user_original_action_hash.clone())?;
  let this_user_organizations_link = user_organizations_links.into_iter().find(|link| {
    link.target.clone().into_action_hash() == Some(input.organization_original_action_hash.clone())
  });

  if this_user_organizations_link.is_none() {
    return Err(wasm_error!(Guest(
      "Could not find the member link".to_string()
    )));
  }

  delete_link(this_user_organizations_link.unwrap().create_link_hash)?;

  Ok(true)
}

#[hdk_extern]
pub fn remove_organization_coordinator(input: OrganizationUser) -> ExternResult<()> {
  if !check_if_agent_is_organization_coordinator(input.organization_original_action_hash.clone())? {
    return Err(wasm_error!(Guest(
      "Only coordinators can remove other coordinators".to_string()
    )));
  }

  if !is_organization_accepted(&input.organization_original_action_hash)? {
    return Err(wasm_error!(Guest(
      "Cannot remove coordinators from an organization that is not accepted".to_string()
    )));
  }

  if !is_organization_coordinator(input.clone())? {
    return Err(wasm_error!(Guest(
      "The user is not a coordinator of this organization".to_string()
    )));
  }

  let coordinator_links =
    get_organization_coordinators_links(input.organization_original_action_hash.clone())?;
  if coordinator_links.len() <= 1 {
    return Err(wasm_error!(Guest(
      "Cannot remove the last coordinator of an organization".to_string()
    )));
  }

  let link = get_organization_coordinators_links(input.organization_original_action_hash.clone())?
    .into_iter()
    .find(|link| {
      link.target.clone().into_action_hash() == Some(input.user_original_action_hash.clone())
    })
    .ok_or(wasm_error!(Guest(
      "Could not find the coordinator link".to_string()
    )))?;

  delete_link(link.create_link_hash)?;

  Ok(())
}

/// Helper function to check if an organization's status is "accepted"
pub fn is_organization_accepted(
  organization_original_action_hash: &ActionHash,
) -> ExternResult<bool> {
  check_if_entity_is_accepted(EntityActionHash {
    entity_original_action_hash: organization_original_action_hash.clone(),
    entity: "organizations".to_string(),
  })
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateOrganizationInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
  pub updated_organization: Organization,
}

#[hdk_extern]
pub fn update_organization(input: UpdateOrganizationInput) -> ExternResult<Record> {
  if !check_if_agent_is_organization_coordinator(input.original_action_hash.clone())? {
    return Err(wasm_error!(Guest(
      "Only coordinators can update the organization".to_string()
    )));
  }

  let updated_organization_hash = update_entry(
    input.previous_action_hash.clone(),
    &input.updated_organization,
  )?;

  create_link(
    input.original_action_hash.clone(),
    updated_organization_hash.clone(),
    LinkTypes::OrganizationUpdates,
    (),
  )?;

  let record =
    get(updated_organization_hash.clone(), GetOptions::default())?.ok_or(wasm_error!(Guest(
      "Could not find the newly updated Organization profile".to_string()
    )))?;

  Ok(record)
}

#[hdk_extern]
pub fn delete_organization(organization_original_action_hash: ActionHash) -> ExternResult<()> {
  if !check_if_agent_is_organization_coordinator(organization_original_action_hash.clone())? {
    return Err(wasm_error!(Guest(
      "Only coordinators can delete organizations".to_string()
    )));
  }

  // Delete member links first
  let members_links = get_organization_members_links(organization_original_action_hash.clone())?;
  for link in members_links.clone() {
    let user_hash = link
      .target
      .clone()
      .into_action_hash()
      .ok_or(UtilsError::ActionHashNotFound("user"))?;

    // Delete UserOrganizations link
    let user_organizations_links = get_user_organizations_links(user_hash.clone())?;
    for user_org_link in user_organizations_links {
      if let Some(hash) = user_org_link.target.clone().into_action_hash() {
        if hash == organization_original_action_hash {
          delete_link(user_org_link.create_link_hash)?;
          break;
        }
      }
    }

    // Delete OrganizationMembers link
    delete_link(link.create_link_hash)?;
  }

  // Delete coordinator links directly without using remove_organization_coordinator
  let coordinator_links =
    get_organization_coordinators_links(organization_original_action_hash.clone())?;
  for link in coordinator_links {
    delete_link(link.create_link_hash)?;
  }

  // Delete organization links
  let all_organizations_links = get_links(
    GetLinksInputBuilder::try_new(
      Path::from("organizations").path_entry_hash()?,
      LinkTypes::AllOrganizations,
    )?
    .build(),
  )?;

  for link in all_organizations_links {
    if let Some(hash) = link.target.clone().into_action_hash() {
      if hash == organization_original_action_hash {
        delete_link(link.create_link_hash)?;
        break;
      }
    }
  }

  // Delete status links
  let organization_status_links =
    get_organization_status_link(organization_original_action_hash.clone())?;
  if let Some(link) = organization_status_links {
    delete_link(link.create_link_hash)?;
  }

  let organization_status_link = get_accepted_entities(String::from("organizations"))?
    .into_iter()
    .find(|organization_status| {
      organization_status.target.clone().into_action_hash()
        == Some(organization_original_action_hash.clone())
    });

  if let Some(link) = organization_status_link {
    delete_link(link.create_link_hash)?;
  }

  // Delete status
  delete_status(EntityActionHash {
    entity_original_action_hash: organization_original_action_hash.clone(),
    entity: String::from("organizations"),
  })?;

  // Finally delete the organization entry
  delete_entry(organization_original_action_hash)?;

  Ok(())
}
