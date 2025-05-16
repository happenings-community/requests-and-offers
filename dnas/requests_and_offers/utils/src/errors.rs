use hdk::prelude::{wasm_error, HoloHashError, SerializedBytesError, WasmError, WasmErrorInner};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommonError {
  #[error("Memory error")]
  Memory,

  #[error("Serialization error: {0}")]
  Serialize(SerializedBytesError),

  #[error("Deserialization error")]
  Deserialize(Vec<u8>),

  #[error("AgentPubKey deserialization error")]
  HoloHashError(HoloHashError),

  #[error("DHT error: {0}")]
  DhtError(String),

  #[error("Network error: {0}")]
  NetworkError(String),

  #[error("Timeout error: {0}")]
  TimeoutError(String),

  #[error("Entry not found: {0}")]
  EntryNotFound(String),

  #[error("Detail is not a record")]
  DetailNotRecord,

  #[error("Entry operation failed: {0}")]
  EntryOperationFailed(String),

  #[error("Link error: {0}")]
  LinkError(String),

  #[error("Link not found: {0}")]
  LinkNotFound(String),

  #[error("External error: {0}")]
  External(String),

  #[error("Path error: {0}")]
  PathError(String),

  #[error("Invalid entry data: {0}")]
  InvalidEntryData(String),

  #[error("Action hash not found: {0}")]
  ActionHashNotFound(String),

  #[error("Not the author: {0}")]
  NotAuthor(String),
}

#[derive(Debug, Error)]
pub enum UsersError {
  #[error("User already exists: {0}")]
  UserAlreadyExists(String),

  #[error("User not accepted: {0}")]
  UserNotAccepted(String),

  #[error("User profile required")]
  UserProfileRequired(String),
}

#[derive(Debug, Error)]
pub enum OrganizationsError {
  #[error("Organization already exists: {0}")]
  OrganizationAlreadyExists(String),

  #[error("Organization not accepted: {0}")]
  OrganizationNotAccepted(String),

  #[error("Invalid membership status: {0}")]
  InvalidMembershipStatus(String),

  #[error("Not a coordinator: {0}")]
  NotCoordinator(String),

  #[error("Last coordinator: {0}")]
  LastCoordinator(String),

  #[error("Already a member: {0}")]
  AlreadyMember(String),

  #[error("Not a member: {0}")]
  NotMember(String),

  #[error("Already a coordinator: {0}")]
  AlreadyCoordinator(String),

  #[error("Coordinator not found: {0}")]
  CoordinatorNotFound(String),

  #[error("Cannot remove coordinator: {0}")]
  CannotRemoveCoordinator(String),

  #[error("Member not found: {0}")]
  MemberNotFound(String),

  #[error("Last member: {0}")]
  LastMember(String),
}

#[derive(Debug, Error)]
pub enum AdministrationError {
  #[error("Already an admin: {0}")]
  AlreadyAdmin(String),

  #[error("Unauthorized")]
  Unauthorized,

  #[error("Last admin")]
  LastAdmin,
}

#[derive(Debug, Error)]
pub enum StatusError {
  #[error("Already has status: {0}")]
  AlreadyHasStatus(String),

  #[error("Status verification failed: {0}")]
  StatusVerificationFailed(String),

  #[error("Invalid status change: {0}")]
  InvalidStatusChange(String),
}

impl From<CommonError> for WasmError {
  fn from(err: CommonError) -> Self {
    match err {
      CommonError::Memory => wasm_error!(WasmErrorInner::Memory),
      CommonError::Serialize(e) => wasm_error!(WasmErrorInner::Serialize(e)),
      CommonError::Deserialize(e) => wasm_error!(WasmErrorInner::Deserialize(e)),
      CommonError::HoloHashError(msg) => wasm_error!(WasmErrorInner::Guest(msg.to_string())),
      CommonError::DhtError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::NetworkError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::TimeoutError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::ActionHashNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::EntryNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::DetailNotRecord => {
        wasm_error!(WasmErrorInner::Guest("Detail is not a record".to_string()))
      }
      CommonError::EntryOperationFailed(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::LinkError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::LinkNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::External(msg) => wasm_error!(WasmErrorInner::Host(msg)),
      CommonError::PathError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::InvalidEntryData(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::NotAuthor(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
    }
  }
}

impl From<UsersError> for WasmError {
  fn from(err: UsersError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}

impl From<OrganizationsError> for WasmError {
  fn from(err: OrganizationsError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}

impl From<AdministrationError> for WasmError {
  fn from(err: AdministrationError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}

impl From<StatusError> for WasmError {
  fn from(err: StatusError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}
