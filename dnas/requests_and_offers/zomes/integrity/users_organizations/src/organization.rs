use email_address::EmailAddress;
use hdi::prelude::*;
use utils::{
  errors::CommonError,
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

/// A membership link (`OrganizationMembers`, `OrganizationCoordinators`) carries, in its
/// tag, the grant it rests on: a coordinator grant for this organisation or an admin
/// grant, or, for the approval that makes a creator coordinator, the approver's admin or
/// steward grant. The base is the organisation.
pub fn validate_create_link_organization_membership(
  link_author: &AgentPubKey,
  base_address: &AnyLinkableHash,
  tag: &LinkTag,
  what: &str,
) -> ExternResult<ValidateCallbackResult> {
  let Some(organization) = base_address.clone().into_action_hash() else {
    return Ok(ValidateCallbackResult::Invalid(format!(
      "an {} link starts at the organisation",
      what
    )));
  };
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

pub fn validate_create_link_organization_updates(
  _action: TypedAction<CreateLinkData>,
  base_address: AnyLinkableHash,
  target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let action_hash = base_address
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("organization".to_string()))?;
  let record = must_get_valid_record(action_hash)?;
  let _organization: crate::Organization = record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound(
      "Linked action must reference an entry".to_string(),
    ))?;
  // Check the entry type for the given action hash
  let action_hash = target_address
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("organization".to_string()))?;
  let record = must_get_valid_record(action_hash)?;
  let _organization: crate::Organization = record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound(
      "Linked action must reference an entry".to_string(),
    ))?;
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
