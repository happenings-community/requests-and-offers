use hdi::prelude::*;
use utils::{
  grants::{check_act, check_author_or_act, Ability},
  InteractionType, TimePreference, TimeZone,
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

/// The grant rule for an offer, run after the field rules.
/// A create needs a member grant held by the author. An update (`update` is the
/// action it updates) needs the offer's creator, or an admin grant.
pub fn validate_offer_grant(
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let (act, verdict) = match update {
    None => (
      "Posting an offer",
      check_act(grant, author, &Ability::Participate, &None)?.map(|_| ()),
    ),
    Some(original) => (
      "Changing an offer",
      check_author_or_act(original, grant, author, &Ability::Administer, &None)?,
    ),
  };
  Ok(match verdict {
    Ok(()) => ValidateCallbackResult::Valid,
    Err(reason) => ValidateCallbackResult::Invalid(format!("{} is a role act: {}", act, reason)),
  })
}
