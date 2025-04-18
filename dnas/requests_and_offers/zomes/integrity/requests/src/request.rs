use hdi::prelude::*;
use utils::types::{ContactPreference, DateRange, ExchangePreference, InteractionType, TimeZone};

/// Represents a Request Entry with various attributes
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Request {
  /// The title of the request
  pub title: String,
  /// A detailed description of the request
  pub description: String,
  /// Services requested
  pub services: Vec<ServiceType>,
  /// The preferred method of contact
  pub contact_preference: Option<ContactPreference>,
  /// The date range for the request
  pub date_range: Option<DateRange>,
  /// Estimated time in hours to complete the request
  pub time_estimate_hours: Option<f32>,
  /// Preferred time of day or other time preferences (free text)
  pub time_preference: Option<String>,
  /// Time zone of the requester
  pub time_zone: Option<TimeZone>,
  /// Preferred exchange method
  pub exchange_preference: Option<ExchangePreference>,
  /// Type of interaction (Virtual, InPerson)
  pub interaction_type: InteractionType,
}

/// Validates a request entry
pub fn validate_request(request: Request) -> ExternResult<ValidateCallbackResult> {
  // Validate title
  if request.title.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "Request title cannot be empty".to_string(),
    ));
  }

  // Validate description
  if request.description.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "Request description cannot be empty".to_string(),
    ));
  }

  // Validate time_estimate_hours if present
  if let Some(hours) = request.time_estimate_hours {
    if hours <= 0.0 {
      return Ok(ValidateCallbackResult::Invalid(
        "Time estimate must be greater than zero".to_string(),
      ));
    }
  }

  // Validate date_range if present
  if let Some(date_range) = &request.date_range {
    if let (Some(start), Some(end)) = (date_range.start, date_range.end) {
      if start > end {
        return Ok(ValidateCallbackResult::Invalid(
          "Start date cannot be after end date".to_string(),
        ));
      }
    }
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates an update to a request
pub fn validate_update_request(
  _action: Update,
  request: Request,
  _original_action: EntryCreationAction,
  original_request: Request,
) -> ExternResult<ValidateCallbackResult> {
  // Validate the request itself first
  let validation_result = validate_request(request.clone())?;
  if let ValidateCallbackResult::Invalid(_) = validation_result {
    return Ok(validation_result);
  }

  // Ensure interaction_type is immutable
  if request.interaction_type != original_request.interaction_type {
    return Ok(ValidateCallbackResult::Invalid(
      "Interaction type cannot be changed after creation".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates a request link creation
pub fn validate_create_link_request_updates(
  _action: CreateLink,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link creation validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}

/// Validates a request link deletion
pub fn validate_delete_link_request_updates(
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link deletion validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}

/// Placeholder validation for new link types
fn validate_create_link_request_to_service_type(
  _action: Doctype,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // TODO: Add validation: ensure base is a Request, target is a ServiceTypeEntry
  Ok(ValidateCallbackResult::Valid)
}

fn validate_delete_link_request_to_service_type(
  _action: Doctype,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

fn validate_create_link_service_type_to_request(
  _action: Doctype,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // TODO: Add validation: ensure base is a ServiceTypeEntry, target is a Request
  Ok(ValidateCallbackResult::Valid)
}

fn validate_delete_link_service_type_to_request(
  _action: Doctype,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}
