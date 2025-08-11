use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, get_agent_user,
};
use exchanges_integrity::{CreateReviewInput, EntryTypes, ExchangeReview, LinkTypes};
use hdk::prelude::*;
use utils::errors::{AdministrationError, CommonError};

const ALL_REVIEWS_PATH: &str = "exchanges.reviews.all";

fn get_path_hash(path: &str) -> ExternResult<EntryHash> {
  Path::from(path).path_entry_hash()
}

/// Create a review for a completed agreement
#[hdk_extern]
pub fn create_review(input: CreateReviewInput) -> ExternResult<Record> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check authorization
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;
  if !is_admin {
    let user_links = get_agent_user(agent_pubkey.clone())?;
    if let Some(user_link) = user_links.first() {
      let user_hash = user_link
        .target
        .clone()
        .into_action_hash()
        .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
      let is_accepted = check_if_entity_is_accepted("users".to_string(), user_hash)?;
      if !is_accepted {
        return Err(AdministrationError::Unauthorized.into());
      }
    } else {
      return Err(AdministrationError::Unauthorized.into());
    }
  }

  // Create the review entry
  let review = ExchangeReview::new(
    input.completed_on_time,
    input.completed_as_agreed,
    input.rating,
    input.comments,
    input.reviewer_type,
  )
  .map_err(|e| CommonError::InvalidData(format!("Validation failed: {}", e)))?;

  let review_hash = create_entry(EntryTypes::ExchangeReview(review))?;

  let record = get(review_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find newly created review".to_string()),
  )?;

  // Create links
  create_link(
    input.agreement_hash,
    review_hash.clone(),
    LinkTypes::AgreementToReview,
    (),
  )?;

  create_link(
    review_hash.clone(),
    agent_pubkey,
    LinkTypes::ReviewToReviewer,
    (),
  )?;

  let all_reviews_path_hash = get_path_hash(ALL_REVIEWS_PATH)?;
  create_link(
    all_reviews_path_hash,
    review_hash,
    LinkTypes::AllReviews,
    (),
  )?;

  Ok(record)
}

/// Get reviews for an agreement
#[hdk_extern]
pub fn get_reviews_for_agreement(agreement_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(agreement_hash, LinkTypes::AgreementToReview)?.build(),
  )?;

  let mut reviews = Vec::new();
  for link in links {
    if let Some(review_hash) = link.target.into_action_hash() {
      if let Some(record) = get(review_hash, GetOptions::default())? {
        reviews.push(record);
      }
    }
  }

  Ok(reviews)
}

/// Get all reviews
#[hdk_extern]
pub fn get_all_exchange_reviews() -> ExternResult<Vec<Record>> {
  let path_hash = get_path_hash(ALL_REVIEWS_PATH)?;
  let links = get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllReviews)?.build())?;

  let mut reviews = Vec::new();
  for link in links {
    if let Some(review_hash) = link.target.into_action_hash() {
      if let Some(record) = get(review_hash, GetOptions::default())? {
        reviews.push(record);
      }
    }
  }

  Ok(reviews)
}
