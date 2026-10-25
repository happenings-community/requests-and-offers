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

/// A role holder's decision on a medium of exchange: approved, rejected or retired.
///
/// A medium of exchange is shared: others rely on it once it is approved. So a decision
/// never edits it and never tombstones it. It is a new entry, signed by the
/// administrator and carrying their grant, and the latest one stands (#234).
/// A medium of exchange with no status entry is pending.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct MediumOfExchangeStatus {
  /// The original record of the medium of exchange decided on.
  pub medium_of_exchange: ActionHash,
  pub state: utils::links::CatalogueState,
  /// The administrator's grant this decision rests on.
  pub grant: Option<ActionHash>,
}
