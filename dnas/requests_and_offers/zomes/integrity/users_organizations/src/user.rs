use std::{fmt::Display, str::FromStr};

use email_address::EmailAddress;
use hdi::prelude::*;
use utils::{
  errors::{invalid, UserValidationError},
  is_image,
};

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
  if user.name.trim().is_empty() {
    return invalid(UserValidationError::NameEmpty);
  }

  if AllowedTypes::from_str(user.user_type.as_str()).is_err() {
    return invalid(UserValidationError::InvalidUserType(
      AllowedTypes::Advocate.to_string(),
      AllowedTypes::Creator.to_string(),
    ));
  };

  if let Some(bytes) = user.picture {
    if !is_image(bytes) {
      return invalid(UserValidationError::PictureInvalid);
    }
  }

  if !EmailAddress::is_valid(user.email.trim()) {
    return invalid(UserValidationError::EmailInvalid);
  }

  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_delete_user(
  _action: Delete,
  _original_action: TypedAction<EntryCreationData>,
  _original_user: User,
) -> ExternResult<ValidateCallbackResult> {
  invalid(UserValidationError::DeleteRefused)
}

/// A `UserUpdates` link runs from a User's original record to an update in its
/// chain, and is written by that update's author (`validate_update_link`).
pub fn validate_create_link_user_updates(
  link_author: &AgentPubKey,
  base_address: &AnyLinkableHash,
  target_address: &AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
  crate::validate_update_link(
    link_author,
    base_address,
    target_address,
    |entry| matches!(entry, crate::EntryTypes::User(_)),
    "a UserUpdates",
    "a User",
  )
}

pub fn validate_delete_link_user_updates(
  _action: TypedAction<DeleteLinkData>,
  _original_action: TypedAction<CreateLinkData>,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  invalid(UserValidationError::UpdatesLinkDeleteRefused)
}
