//! Validation of the chain of grants: a grant checks the one step above it,
//! a revocation checks the revoker's grant, and the index links that point at
//! grants carry the grant they index.
//!
//! The types and the shared checks are in `utils::grants`; this file is what
//! the administration zome, which registers the entries, enforces on them.

use hdi::prelude::*;
use utils::errors::{invalid, GrantValidationError};
use utils::grants::{
  grant_from_tag, load_grant, load_revocation, may_grant, role_available,
  root_is_valid, scope_fits, stewarding_present, Authority, Role, RoleGrant, RoleRevocation,
};

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
    return invalid(GrantValidationError::NeedsStewarding(grant.role.clone()));
  }
  if !scope_fits(role, &grant.scope) {
    return invalid(if grant.scope.is_some() {
      GrantValidationError::ScopeNotTaken(grant.role.clone())
    } else {
      GrantValidationError::ScopeNeeded(grant.role.clone())
    });
  }

  match &grant.authority {
    Authority::Progenitor { signature } => {
      if role != Role::Admin {
        return invalid(GrantValidationError::ProgenitorGrantsAdminsOnly);
      }
      match root_is_valid(author, signature, &grant.body())? {
        // No progenitor key in the DNA properties: development, Sweettest. The
        // root is accepted, and the app's bootstrap guard is the only gate.
        None => Ok(ValidateCallbackResult::Valid),
        Some(Ok(())) => Ok(ValidateCallbackResult::Valid),
        Some(Err(reason)) => invalid(reason),
      }
    }
    Authority::Grant(above_hash) => {
      let (above, _) = match load_grant(above_hash)? {
        Ok(found) => found,
        Err(reason) => return invalid(reason),
      };
      if &above.holder != author {
        return invalid(GrantValidationError::NotHolderOfParent);
      }
      let above_role = match above.parsed_role() {
        Ok(role) => role,
        Err(reason) => return invalid(reason),
      };
      if !may_grant(above_role, &above.scope, role, &grant.scope) {
        return invalid(GrantValidationError::MayNotGrant {
          granter: above.role.clone(),
          role: grant.role.clone(),
        });
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
    return invalid(GrantValidationError::RevocationNotByHolder);
  }
  let (revoked_role, authority_role) = match (revoked.parsed_role(), authority.parsed_role()) {
    (Ok(r), Ok(a)) => (r, a),
    (Err(reason), _) | (_, Err(reason)) => return invalid(reason),
  };
  if !may_grant(authority_role, &authority.scope, revoked_role, &revoked.scope) {
    return invalid(GrantValidationError::MayNotRevoke {
      authority: authority.role.clone(),
      role: revoked.role.clone(),
    });
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
) -> ExternResult<Result<RoleGrant, GrantValidationError>> {
  let hash = match grant_from_tag(tag) {
    Ok(hash) => hash,
    Err(reason) => return Ok(Err(reason)),
  };
  let (grant, granter) = match load_grant(&hash)? {
    Ok(found) => found,
    Err(reason) => return Ok(Err(reason)),
  };
  if &granter != link_author {
    return Ok(Err(GrantValidationError::IndexLinkNotByGranter));
  }
  if grant.parsed_role() != Ok(role) {
    return Ok(Err(GrantValidationError::IndexHoldsOtherRole {
      index: role.to_string(),
      carried: grant.role.clone(),
    }));
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
    return invalid(GrantValidationError::IndexLinkTargetMismatch);
  }
  let (grant, granter) = match load_grant(&hash)? {
    Ok(found) => found,
    Err(reason) => return invalid(reason),
  };
  if &granter != link_author {
    return invalid(GrantValidationError::IndexLinkNotByGranter);
  }
  if holder_keyed && base != &AnyLinkableHash::from(grant.holder) {
    return invalid(GrantValidationError::AgentIndexHoldsOthers);
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
    return invalid(GrantValidationError::HolderLinkBaseMismatch(role.to_string()));
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
    return invalid(GrantValidationError::RevocationLinkTarget);
  };
  // By entry type, not by shape: see `load_revocation`.
  let Some((revocation, revoker)) = load_revocation(&target_hash)? else {
    return invalid(GrantValidationError::RevocationLinkTarget);
  };
  if &revoker != link_author {
    return invalid(GrantValidationError::RevocationLinkNotByRevoker);
  }
  if base != &AnyLinkableHash::from(revocation.grant) {
    return invalid(GrantValidationError::RevocationLinkBase);
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
