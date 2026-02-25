use hdk::prelude::*;

/// The ActionHash of the original Create action — immutable entity identifier.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct OriginalActionHash(pub ActionHash);

impl From<OriginalActionHash> for ActionHash {
  fn from(val: OriginalActionHash) -> Self {
    val.0
  }
}

impl From<OriginalActionHash> for AnyDhtHash {
  fn from(val: OriginalActionHash) -> Self {
    val.0.into()
  }
}

impl From<OriginalActionHash> for AnyLinkableHash {
  fn from(val: OriginalActionHash) -> Self {
    val.0.into()
  }
}

/// The ActionHash of the most recent action in the update chain.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct PreviousActionHash(pub ActionHash);

impl From<PreviousActionHash> for ActionHash {
  fn from(val: PreviousActionHash) -> Self {
    val.0
  }
}

impl From<PreviousActionHash> for AnyDhtHash {
  fn from(val: PreviousActionHash) -> Self {
    val.0.into()
  }
}

impl From<PreviousActionHash> for AnyLinkableHash {
  fn from(val: PreviousActionHash) -> Self {
    val.0.into()
  }
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
  pub entity_original_action_hash: OriginalActionHash,
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
  pub entity_original_action_hash: OriginalActionHash,
  pub agent_pubkeys: Vec<AgentPubKey>,
}

/// Input for getting an organization's user
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrganizationUserInput {
  pub organization_original_action_hash: OriginalActionHash,
  pub user_original_action_hash: OriginalActionHash,
}

/// Input for setting an organization contact with a role
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrganizationContactInput {
  pub organization_original_action_hash: OriginalActionHash,
  pub user_original_action_hash: OriginalActionHash,
  pub role: String,
}

/// Input for getting a service type for an entity
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GetServiceTypeForEntityInput {
  pub original_action_hash: OriginalActionHash,
  pub entity: String,
}

/// Input for linking/unlinking a service type to/from a request or offer
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeLinkInput {
  pub service_type_hash: OriginalActionHash,
  pub action_hash: OriginalActionHash,
  pub entity: String,
}

/// Input for updating service type links for a request or offer
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateServiceTypeLinksInput {
  pub action_hash: OriginalActionHash,
  pub entity: String,
  pub new_service_type_hashes: Vec<ActionHash>,
}

/// Input for getting a medium of exchange for an entity
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GetMediumOfExchangeForEntityInput {
  pub original_action_hash: OriginalActionHash,
  pub entity: String,
}

/// Input for linking/unlinking a medium of exchange to/from a request or offer
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MediumOfExchangeLinkInput {
  pub medium_of_exchange_hash: OriginalActionHash,
  pub action_hash: OriginalActionHash,
  pub entity: String,
}

/// Input for updating medium of exchange links for a request or offer
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateMediumOfExchangeLinksInput {
  pub action_hash: OriginalActionHash,
  pub entity: String,
  pub new_medium_of_exchange_hashes: Vec<ActionHash>,
}
