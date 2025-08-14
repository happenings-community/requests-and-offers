use hdi::prelude::*;

// ServiceType Entry Definition
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
  pub name: String,
  pub description: String,
  pub technical: bool, // true for technical services, false for non-technical
}

// Validation for creating a ServiceType
pub fn validate_create_service_type(
  _action: &SignedActionHashed,
  service_type: &ServiceType,
) -> ExternResult<ValidateCallbackResult> {
  if service_type.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType name cannot be empty".to_string(),
    ));
  }
  if service_type.description.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType description cannot be empty".to_string(),
    ));
  }
  // Technical field is a boolean, no additional validation needed.
  Ok(ValidateCallbackResult::Valid)
}

// Validation for updating a ServiceType (Task 2.3 - author check)
pub fn validate_update_service_type(
  action: &SignedActionHashed,
  service_type: &ServiceType,
  original_action_hash: &ActionHash,
  _original_service_type: &ServiceType, // Content of original entry, may be used for further validation
) -> ExternResult<ValidateCallbackResult> {
  // Verify that the author of the update is the same as the author of the original create action
  let original_create_action_record = must_get_action(original_action_hash.clone())?;
  let original_create_action = original_create_action_record.action(); // This is SignedAction

  // Access author via action.author() from SignedActionHashed or action().author() from SignedAction
  if action.action().author() != original_create_action.author() {
    return Ok(ValidateCallbackResult::Invalid(
      "Only the original author can update the ServiceType.".to_string(),
    ));
  }

  // Apply the same field validation rules as for creation
  if service_type.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType name cannot be empty".to_string(),
    ));
  }
  if service_type.description.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType description cannot be empty".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}

// Validation for deleting a ServiceType (Task 2.3 - author check)
pub fn validate_delete_service_type(
  action: &SignedActionHashed,
  original_action_hash: &ActionHash,
) -> ExternResult<ValidateCallbackResult> {
  // Verify that the author of the delete is the same as the author of the original create action
  let original_create_action_record = must_get_action(original_action_hash.clone())?;
  let original_create_action = original_create_action_record.action(); // This is SignedAction

  if action.action().author() != original_create_action.author() {
    return Ok(ValidateCallbackResult::Invalid(
      "Only the original author can delete the ServiceType.".to_string(),
    ));
  }
  // Additional checks could be added here, e.g., to prevent deletion if linked by active requests/offers.
  Ok(ValidateCallbackResult::Valid)
}
