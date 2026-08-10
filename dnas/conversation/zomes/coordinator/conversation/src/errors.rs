use hdk::prelude::{wasm_error, WasmError, WasmErrorInner};
use thiserror::Error;

/// Conversation-specific errors only. Anything with a `CommonError` equivalent
/// uses `utils::errors::CommonError` instead, following the house pattern of a
/// domain enum alongside it (`dnas/requests_and_offers/utils/src/errors.rs`).
#[derive(Debug, Error)]
pub enum ConversationError {
  /// `UsersError::NotAuthor` exists but belongs to the users domain in the
  /// shared DNA, and this DNA has no users.
  #[error("Not the author")]
  NotAuthor,

  #[error("Only a participant in this conversation may issue membrane proofs")]
  NotAParticipant,

  /// See `conversation_properties` in `lib.rs`.
  #[error("This cell holds no conversation")]
  NotAConversation,
}

impl From<ConversationError> for WasmError {
  fn from(err: ConversationError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}
