//! Mediums of exchange zome tests.
//! Translated from `mediums-of-exchange-tests/mediums-of-exchange.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_medium_of_exchange_suggestion_and_approval_workflow() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Create users.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();

    // Register Alice as network admin.
    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "register_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash,
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Bob suggests a medium of exchange.
    let moe_record: Record = conductors[1]
        .call(
            &bob.zome("mediums_of_exchange"),
            "suggest_medium_of_exchange",
            sample_medium_of_exchange("USD", "US Dollar"),
        )
        .await;
    let moe_hash = moe_record.signed_action.hashed.hash.clone();

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Verify it's in the pending list.
    let pending: Vec<Record> = conductors[0]
        .call(&alice.zome("mediums_of_exchange"), "get_pending_mediums_of_exchange", ())
        .await;
    assert!(!pending.is_empty(), "Should have a pending MoE");

    // Alice approves it.
    let _: () = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "approve_medium_of_exchange",
            moe_hash.clone(),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Verify it moved to approved list.
    let approved: Vec<Record> = conductors[0]
        .call(&alice.zome("mediums_of_exchange"), "get_approved_mediums_of_exchange", ())
        .await;
    assert!(!approved.is_empty(), "Should have an approved MoE");

    let pending_after: Vec<Record> = conductors[0]
        .call(&alice.zome("mediums_of_exchange"), "get_pending_mediums_of_exchange", ())
        .await;
    assert!(pending_after.is_empty(), "No pending MoEs after approval");

    // Bob suggests another MoE.
    let bad_moe_record: Record = conductors[1]
        .call(
            &bob.zome("mediums_of_exchange"),
            "suggest_medium_of_exchange",
            sample_medium_of_exchange("EUR", "Euro"),
        )
        .await;
    let bad_moe_hash = bad_moe_record.signed_action.hashed.hash.clone();

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Alice rejects it.
    let _: () = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "reject_medium_of_exchange",
            bad_moe_hash,
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let rejected: Vec<Record> = conductors[0]
        .call(&alice.zome("mediums_of_exchange"), "get_rejected_mediums_of_exchange", ())
        .await;
    assert!(!rejected.is_empty(), "Should have a rejected MoE");
}
