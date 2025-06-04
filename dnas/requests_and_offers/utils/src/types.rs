use hdk::prelude::*;

/// Input for an exchange preference
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangePreference {
  Exchange,
  Arranged,
  PayItForward,
  Open(),
}

/// Input for a contact preference
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ContactPreference {
  // AppChat,
  Email,
  Phone,
  Other(String),
}

/// Input for an interaction type
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InteractionType {
  Virtual,
  InPerson,
}

/// Input for a time preference
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TimePreference {
  Morning,
  Afternoon,
  Evening,
  NoPreference,
  Other(String),
}

/// Input for a date range
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DateRange {
  pub start: Option<Timestamp>,
  pub end: Option<Timestamp>,
}

// Type alias for TimeZone
pub type TimeZone = String;

/// Input for getting an entity's original action hash
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EntityActionHash {
  pub entity: String,
  pub entity_original_action_hash: ActionHash,
}

/// Input for getting an agent's user
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EntityAgent {
  pub entity: String,
  pub agent_pubkey: AgentPubKey,
}

/// Input for getting an entity's original action hash and agents
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EntityActionHashAgents {
  pub entity: String,
  pub entity_original_action_hash: ActionHash,
  pub agent_pubkeys: Vec<AgentPubKey>,
}

/// Input for getting an organization's user
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrganizationUser {
  pub organization_original_action_hash: ActionHash,
  pub user_original_action_hash: ActionHash,
}

/// Input for getting a service type for an entity
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GetServiceTypeForEntityInput {
  pub original_action_hash: ActionHash,
  pub entity: String,
}

/// Input for linking/unlinking a service type to/from a request or offer
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeLinkInput {
  pub service_type_hash: ActionHash,
  pub action_hash: ActionHash,
  pub entity: String,
}

/// Input for updating service type links for a request or offer
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateServiceTypeLinksInput {
  pub action_hash: ActionHash,
  pub entity: String,
  pub new_service_type_hashes: Vec<ActionHash>,
}
