use hdi::prelude::*;
use utils::errors::CommonError;

/// Which kind of listing an exchange settles. Carried on entries so the
/// coordinator looks the listing up in the right zome and a cross-zome error
/// propagates rather than reading as absence.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ListingType {
  Request,
  Offer,
}

/// Whose hands a resource moves out of, relative to the party the term
/// belongs to.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum Direction {
  Provide,
  Receive,
}

/// What the reciprocal side is, as framed by the medium of exchange. The
/// primary side is always a service.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ResourceKind {
  Service,
  Currency,
  Gift,
  Tbd,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Quantity {
  pub value: f64,
  pub unit: String,
}

/// One side of the pair. Mirrors an hREA intent: a transfer, in a direction,
/// of a resource conforming to a specification, optionally quantified.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ExchangeTerm {
  pub direction: Direction,
  pub resource_conforms_to: String,
  pub resource_kind: ResourceKind,
  pub quantity: Option<Quantity>,
}

/// A member marking a listing as one they want to talk about. The first
/// entry of every exchange; an agreement must point at one.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Interest {
  pub listing: ActionHash,
  pub listing_type: ListingType,
  /// The interested member's user hash, so a listing's author sees who.
  pub user: ActionHash,
}

/// Which proposal a counter-proposal answers, and the decline that closed it.
///
/// Both hashes are carried so validation can check the pair from the records
/// themselves: it reads only what an entry names, never links, so the decline
/// has to be named to be checked.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Countering {
  /// The agreement being countered.
  pub agreement: ActionHash,
  /// The countering member's decline of that agreement.
  pub decline: ActionHash,
}

/// What two parties agreed off-app, written up by either of them. The
/// listing, the interest it settles, the two parties as user hashes, and the
/// terms. The medium is the frame the reciprocal term is read through and is
/// never itself a term.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Agreement {
  pub listing: ActionHash,
  pub listing_type: ListingType,
  pub interest: ActionHash,
  pub counterparty: ActionHash,
  pub provider: ActionHash,
  pub receiver: ActionHash,
  pub primary: ExchangeTerm,
  pub reciprocal: ExchangeTerm,
  pub medium: String,
  pub terms: String,
  pub delivery_timeframe: String,
  /// Set on a counter-proposal: the proposal it answers and the decline that
  /// closed it. `None` on a first proposal. Rounds of one negotiation form a
  /// chain through this field (#333).
  pub counters: Option<Countering>,
}

/// The other party accepting or declining an agreement.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Response {
  pub agreement: ActionHash,
  pub accepted: bool,
  pub note: String,
}

/// One party recording that their part is done.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Completion {
  pub agreement: ActionHash,
}

/// One party's review of an exchange.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Review {
  pub agreement: ActionHash,
  pub rating: u8,
  pub on_time: bool,
  pub as_agreed: bool,
  pub comment: String,
}

/// Either party withdrawing from an agreement.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Cancellation {
  pub agreement: ActionHash,
  pub note: String,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  Interest(Interest),
  Agreement(Agreement),
  Response(Response),
  Completion(Completion),
  Review(Review),
  Cancellation(Cancellation),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  /// Listing Create -> Interest.
  ListingInterests,
  /// User Create -> Interest, for the member's own dashboard.
  UserInterests,
  /// Listing Create -> Agreement.
  ListingAgreements,
  /// User Create -> Agreement, written for both parties.
  UserAgreements,
  /// Agreement Create -> Response.
  AgreementResponses,
  /// Agreement Create -> Completion.
  AgreementCompletions,
  /// Agreement Create -> Review.
  AgreementReviews,
  /// Agreement Create -> Cancellation.
  AgreementCancellations,
  /// Agreement Create -> the counter-proposal that answers it, so a chain of
  /// rounds can be read forwards as well as back.
  AgreementCounters,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

// ---------------------------------------------------------------------------
// Deterministic reads. Validation may use must_get_* and nothing else, so
// every rule below reads exactly the records the entry names and no links.
// ---------------------------------------------------------------------------

fn invalid(reason: &str) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(reason.to_string()))
}

/// The record at a hash, which must be a Create: the chain-root rule at the
/// validation layer. A revision handed in as an identity is refused here on
/// every peer, which is what makes any coordinator fallback safe.
fn create_record(hash: &ActionHash, what: &str) -> ExternResult<Result<Record, String>> {
  let record = must_get_valid_record(hash.clone())?;
  match record.action() {
    Action::Create(_) => Ok(Ok(record)),
    _ => Ok(Err(format!("{what} must be referenced by its Create"))),
  }
}

fn author_of(record: &Record) -> AgentPubKey {
  record.action().author().clone()
}

fn entry_of<T: TryFrom<SerializedBytes, Error = SerializedBytesError>>(
  record: &Record,
  what: &str,
) -> ExternResult<Result<T, String>> {
  match record.entry().to_app_option::<T>() {
    Ok(Some(entry)) => Ok(Ok(entry)),
    Ok(None) => Ok(Err(format!("{what} has no entry"))),
    Err(e) => Err(CommonError::Serialize(e).into()),
  }
}

/// Reads an agreement by hash, checking it is a Create. Returns the record
/// and the deserialized entry, or the reason it is unusable.
fn agreement_at(hash: &ActionHash) -> ExternResult<Result<(Record, Agreement), String>> {
  let record = match create_record(hash, "agreement")? {
    Ok(r) => r,
    Err(reason) => return Ok(Err(reason)),
  };
  let agreement = match entry_of::<Agreement>(&record, "agreement")? {
    Ok(a) => a,
    Err(reason) => return Ok(Err(reason)),
  };
  Ok(Ok((record, agreement)))
}

/// The agent behind a user hash: the author of the user's Create.
fn agent_for_user(user: &ActionHash) -> ExternResult<Result<AgentPubKey, String>> {
  Ok(create_record(user, "user")?.map(|r| author_of(&r)))
}

fn validate_term(term: &ExchangeTerm, side: &str) -> Option<String> {
  match term.resource_kind {
    ResourceKind::Gift | ResourceKind::Tbd => {
      if term.quantity.is_some() {
        return Some(format!("{side} term of kind gift or tbd carries no quantity"));
      }
      if !term.resource_conforms_to.is_empty() {
        return Some(format!("{side} term of kind gift or tbd conforms to nothing"));
      }
    }
    ResourceKind::Service | ResourceKind::Currency => {
      if term.resource_conforms_to.is_empty() {
        return Some(format!("{side} term names no resource specification"));
      }
    }
  }
  if let Some(q) = &term.quantity {
    if !(q.value.is_finite() && q.value > 0.0) || q.unit.is_empty() {
      return Some(format!("{side} term quantity must be positive with a unit"));
    }
  }
  None
}

// ---------------------------------------------------------------------------
// Entry rules
// ---------------------------------------------------------------------------

fn validate_interest(author: &AgentPubKey, interest: &Interest) -> ExternResult<ValidateCallbackResult> {
  if let Err(reason) = create_record(&interest.listing, "listing")? {
    return invalid(&reason);
  }
  match agent_for_user(&interest.user)? {
    Ok(agent) if agent == *author => Ok(ValidateCallbackResult::Valid),
    Ok(_) => invalid("an interest names its own author's user"),
    Err(reason) => invalid(&reason),
  }
}

/// An agreement points at an interest on the same listing. Its author is the
/// listing's author or the interest's author, and the counterparty is the
/// other. Provider and receiver are those two, assigned by listing type.
fn validate_agreement(author: &AgentPubKey, agreement: &Agreement) -> ExternResult<ValidateCallbackResult> {
  let listing = match create_record(&agreement.listing, "listing")? {
    Ok(r) => r,
    Err(reason) => return invalid(&reason),
  };
  let interest_record = match create_record(&agreement.interest, "interest")? {
    Ok(r) => r,
    Err(reason) => return invalid(&reason),
  };
  let interest = match entry_of::<Interest>(&interest_record, "interest")? {
    Ok(i) => i,
    Err(reason) => return invalid(&reason),
  };
  if interest.listing != agreement.listing {
    return invalid("agreement and its interest name different listings");
  }
  if interest.listing_type != agreement.listing_type {
    return invalid("agreement and its interest disagree on listing type");
  }

  let listing_author = author_of(&listing);
  let interest_author = author_of(&interest_record);
  if listing_author == interest_author {
    return invalid("a member cannot exchange with themselves");
  }
  let other = if *author == listing_author {
    interest_author.clone()
  } else if *author == interest_author {
    listing_author.clone()
  } else {
    return invalid("agreement author is neither the listing author nor the interested member");
  };

  match agent_for_user(&agreement.counterparty)? {
    Ok(agent) if agent == other => {}
    Ok(_) => return invalid("counterparty is not the other party"),
    Err(reason) => return invalid(&reason),
  }

  let provider_agent = match agent_for_user(&agreement.provider)? {
    Ok(a) => a,
    Err(reason) => return invalid(&reason),
  };
  let receiver_agent = match agent_for_user(&agreement.receiver)? {
    Ok(a) => a,
    Err(reason) => return invalid(&reason),
  };
  let (expected_provider, expected_receiver) = match agreement.listing_type {
    ListingType::Offer => (listing_author.clone(), interest_author.clone()),
    ListingType::Request => (interest_author.clone(), listing_author.clone()),
  };
  if provider_agent != expected_provider || receiver_agent != expected_receiver {
    return invalid("provider and receiver do not match the listing type and its parties");
  }

  if agreement.primary.direction != Direction::Provide
    || agreement.primary.resource_kind != ResourceKind::Service
  {
    return invalid("primary term is the service provided");
  }
  if agreement.reciprocal.direction != Direction::Receive {
    return invalid("reciprocal term is what the provider receives");
  }
  if let Some(reason) = validate_term(&agreement.primary, "primary") {
    return invalid(&reason);
  }
  if let Some(reason) = validate_term(&agreement.reciprocal, "reciprocal") {
    return invalid(&reason);
  }
  if agreement.medium.trim().is_empty() {
    return invalid("agreement names no medium of exchange");
  }
  match &agreement.counters {
    None => Ok(ValidateCallbackResult::Valid),
    Some(countering) => validate_counter(author, agreement, countering),
  }
}

/// A counter-proposal answers one proposal (#332, #333).
///
/// - It is written by the member that proposal was sent to.
/// - It carries that member's decline of the proposal, so a counter never
///   exists beside an open original.
/// - Everything except the two quantities and the timeframe is the same as the
///   proposal it answers, and at least one of those three differs. Anything
///   else needs a new listing.
fn validate_counter(
  author: &AgentPubKey,
  counter: &Agreement,
  countering: &Countering,
) -> ExternResult<ValidateCallbackResult> {
  let (_, countered) = match agreement_at(&countering.agreement)? {
    Ok(pair) => pair,
    Err(reason) => return invalid(&reason),
  };
  match agent_for_user(&countered.counterparty)? {
    Ok(agent) if agent == *author => {}
    Ok(_) => return invalid("only the member a proposal was sent to may counter it"),
    Err(reason) => return invalid(&reason),
  }

  let decline_record = match create_record(&countering.decline, "decline")? {
    Ok(r) => r,
    Err(reason) => return invalid(&reason),
  };
  let decline = match entry_of::<Response>(&decline_record, "decline")? {
    Ok(r) => r,
    Err(reason) => return invalid(&reason),
  };
  if decline.agreement != countering.agreement {
    return invalid("a counter's decline must be of the proposal it counters");
  }
  if decline.accepted {
    return invalid("a counter's decline must decline the proposal");
  }
  if author_of(&decline_record) != *author {
    return invalid("a counter's decline must be written by the counter's author");
  }

  match counter_terms_problem(counter, &countered) {
    Some(reason) => invalid(reason),
    None => Ok(ValidateCallbackResult::Valid),
  }
}

/// What is wrong with a counter's terms against the proposal it answers, if
/// anything. Pure, so it is unit-tested without a conductor.
pub fn counter_terms_problem(counter: &Agreement, countered: &Agreement) -> Option<&'static str> {
  if counter.listing != countered.listing
    || counter.listing_type != countered.listing_type
    || counter.interest != countered.interest
    || counter.provider != countered.provider
    || counter.receiver != countered.receiver
  {
    return Some("a counter keeps the listing, the interest and the parties of the proposal it answers");
  }
  if counter.medium != countered.medium || counter.terms != countered.terms {
    return Some("a counter keeps the medium of exchange and the terms text");
  }
  if !same_except_quantity(&counter.primary, &countered.primary)
    || !same_except_quantity(&counter.reciprocal, &countered.reciprocal)
  {
    return Some("a counter keeps both services; only the quantities may change");
  }
  if counter.primary.quantity == countered.primary.quantity
    && counter.reciprocal.quantity == countered.reciprocal.quantity
    && counter.delivery_timeframe == countered.delivery_timeframe
  {
    return Some("a counter changes a quantity or the timeframe");
  }
  None
}

fn same_except_quantity(a: &ExchangeTerm, b: &ExchangeTerm) -> bool {
  a.direction == b.direction
    && a.resource_conforms_to == b.resource_conforms_to
    && a.resource_kind == b.resource_kind
}

/// A response is written by the agreement's counterparty.
fn validate_response(author: &AgentPubKey, response: &Response) -> ExternResult<ValidateCallbackResult> {
  let (_, agreement) = match agreement_at(&response.agreement)? {
    Ok(pair) => pair,
    Err(reason) => return invalid(&reason),
  };
  match agent_for_user(&agreement.counterparty)? {
    Ok(agent) if agent == *author => Ok(ValidateCallbackResult::Valid),
    Ok(_) => invalid("only the counterparty responds to an agreement"),
    Err(reason) => invalid(&reason),
  }
}

/// Completions, reviews and cancellations are written by a party.
fn validate_party_entry(
  author: &AgentPubKey,
  agreement_hash: &ActionHash,
  what: &str,
) -> ExternResult<ValidateCallbackResult> {
  let (_, agreement) = match agreement_at(agreement_hash)? {
    Ok(pair) => pair,
    Err(reason) => return invalid(&reason),
  };
  let provider = match agent_for_user(&agreement.provider)? {
    Ok(a) => a,
    Err(reason) => return invalid(&reason),
  };
  let receiver = match agent_for_user(&agreement.receiver)? {
    Ok(a) => a,
    Err(reason) => return invalid(&reason),
  };
  if *author == provider || *author == receiver {
    Ok(ValidateCallbackResult::Valid)
  } else {
    invalid(&format!("only a party to the agreement writes a {what}"))
  }
}

fn validate_review(author: &AgentPubKey, review: &Review) -> ExternResult<ValidateCallbackResult> {
  if review.rating > 5 {
    return invalid("rating is 0 to 5");
  }
  validate_party_entry(author, &review.agreement, "review")
}

// ---------------------------------------------------------------------------
// Link rules. Every base is a Create of the right kind; every target is an
// entry of the right type. Deletes are refused: the record is append-only.
// ---------------------------------------------------------------------------

fn base_is_create(base: &AnyLinkableHash, what: &str) -> ExternResult<Result<(), String>> {
  let hash = match base.clone().into_action_hash() {
    Some(h) => h,
    None => return Ok(Err(format!("{what} link base is not an action hash"))),
  };
  Ok(create_record(&hash, what)?.map(|_| ()))
}

fn target_is<T: TryFrom<SerializedBytes, Error = SerializedBytesError>>(
  target: &AnyLinkableHash,
  what: &str,
) -> ExternResult<Result<(), String>> {
  let hash = match target.clone().into_action_hash() {
    Some(h) => h,
    None => return Ok(Err(format!("{what} link target is not an action hash"))),
  };
  let record = match create_record(&hash, what)? {
    Ok(r) => r,
    Err(reason) => return Ok(Err(reason)),
  };
  Ok(entry_of::<T>(&record, what)?.map(|_| ()))
}

/// The target of an `AgreementCounters` link is a counter whose `counters`
/// names the link's base.
fn counter_of(base: &AnyLinkableHash, target: &AnyLinkableHash) -> ExternResult<Result<(), String>> {
  let (Some(base), Some(target)) = (base.clone().into_action_hash(), target.clone().into_action_hash()) else {
    return Ok(Err("counter link ends are not action hashes".to_string()));
  };
  let (_, counter) = match agreement_at(&target)? {
    Ok(pair) => pair,
    Err(reason) => return Ok(Err(reason)),
  };
  match counter.counters {
    Some(c) if c.agreement == base => Ok(Ok(())),
    _ => Ok(Err("a counter link points at the counter-proposal that answers its base".to_string())),
  }
}

fn validate_link(
  link_type: LinkTypes,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
) -> ExternResult<ValidateCallbackResult> {
  let base_check = match link_type {
    LinkTypes::ListingInterests | LinkTypes::ListingAgreements => base_is_create(base, "listing")?,
    LinkTypes::UserInterests | LinkTypes::UserAgreements => base_is_create(base, "user")?,
    _ => base_is_create(base, "agreement")?,
  };
  if let Err(reason) = base_check {
    return invalid(&reason);
  }
  let target_check = match link_type {
    LinkTypes::ListingInterests | LinkTypes::UserInterests => target_is::<Interest>(target, "interest")?,
    LinkTypes::ListingAgreements | LinkTypes::UserAgreements => target_is::<Agreement>(target, "agreement")?,
    LinkTypes::AgreementResponses => target_is::<Response>(target, "response")?,
    LinkTypes::AgreementCompletions => target_is::<Completion>(target, "completion")?,
    LinkTypes::AgreementReviews => target_is::<Review>(target, "review")?,
    LinkTypes::AgreementCancellations => target_is::<Cancellation>(target, "cancellation")?,
    LinkTypes::AgreementCounters => counter_of(base, target)?,
  };
  if let Err(reason) = target_check {
    return invalid(&reason);
  }
  Ok(ValidateCallbackResult::Valid)
}

// ---------------------------------------------------------------------------
// Routing. Every op reaches a rule; nothing falls through as valid by default
// except ops this zome has no opinion on.
// ---------------------------------------------------------------------------

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  // Fast path. `op.flattened()` below is the expensive call. Agent-activity
  // ops are the only ones Holochain delivers to every integrity zome in the
  // DNA, and no zome here has a rule for them, so that is the one op kind
  // skipped. Every other op kind reaches only the zome that owns its type and
  // still goes through `flattened()` exactly as before.
  //
  // WARNING: if you ever add a rule for agent-activity ops to this zome, you
  // must delete this guard here first. It returns Valid before the match below
  // ever sees the op, so the new rule would silently never run.
  if matches!(&op, Op::RegisterAgentActivity(_)) {
    return Ok(ValidateCallbackResult::Valid);
  }

  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::StoreEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, action } => {
        let author = &action.author;
        match app_entry {
          EntryTypes::Interest(i) => validate_interest(author, &i),
          EntryTypes::Agreement(a) => validate_agreement(author, &a),
          EntryTypes::Response(r) => validate_response(author, &r),
          EntryTypes::Completion(c) => validate_party_entry(author, &c.agreement, "completion"),
          EntryTypes::Review(r) => validate_review(author, &r),
          EntryTypes::Cancellation(c) => validate_party_entry(author, &c.agreement, "cancellation"),
        }
      }
      OpEntry::UpdateEntry { .. } => invalid("exchange records are append-only; nothing is updated"),
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::StoreRecord(store_record) => match store_record {
      // An interest may be withdrawn by its author; nothing else is deleted.
      OpRecord::DeleteEntry { original_action_hash, action, .. } => {
        let original = must_get_valid_record(original_action_hash)?;
        match original.entry().to_app_option::<Interest>() {
          Ok(Some(_)) => {
            if author_of(&original) == action.author {
              Ok(ValidateCallbackResult::Valid)
            } else {
              invalid("only the interested member withdraws their interest")
            }
          }
          _ => invalid("exchange records are append-only; only an interest is withdrawn"),
        }
      }
      OpRecord::UpdateEntry { .. } => invalid("exchange records are append-only; nothing is updated"),
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::RegisterCreateLink {
      link_type,
      base_address,
      target_address,
      ..
    } => validate_link(link_type, &base_address, &target_address),
    FlatOp::RegisterDeleteLink { .. } => invalid("exchange links are never deleted"),
    _ => Ok(ValidateCallbackResult::Valid),
  }
}

#[cfg(test)]
mod counter_tests {
  use super::*;

  fn hash(n: u8) -> ActionHash {
    ActionHash::from_raw_36(vec![n; 36])
  }

  fn proposal() -> Agreement {
    Agreement {
      listing: hash(1),
      listing_type: ListingType::Request,
      interest: hash(2),
      counterparty: hash(3),
      provider: hash(4),
      receiver: hash(3),
      primary: ExchangeTerm {
        direction: Direction::Provide,
        resource_conforms_to: "Gardening".into(),
        resource_kind: ResourceKind::Service,
        quantity: Some(Quantity { value: 3.0, unit: "hours".into() }),
      },
      reciprocal: ExchangeTerm {
        direction: Direction::Receive,
        resource_conforms_to: "Time bank hours".into(),
        resource_kind: ResourceKind::Currency,
        quantity: Some(Quantity { value: 3.0, unit: "Time bank hours".into() }),
      },
      medium: "Time bank hours".into(),
      terms: "".into(),
      delivery_timeframe: "Within 2 weeks".into(),
      counters: None,
    }
  }

  #[test]
  fn a_changed_quantity_or_timeframe_is_a_counter() {
    let mut c = proposal();
    c.primary.quantity = Some(Quantity { value: 5.0, unit: "hours".into() });
    assert_eq!(counter_terms_problem(&c, &proposal()), None);
    let mut c = proposal();
    c.reciprocal.quantity = None;
    assert_eq!(counter_terms_problem(&c, &proposal()), None);
    let mut c = proposal();
    c.delivery_timeframe = "Flexible".into();
    assert_eq!(counter_terms_problem(&c, &proposal()), None);
  }

  #[test]
  fn an_unchanged_copy_is_not_a_counter() {
    assert!(counter_terms_problem(&proposal(), &proposal()).unwrap().contains("changes a quantity"));
  }

  #[test]
  fn the_listing_interest_and_parties_are_kept() {
    for change in [
      |a: &mut Agreement| a.listing = hash(9),
      |a: &mut Agreement| a.interest = hash(9),
      |a: &mut Agreement| a.provider = hash(9),
      |a: &mut Agreement| a.receiver = hash(9),
      |a: &mut Agreement| a.listing_type = ListingType::Offer,
    ] {
      let mut c = proposal();
      c.delivery_timeframe = "Flexible".into();
      change(&mut c);
      assert!(counter_terms_problem(&c, &proposal()).unwrap().contains("listing, the interest"));
    }
  }

  #[test]
  fn the_medium_and_terms_text_are_kept() {
    let mut c = proposal();
    c.delivery_timeframe = "Flexible".into();
    c.medium = "Pounds".into();
    assert!(counter_terms_problem(&c, &proposal()).unwrap().contains("medium"));
    let mut c = proposal();
    c.delivery_timeframe = "Flexible".into();
    c.terms = "New words".into();
    assert!(counter_terms_problem(&c, &proposal()).unwrap().contains("medium"));
  }

  #[test]
  fn both_services_are_kept() {
    let mut c = proposal();
    c.delivery_timeframe = "Flexible".into();
    c.primary.resource_conforms_to = "Plumbing".into();
    assert!(counter_terms_problem(&c, &proposal()).unwrap().contains("both services"));
    let mut c = proposal();
    c.delivery_timeframe = "Flexible".into();
    c.reciprocal.resource_kind = ResourceKind::Gift;
    assert!(counter_terms_problem(&c, &proposal()).unwrap().contains("both services"));
  }
}
