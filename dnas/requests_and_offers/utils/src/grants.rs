//! The chain of grants: what every integrity zome needs to check a role act.
//!
//! A `RoleGrant` says that one agent holds one role, in one scope, and what
//! authorised it: the progenitor's signature for the first administrators, or
//! the grant of the person who wrote it, one step up the chain. Every write
//! that needs a role carries the hash of the grant it relies on, and its
//! validator checks that grant with [`check_act`]. A validator checks one step
//! only: `must_get_valid_record` returns a grant only once that grant has
//! itself passed validation, so the step above was checked by whoever
//! validated it.
//!
//! The entry types are registered in `administration_integrity`. The structs
//! and checks live here because six integrity zomes run the same check, and
//! each already depends on this crate.
//!
//! What validation cannot see: a revocation. Validation can prove a grant
//! exists and is valid; it cannot prove that no `RoleRevocation` names it.
//! Revoked holders are refused by the app (`can` in the administration
//! coordinator ignores revoked grants) and caught on read, not by the network.

use std::{fmt::Display, str::FromStr};

use hdk::prelude::*;

use crate::{external_local_call, DnaProperties};

/// The integrity zome that registers `RoleGrant` and `RoleRevocation`, as named
/// in `dnas/requests_and_offers/workdir/dna.yaml`. A validator in another zome
/// finds its index by this name in `dna_info().zome_names`, so an entry of the
/// same shape written under another zome's type is not mistaken for a grant.
pub const ADMINISTRATION_INTEGRITY_ZOME: &str = "administration_integrity";

/// The integrity zome that registers organisations and their membership links.
pub const USERS_ORGANIZATIONS_INTEGRITY_ZOME: &str = "users_organizations_integrity";

/// `OrganizationMembers`' position in `users_organizations_integrity::LinkTypes`.
/// Checked by a unit test in that crate.
pub const ORGANIZATION_MEMBERS_LINK_TYPE: u8 = 9;

/// `RoleGrant`'s position in `administration_integrity::EntryTypes`, after
/// `Status`. Checked by a unit test in that crate.
pub const ROLE_GRANT_ENTRY_INDEX: u8 = 1;

/// `RoleRevocation`'s position in `administration_integrity::EntryTypes`.
pub const ROLE_REVOCATION_ENTRY_INDEX: u8 = 2;

/// The roles the chain of grants knows so far. Stored on the entry as a string, like
/// `Status.status_type`, so the schema does not change when a role is added.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
  /// Configures and runs the network. Granted by the progenitor key or an admin.
  Admin,
  /// Supports members and handles cases. Granted by an admin or a steward.
  Steward,
  /// An accepted member. Issued when a member is accepted, revoked when they
  /// are rejected or suspended.
  Member,
  /// A coordinator of one organisation; the scope names it.
  OrgCoordinator,
}

impl Display for Role {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.write_str(match self {
      Role::Admin => "admin",
      Role::Steward => "steward",
      Role::Member => "member",
      Role::OrgCoordinator => "org_coordinator",
    })
  }
}

impl FromStr for Role {
  type Err = String;

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    match s {
      "admin" => Ok(Role::Admin),
      "steward" => Ok(Role::Steward),
      "member" => Ok(Role::Member),
      "org_coordinator" => Ok(Role::OrgCoordinator),
      _ => Err(format!("Unknown role: {}", s)),
    }
  }
}

/// What authorised a grant.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Authority {
  /// The progenitor key named in the DNA properties signed this grant's
  /// [`GrantBody`]. The root of every chain; it may grant `admin` only.
  Progenitor { signature: Signature },
  /// The granter's own grant, one step up.
  Grant(ActionHash),
}

/// One agent holding one role in one scope, and what authorised it.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct RoleGrant {
  /// A [`Role`], as its string.
  pub role: String,
  /// The agent who holds the role. Acts carrying this grant are written by
  /// this key, and nobody else.
  pub holder: AgentPubKey,
  /// `None` for the network; an organisation's original action hash for
  /// `org_coordinator`.
  pub scope: Option<ActionHash>,
  pub authority: Authority,
}

impl RoleGrant {
  pub fn body(&self) -> GrantBody {
    GrantBody {
      role: self.role.clone(),
      holder: self.holder.clone(),
      scope: self.scope.clone(),
    }
  }

  pub fn parsed_role(&self) -> Result<Role, String> {
    Role::from_str(&self.role)
  }
}

/// The part of a grant the progenitor signs. Kept as its own struct so the
/// signed bytes are the same on both sides, and so a membrane invite can be
/// signed and verified the same way later.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct GrantBody {
  pub role: String,
  pub holder: AgentPubKey,
  pub scope: Option<ActionHash>,
}

/// A grant withdrawn. The grant stands as a record; acts made while it was
/// held stand. The revoker's own grant must be one that may grant the revoked
/// role.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct RoleRevocation {
  /// The grant withdrawn.
  pub grant: ActionHash,
  /// The revoker's grant.
  pub authority: ActionHash,
  pub reason: String,
}

/// Who may grant what, checked one step up. From the 18 October rulings:
/// the progenitor key grants the first admin (see [`Authority::Progenitor`]);
/// an admin grants admin, steward, member and any organisation's coordinator;
/// a steward grants steward, member, and an organisation's coordinator (its
/// first, on approval); a coordinator grants coordinator for the same
/// organisation.
pub fn may_grant(
  granter: Role,
  granter_scope: &Option<ActionHash>,
  role: Role,
  scope: &Option<ActionHash>,
) -> bool {
  match granter {
    Role::Admin => granter_scope.is_none(),
    Role::Steward => granter_scope.is_none() && role != Role::Admin,
    Role::OrgCoordinator => {
      granter_scope.is_some() && role == Role::OrgCoordinator && scope == granter_scope
    }
    Role::Member => false,
  }
}

/// The integrity zome a network has when it runs the stewarding module.
pub const STEWARDING_INTEGRITY_ZOME: &str = "stewarding_integrity";

/// Whether this DNA includes the stewarding module. Read from the DNA's own
/// zome list, which is fixed at genesis, so every peer gives the same answer.
pub fn stewarding_present() -> ExternResult<bool> {
  Ok(
    dna_info()?
      .zome_names
      .iter()
      .any(|name| name.0.as_ref() == STEWARDING_INTEGRITY_ZOME),
  )
}

/// Whether a role can be held on this network. The steward role comes with
/// the stewarding module and exists nowhere else: a network without it is run
/// by its administrators alone.
pub fn role_available(role: Role, stewarding: bool) -> bool {
  role != Role::Steward || stewarding
}

/// Whether a role needs a scope. Only an organisation's coordinator does.
pub fn scope_fits(role: Role, scope: &Option<ActionHash>) -> bool {
  match role {
    Role::OrgCoordinator => scope.is_some(),
    _ => scope.is_none(),
  }
}

/// What a caller wants to do. `can` turns this into the roles that permit it.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Ability {
  /// Run the network: service types, mediums of exchange, any listing.
  Administer,
  /// Accept, reject or suspend a member or an organisation.
  ChangeStatus,
  /// Post, show interest, agree: what an accepted member does.
  Participate,
  /// Edit an organisation and its membership. The scope names it.
  Coordinate,
  /// Give someone this role.
  Grant(Role),
}

/// The roles that permit an ability. `Grant` is answered by [`may_grant`]
/// instead, because the answer depends on the scope of both grants.
pub fn roles_for(ability: &Ability) -> Vec<Role> {
  match ability {
    Ability::Administer => vec![Role::Admin],
    Ability::ChangeStatus => vec![Role::Admin, Role::Steward],
    Ability::Participate => vec![Role::Member],
    Ability::Coordinate => vec![Role::OrgCoordinator, Role::Admin],
    Ability::Grant(_) => vec![Role::Admin, Role::Steward, Role::OrgCoordinator],
  }
}

/// Whether a grant of `role` in `grant_scope` covers `ability` in `scope`.
/// Network roles cover every scope; an organisation's coordinator covers that
/// organisation only.
pub fn grant_covers(
  role: Role,
  grant_scope: &Option<ActionHash>,
  ability: &Ability,
  scope: &Option<ActionHash>,
) -> bool {
  match ability {
    Ability::Grant(wanted) => may_grant(role, grant_scope, *wanted, scope),
    _ => {
      roles_for(ability).contains(&role)
        && match role {
          Role::OrgCoordinator => grant_scope == scope,
          _ => true,
        }
    }
  }
}

/// Checks a root signature against the progenitor key in the DNA properties.
///
/// `None` when no key is configured: development and Sweettest run that way,
/// and the root is accepted, as Fieldnotes does. That is not a hole, because
/// the properties are part of the DNA hash: a network without a key is a
/// different network from one with it. Every released build carries a key.
///
/// This is the one place the progenitor's signature is checked, so a membrane
/// invite (alpha 3) can be verified here too rather than by a second mechanism.
pub fn root_signature_is_valid<D: Serialize + std::fmt::Debug>(
  signature: &Signature,
  payload: &D,
) -> ExternResult<Option<bool>> {
  match DnaProperties::get_progenitor_pubkey()? {
    None => Ok(None),
    Some(progenitor) => Ok(Some(verify_signature(
      progenitor,
      signature.clone(),
      payload,
    )?)),
  }
}

/// The index of an integrity zome in this DNA, by its name.
fn zome_index_of(zome: &str) -> ExternResult<ZomeIndex> {
  let names = dna_info()?.zome_names;
  let position = names
    .iter()
    .position(|name| name.0.as_ref() == zome)
    .ok_or_else(|| {
      wasm_error!(WasmErrorInner::Guest(format!(
        "{} is not an integrity zome of this DNA",
        zome
      )))
    })?;
  Ok(ZomeIndex(position as u8))
}

fn administration_zome_index() -> ExternResult<ZomeIndex> {
  zome_index_of(ADMINISTRATION_INTEGRITY_ZOME)
}

/// Whether a valid `OrganizationMembers` link admits `author` to `organization`:
/// the link is a record, read with `must_get_valid_record`, whose base is the
/// organisation and whose target is a user entity the author created. What a
/// listing posted on an organisation's behalf carries, since validation
/// cannot look links up and can only follow one it is handed. A link that has
/// since been deleted still reads as valid here, the same limit as a revoked
/// grant: the app refuses, the network cannot see the removal.
pub fn membership_admits(
  link: &ActionHash,
  organization: &ActionHash,
  author: &AgentPubKey,
) -> ExternResult<Result<(), String>> {
  let record = must_get_valid_record(link.clone())?;
  let ActionData::CreateLink(create) = &record.action().data else {
    return Ok(Err("a membership is an OrganizationMembers link".to_string()));
  };
  if create.zome_index != zome_index_of(USERS_ORGANIZATIONS_INTEGRITY_ZOME)?
    || create.link_type != LinkType(ORGANIZATION_MEMBERS_LINK_TYPE)
  {
    return Ok(Err("a membership is an OrganizationMembers link".to_string()));
  }
  if create.base_address != AnyLinkableHash::from(organization.clone()) {
    return Ok(Err("the membership named is in another organisation".to_string()));
  }
  let Some(user) = create.target_address.clone().into_action_hash() else {
    return Ok(Err("the membership named has no member".to_string()));
  };
  match creator_of(&user)? {
    Ok(creator) if &creator == author => Ok(Ok(())),
    Ok(_) => Ok(Err("the membership named is someone else's".to_string())),
    Err(reason) => Ok(Err(reason)),
  }
}

/// Whether an action created an entry of the given type in the administration
/// integrity zome.
fn is_administration_entry(action: &Action, entry_index: u8) -> ExternResult<bool> {
  let Some(EntryType::App(def)) = action.entry_type() else {
    return Ok(false);
  };
  Ok(def.zome_index == administration_zome_index()? && def.entry_index == EntryDefIndex(entry_index))
}

/// A valid `RoleGrant` and the agent who wrote it, or the reason it is not one.
///
/// `must_get_valid_record` returns only records that passed validation, so a
/// grant found here has itself been checked one step up. The entry type is
/// checked against the administration zome's, so a `RoleGrant`-shaped entry
/// from another zome is refused.
pub fn load_grant(hash: &ActionHash) -> ExternResult<Result<(RoleGrant, AgentPubKey), String>> {
  let record = must_get_valid_record(hash.clone())?;
  if !is_administration_entry(record.action(), ROLE_GRANT_ENTRY_INDEX)? {
    return Ok(Err("the grant named is not a role grant".to_string()));
  }
  let grant: RoleGrant = match record.entry().to_app_option() {
    Ok(Some(grant)) => grant,
    Ok(None) => return Ok(Err("the grant named has no entry".to_string())),
    Err(e) => return Ok(Err(format!("the grant named does not read as one: {}", e))),
  };
  Ok(Ok((grant, record.action().author().clone())))
}

/// The check every role-gated write runs: the carried grant exists and is
/// valid, its holder is this act's author, and its role covers this ability in
/// this scope. `Ok(Ok(hash))` is the grant to trust; `Ok(Err(reason))` is the
/// reason to refuse.
pub fn check_act(
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  ability: &Ability,
  scope: &Option<ActionHash>,
) -> ExternResult<Result<ActionHash, String>> {
  let Some(hash) = grant else {
    return Ok(Err(format!("this write needs a grant for {:?}", ability)));
  };
  let (grant, _) = match load_grant(hash)? {
    Ok(found) => found,
    Err(reason) => return Ok(Err(reason)),
  };
  if &grant.holder != author {
    return Ok(Err("the grant carried is held by someone else".to_string()));
  }
  let role = match grant.parsed_role() {
    Ok(role) => role,
    Err(reason) => return Ok(Err(reason)),
  };
  if !grant_covers(role, &grant.scope, ability, scope) {
    return Ok(Err(format!(
      "a {} grant does not cover {:?} here",
      grant.role, ability
    )));
  }
  Ok(Ok(hash.clone()))
}

/// The agent who created an entity: the author of the `Create` at the root of
/// an update chain, reached by following each `Update` back to the action it
/// updated. Every record on the way has passed validation. Bounded by the
/// chain's length.
pub fn creator_of(action_hash: &ActionHash) -> ExternResult<Result<AgentPubKey, String>> {
  Ok(chain_root(action_hash)?.map(|(_, creator)| creator))
}

/// The root of an update chain and its author, reached the same way.
pub fn chain_root(action_hash: &ActionHash) -> ExternResult<Result<(ActionHash, AgentPubKey), String>> {
  let mut current = action_hash.clone();
  loop {
    let record = must_get_valid_record(current.clone())?;
    match &record.action().data {
      ActionData::Create(_) => return Ok(Ok((current, record.action().author().clone()))),
      ActionData::Update(update) => current = update.original_action_address.clone(),
      _ => return Ok(Err("an entity's chain holds creates and updates only".to_string())),
    }
  }
}

/// Whether `author` may change an entity: its creator, or the holder of a
/// grant for `ability`. The creator needs no grant; anyone else carries one.
pub fn check_author_or_act(
  original: &ActionHash,
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  ability: &Ability,
  scope: &Option<ActionHash>,
) -> ExternResult<Result<(), String>> {
  match creator_of(original)? {
    Ok(creator) if &creator == author => return Ok(Ok(())),
    Ok(_) => {}
    Err(reason) => return Ok(Err(reason)),
  }
  Ok(check_act(grant, author, ability, scope)?.map(|_| ()))
}

/// A link tag that carries a grant's hash, and the way back.
pub fn grant_tag(grant: &ActionHash) -> LinkTag {
  LinkTag::new(grant.get_raw_39().to_vec())
}

pub fn grant_from_tag(tag: &LinkTag) -> Result<ActionHash, String> {
  ActionHash::try_from_raw_39(tag.0.clone())
    .map_err(|_| "the link's tag does not carry a grant".to_string())
}

/// Input to the administration coordinator's `revoke_roles_of`.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RevokeRolesOfInput {
  pub holder: AgentPubKey,
  pub role: Role,
  pub scope: Option<ActionHash>,
  pub reason: String,
}

/// Input to the administration coordinator's `grant_role`.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GrantRoleInput {
  pub role: Role,
  pub holder: AgentPubKey,
  pub scope: Option<ActionHash>,
}

/// Input to the administration coordinator's `can`.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CanInput {
  pub agent: AgentPubKey,
  pub ability: Ability,
  pub scope: Option<ActionHash>,
}

/// From another coordinator: the calling agent's grant for an ability, or none.
pub fn can_i(ability: Ability, scope: Option<ActionHash>) -> ExternResult<Option<ActionHash>> {
  external_local_call(
    "can",
    "administration",
    CanInput {
      agent: agent_info()?.agent_initial_pubkey,
      ability,
      scope,
    },
  )
}

/// From another coordinator: the calling agent's grant for an ability, or
/// `Unauthorized`.
pub fn require_grant(ability: Ability, scope: Option<ActionHash>) -> ExternResult<ActionHash> {
  can_i(ability, scope)?.ok_or_else(|| crate::errors::AdministrationError::Unauthorized.into())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn org() -> Option<ActionHash> {
    Some(ActionHash::from_raw_36(vec![1; 36]))
  }

  #[test]
  fn the_steward_role_exists_only_with_the_stewarding_module() {
    assert!(!role_available(Role::Steward, false));
    assert!(role_available(Role::Steward, true));
    for role in [Role::Admin, Role::Member, Role::OrgCoordinator] {
      assert!(role_available(role, false));
      assert!(role_available(role, true));
    }
  }

  #[test]
  fn the_table_of_who_grants_what() {
    assert!(may_grant(Role::Admin, &None, Role::Admin, &None));
    assert!(may_grant(Role::Admin, &None, Role::Steward, &None));
    assert!(may_grant(Role::Admin, &None, Role::Member, &None));
    assert!(may_grant(Role::Admin, &None, Role::OrgCoordinator, &org()));
    assert!(!may_grant(Role::Steward, &None, Role::Admin, &None));
    assert!(may_grant(Role::Steward, &None, Role::Steward, &None));
    assert!(may_grant(Role::Steward, &None, Role::Member, &None));
    assert!(may_grant(Role::Steward, &None, Role::OrgCoordinator, &org()));
    assert!(may_grant(Role::OrgCoordinator, &org(), Role::OrgCoordinator, &org()));
    assert!(!may_grant(
      Role::OrgCoordinator,
      &org(),
      Role::OrgCoordinator,
      &Some(ActionHash::from_raw_36(vec![2; 36]))
    ));
    assert!(!may_grant(Role::OrgCoordinator, &org(), Role::Member, &None));
    assert!(!may_grant(Role::Member, &None, Role::Member, &None));
  }

  #[test]
  fn a_coordinator_covers_their_organisation_only_and_an_admin_covers_all() {
    assert!(grant_covers(Role::OrgCoordinator, &org(), &Ability::Coordinate, &org()));
    assert!(!grant_covers(
      Role::OrgCoordinator,
      &org(),
      &Ability::Coordinate,
      &Some(ActionHash::from_raw_36(vec![2; 36]))
    ));
    assert!(grant_covers(Role::Admin, &None, &Ability::Coordinate, &org()));
    assert!(!grant_covers(Role::Member, &None, &Ability::Coordinate, &org()));
    assert!(grant_covers(Role::Member, &None, &Ability::Participate, &None));
    assert!(!grant_covers(Role::Admin, &None, &Ability::Participate, &None));
    assert!(grant_covers(Role::Steward, &None, &Ability::ChangeStatus, &None));
  }

  #[test]
  fn a_tag_carries_a_grant_there_and_back() {
    let hash = ActionHash::from_raw_36(vec![7; 36]);
    assert_eq!(grant_from_tag(&grant_tag(&hash)), Ok(hash));
    assert!(grant_from_tag(&LinkTag::new(vec![1, 2, 3])).is_err());
  }
}
