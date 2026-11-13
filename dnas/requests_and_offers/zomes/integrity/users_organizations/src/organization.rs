use email_address::EmailAddress;
use hdi::prelude::*;
use utils::{
  grants::{chain_root, check_act, grant_from_tag, Ability},
  is_image,
};

#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Organization {
  pub name: String,
  pub description: String,
  pub full_legal_name: String,
  pub logo: Option<SerializedBytes>,
  pub email: String,
  pub urls: Vec<String>,
  pub location: String,
  /// The grant an update rests on: a coordinator grant for this
  /// organisation, or an admin grant, held by the author. Absent on creation, and on an
  /// update by the organisation's creator, who may edit their application while it is
  /// pending and needs no grant for it.
  #[serde(default)]
  pub grant: Option<ActionHash>,
}

/// The field rules, and, on an update, the role rule: the organisation's creator, or a
/// coordinator grant for this organisation, or an admin grant. The scope is the root of
/// the organisation's chain, which is the hash its coordinator grants name.
pub fn validate_organization_write(
  organization: Organization,
  author: &AgentPubKey,
  update_of: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let grant = organization.grant.clone();
  let fields = validate_organization(organization)?;
  if fields != ValidateCallbackResult::Valid {
    return Ok(fields);
  }
  let Some(previous) = update_of else {
    return Ok(ValidateCallbackResult::Valid);
  };
  let (root, creator) = match chain_root(previous)? {
    Ok(found) => found,
    Err(reason) => return Ok(ValidateCallbackResult::Invalid(reason)),
  };
  if &creator == author {
    return Ok(ValidateCallbackResult::Valid);
  }
  match check_act(&grant, author, &Ability::Coordinate, &Some(root))? {
    Ok(_) => Ok(ValidateCallbackResult::Valid),
    Err(reason) => Ok(ValidateCallbackResult::Invalid(format!(
      "editing an organisation is a role act: {}",
      reason
    ))),
  }
}

/// A membership link (`OrganizationMembers`, `OrganizationCoordinators`) runs from an
/// organisation to a user and carries, in its tag, the grant it rests on, held by the
/// link's author: a coordinator grant for this organisation, or a network grant that may
/// change a status (an administrator's, or a steward's where the stewarding module is on).
///
/// The second is there for approval, which is when an approver writes the creator's
/// first two links. The rule cannot tell an approval from any other moment, so what it
/// enforces is wider than that: an administrator or a steward may write a membership
/// link for any organisation at any time. The coordinator zome only does so on approval.
/// Who is a coordinator for permission is the grant, not this link.
pub fn validate_create_link_organization_membership(
  link_author: &AgentPubKey,
  base_address: &AnyLinkableHash,
  target_address: &AnyLinkableHash,
  tag: &LinkTag,
  what: &str,
) -> ExternResult<ValidateCallbackResult> {
  let Some(organization) = base_address.clone().into_action_hash() else {
    return Ok(ValidateCallbackResult::Invalid(format!(
      "a link to an organisation's {} starts at the organisation",
      what
    )));
  };
  if !matches!(crate::entry_at(base_address)?, Some((_, crate::EntryTypes::Organization(_)))) {
    return Ok(ValidateCallbackResult::Invalid(format!(
      "a link to an organisation's {} starts at the organisation",
      what
    )));
  }
  if !matches!(crate::entry_at(target_address)?, Some((_, crate::EntryTypes::User(_)))) {
    return Ok(ValidateCallbackResult::Invalid(format!(
      "a link to an organisation's {} points at a user",
      what
    )));
  }
  let grant = grant_from_tag(tag).ok();
  let as_coordinator = check_act(&grant, link_author, &Ability::Coordinate, &Some(organization))?;
  if as_coordinator.is_ok() {
    return Ok(ValidateCallbackResult::Valid);
  }
  match check_act(&grant, link_author, &Ability::ChangeStatus, &None)? {
    Ok(_) => Ok(ValidateCallbackResult::Valid),
    Err(_) => Ok(ValidateCallbackResult::Invalid(format!(
      "changing an organisation's {} is a role act: {}",
      what,
      as_coordinator.err().unwrap_or_default()
    ))),
  }
}

pub fn validate_organization(organization: Organization) -> ExternResult<ValidateCallbackResult> {
  if organization.full_legal_name.trim().is_empty() {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Full legal name must not be empty",
    )));
  }

  if let Some(bytes) = organization.logo {
    if !is_image(bytes) {
      return Ok(ValidateCallbackResult::Invalid(String::from(
        "Organization logo must be a valid image",
      )));
    }
  }

  if !EmailAddress::is_valid(&organization.email) {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Email is not valid",
    )));
  }

  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_organization(
  _action: Delete,
  _original_action: TypedAction<EntryCreationData>,
  _original_organization: Organization,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

/// An `OrganizationUpdates` link joins two `Organization` records, by their
/// declared entry type.
pub fn validate_create_link_organization_updates(
  _action: TypedAction<CreateLinkData>,
  base_address: AnyLinkableHash,
  target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  for end in [&base_address, &target_address] {
    if !matches!(crate::entry_at(end)?, Some((_, crate::EntryTypes::Organization(_)))) {
      return Ok(ValidateCallbackResult::Invalid(String::from(
        "an OrganizationUpdates link joins two Organization records",
      )));
    }
  }
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_link_organization_updates(
  _action: TypedAction<DeleteLinkData>,
  _original_action: TypedAction<CreateLinkData>,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(String::from(
    "OrganizationUpdates links cannot be deleted",
  )))
}
