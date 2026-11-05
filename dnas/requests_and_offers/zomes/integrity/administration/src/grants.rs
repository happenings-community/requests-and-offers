//! Validation of the chain of grants: a grant checks the one step above it,
//! a revocation checks the revoker's grant, and the index links that point at
//! grants carry the grant they index.
//!
//! The types and the shared checks are in `utils::grants`; this file is what
//! the administration zome, which registers the entries, enforces on them.

use hdi::prelude::*;
use utils::grants::{
  grant_from_tag, load_grant, may_grant, role_available, root_signature_is_valid, scope_fits,
  stewarding_present, Authority, Role, RoleGrant, RoleRevocation,
};

fn invalid(reason: impl Into<String>) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(reason.into()))
}

/// A grant is valid when its role is known and held on this network (the
/// steward role needs the stewarding module), its scope fits the role, and what
/// authorised it holds: the progenitor's signature over the body, which may
/// grant `admin` only, or a valid grant above it whose holder wrote this one
/// and whose role may grant this role in this scope.
pub fn validate_role_grant(
  author: &AgentPubKey,
  grant: &RoleGrant,
) -> ExternResult<ValidateCallbackResult> {
  let role = match grant.parsed_role() {
    Ok(role) => role,
    Err(reason) => return invalid(reason),
  };
  if !role_available(role, stewarding_present()?) {
    return invalid(format!(
      "a {} grant needs the stewarding module, and this network does not have it",
      grant.role
    ));
  }
  if !scope_fits(role, &grant.scope) {
    return invalid(format!(
      "a {} grant {} a scope",
      grant.role,
      if grant.scope.is_some() { "does not take" } else { "needs" }
    ));
  }

  match &grant.authority {
    Authority::Progenitor { signature } => {
      if role != Role::Admin {
        return invalid("the progenitor key grants the first administrators, nothing else");
      }
      match root_signature_is_valid(signature, &grant.body())? {
        // No progenitor key in the DNA properties: development, Sweettest. The
        // root is accepted, and the app's bootstrap guard is the only gate.
        None => Ok(ValidateCallbackResult::Valid),
        Some(true) => Ok(ValidateCallbackResult::Valid),
        Some(false) => invalid("the root grant is not signed by the progenitor key"),
      }
    }
    Authority::Grant(above_hash) => {
      let (above, _) = match load_grant(above_hash)? {
        Ok(found) => found,
        Err(reason) => return invalid(reason),
      };
      if &above.holder != author {
        return invalid("a grant is written by the holder of the grant it rests on");
      }
      let above_role = match above.parsed_role() {
        Ok(role) => role,
        Err(reason) => return invalid(reason),
      };
      if !may_grant(above_role, &above.scope, role, &grant.scope) {
        return invalid(format!(
          "a {} may not grant {} here",
          above.role, grant.role
        ));
      }
      Ok(ValidateCallbackResult::Valid)
    }
  }
}

/// A revocation is valid when both grants it names are valid, the revoker
/// holds the authority named, and that authority may grant the revoked role:
/// you may withdraw what you could give.
pub fn validate_role_revocation(
  author: &AgentPubKey,
  revocation: &RoleRevocation,
) -> ExternResult<ValidateCallbackResult> {
  let (revoked, _) = match load_grant(&revocation.grant)? {
    Ok(found) => found,
    Err(reason) => return invalid(reason),
  };
  let (authority, _) = match load_grant(&revocation.authority)? {
    Ok(found) => found,
    Err(reason) => return invalid(reason),
  };
  if &authority.holder != author {
    return invalid("a revocation is written by the holder of the grant it rests on");
  }
  let (revoked_role, authority_role) = match (revoked.parsed_role(), authority.parsed_role()) {
    (Ok(r), Ok(a)) => (r, a),
    (Err(reason), _) | (_, Err(reason)) => return invalid(reason),
  };
  if !may_grant(authority_role, &authority.scope, revoked_role, &revoked.scope) {
    return invalid(format!(
      "a {} may not revoke a {} grant here",
      authority.role, revoked.role
    ));
  }
  Ok(ValidateCallbackResult::Valid)
}

/// The grant a link's tag carries, loaded and checked for a role. The link
/// must be written by the agent who wrote the grant: the index is the
/// granter's record of what they granted.
pub fn grant_in_tag(
  link_author: &AgentPubKey,
  tag: &LinkTag,
  role: Role,
) -> ExternResult<Result<RoleGrant, String>> {
  let hash = match grant_from_tag(tag) {
    Ok(hash) => hash,
    Err(reason) => return Ok(Err(reason)),
  };
  let (grant, granter) = match load_grant(&hash)? {
    Ok(found) => found,
    Err(reason) => return Ok(Err(reason)),
  };
  if &granter != link_author {
    return Ok(Err("an index link is written by the agent who wrote the grant".to_string()));
  }
  if grant.parsed_role() != Ok(role) {
    return Ok(Err(format!(
      "this index holds {} grants, and the tag carries a {} grant",
      role, grant.role
    )));
  }
  Ok(Ok(grant))
}

/// An index link from a holder's key to one of their grants (`AgentGrants`,
/// `holder_keyed`), or from a role's path to a grant (`AllGrants`): the tag
/// carries the grant, which is also the target, and a holder-keyed link starts
/// at the holder. The base is compared as a linkable hash: `holo_hash` turns
/// any entry hash into an agent key on request, so the path hash of an
/// `AllGrants` link would read as a key and never match.
pub fn validate_grant_index_link(
  link_author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
  holder_keyed: bool,
) -> ExternResult<ValidateCallbackResult> {
  let hash = match grant_from_tag(tag) {
    Ok(hash) => hash,
    Err(reason) => return invalid(reason),
  };
  if target != &AnyLinkableHash::from(hash.clone()) {
    return invalid("a grant index link points at the grant its tag carries");
  }
  let (grant, granter) = match load_grant(&hash)? {
    Ok(found) => found,
    Err(reason) => return invalid(reason),
  };
  if &granter != link_author {
    return invalid("an index link is written by the agent who wrote the grant");
  }
  if holder_keyed && base != &AnyLinkableHash::from(grant.holder) {
    return invalid("an agent's grant index holds that agent's grants");
  }
  Ok(ValidateCallbackResult::Valid)
}

/// A holder-keyed role index link (`AgentAdministrators`; the stewarding
/// module's roster links take the same shape):
/// the base is the holder of the grant in the tag.
pub fn validate_holder_role_link(
  link_author: &AgentPubKey,
  base: &AnyLinkableHash,
  tag: &LinkTag,
  role: Role,
) -> ExternResult<ValidateCallbackResult> {
  let grant = match grant_in_tag(link_author, tag, role)? {
    Ok(grant) => grant,
    Err(reason) => return invalid(reason),
  };
  if base != &AnyLinkableHash::from(grant.holder) {
    return invalid(format!("a {} index link starts at the grant's holder", role));
  }
  Ok(ValidateCallbackResult::Valid)
}

/// A roster link (`AllAdministrators`): the target is
/// a user entity, which the grant does not name, so the link is checked for
/// its grant and its author only.
pub fn validate_roster_link(
  link_author: &AgentPubKey,
  tag: &LinkTag,
  role: Role,
) -> ExternResult<ValidateCallbackResult> {
  match grant_in_tag(link_author, tag, role)? {
    Ok(_) => Ok(ValidateCallbackResult::Valid),
    Err(reason) => invalid(reason),
  }
}

/// A `GrantRevocations` link: from a grant to a valid revocation of it,
/// written by the revoker.
pub fn validate_grant_revocation_link(
  link_author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
  let Some(target_hash) = target.clone().into_action_hash() else {
    return invalid("a revocation link points at a revocation record");
  };
  let record = must_get_valid_record(target_hash)?;
  let revocation: RoleRevocation = match record.entry().to_app_option() {
    Ok(Some(revocation)) => revocation,
    _ => return invalid("a revocation link points at a revocation record"),
  };
  if record.action().author() != link_author {
    return invalid("a revocation link is written by the revoker");
  }
  if base != &AnyLinkableHash::from(revocation.grant) {
    return invalid("a revocation link starts at the grant it revokes");
  }
  Ok(ValidateCallbackResult::Valid)
}

#[cfg(test)]
mod tests {
  use utils::grants::{ROLE_GRANT_ENTRY_INDEX, ROLE_REVOCATION_ENTRY_INDEX};

  use crate::UnitEntryTypes;

  /// `utils::grants::load_grant` finds a grant by its entry index in this zome,
  /// so the constants there must match the enum here.
  #[test]
  fn the_entry_indexes_other_zomes_rely_on_are_right() {
    assert_eq!(UnitEntryTypes::RoleGrant as u8, ROLE_GRANT_ENTRY_INDEX);
    assert_eq!(UnitEntryTypes::RoleRevocation as u8, ROLE_REVOCATION_ENTRY_INDEX);
  }
}
