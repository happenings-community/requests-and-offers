use hdi::prelude::*;
use utils::{InteractionType, TimePreference, TimeZone};

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

  Ok(ValidateCallbackResult::Valid)
}
