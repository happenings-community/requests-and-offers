use hdk::prelude::*;

// Exchange preference enum for Requests and Offers
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangePreference {
  Barter,
  Gift,
  Payment,
  Negotiable,
  Other(String),
}

// Contact preference enum for Requests
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ContactPreference {
  AppChat,
  Email,
  Phone,
  Other(String),
}

// Interaction type enum for both Requests and Offers
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InteractionType {
  Virtual,
  InPerson,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ServiceType {
  Testing,
  Editing,
  RustDeveloper,
  HolochainDeveloper,
  FullStackDeveloper,
  UIFrontEndDeveloper,
  BackendDeveloper,
  Mentor,
  Fundraising,
  CommunityManagement,
  SocialMediaMarketing,
  ContentCreation,
  WebsiteReview,
  Other(String),
}

// Date range struct for Request
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
