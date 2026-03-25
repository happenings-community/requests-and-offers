//! Successive profile updates tests (Issue #57).
//! Translated from `administration/successive-profile-updates.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn successive_profile_updates_work_correctly() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Bob creates his initial user.
    conductors[1]
        .call::<_, Record>(
            &bob.zome("users_organizations"),
            "create_user",
            UserInput {
                bio: "Initial bio".to_string(),
                email: "initial@test.com".to_string(),
                ..sample_user("Initial User")
            },
        )
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();

    // First update.
    let current_record: Option<Record> = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "get_latest_user_record",
            bob_user_hash.clone(),
        )
        .await;
    let first_previous_hash = current_record.unwrap().signed_action.hashed.hash.clone();

    let first_update_record: Record = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "update_user",
            UpdateUserInput {
                original_action_hash: bob_user_hash.clone(),
                previous_action_hash: first_previous_hash,
                updated_user: UserInput {
                    bio: "First update bio".to_string(),
                    ..sample_user("First Update")
                },
            },
        )
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

    // Verify first update.
    let after_first: Option<Record> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_latest_user_record",
            bob_user_hash.clone(),
        )
        .await;
    let first_user: User = after_first
        .unwrap()
        .entry()
        .to_app_option()
        .unwrap()
        .expect("entry");
    assert_eq!(first_user.bio, "First update bio");

    // Second update using the first update's hash.
    let second_previous_hash = first_update_record.signed_action.hashed.hash.clone();

    let second_update_record: Record = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "update_user",
            UpdateUserInput {
                original_action_hash: bob_user_hash.clone(),
                previous_action_hash: second_previous_hash,
                updated_user: UserInput {
                    bio: "Second update bio".to_string(),
                    ..sample_user("Second Update")
                },
            },
        )
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

    // Verify second update propagated correctly.
    let after_second: Option<Record> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_latest_user_record",
            bob_user_hash.clone(),
        )
        .await;
    let second_user: User = after_second
        .unwrap()
        .entry()
        .to_app_option()
        .unwrap()
        .expect("entry");
    assert_eq!(second_user.bio, "Second update bio", "Second update should be visible");

    // Third update to confirm the chain continues.
    let third_previous_hash = second_update_record.signed_action.hashed.hash.clone();
    conductors[1]
        .call::<_, Record>(
            &bob.zome("users_organizations"),
            "update_user",
            UpdateUserInput {
                original_action_hash: bob_user_hash.clone(),
                previous_action_hash: third_previous_hash,
                updated_user: UserInput {
                    bio: "Third update bio".to_string(),
                    ..sample_user("Third Update")
                },
            },
        )
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

    let after_third: Option<Record> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_latest_user_record",
            bob_user_hash,
        )
        .await;
    let third_user: User = after_third.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(third_user.bio, "Third update bio", "Third update should be visible");
}
