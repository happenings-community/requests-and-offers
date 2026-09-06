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
    completions: Vec<Record>,
    reviews: Vec<Record>,
    cancellation: Option<Record>,
    status: String,
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
    assert_eq!(status_of(&ex), "ProviderDelivered");

    // Bob marks done; both signed the same agreement as complete.
    let _: Record = conductors[1]
        .call(&bob.zome("exchanges"), "complete_agreement", agreement_hash.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let ex: Exchange = conductors[0]
        .call(&alice.zome("exchanges"), "get_exchange", agreement_hash.clone())
        .await;
    assert_eq!(status_of(&ex), "Complete");
    assert_eq!(ex.completions.len(), 2);

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
