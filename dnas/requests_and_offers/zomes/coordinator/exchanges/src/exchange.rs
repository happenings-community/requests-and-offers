use exchanges_integrity::*;
use hdk::prelude::*;
use utils::{
  errors::{AdministrationError, CommonError},
  find_original_action_hash,
};

use crate::external_calls::{check_if_entity_is_accepted, get_agent_user};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateInterestInput {
  pub listing: ActionHash,
  pub listing_type: ListingType,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateAgreementInput {
  pub listing: ActionHash,
  pub listing_type: ListingType,
  pub interest: ActionHash,
  pub primary: ExchangeTerm,
  pub reciprocal: ExchangeTerm,
  pub medium: String,
  pub terms: String,
  pub delivery_timeframe: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct RespondInput {
  pub agreement: ActionHash,
  pub accepted: bool,
  pub note: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ReviewInput {
  pub agreement: ActionHash,
  pub rating: u8,
  pub on_time: bool,
  pub as_agreed: bool,
  pub comment: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CancelInput {
  pub agreement: ActionHash,
  pub note: String,
}

// ---------------------------------------------------------------------------
// Read model. Status is never stored; it is read from which entries exist.
// ---------------------------------------------------------------------------

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangeStatus {
  Proposed,
  Agreed,
  ProviderDelivered,
  Complete,
  Reviewed,
  Declined,
  Cancelled,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Exchange {
  pub agreement: Record,
  pub response: Option<Record>,
  pub provider_completion: Option<Record>,
  pub receiver_completion: Option<Record>,
  pub provider_review: Option<Record>,
  pub receiver_review: Option<Record>,
  pub cancellation: Option<Record>,
  pub status: ExchangeStatus,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn my_pubkey() -> ExternResult<AgentPubKey> {
  Ok(agent_info()?.agent_initial_pubkey)
}

/// The calling agent's user hash, which must exist and be accepted.
fn my_accepted_user() -> ExternResult<ActionHash> {
  let me = my_pubkey()?;
  let links = get_agent_user(me)?;
  let user = links
    .first()
    .and_then(|l| l.target.clone().into_action_hash())
    .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
  if !check_if_entity_is_accepted("users".to_string(), user.clone())? {
    return Err(AdministrationError::EntityNotAccepted("user".to_string()).into());
  }
  Ok(user)
}

/// The user hash behind an agent, for the party who is not the caller.
fn user_for_agent(agent: AgentPubKey) -> ExternResult<ActionHash> {
  get_agent_user(agent)?
    .first()
    .and_then(|l| l.target.clone().into_action_hash())
    .ok_or(CommonError::ActionHashNotFound("user".to_string()).into())
}

/// Resolves a client-supplied hash to its Create. Propagating: every caller
/// here is about to write, and a link anchored on a fallback is permanent.
fn root(hash: ActionHash) -> ExternResult<ActionHash> {
  Ok(find_original_action_hash(hash)?.0)
}

fn links_from(base: ActionHash, link_type: LinkTypes) -> ExternResult<Vec<Link>> {
  let filter = link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  get_links(LinkQuery::new(base, filter), GetStrategy::Network)
}

fn records_from(base: ActionHash, link_type: LinkTypes) -> ExternResult<Vec<Record>> {
  let mut records = Vec::new();
  for link in links_from(base, link_type)? {
    if let Some(hash) = link.target.into_action_hash() {
      if let Some(record) = get(hash, GetOptions::default())? {
        records.push(record);
      }
    }
  }
  Ok(records)
}

fn entry_of<T: TryFrom<SerializedBytes, Error = SerializedBytesError>>(
  record: &Record,
  what: &str,
) -> ExternResult<T> {
  record
    .entry()
    .to_app_option::<T>()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound(what.to_string()).into())
}

fn record_at(hash: ActionHash, what: &str) -> ExternResult<Record> {
  get(hash, GetOptions::default())?.ok_or(CommonError::RecordNotFound(what.to_string()).into())
}

fn agreement_at(hash: &ActionHash) -> ExternResult<(Record, Agreement)> {
  let record = record_at(hash.clone(), "agreement")?;
  let agreement = entry_of::<Agreement>(&record, "agreement")?;
  Ok((record, agreement))
}

/// Which party the caller is, or an error if neither.
fn my_party(agreement: &Agreement) -> ExternResult<ActionHash> {
  let me = my_accepted_user()?;
  if me == agreement.provider || me == agreement.receiver {
    Ok(me)
  } else {
    Err(AdministrationError::Unauthorized.into())
  }
}

fn by_author(records: &[Record], author: &AgentPubKey) -> Option<Record> {
  records.iter().find(|r| r.action().author() == author).cloned()
}

/// Completion and review presuppose an accepted agreement that has not been
/// cancelled; earlier or later they are refused rather than stored and ignored.
fn require_accepted(agreement_hash: &ActionHash) -> ExternResult<()> {
  if !records_from(agreement_hash.clone(), LinkTypes::AgreementCancellations)?.is_empty() {
    return Err(CommonError::InvalidData("this agreement was cancelled".to_string()).into());
  }
  let responses = records_from(agreement_hash.clone(), LinkTypes::AgreementResponses)?;
  let accepted = responses
    .first()
    .map(|r| entry_of::<Response>(r, "response"))
    .transpose()?
    .map(|r| r.accepted)
    .unwrap_or(false);
  if !accepted {
    return Err(CommonError::InvalidData("this agreement has not been accepted".to_string()).into());
  }
  Ok(())
}

fn derive_status(
  response: Option<&Record>,
  cancellation: Option<&Record>,
  provider_done: bool,
  receiver_done: bool,
  both_reviewed: bool,
) -> ExternResult<ExchangeStatus> {
  if cancellation.is_some() {
    return Ok(ExchangeStatus::Cancelled);
  }
  let response = match response {
    None => return Ok(ExchangeStatus::Proposed),
    Some(r) => entry_of::<Response>(r, "response")?,
  };
  if !response.accepted {
    return Ok(ExchangeStatus::Declined);
  }
  if provider_done && receiver_done {
    return Ok(if both_reviewed { ExchangeStatus::Reviewed } else { ExchangeStatus::Complete });
  }
  if provider_done {
    return Ok(ExchangeStatus::ProviderDelivered);
  }
  Ok(ExchangeStatus::Agreed)
}

fn assemble(agreement_record: Record) -> ExternResult<Exchange> {
  let hash = agreement_record.signed_action.hashed.hash.clone();
  let agreement = entry_of::<Agreement>(&agreement_record, "agreement")?;
  let responses = records_from(hash.clone(), LinkTypes::AgreementResponses)?;
  let completions = records_from(hash.clone(), LinkTypes::AgreementCompletions)?;
  let reviews = records_from(hash.clone(), LinkTypes::AgreementReviews)?;
  let cancellations = records_from(hash, LinkTypes::AgreementCancellations)?;
  let response = responses.into_iter().next();
  let cancellation = cancellations.into_iter().next();
  // Completions and reviews are authored by agents; the parties are user
  // hashes. Split them by the agents behind the party records so readers
  // see roles, not keys.
  let provider_agent = record_at(agreement.provider.clone(), "provider")?
    .action()
    .author()
    .clone();
  let receiver_agent = record_at(agreement.receiver.clone(), "receiver")?
    .action()
    .author()
    .clone();
  let provider_completion = by_author(&completions, &provider_agent);
  let receiver_completion = by_author(&completions, &receiver_agent);
  let provider_review = by_author(&reviews, &provider_agent);
  let receiver_review = by_author(&reviews, &receiver_agent);
  let status = derive_status(
    response.as_ref(),
    cancellation.as_ref(),
    provider_completion.is_some(),
    receiver_completion.is_some(),
    provider_review.is_some() && receiver_review.is_some(),
  )?;
  Ok(Exchange {
    agreement: agreement_record,
    response,
    provider_completion,
    receiver_completion,
    provider_review,
    receiver_review,
    cancellation,
    status,
  })
}

// ---------------------------------------------------------------------------
// Interest
// ---------------------------------------------------------------------------

#[hdk_extern]
pub fn create_interest(input: CreateInterestInput) -> ExternResult<Record> {
  let me = my_accepted_user()?;
  let listing = root(input.listing)?;
  let listing_record = must_get_valid_record(listing.clone())?;
  if listing_record.action().author() == &my_pubkey()? {
    return Err(CommonError::InvalidData("a member cannot register interest in their own listing".to_string()).into());
  }
  let hash = create_entry(&EntryTypes::Interest(Interest {
    listing: listing.clone(),
    listing_type: input.listing_type,
    user: me.clone(),
  }))?;
  create_link(listing, hash.clone(), LinkTypes::ListingInterests, ())?;
  create_link(me, hash.clone(), LinkTypes::UserInterests, ())?;
  record_at(hash, "interest")
}

#[hdk_extern]
pub fn withdraw_interest(interest: ActionHash) -> ExternResult<ActionHash> {
  let interest = root(interest)?;
  delete_entry(interest)
}

#[hdk_extern]
pub fn get_interests_for_listing(listing: ActionHash) -> ExternResult<Vec<Record>> {
  records_from(root(listing)?, LinkTypes::ListingInterests)
}

#[hdk_extern]
pub fn get_my_interests(_: ()) -> ExternResult<Vec<Record>> {
  let me = my_accepted_user()?;
  records_from(me, LinkTypes::UserInterests)
}

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

/// Either party writes the agreement up. The caller supplies the listing, the
/// interest and the terms; provider, receiver and counterparty are derived
/// here from the listing's author and the listing type, and derived again in
/// validation, so a client cannot misname the parties.
#[hdk_extern]
pub fn create_agreement(input: CreateAgreementInput) -> ExternResult<Record> {
  let me = my_pubkey()?;
  let my_user = my_accepted_user()?;
  let listing = root(input.listing)?;
  let interest = root(input.interest)?;

  let listing_author = must_get_valid_record(listing.clone())?.action().author().clone();
  let interest_record = must_get_valid_record(interest.clone())?;
  let interest_entry = entry_of::<Interest>(&interest_record, "interest")?;
  if interest_entry.listing != listing {
    return Err(CommonError::InvalidData("interest is for a different listing".to_string()).into());
  }
  let interest_author = interest_record.action().author().clone();

  let other_agent = if me == listing_author {
    interest_author.clone()
  } else if me == interest_author {
    listing_author.clone()
  } else {
    return Err(AdministrationError::Unauthorized.into());
  };
  let other_user = user_for_agent(other_agent)?;

  let (listing_author_user, interested_user) = if me == listing_author {
    (my_user.clone(), other_user.clone())
  } else {
    (other_user.clone(), my_user.clone())
  };
  let (provider, receiver) = match input.listing_type {
    ListingType::Offer => (listing_author_user, interested_user),
    ListingType::Request => (interested_user, listing_author_user),
  };

  let hash = create_entry(&EntryTypes::Agreement(Agreement {
    listing: listing.clone(),
    listing_type: input.listing_type,
    interest,
    counterparty: other_user.clone(),
    provider,
    receiver,
    primary: input.primary,
    reciprocal: input.reciprocal,
    medium: input.medium,
    terms: input.terms,
    delivery_timeframe: input.delivery_timeframe,
  }))?;
  create_link(listing, hash.clone(), LinkTypes::ListingAgreements, ())?;
  create_link(my_user, hash.clone(), LinkTypes::UserAgreements, ())?;
  create_link(other_user, hash.clone(), LinkTypes::UserAgreements, ())?;
  record_at(hash, "agreement")
}

#[hdk_extern]
pub fn respond_to_agreement(input: RespondInput) -> ExternResult<Record> {
  let agreement_hash = root(input.agreement)?;
  let (_, agreement) = agreement_at(&agreement_hash)?;
  let me = my_accepted_user()?;
  if me != agreement.counterparty {
    return Err(AdministrationError::Unauthorized.into());
  }
  if !links_from(agreement_hash.clone(), LinkTypes::AgreementResponses)?.is_empty() {
    return Err(CommonError::InvalidData("this agreement already has a response".to_string()).into());
  }
  let hash = create_entry(&EntryTypes::Response(Response {
    agreement: agreement_hash.clone(),
    accepted: input.accepted,
    note: input.note,
  }))?;
  create_link(agreement_hash, hash.clone(), LinkTypes::AgreementResponses, ())?;
  record_at(hash, "response")
}

#[hdk_extern]
pub fn complete_agreement(agreement: ActionHash) -> ExternResult<Record> {
  let agreement_hash = root(agreement)?;
  let (_, agreement) = agreement_at(&agreement_hash)?;
  my_party(&agreement)?;
  require_accepted(&agreement_hash)?;
  let existing = records_from(agreement_hash.clone(), LinkTypes::AgreementCompletions)?;
  if by_author(&existing, &my_pubkey()?).is_some() {
    return Err(CommonError::InvalidData("you have already marked this exchange done".to_string()).into());
  }
  let hash = create_entry(&EntryTypes::Completion(Completion {
    agreement: agreement_hash.clone(),
  }))?;
  create_link(agreement_hash, hash.clone(), LinkTypes::AgreementCompletions, ())?;
  record_at(hash, "completion")
}

#[hdk_extern]
pub fn review_agreement(input: ReviewInput) -> ExternResult<Record> {
  let agreement_hash = root(input.agreement)?;
  let (_, agreement) = agreement_at(&agreement_hash)?;
  my_party(&agreement)?;
  require_accepted(&agreement_hash)?;
  let existing = records_from(agreement_hash.clone(), LinkTypes::AgreementReviews)?;
  if by_author(&existing, &my_pubkey()?).is_some() {
    return Err(CommonError::InvalidData("you have already reviewed this exchange".to_string()).into());
  }
  let hash = create_entry(&EntryTypes::Review(Review {
    agreement: agreement_hash.clone(),
    rating: input.rating,
    on_time: input.on_time,
    as_agreed: input.as_agreed,
    comment: input.comment,
  }))?;
  create_link(agreement_hash, hash.clone(), LinkTypes::AgreementReviews, ())?;
  record_at(hash, "review")
}

#[hdk_extern]
pub fn cancel_agreement(input: CancelInput) -> ExternResult<Record> {
  let agreement_hash = root(input.agreement)?;
  let (_, agreement) = agreement_at(&agreement_hash)?;
  my_party(&agreement)?;
  let hash = create_entry(&EntryTypes::Cancellation(Cancellation {
    agreement: agreement_hash.clone(),
    note: input.note,
  }))?;
  create_link(agreement_hash, hash.clone(), LinkTypes::AgreementCancellations, ())?;
  record_at(hash, "cancellation")
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

#[hdk_extern]
pub fn get_exchange(agreement: ActionHash) -> ExternResult<Exchange> {
  let hash = root(agreement)?;
  let record = record_at(hash, "agreement")?;
  assemble(record)
}

#[hdk_extern]
pub fn get_my_exchanges(_: ()) -> ExternResult<Vec<Exchange>> {
  let me = my_accepted_user()?;
  records_from(me, LinkTypes::UserAgreements)?
    .into_iter()
    .map(assemble)
    .collect()
}

#[hdk_extern]
pub fn get_exchanges_for_listing(listing: ActionHash) -> ExternResult<Vec<Exchange>> {
  records_from(root(listing)?, LinkTypes::ListingAgreements)?
    .into_iter()
    .map(assemble)
    .collect()
}
