//! Users zome tests — translated from `users/users.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn create_and_read_user() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Alice creates a user.
    let alice_input = sample_user("Alice");
    let alice_record: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "create_user", alice_input.clone())
        .await;

    let alice_user: User = alice_record
        .entry()
        .to_app_option()
        .unwrap()
        .expect("Alice record should have an entry");

    assert_eq!(alice_user.name, alice_input.name);

    // Verify status starts as "pending".
    let alice_hash = alice_record.signed_action.hashed.hash.clone();
    await_consistency(&[&alice, &bob]).await.unwrap();

    let alice_status: Option<Status> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": "users",
                "entity_original_action_hash": alice_hash
            }),
        )
        .await;

    assert_eq!(
        alice_status.expect("status should exist").status_type,
        "pending"
    );

    // Alice retrieves her own user link.
    let alice_links: Vec<Link> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_agent_user",
            alice.agent_pubkey().clone(),
        )
        .await;

    assert!(!alice_links.is_empty(), "Alice should have a user link");

    // Bob has no user before creating one.
    let bob_links: Vec<Link> = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "get_agent_user",
            bob.agent_pubkey().clone(),
        )
        .await;

    assert!(bob_links.is_empty(), "Bob should not have a user link yet");

    // Bob tries to create a user with an invalid user_type — should fail.
    let bad_input = UserInput {
        user_type: "Non Authorized".to_string(),
        ..sample_user("BobBad")
    };
    let bad_result: Result<Record, _> = conductors[1]
        .call_fallible(&bob.zome("users_organizations"), "create_user", bad_input)
        .await;
    assert!(bad_result.is_err(), "Invalid user_type should be rejected");

    // Bob creates a valid user.
    let bob_input = sample_user("Bob");
    let bob_record: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_user", bob_input)
        .await;

    assert!(bob_record.signed_action.hashed.hash != ActionHash::from_raw_36(vec![0; 36]));

    await_consistency(&[&alice, &bob]).await.unwrap();

    // Alice reads Bob's user.
    let bob_hash = bob_record.signed_action.hashed.hash.clone();
    let bob_record_from_alice: Option<Record> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_latest_user_record",
            bob_hash,
        )
        .await;

    assert!(
        bob_record_from_alice.is_some(),
        "Alice should be able to read Bob's user"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn create_and_update_user() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Alice creates a user.
    let initial = sample_user("Alice");
    let record: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "create_user", initial)
        .await;

    let original_hash = record.signed_action.hashed.hash.clone();
    let previous_hash = original_hash.clone();

    await_consistency(&[&alice, &bob]).await.unwrap();

    // Alice updates her user.
    let updated = UserInput {
        name: "Alicia".to_string(),
        nickname: "Alicialia".to_string(),
        ..sample_user("Alicia")
    };
    let update_input = UpdateUserInput {
        original_action_hash: original_hash.clone(),
        previous_action_hash: previous_hash.clone(),
        updated_user: updated.clone(),
    };

    let updated_record: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "update_user", update_input)
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

    // Verify the update was applied.
    let latest: Option<Record> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_latest_user_record",
            original_hash.clone(),
        )
        .await;

    let latest_user: User = latest
        .expect("should have latest record")
        .entry()
        .to_app_option()
        .unwrap()
        .expect("should have entry");

    assert_eq!(latest_user.name, updated.name);

    // Alice tries to update with an invalid picture (too small).
    let bad_picture_input = UserInput {
        picture: Some(SerializedBytes::try_from(vec![0u8; 20]).unwrap()),
        ..sample_user("Alicia")
    };
    let bad_update = UpdateUserInput {
        original_action_hash: original_hash.clone(),
        previous_action_hash: updated_record.signed_action.hashed.hash.clone(),
        updated_user: bad_picture_input,
    };

    let bad_result: Result<Record, _> = conductors[0]
        .call_fallible(&alice.zome("users_organizations"), "update_user", bad_update)
        .await;
    assert!(bad_result.is_err(), "Bad picture should be rejected");

    await_consistency(&[&alice, &bob]).await.unwrap();

    // Bob tries to update Alice's user — should fail (not authorized).
    let hijack_input = UpdateUserInput {
        original_action_hash: original_hash.clone(),
        previous_action_hash: updated_record.signed_action.hashed.hash.clone(),
        updated_user: sample_user("Hijacked"),
    };

    let hijack_result: Result<Record, _> = conductors[1]
        .call_fallible(&bob.zome("users_organizations"), "update_user", hijack_input)
        .await;
    assert!(hijack_result.is_err(), "Bob should not update Alice's user");
}
