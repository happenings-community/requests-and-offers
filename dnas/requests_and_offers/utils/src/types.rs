use hdk::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EntityActionHash {
  pub entity: String,
  pub entity_original_action_hash: ActionHash,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EntityAgent {
  pub entity: String,
  pub agent_pubkey: AgentPubKey,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EntityActionHashAgents {
  pub entity: String,
  pub entity_original_action_hash: ActionHash,
  pub agent_pubkeys: Vec<AgentPubKey>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrganizationUser {
  pub organization_original_action_hash: ActionHash,
  pub user_original_action_hash: ActionHash,
}
