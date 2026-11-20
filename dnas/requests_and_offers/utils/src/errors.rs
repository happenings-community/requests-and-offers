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

  #[error("A temporary suspension lasts a whole number of days, at least one: {0}")]
  DurationInDaysOutOfRange(i64),
}

#[derive(Debug, Error)]
pub enum ServiceTypeError {
  #[error("Service type is already approved")]
  AlreadyApproved,
}

/// Errors the messaging coordinator returns to a caller. The texts are what a member
/// sees, and the Sweettests match on parts of them, so change a text only on purpose.
#[derive(Debug, Error)]
pub enum MessagingError {
  #[error("Message content is {bytes} bytes, over the {limit} byte limit")]
  ContentTooLong { bytes: usize, limit: usize },

  #[error("That member is not accepted yet, and only a network administrator can write to them")]
  RecipientNotAccepted,

  #[error("Could not encode message: {0}")]
  Encode(String),

  #[error("You need a member profile before you can send messages")]
  SenderHasNoProfile,

  #[error("Your member profile is not accepted yet, so you cannot send messages")]
  SenderNotAccepted,

  #[error("Case ID is {bytes} bytes, over the {limit} byte limit")]
  CaseIdTooLong { bytes: usize, limit: usize },

  #[error("A permission name is {bytes} bytes, over the {limit} byte limit")]
  PermissionNameTooLong { bytes: usize, limit: usize },

  /// The argument names the role: "admin", a permission's name, or "organisation coordinator".
  #[error(
    "The {0} role is not enabled yet. Alpha 2 switches on the admin role first; stewards and named permissions arrive with the roles brief, and organisation coordinators with the organisations brief."
  )]
  RoleNotEnabled(String),

  /// The argument completes the sentence: "Only a holder of that role can {0}".
  #[error("Only a holder of that role can {0}")]
  HolderOnly(String),

  #[error("That role has no holders, so there is nowhere to deliver to")]
  RoleHasNoHolders,

  #[error("Your membership has no member grant yet, so you cannot send messages")]
  NoMemberGrantYet,

  #[error(
    "A message carries either text or a listing, never both. Send the listing as its own card."
  )]
  TextAndListing,

  #[error("A message carries text or a listing. This one has neither.")]
  EmptyMessage,

  #[error("Send ID is {bytes} bytes, over the {limit} byte limit")]
  SendIdTooLong { bytes: usize, limit: usize },

  #[error("A send needs a send ID, so that one with no answer can be checked before it is tried again")]
  SendIdMissing,

  /// Carries `messaging::message::DEVICES_NOT_FOUND`, which the coordinator keeps beside
  /// the reasoning for its wording.
  #[error("{0}")]
  DevicesNotFound(String),
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

impl From<MessagingError> for WasmError {
  fn from(err: MessagingError) -> Self {
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

/// A reason a validation callback may give: one of the enums below, and nothing else.
/// The trait is sealed, so a string cannot be passed to `invalid` or `verdict`. That is
/// as far as the compiler goes: `ValidateCallbackResult::Invalid(..)` written by hand
/// still compiles, and review holds the rest of the rule above.
pub trait ValidationReason: std::fmt::Display + sealed::Sealed {}

mod sealed {
  pub trait Sealed {}
}

macro_rules! validation_reasons {
  ($($reason:ident),* $(,)?) => {
    $(
      impl sealed::Sealed for $reason {}
      impl ValidationReason for $reason {}
    )*
  };
}

validation_reasons!(
  CommonValidationError,
  UserValidationError,
  OrganizationValidationError,
  StatusValidationError,
  ServiceTypeValidationError,
  MediumOfExchangeValidationError,
  RequestValidationError,
  OfferValidationError,
  ExchangeValidationError,
  GrantValidationError,
  MessagingValidationError,
  TimeframeValidationError,
  ListingValidationError,
);

/// Refuses an op with `reason` as the verdict's text.
pub fn invalid(reason: impl ValidationReason) -> ExternResult<ValidateCallbackResult> {
  Ok(verdict(reason))
}

/// The same refusal as a bare verdict, for a rule written as a pure function that
/// returns `ValidateCallbackResult` rather than `ExternResult` (messaging's, which
/// its unit tests call directly). `invalid` is this, wrapped.
pub fn verdict(reason: impl ValidationReason) -> ValidateCallbackResult {
  ValidateCallbackResult::Invalid(reason.to_string())
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

  #[error("Original record for a delete must contain an entry")]
  DeletedEntryMissing,

  #[error("{name} link starts at the original record of {kind}")]
  UpdatesLinkBase { name: String, kind: String },

  #[error("{name} link points at an update of {kind}")]
  UpdatesLinkTarget { name: String, kind: String },

  #[error("{0} link points at an update of the record it starts at")]
  UpdatesLinkOtherRecord(String),

  #[error("{0} link is written by the author of the update it points at")]
  UpdatesLinkAuthor(String),
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

  #[error("editing an organisation is a role act: {0}")]
  EditIsRoleAct(String),

  #[error("a link to an organisation's {0} starts at the organisation")]
  MembershipLinkBase(String),

  #[error("a link to an organisation's {0} points at a user")]
  MembershipLinkTarget(String),

  #[error("changing an organisation's {what} is a role act: {reason}")]
  MembershipIsRoleAct { what: String, reason: String },
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

  #[error("a temporary suspension must end after the moment it is written")]
  SuspensionEndsBeforeWritten,

  #[error("Status cannot be deleted")]
  DeleteRefused,

  #[error("StatusUpdates links cannot be deleted")]
  UpdatesLinkDeleteRefused,

  #[error("a status change is a role act: {0}")]
  ChangeIsRoleAct(String),

  #[error("An EntityStatus link points at a status record")]
  EntityStatusLinkTarget,

  #[error("An EntityStatus link is written by the author of the status it points at")]
  EntityStatusLinkAuthor,

  #[error("the accepted index is written with an admin or steward grant: {0}")]
  AcceptedIndexWithoutGrant(String),
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ServiceTypeValidationError {
  #[error("ServiceType name cannot be empty")]
  NameEmpty,

  #[error("ServiceType description cannot be empty")]
  DescriptionEmpty,

  #[error("Changing a service type is a role act: {0}")]
  ChangeIsRoleAct(String),

  #[error("Creating a service type is a role act: {0}")]
  CreateIsRoleAct(String),
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum MediumOfExchangeValidationError {
  #[error("MediumOfExchange code cannot be empty")]
  CodeEmpty,

  #[error("MediumOfExchange name cannot be empty")]
  NameEmpty,

  #[error("MediumOfExchange exchange_type must be either 'base' or 'currency'")]
  InvalidExchangeType,

  #[error("Changing a medium of exchange is a role act: {0}")]
  ChangeIsRoleAct(String),

  #[error("Creating a medium of exchange is a role act: {0}")]
  CreateIsRoleAct(String),
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum RequestValidationError {
  #[error("Request title cannot be empty")]
  TitleEmpty,

  #[error("Request description cannot be empty")]
  DescriptionEmpty,

  #[error("Request description cannot exceed 1000 characters")]
  DescriptionTooLong,

  #[error("an update of a request replaces a request")]
  UpdateOfNonRequest,

  #[error("Posting a request is a role act: {0}")]
  PostIsRoleAct(String),

  #[error("Changing a request is a role act: {0}")]
  ChangeIsRoleAct(String),
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum OfferValidationError {
  #[error("Offer title cannot be empty")]
  TitleEmpty,

  #[error("Offer description cannot be empty")]
  DescriptionEmpty,

  #[error("Offer description cannot exceed 1000 characters")]
  DescriptionTooLong,

  #[error("an update of an offer replaces an offer")]
  UpdateOfNonOffer,

  #[error("Posting an offer is a role act: {0}")]
  PostIsRoleAct(String),

  #[error("Changing an offer is a role act: {0}")]
  ChangeIsRoleAct(String),
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

  #[error("{side} term quantity is not a decimal: {problem}")]
  TermQuantityNotDecimal { side: String, problem: String },

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

  #[error("an interest is a role act: {0}")]
  InterestIsRoleAct(String),

  #[error("this member already has an interest in this listing")]
  InterestAlreadyLive,

  #[error("an agreement is a role act: {0}")]
  AgreementIsRoleAct(String),
}

/// The reasons the chain of grants gives, from the shared checks in `grants.rs`
/// and from the administration zome's own validation of grants, revocations and
/// their index links.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum GrantValidationError {
  #[error("Unknown role: {0}")]
  UnknownRole(String),

  #[error("the root grant is not signed by the progenitor key")]
  RootNotSignedByProgenitor,

  #[error("the root grant is written by the progenitor")]
  RootNotWrittenByProgenitor,

  #[error("the grant named is not a role grant")]
  NotARoleGrant,

  #[error("the grant named has no entry")]
  GrantHasNoEntry,

  #[error("the grant named does not read as one: {0}")]
  GrantUnreadable(String),

  /// The ability as its `Debug` form, as the reason has always read.
  #[error("this write needs a grant for {0}")]
  NeedsGrant(String),

  #[error("the grant carried is held by someone else")]
  HeldBySomeoneElse,

  #[error("a {role} grant does not cover {ability} here")]
  DoesNotCover { role: String, ability: String },

  #[error("an entity's chain holds creates and updates only")]
  ChainNotCreatesAndUpdates,

  #[error("the link's tag does not carry a grant")]
  TagCarriesNoGrant,

  #[error("a {0} grant needs the stewarding module, and this network does not have it")]
  NeedsStewarding(String),

  #[error("a {0} grant does not take a scope")]
  ScopeNotTaken(String),

  #[error("a {0} grant needs a scope")]
  ScopeNeeded(String),

  #[error("the progenitor key grants the first administrators, nothing else")]
  ProgenitorGrantsAdminsOnly,

  #[error("a grant is written by the holder of the grant it rests on")]
  NotHolderOfParent,

  #[error("a {granter} may not grant {role} here")]
  MayNotGrant { granter: String, role: String },

  #[error("a revocation is written by the holder of the grant it rests on")]
  RevocationNotByHolder,

  #[error("a {authority} may not revoke a {role} grant here")]
  MayNotRevoke { authority: String, role: String },

  #[error("an index link is written by the agent who wrote the grant")]
  IndexLinkNotByGranter,

  #[error("this index holds {index} grants, and the tag carries a {carried} grant")]
  IndexHoldsOtherRole { index: String, carried: String },

  #[error("a grant index link points at the grant its tag carries")]
  IndexLinkTargetMismatch,

  #[error("an agent's grant index holds that agent's grants")]
  AgentIndexHoldsOthers,

  #[error("a {0} index link starts at the grant's holder")]
  HolderLinkBaseMismatch(String),

  #[error("a revocation link points at a revocation record")]
  RevocationLinkTarget,

  #[error("a revocation link is written by the revoker")]
  RevocationLinkNotByRevoker,

  #[error("a revocation link starts at the grant it revokes")]
  RevocationLinkBase,

  #[error("a grant or a revocation is never updated")]
  UpdateRefused,

  #[error("A grant or a revocation is a record and cannot be deleted; revoke a grant instead")]
  DeleteRefused,

  #[error("a grant index is a record and is never tombstoned")]
  IndexTombstoneRefused,
}

/// The reasons the messaging integrity zome gives.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum MessagingValidationError {
  #[error("Messaging entries cannot be updated")]
  UpdateRefused,

  #[error("Encrypted message is {len} bytes, over the {limit} byte limit")]
  CiphertextTooLong { len: usize, limit: usize },

  #[error("Only the author of an entry may delete it")]
  DeleteByNonAuthor,

  #[error("An Inbox link must be authored by the author of the message it points to")]
  InboxLinkAuthor,

  #[error("Only the author of an Inbox link may delete it")]
  InboxLinkDeleteByNonAuthor,

  #[error("An Inbox link's tag must be empty, and this one is {0} bytes")]
  InboxLinkTagNotEmpty(usize),

  #[error("Sending a message is a member act: {0}")]
  SendIsMemberAct(String),

  #[error("An Inbox link's base must be an agent key")]
  InboxLinkBase,

  #[error("An Inbox link's target must be an action hash")]
  InboxLinkTargetNotAction,

  #[error("An Inbox link's target must be an app entry")]
  InboxLinkTargetNotAppEntry,

  #[error("An Inbox link's target record must contain its entry")]
  InboxLinkTargetMissingEntry,

  #[error("An Inbox link's target must be an EncryptedMessage")]
  InboxLinkTargetNotMessage,
}

/// A timeframe on a listing or an agreement (#380). Shared by the requests,
/// offers and exchanges zomes, so the three say the same thing.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum TimeframeValidationError {
  #[error("a timeframe must end after the moment it is written")]
  EndsBeforeWritten,

  #[error("a timeframe must end within {0} days of being written")]
  EndsTooLate(u64),

  #[error("a timeframe must not start after it ends")]
  StartsAfterEnd,
}

/// A listing's figures (#380): its time estimate and its amount. The estimate
/// describes the task and is never exchanged; the amount is what the listing
/// asks or offers in payment, in a unit.
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum ListingValidationError {
  #[error("a time estimate is not a decimal: {0}")]
  TimeEstimateNotDecimal(String),

  #[error("an amount is not a decimal: {0}")]
  AmountNotDecimal(String),

  #[error("an amount must be above zero")]
  AmountNotPositive,

  #[error("an amount must name its unit")]
  AmountWithoutUnit,
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
      StatusValidationError::SuspensionEndsBeforeWritten,
      "a temporary suspension must end after the moment it is written",
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
      RequestValidationError::UpdateOfNonRequest,
      "an update of a request replaces a request",
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
    reads(
      OfferValidationError::UpdateOfNonOffer,
      "an update of an offer replaces an offer",
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
      E::TermQuantityNotDecimal {
        side: "primary".into(),
        problem: "a sign".into(),
      },
      "primary term quantity is not a decimal: a sign",
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

  #[test]
  fn grant_reasons_keep_their_text() {
    use GrantValidationError as G;
    reads(G::UnknownRole("owner".into()), "Unknown role: owner");
    reads(
      G::RootNotSignedByProgenitor,
      "the root grant is not signed by the progenitor key",
    );
    reads(
      G::RootNotWrittenByProgenitor,
      "the root grant is written by the progenitor",
    );
    reads(G::NotARoleGrant, "the grant named is not a role grant");
    reads(G::GrantHasNoEntry, "the grant named has no entry");
    reads(
      G::GrantUnreadable("bad bytes".into()),
      "the grant named does not read as one: bad bytes",
    );
    reads(
      G::NeedsGrant("Participate".into()),
      "this write needs a grant for Participate",
    );
    reads(
      G::HeldBySomeoneElse,
      "the grant carried is held by someone else",
    );
    reads(
      G::DoesNotCover {
        role: "member".into(),
        ability: "Administer".into(),
      },
      "a member grant does not cover Administer here",
    );
    reads(
      G::ChainNotCreatesAndUpdates,
      "an entity's chain holds creates and updates only",
    );
    reads(
      G::TagCarriesNoGrant,
      "the link's tag does not carry a grant",
    );
    reads(
      G::NeedsStewarding("steward".into()),
      "a steward grant needs the stewarding module, and this network does not have it",
    );
    reads(
      G::ScopeNotTaken("admin".into()),
      "a admin grant does not take a scope",
    );
    reads(
      G::ScopeNeeded("coordinator".into()),
      "a coordinator grant needs a scope",
    );
    reads(
      G::ProgenitorGrantsAdminsOnly,
      "the progenitor key grants the first administrators, nothing else",
    );
    reads(
      G::NotHolderOfParent,
      "a grant is written by the holder of the grant it rests on",
    );
    reads(
      G::MayNotGrant {
        granter: "member".into(),
        role: "admin".into(),
      },
      "a member may not grant admin here",
    );
    reads(
      G::RevocationNotByHolder,
      "a revocation is written by the holder of the grant it rests on",
    );
    reads(
      G::MayNotRevoke {
        authority: "steward".into(),
        role: "admin".into(),
      },
      "a steward may not revoke a admin grant here",
    );
    reads(
      G::IndexLinkNotByGranter,
      "an index link is written by the agent who wrote the grant",
    );
    reads(
      G::IndexHoldsOtherRole {
        index: "admin".into(),
        carried: "member".into(),
      },
      "this index holds admin grants, and the tag carries a member grant",
    );
    reads(
      G::IndexLinkTargetMismatch,
      "a grant index link points at the grant its tag carries",
    );
    reads(
      G::AgentIndexHoldsOthers,
      "an agent's grant index holds that agent's grants",
    );
    reads(
      G::HolderLinkBaseMismatch("admin".into()),
      "a admin index link starts at the grant's holder",
    );
    reads(
      G::RevocationLinkTarget,
      "a revocation link points at a revocation record",
    );
    reads(
      G::RevocationLinkNotByRevoker,
      "a revocation link is written by the revoker",
    );
    reads(
      G::RevocationLinkBase,
      "a revocation link starts at the grant it revokes",
    );
    reads(G::UpdateRefused, "a grant or a revocation is never updated");
    reads(
      G::DeleteRefused,
      "A grant or a revocation is a record and cannot be deleted; revoke a grant instead",
    );
    reads(
      G::IndexTombstoneRefused,
      "a grant index is a record and is never tombstoned",
    );
  }

  #[test]
  fn role_act_reasons_keep_their_text() {
    let why = || "the grant carried is held by someone else".to_string();
    let tail = ": the grant carried is held by someone else";
    reads(
      OfferValidationError::PostIsRoleAct(why()),
      &format!("Posting an offer is a role act{tail}"),
    );
    reads(
      OfferValidationError::ChangeIsRoleAct(why()),
      &format!("Changing an offer is a role act{tail}"),
    );
    reads(
      RequestValidationError::PostIsRoleAct(why()),
      &format!("Posting a request is a role act{tail}"),
    );
    reads(
      RequestValidationError::ChangeIsRoleAct(why()),
      &format!("Changing a request is a role act{tail}"),
    );
    reads(
      ServiceTypeValidationError::ChangeIsRoleAct(why()),
      &format!("Changing a service type is a role act{tail}"),
    );
    reads(
      ServiceTypeValidationError::CreateIsRoleAct(why()),
      &format!("Creating a service type is a role act{tail}"),
    );
    reads(
      MediumOfExchangeValidationError::ChangeIsRoleAct(why()),
      &format!("Changing a medium of exchange is a role act{tail}"),
    );
    reads(
      MediumOfExchangeValidationError::CreateIsRoleAct(why()),
      &format!("Creating a medium of exchange is a role act{tail}"),
    );
    reads(
      ExchangeValidationError::InterestIsRoleAct(why()),
      &format!("an interest is a role act{tail}"),
    );
    reads(
      ExchangeValidationError::InterestAlreadyLive,
      "this member already has an interest in this listing",
    );
    reads(
      ExchangeValidationError::AgreementIsRoleAct(why()),
      &format!("an agreement is a role act{tail}"),
    );
    reads(
      StatusValidationError::ChangeIsRoleAct(why()),
      &format!("a status change is a role act{tail}"),
    );
    reads(
      StatusValidationError::AcceptedIndexWithoutGrant(why()),
      &format!("the accepted index is written with an admin or steward grant{tail}"),
    );
    reads(
      OrganizationValidationError::EditIsRoleAct(why()),
      &format!("editing an organisation is a role act{tail}"),
    );
    reads(
      OrganizationValidationError::MembershipIsRoleAct {
        what: "members".into(),
        reason: why(),
      },
      &format!("changing an organisation's members is a role act{tail}"),
    );
    reads(
      MessagingValidationError::SendIsMemberAct(why()),
      &format!("Sending a message is a member act{tail}"),
    );
  }

  #[test]
  fn link_shape_reasons_keep_their_text() {
    reads(
      CommonValidationError::DeletedEntryMissing,
      "Original record for a delete must contain an entry",
    );
    reads(
      CommonValidationError::UpdatesLinkBase {
        name: "a UserUpdates".into(),
        kind: "a user".into(),
      },
      "a UserUpdates link starts at the original record of a user",
    );
    reads(
      CommonValidationError::UpdatesLinkTarget {
        name: "a UserUpdates".into(),
        kind: "a user".into(),
      },
      "a UserUpdates link points at an update of a user",
    );
    reads(
      CommonValidationError::UpdatesLinkOtherRecord("a UserUpdates".into()),
      "a UserUpdates link points at an update of the record it starts at",
    );
    reads(
      CommonValidationError::UpdatesLinkAuthor("a UserUpdates".into()),
      "a UserUpdates link is written by the author of the update it points at",
    );
    reads(
      StatusValidationError::EntityStatusLinkTarget,
      "An EntityStatus link points at a status record",
    );
    reads(
      StatusValidationError::EntityStatusLinkAuthor,
      "An EntityStatus link is written by the author of the status it points at",
    );
    reads(
      OrganizationValidationError::MembershipLinkBase("members".into()),
      "a link to an organisation's members starts at the organisation",
    );
    reads(
      OrganizationValidationError::MembershipLinkTarget("coordinators".into()),
      "a link to an organisation's coordinators points at a user",
    );
  }

  #[test]
  fn messaging_reasons_keep_their_text() {
    use MessagingValidationError as M;
    reads(M::UpdateRefused, "Messaging entries cannot be updated");
    reads(
      M::CiphertextTooLong {
        len: 3841,
        limit: 3840,
      },
      "Encrypted message is 3841 bytes, over the 3840 byte limit",
    );
    reads(
      M::DeleteByNonAuthor,
      "Only the author of an entry may delete it",
    );
    reads(
      M::InboxLinkAuthor,
      "An Inbox link must be authored by the author of the message it points to",
    );
    reads(
      M::InboxLinkDeleteByNonAuthor,
      "Only the author of an Inbox link may delete it",
    );
    reads(
      M::InboxLinkTagNotEmpty(4),
      "An Inbox link's tag must be empty, and this one is 4 bytes",
    );
    reads(
      M::InboxLinkBase,
      "An Inbox link's base must be an agent key",
    );
    reads(
      M::InboxLinkTargetNotAction,
      "An Inbox link's target must be an action hash",
    );
    reads(
      M::InboxLinkTargetNotAppEntry,
      "An Inbox link's target must be an app entry",
    );
    reads(
      M::InboxLinkTargetMissingEntry,
      "An Inbox link's target record must contain its entry",
    );
    reads(
      M::InboxLinkTargetNotMessage,
      "An Inbox link's target must be an EncryptedMessage",
    );
  }

  #[test]
  fn timeframe_reasons_keep_their_text() {
    reads(
      TimeframeValidationError::EndsBeforeWritten,
      "a timeframe must end after the moment it is written",
    );
    reads(
      TimeframeValidationError::EndsTooLate(365),
      "a timeframe must end within 365 days of being written",
    );
    reads(
      TimeframeValidationError::StartsAfterEnd,
      "a timeframe must not start after it ends",
    );
  }

  #[test]
  fn listing_reasons_keep_their_text() {
    reads(
      ListingValidationError::TimeEstimateNotDecimal("a sign".into()),
      "a time estimate is not a decimal: a sign",
    );
    reads(
      ListingValidationError::AmountNotDecimal("a sign".into()),
      "an amount is not a decimal: a sign",
    );
    reads(
      ListingValidationError::AmountNotPositive,
      "an amount must be above zero",
    );
    reads(
      ListingValidationError::AmountWithoutUnit,
      "an amount must name its unit",
    );
  }
}
