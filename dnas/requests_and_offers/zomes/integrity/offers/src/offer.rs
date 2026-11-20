use hdi::prelude::*;
use utils::{
  decimal::Quantity,
  errors::{invalid, OfferValidationError},
  grants::{check_act, check_author_or_act, Ability},
  listing_rules::{amount_problem, time_estimate_problem, timeframe_problem},
  InteractionType, TimePreference, TimeZone, Timeframe,
};

/// Represents the status of a listing
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ListingStatus {
  Active,
  Archived,
  Deleted, // Soft delete
}

/// Represents an Offer Entry with various attributes
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Offer {
  /// The title of the offer
  pub title: String,
  /// A detailed description of the offer
  pub description: String,
  /// The preferred time of day for the offer
  pub time_preference: TimePreference,
  /// The time zone for the offer
  pub time_zone: Option<TimeZone>,
  /// The interaction type for the offer
  pub interaction_type: InteractionType,
  /// Links related to the offer
  pub links: Vec<String>,
  /// When the offer is available: a preset or a window of dates (#380).
  #[serde(default)]
  pub timeframe: Option<Timeframe>,
  /// An estimate of the time the offered task takes, in hours, as an exact
  /// decimal ("2.5"), zero allowed. It describes the task and is never
  /// exchanged: the hours an agreement's service is measured in start from it,
  /// and hours as payment are a medium of exchange, carried by `amount`.
  #[serde(default)]
  pub time_estimate_hours: Option<String>,
  /// What the offer asks in payment, where it names a figure: an exact decimal
  /// above zero, in a unit: the name of a medium of exchange, as on an
  /// agreement (a currency, or a time-bank medium).
  #[serde(default)]
  pub amount: Option<Quantity>,
  /// The status of the offer (defaults to Active for new offers)
  #[serde(default = "default_listing_status")]
  pub status: ListingStatus,
  /// The grant this write rests on: a member grant held by the
  /// author on a create; on an update, an admin grant when the author is not
  /// the offer's creator.
  #[serde(default)]
  pub grant: Option<ActionHash>,
}

/// Default function for listing status
fn default_listing_status() -> ListingStatus {
  ListingStatus::Active
}

/// Validates an offer entry
pub fn validate_offer(offer: Offer) -> ExternResult<ValidateCallbackResult> {
  // Validate title
  if offer.title.is_empty() {
    return invalid(OfferValidationError::TitleEmpty);
  }

  // Validate description
  if offer.description.is_empty() {
    return invalid(OfferValidationError::DescriptionEmpty);
  }

  // Validate description length (1000 character limit)
  if offer.description.len() > 1000 {
    return invalid(OfferValidationError::DescriptionTooLong);
  }

  if let Some(problem) = time_estimate_problem(&offer.time_estimate_hours) {
    return invalid(problem);
  }
  if let Some(problem) = amount_problem(&offer.amount) {
    return invalid(problem);
  }

  Ok(ValidateCallbackResult::Valid)
}

/// The timeframe rule, run after the field rules and before the grant rule.
///
/// A window is checked against the writing action's own timestamp `at` when it
/// is set: on a create, and on an update that changes it. An update that leaves
/// the window as it was is not checked again, so an expired offer can still be
/// archived or edited. The version an update replaces (`update`) is read to see
/// whether the window changed.
pub fn validate_offer_timeframe(
  timeframe: &Option<Timeframe>,
  at: Timestamp,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let Some(timeframe) = timeframe else {
    return Ok(ValidateCallbackResult::Valid);
  };
  if let Some(replaced) = update {
    let record = must_get_valid_record(replaced.clone())?;
    let previous: Option<Offer> = record.entry().to_app_option().ok().flatten();
    let Some(previous) = previous else {
      return invalid(OfferValidationError::UpdateOfNonOffer);
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

/// The grant rule for an offer, run after the field rules.
/// A create needs a member grant held by the author. An update (`update` is the
/// action it updates) needs the offer's creator, or an admin grant.
pub fn validate_offer_grant(
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let verdict = match update {
    None => check_act(grant, author, &Ability::Participate, &None)?
      .map(|_| ())
      .map_err(|reason| OfferValidationError::PostIsRoleAct(reason.to_string())),
    Some(original) => check_author_or_act(original, grant, author, &Ability::Administer, &None)?
      .map_err(|reason| OfferValidationError::ChangeIsRoleAct(reason.to_string())),
  };
  match verdict {
    Ok(()) => Ok(ValidateCallbackResult::Valid),
    Err(reason) => invalid(reason),
  }
}
