use std::{fmt::Display, str::FromStr};

use email_address::EmailAddress;
use hdi::prelude::*;
use utils::{errors::CommonError, is_image};

/// Represents a user Entry with various attributes such as name, nickname, bio, etc.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct User {
  /// The full name of the user.
  pub name: String,
  /// A shorter version of the user's name, often used for display purposes.
  pub nickname: String,
  /// A brief biography about the idividual.
  pub bio: String,
  /// An optional serialized image representing the user picture.
  pub picture: Option<SerializedBytes>,
  /// The type of user, either 'advocate' or 'creator'.
  pub user_type: String,
  /// A list of skills associated with the user.
  pub skills: Vec<String>,
  /// The user's email address.
  pub email: String,
  /// An optional phone number for the user.
  pub phone: Option<String>,
  /// The time zone in which the user resides.
  pub time_zone: String,
  /// The location where the user is based.
  pub location: String,
}

enum AllowedTypes {
  Advocate,
  Creator,
}

impl Display for AllowedTypes {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    match self {
      Self::Advocate => write!(f, "advocate"),
      Self::Creator => write!(f, "creator"),
    }
  }
}

impl FromStr for AllowedTypes {
  type Err = ();

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    match s {
      "advocate" => Ok(Self::Advocate),
      "creator" => Ok(Self::Creator),
      _ => Err(()),
    }
  }
}

pub fn validate_user(user: User) -> ExternResult<ValidateCallbackResult> {
  if user.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "User name cannot be empty",
    )));
  }

  if AllowedTypes::from_str(user.user_type.as_str()).is_err() {
    return Ok(ValidateCallbackResult::Invalid(format!(
      "User Type must be '{}' or '{}'.",
      AllowedTypes::Advocate,
      AllowedTypes::Creator,
    )));
  };

  if let Some(bytes) = user.picture {
    if !is_image(bytes) {
      return Ok(ValidateCallbackResult::Invalid(String::from(
        "User picture must be a valid image",
      )));
    }
  }

  if !EmailAddress::is_valid(user.email.as_str()) {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Email is not valid",
    )));
  }

  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_update_user(
  _action: Update,
  _user: User,
  _original_action: EntryCreationAction,
  _original_user: User,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_user(
  _action: Delete,
  _original_action: EntryCreationAction,
  _original_user: User,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(String::from(
    "User profile cannot be deleted",
  )))
}

pub fn validate_create_link_user_updates(
  _action: CreateLink,
  base_address: AnyLinkableHash,
  target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let action_hash = base_address
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
  let record = must_get_valid_record(action_hash)?;
  let _user: User = record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("user".to_string()))?;
  // Check the entry type for the given action hash
  let action_hash = target_address
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
  let record = must_get_valid_record(action_hash)?;
  let _user: User = record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("user".to_string()))?;
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_link_user_updates(
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(String::from(
    "UserUpdates links cannot be deleted",
  )))
}
