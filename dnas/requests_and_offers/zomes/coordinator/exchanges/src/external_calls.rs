use hdk::prelude::*;
use utils::{external_local_call, EntityActionHash, OriginalActionHash};

/// The user record links for an agent. Used for the caller's own user and
/// for the other party's; both go through the extern, which reads the
/// network (see #237 for the self-lookup case).
pub fn get_agent_user(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Link>> {
  external_local_call("get_agent_user", "users_organizations", agent_pubkey)
}

/// Whether an entity has accepted status.
pub fn check_if_entity_is_accepted(entity_type: String, entity_hash: ActionHash) -> ExternResult<bool> {
  let input = EntityActionHash {
    entity: entity_type,
    entity_original_action_hash: OriginalActionHash(entity_hash),
  };
  external_local_call("check_if_entity_is_accepted", "administration", input)
}
