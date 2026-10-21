//! Calls into the `users_organizations` zome, for the grants a status change
//! issues: a member's agents, an organisation's creator, and the coordinator
//! link an approval writes.

use hdk::prelude::*;
use utils::external_local_call;

/// The agents behind a user entity.
pub fn get_user_agents(user_original_action_hash: ActionHash) -> ExternResult<Vec<AgentPubKey>> {
  external_local_call(
    "get_user_agents",
    "users_organizations",
    user_original_action_hash,
  )
}

/// The user entity behind an agent, as links.
pub fn get_agent_user(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Link>> {
  external_local_call("get_agent_user", "users_organizations", agent_pubkey)
}

/// Input for `register_approved_coordinator` in `users_organizations`.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ApprovedCoordinatorInput {
  pub organization_original_action_hash: ActionHash,
  pub user_original_action_hash: ActionHash,
  pub grant: ActionHash,
}

/// Writes the coordinator link an approval creates, carrying the grant.
pub fn register_approved_coordinator(input: ApprovedCoordinatorInput) -> ExternResult<bool> {
  external_local_call(
    "register_approved_coordinator",
    "users_organizations",
    input,
  )
}
