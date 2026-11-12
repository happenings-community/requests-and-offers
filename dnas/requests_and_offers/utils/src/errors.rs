use hdk::prelude::{
  wasm_error, ExternResult, HoloHashError, SerializedBytesError, ValidateCallbackResult, WasmError,
  WasmErrorInner,
};
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

  #[error("Invalid data: {0}")]
  InvalidData(String),

  #[error("Action hash not found: {0}")]
  ActionHashNotFound(String),

  #[error("Cannot update archived {0}")]
  CannotUpdateArchived(String),
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

  #[error("Already a contact")]
  AlreadyContact,

  #[error("Not a contact")]
  NotContact,
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
pub enum ServiceTypeError {
  #[error("Service type is already approved")]
  AlreadyApproved,
}

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
      CommonError::InvalidData(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::ActionHashNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      CommonError::CannotUpdateArchived(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
    }
  }
}

impl From<UsersError> for WasmError {
  fn from(err: UsersError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}

impl From<ServiceTypeError> for WasmError {
  fn from(err: ServiceTypeError) -> Self {
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

// ---------------------------------------------------------------------------
// Validation reasons. A validation callback refuses an op with
// `ValidateCallbackResult::Invalid(reason)`, and every reason comes from one
// of the enums below through `invalid`, never a string built at the call
// site. The text of each variant is what peers, tests and the UI read, so a
// change to it is a change to the network's verdicts.
// ---------------------------------------------------------------------------

/// Refuses an op with `reason` as the verdict's text.
pub fn invalid(reason: impl std::fmt::Display) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(reason.to_string()))
}

/// The reasons every zome's delete routing shares.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CommonValidationError {
  #[error("Original action for a delete must be a Create or Update action")]
  DeleteOfNonCreation,

  #[error("Original record for a delete of a public entry must contain an entry")]
  DeletedPublicEntryMissing,

  #[error("Original app entry must be one of the defined entry types for this zome")]
  UnknownAppEntry,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UserValidationError {
  #[error("User name cannot be empty")]
  NameEmpty,

  /// The two allowed user types, in the order the message names them.
  #[error("User Type must be '{0}' or '{1}'.")]
  InvalidUserType(String, String),

  #[error("User picture must be a valid image")]
  PictureInvalid,

  #[error("Email is not valid")]
  EmailInvalid,

  #[error("User profile cannot be deleted")]
  DeleteRefused,

  #[error("UserUpdates links cannot be deleted")]
  UpdatesLinkDeleteRefused,

  #[error("only a User's author may link agents to it")]
  AgentsLinkFromForeignUser,

  #[error("a UserAgents link must point to its author's own key")]
  AgentsLinkToForeignKey,

  #[error("a MyUser link must start at its author's own key")]
  MyUserLinkFromForeignKey,

  #[error("a MyUser link must point to a User its author wrote")]
  MyUserLinkToForeignUser,

  #[error("UserAgents and MyUser links are never deleted")]
  IdentityLinkDeleteRefused,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum OrganizationValidationError {
  #[error("Full legal name must not be empty")]
  LegalNameEmpty,

  #[error("Organization logo must be a valid image")]
  LogoInvalid,

  #[error("Email is not valid")]
  EmailInvalid,

  #[error("OrganizationUpdates links cannot be deleted")]
  UpdatesLinkDeleteRefused,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum StatusValidationError {
  #[error("Invalid status type: {0}")]
  InvalidStatusType(String),

  #[error("Suspended status must have a reason")]
  SuspendedWithoutReason,

  #[error("Temporarily suspended status must have a timestamp")]
  TemporarySuspensionWithoutTimestamp,

  #[error("Indefinitely suspended status must not have a timestamp")]
  IndefiniteSuspensionWithTimestamp,

  #[error("Status cannot be deleted")]
  DeleteRefused,

  #[error("StatusUpdates links cannot be deleted")]
  UpdatesLinkDeleteRefused,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ServiceTypeValidationError {
  #[error("ServiceType name cannot be empty")]
  NameEmpty,

  #[error("ServiceType description cannot be empty")]
  DescriptionEmpty,

  #[error("Only the original author can update the ServiceType.")]
  UpdateByNonAuthor,

  #[error("Only the original author can delete the ServiceType.")]
  DeleteByNonAuthor,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum MediumOfExchangeValidationError {
  #[error("MediumOfExchange code cannot be empty")]
  CodeEmpty,

  #[error("MediumOfExchange name cannot be empty")]
  NameEmpty,

  #[error("MediumOfExchange exchange_type must be either 'base' or 'currency'")]
  InvalidExchangeType,

  #[error("Only the original author can update the MediumOfExchange.")]
  UpdateByNonAuthor,

  #[error("Only the original author can delete the MediumOfExchange.")]
  DeleteByNonAuthor,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RequestValidationError {
  #[error("Request title cannot be empty")]
  TitleEmpty,

  #[error("Request description cannot be empty")]
  DescriptionEmpty,

  #[error("Request description cannot exceed 1000 characters")]
  DescriptionTooLong,

  #[error("Time estimate must be greater than zero")]
  TimeEstimateNotPositive,
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum OfferValidationError {
  #[error("Offer title cannot be empty")]
  TitleEmpty,

  #[error("Offer description cannot be empty")]
  DescriptionEmpty,

  #[error("Offer description cannot exceed 1000 characters")]
  DescriptionTooLong,
}

/// The exchange rules. A `String` field names the record or the side the
/// rule is about ("listing", "agreement", "primary", ...).
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ExchangeValidationError {
  #[error("{0} must be referenced by its Create")]
  NotACreate(String),

  #[error("{0} has no entry")]
  NoEntry(String),

  #[error("{0} term of kind gift or tbd carries no quantity")]
  TermGiftWithQuantity(String),

  #[error("{0} term of kind gift or tbd conforms to nothing")]
  TermGiftConforms(String),

  #[error("{0} term names no resource specification")]
  TermWithoutSpecification(String),

  #[error("{0} term quantity must be positive with a unit")]
  TermQuantityInvalid(String),

  #[error("an interest names its own author's user")]
  InterestForeignUser,

  #[error("agreement and its interest name different listings")]
  AgreementListingMismatch,

  #[error("agreement and its interest disagree on listing type")]
  AgreementListingTypeMismatch,

  #[error("a member cannot exchange with themselves")]
  SelfExchange,

  #[error("agreement author is neither the listing author nor the interested member")]
  AgreementAuthorNotParty,

  #[error("counterparty is not the other party")]
  CounterpartyNotOtherParty,

  #[error("provider and receiver do not match the listing type and its parties")]
  PartiesMismatch,

  #[error("primary term is the service provided")]
  PrimaryNotService,

  #[error("reciprocal term is what the provider receives")]
  ReciprocalNotReceived,

  #[error("agreement names no medium of exchange")]
  NoMedium,

  #[error("only the member a proposal was sent to may counter it")]
  CounterByNonRecipient,

  #[error("a counter is written immediately after its decline")]
  CounterNotAfterDecline,

  #[error("a counter's decline must be of the proposal it counters")]
  CounterDeclineOfOtherProposal,

  #[error("a counter's decline must decline the proposal")]
  CounterDeclineAccepts,

  #[error("a counter's decline must be written by the counter's author")]
  CounterDeclineByOther,

  #[error("a counter keeps the listing, the interest and the parties of the proposal it answers")]
  CounterChangesParties,

  #[error("a counter keeps the medium of exchange and the terms text")]
  CounterChangesMediumOrTerms,

  #[error("a counter keeps both services; only the quantities may change")]
  CounterChangesServices,

  #[error("a counter keeps each quantity's unit; only the amount may change")]
  CounterChangesUnit,

  #[error("a counter changes a quantity or the timeframe")]
  CounterChangesNothing,

  #[error("only the counterparty responds to an agreement")]
  ResponseByNonCounterparty,

  #[error("this member has already responded to this proposal")]
  AlreadyResponded,

  #[error("only a party to the agreement writes a {0}")]
  PartyEntryByNonParty(String),

  #[error("rating is 0 to 5")]
  RatingOutOfRange,

  #[error("exchange records are append-only; nothing is updated")]
  UpdateRefused,

  #[error("only the interested member withdraws their interest")]
  InterestWithdrawnByOther,

  #[error("exchange records are append-only; only an interest is withdrawn")]
  DeleteRefused,

  #[error("exchange links are never deleted")]
  LinkDeleteRefused,

  #[error("{0} link base is not an action hash")]
  LinkBaseNotActionHash(String),

  #[error("{0} link target is not an action hash")]
  LinkTargetNotActionHash(String),

  #[error("counter link ends are not action hashes")]
  CounterLinkEndsNotActionHashes,

  #[error("only the counter's author links a proposal to its counter")]
  CounterLinkByOther,

  #[error("a counter link points at the counter-proposal that answers its base")]
  CounterLinkWrongTarget,
}

/// Every validation reason keeps the exact text it had when each zome built
/// it by hand: peers on an older build compare these strings, and so do the
/// tests and the UI.
#[cfg(test)]
mod validation_reason_tests {
  use super::*;

  fn reads(reason: impl std::fmt::Display, text: &str) {
    assert_eq!(reason.to_string(), text);
  }

  #[test]
  fn common_reasons_keep_their_text() {
    reads(
      CommonValidationError::DeleteOfNonCreation,
      "Original action for a delete must be a Create or Update action",
    );
    reads(
      CommonValidationError::DeletedPublicEntryMissing,
      "Original record for a delete of a public entry must contain an entry",
    );
    reads(
      CommonValidationError::UnknownAppEntry,
      "Original app entry must be one of the defined entry types for this zome",
    );
  }

  #[test]
  fn user_reasons_keep_their_text() {
    reads(UserValidationError::NameEmpty, "User name cannot be empty");
    reads(
      UserValidationError::InvalidUserType("advocate".into(), "creator".into()),
      "User Type must be 'advocate' or 'creator'.",
    );
    reads(
      UserValidationError::PictureInvalid,
      "User picture must be a valid image",
    );
    reads(UserValidationError::EmailInvalid, "Email is not valid");
    reads(
      UserValidationError::DeleteRefused,
      "User profile cannot be deleted",
    );
    reads(
      UserValidationError::UpdatesLinkDeleteRefused,
      "UserUpdates links cannot be deleted",
    );
    reads(
      UserValidationError::AgentsLinkFromForeignUser,
      "only a User's author may link agents to it",
    );
    reads(
      UserValidationError::AgentsLinkToForeignKey,
      "a UserAgents link must point to its author's own key",
    );
    reads(
      UserValidationError::MyUserLinkFromForeignKey,
      "a MyUser link must start at its author's own key",
    );
    reads(
      UserValidationError::MyUserLinkToForeignUser,
      "a MyUser link must point to a User its author wrote",
    );
    reads(
      UserValidationError::IdentityLinkDeleteRefused,
      "UserAgents and MyUser links are never deleted",
    );
  }

  #[test]
  fn organization_reasons_keep_their_text() {
    reads(
      OrganizationValidationError::LegalNameEmpty,
      "Full legal name must not be empty",
    );
    reads(
      OrganizationValidationError::LogoInvalid,
      "Organization logo must be a valid image",
    );
    reads(
      OrganizationValidationError::EmailInvalid,
      "Email is not valid",
    );
    reads(
      OrganizationValidationError::UpdatesLinkDeleteRefused,
      "OrganizationUpdates links cannot be deleted",
    );
  }

  #[test]
  fn status_reasons_keep_their_text() {
    reads(
      StatusValidationError::InvalidStatusType("bogus".into()),
      "Invalid status type: bogus",
    );
    reads(
      StatusValidationError::SuspendedWithoutReason,
      "Suspended status must have a reason",
    );
    reads(
      StatusValidationError::TemporarySuspensionWithoutTimestamp,
      "Temporarily suspended status must have a timestamp",
    );
    reads(
      StatusValidationError::IndefiniteSuspensionWithTimestamp,
      "Indefinitely suspended status must not have a timestamp",
    );
    reads(
      StatusValidationError::DeleteRefused,
      "Status cannot be deleted",
    );
    reads(
      StatusValidationError::UpdatesLinkDeleteRefused,
      "StatusUpdates links cannot be deleted",
    );
  }

  #[test]
  fn service_type_reasons_keep_their_text() {
    reads(
      ServiceTypeValidationError::NameEmpty,
      "ServiceType name cannot be empty",
    );
    reads(
      ServiceTypeValidationError::DescriptionEmpty,
      "ServiceType description cannot be empty",
    );
    reads(
      ServiceTypeValidationError::UpdateByNonAuthor,
      "Only the original author can update the ServiceType.",
    );
    reads(
      ServiceTypeValidationError::DeleteByNonAuthor,
      "Only the original author can delete the ServiceType.",
    );
  }

  #[test]
  fn medium_of_exchange_reasons_keep_their_text() {
    reads(
      MediumOfExchangeValidationError::CodeEmpty,
      "MediumOfExchange code cannot be empty",
    );
    reads(
      MediumOfExchangeValidationError::NameEmpty,
      "MediumOfExchange name cannot be empty",
    );
    reads(
      MediumOfExchangeValidationError::InvalidExchangeType,
      "MediumOfExchange exchange_type must be either 'base' or 'currency'",
    );
    reads(
      MediumOfExchangeValidationError::UpdateByNonAuthor,
      "Only the original author can update the MediumOfExchange.",
    );
    reads(
      MediumOfExchangeValidationError::DeleteByNonAuthor,
      "Only the original author can delete the MediumOfExchange.",
    );
  }

  #[test]
  fn request_reasons_keep_their_text() {
    reads(
      RequestValidationError::TitleEmpty,
      "Request title cannot be empty",
    );
    reads(
      RequestValidationError::DescriptionEmpty,
      "Request description cannot be empty",
    );
    reads(
      RequestValidationError::DescriptionTooLong,
      "Request description cannot exceed 1000 characters",
    );
    reads(
      RequestValidationError::TimeEstimateNotPositive,
      "Time estimate must be greater than zero",
    );
  }

  #[test]
  fn offer_reasons_keep_their_text() {
    reads(
      OfferValidationError::TitleEmpty,
      "Offer title cannot be empty",
    );
    reads(
      OfferValidationError::DescriptionEmpty,
      "Offer description cannot be empty",
    );
    reads(
      OfferValidationError::DescriptionTooLong,
      "Offer description cannot exceed 1000 characters",
    );
  }

  #[test]
  fn exchange_reasons_keep_their_text() {
    use ExchangeValidationError as E;
    reads(
      E::NotACreate("listing".into()),
      "listing must be referenced by its Create",
    );
    reads(E::NoEntry("agreement".into()), "agreement has no entry");
    reads(
      E::TermGiftWithQuantity("primary".into()),
      "primary term of kind gift or tbd carries no quantity",
    );
    reads(
      E::TermGiftConforms("reciprocal".into()),
      "reciprocal term of kind gift or tbd conforms to nothing",
    );
    reads(
      E::TermWithoutSpecification("primary".into()),
      "primary term names no resource specification",
    );
    reads(
      E::TermQuantityInvalid("primary".into()),
      "primary term quantity must be positive with a unit",
    );
    reads(
      E::InterestForeignUser,
      "an interest names its own author's user",
    );
    reads(
      E::AgreementListingMismatch,
      "agreement and its interest name different listings",
    );
    reads(
      E::AgreementListingTypeMismatch,
      "agreement and its interest disagree on listing type",
    );
    reads(E::SelfExchange, "a member cannot exchange with themselves");
    reads(
      E::AgreementAuthorNotParty,
      "agreement author is neither the listing author nor the interested member",
    );
    reads(
      E::CounterpartyNotOtherParty,
      "counterparty is not the other party",
    );
    reads(
      E::PartiesMismatch,
      "provider and receiver do not match the listing type and its parties",
    );
    reads(E::PrimaryNotService, "primary term is the service provided");
    reads(
      E::ReciprocalNotReceived,
      "reciprocal term is what the provider receives",
    );
    reads(E::NoMedium, "agreement names no medium of exchange");
    reads(
      E::CounterByNonRecipient,
      "only the member a proposal was sent to may counter it",
    );
    reads(
      E::CounterNotAfterDecline,
      "a counter is written immediately after its decline",
    );
    reads(
      E::CounterDeclineOfOtherProposal,
      "a counter's decline must be of the proposal it counters",
    );
    reads(
      E::CounterDeclineAccepts,
      "a counter's decline must decline the proposal",
    );
    reads(
      E::CounterDeclineByOther,
      "a counter's decline must be written by the counter's author",
    );
    reads(
      E::CounterChangesParties,
      "a counter keeps the listing, the interest and the parties of the proposal it answers",
    );
    reads(
      E::CounterChangesMediumOrTerms,
      "a counter keeps the medium of exchange and the terms text",
    );
    reads(
      E::CounterChangesServices,
      "a counter keeps both services; only the quantities may change",
    );
    reads(
      E::CounterChangesUnit,
      "a counter keeps each quantity's unit; only the amount may change",
    );
    reads(
      E::CounterChangesNothing,
      "a counter changes a quantity or the timeframe",
    );
    reads(
      E::ResponseByNonCounterparty,
      "only the counterparty responds to an agreement",
    );
    reads(
      E::AlreadyResponded,
      "this member has already responded to this proposal",
    );
    reads(
      E::PartyEntryByNonParty("review".into()),
      "only a party to the agreement writes a review",
    );
    reads(E::RatingOutOfRange, "rating is 0 to 5");
    reads(
      E::UpdateRefused,
      "exchange records are append-only; nothing is updated",
    );
    reads(
      E::InterestWithdrawnByOther,
      "only the interested member withdraws their interest",
    );
    reads(
      E::DeleteRefused,
      "exchange records are append-only; only an interest is withdrawn",
    );
    reads(E::LinkDeleteRefused, "exchange links are never deleted");
    reads(
      E::LinkBaseNotActionHash("user".into()),
      "user link base is not an action hash",
    );
    reads(
      E::LinkTargetNotActionHash("review".into()),
      "review link target is not an action hash",
    );
    reads(
      E::CounterLinkEndsNotActionHashes,
      "counter link ends are not action hashes",
    );
    reads(
      E::CounterLinkByOther,
      "only the counter's author links a proposal to its counter",
    );
    reads(
      E::CounterLinkWrongTarget,
      "a counter link points at the counter-proposal that answers its base",
    );
  }

  #[test]
  fn invalid_turns_a_reason_into_an_invalid_verdict() {
    assert_eq!(
      invalid(OfferValidationError::TitleEmpty).unwrap(),
      ValidateCallbackResult::Invalid("Offer title cannot be empty".to_string())
    );
  }
}
