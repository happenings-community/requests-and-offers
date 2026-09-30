use hdk::prelude::*;
use utils::{external_local_call, EntityActionHash, OriginalActionHash};

/// The `User` links for an agent, from the `users_organizations` zome.
///
/// Empty means the agent has no profile, which is not the same as having one that is
/// not accepted. Both refuse a send, with different errors.
pub fn get_agent_user(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Link>> {
  external_local_call("get_agent_user", "users_organizations", agent_pubkey)
}

/// Every agent key belonging to one `User`.
///
/// A member may run more than one device, and each has its own key. A message is
/// encrypted once per agent, because the encryption is to an agent key rather than to
/// a person.
pub fn get_user_agents(user_original_action_hash: ActionHash) -> ExternResult<Vec<AgentPubKey>> {
  external_local_call(
    "get_user_agents",
    "users_organizations",
    user_original_action_hash,
  )
}

/// Whether an entity's status is accepted, from the `administration` zome.
pub fn check_if_entity_is_accepted(
  entity: String,
  entity_original_action_hash: ActionHash,
) -> ExternResult<bool> {
  let input = EntityActionHash {
    entity,
    entity_original_action_hash: OriginalActionHash(entity_original_action_hash),
  };

  external_local_call("check_if_entity_is_accepted", "administration", input)
}
