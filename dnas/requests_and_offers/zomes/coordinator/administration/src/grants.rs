//! The chain of grants, written and read: `grant_role`, `revoke_role` and
//! `can`, which every other coordinator reaches through `external_calls`.
//!
//! The entries and their validation are in `administration_integrity` and
//! `utils::grants`. This file is the app's side: it decides what authority a
//! new grant rests on, writes the grant with its index links, and answers
//! "does this agent hold a grant that covers this act?" with the grant's hash,
//! which the caller attaches to the write it is about to make.
//!
//! `can` lives here, in the administration zome, because the grants and their
//! index links are this zome's types and one reader keeps one source of truth.

use administration_integrity::*;
use hdk::prelude::*;
use utils::{
  errors::{AdministrationError, CommonError},
  grants::{
    grant_covers, grant_tag, Ability, Authority, CanInput, GrantBody, GrantRoleInput,
    RevokeRolesOfInput, Role, RoleGrant, RoleRevocation,
  },
  DnaProperties,
};

fn my_pubkey() -> ExternResult<AgentPubKey> {
  Ok(agent_info()?.agent_initial_pubkey)
}

fn links_from(base: impl Into<AnyLinkableHash>, link_type: LinkTypes) -> ExternResult<Vec<Link>> {
  let filter = link_type
    .try_into_filter()
    .map_err(|e| CommonError::LinkError(e.to_string()))?;
  get_links(LinkQuery::new(base.into(), filter), GetStrategy::Network)
}

fn grant_at(hash: &ActionHash) -> ExternResult<RoleGrant> {
  let record = get(hash.clone(), GetOptions::default())?
    .ok_or_else(|| CommonError::RecordNotFound("grant".to_string()))?;
  record
    .entry()
    .to_app_option::<RoleGrant>()
    .map_err(|_| CommonError::InvalidData("grant".to_string()))?
    .ok_or_else(|| CommonError::EntryNotFound("grant".to_string()).into())
}

fn is_revoked(grant: &ActionHash) -> ExternResult<bool> {
  Ok(!links_from(grant.clone(), LinkTypes::GrantRevocations)?.is_empty())
}

/// Every grant an agent holds that has not been revoked, newest last.
///
/// Read-side, and the whole of the read side: validation can prove a grant
/// exists and cannot prove that no revocation names it, so the reader leaves
/// out a revoked grant. It does not ask whether the grant *beneath* this one
/// has since been revoked. What a holder gave while they held a role stands
/// when they lose it; a grant written after that, by a modified client, is
/// valid and is returned. That limit is stated in the spec.
pub fn live_grants_of(agent: &AgentPubKey) -> ExternResult<Vec<(ActionHash, RoleGrant)>> {
  let mut links = links_from(agent.clone(), LinkTypes::AgentGrants)?;
  links.sort_by_key(|link| link.timestamp);
  let mut grants = Vec::new();
  for link in links {
    let Some(hash) = link.target.into_action_hash() else {
      continue;
    };
    if is_revoked(&hash)? {
      continue;
    }
    grants.push((hash.clone(), grant_at(&hash)?));
  }
  Ok(grants)
}

/// The agents who hold a live network administrator grant, read from the
/// grants themselves through the `AllGrants` index.
///
/// The roster links cannot answer this. `revoke_role` ends a role without
/// touching them and `grant_role` gives one without writing them, so a count
/// of roster links can say two where one administrator is left, or none where
/// there is one (found on the home server run of 12 November).
pub fn live_administrators() -> ExternResult<HashSet<AgentPubKey>> {
  let mut holders = HashSet::new();
  for link in links_from(
    Path::from(format!("grants.{}", Role::Admin)).path_entry_hash()?,
    LinkTypes::AllGrants,
  )? {
    let Some(hash) = link.target.into_action_hash() else {
      continue;
    };
    let grant = grant_at(&hash)?;
    if grant.parsed_role() != Ok(Role::Admin) || grant.scope.is_some() || holders.contains(&grant.holder) {
      continue;
    }
    if !is_revoked(&hash)? {
      holders.insert(grant.holder);
    }
  }
  Ok(holders)
}

/// Whether any agent holds a live network administrator grant. `create_user`
/// asks this before offering the first user the root on a network with no
/// progenitor key, so it and [`authority_for`] cannot disagree.
#[hdk_extern]
pub fn is_there_an_administrator(_: ()) -> ExternResult<bool> {
  Ok(!live_administrators()?.is_empty())
}

/// Refuses an act that would leave the network with no administrator.
///
/// The one place the rule lives: `remove_administrator` asks it for everyone
/// it is about to remove, and `revoke_role` for the holder of an admin grant
/// it is about to withdraw, so the public extern cannot go round it.
pub fn refuse_to_leave_no_administrator(leaving: &[AgentPubKey]) -> ExternResult<()> {
  let live = live_administrators()?;
  if live.iter().all(|holder| leaving.contains(holder)) {
    return Err(AdministrationError::LastAdmin.into());
  }
  Ok(())
}

/// The agent's grant that covers an ability in a scope, or none. The app's one
/// permission question: every coordinator check asks this and attaches the
/// answer to its write.
pub fn can_local(
  agent: &AgentPubKey,
  ability: &Ability,
  scope: &Option<ActionHash>,
) -> ExternResult<Option<ActionHash>> {
  for (hash, grant) in live_grants_of(agent)? {
    let Ok(role) = grant.parsed_role() else {
      continue;
    };
    if grant_covers(role, &grant.scope, ability, scope) {
      return Ok(Some(hash));
    }
  }
  Ok(None)
}

/// The agent's grant that covers an ability in a scope, or none.
#[hdk_extern]
pub fn can(input: CanInput) -> ExternResult<Option<ActionHash>> {
  can_local(&input.agent, &input.ability, &input.scope)
}

/// The calling agent's grant for an ability, or `Unauthorized`.
pub fn require(ability: Ability, scope: Option<ActionHash>) -> ExternResult<ActionHash> {
  can_local(&my_pubkey()?, &ability, &scope)?.ok_or_else(|| AdministrationError::Unauthorized.into())
}

/// What a new grant by the caller rests on: the caller's own grant that may
/// give this role, or, for the first administrators, the progenitor's signature
/// over the grant's body. The root is open to the progenitor key, and, where
/// no key is configured, to the first user while no agent holds a live admin grant:
/// the bootstrap `add_administrator` has always had.
pub fn authority_for(role: Role, scope: &Option<ActionHash>, holder: &AgentPubKey) -> ExternResult<Authority> {
  let me = my_pubkey()?;
  if let Some(grant) = can_local(&me, &Ability::Grant(role), scope)? {
    return Ok(Authority::Grant(grant));
  }
  if role == Role::Admin {
    let progenitor_configured = DnaProperties::get_progenitor_pubkey()?.is_some();
    let bootstrap = !progenitor_configured && live_administrators()?.is_empty();
    if utils::check_if_progenitor()? || bootstrap {
      let body = GrantBody {
        role: role.to_string(),
        holder: holder.clone(),
        scope: scope.clone(),
      };
      let signature = sign(me, &body)?;
      return Ok(Authority::Progenitor { signature });
    }
  }
  Err(AdministrationError::Unauthorized.into())
}

/// Writes a grant and its two index links. The caller has settled the
/// authority with [`authority_for`] or holds one already.
pub fn write_grant(
  role: Role,
  holder: AgentPubKey,
  scope: Option<ActionHash>,
  authority: Authority,
) -> ExternResult<ActionHash> {
  let grant = RoleGrant {
    role: role.to_string(),
    holder: holder.clone(),
    scope,
    authority,
  };
  let hash = create_entry(&EntryTypes::RoleGrant(grant))?;
  create_link(holder, hash.clone(), LinkTypes::AgentGrants, grant_tag(&hash))?;
  create_link(
    Path::from(format!("grants.{}", role)).path_entry_hash()?,
    hash.clone(),
    LinkTypes::AllGrants,
    grant_tag(&hash),
  )?;
  Ok(hash)
}

/// Gives an agent a role, resting on the caller's authority. Returns the grant
/// already held if there is one, so a second grant is never written for the
/// same role and scope.
#[hdk_extern]
pub fn grant_role(input: GrantRoleInput) -> ExternResult<ActionHash> {
  // The caller's authority first: who holds what is not told to someone who may not grant it.
  let authority = authority_for(input.role, &input.scope, &input.holder)?;
  if let Some(existing) = live_grants_of(&input.holder)?
    .into_iter()
    .find(|(_, g)| g.parsed_role() == Ok(input.role) && g.scope == input.scope)
  {
    return Ok(existing.0);
  }
  write_grant(input.role, input.holder, input.scope, authority)
}

/// Input for `revoke_role`.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RevokeRoleInput {
  pub grant: ActionHash,
  pub reason: String,
}

/// Withdraws a grant. The caller needs a grant that could have given the role
/// (`may_grant`); the revocation names it. The grant stands as a record and
/// `can` stops returning it.
#[hdk_extern]
pub fn revoke_role(input: RevokeRoleInput) -> ExternResult<ActionHash> {
  if is_revoked(&input.grant)? {
    return Err(CommonError::InvalidData("that grant is already revoked".to_string()).into());
  }
  let grant = grant_at(&input.grant)?;
  let role = grant
    .parsed_role()
    .map_err(CommonError::InvalidData)?;
  let authority = require(Ability::Grant(role), grant.scope.clone())?;
  if role == Role::Admin && grant.scope.is_none() {
    // Only when this is the holder's last live admin grant does the holder leave.
    let holds_another = live_grants_of(&grant.holder)?.into_iter().any(|(hash, other)| {
      hash != input.grant && other.parsed_role() == Ok(Role::Admin) && other.scope.is_none()
    });
    if !holds_another {
      refuse_to_leave_no_administrator(std::slice::from_ref(&grant.holder))?;
    }
  }
  let hash = create_entry(&EntryTypes::RoleRevocation(RoleRevocation {
    grant: input.grant.clone(),
    authority,
    reason: input.reason,
  }))?;
  create_link(input.grant, hash.clone(), LinkTypes::GrantRevocations, ())?;
  Ok(hash)
}

/// Withdraws every live grant of one role an agent holds in a scope. Returns
/// how many were revoked.
pub fn revoke_all(
  holder: &AgentPubKey,
  role: Role,
  scope: &Option<ActionHash>,
  reason: &str,
) -> ExternResult<usize> {
  let mut revoked = 0;
  for (hash, grant) in live_grants_of(holder)? {
    if grant.parsed_role() == Ok(role) && &grant.scope == scope {
      revoke_role(RevokeRoleInput {
        grant: hash,
        reason: reason.to_string(),
      })?;
      revoked += 1;
    }
  }
  Ok(revoked)
}

/// Withdraws every live grant of one role an agent holds in a scope, for another
/// zome: an organisation removing a coordinator. Returns how many were revoked.
#[hdk_extern]
pub fn revoke_roles_of(input: RevokeRolesOfInput) -> ExternResult<usize> {
  revoke_all(&input.holder, input.role, &input.scope, &input.reason)
}

/// Every live grant an agent holds, as records, for the interface.
#[hdk_extern]
pub fn get_agent_grants(agent: AgentPubKey) -> ExternResult<Vec<Record>> {
  live_grants_of(&agent)?
    .into_iter()
    .map(|(hash, _)| {
      get(hash, GetOptions::default())?
        .ok_or_else(|| CommonError::RecordNotFound("grant".to_string()).into())
    })
    .collect()
}

/// Every grant of a role ever written, revoked ones included, for the record.
#[hdk_extern]
pub fn get_all_grants_for_role(role: Role) -> ExternResult<Vec<Record>> {
  links_from(
    Path::from(format!("grants.{}", role)).path_entry_hash()?,
    LinkTypes::AllGrants,
  )?
  .into_iter()
  .filter_map(|link| link.target.into_action_hash())
  .map(|hash| {
    get(hash, GetOptions::default())?
      .ok_or_else(|| CommonError::RecordNotFound("grant".to_string()).into())
  })
  .collect()
}
