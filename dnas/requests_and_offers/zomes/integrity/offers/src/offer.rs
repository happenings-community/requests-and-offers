use hdi::prelude::*;
use utils::{
  grants::{chain_root, check_act, membership_admits, Ability},
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
  /// the offer's creator, or, for a removal, a coordinator grant for
  /// `organization`.
  #[serde(default)]
  pub grant: Option<ActionHash>,
  /// The organisation this offer is posted on behalf of, if any. Set at
  /// creation and never changed by an update.
  #[serde(default)]
  pub organization: Option<ActionHash>,
  /// With `organization`: the `OrganizationMembers` link that admits the author
  /// to it, as its action hash, which validation reads to prove membership.
  #[serde(default)]
  pub membership: Option<ActionHash>,
  /// Why a role holder removed this offer. Required when a status of
  /// `Deleted` is written by anyone but the creator; the remover is the
  /// update's author.
  #[serde(default)]
  pub removal_reason: Option<String>,
  /// The offer's one service type, its subject: set at creation, the same on
  /// every revision (#257). Validation requires it and holds it fixed; see
  /// `utils::listings`. Optional only so the interface's input shape is
  /// unchanged: the coordinator fills it in.
  #[serde(default)]
  pub service_type_hash: Option<ActionHash>,
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

/// The role rule for an offer, run after the field rules.
///
/// A create needs a member grant held by the author; posted on an organisation's
/// behalf, it carries the membership link that admits the author to it.
///
/// An update (`update` is the action it updates) keeps `organization` as the
/// original has it. By the creator it needs no grant (their own delete is a
/// hard delete and never comes here). By anyone else: an edit needs an admin
/// grant; a removal, the new status being `Deleted`, needs an admin grant or a
/// coordinator grant for the offer's organisation, and a reason.
pub fn validate_offer_write(
  offer: &Offer,
  author: &AgentPubKey,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  let refuse = |act: &str, reason: String| {
    Ok(ValidateCallbackResult::Invalid(format!(
      "{} is a role act: {}",
      act, reason
    )))
  };
  let Some(previous) = update else {
    if let Err(reason) = check_act(&offer.grant, author, &Ability::Participate, &None)? {
      return refuse("Posting an offer", reason);
    }
    if let Some(organization) = &offer.organization {
      let Some(membership) = &offer.membership else {
        return refuse(
          "Posting an offer for an organisation",
          "it names no membership".to_string(),
        );
      };
      if let Err(reason) = membership_admits(membership, organization, author)? {
        return refuse("Posting an offer for an organisation", reason);
      }
    }
    return Ok(ValidateCallbackResult::Valid);
  };

  let (root, creator) = match chain_root(previous)? {
    Ok(found) => found,
    Err(reason) => return refuse("Changing an offer", reason),
  };
  let original: Offer = match must_get_valid_record(root)?.entry().to_app_option() {
    Ok(Some(original)) => original,
    _ => return refuse("Changing an offer", "its original does not read".to_string()),
  };
  if offer.organization != original.organization {
    return refuse(
      "Changing an offer",
      "an offer stays in the organisation it was posted for".to_string(),
    );
  }
  if &creator == author {
    return Ok(ValidateCallbackResult::Valid);
  }
  if offer.status != ListingStatus::Deleted {
    return match check_act(&offer.grant, author, &Ability::Administer, &None)? {
      Ok(_) => Ok(ValidateCallbackResult::Valid),
      Err(reason) => refuse("Changing an offer", reason),
    };
  }
  // A removal by a role holder: who is the update's author, why is the reason.
  if offer.removal_reason.as_deref().map(str::trim).unwrap_or("").is_empty() {
    return refuse(
      "Removing an offer",
      "a removal by anyone but its author says why".to_string(),
    );
  }
  let as_admin = check_act(&offer.grant, author, &Ability::Administer, &None)?;
  if as_admin.is_ok() {
    return Ok(ValidateCallbackResult::Valid);
  }
  match offer.organization.clone() {
    Some(organization) => {
      match check_act(&offer.grant, author, &Ability::Coordinate, &Some(organization))? {
        Ok(_) => Ok(ValidateCallbackResult::Valid),
        Err(reason) => refuse("Removing an offer", reason),
      }
    }
    None => refuse("Removing an offer", as_admin.err().unwrap_or_default()),
  }
}
