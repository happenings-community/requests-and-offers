use hdi::prelude::*;
use utils::listing_rules::{amount_problem, hours_problem, links_problem, timeframe_problem};
use utils::{InteractionType, Quantity, TimePreference, TimeZone, Timeframe};

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
  /// When it is available: a preset or a window of dates
  pub timeframe: Option<Timeframe>,
  /// The hours on offer, where the member gives a figure
  pub time_estimate_hours: Option<f32>,
  /// What is asked in return, as a figure with its unit, where there is one
  pub amount: Option<Quantity>,
  /// The preferred time of day for the offer
  pub time_preference: TimePreference,
  /// The time zone for the offer
  pub time_zone: Option<TimeZone>,
  /// The interaction type for the offer
  pub interaction_type: InteractionType,
  /// Links related to the offer
  pub links: Vec<String>,
  /// The status of the offer (defaults to Active for new offers)
  #[serde(default = "default_listing_status")]
  pub status: ListingStatus,
}

/// Default function for listing status
fn default_listing_status() -> ListingStatus {
  ListingStatus::Active
}

/// Validates an offer entry
pub fn validate_offer(offer: Offer) -> ExternResult<ValidateCallbackResult> {
  // Validate title
  if offer.title.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "Offer title cannot be empty".to_string(),
    ));
  }

  // Validate description
  if offer.description.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "Offer description cannot be empty".to_string(),
    ));
  }

  // Validate description length (1000 character limit)
  if offer.description.len() > 1000 {
    return Ok(ValidateCallbackResult::Invalid(
      "Offer description cannot exceed 1000 characters".to_string(),
    ));
  }

  if let Some(reason) = hours_problem(offer.time_estimate_hours) {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }
  if let Some(reason) = amount_problem(&offer.amount) {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }
  if let Some(reason) = links_problem(&offer.links) {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }

  Ok(ValidateCallbackResult::Valid)
}

/// A new offer: the entry's own rules, then its window against the action
/// that writes it.
pub fn validate_offer_create(offer: Offer, at: Timestamp) -> ExternResult<ValidateCallbackResult> {
  if let ValidateCallbackResult::Invalid(reason) = validate_offer(offer.clone())? {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }
  validate_offer_timeframe(&offer, at)
}

/// An updated offer: the entry's own rules, then its window against the
/// update's own timestamp, but only when the update changes the timeframe. One
/// left as it was, however old, is not re-checked, so an expired listing can
/// still be archived or removed.
pub fn validate_offer_update(
  offer: Offer,
  original_action_hash: &ActionHash,
  at: Timestamp,
) -> ExternResult<ValidateCallbackResult> {
  if let ValidateCallbackResult::Invalid(reason) = validate_offer(offer.clone())? {
    return Ok(ValidateCallbackResult::Invalid(reason));
  }
  let previous = match previous_offer(original_action_hash)? {
    Ok(previous) => previous,
    Err(reason) => return Ok(ValidateCallbackResult::Invalid(reason)),
  };
  if offer.timeframe == previous.timeframe {
    return Ok(ValidateCallbackResult::Valid);
  }
  validate_offer_timeframe(&offer, at)
}

/// The window, if there is one, against the action's timestamp `at`.
pub fn validate_offer_timeframe(offer: &Offer, at: Timestamp) -> ExternResult<ValidateCallbackResult> {
  match offer.timeframe.as_ref().and_then(|t| timeframe_problem(t, at)) {
    Some(reason) => Ok(ValidateCallbackResult::Invalid(reason)),
    None => Ok(ValidateCallbackResult::Valid),
  }
}

/// The version an update replaces: the record the update names.
fn previous_offer(original_action_hash: &ActionHash) -> ExternResult<Result<Offer, String>> {
  let record = must_get_valid_record(original_action_hash.clone())?;
  Ok(match record.entry().to_app_option::<Offer>() {
    Ok(Some(previous)) => Ok(previous),
    _ => Err("an update of an offer replaces an offer".to_string()),
  })
}

/// Validates an update to an offer
pub fn validate_update_offer(
  _action: Update,
  _offer: Offer,
  _original_action: TypedAction<EntryCreationData>,
  _original_offer: Offer,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific update validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}

/// Validates an offer link creation
pub fn validate_create_link_offer_updates(
  _action: TypedAction<CreateLinkData>,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link creation validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}

/// Validates an offer link deletion
pub fn validate_delete_link_offer_updates(
  _action: TypedAction<DeleteLinkData>,
  _original_action: TypedAction<CreateLinkData>,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link deletion validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}
