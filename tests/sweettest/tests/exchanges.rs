//! Exchange record: interest, agreement, response, completion, review,
//! cancellation, with status derived from what exists.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde_json::{json, Value};

/// The coordinator's read model, mirrored here so Records deserialize as
/// Records; serde_json::Value cannot receive msgpack byte arrays.
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Exchange {
    agreement: Record,
    response: Option<Record>,
    provider_completion: Option<Record>,
    receiver_completion: Option<Record>,
    provider_review: Option<Record>,
    receiver_review: Option<Record>,
    cancellation: Option<Record>,
    status: String,
    countered_by: Option<ActionHash>,
}

/// The parts of an `Agreement` entry the counter tests read.
#[derive(Debug, Serialize, Deserialize)]
struct AgreementView {
    delivery_timeframe: String,
    counters: Option<CounteringView>,
}
holochain_serialized_bytes::holochain_serial!(AgreementView);

#[derive(Debug, Serialize, Deserialize)]
struct CounteringView {
    agreement: ActionHash,
    decline: ActionHash,
}

/// The parts of a `Response` entry the counter tests read.
#[derive(Debug, Serialize, Deserialize)]
struct ResponseView {
    accepted: bool,
    note: String,
}
holochain_serialized_bytes::holochain_serial!(ResponseView);

fn agreement_view(record: &Record) -> AgreementView {
    record.entry().to_app_option().unwrap().expect("agreement entry")
}

fn counter_input(agreement: &ActionHash, timeframe: &str) -> Value {
    json!({
        "agreement": agreement,
        "primary_quantity": { "value": 2.0, "unit": "h" },
        "reciprocal_quantity": null,
        "delivery_timeframe": timeframe
    })
}

fn service_term(direction: &str, what: &str) -> Value {
    json!({
        "direction": direction,
        "resource_conforms_to": what,
        "resource_kind": "Service",
        "quantity": { "value": 2.0, "unit": "h" }
    })
}

fn gift_term() -> Value {
    json!({
        "direction": "Receive",
        "resource_conforms_to": "",
        "resource_kind": "Gift",
        "quantity": null
    })
}

fn agreement_input(listing: &ActionHash, interest: &ActionHash) -> Value {
    json!({
        "listing": listing,
        "listing_type": "Offer",
        "interest": interest,
        "primary": service_term("Provide", "Web design"),
        "reciprocal": gift_term(),
        "medium": "Pay it forward",
        "terms": "Two hours of design review over a call, agreed by phone.",
        "delivery_timeframe": "Within two weeks"
    })
}

fn status_of(exchange: &Exchange) -> &str {
    exchange.status.as_str()
}

/// Alice (progenitor, admin) creates an offer; both users accepted.
/// Returns (conductors, alice, bob, offer_hash).
async fn setup_with_offer() -> (SweetConductorBatch, SweetCell, SweetCell, ActionHash) {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let offer: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Web design review"))
        .await;
    let offer_hash = offer.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    (conductors, alice, bob, offer_hash)
}

#[tokio::test(flavor = "multi_thread")]
async fn exchange_lifecycle_from_interest_to_reviewed() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    // Bob marks interest; Alice sees it on her listing.
    let interest: Record = conductors[1]
        .call(
            &bob.zome("exchanges"),
            "create_interest",
            json!({ "listing": offer_hash, "listing_type": "Offer" }),
        )
        .await;
    let interest_hash = interest.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let interests: Vec<Record> = conductors[0]
        .call(&alice.zome("exchanges"), "get_interests_for_listing", offer_hash.clone())
        .await;
    assert_eq!(interests.len(), 1, "Alice sees Bob's interest on her listing");

    // They talk off-app. Bob writes it up: either party may.
    let agreement: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_agreement", agreement_input(&offer_hash, &interest_hash))
        .await;
    let agreement_hash = agreement.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Proposed");

    // Alice, the counterparty, accepts.
    let _: Record = conductors[0]
        .call(
            &alice.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": agreement_hash, "accepted": true, "note": "Looking forward to it." }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[1]
        .call(&bob.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Agreed");

    // Alice provides (it is her offer) and marks done first.
    let _: Record = conductors[0]
        .call(&alice.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[1]
        .call(&bob.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "OneSideDone");

    // Bob marks done; both signed the same agreement as complete.
    let _: Record = conductors[1]
        .call(&bob.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Complete");
    assert!(ex.provider_completion.is_some() && ex.receiver_completion.is_some());

    // Both review.
    for (i, cell) in [(0usize, &alice), (1usize, &bob)] {
        let _: Record = conductors[i]
            .call(
                &cell.zome("exchanges"),
                "review_agreement",
                json!({ "agreement": agreement_hash, "rating": 5, "on_time": true, "as_agreed": true, "comment": "Great." }),
            )
            .await;
    }
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[1]
        .call(&bob.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Reviewed");

    // Each party's dashboard holds the one exchange.
    let mine: Vec<Exchange> = conductors[0].call(&alice.zome("exchanges"), "get_my_exchanges", ()).await;
    let theirs: Vec<Exchange> = conductors[1].call(&bob.zome("exchanges"), "get_my_exchanges", ()).await;
    assert_eq!(mine.len(), 1);
    assert_eq!(theirs.len(), 1);
}

/// Either party may mark their part done first. The zome takes a completion
/// from whoever is ready, so the status has to reflect one side being done
/// whichever side that is - not only the provider.
#[tokio::test(flavor = "multi_thread")]
async fn the_receiver_may_mark_done_first() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    let interest: Record = conductors[1]
        .call(
            &bob.zome("exchanges"),
            "create_interest",
            json!({ "listing": offer_hash, "listing_type": "Offer" }),
        )
        .await;
    let interest_hash = interest.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let agreement: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_agreement", agreement_input(&offer_hash, &interest_hash))
        .await;
    let agreement_hash = agreement.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: Record = conductors[0]
        .call(
            &alice.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": agreement_hash, "accepted": true, "note": "Yes." }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob receives on Alice's offer, and marks his part done before she does.
    let _: Record = conductors[1]
        .call(&bob.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert!(ex.receiver_completion.is_some(), "Bob's completion is recorded");
    assert_ne!(
        status_of(&ex),
        "Agreed",
        "one side is done, so the exchange is no longer merely agreed"
    );
    assert_eq!(status_of(&ex), "OneSideDone");

    // Alice marks hers; both are in, and it completes as usual.
    let _: Record = conductors[0]
        .call(&alice.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[1]
        .call(&bob.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Complete");
}

#[tokio::test(flavor = "multi_thread")]
async fn agreement_declined_by_the_counterparty() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    let interest: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer_hash, "listing_type": "Offer" }))
        .await;
    let interest_hash = interest.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Alice writes it up this time; Bob is the counterparty and declines.
    let agreement: Record = conductors[0]
        .call(&alice.zome("exchanges"), "create_agreement", agreement_input(&offer_hash, &interest_hash))
        .await;
    let agreement_hash = agreement.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: Record = conductors[1]
        .call(
            &bob.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": agreement_hash, "accepted": false, "note": "Timing does not work." }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Declined");

    // A declined agreement cannot be completed.
    let done = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("exchanges"), "complete_agreement", agreement_hash)
        .await;
    assert!(done.is_err(), "completion of a declined agreement must be refused");
}

#[tokio::test(flavor = "multi_thread")]
async fn agreement_cancelled_after_acceptance() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    let interest: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer_hash, "listing_type": "Offer" }))
        .await;
    let interest_hash = interest.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let agreement: Record = conductors[0]
        .call(&alice.zome("exchanges"), "create_agreement", agreement_input(&offer_hash, &interest_hash))
        .await;
    let agreement_hash = agreement.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let _: Record = conductors[1]
        .call(
            &bob.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": agreement_hash, "accepted": true, "note": "" }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob cancels; either party may.
    let _: Record = conductors[1]
        .call(
            &bob.zome("exchanges"),
            "cancel_agreement",
            json!({ "agreement": agreement_hash, "note": "Something came up." }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Cancelled");

    let done = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("exchanges"), "complete_agreement", agreement_hash)
        .await;
    assert!(done.is_err(), "completion of a cancelled agreement must be refused");
}

#[tokio::test(flavor = "multi_thread")]
async fn exchange_refusals() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    // A member cannot register interest in their own listing.
    let own = conductors[0]
        .call_fallible::<_, Record>(
            &alice.zome("exchanges"),
            "create_interest",
            json!({ "listing": offer_hash, "listing_type": "Offer" }),
        )
        .await;
    assert!(own.is_err(), "interest in your own listing must be refused");

    let interest: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer_hash, "listing_type": "Offer" }))
        .await;
    let interest_hash = interest.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob writes the agreement, so Bob is not its counterparty and cannot respond to it.
    let agreement: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_agreement", agreement_input(&offer_hash, &interest_hash))
        .await;
    let agreement_hash = agreement.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let self_response = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": agreement_hash, "accepted": true, "note": "" }),
        )
        .await;
    assert!(self_response.is_err(), "the author of an agreement cannot respond to it");

    // Completion before acceptance is refused.
    let early = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    assert!(early.is_err(), "completion before acceptance must be refused");

    // Alice accepts once; a second response is refused.
    let _: Record = conductors[0]
        .call(
            &alice.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": agreement_hash, "accepted": true, "note": "" }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let second = conductors[0]
        .call_fallible::<_, Record>(
            &alice.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": agreement_hash, "accepted": true, "note": "" }),
        )
        .await;
    assert!(second.is_err(), "a second response must be refused");

    // A party completes once; a second completion by the same party is refused.
    let _: Record = conductors[0]
        .call(&alice.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let again = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    assert!(again.is_err(), "a second completion by the same party must be refused");

    // A rating above five is refused by validation.
    let bad_review = conductors[0]
        .call_fallible::<_, Record>(
            &alice.zome("exchanges"),
            "review_agreement",
            json!({ "agreement": agreement_hash, "rating": 6, "on_time": true, "as_agreed": true, "comment": "" }),
        )
        .await;
    assert!(bad_review.is_err(), "a rating above five must be refused");
}

/// A counter declines the proposal and answers it in one call, and each round
/// names the one before it, so a negotiation reads as a chain (#333).
#[tokio::test(flavor = "multi_thread")]
async fn counter_proposals_form_a_chain() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    let interest: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer_hash, "listing_type": "Offer" }))
        .await;
    let interest_hash = interest.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Alice proposes; Bob is the counterparty.
    let first: Record = conductors[0]
        .call(&alice.zome("exchanges"), "create_agreement", agreement_input(&offer_hash, &interest_hash))
        .await;
    let first_hash = first.signed_action.hashed.hash.clone();
    assert!(agreement_view(&first).counters.is_none(), "a first proposal counters nothing");
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob counters with a different timeframe.
    let second: Record = conductors[1]
        .call(&bob.zome("exchanges"), "counter_agreement", counter_input(&first_hash, "Within a month"))
        .await;
    let second_hash = second.signed_action.hashed.hash.clone();
    let second_view = agreement_view(&second);
    assert_eq!(second_view.delivery_timeframe, "Within a month");
    let countering = second_view.counters.expect("a counter names what it answers");
    assert_eq!(countering.agreement, first_hash);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // The original is declined with the counter's note, by Bob, and points forward.
    let first_ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", first_hash.clone())
        .await;
    assert_eq!(status_of(&first_ex), "Declined");
    let response = first_ex.response.expect("the original carries the decline");
    assert_eq!(response.signed_action.hashed.hash, countering.decline);
    let response_view: ResponseView = response.entry().to_app_option().unwrap().expect("response entry");
    assert!(!response_view.accepted);
    assert_eq!(response_view.note, "Countered with a new proposal");
    assert_eq!(first_ex.countered_by, Some(second_hash.clone()));

    // The counter is open, and Alice is now the one to answer it: she counters back.
    let second_ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", second_hash.clone())
        .await;
    assert_eq!(status_of(&second_ex), "Proposed");
    let third: Record = conductors[0]
        .call(&alice.zome("exchanges"), "counter_agreement", counter_input(&second_hash, "Flexible"))
        .await;
    let third_hash = third.signed_action.hashed.hash.clone();
    assert_eq!(agreement_view(&third).counters.expect("counter").agreement, second_hash);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob accepts the third round; the chain reads first -> second -> third.
    let _: Record = conductors[1]
        .call(
            &bob.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": third_hash, "accepted": true, "note": "" }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let second_ex: Exchange = conductors[1]
        .call(&bob.zome("exchanges"), "get_exchange", second_hash.clone())
        .await;
    assert_eq!(status_of(&second_ex), "Declined");
    assert_eq!(second_ex.countered_by, Some(third_hash.clone()));
    let third_ex: Exchange = conductors[1]
        .call(&bob.zome("exchanges"), "get_exchange", third_hash)
        .await;
    assert_eq!(status_of(&third_ex), "Agreed");
    assert_eq!(third_ex.countered_by, None);
}

/// Who may counter, and when; and a counter that changes nothing.
#[tokio::test(flavor = "multi_thread")]
async fn counter_refusals() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    let interest: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer_hash, "listing_type": "Offer" }))
        .await;
    let interest_hash = interest.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let proposal: Record = conductors[0]
        .call(&alice.zome("exchanges"), "create_agreement", agreement_input(&offer_hash, &interest_hash))
        .await;
    let proposal_hash = proposal.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // The proposal's author cannot counter it.
    let own = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("exchanges"), "counter_agreement", counter_input(&proposal_hash, "Flexible"))
        .await;
    assert!(own.is_err(), "the author of a proposal cannot counter it");

    // A counter that changes nothing is refused, by validation.
    let unchanged = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("exchanges"),
            "counter_agreement",
            counter_input(&proposal_hash, "Within two weeks"),
        )
        .await;
    assert!(unchanged.is_err(), "a counter must change a quantity or the timeframe");

    // Once the proposal is accepted it cannot be countered.
    let _: Record = conductors[1]
        .call(
            &bob.zome("exchanges"),
            "respond_to_agreement",
            json!({ "agreement": proposal_hash, "accepted": true, "note": "" }),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let late = conductors[1]
        .call_fallible::<_, Record>(&bob.zome("exchanges"), "counter_agreement", counter_input(&proposal_hash, "Flexible"))
        .await;
    assert!(late.is_err(), "an answered proposal cannot be countered");
    let ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", proposal_hash)
        .await;
    assert_eq!(status_of(&ex), "Agreed", "a refused counter leaves the proposal as it was");
    assert_eq!(ex.countered_by, None);
}

// ---------------------------------------------------------------------------
// Counter-proposals through the app's own calls, with three members (#333).
// ---------------------------------------------------------------------------

struct Three {
    conductors: SweetConductorBatch,
    alice: SweetCell,
    bob: SweetCell,
    carol: SweetCell,
}

impl Three {
    async fn sync(&self) {
        await_consistency_s(30, [&self.alice, &self.bob, &self.carol]).await.unwrap();
    }
}

async fn user_of(conductor: &SweetConductor, cell: &SweetCell) -> ActionHash {
    let links: Vec<Link> = conductor
        .call(&cell.zome("users_organizations"), "get_agent_user", cell.agent_pubkey().clone())
        .await;
    links[0].target.clone().into_action_hash().unwrap()
}

/// Alice (admin) and Bob accepted; Carol accepted only when `carol_accepted`.
async fn three_members(carol_accepted: bool) -> Three {
    let (conductors, mut cells) = setup_agents_with_alice_as_progenitor(3, false).await;
    let carol = cells.pop().unwrap();
    let bob = cells.pop().unwrap();
    let alice = cells.pop().unwrap();
    for (i, (cell, name)) in [(&alice, "Alice"), (&bob, "Bob"), (&carol, "Carol")].into_iter().enumerate() {
        conductors[i]
            .call::<_, Record>(&cell.zome("users_organizations"), "create_user", sample_user(name))
            .await;
    }
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();
    let mut accept = vec![(0, &alice), (1, &bob)];
    if carol_accepted {
        accept.push((2, &carol));
    }
    for (i, cell) in accept {
        let user = user_of(&conductors[i], cell).await;
        accept_entity(&conductors[0], &alice, ENTITY_USERS, user).await;
    }
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();
    Three { conductors, alice, bob, carol }
}

fn currency_agreement(listing: &ActionHash, listing_type: &str, interest: &ActionHash) -> Value {
    json!({
        "listing": listing,
        "listing_type": listing_type,
        "interest": interest,
        "primary": service_term("Provide", "Gardening"),
        "reciprocal": {
            "direction": "Receive",
            "resource_conforms_to": "Time bank hours",
            "resource_kind": "Currency",
            "quantity": { "value": 2.0, "unit": "Time bank hours" }
        },
        "medium": "Time bank hours",
        "terms": "",
        "delivery_timeframe": "Within 2 weeks"
    })
}

/// On a request the roles swap: the interested member provides. Countering
/// works the same way, and each permitted change works on its own.
#[tokio::test(flavor = "multi_thread")]
async fn counters_on_a_request_and_each_permitted_change() {
    let t = three_members(true).await;
    // Alice requests; Bob offers to help.
    let request: Record = t.conductors[0]
        .call(&t.alice.zome("requests"), "create_request", sample_request("Garden help"))
        .await;
    let request = request.signed_action.hashed.hash.clone();
    t.sync().await;
    let interest: Record = t.conductors[1]
        .call(&t.bob.zome("exchanges"), "create_interest", json!({ "listing": request, "listing_type": "Request" }))
        .await;
    let interest = interest.signed_action.hashed.hash.clone();
    t.sync().await;

    let changes = [
        ("the primary quantity", json!({ "value": 5.0, "unit": "h" }), json!({ "value": 2.0, "unit": "Time bank hours" }), "Within 2 weeks"),
        ("the return quantity", json!({ "value": 2.0, "unit": "h" }), json!({ "value": 6.0, "unit": "Time bank hours" }), "Within 2 weeks"),
        ("both quantities to none", Value::Null, Value::Null, "Within 2 weeks"),
        ("the timeframe", json!({ "value": 2.0, "unit": "h" }), json!({ "value": 2.0, "unit": "Time bank hours" }), "Flexible"),
    ];
    for (what, primary, reciprocal, timeframe) in changes {
        // Alice proposes to Bob; Bob counters with one change.
        let proposal: Record = t.conductors[0]
            .call(&t.alice.zome("exchanges"), "create_agreement", currency_agreement(&request, "Request", &interest))
            .await;
        let proposal = proposal.signed_action.hashed.hash.clone();
        t.sync().await;
        let counter = t.conductors[1]
            .call_fallible::<_, Record>(
                &t.bob.zome("exchanges"),
                "counter_agreement",
                json!({
                    "agreement": proposal,
                    "primary_quantity": primary,
                    "reciprocal_quantity": reciprocal,
                    "delivery_timeframe": timeframe
                }),
            )
            .await
            .unwrap_or_else(|e| panic!("a counter changing only {what} must be accepted: {e:?}"));
        let view = agreement_view(&counter);
        assert_eq!(view.counters.expect("counters").agreement, proposal, "{what}");
        t.sync().await;
    }
}

/// Two negotiations between the same pair on the same listing stay separate:
/// each counter names its own proposal, and each proposal points at its own.
#[tokio::test(flavor = "multi_thread")]
async fn parallel_negotiations_stay_separate() {
    let t = three_members(true).await;
    let offer: Record = t.conductors[0]
        .call(&t.alice.zome("offers"), "create_offer", sample_offer("Web design review"))
        .await;
    let offer = offer.signed_action.hashed.hash.clone();
    t.sync().await;
    let interest: Record = t.conductors[1]
        .call(&t.bob.zome("exchanges"), "create_interest", json!({ "listing": offer, "listing_type": "Offer" }))
        .await;
    let interest = interest.signed_action.hashed.hash.clone();
    t.sync().await;

    let mut proposals = Vec::new();
    for _ in 0..2 {
        let r: Record = t.conductors[0]
            .call(&t.alice.zome("exchanges"), "create_agreement", agreement_input(&offer, &interest))
            .await;
        proposals.push(r.signed_action.hashed.hash.clone());
    }
    t.sync().await;

    let mut counters = Vec::new();
    for (p, timeframe) in proposals.iter().zip(["Within a month", "Flexible"]) {
        let c: Record = t.conductors[1]
            .call(&t.bob.zome("exchanges"), "counter_agreement", counter_input(p, timeframe))
            .await;
        counters.push(c);
    }
    t.sync().await;

    for (p, c) in proposals.iter().zip(&counters) {
        let c_hash = c.signed_action.hashed.hash.clone();
        assert_eq!(agreement_view(c).counters.expect("counters").agreement, *p);
        let ex: Exchange = t.conductors[0].call(&t.alice.zome("exchanges"), "get_exchange", p.clone()).await;
        assert_eq!(ex.countered_by, Some(c_hash));
        assert_eq!(status_of(&ex), "Declined");
    }
    assert_ne!(
        counters[0].signed_action.hashed.hash, counters[1].signed_action.hashed.hash,
        "two counters, one per negotiation"
    );
}

/// Who may counter and when, through the app's own call.
#[tokio::test(flavor = "multi_thread")]
async fn counter_refusals_by_member_and_state() {
    let t = three_members(false).await;
    let offer: Record = t.conductors[0]
        .call(&t.alice.zome("offers"), "create_offer", sample_offer("Web design review"))
        .await;
    let offer = offer.signed_action.hashed.hash.clone();
    t.sync().await;
    let interest: Record = t.conductors[1]
        .call(&t.bob.zome("exchanges"), "create_interest", json!({ "listing": offer, "listing_type": "Offer" }))
        .await;
    let interest = interest.signed_action.hashed.hash.clone();
    t.sync().await;
    let propose = || async {
        let r: Record = t.conductors[0]
            .call(&t.alice.zome("exchanges"), "create_agreement", agreement_input(&offer, &interest))
            .await;
        t.sync().await;
        r.signed_action.hashed.hash.clone()
    };

    // Carol is not accepted: refused before anything else.
    let p = propose().await;
    let pending = t.conductors[2]
        .call_fallible::<_, Record>(&t.carol.zome("exchanges"), "counter_agreement", counter_input(&p, "Flexible"))
        .await;
    assert!(pending.is_err(), "a member who is not accepted cannot counter");

    // Carol accepted now, but she is not a party.
    let carol_user = user_of(&t.conductors[2], &t.carol).await;
    accept_entity(&t.conductors[0], &t.alice, ENTITY_USERS, carol_user).await;
    t.sync().await;
    let third = t.conductors[2]
        .call_fallible::<_, Record>(&t.carol.zome("exchanges"), "counter_agreement", counter_input(&p, "Flexible"))
        .await;
    assert!(third.is_err(), "a member who is not a party cannot counter");

    // After a plain decline.
    let _: Record = t.conductors[1]
        .call(&t.bob.zome("exchanges"), "respond_to_agreement", json!({ "agreement": p, "accepted": false, "note": "No thanks." }))
        .await;
    t.sync().await;
    let after_decline = t.conductors[1]
        .call_fallible::<_, Record>(&t.bob.zome("exchanges"), "counter_agreement", counter_input(&p, "Flexible"))
        .await;
    assert!(after_decline.is_err(), "a declined proposal cannot be countered");

    // After the proposer withdraws.
    let w = propose().await;
    let _: Record = t.conductors[0]
        .call(&t.alice.zome("exchanges"), "cancel_agreement", json!({ "agreement": w, "note": "Withdrawn by the proposer" }))
        .await;
    t.sync().await;
    let after_withdraw = t.conductors[1]
        .call_fallible::<_, Record>(&t.bob.zome("exchanges"), "counter_agreement", counter_input(&w, "Flexible"))
        .await;
    assert!(after_withdraw.is_err(), "a withdrawn proposal cannot be countered");

    // Withdrawing a counter leaves the original declined, not reopened.
    let o = propose().await;
    let c: Record = t.conductors[1]
        .call(&t.bob.zome("exchanges"), "counter_agreement", counter_input(&o, "Flexible"))
        .await;
    let c = c.signed_action.hashed.hash.clone();
    t.sync().await;
    let _: Record = t.conductors[1]
        .call(&t.bob.zome("exchanges"), "cancel_agreement", json!({ "agreement": c, "note": "Withdrawn by the proposer" }))
        .await;
    t.sync().await;
    let original: Exchange = t.conductors[0].call(&t.alice.zome("exchanges"), "get_exchange", o).await;
    assert_eq!(status_of(&original), "Declined");
    let withdrawn: Exchange = t.conductors[0].call(&t.alice.zome("exchanges"), "get_exchange", c).await;
    assert_eq!(status_of(&withdrawn), "Cancelled");
}

/// One live interest per member per listing (#354). A second is refused, one
/// on another listing is not, and after withdrawing a member may show
/// interest again.
#[tokio::test(flavor = "multi_thread")]
async fn one_live_interest_per_listing() {
    let (conductors, alice, bob, offer_hash) = setup_with_offer().await;

    let first: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer_hash, "listing_type": "Offer" }))
        .await;
    let first_hash = first.signed_action.hashed.hash.clone();

    let second = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("exchanges"),
            "create_interest",
            json!({ "listing": offer_hash, "listing_type": "Offer" }),
        )
        .await;
    let refusal = format!("{:?}", second.expect_err("a second live interest must be refused"));
    assert!(
        refusal.contains("already shown interest in this listing"),
        "the refusal names the rule: {refusal}"
    );

    // Interest in a different listing is unaffected.
    let other: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Garden help"))
        .await;
    let other_hash = other.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let _: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": other_hash, "listing_type": "Offer" }))
        .await;

    // Withdrawn, then shown again: allowed, and only the new one is live.
    let _: ActionHash = conductors[1]
        .call(&bob.zome("exchanges"), "withdraw_interest", first_hash.clone())
        .await;
    let again: Record = conductors[1]
        .call(&bob.zome("exchanges"), "create_interest", json!({ "listing": offer_hash, "listing_type": "Offer" }))
        .await;
    assert_ne!(again.signed_action.hashed.hash, first_hash);

    let third = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("exchanges"),
            "create_interest",
            json!({ "listing": offer_hash, "listing_type": "Offer" }),
        )
        .await;
    assert!(third.is_err(), "the renewed interest is live, so another is refused");
}
