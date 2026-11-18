use hdk::prelude::*;
use utils::{external_local_call, EntityActionHash, EntityAgent, OriginalActionHash};

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

/// Whether a `User` is a network administrator, from the `administration` zome.
///
/// Takes the `User`'s original action hash, which is what `send_message` already holds
/// in `to_user`. The entity is always `"network"`: administrators of an organisation
/// are a different thing and do not receive technical reports.
pub fn check_if_entity_is_administrator(
  entity_original_action_hash: ActionHash,
) -> ExternResult<bool> {
  let input = EntityActionHash {
    entity: "network".to_string(),
    entity_original_action_hash: OriginalActionHash(entity_original_action_hash),
  };

  external_local_call("check_if_entity_is_administrator", "administration", input)
}

/// Whether an agent is a network administrator, from the `administration` zome.
///
/// The agent-keyed check, which reads one link base rather than the whole admin list.
/// Used on the reading side, where the caller is known by their agent key.
pub fn check_if_agent_is_administrator(agent_pubkey: AgentPubKey) -> ExternResult<bool> {
  let input = EntityAgent {
    entity: "network".to_string(),
    agent_pubkey,
  };

  external_local_call("check_if_agent_is_administrator", "administration", input)
}
