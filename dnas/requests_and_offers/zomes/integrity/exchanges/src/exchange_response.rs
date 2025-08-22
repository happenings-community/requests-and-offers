use hdi::prelude::*;

/// Exchange response status enum - simplified for basic workflow
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangeResponseStatus {
  Pending,
  Approved, // Changed from "Accepted" to match simplified plan
  Rejected,
}

// Removed ExchangeResponseType - simplified to single response pattern

/// Exchange response entity - simplified for basic workflow
/// Pure entry with relationships managed via DHT links
/// Status is now managed separately via ResponseStatus entries
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ExchangeResponse {
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

  /// When the proposal was created
  pub created_at: Timestamp,

  /// When the proposal was last updated
  pub updated_at: Timestamp,
}

impl ExchangeResponse {
  /// Create a new exchange response - simplified single type
  /// Status is managed separately via ResponseStatus entries
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
      created_at,
      updated_at: created_at,
    }
  }

  /// Update the response content (not status - that's handled by ResponseStatus entries)
  pub fn update_content(&mut self, updated_at: Timestamp) {
    self.updated_at = updated_at;
  }
}

/// Input for creating an exchange response - simplified for basic workflow
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateExchangeResponseInput {
  pub target_entity_hash: ActionHash, // The request or offer being responded to
  pub service_details: String,
  pub terms: String,
  pub exchange_medium: String,
  pub exchange_value: Option<String>,
  pub delivery_timeframe: Option<String>,
  pub notes: Option<String>,
}

/// Input for updating response status
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateExchangeResponseStatusInput {
  pub response_hash: ActionHash,
  pub new_status: ExchangeResponseStatus,
  pub reason: Option<String>,
}
