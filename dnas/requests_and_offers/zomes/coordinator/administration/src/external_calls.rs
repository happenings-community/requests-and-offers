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
