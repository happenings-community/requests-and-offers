use hdi::prelude::*;
use utils::{
  grants::{chain_root, check_act, membership_admits, Ability},
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
  /// the request's creator, or, for a removal, a coordinator grant for
  /// `organization`.
  #[serde(default)]
  pub grant: Option<ActionHash>,
  /// The organisation this request is posted on behalf of, if any. Set at
  /// creation and never changed by an update.
  #[serde(default)]
  pub organization: Option<ActionHash>,
  /// With `organization`: the `OrganizationMembers` link that admits the author
  /// to it, as its action hash, which validation reads to prove membership.
  #[serde(default)]
  pub membership: Option<ActionHash>,
  /// Why a role holder removed this request. Required when a status of
  /// `Deleted` is written by anyone but the creator; the remover is the
  /// update's author.
  #[serde(default)]
  pub removal_reason: Option<String>,
  /// The request's one service type, its subject: set at creation, the same on
  /// every revision (#257). Validation requires it and holds it fixed; see
  /// `utils::listings`. Optional only so the interface's input shape is
  /// unchanged: the coordinator fills it in.
  #[serde(default)]
  pub service_type_hash: Option<ActionHash>,
  /// The decision that approved `service_type_hash`: a `ServiceTypeStatus`
  /// entry whose state is `Approved`. Validation requires it on a create and
  /// holds it fixed on an update; see `utils::listings::check_approval`. The
  /// serde default is for decoding only: the coordinator fills it in.
  #[serde(default)]
  pub service_type_approval: Option<ActionHash>,
  /// The listing's mediums of exchange, part of its terms: none (a gift) or up
  /// to eight, each the original record of a `MediumOfExchange`, set at
  /// creation and the same on every revision. See `utils::listings`.
  #[serde(default)]
  pub medium_of_exchange_hashes: Vec<ActionHash>,
  /// The decision that approved each medium, in the same order: a
  /// `MediumOfExchangeStatus` entry whose state is `Approved`. The coordinator
  /// fills both lists; the serde default is for decoding only.
  #[serde(default)]
  pub medium_of_exchange_approvals: Vec<ActionHash>,
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

/// The role rule for a request, run after the field rules.
///
/// A create needs a member grant held by the author; posted on an organisation's
/// behalf, it carries the membership link that admits the author to it.
///
/// An update (`update` is the action it updates) keeps `organization` as the
/// original has it. By the creator it needs no grant (their own delete is a
/// hard delete and never comes here). By anyone else: an edit needs an admin
/// grant; a removal, the new status being `Deleted`, needs an admin grant or a
/// coordinator grant for the request's organisation, and a reason.
pub fn validate_request_write(
  request: &Request,
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
    if let Err(reason) = check_act(&request.grant, author, &Ability::Participate, &None)? {
      return refuse("Posting a request", reason);
    }
    if let Some(organization) = &request.organization {
      let Some(membership) = &request.membership else {
        return refuse(
          "Posting a request for an organisation",
          "it names no membership".to_string(),
        );
      };
      if let Err(reason) = membership_admits(membership, organization, author)? {
        return refuse("Posting a request for an organisation", reason);
      }
    }
    return Ok(ValidateCallbackResult::Valid);
  };

  let (root, creator) = match chain_root(previous)? {
    Ok(found) => found,
    Err(reason) => return refuse("Changing a request", reason),
  };
  let original: Request = match must_get_valid_record(root)?.entry().to_app_option() {
    Ok(Some(original)) => original,
    _ => return refuse("Changing a request", "its original does not read".to_string()),
  };
  if request.organization != original.organization {
    return refuse(
      "Changing a request",
      "a request stays in the organisation it was posted for".to_string(),
    );
  }
  if &creator == author {
    return Ok(ValidateCallbackResult::Valid);
  }
  if request.status != ListingStatus::Deleted {
    return match check_act(&request.grant, author, &Ability::Administer, &None)? {
      Ok(_) => Ok(ValidateCallbackResult::Valid),
      Err(reason) => refuse("Changing a request", reason),
    };
  }
  // A removal by a role holder: who is the update's author, why is the reason.
  if request.removal_reason.as_deref().map(str::trim).unwrap_or("").is_empty() {
    return refuse(
      "Removing a request",
      "a removal by anyone but its author says why".to_string(),
    );
  }
  let as_admin = check_act(&request.grant, author, &Ability::Administer, &None)?;
  if as_admin.is_ok() {
    return Ok(ValidateCallbackResult::Valid);
  }
  match request.organization.clone() {
    Some(organization) => {
      match check_act(&request.grant, author, &Ability::Coordinate, &Some(organization))? {
        Ok(_) => Ok(ValidateCallbackResult::Valid),
        Err(reason) => refuse("Removing a request", reason),
      }
    }
    None => refuse("Removing a request", as_admin.err().unwrap_or_default()),
  }
}
