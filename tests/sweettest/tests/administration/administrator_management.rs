//! Administrator management tests.
//! Translated from `administration/administrator-management.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn register_and_remove_network_administrator() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users for both agents.
    let alice_record: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    let bob_record: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Retrieve user action hashes via get_agent_user links.
    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;

    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();

    // Register Alice as network administrator.
    let _: bool = conductors[0]
        .call(
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

    // Verify Alice is in the administrators list.
    let admins: Vec<Link> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_all_administrators_links",
            ENTITY_NETWORK,
        )
        .await;
    assert_eq!(admins.len(), 1, "Should have exactly one administrator");

    // Verify Alice is an administrator by entity hash.
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
    assert!(alice_is_admin, "Alice should be an administrator");

    // Verify Alice is an administrator by agent pubkey.
    let alice_agent_is_admin: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "check_if_agent_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "agent_pubkey": alice.agent_pubkey()
            }),
        )
        .await;
    assert!(alice_agent_is_admin, "Alice agent should be an administrator");

    // Bob is not an administrator.
    let bob_is_admin: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "check_if_entity_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "entity_original_action_hash": bob_user_hash
            }),
        )
        .await;
    assert!(!bob_is_admin, "Bob should not be an administrator");

    // Add Bob as a second administrator (required before removing Alice — the
    // remove_administrator function rejects removing the last admin).
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: bob_user_hash.clone(),
                agent_pubkeys: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let admins_with_bob: Vec<Link> = conductors[0]
        .call(&alice.zome("administration"), "get_all_administrators_links", ENTITY_NETWORK)
        .await;
    assert_eq!(admins_with_bob.len(), 2, "Should have two administrators");

    // Now remove Alice — Bob remains as the only administrator.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "remove_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash.clone(),
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Verify only Bob remains.
    let admins_after: Vec<Link> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_all_administrators_links",
            ENTITY_NETWORK,
        )
        .await;
    assert_eq!(
        admins_after.len(),
        1,
        "Only Bob should remain as administrator after Alice is removed"
    );
}
