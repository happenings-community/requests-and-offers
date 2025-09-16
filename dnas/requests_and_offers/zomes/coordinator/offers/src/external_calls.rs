use hdk::prelude::*;
use utils::{
  external_local_call, EntityActionHash, EntityAgent, GetMediumOfExchangeForEntityInput,
  GetServiceTypeForEntityInput, MediumOfExchangeLinkInput, ServiceTypeLinkInput,
  UpdateMediumOfExchangeLinksInput, UpdateServiceTypeLinksInput,
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

pub fn link_to_medium_of_exchange(input: MediumOfExchangeLinkInput) -> ExternResult<()> {
  external_local_call("link_to_medium_of_exchange", "mediums_of_exchange", input)
}

pub fn update_medium_of_exchange_links(
  input: UpdateMediumOfExchangeLinksInput,
) -> ExternResult<()> {
  external_local_call(
    "update_medium_of_exchange_links",
    "mediums_of_exchange",
    input,
  )
}

pub fn delete_all_medium_of_exchange_links_for_entity(
  input: GetMediumOfExchangeForEntityInput,
) -> ExternResult<()> {
  external_local_call(
    "delete_all_medium_of_exchange_links_for_entity",
    "mediums_of_exchange",
    input,
  )
}

pub fn check_if_entity_is_accepted(original_action_hash: EntityActionHash) -> ExternResult<bool> {
  external_local_call(
    "check_if_entity_is_accepted",
    "administration",
    original_action_hash,
  )
}
