use hdi::prelude::*;
use utils::{
  decimal::Quantity,
  errors::{invalid, RequestValidationError},
  grants::{check_act, check_author_or_act, Ability},
  listing_rules::{amount_problem, time_estimate_problem, timeframe_problem},
  ContactPreference, InteractionType, TimePreference, TimeZone, Timeframe,
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
  /// When the request is needed: a preset or a window of dates (#380).
  #[serde(default)]
  pub timeframe: Option<Timeframe>,
  /// An estimate of the time the task takes, in hours, as an exact decimal
  /// ("2.5"), zero allowed. It describes the task and is never exchanged: the
  /// hours an agreement's service is measured in start from it, and hours as
  /// payment are a medium of exchange, carried by `amount`.
  #[serde(default)]
  pub time_estimate_hours: Option<String>,
  /// What the request offers in payment, where it names a figure: an exact
  /// decimal above zero, in a unit: the name of a medium of exchange, as on
  /// an agreement (a currency, or a time-bank medium).
  #[serde(default)]
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
    return invalid(RequestValidationError::TitleEmpty);
  }

  // Validate description
  if request.description.is_empty() {
    return invalid(RequestValidationError::DescriptionEmpty);
  }

  // Validate description length (1000 character limit)
  if request.description.len() > 1000 {
    return invalid(RequestValidationError::DescriptionTooLong);
  }

  if let Some(problem) = time_estimate_problem(&request.time_estimate_hours) {
    return invalid(problem);
  }
  if let Some(problem) = amount_problem(&request.amount) {
    return invalid(problem);
  }

  Ok(ValidateCallbackResult::Valid)
}

/// The timeframe rule, run after the field rules and before the grant rule.
///
/// A window is checked against the writing action's own timestamp `at` when it
/// is set: on a create, and on an update that changes it. An update that leaves
/// the window as it was is not checked again, so an expired request can still be
/// archived or edited. The version an update replaces (`update`) is read to see
/// whether the window changed.
pub fn validate_request_timeframe(
  timeframe: &Option<Timeframe>,
  at: Timestamp,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let Some(timeframe) = timeframe else {
    return Ok(ValidateCallbackResult::Valid);
  };
  if let Some(replaced) = update {
    let record = must_get_valid_record(replaced.clone())?;
    let previous: Option<Request> = record.entry().to_app_option().ok().flatten();
    let Some(previous) = previous else {
      return invalid(RequestValidationError::UpdateOfNonRequest);
    };
    if previous.timeframe.as_ref() == Some(timeframe) {
      return Ok(ValidateCallbackResult::Valid);
    }
  }
  match timeframe_problem(timeframe, at) {
    Some(problem) => invalid(problem),
    None => Ok(ValidateCallbackResult::Valid),
  }
}

/// The grant rule for a request, run after the field rules.
/// A create needs a member grant held by the author. An update (`update` is the
/// action it updates) needs the request's creator, or an admin grant.
pub fn validate_request_grant(
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let verdict = match update {
    None => check_act(grant, author, &Ability::Participate, &None)?
      .map(|_| ())
      .map_err(|reason| RequestValidationError::PostIsRoleAct(reason.to_string())),
    Some(original) => check_author_or_act(original, grant, author, &Ability::Administer, &None)?
      .map_err(|reason| RequestValidationError::ChangeIsRoleAct(reason.to_string())),
  };
  match verdict {
    Ok(()) => Ok(ValidateCallbackResult::Valid),
    Err(reason) => invalid(reason),
  }
}
