use hdk::prelude::*;
use utils::{external_local_call, EntityAgent};

pub fn get_agent_user(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Link>> {
  external_local_call("get_agent_user", "users_organizations", agent_pubkey)
}

pub fn check_if_agent_is_administrator(agent_pubkey: AgentPubKey) -> ExternResult<bool> {
  let input = EntityAgent {
    entity: "network".to_string(),
    agent_pubkey,
  };

  external_local_call("check_if_agent_is_administrator", "administration", input)
}
