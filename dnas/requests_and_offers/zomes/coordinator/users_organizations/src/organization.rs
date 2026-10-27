use std::collections::HashSet;

use hdk::prelude::*;
use users_organizations_integrity::*;
use utils::{
  errors::{AdministrationError, CommonError, OrganizationsError, UsersError},
  find_original_action_hash,
  links::{membership_end_tag, MAX_ENDED_LINKS},
  grants::{can_i, grant_tag, require_grant, Ability, GrantRoleInput, RevokeRolesOfInput, Role},
  EntityActionHash, OriginalActionHash, OrganizationContactInput, OrganizationUserInput,
  PreviousActionHash,
};

use crate::{
  external_calls::{check_if_entity_is_accepted, create_status, grant_role, revoke_roles_of},
  user::{get_agent_user, get_latest_user, get_user_agents},
};

/// The caller's grant to act on an organisation: a coordinator grant for it, or an admin
/// grant. `NotCoordinator` otherwise, as before.
fn require_coordinate(organization: &ActionHash) -> ExternResult<ActionHash> {
  can_i(Ability::Coordinate, Some(organization.clone()))?
    .ok_or_else(|| OrganizationsError::NotCoordinator.into())
}

// ============================================================================
// MEMBERSHIP ENDS (#234)
// ============================================================================
//
// Membership links are an index and are never tombstoned: a tombstone carries
// no grant, so validation could not tell a coordinator from a stranger. Leaving
// or removal writes a `MembershipEnd` naming the links it closes, and the link
// readers below skip any link an end names. A member who rejoins gets new
// links, which nothing names, so no clock decides whether they belong.

/// Every membership link an organisation's ends have closed, read from the
/// `MembershipEnds` tags.
fn closed_links(organization: &ActionHash) -> ExternResult<HashSet<ActionHash>> {
  let filter = LinkTypes::MembershipEnds
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let mut closed = HashSet::new();
  for link in get_links(LinkQuery::new(organization.clone(), filter), GetStrategy::Network)? {
    if let Ok(named) = utils::links::membership_end_from_tag(&link.tag) {
      closed.extend(named);
    }
  }
  Ok(closed)
}

/// Records the end of the links named: a membership, or a coordinator role. Writes
/// one end per `MAX_ENDED_LINKS` links and returns the last.
fn write_membership_end(
  organization: &ActionHash,
  user: &ActionHash,
  links: Vec<ActionHash>,
  grant: Option<ActionHash>,
) -> ExternResult<ActionHash> {
  // One end names at most MAX_ENDED_LINKS links, so a member someone has
  // linked more often than that gets as many ends as it takes: a fixed limit
  // must never pin anyone in (Aria, 26 Oct).
  let mut last = None;
  for chunk in links.chunks(MAX_ENDED_LINKS) {
    let tag = membership_end_tag(chunk);
    let end = create_entry(EntryTypes::MembershipEnd(MembershipEnd {
      organization: organization.clone(),
      user: user.clone(),
      links: chunk.to_vec(),
      grant: grant.clone(),
    }))?;
    create_link(organization.clone(), end.clone(), LinkTypes::MembershipEnds, tag)?;
    last = Some(end);
  }
  last.ok_or_else(|| wasm_error!(WasmErrorInner::Guest("no open membership link to close".into())))
}

/// The links of one type from an organisation that no end has closed.
fn current_links(organization: ActionHash, link_type: LinkTypes) -> ExternResult<Vec<Link>> {
  let filter = link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(organization.clone(), filter), GetStrategy::Network)?;
  let closed = closed_links(&organization)?;
  Ok(links.into_iter().filter(|link| !closed.contains(&link.create_link_hash)).collect())
}

/// The open links of one type between an organisation and a user, to close.
fn open_links_to(links: Vec<Link>, other_end: &ActionHash) -> Vec<ActionHash> {
  links
    .into_iter()
    .filter(|link| link.target.clone().into_action_hash().as_ref() == Some(other_end))
    .map(|link| link.create_link_hash)
    .collect()
}

#[hdk_extern]
pub fn create_organization(organization: Organization) -> ExternResult<Record> {
  let user_links = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if user_links.is_empty() {
    return Err(UsersError::UserProfileRequired.into());
  }

  let organization_hash = create_entry(&EntryTypes::Organization(organization.clone()))?;
  let record = get(organization_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("organization".to_string()))?;

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

  // The applicant finds their application here while it is pending. Membership and
  // coordination come with approval: an organisation follows the same process as a
  // member, and the approval is what makes its creator coordinator (Sam, 18 October).
  create_link(
    user_links[0].target.clone(),
    organization_hash,
    LinkTypes::UserOrganizations,
    (),
  )?;

  Ok(record)
}

/// Input for `register_approved_coordinator`, from the administration zome.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApprovedCoordinatorInput {
  pub organization_original_action_hash: ActionHash,
  pub user_original_action_hash: ActionHash,
  /// The approver's grant; the coordinator grant itself was written by the approver in
  /// the administration zome before this call.
  pub grant: ActionHash,
}

/// The links an approval writes: the creator becomes a member and a coordinator of the
/// organisation. Called by `update_entity_status` in the approver's cell, so the links
/// carry the approver's admin or steward grant, which their validator accepts.
#[hdk_extern]
pub fn register_approved_coordinator(input: ApprovedCoordinatorInput) -> ExternResult<bool> {
  let grant = match can_i(Ability::Coordinate, Some(input.organization_original_action_hash.clone()))? {
    Some(grant) => grant,
    None => require_grant(Ability::ChangeStatus, None)?,
  };
  let pair = OrganizationUserInput {
    organization_original_action_hash: OriginalActionHash(
      input.organization_original_action_hash.clone(),
    ),
    user_original_action_hash: OriginalActionHash(input.user_original_action_hash.clone()),
  };
  if !is_organization_member(pair.clone())? {
    create_link(
      input.organization_original_action_hash.clone(),
      input.user_original_action_hash.clone(),
      LinkTypes::OrganizationMembers,
      grant_tag(&grant),
    )?;
    let listed = get_user_organizations_links(input.user_original_action_hash.clone())?
      .iter()
      .any(|link| {
        link.target.clone().into_action_hash() == Some(input.organization_original_action_hash.clone())
      });
    if !listed {
      create_link(
        input.user_original_action_hash.clone(),
        input.organization_original_action_hash.clone(),
        LinkTypes::UserOrganizations,
        grant_tag(&grant),
      )?;
    }
  }
  if !is_organization_coordinator(pair)? {
    create_link(
      input.organization_original_action_hash,
      input.user_original_action_hash,
      LinkTypes::OrganizationCoordinators,
      grant_tag(&grant),
    )?;
  }
  Ok(true)
}

#[hdk_extern]
pub fn get_latest_organization_record(
  original_action_hash: ActionHash,
) -> ExternResult<Option<Record>> {
  // A retired organisation reads as gone everywhere the interface looks (#234).
  if organization_retirement(&original_action_hash)?.is_some() {
    return Ok(None);
  }
  let link_type_filter = LinkTypes::OrganizationUpdates
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(original_action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_organization_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("organization".to_string()))?,
    None => original_action_hash.clone(),
  };
  get(latest_organization_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_organization(original_action_hash: ActionHash) -> ExternResult<Organization> {
  let latest_organization_record = get_latest_organization_record(original_action_hash)?;
  let latest_organization: Organization = latest_organization_record
    .ok_or(CommonError::EntryNotFound("organization".to_string()))?
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or::<CommonError>(CommonError::EntryNotFound("organization".to_string()))?;

  Ok(latest_organization)
}

/// Resolves both hashes of a client-supplied pair to their chain roots.
/// Coordinator, member and contact links are anchored at the Create, so a
/// client holding a revision would miss every guard below and anchor its
/// link where nothing reads. Propagates rather than falling back: these are
/// writes behind guards, and a guard looking in the wrong place is worse
/// than a refused call.
fn resolve_org_user_input(input: OrganizationUserInput) -> ExternResult<OrganizationUserInput> {
  Ok(OrganizationUserInput {
    organization_original_action_hash: find_original_action_hash(
      input.organization_original_action_hash.0,
    )?,
    user_original_action_hash: find_original_action_hash(input.user_original_action_hash.0)?,
  })
}

#[hdk_extern]
pub fn add_member_to_organization(input: OrganizationUserInput) -> ExternResult<bool> {
  let input = resolve_org_user_input(input)?;
  let grant = require_coordinate(&input.organization_original_action_hash.0)?;

  if !is_organization_accepted(&input.organization_original_action_hash.0)? {
    return Err(AdministrationError::EntityNotAccepted("organization".to_string()).into());
  }

  if is_organization_member(input.clone())? {
    return Err(OrganizationsError::AlreadyMember.into());
  }

  create_link(
    input.organization_original_action_hash.0.clone(),
    input.user_original_action_hash.0.clone(),
    LinkTypes::OrganizationMembers,
    grant_tag(&grant),
  )?;

  create_link(
    input.user_original_action_hash.0.clone(),
    input.organization_original_action_hash.0.clone(),
    LinkTypes::UserOrganizations,
    grant_tag(&grant),
  )?;

  Ok(true)
}

#[hdk_extern]
pub fn invite_member_to_organization(_input: OrganizationUserInput) -> ExternResult<bool> {
  todo!("invite_member_to_organization"); // Notification needs to be build first
}

#[hdk_extern]
pub fn get_organization_members_links(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Vec<Link>> {
  current_links(organization_original_action_hash, LinkTypes::OrganizationMembers)
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
          .ok_or(CommonError::ActionHashNotFound("user".to_string()))?,
      )
    })
    .collect::<ExternResult<Vec<User>>>()?;

  Ok(users)
}

#[hdk_extern]
pub fn is_organization_member(input: OrganizationUserInput) -> ExternResult<bool> {
  // Check OrganizationMembers links
  let org_member_links =
    get_organization_members_links(input.organization_original_action_hash.0.clone())?;

  let is_org_member = org_member_links.iter().any(|link| {
    link.target.clone().into_action_hash() == Some(input.user_original_action_hash.0.clone())
  });

  // Check UserOrganizations links
  let user_org_links = get_user_organizations_links(input.user_original_action_hash.0.clone())?;

  let is_user_org = user_org_links.iter().any(|link| {
    link.target.clone().into_action_hash() == Some(input.organization_original_action_hash.0.clone())
  });

  // Both links must exist for valid membership
  Ok(is_org_member && is_user_org)
}

#[hdk_extern]
pub fn get_user_organizations_links(
  user_original_action_hash: ActionHash,
) -> ExternResult<Vec<Link>> {
  let link_type_filter = LinkTypes::UserOrganizations
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(user_original_action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  // Each organisation's closed links, read once.
  let mut closed_by_organization: std::collections::HashMap<ActionHash, HashSet<ActionHash>> =
    std::collections::HashMap::new();
  let mut current = Vec::new();
  for link in links {
    let Some(organization) = link.target.clone().into_action_hash() else {
      continue;
    };
    if !closed_by_organization.contains_key(&organization) {
      closed_by_organization.insert(organization.clone(), closed_links(&organization)?);
    }
    if !closed_by_organization[&organization].contains(&link.create_link_hash) {
      current.push(link);
    }
  }
  Ok(current)
}

#[hdk_extern]
pub fn get_user_organizations(
  user_original_action_hash: ActionHash,
) -> ExternResult<Vec<Organization>> {
  let links = get_user_organizations_links(user_original_action_hash.clone())?;

  // A retired organisation is skipped rather than failing the whole list.
  let mut organizations = Vec::new();
  for link in links {
    let organization = link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("organization".to_string()))?;
    if organization_retirement(&organization)?.is_some() {
      continue;
    }
    organizations.push(get_latest_organization(organization)?);
  }

  Ok(organizations)
}

#[hdk_extern]
pub fn add_coordinator_to_organization(input: OrganizationUserInput) -> ExternResult<bool> {
  let input = resolve_org_user_input(input)?;
  let grant = require_coordinate(&input.organization_original_action_hash.0)?;

  if !is_organization_accepted(&input.organization_original_action_hash.0)? {
    return Err(AdministrationError::EntityNotAccepted("organization".to_string()).into());
  }

  // Add as member first if not already a member
  if !is_organization_member(input.clone())? {
    add_member_to_organization(input.clone())?;
  }

  let link_type_filter = LinkTypes::UserStatus
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let user_links = get_links(
    LinkQuery::new(input.user_original_action_hash.0.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  if user_links.is_empty() {
    return Err(CommonError::LinkNotFound("user".to_string()).into());
  }

  if !check_if_entity_is_accepted(EntityActionHash {
    entity_original_action_hash: input.user_original_action_hash.clone(),
    entity: "users".to_string(),
  })? {
    return Err(AdministrationError::EntityNotAccepted("user".to_string()).into());
  }

  if is_organization_coordinator(input.clone())? {
    return Err(OrganizationsError::AlreadyCoordinator.into());
  }

  // The new coordinator's grant, one per agent, resting on the caller's: a coordinator
  // grants coordinator for the same organisation, an admin for any.
  for agent in get_user_agents(input.user_original_action_hash.0.clone())? {
    grant_role(GrantRoleInput {
      role: Role::OrgCoordinator,
      holder: agent,
      scope: Some(input.organization_original_action_hash.0.clone()),
    })?;
  }

  create_link(
    input.organization_original_action_hash.0,
    input.user_original_action_hash.0,
    LinkTypes::OrganizationCoordinators,
    grant_tag(&grant),
  )?;

  Ok(true)
}

#[hdk_extern]
pub fn invite_coordinator_to_organization(_input: OrganizationUserInput) -> ExternResult<bool> {
  todo!("invite_coordinator_to_organization"); // Notification needs to be build first
}

#[hdk_extern]
pub fn get_organization_coordinators_links(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Vec<Link>> {
  current_links(organization_original_action_hash, LinkTypes::OrganizationCoordinators)
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
          .ok_or(CommonError::ActionHashNotFound("user".to_string()))?,
      )
    })
    .collect::<ExternResult<Vec<User>>>()?;

  Ok(users)
}

#[hdk_extern]
pub fn is_organization_coordinator(input: OrganizationUserInput) -> ExternResult<bool> {
  let links = get_organization_coordinators_links(input.organization_original_action_hash.0.clone())?;

  let is_coordinator = links.into_iter().any(|link| {
    link.target.clone().into_action_hash() == Some(input.user_original_action_hash.0.clone())
  });

  Ok(is_coordinator)
}

// ============================================================================
// ORGANIZATION CONTACTS
// ============================================================================

#[hdk_extern]
pub fn get_organization_contacts_links(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Vec<Link>> {
  let link_type_filter = LinkTypes::OrganizationContacts
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  get_links(
    LinkQuery::new(organization_original_action_hash, link_type_filter),
    GetStrategy::Network,
  )
}

#[hdk_extern]
pub fn get_organization_contact(
  organization_original_action_hash: ActionHash,
) -> ExternResult<Option<(User, String)>> {
  let links = get_organization_contacts_links(organization_original_action_hash)?;

  if let Some(link) = links.into_iter().next() {
    let user_hash = link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("contact user".to_string()))?;

    let user = get_latest_user(user_hash)?;
    let role = String::from_utf8(link.tag.into_inner())
      .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Invalid role tag: {}", e))))?;

    Ok(Some((user, role)))
  } else {
    Ok(None)
  }
}

#[hdk_extern]
pub fn set_organization_contact(input: OrganizationContactInput) -> ExternResult<bool> {
  let input = OrganizationContactInput {
    organization_original_action_hash: find_original_action_hash(
      input.organization_original_action_hash.0,
    )?,
    user_original_action_hash: find_original_action_hash(input.user_original_action_hash.0)?,
    role: input.role,
  };
  require_coordinate(&input.organization_original_action_hash.0)?;

  // Contact must be a coordinator
  if !is_organization_coordinator(OrganizationUserInput {
    organization_original_action_hash: input.organization_original_action_hash.clone(),
    user_original_action_hash: input.user_original_action_hash.clone(),
  })? {
    return Err(OrganizationsError::NotCoordinator.into());
  }

  // Remove any existing contact link (single contact enforcement)
  let existing_links =
    get_organization_contacts_links(input.organization_original_action_hash.0.clone())?;
  for link in existing_links {
    delete_link(link.create_link_hash, GetOptions::default())?;
  }

  create_link(
    input.organization_original_action_hash.0,
    input.user_original_action_hash.0,
    LinkTypes::OrganizationContacts,
    LinkTag::new(input.role.as_bytes().to_vec()),
  )?;

  Ok(true)
}

#[hdk_extern]
pub fn remove_organization_contact(
  organization_original_action_hash: ActionHash,
) -> ExternResult<bool> {
  require_coordinate(&organization_original_action_hash)?;

  let links = get_organization_contacts_links(organization_original_action_hash)?;
  if links.is_empty() {
    return Err(OrganizationsError::NotContact.into());
  }

  for link in links {
    delete_link(link.create_link_hash, GetOptions::default())?;
  }

  Ok(true)
}

#[hdk_extern]
pub fn is_organization_contact(input: OrganizationUserInput) -> ExternResult<bool> {
  let links = get_organization_contacts_links(input.organization_original_action_hash.0)?;

  let is_contact = links.into_iter().any(|link| {
    link.target.clone().into_action_hash() == Some(input.user_original_action_hash.0.clone())
  });

  Ok(is_contact)
}

#[hdk_extern]
pub fn check_if_agent_is_organization_coordinator(
  organization_original_action_hash: ActionHash,
) -> ExternResult<bool> {
  let agent_user_links = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if agent_user_links.is_empty() {
    return Err(UsersError::UserProfileRequired.into());
  }

  let agent_user_action_hash = agent_user_links[0]
    .target
    .clone()
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;

  is_organization_coordinator(
    OrganizationUserInput {
      organization_original_action_hash: OriginalActionHash(organization_original_action_hash),
      user_original_action_hash: OriginalActionHash(agent_user_action_hash),
    }
    .clone(),
  )
}

#[hdk_extern]
pub fn leave_organization(original_action_hash: ActionHash) -> ExternResult<bool> {
  let agent_info = agent_info()?;
  let agent_user_links = get_agent_user(agent_info.agent_initial_pubkey.clone())?;

  if agent_user_links.is_empty() {
    return Err(UsersError::UserProfileRequired.into());
  }

  let agent_user_action_hash = agent_user_links[0]
    .target
    .clone()
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;

  let organization_user = OrganizationUserInput {
    organization_original_action_hash: OriginalActionHash(original_action_hash.clone()),
    user_original_action_hash: OriginalActionHash(agent_user_action_hash.clone()),
  };

  let is_member = is_organization_member(organization_user.clone())?;

  if !is_member {
    return Err(OrganizationsError::NotMember.into());
  }

  // Check coordinator status first
  let is_coordinator = is_organization_coordinator(organization_user.clone())?;
  if is_coordinator {
    let coordinator_links = get_organization_coordinators_links(original_action_hash.clone())?;
    if coordinator_links.len() <= 1 {
      return Err(OrganizationsError::LastCoordinator.into());
    }
    // Remove coordinator status first if not the last coordinator
    remove_organization_coordinator(organization_user.clone())?;
  }

  // Remove contact link if this member is the contact
  let contact_links = get_organization_contacts_links(original_action_hash.clone())?;
  for link in contact_links {
    if link.target.clone().into_action_hash() == Some(agent_user_action_hash.clone()) {
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  // The member's own end: no grant, because it is their own place (#234). The
  // membership links stay as the record that they belonged. An organisation is
  // retired by its coordinators, never as a side effect of someone leaving.
  let mut closing = open_links_to(
    get_organization_members_links(original_action_hash.clone())?,
    &agent_user_action_hash,
  );
  closing.extend(open_links_to(
    get_user_organizations_links(agent_user_action_hash.clone())?,
    &original_action_hash,
  ));
  write_membership_end(&original_action_hash, &agent_user_action_hash, closing, None)?;

  Ok(true)
}

#[hdk_extern]
pub fn remove_organization_member(input: OrganizationUserInput) -> ExternResult<ActionHash> {
  let grant = require_coordinate(&input.organization_original_action_hash.0)?;

  if !is_organization_accepted(&input.organization_original_action_hash.0)? {
    return Err(AdministrationError::EntityNotAccepted("organization".to_string()).into());
  }

  if !is_organization_member(input.clone())? {
    return Err(OrganizationsError::NotMember.into());
  }

  if is_organization_coordinator(input.clone())? {
    return Err(OrganizationsError::AlreadyCoordinator.into());
  }

  // Remove contact link if this member is the contact
  let contact_links =
    get_organization_contacts_links(input.organization_original_action_hash.0.clone())?;
  for link in contact_links {
    if link.target.clone().into_action_hash() == Some(input.user_original_action_hash.0.clone()) {
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  let members_links =
    get_organization_members_links(input.organization_original_action_hash.0.clone())?;
  if members_links.len() <= 1 {
    return Err(OrganizationsError::LastMember.into());
  }

  // The coordinator's grant goes on the end, so validation can check it (#234).
  let mut closing = open_links_to(members_links, &input.user_original_action_hash.0);
  closing.extend(open_links_to(
    get_user_organizations_links(input.user_original_action_hash.0.clone())?,
    &input.organization_original_action_hash.0,
  ));
  write_membership_end(
    &input.organization_original_action_hash.0,
    &input.user_original_action_hash.0,
    closing,
    Some(grant),
  )
}

#[hdk_extern]
pub fn remove_organization_coordinator(input: OrganizationUserInput) -> ExternResult<bool> {
  let grant = require_coordinate(&input.organization_original_action_hash.0)?;

  if !is_organization_accepted(&input.organization_original_action_hash.0)? {
    return Err(AdministrationError::EntityNotAccepted("organization".to_string()).into());
  }

  if !is_organization_coordinator(input.clone())? {
    return Err(OrganizationsError::NotCoordinator.into());
  }

  let coordinator_links =
    get_organization_coordinators_links(input.organization_original_action_hash.0.clone())?;
  if coordinator_links.len() <= 1 {
    return Err(OrganizationsError::LastCoordinator.into());
  }

  // Their coordinator grants are revoked; what they did as coordinator stands.
  for agent in get_user_agents(input.user_original_action_hash.0.clone())? {
    revoke_roles_of(RevokeRolesOfInput {
      holder: agent,
      role: Role::OrgCoordinator,
      scope: Some(input.organization_original_action_hash.0.clone()),
      reason: "removed as coordinator".to_string(),
    })?;
  }

  // The role ends; the membership stays (#234).
  write_membership_end(
    &input.organization_original_action_hash.0,
    &input.user_original_action_hash.0,
    open_links_to(coordinator_links, &input.user_original_action_hash.0),
    Some(grant),
  )?;

  Ok(true)
}

/// Helper function to check if an organization's status is "accepted"
pub fn is_organization_accepted(
  organization_original_action_hash: &ActionHash,
) -> ExternResult<bool> {
  check_if_entity_is_accepted(EntityActionHash {
    entity_original_action_hash: OriginalActionHash(organization_original_action_hash.clone()),
    entity: "organizations".to_string(),
  })
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateOrganizationInput {
  pub original_action_hash: OriginalActionHash,
  pub previous_action_hash: PreviousActionHash,
  pub updated_organization: Organization,
}

#[hdk_extern]
pub fn update_organization(input: UpdateOrganizationInput) -> ExternResult<Record> {
  // The client's original may be a revision; the guard and the update link
  // both need the Create, and a write must not proceed on a guess.
  let original = find_original_action_hash(input.original_action_hash.0.clone())?;

  // The creator edits their own organisation, pending or approved, with no grant;
  // anyone else carries a coordinator grant for it or an admin grant. The grant field
  // is set here, never taken from the client.
  let creator = get(original.0.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("organization".to_string()))?
    .action()
    .author()
    .clone();
  let mut updated_organization = input.updated_organization;
  updated_organization.grant = if creator == agent_info()?.agent_initial_pubkey {
    None
  } else {
    Some(require_coordinate(&original.0)?)
  };

  let updated_organization_hash = update_entry(
    input.previous_action_hash.into(),
    &updated_organization,
  )?;

  create_link(
    original.0,
    updated_organization_hash.clone(),
    LinkTypes::OrganizationUpdates,
    (),
  )?;

  let record = get(updated_organization_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("organization".to_string()))?;

  Ok(record)
}

/// The retirement of an organisation, if it has one.
pub fn organization_retirement(organization: &ActionHash) -> ExternResult<Option<ActionHash>> {
  let filter = LinkTypes::OrganizationRetirements
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(organization.clone(), filter), GetStrategy::Network)?;
  Ok(links.into_iter().find_map(|link| link.target.into_action_hash()))
}

/// Whether an organisation has been retired.
#[hdk_extern]
pub fn is_organization_retired(organization_original_action_hash: ActionHash) -> ExternResult<bool> {
  Ok(organization_retirement(&organization_original_action_hash)?.is_some())
}

/// Retires an organisation (#234). An organisation is shared: members,
/// coordinators, listings and exchanges name it, so it is never tombstoned.
/// One of its coordinators, or an administrator, writes a retirement that
/// carries their `Coordinate` grant, and every reader skips it from then on.
/// Membership, coordinator and contact links stay as the record of who
/// belonged. Keeps its name so the interface's call is unchanged; returns the
/// retirement's hash, or the existing one if it was already retired.
#[hdk_extern]
pub fn delete_organization(
  organization_original_action_hash: ActionHash,
) -> ExternResult<ActionHash> {
  let organization = find_original_action_hash(organization_original_action_hash)?.0;
  let grant = require_coordinate(&organization)?;
  if let Some(existing) = organization_retirement(&organization)? {
    return Ok(existing);
  }
  let retirement = create_entry(EntryTypes::OrganizationRetirement(OrganizationRetirement {
    organization: organization.clone(),
    grant,
  }))?;
  create_link(
    organization,
    retirement.clone(),
    LinkTypes::OrganizationRetirements,
    (),
  )?;
  Ok(retirement)
}
