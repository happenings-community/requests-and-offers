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

  #[error("HoloHash error: {0}")]
  HoloHash(HoloHashError),

  #[error("DHT error: {0}")]
  DhtError(String),

  #[error("Not a record")]
  NotRecord,

  #[error("Network error: {0}")]
  NetworkError(String),

  #[error("Timeout error: {0}")]
  TimeoutError(String),

  #[error("Entry not found: {0}")]
  EntryNotFound(String),

  #[error("Record not found: {0}")]
  RecordNotFound(String),

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
}

#[derive(Debug, Error)]
pub enum UsersError {
  #[error("User already exists")]
  UserAlreadyExists,

  #[error("User profile required")]
  UserProfileRequired,

  #[error("Not the author")]
  NotAuthor,
}

#[derive(Debug, Error)]
pub enum OrganizationsError {
  #[error("Organization already exists")]
  OrganizationAlreadyExists,

  #[error("Already a member")]
  AlreadyMember,

  #[error("Already a coordinator")]
  AlreadyCoordinator,

  #[error("Not a member")]
  NotMember,

  #[error("Not a coordinator")]
  NotCoordinator,

  #[error("Cannot remove last member")]
  LastMember,

  #[error("Cannot remove last coordinator")]
  LastCoordinator,
}

#[derive(Debug, Error)]
pub enum AdministrationError {
  #[error("Already an admin")]
  AlreadyAdmin,

  #[error("Cannot remove last admin")]
  LastAdmin,

  #[error("Entity not accepted: {0}")]
  EntityNotAccepted(String),

  #[error("Unauthorized")]
  Unauthorized,
}

#[derive(Debug, Error)]
pub enum StatusError {
  #[error("Already a status")]
  AlreadyStatus,

  #[error("Invalid status change")]
  InvalidStatusChange,

  #[error("Duration in days not provided")]
  DurationInDaysNotProvided,
}

#[derive(Debug, Error)]
pub enum ServiceTypeError {}

impl From<CommonError> for WasmError {
  fn from(err: CommonError) -> Self {
    match err {
      CommonError::Memory => wasm_error!(WasmErrorInner::Memory),
      CommonError::Serialize(e) => wasm_error!(WasmErrorInner::Serialize(e)),
      CommonError::Deserialize(e) => wasm_error!(WasmErrorInner::Deserialize(e)),
      CommonError::HoloHash(e) => wasm_error!(WasmErrorInner::Guest(e.to_string())),
      CommonError::DhtError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::RecordNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      err @ CommonError::NotRecord => wasm_error!(WasmErrorInner::Guest(err.to_string())),
      CommonError::NetworkError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::TimeoutError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::EntryNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::EntryOperationFailed(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::LinkError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::LinkNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::External(msg) => wasm_error!(WasmErrorInner::Host(msg)),
      CommonError::PathError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::InvalidEntryData(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::ActionHashNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
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
