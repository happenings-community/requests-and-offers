//! Link rules (#234). Every link type has a shape, a writer and a tombstone
//! rule; `utils::links` holds the parts. What stays open until #234 phase 2,
//! and why, is stated beside each type.

use hdi::prelude::*;
use utils::grants::Ability;
use utils::links::{MEDIUM_OF_EXCHANGE_STATUS, 
  check_author_of, check_create, check_delete, check_empty_tag, check_end, check_grant_tag, verdict, Checked, End, Spec,
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
    // Indexes only: written once per status a medium of exchange reaches, never
    // tombstoned. Readers take the medium of exchange's state from its latest status entry,
    // so a stale or forged index link cannot change what anyone sees.
    LinkTypes::AllMediumsOfExchange => Spec {
      name: "AllMediumsOfExchange",
      base: End::Path(STATUS_PATHS),
      target: End::Record(&[MEDIUM_OF_EXCHANGE]),
      writer: Writer::Open,
      tombstone: Tombstone::Never,
    },
    LinkTypes::MediumOfExchangeStatusUpdates => Spec {
      name: "MediumOfExchangeStatusUpdates",
      base: End::Record(&[MEDIUM_OF_EXCHANGE]),
      target: End::Record(&[MEDIUM_OF_EXCHANGE_STATUS]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
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
/// someone else's suggestion, so their tag names the administrator's grant. None of them is ever tombstoned: a
/// medium of exchange's state is its latest status entry, and these links only index it.
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
  if path == INDEX || path == PENDING {
    let rule = check_empty_tag(tag).and_then(|_| check_author_of(&target_end, author, "target"));
    return Ok(verdict(rule, name));
  }
  // Approved and rejected: a role act, so the tag names the administrator's
  // grant, checked back to its root by the chain of grants.
  Ok(verdict(check_grant_tag(tag, author, &Ability::Administer)?, name))
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
    LinkTypes::MediumOfExchangeStatusUpdates => validate_status_update_link(author, base, target, tag),
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

/// The link from a medium of exchange to a status entry decided on it: written by the
/// status entry's author, and only to a status about this very medium of exchange.
fn validate_status_update_link(
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let spec = spec(&LinkTypes::MediumOfExchangeStatusUpdates);
  match check_create(&spec, author, base, target, tag)? {
    ValidateCallbackResult::Valid => (),
    other => return Ok(other),
  }
  let Some(status_hash) = target.clone().into_action_hash() else {
    return Ok(verdict(Err("the link's target must be a record".into()), spec.name));
  };
  let record = must_get_valid_record(status_hash)?;
  let status: crate::MediumOfExchangeStatus = match record.entry().to_app_option() {
    Ok(Some(status)) => status,
    _ => return Ok(verdict(Err("the status could not be read".into()), spec.name)),
  };
  let names_base = base.clone().into_action_hash() == Some(status.medium_of_exchange);
  Ok(verdict(
    if names_base { Ok(()) } else { Err("a status is linked only from the medium of exchange it decides".into()) },
    spec.name,
  ))
}
