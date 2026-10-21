use hdi::prelude::*;
use utils::listing_rules::{amount_problem, hours_problem, timeframe_problem};
use utils::{ContactPreference, InteractionType, Quantity, TimePreference, TimeZone, Timeframe};

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
  /// When it is needed by: a preset or a window of dates
  pub timeframe: Option<Timeframe>,
  /// The estimated time in hours to complete the request (defaults to None for backward compatibility)
  #[serde(default)]
  pub time_estimate_hours: Option<f32>,
  /// What is offered in return, as a figure with its unit, where there is one
  pub amount: Option<Quantity>,
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

  // Validate description length (1000 character limit)
  if request.description.len() > 1000 {
    return Ok(ValidateCallbackResult::Invalid(
      "Request description cannot exceed 1000 characters".to_string(),
    ));
  }

  if let Some(reason) = hours_problem(request.time_estimate_hours) {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }
  if let Some(reason) = amount_problem(&request.amount) {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }

  Ok(ValidateCallbackResult::Valid)
}

/// A new request: the entry's own rules, then its window against the action
/// that writes it.
pub fn validate_request_create(request: Request, at: Timestamp) -> ExternResult<ValidateCallbackResult> {
  if let ValidateCallbackResult::Invalid(reason) = validate_request(request.clone())? {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }
  validate_request_timeframe(&request, at)
}

/// An updated request: the entry's own rules, then its window against the
/// update's own timestamp, but only when the update changes the timeframe. One
/// left as it was, however old, is not re-checked, so an expired listing can
/// still be archived or removed.
pub fn validate_request_update(
  request: Request,
  original_action_hash: &ActionHash,
  at: Timestamp,
) -> ExternResult<ValidateCallbackResult> {
  if let ValidateCallbackResult::Invalid(reason) = validate_request(request.clone())? {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }
  let previous = match previous_request(original_action_hash)? {
    Ok(previous) => previous,
    Err(reason) => return Ok(ValidateCallbackResult::Invalid(reason)),
  };
  if request.timeframe == previous.timeframe {
    return Ok(ValidateCallbackResult::Valid);
  }
  validate_request_timeframe(&request, at)
}

/// The window, if there is one, against the action's timestamp `at`.
pub fn validate_request_timeframe(request: &Request, at: Timestamp) -> ExternResult<ValidateCallbackResult> {
  match request.timeframe.as_ref().and_then(|t| timeframe_problem(t, at)) {
    Some(reason) => Ok(ValidateCallbackResult::Invalid(reason)),
    None => Ok(ValidateCallbackResult::Valid),
  }
}

/// The version an update replaces: the record the update names.
fn previous_request(original_action_hash: &ActionHash) -> ExternResult<Result<Request, String>> {
  let record = must_get_valid_record(original_action_hash.clone())?;
  Ok(match record.entry().to_app_option::<Request>() {
    Ok(Some(previous)) => Ok(previous),
    _ => Err("an update of a request replaces a request".to_string()),
  })
}

/// Validates an update to a request
pub fn validate_update_request(
  _action: Update,
  request: Request,
  _original_action: TypedAction<EntryCreationData>,
  _original_request: Request,
) -> ExternResult<ValidateCallbackResult> {
  validate_request(request)
}

/// Validates a request link creation
pub fn validate_create_link_request_updates(
  _action: TypedAction<CreateLinkData>,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link creation validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}

/// Validates a request link deletion
pub fn validate_delete_link_request_updates(
  _action: TypedAction<DeleteLinkData>,
  _original_action: TypedAction<CreateLinkData>,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link deletion validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}
