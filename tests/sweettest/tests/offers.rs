//! Offers zome tests.
//! Translated from `offers-tests/offers.test.ts` and `offers-archive.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_offer_crud_operations() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users. Alice (progenitor) is auto-registered as admin via init callback.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Accept Alice's user profile so she can create offers.
    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash).await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Alice creates an offer.
    let offer_record: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Offering web design help"))
        .await;

    let offer_hash = offer_record.signed_action.hashed.hash.clone();

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Bob reads the offer.
    let offer_from_bob: Option<Record> = conductors[1]
        .call(&bob.zome("offers"), "get_latest_offer_record", offer_hash.clone())
        .await;
    assert!(offer_from_bob.is_some(), "Bob should read the offer");

    // Get all offers.
    let all_offers: Vec<Link> = conductors[0]
        .call(&alice.zome("offers"), "get_active_offers", ())
        .await;
    assert!(!all_offers.is_empty());

    // Alice updates the offer.
    let mut updated_input = sample_offer("Updated offer title");
    updated_input.offer.title = "Updated offer title".to_string();
    let _: Record = conductors[0]
        .call(
            &alice.zome("offers"),
            "update_offer",
            serde_json::json!({
                "original_action_hash": offer_hash,
                "previous_action_hash": offer_record.signed_action.hashed.hash,
                "updated_offer": updated_input
            }),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[0]
        .call(&alice.zome("offers"), "get_latest_offer_record", offer_hash.clone())
        .await;
    let updated_offer: Offer = latest.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(updated_offer.title, "Updated offer title");
}

#[tokio::test(flavor = "multi_thread")]
async fn offer_archive_and_delete() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create user. Alice (progenitor) is auto-registered as admin via init callback.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Accept Alice's user profile so she can create offers.
    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash).await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Alice creates an offer.
    let offer_record: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Offer to archive"))
        .await;
    let offer_hash = offer_record.signed_action.hashed.hash.clone();

    // Archive the offer (set status to Archived).
    let archived_input = CreateOfferInput {
        offer: OfferData {
            title: "Offer to archive".to_string(),
            status: "Archived".to_string(),
            ..sample_offer("x").offer
        },
        ..sample_offer("x")
    };
    let _: Record = conductors[0]
        .call(
            &alice.zome("offers"),
            "update_offer",
            serde_json::json!({
                "original_action_hash": offer_hash,
                "previous_action_hash": offer_record.signed_action.hashed.hash,
                "updated_offer": archived_input
            }),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let archived: Option<Record> = conductors[0]
        .call(&alice.zome("offers"), "get_latest_offer_record", offer_hash.clone())
        .await;
    let archived_offer: Offer =
        archived.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(archived_offer.status, "Archived");

    // Delete the offer.
    let _: ActionHash = conductors[0]
        .call(&alice.zome("offers"), "delete_offer", offer_hash.clone())
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let after_delete: Option<Record> = conductors[1]
        .call(&bob.zome("offers"), "get_latest_offer_record", offer_hash)
        .await;
    assert!(after_delete.is_none(), "Deleted offer should not be found");
}
