//! Progenitor pattern tests (Issue #5).
//! Translated from `administration/progenitor.test.ts`.
//!
//! The progenitor is auto-registered as network administrator when they call
//! create_user. This happens in the users_organizations coordinator init callback.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn progenitor_auto_registered_as_admin_on_create_user() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Alice (progenitor) creates her profile — this triggers auto-registration.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Exactly one AllAdministrators link should exist.
    let admin_links: Vec<Link> = conductors[0]
        .call(&alice.zome("administration"), "get_all_administrators_links", ENTITY_NETWORK)
        .await;

    assert_eq!(
        admin_links.len(),
        1,
        "Expected exactly one admin link after progenitor create_user"
    );

    // The link target should be Alice's user record.
    let alice_user_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_user_links[0].target.clone();
    assert_eq!(admin_links[0].target, alice_user_hash);

    // Alice is flagged as administrator.
    let alice_is_admin: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "check_if_agent_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "agent_pubkey": alice.agent_pubkey()
            }),
        )
        .await;
    assert!(alice_is_admin, "Alice should be an administrator");

    // Bob creates his profile — he should NOT be auto-registered.
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let bob_is_admin: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "check_if_agent_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "agent_pubkey": bob.agent_pubkey()
            }),
        )
        .await;
    assert!(!bob_is_admin, "Bob should NOT be an administrator");
}

#[tokio::test(flavor = "multi_thread")]
async fn non_progenitor_is_not_auto_registered_when_progenitor_key_configured() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Bob (not progenitor) creates his profile BEFORE Alice.
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let bob_is_admin: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "check_if_agent_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "agent_pubkey": bob.agent_pubkey()
            }),
        )
        .await;
    assert!(!bob_is_admin, "Non-progenitor should not be auto-registered");

    let admin_links: Vec<Link> = conductors[1]
        .call(&bob.zome("administration"), "get_all_administrators_links", ENTITY_NETWORK)
        .await;
    assert_eq!(admin_links.len(), 0, "No admin links should exist before progenitor joins");
}

#[tokio::test(flavor = "multi_thread")]
async fn progenitor_can_be_removed_by_another_admin() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Alice (progenitor) creates profile → auto-registered as admin.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let alice_user_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let bob_user_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;

    let alice_user_hash = alice_user_links[0].target.clone().into_action_hash().unwrap();
    let bob_user_hash = bob_user_links[0].target.clone().into_action_hash().unwrap();

    // Alice adds Bob as admin.
    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: bob_user_hash,
                agent_pubkeys: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Bob (now admin) removes Alice.
    conductors[1]
        .call::<_, bool>(
            &bob.zome("administration"),
            "remove_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash,
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let alice_is_still_admin: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "check_if_agent_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "agent_pubkey": alice.agent_pubkey()
            }),
        )
        .await;
    assert!(!alice_is_still_admin, "Progenitor should not be admin after revocation");

    let remaining_admins: Vec<Link> = conductors[0]
        .call(&alice.zome("administration"), "get_all_administrators_links", ENTITY_NETWORK)
        .await;
    assert_eq!(remaining_admins.len(), 1, "Only Bob should remain");
}
