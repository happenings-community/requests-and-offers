use hdi::prelude::*;

/// Represents a ServiceType Entry with various attributes
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
  /// The name of the service type
  pub name: String,
  /// A description of the service type
  pub description: Option<String>,
  /// The category this service type belongs to (optional)
  pub category: Option<String>,
  /// Tags for additional classification
  pub tags: Vec<String>,
  /// Whether this service type is verified by an administrator
  pub verified: bool,
}

/// Validates a service type entry
pub fn validate_service_type(service_type: ServiceType) -> ExternResult<ValidateCallbackResult> {
  // Validate name
  if service_type.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType name cannot be empty".to_string(),
    ));
  }

  // Validate name length (100 character limit)
  if service_type.name.len() > 100 {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType name cannot exceed 100 characters".to_string(),
    ));
  }

  // Validate description length if present
  if let Some(description) = &service_type.description {
    if description.len() > 500 {
      return Ok(ValidateCallbackResult::Invalid(
        "ServiceType description cannot exceed 500 characters".to_string(),
      ));
    }
  }

  // Validate category length if present
  if let Some(category) = &service_type.category {
    if category.len() > 100 {
      return Ok(ValidateCallbackResult::Invalid(
        "ServiceType category cannot exceed 100 characters".to_string(),
      ));
    }
  }

  // Validate tags
  for tag in &service_type.tags {
    if tag.is_empty() {
      return Ok(ValidateCallbackResult::Invalid(
        "ServiceType tags cannot be empty".to_string(),
      ));
    }
    if tag.len() > 50 {
      return Ok(ValidateCallbackResult::Invalid(
        "ServiceType tags cannot exceed 50 characters".to_string(),
      ));
    }
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates an update to a service type
pub fn validate_update_service_type(
  _action: Update,
  service_type: ServiceType,
  _original_action: EntryCreationAction,
  _original_service_type: ServiceType,
) -> ExternResult<ValidateCallbackResult> {
  // First validate the service type itself
  let validation_result = validate_service_type(service_type.clone())?;
  if let ValidateCallbackResult::Invalid(_) = validation_result {
    return Ok(validation_result);
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates a service type link creation
pub fn validate_create_link_service_type_updates(
  _action: CreateLink,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link creation validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}

/// Validates a service type link deletion
pub fn validate_delete_link_service_type_updates(
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link deletion validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}
