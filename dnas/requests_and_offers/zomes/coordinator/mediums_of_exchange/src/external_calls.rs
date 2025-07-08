use hdk::prelude::*;
use utils::{external_local_call, EntityActionHash, EntityAgent};

/// Check if the current agent is an administrator
pub fn check_if_agent_is_administrator(agent_pubkey: AgentPubKey) -> ExternResult<bool> {
  let input = EntityAgent {
    entity: "network".to_string(),
    agent_pubkey,
  };

  external_local_call("check_if_agent_is_administrator", "administration", input)
}

pub fn get_agent_user(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Link>> {
  // The 'users_organizations' zome's 'get_agent_user' extern expects AgentPubKey directly.
  // Passing it directly resolves a deserialization error caused by type mismatch.
  external_local_call("get_agent_user", "users_organizations", agent_pubkey)
}

/// Check if the current agent is an accepted user
pub fn check_if_entity_is_accepted(
  entity: String,
  entity_original_action_hash: ActionHash,
) -> ExternResult<bool> {
  let input = EntityActionHash {
    entity,
    entity_original_action_hash,
  };

  external_local_call("check_if_entity_is_accepted", "administration", input)
}
