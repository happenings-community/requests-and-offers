//! TEST ONLY: raw writes against the exchanges integrity zome. See Cargo.toml.
//!
//! Every function here skips the checks the real coordinator makes and hands
//! the entry or link straight to validation, which is the only thing that
//! decides whether it is accepted.

use exchanges_integrity::*;
use hdk::prelude::*;

/// An agreement entry exactly as given, `counters` included.
#[hdk_extern]
pub fn probe_create_agreement(agreement: Agreement) -> ExternResult<ActionHash> {
  create_entry(&EntryTypes::Agreement(agreement))
}

/// A response entry exactly as given, with no check for an earlier one.
#[hdk_extern]
pub fn probe_create_response(response: Response) -> ExternResult<ActionHash> {
  create_entry(&EntryTypes::Response(response))
}

/// An interest entry exactly as given, with no look at the author's own chain
/// for an earlier one (#354).
#[hdk_extern]
pub fn probe_create_interest(interest: Interest) -> ExternResult<ActionHash> {
  create_entry(&EntryTypes::Interest(interest))
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProbeLink {
  pub base: ActionHash,
  pub target: ActionHash,
}

/// An `AgreementCounters` link between any two hashes.
#[hdk_extern]
pub fn probe_create_counter_link(input: ProbeLink) -> ExternResult<ActionHash> {
  create_link(input.base, input.target, LinkTypes::AgreementCounters, ())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProbeDeclineThenCounter {
  /// The decline to write first.
  pub decline: Response,
  /// The counter to write after it. Its `counters.decline` is replaced by the
  /// new decline's hash; `counters.agreement` is kept as given.
  pub counter: Agreement,
  /// When true, one unrelated action is written between the two.
  pub gap: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ProbeDeclineThenCounterOutput {
  pub decline: ActionHash,
  pub counter: ActionHash,
}

/// A decline and a counter naming it, optionally with an action between them.
#[hdk_extern]
pub fn probe_decline_then_counter(
  input: ProbeDeclineThenCounter,
) -> ExternResult<ProbeDeclineThenCounterOutput> {
  let countered = input.decline.agreement.clone();
  let decline = create_entry(&EntryTypes::Response(input.decline))?;
  if input.gap {
    create_link(
      countered,
      decline.clone(),
      LinkTypes::AgreementResponses,
      (),
    )?;
  }
  let mut counter = input.counter;
  let agreement = counter
    .counters
    .as_ref()
    .map(|c| c.agreement.clone())
    .ok_or(wasm_error!(WasmErrorInner::Guest(
      "the counter needs counters set".into()
    )))?;
  counter.counters = Some(Countering {
    agreement,
    decline: decline.clone(),
  });
  let counter = create_entry(&EntryTypes::Agreement(counter))?;
  Ok(ProbeDeclineThenCounterOutput { decline, counter })
}
