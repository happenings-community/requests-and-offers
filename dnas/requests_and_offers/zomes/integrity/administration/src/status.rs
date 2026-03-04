use std::str::FromStr;

use chrono::Duration;
use hdi::prelude::*;
use utils::errors::CommonError;

/// Canonical set of status type discriminants used to validate `Status.status_type` strings.
///
/// The `Status` entry stores its type as a plain `String` for serialization compatibility,
/// so this enum is used only for parsing and validation — it is not stored on the DHT.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum StatusType {
  Pending,
  Accepted,
  Rejected,
  Archived,
  SuspendedIndefinitely,
  SuspendedTemporarily,
}

impl FromStr for StatusType {
  type Err = String;

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    match s {
      "pending" => Ok(Self::Pending),
      "accepted" => Ok(Self::Accepted),
      "rejected" => Ok(Self::Rejected),
      "archived" => Ok(Self::Archived),
      "suspended indefinitely" => Ok(Self::SuspendedIndefinitely),
      "suspended temporarily" => Ok(Self::SuspendedTemporarily),
      _ => Err(format!("Invalid status type: {}", s)),
    }
  }
}

/// An HDK entry representing the moderation/lifecycle status of any entity in the network.
///
/// The `status_type` field holds a human-readable string corresponding to one of the
/// [`StatusType`] variants (e.g., `"pending"`, `"accepted"`, `"suspended temporarily"`).
/// It is stored as a `String` rather than the enum to keep the entry schema stable across
/// upgrades without requiring migrations.
///
/// ## Fields
/// - `status_type` — One of the canonical status strings defined in [`StatusType`].
/// - `reason` — Required for any `suspended*` status; `None` for all other states.
/// - `suspended_until` — RFC 3339 timestamp string; only present for `"suspended temporarily"`.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Status {
  pub status_type: String,
  pub reason: Option<String>,
  pub suspended_until: Option<String>,
}

impl Status {
  /// Creates a `Status` in the `"pending"` state — the initial state for all new entities.
  pub fn pending() -> Self {
    Self {
      status_type: "pending".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

  /// Creates a `Status` in the `"accepted"` state.
  pub fn accept() -> Self {
    Self {
      status_type: "accepted".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

  /// Creates a `Status` in the `"rejected"` state.
  pub fn reject() -> Self {
    Self {
      status_type: "rejected".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

  /// Creates a `Status` in the `"archived"` state.
  pub fn archive() -> Self {
    Self {
      status_type: "archived".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

  /// Creates a `Status` in a suspended state.
  ///
  /// - If `time` is `None`, the status is `"suspended indefinitely"` with no expiry.
  /// - If `time` is `Some((duration, now))`, the status is `"suspended temporarily"` and
  ///   `suspended_until` is set to `now + duration` as an RFC 3339 timestamp string.
  ///
  /// A `reason` must be provided and will be stored in both suspension variants.
  pub fn suspend(reason: &str, time: Option<(Duration, &Timestamp)>) -> Self {
    if time.is_some() {
      let duration = time.unwrap().0.num_microseconds().unwrap_or(0);
      let now = time.unwrap().1.as_micros();

      return Self {
        status_type: "suspended temporarily".to_string(),
        reason: Some(reason.to_string()),
        suspended_until: Some(Timestamp::from_micros(now + duration).to_string()),
      };
    }

    Self {
      status_type: "suspended indefinitely".to_string(),
      reason: Some(reason.to_string()),
      suspended_until: None,
    }
  }

  /// Mutates `self` into a suspended state in-place.
  ///
  /// Follows the same `time = None` → indefinite / `time = Some(...)` → temporary logic as
  /// [`Self::suspend`], but updates the existing instance rather than constructing a new one.
  pub fn mut_suspend(&mut self, reason: &str, time: Option<(Duration, &Timestamp)>) {
    if time.is_some() {
      let duration = time.unwrap().0.num_microseconds().unwrap_or(0);
      let now = time.unwrap().1.as_micros();

      self.status_type = "suspended temporarily".to_string();
      self.reason = Some(reason.to_string());
      self.suspended_until = Some(Timestamp::from_micros(now + duration).to_string());
    } else {
      self.status_type = "suspended indefinitely".to_string();
      self.reason = Some(reason.to_string());
      self.suspended_until = None;
    }
  }

  /// Transitions `self` back to `"accepted"` and clears `reason` and `suspended_until`.
  ///
  /// Returns the updated `Status` value (cloned from `self`).
  pub fn unsuspend(&mut self) -> Self {
    self.status_type = "accepted".to_string();
    self.reason = None;
    self.suspended_until = None;

    self.to_owned()
  }

  /// Returns the remaining suspension duration relative to `now`, or `None` if the status
  /// has no `suspended_until` timestamp (i.e., is not a temporary suspension).
  pub fn get_suspension_time_remaining(&self, now: &Timestamp) -> Option<Duration> {
    if let Some(timestamp) = &self.suspended_until {
      return Some(Duration::microseconds(
        Timestamp::from_str(timestamp)
          .unwrap()
          .checked_difference_signed(now)
          .unwrap_or_default()
          .num_microseconds()?,
      ));
    }
    None
  }

  /// Automatically unsuspends `self` if less than 1 hour of suspension time remains.
  ///
  /// Returns `true` if the entity was unsuspended (i.e., the threshold was met), or `false`
  /// if the suspension period has not yet elapsed. For indefinitely suspended entities
  /// (no `suspended_until`), this always returns `false`.
  pub fn unsuspend_if_time_passed(&mut self, now: &Timestamp) -> bool {
    if let Some(time) = self.get_suspension_time_remaining(now) {
      if time.is_zero() || time < Duration::hours(1) {
        self.unsuspend();
        return true;
      }
    }
    false
  }
}

/// Validates that a `Status` entry conforms to the zome's business rules.
///
/// Enforces four rules:
/// 1. `status_type` must match a known [`StatusType`] discriminant string.
/// 2. Any `suspended*` status must include a non-`None` `reason`.
/// 3. `"suspended temporarily"` must have a `suspended_until` timestamp.
/// 4. `"suspended indefinitely"` must NOT have a `suspended_until` timestamp.
pub fn validate_status(status: Status) -> ExternResult<ValidateCallbackResult> {
  if StatusType::from_str(&status.status_type).is_err() {
    return Ok(ValidateCallbackResult::Invalid(format!(
      "Invalid status type: {}",
      status.status_type
    )));
  }

  if status.status_type.starts_with("suspended") && status.reason.is_none() {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Suspended status must have a reason",
    )));
  }

  if status.status_type == "suspended temporarily" && status.suspended_until.is_none() {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Temporarily suspended status must have a timestamp",
    )));
  }

  if status.status_type == "suspended indefinitely" && status.suspended_until.is_some() {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Indefinitely suspended status must not have a timestamp",
    )));
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates a `Status` update. Currently a pass-through stub — update validation is
/// handled by field-level checks in [`validate_status`] applied to the new entry.
pub fn validate_update_user(
  _action: Update,
  _status: Status,
  _original_action: EntryCreationAction,
  _original_status: Status,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

/// Validates a `Status` delete — always returns `Invalid`.
///
/// Status entries are append-only; deletion is not permitted. Use
/// `update_entity_status` in the coordinator to transition to a terminal state.
pub fn validate_delete_status(
  _action: Delete,
  _original_action: EntryCreationAction,
  _original_status: Status,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(String::from(
    "Status cannot be deleted",
  )))
}

/// Validates a `StatusUpdates` link creation by asserting both base and target resolve to
/// valid `Status` entries. This ensures the update chain only links status-to-status.
pub fn validate_create_link_status_updates(
  _action: CreateLink,
  base_address: AnyLinkableHash,
  target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let action_hash = base_address
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("status".to_string()))?;
  let record = must_get_valid_record(action_hash)?;
  let _status: Status = record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("status".to_string()))?;

  // Check the entry type for the given action hash
  let action_hash = target_address
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("status".to_string()))?;
  let record = must_get_valid_record(action_hash)?;
  let _status: Status = record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("status".to_string()))?;

  Ok(ValidateCallbackResult::Valid)
}

/// Validates a `StatusUpdates` link deletion — always returns `Invalid`.
///
/// The status update chain is immutable; links cannot be removed once created.
pub fn validate_delete_link_status_updates(
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(String::from(
    "StatusUpdates links cannot be deleted",
  )))
}
