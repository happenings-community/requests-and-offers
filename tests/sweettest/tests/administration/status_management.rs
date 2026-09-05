//! Status management tests.
//! Translated from `administration/status-management.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn user_status_management_and_suspension_workflow() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users.
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
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;

    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();

    // Register Alice as administrator.
    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash.clone(),
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Verify Alice is administrator.
    let alice_is_admin: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "check_if_entity_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "entity_original_action_hash": alice_user_hash
            }),
        )
        .await;
    assert!(alice_is_admin);

    // Get Bob's initial status record.
    let bob_status_record: Option<Record> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;

    let bob_status_record = bob_status_record.expect("Bob should have a status record");
    let bob_status_hash = bob_status_record.signed_action.hashed.hash.clone();

    // Alice accepts Bob.
    let _: Record = conductors[0]
        .call(
            &alice.zome("administration"),
            "update_entity_status",
            UpdateEntityStatusInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                status_original_action_hash: bob_status_hash.clone(),
                status_previous_action_hash: bob_status_hash.clone(),
                new_status: accepted_status(),
            },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let bob_current_status: Option<Status> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;

    assert_eq!(
        bob_current_status.unwrap().status_type,
        "accepted",
        "Bob should be accepted"
    );

    // Get updated status record for further operations.
    let accepted_status_record: Option<Record> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;
    let accepted_record = accepted_status_record.unwrap();
    let accepted_hash = accepted_record.signed_action.hashed.hash.clone();

    // Alice suspends Bob indefinitely.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "suspend_entity_indefinitely",
            SuspendEntityIndefinitelyInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                status_original_action_hash: bob_status_hash.clone(),
                status_previous_action_hash: accepted_hash.clone(),
                reason: "Test suspension".to_string(),
            },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let bob_suspended: Option<Status> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;

    assert_eq!(
        bob_suspended.unwrap().status_type,
        "suspended indefinitely",
        "Bob should be suspended indefinitely"
    );

    // Get the suspension record for unsuspend.
    let suspended_record: Option<Record> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;
    let suspended_hash = suspended_record.unwrap().signed_action.hashed.hash.clone();

    // Alice unsuspends Bob.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "unsuspend_entity",
            UnsuspendEntityInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                status_original_action_hash: bob_status_hash.clone(),
                status_previous_action_hash: suspended_hash,
            },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let bob_unsuspended: Option<Status> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;

    assert_eq!(
        bob_unsuspended.unwrap().status_type,
        "accepted",
        "Bob should be accepted after unsuspension"
    );
}

/// Regression test for #56.
///
/// `get_all_revisions_for_status` used to query StatusUpdates links anchored at
/// whatever hash the caller supplied. Those links are anchored to the original
/// Create, so a mid-chain hash returned a partial history and raised no error.
///
/// The test above never exposed this: it passes the original Create hash on
/// every call, so it builds a correctly anchored chain and passes either way.
/// Here the third update deliberately supplies a mid-chain hash, mirroring what
/// the frontend used to send, and the history is then read from three different
/// points in the chain. All three must agree.
#[tokio::test(flavor = "multi_thread")]
async fn status_history_resolves_from_any_hash_in_the_chain() {
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
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;

    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();

    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash.clone(),
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // hash_0: the Create. Bob gets a pending status when his user is created.
    let initial: Option<Record> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;
    let create_hash = initial
        .expect("Bob should have a status record")
        .signed_action
        .hashed
        .hash
        .clone();

    // Helper: read the latest status action hash for Bob.
    async fn latest_hash(
        conductors: &SweetConductorBatch,
        alice: &SweetCell,
        bob_user_hash: &ActionHash,
    ) -> ActionHash {
        let record: Option<Record> = conductors[0]
            .call(
                &alice.zome("administration"),
                "get_latest_status_record_for_entity",
                serde_json::json!({
                    "entity": ENTITY_USERS,
                    "entity_original_action_hash": bob_user_hash
                }),
            )
            .await;
        record.unwrap().signed_action.hashed.hash.clone()
    }

    // Update 1: pending -> accepted. Correct anchor supplied.
    conductors[0]
        .call::<_, Record>(
            &alice.zome("administration"),
            "update_entity_status",
            UpdateEntityStatusInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                status_original_action_hash: create_hash.clone(),
                status_previous_action_hash: create_hash.clone(),
                new_status: accepted_status(),
            },
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let hash_1 = latest_hash(&conductors, &alice, &bob_user_hash).await;

    // Update 2: accepted -> rejected. Correct anchor supplied.
    conductors[0]
        .call::<_, Record>(
            &alice.zome("administration"),
            "update_entity_status",
            UpdateEntityStatusInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                status_original_action_hash: create_hash.clone(),
                status_previous_action_hash: hash_1.clone(),
                new_status: rejected_status("second revision"),
            },
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let hash_2 = latest_hash(&conductors, &alice, &bob_user_hash).await;

    // Update 3: rejected -> accepted, supplying hash_2 as the "original".
    // This is what the frontend used to send. The coordinator must resolve it
    // back to create_hash before anchoring the StatusUpdates link, or this
    // revision is orphaned and no read can recover it.
    conductors[0]
        .call::<_, Record>(
            &alice.zome("administration"),
            "update_entity_status",
            UpdateEntityStatusInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                status_original_action_hash: hash_2.clone(),
                status_previous_action_hash: hash_2.clone(),
                new_status: accepted_status(),
            },
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let hash_3 = latest_hash(&conductors, &alice, &bob_user_hash).await;

    // get_all_revisions_for_entry prepends the original record to the linked
    // revisions, so one Create plus three updates is four records.
    const EXPECTED: usize = 4;

    for (label, hash) in [
        ("latest hash (mid-chain, as the frontend sends)", hash_3.clone()),
        ("original Create hash", create_hash.clone()),
        ("intermediate hash", hash_1.clone()),
    ] {
        let revisions: Vec<Record> = conductors[0]
            .call(&alice.zome("administration"), "get_all_revisions_for_status", hash)
            .await;

        assert_eq!(
            revisions.len(),
            EXPECTED,
            "reading the status history from the {} should return the full chain",
            label
        );
    }
}
