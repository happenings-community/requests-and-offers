//! Link rules (#234). Every link type has a shape, a writer and a tombstone
//! rule; `utils::links` holds the parts. What stays open until #234 phase 2,
//! and why, is stated beside each type.

use hdi::prelude::*;
use utils::links::{
  check_create, check_delete, unused, End, Spec, Tombstone, Writer, ORGANIZATION, REQUEST, USER,
};

use crate::LinkTypes;

const ACTIVE: &[&str] = &["requests.active"];
const ARCHIVED: &[&str] = &["requests.archived"];

/// The rule for each link type, or `None` for one nothing writes.
fn spec(link_type: &LinkTypes) -> Option<Spec> {
  Some(match link_type {
    // The update chain: the author of each revision links it. Tombstoned when
    // the request is tombstoned, by its creator or an administrator, so open.
    LinkTypes::RequestUpdates => Spec {
      name: "RequestUpdates",
      base: End::Record(&[REQUEST]),
      target: End::Record(&[REQUEST]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Open,
    },
    LinkTypes::AllRequests => return None,
    // Rewritten on every edit, archive and removal, by the creator, an
    // administrator or a coordinator, each linking the revision they wrote.
    // Tombstoned by them too, so open until status is held in entries.
    LinkTypes::ActiveRequests => Spec {
      name: "ActiveRequests",
      base: End::Path(ACTIVE),
      target: End::Record(&[REQUEST]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Open,
    },
    LinkTypes::ArchivedRequests => Spec {
      name: "ArchivedRequests",
      base: End::Path(ARCHIVED),
      target: End::Record(&[REQUEST]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
    },
    // The creator's own user to the request. Tombstoned with the request.
    LinkTypes::UserRequests => Spec {
      name: "UserRequests",
      base: End::Record(&[USER]),
      target: End::Record(&[REQUEST]),
      writer: Writer::AuthorOfBoth,
      tombstone: Tombstone::Open,
    },
    LinkTypes::OrganizationRequests => Spec {
      name: "OrganizationRequests",
      base: End::Record(&[ORGANIZATION]),
      target: End::Record(&[REQUEST]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Open,
    },
    LinkTypes::RequestCreator => Spec {
      name: "RequestCreator",
      base: End::Record(&[REQUEST]),
      target: End::Record(&[USER]),
      writer: Writer::AuthorOfBoth,
      tombstone: Tombstone::Open,
    },
    LinkTypes::RequestOrganization => Spec {
      name: "RequestOrganization",
      base: End::Record(&[REQUEST]),
      target: End::Record(&[ORGANIZATION]),
      writer: Writer::AuthorOfBase,
      tombstone: Tombstone::Open,
    },
  })
}

pub fn validate_create_link(
  link_type: &LinkTypes,
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  match spec(link_type) {
    Some(spec) => check_create(&spec, author, base, target, tag),
    None => Ok(unused("AllRequests")),
  }
}

pub fn validate_delete_link(
  link_type: &LinkTypes,
  link_author: &AgentPubKey,
  author: &AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
  Ok(match spec(link_type) {
    Some(spec) => check_delete(spec.name, spec.tombstone, link_author, author),
    // Nothing writes it, so a tombstone can only follow a link that was
    // never valid; the coordinator's cleanup of it stays harmless.
    None => ValidateCallbackResult::Valid,
  })
}
