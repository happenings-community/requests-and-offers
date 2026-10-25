//! Link rules (#234). Every link type has a shape, a writer and a tombstone
//! rule; `utils::links` holds the parts. What stays open until #234 phase 2,
//! and why, is stated beside each type.

use hdi::prelude::*;
use utils::links::{
  check_create, check_delete, check_empty_tag, check_end, check_author_of, verdict, Checked, End, Spec,
  Tombstone, Writer, MEDIUM_OF_EXCHANGE, OFFER, REQUEST,
};

use crate::LinkTypes;

const INDEX: &str = "mediums_of_exchange";
const PENDING: &str = "mediums_of_exchange.status.pending";
const APPROVED: &str = "mediums_of_exchange.status.approved";
const REJECTED: &str = "mediums_of_exchange.status.rejected";
const STATUS_PATHS: &[&str] = &[INDEX, PENDING, APPROVED, REJECTED];

/// The rule for each link type except the index and status paths, which
/// [`validate_create_link`] handles itself.
fn spec(link_type: &LinkTypes) -> Spec {
  match link_type {
    // The update chain: the administrator who writes each revision links it.
    // Never tombstoned.
    LinkTypes::MediumOfExchangeUpdates => Spec {
      name: "MediumOfExchangeUpdates",
      base: End::Record(&[MEDIUM_OF_EXCHANGE]),
      target: End::Record(&[MEDIUM_OF_EXCHANGE]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
    },
    LinkTypes::AllMediumsOfExchange => Spec {
      name: "AllMediumsOfExchange",
      base: End::Path(STATUS_PATHS),
      target: End::Record(&[MEDIUM_OF_EXCHANGE]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    // A listing's links to its medium of exchange. Written by the listing's author, and
    // by an administrator editing someone else's listing, so the writer stays
    // open; tombstoned on edit, removal and rejection the same way.
    LinkTypes::MediumOfExchangeToRequest => Spec {
      name: "MediumOfExchangeToRequest",
      base: End::Record(&[MEDIUM_OF_EXCHANGE]),
      target: End::Record(&[REQUEST]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::RequestToMediumOfExchange => Spec {
      name: "RequestToMediumOfExchange",
      base: End::Record(&[REQUEST]),
      target: End::Record(&[MEDIUM_OF_EXCHANGE]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::MediumOfExchangeToOffer => Spec {
      name: "MediumOfExchangeToOffer",
      base: End::Record(&[MEDIUM_OF_EXCHANGE]),
      target: End::Record(&[OFFER]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::OfferToMediumOfExchange => Spec {
      name: "OfferToMediumOfExchange",
      base: End::Record(&[OFFER]),
      target: End::Record(&[MEDIUM_OF_EXCHANGE]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
  }
}

/// The index and status paths of mediums of exchange. The index and the pending path
/// are written by whoever suggests or creates the medium of exchange, for their own entry.
/// The approved and rejected paths are written by an administrator, about
/// someone else's suggestion, and carry no grant yet; the grants stack's
/// grant-in-tag rule closes that. Every one of them is tombstoned by an
/// administrator when a status moves, so tombstones stay open until status is
/// held in entries (#234 phase 2).
fn validate_status_path_link(
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let name = "AllMediumsOfExchange";
  let path = match check_end(base, &End::Path(STATUS_PATHS), "base")? {
    Ok(Checked::Path(path)) => path,
    Ok(_) => unreachable!("a path end checks as a path"),
    Err(reason) => return Ok(verdict(Err(reason), name)),
  };
  let target_end = match check_end(target, &End::Record(&[MEDIUM_OF_EXCHANGE]), "target")? {
    Ok(end) => end,
    Err(reason) => return Ok(verdict(Err(reason), name)),
  };
  if let Err(reason) = check_empty_tag(tag) {
    return Ok(verdict(Err(reason), name));
  }
  if path == INDEX || path == PENDING {
    return Ok(verdict(check_author_of(&target_end, author, "target"), name));
  }
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_create_link(
  link_type: &LinkTypes,
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  match link_type {
    LinkTypes::AllMediumsOfExchange => validate_status_path_link(author, base, target, tag),
    other => check_create(&spec(other), author, base, target, tag),
  }
}

pub fn validate_delete_link(
  link_type: &LinkTypes,
  link_author: &AgentPubKey,
  author: &AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
  let spec = spec(link_type);
  Ok(check_delete(spec.name, spec.tombstone, link_author, author))
}
