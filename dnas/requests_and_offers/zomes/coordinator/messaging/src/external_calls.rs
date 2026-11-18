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

/// The agents who hold a live network administrator grant, read from the grants by the
/// `administration` zome.
///
/// Since #377 an administrator is whoever holds a live admin grant, and this is that list.
/// The roster links (`get_all_administrators_links`) are not: `revoke_role` leaves a
/// revoked administrator on them, and anyone may tombstone one, so reading them sent role
/// messages to former administrators and let any member empty the list.
pub fn get_live_administrator_agents() -> ExternResult<Vec<AgentPubKey>> {
  external_local_call("get_live_administrator_agents", "administration", ())
}
