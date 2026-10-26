//! Review probes for #333 (Aria, 17 October). What `exchanges_attacks.rs`
//! does not try. Each test prints what it saw; assertions are only on the
//! things the rules promise, so an unexpected acceptance is reported rather
//! than hidden.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde_json::json;
use std::time::Instant;

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
    delivery_timeframe: Timeframe,
    counters: Option<Countering>,
}
holochain_serialized_bytes::holochain_serial!(Agreement);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
struct Response {
    agreement: ActionHash,
    accepted: bool,
    note: String,
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

#[derive(Debug, Serialize, Deserialize)]
struct ExchangeView {
    status: String,
    countered_by: Option<ActionHash>,
}

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
                    "delivery_timeframe": { "Preset": "WithinTwoWeeks" }
                }),
            )
            .await;
        self.sync().await;
        let entry: Agreement = record.entry().to_app_option().unwrap().expect("agreement");
        (record.signed_action.hashed.hash.clone(), entry)
    }

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
                ProbeDeclineThenCounter { decline: decline_of(countered), counter, gap },
            )
            .await
            .map_err(|e| format!("{e:?}"))
    }

    async fn view(&self, who: usize, agreement: &ActionHash) -> ExchangeView {
        let cell = match who {
            0 => &self.alice,
            1 => &self.bob,
            _ => &self.carol,
        };
        self.conductors[who]
            .call(&cell.zome("exchanges"), "get_exchange", agreement.clone())
            .await
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

fn counter_of(countered: &ActionHash, proposal: &Agreement) -> Agreement {
    let mut counter = proposal.clone();
    counter.counterparty = if proposal.counterparty == proposal.provider {
        proposal.receiver.clone()
    } else {
        proposal.provider.clone()
    };
    counter.delivery_timeframe = Timeframe::Preset(TimeframePreset::Flexible);
    counter.counters = Some(Countering { agreement: countered.clone(), decline: countered.clone() });
    counter
}

fn decline_of(agreement: &ActionHash) -> Response {
    Response { agreement: agreement.clone(), accepted: false, note: "Countered with a new proposal".into() }
}

// ---------------------------------------------------------------------------
// 1. A withdrawn proposal: the coordinator refuses to counter it. Does
//    validation? Nothing in validate_response or validate_counter reads the
//    cancellation, so the expectation is that the probe write is accepted.
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn review_withdrawn_proposal_through_the_probe() {
    let w = world().await;
    let (p, proposal) = w.propose().await;
    w.conductors[0]
        .call::<_, Record>(
            &w.alice.zome("exchanges"),
            "cancel_agreement",
            json!({ "agreement": p, "note": "Changed my mind" }),
        )
        .await;
    w.sync().await;
    let before = w.view(2, &p).await;
    eprintln!("REVIEW withdrawn: Carol sees the original as {before:?}");

    // Through the app: refused.
    let via_app = w.conductors[1]
        .call_fallible::<_, Record>(
            &w.bob.zome("exchanges"),
            "counter_agreement",
            json!({
                "agreement": p,
                "primary_quantity": { "value": 3.0, "unit": "h" },
                "reciprocal_quantity": { "value": 2.0, "unit": "Time bank hours" },
                "delivery_timeframe": { "Preset": "WithinTwoWeeks" }
            }),
        )
        .await
        .map_err(|e| format!("{e:?}"));
    assert!(via_app.is_err(), "the coordinator must refuse to counter a withdrawn proposal");
    eprintln!("REVIEW withdrawn: coordinator refused with {:?}", via_app.err());

    // Through the probe: what validation alone says.
    let r = w.bob_decline_then_counter(&p, counter_of(&p, &proposal), false).await;
    eprintln!("REVIEW withdrawn: probe decline+counter of a withdrawn proposal -> {r:?}");
    w.sync().await;
    let after = w.view(2, &p).await;
    eprintln!("REVIEW withdrawn: Carol now sees the original as {after:?}");
    // Sam's ruling (17 October): accepted. Validation cannot see a withdrawal
    // on the proposer's chain, and the two can cross even between honest
    // members. The original reads as withdrawn and the counter stands as a new
    // proposal the proposer can decline; the display says it answers a
    // withdrawn proposal.
    let out = r.expect("validation accepts a counter of a withdrawn proposal, by ruling");
    assert_eq!(after.status, "Cancelled", "the original still reads as withdrawn");
    let c = w.view(2, &out.counter).await;
    eprintln!("REVIEW withdrawn: Carol sees the counter as {c:?}");
    assert_eq!(c.status, "Proposed", "the counter stands as an open proposal");
}

// ---------------------------------------------------------------------------
// 2. Remote validation. Carol is not a party; her node has to validate Bob's
//    decline (must_get_agent_activity over Bob's chain) and counter
//    (must_get_valid_record of the decline) from the network, not a scratch.
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn review_remote_members_validate_the_chain() {
    let w = world().await;
    let (p, _) = w.propose().await;
    let first: Record = w.conductors[1]
        .call(
            &w.bob.zome("exchanges"),
            "counter_agreement",
            json!({
                "agreement": p,
                "primary_quantity": { "value": 3.0, "unit": "h" },
                "reciprocal_quantity": { "value": 2.0, "unit": "Time bank hours" },
                "delivery_timeframe": { "Preset": "WithinTwoWeeks" }
            }),
        )
        .await;
    let c1 = first.signed_action.hashed.hash.clone();
    w.sync().await;

    for who in [0usize, 2] {
        let original = w.view(who, &p).await;
        let counter = w.view(who, &c1).await;
        eprintln!("REVIEW remote: node {who} sees original {original:?}, counter {counter:?}");
        assert_eq!(original.status, "Declined");
        assert_eq!(original.countered_by, Some(c1.clone()));
        assert_eq!(counter.status, "Proposed");
    }

    // Round two from the other side, read by the third party.
    let second: Record = w.conductors[0]
        .call(
            &w.alice.zome("exchanges"),
            "counter_agreement",
            json!({
                "agreement": c1,
                "primary_quantity": { "value": 3.0, "unit": "h" },
                "reciprocal_quantity": { "value": 3.0, "unit": "Time bank hours" },
                "delivery_timeframe": { "Preset": "WithinTwoWeeks" }
            }),
        )
        .await;
    let c2 = second.signed_action.hashed.hash.clone();
    w.sync().await;
    let c1_view = w.view(2, &c1).await;
    let c2_view = w.view(2, &c2).await;
    eprintln!("REVIEW remote: Carol sees round one {c1_view:?}, round two {c2_view:?}");
    assert_eq!(c1_view.status, "Declined");
    assert_eq!(c1_view.countered_by, Some(c2.clone()));
    assert_eq!(c2_view.status, "Proposed");
}

// ---------------------------------------------------------------------------
// 3. The forward link has no author rule: can a third member write it?
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn review_a_third_member_writes_the_forward_link() {
    let w = world().await;
    let (p, proposal) = w.propose().await;
    let real = w
        .bob_decline_then_counter(&p, counter_of(&p, &proposal), false)
        .await
        .expect("counter");
    w.sync().await;
    let r = w.conductors[2]
        .call_fallible::<_, ActionHash>(
            &w.carol.zome("exchanges_probe"),
            "probe_create_counter_link",
            ProbeLink { base: p.clone(), target: real.counter.clone() },
        )
        .await
        .map_err(|e| format!("{e:?}"));
    eprintln!("REVIEW link: Carol writing the true forward link -> {r:?}");
    // Ruled 17 October: only the counter's author writes the link.
    assert!(
        r.as_ref().is_err_and(|e| e.contains("only the counter's author")),
        "a third member's forward link must be refused: {r:?}"
    );
}

// ---------------------------------------------------------------------------
// 4. Cost: every response reads the author's whole chain. Measure the time of
//    Bob's decline as his chain grows, against Alice's proposal (no chain read).
// ---------------------------------------------------------------------------

#[tokio::test(flavor = "multi_thread")]
async fn review_response_cost_as_the_chain_grows() {
    let w = world().await;
    let rounds = 40;
    let mut table = Vec::new();
    for i in 0..rounds {
        let t0 = Instant::now();
        let (p, _) = w.propose().await;
        let propose_ms = t0.elapsed().as_millis();
        let t1 = Instant::now();
        let _: Record = w.conductors[1]
            .call(
                &w.bob.zome("exchanges"),
                "respond_to_agreement",
                json!({ "agreement": p, "accepted": false, "note": "no" }),
            )
            .await;
        let decline_ms = t1.elapsed().as_millis();
        table.push((i, propose_ms, decline_ms));
    }
    eprintln!("REVIEW cost: round, propose+sync ms, decline ms (Bob's chain grows by 2 per round)");
    for (i, p, d) in &table {
        eprintln!("REVIEW cost: {i:>3} {p:>6} {d:>6}");
    }
}
