use hdk::prelude::{wasm_error, SerializedBytesError, WasmError, WasmErrorInner};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CommonError {
  // Maps to WasmErrorInner::Memory
  #[error("Memory error: {0}")]
  Memory(String),

  // Maps to WasmErrorInner::Serialize
  #[error("Serialization error: {0}")]
  Serialize(SerializedBytesError),

  // Maps to WasmErrorInner::Deserialize
  #[error("Deserialization error: {0}")]
  Deserialize(String),

  // Maps to WasmErrorInner::Guest for DHT operations
  #[error("DHT error: {0}")]
  DhtError(String),

  #[error("Network error: {0}")]
  NetworkError(String),

  #[error("Timeout error: {0}")]
  TimeoutError(String),

  #[error("Entry not found: {0}")]
  EntryNotFound(String),

  #[error("Entry operation failed: {0}")]
  EntryOperationFailed(String),

  #[error("Link error: {0}")]
  LinkError(String),

  #[error("Link not found: {0}")]
  LinkNotFound(String),

  // Maps to WasmErrorInner::Host for external errors
  #[error("External error: {0}")]
  External(String),

  // Path related errors
  #[error("Path error: {0}")]
  PathError(String),
}

#[derive(Debug, Error)]
pub enum UsersOrganizationsError {
  // Users errors
  #[error("User already exists: {0}")]
  UserAlreadyExists(String),

  #[error("User not found: {0}")]
  UserNotFound(String),

  #[error("User profile required: {0}")]
  UserProfileRequired(String),

  #[error("Invalid user status: {0}")]
  InvalidUserStatus(String),

  // Organizations errors
  #[error("Organization already exists: {0}")]
  OrganizationAlreadyExists(String),

  #[error("Organization not found: {0}")]
  OrganizationNotFound(String),

  #[error("Invalid organization status: {0}")]
  InvalidOrganizationStatus(String),

  // Membership errors
  #[error("Invalid membership status: {0}")]
  InvalidMembershipStatus(String),

  #[error("Already a member: {0}")]
  AlreadyMember(String),

  #[error("Not a member: {0}")]
  NotMember(String),

  // Coordinator errors
  #[error("Already a coordinator: {0}")]
  AlreadyCoordinator(String),

  #[error("Not a coordinator: {0}")]
  NotCoordinator(String),

  #[error("Cannot remove last coordinator: {0}")]
  CannotRemoveLastCoordinator(String),

  // Permission errors
  #[error("Insufficient permissions: {0}")]
  InsufficientPermissions(String),

  // Status errors
  #[error("Invalid status transition: {0}")]
  InvalidStatusTransition(String),

  #[error("Status not found: {0}")]
  StatusNotFound(String),

  #[error(transparent)]
  Common(#[from] CommonError),
}

#[derive(Debug, Error)]
pub enum AdministrationError {
  // Admin operations
  #[error("Invalid admin operation: {0}")]
  InvalidAdminOperation(String),

  #[error("Admin not found: {0}")]
  AdminNotFound(String),

  #[error("Permission level error: {0}")]
  PermissionLevelError(String),

  // Status management
  #[error("Invalid status change: {0}")]
  InvalidStatusChange(String),

  #[error("Status verification failed: {0}")]
  StatusVerificationFailed(String),

  #[error(transparent)]
  Common(#[from] CommonError),
}

// Legacy error kept for backward compatibility
#[derive(Debug, Error)]
pub enum UtilsError {
  #[error("Could not find the {0}'s action hash")]
  ActionHashNotFound(&'static str),
}

// Implement conversion to WasmError for all error types
impl From<CommonError> for WasmError {
  fn from(err: CommonError) -> Self {
    match err {
      CommonError::Memory(_) => wasm_error!(WasmErrorInner::Memory),
      CommonError::Serialize(err) => wasm_error!(WasmErrorInner::Serialize(err)),
      CommonError::Deserialize(err) => {
        let bytes = err.into_bytes();
        wasm_error!(WasmErrorInner::Deserialize(bytes))
      }
      CommonError::External(msg) => wasm_error!(WasmErrorInner::Host(msg)),
      // All other errors are mapped to Guest errors with specific contexts
      _ => wasm_error!(WasmErrorInner::Guest(err.to_string())),
    }
  }
}

impl From<UsersOrganizationsError> for WasmError {
  fn from(err: UsersOrganizationsError) -> Self {
    // All zome-specific errors are mapped to Guest errors
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}

impl From<AdministrationError> for WasmError {
  fn from(err: AdministrationError) -> Self {
    // All zome-specific errors are mapped to Guest errors
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}

impl From<UtilsError> for WasmError {
  fn from(err: UtilsError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}
