//! Link rules (#234) for the link types the grants stack does not already
//! route: every one gets a shape, a writer and a tombstone rule, from the
//! parts in `utils::links`. `OrganizationMembers`, `OrganizationCoordinators`,
//! `UserUpdates` and `OrganizationUpdates` keep their own rules in `lib.rs`.

use hdi::prelude::*;
use utils::links::{
  check_create, check_delete, check_end, verdict, End, Spec, Tombstone, Writer, ORGANIZATION, STATUS, USER,
};

use crate::LinkTypes;

/// The longest contact role, in bytes. The role is text the coordinator types.
pub const MAX_CONTACT_ROLE_BYTES: usize = 100;

/// The rule for each link type this module routes.
fn spec(link_type: &LinkTypes) -> Option<Spec> {
  Some(match link_type {
    // Written once, by the user, about themselves, when they register.
    // Never tombstoned.
    LinkTypes::MyUser => Spec {
      name: "MyUser",
      base: End::Agent,
      target: End::Record(&[USER]),
      writer: Writer::AuthorOfBoth,
      tombstone: Tombstone::Never,
    },
    LinkTypes::UserAgents => Spec {
      name: "UserAgents",
      base: End::Record(&[USER]),
      target: End::Agent,
      writer: Writer::AuthorOfBoth,
      tombstone: Tombstone::Never,
    },
    LinkTypes::AllUsers => Spec {
      name: "AllUsers",
      base: End::Path(&["users"]),
      target: End::Record(&[USER]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
    },
    LinkTypes::UserStatus => Spec {
      name: "UserStatus",
      base: End::Record(&[USER]),
      target: End::Record(&[STATUS]),
      writer: Writer::AuthorOfBoth,
      tombstone: Tombstone::Never,
    },
    // Written by an organisation's creator for themselves, and by a
    // coordinator or administrator for a new member, with no grant in the
    // tag; tombstoned by a member leaving, a coordinator, or the
    // organisation's removal. Open until membership is held in entries.
    LinkTypes::UserOrganizations => Spec {
      name: "UserOrganizations",
      base: End::Record(&[USER]),
      target: End::Record(&[ORGANIZATION]),
      writer: Writer::Open,
      tombstone: Tombstone::Open,
    },
    // Written by the creator; tombstoned by a coordinator removing the
    // organisation.
    LinkTypes::AllOrganizations => Spec {
      name: "AllOrganizations",
      base: End::Path(&["organizations"]),
      target: End::Record(&[ORGANIZATION]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Open,
    },
    LinkTypes::OrganizationStatus => Spec {
      name: "OrganizationStatus",
      base: End::Record(&[ORGANIZATION]),
      target: End::Record(&[STATUS]),
      writer: Writer::AuthorOfBoth,
      tombstone: Tombstone::Open,
    },
    _ => return None,
  })
}

/// `OrganizationContacts` carries the contact's role as text in its tag, which
/// the interface reads back. So its tag is bounded text rather than empty.
/// Written and tombstoned by a coordinator, with no grant in the tag yet.
fn validate_contact_link(
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let name = "OrganizationContacts";
  if let Err(reason) = check_end(base, &End::Record(&[ORGANIZATION]), "base")? {
    return Ok(verdict(Err(reason), name));
  }
  if let Err(reason) = check_end(target, &End::Record(&[USER]), "target")? {
    return Ok(verdict(Err(reason), name));
  }
  Ok(verdict(check_contact_role(tag), name))
}

/// The contact role: UTF-8 text, from one byte to [`MAX_CONTACT_ROLE_BYTES`].
pub fn check_contact_role(tag: &LinkTag) -> Result<(), String> {
  if tag.0.is_empty() || tag.0.len() > MAX_CONTACT_ROLE_BYTES {
    return Err(format!(
      "the contact role must be 1 to {} bytes of text",
      MAX_CONTACT_ROLE_BYTES
    ));
  }
  std::str::from_utf8(&tag.0)
    .map(|_| ())
    .map_err(|_| "the contact role must be text".to_string())
}

/// Routes a create for a type this module covers. `None` for the four types
/// `lib.rs` routes itself.
pub fn validate_create_link(
  link_type: &LinkTypes,
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  if matches!(link_type, LinkTypes::OrganizationContacts) {
    return validate_contact_link(base, target, tag);
  }
  match spec(link_type) {
    Some(spec) => check_create(&spec, author, base, target, tag),
    None => Ok(ValidateCallbackResult::Valid),
  }
}

pub fn validate_delete_link(
  link_type: &LinkTypes,
  link_author: &AgentPubKey,
  author: &AgentPubKey,
) -> ValidateCallbackResult {
  match spec(link_type) {
    Some(spec) => check_delete(spec.name, spec.tombstone, link_author, author),
    // `OrganizationContacts`, and the types the grants stack routes in
    // `lib.rs`, whose own arms come first.
    None => ValidateCallbackResult::Valid,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn a_contact_role_is_bounded_text() {
    assert_eq!(check_contact_role(&LinkTag::new(b"Treasurer".to_vec())), Ok(()));
    assert!(check_contact_role(&LinkTag::new(vec![])).is_err());
    assert!(check_contact_role(&LinkTag::new(vec![b'a'; MAX_CONTACT_ROLE_BYTES + 1])).is_err());
    assert!(check_contact_role(&LinkTag::new(vec![0xff, 0xfe])).is_err());
  }
}
