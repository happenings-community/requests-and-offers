use hdk::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangePreference {
  Exchange,
  Arranged,
  PayItForward,
  Open,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ContactPreference {
  // AppChat,
  Email,
  Phone,
  Other,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InteractionType {
  Virtual,
  InPerson,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TimePreference {
  Morning,
  Afternoon,
  Evening,
  NoPreference,
  Other,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DateRange {
  pub start: Option<Timestamp>,
  pub end: Option<Timestamp>,
}

// Type alias for TimeZone
pub type TimeZone = String;

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
