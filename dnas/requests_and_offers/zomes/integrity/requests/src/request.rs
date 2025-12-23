use hdi::prelude::*;
use utils::{ContactPreference, DateRange, InteractionType, TimePreference, TimeZone};

/// Represents the status of a listing
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Default)]
pub enum ListingStatus {
  #[default]
  Active,
  Archived,
  Deleted, // Soft delete
}

/// Represents a Request Entry with various attributes
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Request {
  /// The title of the request
  pub title: String,
  /// A detailed description of the request
  pub description: String,
  /// The contact preference for the request
  pub contact_preference: ContactPreference,
  /// The date range for the request (defaults to None for backward compatibility)
  #[serde(default)]
  pub date_range: Option<DateRange>,
  /// The estimated time in hours to complete the request (defaults to None for backward compatibility)
  #[serde(default)]
  pub time_estimate_hours: Option<f32>,
  /// The preferred time of day for the request
  pub time_preference: TimePreference,
  /// The time zone for the request (defaults to None for backward compatibility)
  #[serde(default)]
  pub time_zone: Option<TimeZone>,
  /// The interaction type for the request
  pub interaction_type: InteractionType,
  /// Links related to the request (defaults to empty for backward compatibility)
  #[serde(default)]
  pub links: Vec<String>,
  /// The status of the request (defaults to Active for backward compatibility)
  #[serde(default)]
  pub status: ListingStatus,
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

  // Validate description length (500 character limit)
  if request.description.len() > 500 {
    return Ok(ValidateCallbackResult::Invalid(
      "Request description cannot exceed 500 characters".to_string(),
    ));
  }

  // Validate time_estimate_hours if present
  if let Some(time_estimate) = request.time_estimate_hours {
    if time_estimate <= 0.0 {
      return Ok(ValidateCallbackResult::Invalid(
        "Time estimate must be greater than zero".to_string(),
      ));
    }
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates an update to a request
pub fn validate_update_request(
  _action: Update,
  request: Request,
  _original_action: EntryCreationAction,
  _original_request: Request,
) -> ExternResult<ValidateCallbackResult> {
  validate_request(request)
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
