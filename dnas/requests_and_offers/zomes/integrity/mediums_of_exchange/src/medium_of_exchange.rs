use hdi::prelude::*;

// MediumOfExchange Entry Definition
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct MediumOfExchange {
  /// Unique identifier (e.g., 'EUR', 'USD', 'PAY_IT_FORWARD')
  pub code: String,
  /// Human-readable name (e.g., 'Euro', 'US Dollar', 'Pay it Forward')
  pub name: String,
  /// Detailed description of the medium of exchange
  pub description: Option<String>,
  /// ID of corresponding hREA ResourceSpecification (only for approved)
  pub resource_spec_hrea_id: Option<String>,
}

/// Validation for creating a MediumOfExchange
pub fn validate_create_medium_of_exchange(
  _action: &SignedActionHashed,
  medium_of_exchange: &MediumOfExchange,
) -> ExternResult<ValidateCallbackResult> {
  if medium_of_exchange.code.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "MediumOfExchange code cannot be empty".to_string(),
    ));
  }
  if medium_of_exchange.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "MediumOfExchange name cannot be empty".to_string(),
    ));
  }
  // resource_spec_hrea_id can be None initially (for suggested state)
  Ok(ValidateCallbackResult::Valid)
}

/// Validation for updating a MediumOfExchange (author check + field validation)
pub fn validate_update_medium_of_exchange(
  action: &SignedActionHashed,
  medium_of_exchange: &MediumOfExchange,
  original_action_hash: &ActionHash,
  _original_medium_of_exchange: &MediumOfExchange,
) -> ExternResult<ValidateCallbackResult> {
  // Verify that the author of the update is the same as the author of the original create action
  let original_create_action_record = must_get_action(original_action_hash.clone())?;
  let original_create_action = original_create_action_record.action();

  if action.action().author() != original_create_action.author() {
    return Ok(ValidateCallbackResult::Invalid(
      "Only the original author can update the MediumOfExchange.".to_string(),
    ));
  }

  // Apply the same field validation rules as for creation
  if medium_of_exchange.code.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "MediumOfExchange code cannot be empty".to_string(),
    ));
  }
  if medium_of_exchange.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "MediumOfExchange name cannot be empty".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}

// Validation for deleting a MediumOfExchange (author check)
pub fn validate_delete_medium_of_exchange(
  action: &SignedActionHashed,
  original_action_hash: &ActionHash,
) -> ExternResult<ValidateCallbackResult> {
  // Verify that the author of the delete is the same as the author of the original create action
  let original_create_action_record = must_get_action(original_action_hash.clone())?;
  let original_create_action = original_create_action_record.action();

  if action.action().author() != original_create_action.author() {
    return Ok(ValidateCallbackResult::Invalid(
      "Only the original author can delete the MediumOfExchange.".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}
