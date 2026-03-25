//! Status management tests.
//! Translated from `administration/status-management.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn user_status_management_and_suspension_workflow() {
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

    await_consistency(60, [&alice, &bob]).await.unwrap();

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

    await_consistency(60, [&alice, &bob]).await.unwrap();

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

    await_consistency(60, [&alice, &bob]).await.unwrap();

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

    await_consistency(60, [&alice, &bob]).await.unwrap();

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
