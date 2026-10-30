//! Trying to break the exchange record's integrity rules (#333).
//!
//! The real coordinator only ever writes valid counters, so these tests use the
//! test-only `exchanges_probe` zome (tests/zomes/exchanges_probe) to hand the
//! integrity zome raw entries and links. Every forged write must be rejected by
//! validation, and each test checks the rejection names the rule it broke, so a
//! test cannot pass because something else failed. Each group ends with a valid
//! write through the same probe, which shows the probe itself works.
//!
//! A refused write is all-or-nothing: nothing from the zome call is kept, so one
//! open proposal can take many attempts in a row.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde_json::json;

// ---------------------------------------------------------------------------
// Mirrors of the exchanges integrity types, so entries can be read, altered and
// sent back through the probe.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Quantity {
    value: f64,
    unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct ExchangeTerm {
    direction: String,
    resource_conforms_to: String,
    resource_kind: String,
    quantity: Option<Quantity>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Countering {
    agreement: ActionHash,
    decline: ActionHash,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Agreement {
    listing: ActionHash,
    listing_type: String,
    interest: ActionHash,
    counterparty: ActionHash,
    provider: ActionHash,
    receiver: ActionHash,
    primary: ExchangeTerm,
    reciprocal: ExchangeTerm,
    medium: String,
    terms: String,
    delivery_timeframe: String,
    counters: Option<Countering>,
}
holochain_serialized_bytes::holochain_serial!(Agreement);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Response {
    agreement: ActionHash,
    accepted: bool,
    note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Interest {
    listing: ActionHash,
    listing_type: String,
    user: ActionHash,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProbeDeclineThenCounter {
    decline: Response,
    counter: Agreement,
    gap: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProbeDeclineThenCounterOutput {
    decline: ActionHash,
    counter: ActionHash,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProbeLink {
    base: ActionHash,
    target: ActionHash,
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/// Alice (progenitor, admin) offers; Bob and Carol are accepted members. Bob
/// registers interest and Alice proposes to him, so Bob is the counterparty.
struct World {
    conductors: SweetConductorBatch,
    alice: SweetCell,
    bob: SweetCell,
    carol: SweetCell,
    offer: ActionHash,
    interest: ActionHash,
}

impl World {
    async fn sync(&self) {
        await_consistency_s(30, [&self.alice, &self.bob, &self.carol])
            .await
            .unwrap();
    }

    /// Alice proposes to Bob on the shared offer; returns the proposal's hash
    /// and its entry.
    async fn propose(&self) -> (ActionHash, Agreement) {
        let record: Record = self.conductors[0]
            .call(
                &self.alice.zome("exchanges"),
                "create_agreement",
                json!({
                    "listing": self.offer,
                    "listing_type": "Offer",
                    "interest": self.interest,
                    "primary": {
                        "direction": "Provide",
                        "resource_conforms_to": "Web design",
                        "resource_kind": "Service",
                        "quantity": { "value": 2.0, "unit": "h" }
                    },
                    "reciprocal": {
                        "direction": "Receive",
                        "resource_conforms_to": "Time bank hours",
                        "resource_kind": "Currency",
                        "quantity": { "value": 2.0, "unit": "Time bank hours" }
                    },
                    "medium": "Time bank hours",
                    "terms": "Two hours over a call.",
                    "delivery_timeframe": "Within 2 weeks"
                }),
            )
            .await;
        self.sync().await;
        let entry: Agreement = record.entry().to_app_option().unwrap().expect("agreement");
        (record.signed_action.hashed.hash.clone(), entry)
    }

    /// Bob's probe: a decline of `countered` followed by `counter`.
    async fn bob_decline_then_counter(
        &self,
        countered: &ActionHash,
        counter: Agreement,
        gap: bool,
    ) -> Result<ProbeDeclineThenCounterOutput, String> {
        self.conductors[1]
            .call_fallible::<_, ProbeDeclineThenCounterOutput>(
                &self.bob.zome("exchanges_probe"),
                "probe_decline_then_counter",
                ProbeDeclineThenCounter {
                    decline: decline_of(countered),
                    counter,
                    gap,
                },
            )
            .await
            .map_err(|e| format!("{e:?}"))
    }
}

async fn member_hash(conductor: &SweetConductor, cell: &SweetCell) -> ActionHash {
    let links: Vec<Link> = conductor
        .call(&cell.zome("users_organizations"), "get_agent_user", cell.agent_pubkey().clone())
        .await;
    links[0].target.clone().into_action_hash().unwrap()
}

async fn world() -> World {
    let (conductors, mut cells) = setup_agents_with_alice_as_progenitor(3, true).await;
    let carol = cells.pop().unwrap();
    let bob = cells.pop().unwrap();
    let alice = cells.pop().unwrap();

    for (i, (cell, name)) in [(&alice, "Alice"), (&bob, "Bob"), (&carol, "Carol")]
        .into_iter()
        .enumerate()
    {
        conductors[i]
            .call::<_, Record>(&cell.zome("users_organizations"), "create_user", sample_user(name))
            .await;
    }
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();
    for (i, cell) in [&alice, &bob, &carol].into_iter().enumerate() {
        let user = member_hash(&conductors[i], cell).await;
        accept_entity(&conductors[0], &alice, ENTITY_USERS, user).await;
    }
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    let offer: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Web design review"))
        .await;
    let offer = offer.signed_action.hashed.hash.clone();
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    let interest: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer, "listing_type": "Offer" }))
        .await;
    let interest = interest.signed_action.hashed.hash.clone();
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    World { conductors, alice, bob, carol, offer, interest }
}

/// A valid counter of `proposal`: the same terms with a new timeframe, naming
/// the proposal. The probe fills in the decline.
fn counter_of(countered: &ActionHash, proposal: &Agreement) -> Agreement {
    let mut counter = proposal.clone();
    // The proposal's author becomes the counterparty of the counter.
    counter.counterparty = if proposal.counterparty == proposal.provider {
        proposal.receiver.clone()
    } else {
        proposal.provider.clone()
    };
    counter.delivery_timeframe = "Flexible".into();
    counter.counters = Some(Countering {
        agreement: countered.clone(),
        decline: countered.clone(), // replaced by the probe
    });
    counter
}

fn decline_of(agreement: &ActionHash) -> Response {
    Response {
        agreement: agreement.clone(),
        accepted: false,
        note: "Countered with a new proposal".into(),
    }
}

/// Asserts a probe write was refused, and that the refusal names `reason`.
fn refused<T: std::fmt::Debug>(result: Result<T, String>, reason: &str, what: &str) {
    match result {
        Ok(v) => panic!("{what}: expected a refusal naming \"{reason}\", but it was accepted: {v:?}"),
        Err(e) => assert!(
            e.contains(reason),
            "{what}: refused, but not for \"{reason}\". The error was: {e}"
        ),
    }
}

// ---------------------------------------------------------------------------
// The probe never ships
// ---------------------------------------------------------------------------

/// The packed DNA has no test-only zome. If this fails, a probe has been added
/// to dna.yaml and would ship to members.
#[tokio::test(flavor = "multi_thread")]
async fn the_shipped_dna_contains_no_probe() {
    let dna = SweetDnaFile::from_bundle(std::path::Path::new(DNA_PATH))
        .await
        .expect("DNA bundle");
    let names: Vec<String> = dna
        .dna_def()
        .coordinator_zomes
        .iter()
        .map(|(name, _)| name.to_string())
        .collect();
    assert!(names.iter().any(|n| n == "exchanges"), "sanity: the real zome is there");
    assert!(
        !names.iter().any(|n| n.contains("probe")),
        "a test-only zome is packed into the shipped DNA: {names:?}"
    );
}

// ---------------------------------------------------------------------------
// Who may counter
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn only_the_recipient_may_counter() {
    let w = world().await;
    let (p, proposal) = w.propose().await;

    // Alice wrote the proposal: her decline of it is itself invalid, so the
    // whole write is refused.
    let alice = w.conductors[0]
        .call_fallible::<_, ProbeDeclineThenCounterOutput>(
            &w.alice.zome("exchanges_probe"),
            "probe_decline_then_counter",
            ProbeDeclineThenCounter {
                decline: decline_of(&p),
                counter: counter_of(&p, &proposal),
                gap: false,
            },
        )
        .await
        .map_err(|e| format!("{e:?}"));
    refused(alice, "only the counterparty responds", "the proposal's author countering");

    // Carol is a member but not a party.
    let carol = w.conductors[2]
        .call_fallible::<_, ProbeDeclineThenCounterOutput>(
            &w.carol.zome("exchanges_probe"),
            "probe_decline_then_counter",
            ProbeDeclineThenCounter {
                decline: decline_of(&p),
                counter: counter_of(&p, &proposal),
                gap: false,
            },
        )
        .await
        .map_err(|e| format!("{e:?}"));
    refused(carol, "only the counterparty responds", "a third member countering");

    // Alice writing a counter entry alone, with no decline of her own: the
    // counter names a decline that is not a response.
    let mut forged = counter_of(&p, &proposal);
    // Written by Alice, so Bob is the other party: everything about it is
    // valid except who wrote it, which is the rule under test.
    forged.counterparty = proposal.counterparty.clone();
    forged.counters = Some(Countering { agreement: p.clone(), decline: p.clone() });
    let alone = w.conductors[0]
        .call_fallible::<_, ActionHash>(&w.alice.zome("exchanges_probe"), "probe_create_agreement", forged)
        .await
        .map_err(|e| format!("{e:?}"));
    refused(alone, "only the member a proposal was sent to may counter it", "a counter by the author");

    // Control: Bob, the recipient, through the same probe.
    w.bob_decline_then_counter(&p, counter_of(&p, &proposal), false)
        .await
        .expect("a valid counter through the probe is accepted");
}

// ---------------------------------------------------------------------------
// The decline
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn a_counter_carries_its_own_decline() {
    let w = world().await;
    let (p, proposal) = w.propose().await;
    let (other, _) = w.propose().await;

    // The decline must be of the proposal being countered: Bob declines `other`
    // but the counter answers `p`.
    let mismatched = w.conductors[1]
        .call_fallible::<_, ProbeDeclineThenCounterOutput>(
            &w.bob.zome("exchanges_probe"),
            "probe_decline_then_counter",
            ProbeDeclineThenCounter {
                decline: decline_of(&other),
                counter: counter_of(&p, &proposal),
                gap: false,
            },
        )
        .await
        .map_err(|e| format!("{e:?}"));
    refused(mismatched, "must be of the proposal it counters", "a decline of a different proposal");

    // The "decline" must decline: an acceptance cannot back a counter.
    let accepting = w.conductors[1]
        .call_fallible::<_, ProbeDeclineThenCounterOutput>(
            &w.bob.zome("exchanges_probe"),
            "probe_decline_then_counter",
            ProbeDeclineThenCounter {
                decline: Response { agreement: p.clone(), accepted: true, note: String::new() },
                counter: counter_of(&p, &proposal),
                gap: false,
            },
        )
        .await
        .map_err(|e| format!("{e:?}"));
    refused(accepting, "must decline the proposal", "an acceptance backing a counter");

    // The decline must be a response at all: here it names the interest.
    let mut not_a_response = counter_of(&p, &proposal);
    not_a_response.counters = Some(Countering { agreement: p.clone(), decline: w.interest.clone() });
    let r = w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_agreement", not_a_response)
        .await
        .map_err(|e| format!("{e:?}"));
    assert!(r.is_err(), "a counter naming something that is not a response must be refused");

    // The counter must come immediately after the decline on Bob's chain.
    let gap = w.bob_decline_then_counter(&p, counter_of(&p, &proposal), true).await;
    refused(gap, "immediately after its decline", "a counter written after another action");

    // Control.
    w.bob_decline_then_counter(&p, counter_of(&p, &proposal), false)
        .await
        .expect("a valid counter through the probe is accepted");
}

// ---------------------------------------------------------------------------
// Forks: one response per proposal, one counter per decline
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn a_negotiation_cannot_be_forked() {
    let w = world().await;
    let (p, proposal) = w.propose().await;

    // Bob counters through the real coordinator.
    let first: Record = w.conductors[1]
        .call(
            &w.bob.zome("exchanges"),
            "counter_agreement",
            json!({
                "agreement": p,
                "primary_quantity": { "value": 3.0, "unit": "h" },
                "reciprocal_quantity": { "value": 2.0, "unit": "Time bank hours" },
                "delivery_timeframe": "Within 2 weeks"
            }),
        )
        .await;
    let first_entry: Agreement = first.entry().to_app_option().unwrap().expect("counter");
    let used_decline = first_entry.counters.clone().unwrap().decline;
    w.sync().await;

    // A second decline of the same proposal, then a second counter: the decline
    // is refused because Bob has already responded.
    let fork = w.bob_decline_then_counter(&p, counter_of(&p, &proposal), false).await;
    refused(fork, "already responded to this proposal", "a second decline and counter");

    // A second response on its own: refused the same way.
    let second = w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_response", decline_of(&p))
        .await
        .map_err(|e| format!("{e:?}"));
    refused(second, "already responded to this proposal", "a second decline");
    let accept_after = w.conductors[1]
        .call_fallible::<_, ActionHash>(
            &w.bob.zome("exchanges_probe"),
            "probe_create_response",
            Response { agreement: p.clone(), accepted: true, note: String::new() },
        )
        .await
        .map_err(|e| format!("{e:?}"));
    refused(accept_after, "already responded to this proposal", "accepting after declining");

    // A second counter reusing the first counter's decline: it does not follow
    // that decline on the chain, so it is refused.
    let mut reuse = counter_of(&p, &proposal);
    reuse.counters = Some(Countering { agreement: p.clone(), decline: used_decline });
    let r = w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_agreement", reuse)
        .await
        .map_err(|e| format!("{e:?}"));
    refused(r, "immediately after its decline", "a second counter reusing a decline");

    // The record still reads as one negotiation.
    let ex: ExchangeView = w.conductors[0]
        .call(&w.alice.zome("exchanges"), "get_exchange", p.clone())
        .await;
    assert_eq!(ex.status, "Declined");

    // Control: a different, still-open proposal can be responded to once.
    let (open, _) = w.propose().await;
    w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_response", decline_of(&open))
        .await
        .expect("a first response through the probe is accepted");
}

/// Just enough of the exchange read model to check the status.
#[derive(Debug, Serialize, Deserialize)]
struct ExchangeView {
    status: String,
}

// ---------------------------------------------------------------------------
// What a counter may change
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn a_counter_changes_only_quantities_and_timeframe() {
    let mut w = world().await;
    let (p, proposal) = w.propose().await;
    let elsewhere: Record = w.conductors[2]
        .call(&w.carol.zome("offers"), "create_offer", sample_offer("Something else"))
        .await;
    let elsewhere = elsewhere.signed_action.hashed.hash.clone();
    // Bob may hold one live interest per listing (#354), so he withdraws the
    // first (the proposal above still names it) before showing interest again.
    // The later proposals use the new one.
    let _: ActionHash = w.conductors[1]
        .call(&w.bob.zome("exchanges"), "withdraw_interest", w.interest.clone())
        .await;
    let second_interest: Record = w.conductors[1]
        .call(&w.bob.zome("exchanges"), "create_interest", json!({ "listing": w.offer, "listing_type": "Offer" }))
        .await;
    let second_interest = second_interest.signed_action.hashed.hash.clone();
    w.interest = second_interest.clone();
    w.sync().await;

    type Change = (&'static str, &'static str, Box<dyn Fn(&mut Agreement)>);
    let changes: Vec<Change> = vec![
        // Caught first by the rule that an agreement's interest is on its
        // listing; the cross-listing counter has its own test below.
        ("the listing", "", {
            let e = elsewhere.clone();
            Box::new(move |a| a.listing = e.clone())
        }),
        ("the listing type", "listing type", Box::new(|a| a.listing_type = "Request".into())),
        // Bob's renewed interest on the same offer: valid on its own, so only
        // the counter rule can catch it.
        ("the interest", "keeps the listing, the interest and the parties", {
            let i = second_interest.clone();
            Box::new(move |a| a.interest = i.clone())
        }),
        ("the provider", "", Box::new(|a| std::mem::swap(&mut a.provider, &mut a.receiver))),
        ("the medium", "keeps the medium of exchange and the terms text", Box::new(|a| a.medium = "Pounds".into())),
        ("the terms text", "keeps the medium of exchange and the terms text", Box::new(|a| a.terms = "Different words".into())),
        ("the primary service", "keeps both services", Box::new(|a| a.primary.resource_conforms_to = "Plumbing".into())),
        ("the return currency", "keeps both services", Box::new(|a| a.reciprocal.resource_conforms_to = "Pounds".into())),
        ("the return kind", "keeps both services", Box::new(|a| {
            a.reciprocal.resource_kind = "Gift".into();
            a.reciprocal.resource_conforms_to = String::new();
            a.reciprocal.quantity = None;
        })),
        ("the primary direction", "", Box::new(|a| a.primary.direction = "Receive".into())),
        ("nothing at all", "changes a quantity or the timeframe", Box::new(|a| {
            a.delivery_timeframe = "Within 2 weeks".into();
        })),
    ];

    for (what, reason, change) in changes {
        let mut counter = counter_of(&p, &proposal);
        change(&mut counter);
        let result = w.bob_decline_then_counter(&p, counter, false).await;
        if reason.is_empty() {
            // Caught by an earlier rule (the parties or the term shape); the
            // point is that it never stands.
            assert!(result.is_err(), "changing {what} must be refused");
        } else {
            refused(result, reason, &format!("changing {what}"));
        }
    }

    // Each permitted change alone is accepted: primary quantity, return
    // quantity, return quantity removed, timeframe. Each needs an open proposal.
    let permitted: Vec<(&str, Box<dyn Fn(&mut Agreement)>)> = vec![
        ("the primary quantity", Box::new(|a| {
            a.delivery_timeframe = "Within 2 weeks".into();
            a.primary.quantity = Some(Quantity { value: 5.0, unit: "h".into() });
        })),
        ("the return quantity", Box::new(|a| {
            a.delivery_timeframe = "Within 2 weeks".into();
            a.reciprocal.quantity = Some(Quantity { value: 9.0, unit: "Time bank hours".into() });
        })),
        ("removing the return quantity", Box::new(|a| {
            a.delivery_timeframe = "Within 2 weeks".into();
            a.reciprocal.quantity = None;
        })),
        ("the timeframe", Box::new(|_| {})),
    ];
    for (what, change) in permitted {
        let (open, proposal) = w.propose().await;
        let mut counter = counter_of(&open, &proposal);
        change(&mut counter);
        w.bob_decline_then_counter(&open, counter, false)
            .await
            .unwrap_or_else(|e| panic!("changing only {what} must be accepted: {e}"));
    }
}

// ---------------------------------------------------------------------------
// What a counter may name
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn a_counter_names_a_real_proposal() {
    let w = world().await;
    let (p, proposal) = w.propose().await;

    // `counters.agreement` naming the interest, which is not an agreement.
    let mut forged = counter_of(&p, &proposal);
    forged.counters = Some(Countering { agreement: w.interest.clone(), decline: p.clone() });
    let r = w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_agreement", forged)
        .await
        .map_err(|e| format!("{e:?}"));
    assert!(r.is_err(), "a counter naming something that is not an agreement must be refused");

    // `counters.agreement` naming a hash that does not exist.
    let mut missing = counter_of(&p, &proposal);
    missing.counters = Some(Countering {
        agreement: ActionHash::from_raw_36(vec![7; 36]),
        decline: p.clone(),
    });
    let r = w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_agreement", missing)
        .await
        .map_err(|e| format!("{e:?}"));
    assert!(r.is_err(), "a counter naming a missing proposal must be refused");

    // Countering a proposal on another listing with this one's terms.
    let other_offer: Record = w.conductors[0]
        .call(&w.alice.zome("offers"), "create_offer", sample_offer("Second offer"))
        .await;
    let other_offer = other_offer.signed_action.hashed.hash.clone();
    w.sync().await;
    let other_interest: Record = w.conductors[1]
        .call(&w.bob.zome("exchanges"), "create_interest", json!({ "listing": other_offer, "listing_type": "Offer" }))
        .await;
    let other_interest = other_interest.signed_action.hashed.hash.clone();
    w.sync().await;
    let q_input = serde_json::to_value(&proposal).unwrap();
    let q: Record = w.conductors[0]
        .call(
            &w.alice.zome("exchanges"),
            "create_agreement",
            json!({
                "listing": other_offer,
                "listing_type": "Offer",
                "interest": other_interest,
                "primary": q_input["primary"],
                "reciprocal": q_input["reciprocal"],
                "medium": proposal.medium,
                "terms": proposal.terms,
                "delivery_timeframe": proposal.delivery_timeframe
            }),
        )
        .await;
    let q = q.signed_action.hashed.hash.clone();
    w.sync().await;
    let cross = w.bob_decline_then_counter(&q, counter_of(&q, &proposal), false).await;
    refused(cross, "keeps the listing, the interest and the parties", "countering across listings");

    // Control.
    w.bob_decline_then_counter(&p, counter_of(&p, &proposal), false)
        .await
        .expect("a valid counter through the probe is accepted");
}

// ---------------------------------------------------------------------------
// The forward link
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn a_counter_link_points_at_the_real_counter() {
    let w = world().await;
    let (p, proposal) = w.propose().await;
    let (unrelated, _) = w.propose().await;
    let real = w
        .bob_decline_then_counter(&p, counter_of(&p, &proposal), false)
        .await
        .expect("counter");
    w.sync().await;

    let link = |base: &ActionHash, target: &ActionHash| ProbeLink { base: base.clone(), target: target.clone() };
    let attempts = [
        ("to an agreement that is not a counter", link(&p, &unrelated)),
        ("to a counter of a different proposal", link(&unrelated, &real.counter)),
        ("from something that is not an agreement", link(&w.interest, &real.counter)),
        ("to something that is not an agreement", link(&p, &real.decline)),
    ];
    for (what, input) in attempts {
        let r = w.conductors[1]
            .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_counter_link", input)
            .await
            .map_err(|e| format!("{e:?}"));
        assert!(r.is_err(), "a counter link {what} must be refused");
    }

    // Control: the true link, from the proposal to its counter.
    w.conductors[1]
        .call_fallible::<_, ActionHash>(
            &w.bob.zome("exchanges_probe"),
            "probe_create_counter_link",
            link(&p, &real.counter),
        )
        .await
        .expect("the true counter link is accepted");
}

// ---------------------------------------------------------------------------
// One live interest per member per listing (#354)
// ---------------------------------------------------------------------------

/// Bob already holds a live interest in Alice's offer (the world's). A second
/// one written past `create_interest`, so past the coordinator's look at his
/// own chain, is refused by validation with the rule named. Carol's first
/// through the same probe is accepted, and once Bob withdraws his, a new one
/// of his is accepted too.
#[tokio::test(flavor = "multi_thread")]
async fn a_second_live_interest_is_refused_past_the_coordinator() {
    let w = world().await;
    let bob_user = member_hash(&w.conductors[1], &w.bob).await;
    let bobs = Interest { listing: w.offer.clone(), listing_type: "Offer".into(), user: bob_user };

    let second = w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_interest", bobs.clone())
        .await
        .map_err(|e| format!("{e:?}"));
    refused(
        second,
        "this member already has an interest in this listing",
        "a second live interest past the coordinator",
    );

    // Control: Carol's first interest, through the same probe.
    let carol_user = member_hash(&w.conductors[2], &w.carol).await;
    w.conductors[2]
        .call_fallible::<_, ActionHash>(
            &w.carol.zome("exchanges_probe"),
            "probe_create_interest",
            Interest { listing: w.offer.clone(), listing_type: "Offer".into(), user: carol_user },
        )
        .await
        .expect("a first interest through the probe is accepted");

    // Withdrawn, the slot is free again: Bob's new one through the probe is accepted.
    let _: ActionHash = w.conductors[1]
        .call(&w.bob.zome("exchanges"), "withdraw_interest", w.interest.clone())
        .await;
    w.conductors[1]
        .call_fallible::<_, ActionHash>(&w.bob.zome("exchanges_probe"), "probe_create_interest", bobs)
        .await
        .expect("after withdrawing, an interest through the probe is accepted");
}
