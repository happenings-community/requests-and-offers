use hdi::prelude::*;
use utils::{
  grants::{check_act, check_author_or_act, Ability},
  ContactPreference, DateRange, InteractionType, TimePreference, TimeZone,
};

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
  /// The grant this write rests on: a member grant held by the
  /// author on a create; on an update, an admin grant when the author is not
  /// the request's creator.
  #[serde(default)]
  pub grant: Option<ActionHash>,
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

/// The grant rule for a request, run after the field rules.
/// A create needs a member grant held by the author. An update (`update` is the
/// action it updates) needs the request's creator, or an admin grant.
pub fn validate_request_grant(
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let (act, verdict) = match update {
    None => (
      "Posting a request",
      check_act(grant, author, &Ability::Participate, &None)?.map(|_| ()),
    ),
    Some(original) => (
      "Changing a request",
      check_author_or_act(original, grant, author, &Ability::Administer, &None)?,
    ),
  };
  Ok(match verdict {
    Ok(()) => ValidateCallbackResult::Valid,
    Err(reason) => ValidateCallbackResult::Invalid(format!("{} is a role act: {}", act, reason)),
  })
}
