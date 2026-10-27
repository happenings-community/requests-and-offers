use hdi::prelude::*;

// ServiceType Entry Definition
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
  pub name: String,
  pub description: String,
  pub technical: bool, // true for technical services, false for non-technical
  /// The grant this write rests on: an admin grant held by the
  /// author, or for a suggestion, a member grant.
  #[serde(default)]
  pub grant: Option<ActionHash>,
}

/// A role holder's decision on a service type: approved, rejected or retired.
///
/// A service type is shared: others rely on it once it is approved. So a decision
/// never edits it and never tombstones it. It is a new entry, signed by the
/// administrator and carrying their grant, and the latest one stands (#234).
/// A service type with no status entry is pending.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceTypeStatus {
  /// The original record of the service type decided on.
  pub service_type: ActionHash,
  pub state: utils::links::CatalogueState,
  /// The administrator's grant this decision rests on.
  pub grant: Option<ActionHash>,
}
