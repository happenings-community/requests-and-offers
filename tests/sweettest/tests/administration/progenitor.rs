//! Progenitor pattern tests (Issue #5).
//! Translated from `administration/progenitor.test.ts`.
//!
//! With a progenitor key, the progenitor is registered as network
//! administrator when they call create_user. With no key, nobody is: the
//! first administrator claims the seat with `claim_first_administrator` (#600).
//!
//! Coverage:
//! - Happy path: auto-registration, non-progenitor exclusion, revocation
//! - `is_progenitor()` extern (UI-facing)
//! - Dev mode bootstrap (no progenitor key configured): the deliberate claim
//! - Authorization rejections (Unauthorized, LastAdmin)
//! - Idempotency of `add_administrator`

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

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

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

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

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

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

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

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

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

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

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

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

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

// ============================================================================
// Group 1: is_progenitor() extern
// ============================================================================

#[tokio::test(flavor = "multi_thread")]
async fn is_progenitor_returns_true_for_progenitor_agent() {
    let (conductors, alice, _bob) = setup_two_agents_with_alice_as_progenitor().await;

    let result: bool = conductors[0]
        .call(&alice.zome("administration"), "is_progenitor", ())
        .await;

    assert!(result, "Alice (progenitor) should get true from is_progenitor");
}

#[tokio::test(flavor = "multi_thread")]
async fn is_progenitor_returns_false_for_non_progenitor_agent() {
    let (conductors, _alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    let result: bool = conductors[1]
        .call(&bob.zome("administration"), "is_progenitor", ())
        .await;

    assert!(!result, "Bob (non-progenitor) should get false from is_progenitor");
}

// ============================================================================
// Group 2: Dev mode bootstrap (no progenitor key configured)
// ============================================================================

async fn is_admin(conductor: &SweetConductor, cell: &SweetCell, who: &SweetCell) -> bool {
    conductor
        .call(
            &cell.zome("administration"),
            "check_if_agent_is_administrator",
            serde_json::json!({ "entity": ENTITY_NETWORK, "agent_pubkey": who.agent_pubkey() }),
        )
        .await
}

async fn can_claim(conductor: &SweetConductor, cell: &SweetCell) -> bool {
    conductor
        .call(&cell.zome("users_organizations"), "can_claim_first_administrator", ())
        .await
}

/// The refusal text of a `claim_first_administrator` call that must fail.
async fn claim_refused(conductor: &SweetConductor, cell: &SweetCell) -> String {
    let result = conductor
        .call_fallible::<_, bool>(&cell.zome("users_organizations"), "claim_first_administrator", ())
        .await;
    format!("{:?}", result.expect_err("the claim must be refused"))
}

/// #600: on a network with no key, a profile makes nobody administrator, even
/// when no administrator exists yet. Before, `create_user` gave the seat to any
/// user whose node saw no administrator grant, which a joiner whose node had
/// not synced did on the 22 November rehearsal.
///
/// **To make it go red:** register the caller in `create_user` again when
/// `is_there_an_administrator` answers false.
#[tokio::test(flavor = "multi_thread")]
async fn dev_mode_a_profile_never_makes_an_administrator() {
    let (conductors, alice, bob) = setup_two_agents_no_progenitor_configured().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    assert!(!is_admin(&conductors[0], &alice, &alice).await, "a profile alone makes nobody administrator");
    let admin_links: Vec<Link> = conductors[0]
        .call(&alice.zome("administration"), "get_all_administrators_links", ENTITY_NETWORK)
        .await;
    assert!(admin_links.is_empty(), "no administrator until someone claims the seat");
    assert!(can_claim(&conductors[0], &alice).await, "the seat stays open to a deliberate claim");
}

/// #600: the first administrator of a keyless network is the user who claims
/// the seat; once an administrator is visible the seat is closed, to the box
/// (`can_claim_first_administrator`) and to the call alike, and the next user
/// registers as a plain member.
#[tokio::test(flavor = "multi_thread")]
async fn dev_mode_the_first_administrator_claims_the_seat() {
    let (conductors, alice, bob) = setup_two_agents_no_progenitor_configured().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    let claimed: bool = conductors[0]
        .call(&alice.zome("users_organizations"), "claim_first_administrator", ())
        .await;
    assert!(claimed, "Alice takes the open seat");
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    assert!(is_admin(&conductors[0], &alice, &alice).await, "Alice administers the network");

    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    assert!(!is_admin(&conductors[1], &bob, &bob).await, "Bob registers as a plain member");
    assert!(!can_claim(&conductors[1], &bob).await, "the box is not offered once an administrator is visible");
    let refusal = claim_refused(&conductors[1], &bob).await;
    assert!(
        refusal.contains("This network already has an administrator"),
        "the claim names why it is refused: {refusal}"
    );
    assert!(!is_admin(&conductors[1], &bob, &bob).await, "the refused claim leaves Bob a member");
}

/// A claim needs a profile: the administrator seat hangs from the user entry.
#[tokio::test(flavor = "multi_thread")]
async fn dev_mode_a_claim_without_a_profile_is_refused() {
    let (conductors, alice, _bob) = setup_two_agents_no_progenitor_configured().await;

    let refusal = claim_refused(&conductors[0], &alice).await;
    assert!(refusal.contains("User profile required"), "the claim asks for a profile first: {refusal}");
}

/// On a keyed network the progenitor holds the seat from its profile, and
/// nobody else can claim it, whatever their node sees.
#[tokio::test(flavor = "multi_thread")]
async fn with_a_progenitor_key_the_seat_cannot_be_claimed() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Bob registers before the progenitor, so his node sees no administrator.
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    assert!(!can_claim(&conductors[1], &bob).await, "no box on a keyed network");
    let refusal = claim_refused(&conductors[1], &bob).await;
    assert!(
        refusal.contains("This network has a progenitor key"),
        "the claim names the key: {refusal}"
    );
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    assert!(!is_admin(&conductors[1], &bob, &bob).await, "Bob stays a member");
}

// ============================================================================
// Group 3: Authorization rejections
// ============================================================================

#[tokio::test(flavor = "multi_thread")]
#[should_panic]
async fn add_administrator_returns_error_when_caller_is_not_admin_or_progenitor() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Alice (progenitor) registers → auto-admin. Bob creates profile → not admin.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let bob_user_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_user_links[0].target.clone().into_action_hash().unwrap();

    // Bob (not admin, not progenitor) tries to add himself — must fail.
    let _: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: bob_user_hash,
                agent_pubkeys: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;
}

#[tokio::test(flavor = "multi_thread")]
#[should_panic]
async fn remove_administrator_returns_error_when_caller_is_not_admin() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Alice (progenitor) auto-admin. Bob not admin.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let alice_user_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_user_links[0].target.clone().into_action_hash().unwrap();

    // Bob (not admin) tries to remove Alice — must fail.
    let _: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "remove_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash,
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;
}

#[tokio::test(flavor = "multi_thread")]
#[should_panic]
async fn remove_administrator_returns_error_when_removing_last_admin() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Alice (progenitor) auto-admin — she is the only admin.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let alice_user_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_user_links[0].target.clone().into_action_hash().unwrap();

    // Alice tries to remove herself — must fail (LastAdmin).
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "remove_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash,
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;
}

// ============================================================================
// Group 4: Idempotency
// ============================================================================

#[tokio::test(flavor = "multi_thread")]
async fn add_administrator_is_idempotent_on_repeated_call() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let bob_user_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_user_links[0].target.clone().into_action_hash().unwrap();

    // First call: adds Bob as admin.
    let first: bool = conductors[0]
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
    assert!(first, "First add_administrator call should return true");

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let links_after_first: Vec<Link> = conductors[0]
        .call(&alice.zome("administration"), "get_all_administrators_links", ENTITY_NETWORK)
        .await;
    assert_eq!(links_after_first.len(), 2, "Alice and Bob should be admins after first call");

    // Second call: Bob is already admin — should be a no-op (no duplicate links).
    // Note: add_administrator always returns true (it delegates to register_administrator
    // which silently skips duplicates, but the outer function doesn't propagate that bool).
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: bob_user_hash,
                agent_pubkeys: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let links_after_second: Vec<Link> = conductors[0]
        .call(&alice.zome("administration"), "get_all_administrators_links", ENTITY_NETWORK)
        .await;
    assert_eq!(
        links_after_second.len(),
        2,
        "No duplicate link should be created on repeated add_administrator"
    );
}
