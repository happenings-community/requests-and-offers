use hdi::prelude::*;

// MediumOfExchange Entry Definition
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct MediumOfExchange {
  /// Unique identifier (e.g., 'EUR', 'USD', 'TIME', 'LOCAL')
  pub code: String,
  /// Human-readable name (e.g., 'Euro', 'US Dollar', 'Time Banking', 'Local Currency')
  pub name: String,
  /// Detailed description of the medium of exchange
  pub description: Option<String>,
  /// Exchange type: "base" (foundational categories) or "currency" (specific monetary units)
  pub exchange_type: String,
  /// ID of corresponding hREA ResourceSpecification (only for approved)
  pub resource_spec_hrea_id: Option<String>,
  /// The grant this write rests on: an admin grant held by the
  /// author, or for a suggestion, a member grant.
  #[serde(default)]
  pub grant: Option<ActionHash>,
}
