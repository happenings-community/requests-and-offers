//! Link rules (#234) for the link types the grants stack does not already
//! route: every one gets a shape, a writer and a tombstone rule, from the
//! parts in `utils::links`. `OrganizationMembers`, `OrganizationCoordinators`,
//! `UserUpdates` and `OrganizationUpdates` keep their own rules in `lib.rs`.

use hdi::prelude::*;
use utils::links::{
  check_create, check_delete, check_end, check_membership_act, membership_end_from_tag, verdict, End, Spec,
  Tombstone, Writer, MEMBERSHIP_END, ORGANIZATION, ORGANIZATION_RETIREMENT, STATUS, USER,
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
    // An index from a user to the organisations they joined. Written by the
    // user themselves, or by a coordinator or administrator whose grant is in
    // the tag (`validate_user_organizations_link`). Never tombstoned: leaving
    // or removal writes a `MembershipEnd`.
    LinkTypes::UserOrganizations => Spec {
      name: "UserOrganizations",
      base: End::Record(&[USER]),
      target: End::Record(&[ORGANIZATION]),
      writer: Writer::Open,
      tombstone: Tombstone::Never,
    },
    // From an organisation to a membership end, written by its author.
    LinkTypes::MembershipEnds => Spec {
      name: "MembershipEnds",
      base: End::Record(&[ORGANIZATION]),
      target: End::Record(&[MEMBERSHIP_END]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
    },
    // Written by the creator. An organisation is retired, never tombstoned,
    // so neither is its place in the directory: readers skip retired ones.
    LinkTypes::AllOrganizations => Spec {
      name: "AllOrganizations",
      base: End::Path(&["organizations"]),
      target: End::Record(&[ORGANIZATION]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
    },
    LinkTypes::OrganizationStatus => Spec {
      name: "OrganizationStatus",
      base: End::Record(&[ORGANIZATION]),
      target: End::Record(&[STATUS]),
      writer: Writer::AuthorOfBoth,
      tombstone: Tombstone::Never,
    },
    // From an organisation to its retirement, written by whoever retired it.
    LinkTypes::OrganizationRetirements => Spec {
      name: "OrganizationRetirements",
      base: End::Record(&[ORGANIZATION]),
      target: End::Record(&[ORGANIZATION_RETIREMENT]),
      writer: Writer::AuthorOfTarget,
      tombstone: Tombstone::Never,
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

/// The link from an organisation to its retirement: the general rule, and the
/// retirement must name this very organisation.
fn validate_retirement_link(
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let Some(spec) = spec(&LinkTypes::OrganizationRetirements) else {
    return Ok(ValidateCallbackResult::Valid);
  };
  match check_create(&spec, author, base, target, tag)? {
    ValidateCallbackResult::Valid => (),
    other => return Ok(other),
  }
  let Some(retirement_hash) = target.clone().into_action_hash() else {
    return Ok(verdict(Err("the link's target must be a record".into()), spec.name));
  };
  let record = must_get_valid_record(retirement_hash)?;
  let retirement: crate::OrganizationRetirement = match record.entry().to_app_option() {
    Ok(Some(retirement)) => retirement,
    _ => return Ok(verdict(Err("the retirement could not be read".into()), spec.name)),
  };
  let names_base = base.clone().into_action_hash() == Some(retirement.organization);
  Ok(verdict(
    if names_base { Ok(()) } else { Err("a retirement is linked only from the organisation it retires".into()) },
    spec.name,
  ))
}

/// A user's link to an organisation: the shape, then the writer is the user
/// themselves, or a coordinator or administrator whose grant is in the tag.
fn validate_user_organizations_link(
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let name = "UserOrganizations";
  if let Err(reason) = check_end(base, &End::Record(&[USER]), "base")? {
    return Ok(verdict(Err(reason), name));
  }
  if let Err(reason) = check_end(target, &End::Record(&[ORGANIZATION]), "target")? {
    return Ok(verdict(Err(reason), name));
  }
  let (Some(user), Some(organization)) = (base.clone().into_action_hash(), target.clone().into_action_hash()) else {
    return Ok(verdict(Err("both ends must be records".into()), name));
  };
  let grant = if tag.0.is_empty() { None } else { utils::grants::grant_from_tag(tag).ok() };
  Ok(verdict(check_membership_act(&organization, &user, &grant, author)?, name))
}

/// A link from an organisation to a membership end: the general rule, the end
/// names this organisation, and the tag names exactly the links the end closes.
fn validate_membership_end_link(
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let Some(spec) = spec(&LinkTypes::MembershipEnds) else {
    return Ok(ValidateCallbackResult::Valid);
  };
  let named = match membership_end_from_tag(tag) {
    Ok(named) => named,
    Err(reason) => return Ok(verdict(Err(reason), spec.name)),
  };
  match check_create(&spec, author, base, target, &LinkTag::new(vec![]))? {
    ValidateCallbackResult::Valid => (),
    other => return Ok(other),
  }
  let Some(end_hash) = target.clone().into_action_hash() else {
    return Ok(verdict(Err("the link's target must be a record".into()), spec.name));
  };
  let record = must_get_valid_record(end_hash)?;
  let end: crate::MembershipEnd = match record.entry().to_app_option() {
    Ok(Some(end)) => end,
    _ => return Ok(verdict(Err("the membership end could not be read".into()), spec.name)),
  };
  let matches = base.clone().into_action_hash() == Some(end.organization) && end.links == named;
  Ok(verdict(
    if matches { Ok(()) } else { Err("the link must name the end's organisation and the links it closes".into()) },
    spec.name,
  ))
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
  if matches!(link_type, LinkTypes::OrganizationRetirements) {
    return validate_retirement_link(author, base, target, tag);
  }
  if matches!(link_type, LinkTypes::UserOrganizations) {
    return validate_user_organizations_link(author, base, target, tag);
  }
  if matches!(link_type, LinkTypes::MembershipEnds) {
    return validate_membership_end_link(author, base, target, tag);
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
