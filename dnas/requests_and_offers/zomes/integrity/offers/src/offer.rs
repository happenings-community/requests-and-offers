use hdi::prelude::*;
use utils::{
  types::{ExchangePreference, InteractionType, TimeZone},
  ServiceType,
};

/// Represents an Offer Entry with various attributes
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Offer {
  /// The title of the offer
  pub title: String,
  /// A detailed description of the offer
  pub description: String,
  /// The type of service being offered
  pub services: Vec<ServiceType>,
  /// The availability or timeframe for the offer
  pub availability: Option<String>,
  /// Qualifications and experience related to the offer
  pub qualifications_experience: Option<String>,
  /// Time zone of the offerer
  pub time_zone: Option<TimeZone>,
  /// Preferred exchange method
  pub exchange_preference: Option<ExchangePreference>,
  /// Type of interaction (Virtual, InPerson)
  pub interaction_type: InteractionType,
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

  // Validate services
  if offer.services.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "Offer must offer at least one service".to_string(),
    ));
  }

  // Add any additional validation for new fields if needed

  Ok(ValidateCallbackResult::Valid)
}

/// Validates an update to an offer
pub fn validate_update_offer(
  _action: Update,
  offer: Offer,
  _original_action: EntryCreationAction,
  original_offer: Offer,
) -> ExternResult<ValidateCallbackResult> {
  // Validate the offer itself first
  let validation_result = validate_offer(offer.clone())?;
  if let ValidateCallbackResult::Invalid(_) = validation_result {
    return Ok(validation_result);
  }

  // Ensure interaction_type is immutable
  if offer.interaction_type != original_offer.interaction_type {
    return Ok(ValidateCallbackResult::Invalid(
      "Interaction type cannot be changed after creation".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates an offer link creation
pub fn validate_create_link_offer_updates(
  _action: CreateLink,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link creation validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}

/// Validates an offer link deletion
pub fn validate_delete_link_offer_updates(
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Add specific link deletion validation logic if needed
  Ok(ValidateCallbackResult::Valid)
}
