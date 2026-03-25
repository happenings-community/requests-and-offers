//! Profile-status consistency tests (Issue #57).
//! Translated from `administration/profile-status-consistency.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn profile_updates_during_status_acceptance() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", UserInput {
            bio: "Original bio".to_string(),
            ..sample_user("Bob")
        })
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

    // Get Bob's status record.
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

    let bob_initial_status_hash =
        bob_status_record.unwrap().signed_action.hashed.hash.clone();

    // Alice accepts Bob while Bob simultaneously updates his profile.
    let _: Record = conductors[0]
        .call(
            &alice.zome("administration"),
            "update_entity_status",
            UpdateEntityStatusInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                status_original_action_hash: bob_initial_status_hash.clone(),
                status_previous_action_hash: bob_initial_status_hash.clone(),
                new_status: accepted_status(),
            },
        )
        .await;

    // Bob updates his profile.
    let bob_current_record: Option<Record> = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "get_latest_user_record",
            bob_user_hash.clone(),
        )
        .await;
    let bob_current = bob_current_record.unwrap();
    let bob_current_hash = bob_current.signed_action.hashed.hash.clone();

    let _: Record = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "update_user",
            UpdateUserInput {
                original_action_hash: bob_user_hash.clone(),
                previous_action_hash: bob_current_hash,
                updated_user: UserInput {
                    bio: "Updated bio".to_string(),
                    ..sample_user("Bob")
                },
            },
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Verify status is still accepted after profile update.
    let final_status: Option<Status> = conductors[0]
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
        final_status.unwrap().status_type,
        "accepted",
        "Status should remain accepted after profile update"
    );

    // Verify Bob's profile was updated.
    let final_user_record: Option<Record> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_latest_user_record",
            bob_user_hash,
        )
        .await;

    let final_user: User = final_user_record
        .unwrap()
        .entry()
        .to_app_option()
        .unwrap()
        .expect("should have entry");

    assert_eq!(final_user.bio, "Updated bio");
}
