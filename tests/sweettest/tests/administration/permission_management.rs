//! Named permission tests.
//! Covers grant, revoke, the admin gate, and the deliberate absence of a
//! last-holder guard.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

// The coordinator crate cannot be imported here (it targets WASM), so the
// permission name is repeated as a literal. It is `PERMISSION_STEWARD` in
// `permissions.rs`.
const PERMISSION_STEWARD: &str = "steward";

#[tokio::test(flavor = "multi_thread")]
async fn grant_and_revoke_steward_permission() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users for both agents.
    let _: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    let _: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
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

    // Alice becomes network administrator.
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

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob is not an administrator, so he cannot grant himself the permission.
    let self_grant = conductors[1]
        .call_fallible::<_, bool>(
            &bob.zome("administration"),
            "grant_permission",
            serde_json::json!({
                "permission": PERMISSION_STEWARD,
                "holder_original_action_hash": bob_user_hash,
                "agent_pubkeys": [bob.agent_pubkey()]
            }),
        )
        .await;
    assert!(self_grant.is_err(), "Non-admin should not grant a permission");

    // Alice grants Bob the steward permission.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "grant_permission",
            serde_json::json!({
                "permission": PERMISSION_STEWARD,
                "holder_original_action_hash": bob_user_hash,
                "agent_pubkeys": [bob.agent_pubkey()]
            }),
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // The roster is read from the other conductor, so this asserts the links
    // gossiped rather than merely existing where they were written.
    let roster: Vec<Link> = conductors[1]
        .call(
            &bob.zome("administration"),
            "get_all_permission_holders_links",
            PERMISSION_STEWARD,
        )
        .await;
    assert_eq!(roster.len(), 1, "Roster should hold exactly one steward");
    assert_eq!(
        roster[0].target.clone().into_action_hash().unwrap(),
        bob_user_hash,
        "Roster entry should target Bob's user entity, not his agent key"
    );

    // The agent-keyed query uses a different link base, so it is a separate
    // assertion rather than a restatement of the roster.
    let bob_is_steward: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "check_if_agent_has_permission",
            serde_json::json!({
                "permission": PERMISSION_STEWARD,
                "agent_pubkey": bob.agent_pubkey()
            }),
        )
        .await;
    assert!(bob_is_steward, "Bob should hold the steward permission");

    // Alice administers but does not steward. The check must not fall back to
    // the administrator link.
    let alice_is_steward: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "check_if_agent_has_permission",
            serde_json::json!({
                "permission": PERMISSION_STEWARD,
                "agent_pubkey": alice.agent_pubkey()
            }),
        )
        .await;
    assert!(
        !alice_is_steward,
        "An administrator should not implicitly hold the steward permission"
    );

    // Revoking the only holder is permitted: there is no last-holder guard.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "revoke_permission",
            serde_json::json!({
                "permission": PERMISSION_STEWARD,
                "holder_original_action_hash": bob_user_hash,
                "agent_pubkeys": [bob.agent_pubkey()]
            }),
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let roster_after: Vec<Link> = conductors[1]
        .call(
            &bob.zome("administration"),
            "get_all_permission_holders_links",
            PERMISSION_STEWARD,
        )
        .await;
    assert!(roster_after.is_empty(), "Roster should be empty after revocation");

    let bob_still_steward: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "check_if_agent_has_permission",
            serde_json::json!({
                "permission": PERMISSION_STEWARD,
                "agent_pubkey": bob.agent_pubkey()
            }),
        )
        .await;
    assert!(!bob_still_steward, "Bob should not hold the permission after revocation");
}
