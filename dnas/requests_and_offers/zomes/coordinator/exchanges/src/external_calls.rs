use exchanges_integrity::ListingType;
use hdk::prelude::*;
use utils::errors::CommonError;
use utils::{external_local_call, EntityActionHash, OriginalActionHash};

/// The user record links for an agent. Used for the caller's own user and
/// for the other party's; both go through the extern, which reads the
/// network (see #237 for the self-lookup case).
pub fn get_agent_user(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Link>> {
  external_local_call("get_agent_user", "users_organizations", agent_pubkey)
}

/// Whether an entity has accepted status.
pub fn check_if_entity_is_accepted(entity_type: String, entity_hash: ActionHash) -> ExternResult<bool> {
  let input = EntityActionHash {
    entity: entity_type,
    entity_original_action_hash: OriginalActionHash(entity_hash),
  };
  external_local_call("check_if_entity_is_accepted", "administration", input)
}

/// The current revision of a listing: the latest record of its update chain,
/// read from the listing's own zome.
pub fn latest_listing_revision(listing: &ActionHash, listing_type: &ListingType) -> ExternResult<ActionHash> {
  let record: Option<Record> = match listing_type {
    ListingType::Offer => external_local_call("get_latest_offer_record", "offers", listing.clone())?,
    ListingType::Request => external_local_call("get_latest_request_record", "requests", listing.clone())?,
  };
  record
    .map(|r| r.action_address().clone())
    .ok_or(CommonError::EntryNotFound("the listing agreed against".to_string()).into())
}
