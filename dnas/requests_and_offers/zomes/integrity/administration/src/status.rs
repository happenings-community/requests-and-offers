use std::str::FromStr;

use chrono::Duration;
use hdi::prelude::*;
use utils::errors::CommonError;

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

#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Status {
  pub status_type: String,
  pub reason: Option<String>,
  pub suspended_until: Option<String>,
}

impl Status {
  pub fn pending() -> Self {
    Self {
      status_type: "pending".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

  pub fn accept() -> Self {
    Self {
      status_type: "accepted".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

  pub fn reject() -> Self {
    Self {
      status_type: "rejected".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

  pub fn archive() -> Self {
    Self {
      status_type: "archived".to_string(),
      reason: None,
      suspended_until: None,
    }
  }

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

  pub fn unsuspend(&mut self) -> Self {
    self.status_type = "accepted".to_string();
    self.reason = None;
    self.suspended_until = None;

    self.to_owned()
  }

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

pub fn validate_update_user(
  _action: Update,
  _status: Status,
  _original_action: EntryCreationAction,
  _original_status: Status,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_status(
  _action: Delete,
  _original_action: EntryCreationAction,
  _original_status: Status,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(String::from(
    "Status cannot be deleted",
  )))
}

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
