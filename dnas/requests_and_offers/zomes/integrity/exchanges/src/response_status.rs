use hdi::prelude::*;
use crate::ExchangeResponseStatus;

/// Response status entry - tracks status changes with reasons and timestamps
/// Following the pattern from administration/status.rs
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ResponseStatus {
  /// The status being set
  pub status: ExchangeResponseStatus,
  
  /// Optional reason for the status change
  pub reason: Option<String>,
  
  /// When this status was set
  pub updated_at: Timestamp,
  
  /// Who set this status
  pub updated_by: AgentPubKey,
}

impl ResponseStatus {
  /// Create a new pending status (used when response is first created)
  pub fn new_pending(updated_by: AgentPubKey, updated_at: Timestamp) -> Self {
    Self {
      status: ExchangeResponseStatus::Pending,
      reason: None,
      updated_at,
      updated_by,
    }
  }

  /// Create a new approved status
  pub fn new_approved(
    reason: Option<String>,
    updated_by: AgentPubKey,
    updated_at: Timestamp,
  ) -> Self {
    Self {
      status: ExchangeResponseStatus::Approved,
      reason,
      updated_at,
      updated_by,
    }
  }

  /// Create a new rejected status
  pub fn new_rejected(
    reason: Option<String>,
    updated_by: AgentPubKey,
    updated_at: Timestamp,
  ) -> Self {
    Self {
      status: ExchangeResponseStatus::Rejected,
      reason,
      updated_at,
      updated_by,
    }
  }

  /// Check if this is a pending status
  pub fn is_pending(&self) -> bool {
    self.status == ExchangeResponseStatus::Pending
  }

  /// Check if this is an approved status
  pub fn is_approved(&self) -> bool {
    self.status == ExchangeResponseStatus::Approved
  }

  /// Check if this is a rejected status
  pub fn is_rejected(&self) -> bool {
    self.status == ExchangeResponseStatus::Rejected
  }
}