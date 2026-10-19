use hdk::prelude::*;

use crate::external_calls::{check_if_agent_is_administrator, get_all_administrators_links};

/// Largest named permission this zome will accept inside a `RoleRef`.
///
/// #241's permissions are short names like `steward`, not prose. Bounded for the same
/// reason every other incoming string is: the plaintext sits inside the ciphertext, and
/// the integrity zome's size bound is derived from these numbers.
pub const MAX_PERMISSION_BYTES: usize = 64;

/// Which role a message is addressed to, or sent as.
///
/// **Only `Admin` is switched on in this brief.** The other two are shaped now, so that
/// briefs C and D add stewards and organisation coordinators without changing the
/// message body, and refused with a clear reason until then.
///
/// Struct variants rather than the brief's `Permission(String)` and
/// `OrgCoordinator(ActionHash)`: serde's internally-tagged representation, which is what
/// gives the UI a `type` discriminant, does not support newtype variants. The named
/// field is the same data with a name the interface can read.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum RoleRef {
  /// Network administrators. Technical work: app faults, bugs, network configuration.
  Admin,
  /// A named permission from #241. Stewards, and any role created later.
  Permission { name: String },
  /// The coordinators of one organisation.
  OrgCoordinator { organization: ActionHash },
}

/// Which way a role message travels.
///
/// **Never trusted for authorisation.** It is computed at send from the caller's own
/// `User` against the case's opener, and stored so the interface can group a member's
/// correspondence without recomputing it. Every authorisation decision goes through
/// [`holds_role`] against the author's role *now*.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RoleDirection {
  /// To every holder of the role. A member opening or adding to their own case, or a
  /// holder writing to the others.
  ToHolders,
  /// From a holder, acting as the role, on somebody else's case. Reaches every holder
  /// and the member who opened it.
  FromHolder,
}

/// Why a role is not usable yet, as the error a caller sees.
///
/// One place, so the message is the same whichever entry point hits it.
fn not_enabled_yet(role: &RoleRef) -> WasmError {
  let which = match role {
    RoleRef::Admin => "admin",
    RoleRef::Permission { name } => name.as_str(),
    RoleRef::OrgCoordinator { .. } => "organisation coordinator",
  };
  wasm_error!(WasmErrorInner::Guest(format!(
    "The {which} role is not enabled yet. Alpha 2 switches on the admin role first; \
     stewards and named permissions arrive with the roles brief, and organisation \
     coordinators with the organisations brief."
  )))
}

/// Refuse a role this brief has not switched on, and bound what it carries.
///
/// Called by every send path before anything is written, so an unsupported role costs a
/// refusal rather than entries nobody can read.
pub fn require_enabled(role: &RoleRef) -> ExternResult<()> {
  match role {
    RoleRef::Admin => Ok(()),
    RoleRef::Permission { name } if name.len() > MAX_PERMISSION_BYTES => {
      Err(wasm_error!(WasmErrorInner::Guest(format!(
        "A permission name is {} bytes, over the {MAX_PERMISSION_BYTES} byte limit",
        name.len()
      ))))
    }
    other => Err(not_enabled_yet(other)),
  }
}

/// Every holder of `role`, by `User` original action hash, minus `exclude`.
///
/// The exclusion list is the conflict-of-interest hook stewards need in alpha 3, and is
/// empty for admins. It exists from the start so that the signature does
/// not change when stewarding arrives.
///
/// Returns `User` hashes rather than the brief's `Vec<User>`: every caller here fans a
/// message out, and `get_user_agents` takes exactly this hash. The interface resolves
/// `User` records from hashes everywhere else already, so handing back whole records
/// would mean a cross-zome read per holder for data most callers discard.
pub fn role_holders(role: &RoleRef, exclude: &[ActionHash]) -> ExternResult<Vec<ActionHash>> {
  require_enabled(role)?;

  let links = match role {
    RoleRef::Admin => get_all_administrators_links("network".to_string())?,
    // `require_enabled` has already refused these.
    _ => unreachable!("require_enabled admits only Admin"),
  };

  let mut holders = Vec::new();
  for link in links {
    let Some(user) = link.target.clone().into_action_hash() else {
      continue;
    };
    if exclude.contains(&user) || holders.contains(&user) {
      continue;
    }
    holders.push(user);
  }
  Ok(holders)
}

/// Whether `agent` holds `role` right now.
///
/// A role label inside a ciphertext is a claim,
/// and every reader tests it against the DHT at the moment of reading. A role that is
/// not enabled yet answers `false` rather than erroring, because this runs on the
/// reading path: a body carrying a role this build does not understand must be withheld,
/// not allowed to fail somebody's whole inbox.
pub fn holds_role(agent: &AgentPubKey, role: &RoleRef) -> ExternResult<bool> {
  match role {
    RoleRef::Admin => check_if_agent_is_administrator(agent.clone()),
    _ => Ok(false),
  }
}

/// Refuse a caller who does not hold `role`, naming what they tried to do.
pub fn require_holder(agent: &AgentPubKey, role: &RoleRef, what: &str) -> ExternResult<()> {
  if !holds_role(agent, role)? {
    return Err(wasm_error!(WasmErrorInner::Guest(format!(
      "Only a holder of that role can {what}"
    ))));
  }
  Ok(())
}
