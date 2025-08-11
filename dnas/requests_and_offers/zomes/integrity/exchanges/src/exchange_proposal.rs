use hdi::prelude::*;

/// Exchange proposal status enum - simplified for basic workflow
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ProposalStatus {
  Pending,
  Approved, // Changed from "Accepted" to match simplified plan
  Rejected,
}

// Removed ProposalType - simplified to single response pattern

/// Exchange proposal entity - simplified for basic workflow
/// Pure entry with relationships managed via DHT links
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ExchangeProposal {
  /// Service details being proposed
  pub service_details: String,

  /// Proposed terms and conditions
  pub terms: String,

  /// Proposed exchange medium (e.g., "USD", "CAD", "Hours", "Favor")
  pub exchange_medium: String,

  /// Proposed value/amount
  pub exchange_value: Option<String>,

  /// Expected delivery timeframe
  pub delivery_timeframe: Option<String>,

  /// Additional notes or context
  pub notes: Option<String>,

  /// Current status of the proposal
  pub status: ProposalStatus,

  /// When the proposal was created
  pub created_at: Timestamp,

  /// When the proposal was last updated
  pub updated_at: Timestamp,
}

impl ExchangeProposal {
  /// Create a new exchange proposal - simplified single type
  pub fn new(
    service_details: String,
    terms: String,
    exchange_medium: String,
    exchange_value: Option<String>,
    delivery_timeframe: Option<String>,
    notes: Option<String>,
    created_at: Timestamp,
  ) -> Self {
    Self {
      service_details,
      terms,
      exchange_medium,
      exchange_value,
      delivery_timeframe,
      notes,
      status: ProposalStatus::Pending,
      created_at,
      updated_at: created_at,
    }
  }

  /// Update proposal status
  pub fn update_status(&mut self, new_status: ProposalStatus, updated_at: Timestamp) {
    self.status = new_status;
    self.updated_at = updated_at;
  }

  /// Check if proposal is still pending
  pub fn is_pending(&self) -> bool {
    self.status == ProposalStatus::Pending
  }
}

/// Input for creating an exchange proposal - simplified for basic workflow
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateExchangeProposalInput {
  pub target_entity_hash: ActionHash, // The request or offer being responded to
  pub service_details: String,
  pub terms: String,
  pub exchange_medium: String,
  pub exchange_value: Option<String>,
  pub delivery_timeframe: Option<String>,
  pub notes: Option<String>,
}

/// Input for updating proposal status
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateProposalStatusInput {
  pub proposal_hash: ActionHash,
  pub new_status: ProposalStatus,
  pub reason: Option<String>,
}
