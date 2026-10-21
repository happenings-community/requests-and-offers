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
