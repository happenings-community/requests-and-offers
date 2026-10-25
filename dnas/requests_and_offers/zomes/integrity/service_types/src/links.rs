//! Link rules (#234). Every link type has a shape, a writer and a tombstone
//! rule; `utils::links` holds the parts. What stays open until #234 phase 2,
//! and why, is stated beside each type.

use hdi::prelude::*;
use utils::grants::Ability;
use utils::links::{
  check_author_of, check_create, check_delete, check_empty_tag, check_end, check_grant_tag, verdict, Checked, End, Spec,
  Tombstone, Writer, SERVICE_TYPE, OFFER, REQUEST, USER,
};

use crate::LinkTypes;

const INDEX: &str = "service_types";
const PENDING: &str = "service_types.status.pending";
const APPROVED: &str = "service_types.status.approved";
const REJECTED: &str = "service_types.status.rejected";
const STATUS_PATHS: &[&str] = &[INDEX, PENDING, APPROVED, REJECTED];

/// The rule for each link type except the index and status paths, which
/// [`validate_create_link`] handles itself.
fn spec(link_type: &LinkTypes) -> Spec {
  match link_type {
    // The update chain: the administrator who writes each revision links it.
    // Never tombstoned.
    LinkTypes::ServiceTypeUpdates => Spec {
      name: "ServiceTypeUpdates",
      base: End::Record(&[SERVICE_TYPE]),
      target: End::Record(&[SERVICE_TYPE]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
    },
    LinkTypes::AllServiceTypes => Spec {
      name: "AllServiceTypes",
      base: End::Path(STATUS_PATHS),
      target: End::Record(&[SERVICE_TYPE]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    // A listing's links to its service type. Written by the listing's author, and
    // by an administrator editing someone else's listing, so the writer stays
    // open; tombstoned on edit, removal and rejection the same way.
    LinkTypes::ServiceTypeToRequest => Spec {
      name: "ServiceTypeToRequest",
      base: End::Record(&[SERVICE_TYPE]),
      target: End::Record(&[REQUEST]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::RequestToServiceType => Spec {
      name: "RequestToServiceType",
      base: End::Record(&[REQUEST]),
      target: End::Record(&[SERVICE_TYPE]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::ServiceTypeToOffer => Spec {
      name: "ServiceTypeToOffer",
      base: End::Record(&[SERVICE_TYPE]),
      target: End::Record(&[OFFER]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::OfferToServiceType => Spec {
      name: "OfferToServiceType",
      base: End::Record(&[OFFER]),
      target: End::Record(&[SERVICE_TYPE]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::ServiceTypeToUser => Spec {
      name: "ServiceTypeToUser",
      base: End::Record(&[SERVICE_TYPE]),
      target: End::Record(&[USER]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    LinkTypes::UserToServiceType => Spec {
      name: "UserToServiceType",
      base: End::Record(&[USER]),
      target: End::Record(&[SERVICE_TYPE]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
  }
}

/// The index and status paths of service types. The index and the pending path
/// are written by whoever suggests or creates the service type, for their own entry.
/// The approved and rejected paths are written by an administrator, about
/// someone else's suggestion, so their tag names the administrator's grant. Every one of them is tombstoned by an
/// administrator when a status moves, so tombstones stay open until status is
/// held in entries (#234 phase 2).
fn validate_status_path_link(
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let name = "AllServiceTypes";
  let path = match check_end(base, &End::Path(STATUS_PATHS), "base")? {
    Ok(Checked::Path(path)) => path,
    Ok(_) => unreachable!("a path end checks as a path"),
    Err(reason) => return Ok(verdict(Err(reason), name)),
  };
  let target_end = match check_end(target, &End::Record(&[SERVICE_TYPE]), "target")? {
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
    LinkTypes::AllServiceTypes => validate_status_path_link(author, base, target, tag),
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
