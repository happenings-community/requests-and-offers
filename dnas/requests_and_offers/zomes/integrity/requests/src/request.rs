use hdi::prelude::*;

/// Represents a Request Entry with various attributes
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Request {
  /// The title of the request
  pub title: String,
  /// A detailed description of the request
  pub description: String,
  /// The current status of the request
  pub status: RequestStatus,
  /// The skills associated with the request
  pub skills: Vec<String>,
}

/// Enum representing the possible statuses of a request
#[derive(Clone, Debug, Serialize, Deserialize, SerializedBytes, PartialEq)]
pub enum RequestStatus {
  Draft,
  Published,
  InProgress,
  Completed,
  Cancelled,
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

  // Validate skills
  if request.skills.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "Request must have at least one skill".to_string(),
    ));
  }

  // Validate status
  match request.status {
    RequestStatus::Draft => Ok(ValidateCallbackResult::Valid),
    RequestStatus::Published => Ok(ValidateCallbackResult::Valid),
    RequestStatus::InProgress => Ok(ValidateCallbackResult::Valid),
    RequestStatus::Completed => Ok(ValidateCallbackResult::Valid),
    RequestStatus::Cancelled => Ok(ValidateCallbackResult::Valid),
  }
}

/// Validates an update to a request
pub fn validate_update_request(
  _action: Update,
  _request: Request,
  _original_action: EntryCreationAction,
  _original_request: Request,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific update validation logic if needed
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
