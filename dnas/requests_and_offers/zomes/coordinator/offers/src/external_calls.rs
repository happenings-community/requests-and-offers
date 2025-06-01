use hdk::prelude::*;
use utils::{
  external_local_call, EntityAgent, GetServiceTypeForEntityInput, ServiceTypeLinkInput,
  UpdateServiceTypeLinksInput,
};

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

pub fn link_to_service_type(input: ServiceTypeLinkInput) -> ExternResult<()> {
  external_local_call("link_to_service_type", "service_types", input)
}

pub fn update_service_type_links(input: UpdateServiceTypeLinksInput) -> ExternResult<()> {
  external_local_call("update_service_type_links", "service_types", input)
}

pub fn delete_all_service_type_links_for_entity(
  input: GetServiceTypeForEntityInput,
) -> ExternResult<()> {
  external_local_call(
    "delete_all_service_type_links_for_entity",
    "service_types",
    input,
  )
}
