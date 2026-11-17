//! TEST ONLY: raw link writes against the users_organizations integrity zome.
//! See Cargo.toml.
//!
//! Every function here skips the checks the real coordinator makes and hands
//! the link straight to validation, which is the only thing that decides
//! whether it is accepted.

use hdk::prelude::*;
use users_organizations_integrity::*;

#[derive(Serialize, Deserialize, Debug)]
pub struct ProbeUserAgentsLink {
  /// The User the agent is linked to: any hash, so a base that is not a User's create can be tried.
  pub user: AnyLinkableHash,
  pub agent: AgentPubKey,
}

/// A `UserAgents` link from any User to any agent.
#[hdk_extern]
pub fn probe_create_user_agents_link(input: ProbeUserAgentsLink) -> ExternResult<ActionHash> {
  create_link(input.user, input.agent, LinkTypes::UserAgents, ())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProbeMyUserLink {
  pub agent: AgentPubKey,
  /// The User the agent claims as its own: any hash.
  pub user: AnyLinkableHash,
}

/// A `MyUser` link from any agent to any User.
#[hdk_extern]
pub fn probe_create_my_user_link(input: ProbeMyUserLink) -> ExternResult<ActionHash> {
  create_link(input.agent, input.user, LinkTypes::MyUser, ())
}

/// Deletes any link by its create action, whoever wrote it.
#[hdk_extern]
pub fn probe_delete_link(create_link_hash: ActionHash) -> ExternResult<ActionHash> {
  delete_link(create_link_hash, GetOptions::default())
}

/// An update of any User, by whoever calls it, carrying the same profile: integrity does not tie an update's
/// author to the original's, so this is how a revision of someone else's User comes to exist.
#[hdk_extern]
pub fn probe_update_user(original: ActionHash) -> ExternResult<ActionHash> {
  let record = get(original.clone(), GetOptions::default())?
    .ok_or(wasm_error!(WasmErrorInner::Guest("no such User".into())))?;
  let user: User = record
    .entry()
    .to_app_option()
    .map_err(|e| wasm_error!(e))?
    .ok_or(wasm_error!(WasmErrorInner::Guest("not a User".into())))?;
  update_entry(original, &EntryTypes::User(user))
}
