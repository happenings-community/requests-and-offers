use email_address::EmailAddress;
use hdi::prelude::*;
use utils::{errors::CommonError, is_image};

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

pub fn validate_update_organization(
  _action: Update,
  _organization: Organization,
  _original_action: EntryCreationAction,
  _original_organization: Organization,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_organization(
  _action: Delete,
  _original_action: EntryCreationAction,
  _original_organization: Organization,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link_organization_updates(
  _action: CreateLink,
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
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(String::from(
    "OrganizationUpdates links cannot be deleted",
  )))
}
