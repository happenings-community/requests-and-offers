//! Service type status workflow tests.
//! Ported from `service-types-tests/status/` Tryorama files:
//!   - access-control.test.ts
//!   - admin-moderation.test.ts
//!   - edge-cases.test.ts
//!   - user-suggestion.test.ts
//!
//! Tag-related tests are NOT ported: `get_all_service_type_tags`,
//! `get_service_types_by_tag` etc. do not exist in the current schema.
//!
//! Status zome functions covered here:
//!   suggest_service_type, get_pending_service_types, get_approved_service_types,
//!   get_rejected_service_types, approve_service_type, reject_service_type,
//!   reject_approved_service_type, is_service_type_approved

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

// ── Setup helper ─────────────────────────────────────────────────────────────

/// Spin up two conductors (Alice = progenitor/auto-admin, Bob = pending user),
/// create user profiles for both, and return everything the tests need.
///
/// Bob is NOT accepted by default — call `accept_entity(...)` in tests that
/// require an accepted user to suggest service types.
async fn setup() -> (SweetConductorBatch, SweetCell, SweetCell, ActionHash, ActionHash) {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Alice (progenitor) creates her profile → auto-registered as admin.
    let alice_record: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    let alice_user_hash = alice_record.signed_action.hashed.hash.clone();

    // Bob creates his profile → starts as "pending".
    let bob_record: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    let bob_user_hash = bob_record.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    (conductors, alice, bob, alice_user_hash, bob_user_hash)
}

// ── User suggestion access ────────────────────────────────────────────────────

/// Pending users cannot suggest service types; accepted users can.
/// Translated from `user-suggestion.test.ts / Only accepted users can suggest service types`.
#[tokio::test(flavor = "multi_thread")]
async fn only_accepted_users_can_suggest() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    // Bob (pending) tries to suggest — must fail.
    let fail_result = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("service_types"),
            "suggest_service_type",
            sample_service_type("Unauthorized Suggestion"),
        )
        .await;
    assert!(fail_result.is_err(), "Pending user should not suggest service types");

    // Accept Bob.
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob (now accepted) suggests — must succeed.
    let ok_record: Record = conductors[1]
        .call(
            &bob.zome("service_types"),
            "suggest_service_type",
            sample_service_type("Accepted User Suggestion"),
        )
        .await;
    let st: ServiceType = ok_record.entry().to_app_option().unwrap().expect("entry");
    assert_eq!(st.name, "Accepted User Suggestion");

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Verify it appears in Alice's pending list.
    let pending: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(
        pending.iter().any(|r| r.signed_action.hashed.hash == ok_record.signed_action.hashed.hash),
        "Suggestion should appear in the pending list"
    );
}

/// Administrators (regardless of accepted status) can suggest service types.
/// Translated from `user-suggestion.test.ts / Administrators without accepted status can suggest`.
#[tokio::test(flavor = "multi_thread")]
async fn admin_can_suggest_without_accepted_status() {
    let (conductors, alice, bob, alice_user_hash, bob_user_hash) = setup().await;

    // Register Bob as admin (still pending user).
    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash,
                agent_pubkeys: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob (admin but not accepted user) suggests — must succeed.
    let record: Record = conductors[1]
        .call(
            &bob.zome("service_types"),
            "suggest_service_type",
            sample_service_type("Admin Suggestion Without Accepted Status"),
        )
        .await;
    let st: ServiceType = record.entry().to_app_option().unwrap().expect("entry");
    assert_eq!(st.name, "Admin Suggestion Without Accepted Status");
}

/// Regular users cannot access the pending service types list.
/// Translated from `user-suggestion.test.ts / Regular users cannot access pending service types list`.
#[tokio::test(flavor = "multi_thread")]
async fn regular_user_cannot_access_pending_list() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    // Accept Bob so he can suggest.
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob suggests a service type.
    let _: Record = conductors[1]
        .call(
            &bob.zome("service_types"),
            "suggest_service_type",
            sample_service_type("Another Suggested Service"),
        )
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob (regular user) tries to access pending list — must fail.
    let result = conductors[1]
        .call_fallible::<_, Vec<Record>>(&bob.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(result.is_err(), "Regular user should not access the pending list");
}

// ── Suggest → pending list ────────────────────────────────────────────────────

/// A suggested service type appears in the pending list (admin view) and NOT in
/// the approved list (public view) until approved.
/// Translated from `access-control.test.ts / Admins can access all status lists`.
#[tokio::test(flavor = "multi_thread")]
async fn suggest_and_list_pending_service_type() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob suggests three service types.
    let pending_record: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Pending"))
        .await;
    let to_approve: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("To Approve"))
        .await;
    let to_reject: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("To Reject"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Alice moderates two of them.
    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "approve_service_type", to_approve.signed_action.hashed.hash.clone())
        .await;
    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "reject_service_type", to_reject.signed_action.hashed.hash.clone())
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Admin sees all lists.
    let admin_pending: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert_eq!(admin_pending.len(), 1, "Should be exactly one pending service type");
    assert_eq!(
        admin_pending[0].signed_action.hashed.hash,
        pending_record.signed_action.hashed.hash
    );

    let admin_approved: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert_eq!(admin_approved.len(), 1);

    let admin_rejected: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert_eq!(admin_rejected.len(), 1);

    // Regular user can only see the approved list.
    let user_approved: Vec<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert_eq!(user_approved.len(), 1);
    assert_eq!(
        user_approved[0].signed_action.hashed.hash,
        to_approve.signed_action.hashed.hash
    );

    let user_pending = conductors[1]
        .call_fallible::<_, Vec<Record>>(&bob.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(user_pending.is_err(), "Regular user should not read pending list");

    let user_rejected = conductors[1]
        .call_fallible::<_, Vec<Record>>(&bob.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert!(user_rejected.is_err(), "Regular user should not read rejected list");
}

// ── Admin moderation ──────────────────────────────────────────────────────────

/// Admin approves a pending service type; it moves to the approved list.
/// Translated from `admin-moderation.test.ts / Admin can approve a pending service type`.
#[tokio::test(flavor = "multi_thread")]
async fn admin_can_approve_pending_service_type() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Service To Approve"))
        .await;
    let pending_hash = suggestion.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let pending_before: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(pending_before.iter().any(|r| r.signed_action.hashed.hash == pending_hash));

    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "approve_service_type", pending_hash.clone())
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let approved_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert!(approved_after.iter().any(|r| r.signed_action.hashed.hash == pending_hash));

    let pending_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(!pending_after.iter().any(|r| r.signed_action.hashed.hash == pending_hash));

    let is_approved: bool = conductors[0]
        .call(&alice.zome("service_types"), "is_service_type_approved", pending_hash)
        .await;
    assert!(is_approved);
}

/// Admin rejects a pending service type; it moves to the rejected list.
/// Translated from `admin-moderation.test.ts / Admin can reject a pending service type`.
#[tokio::test(flavor = "multi_thread")]
async fn admin_can_reject_pending_service_type() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Service To Reject"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "reject_service_type", hash.clone())
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let rejected: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert!(rejected.iter().any(|r| r.signed_action.hashed.hash == hash));

    let pending: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(!pending.iter().any(|r| r.signed_action.hashed.hash == hash));

    let is_approved: bool = conductors[0]
        .call(&alice.zome("service_types"), "is_service_type_approved", hash)
        .await;
    assert!(!is_approved);
}

/// Admin rejects an already-approved service type.
/// Translated from `admin-moderation.test.ts / Admin can reject an already approved service type`.
#[tokio::test(flavor = "multi_thread")]
async fn admin_can_reject_approved_service_type() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Approve Then Reject"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Approve first.
    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "approve_service_type", hash.clone())
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let is_approved_before: bool = conductors[0]
        .call(&alice.zome("service_types"), "is_service_type_approved", hash.clone())
        .await;
    assert!(is_approved_before);

    // Then reject the approved one.
    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "reject_approved_service_type", hash.clone())
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let rejected: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert!(rejected.iter().any(|r| r.signed_action.hashed.hash == hash));

    let approved: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert!(!approved.iter().any(|r| r.signed_action.hashed.hash == hash));

    let is_approved_after: bool = conductors[0]
        .call(&alice.zome("service_types"), "is_service_type_approved", hash)
        .await;
    assert!(!is_approved_after);
}

/// Admin approves a service type that was previously rejected.
/// Translated from `admin-moderation.test.ts / Admin can approve a rejected service type directly`.
#[tokio::test(flavor = "multi_thread")]
async fn admin_can_approve_rejected_service_type() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Reject Then Approve"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Reject first.
    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "reject_service_type", hash.clone())
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let rejected_before: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert!(rejected_before.iter().any(|r| r.signed_action.hashed.hash == hash));

    // Now approve from rejected state.
    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "approve_service_type", hash.clone())
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let approved: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert!(approved.iter().any(|r| r.signed_action.hashed.hash == hash));

    let rejected_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert!(!rejected_after.iter().any(|r| r.signed_action.hashed.hash == hash));

    let is_approved: bool = conductors[0]
        .call(&alice.zome("service_types"), "is_service_type_approved", hash)
        .await;
    assert!(is_approved);
}

/// Admin deletes a rejected service type; it disappears from all lists.
/// Translated from `admin-moderation.test.ts / Admin can delete a rejected service type`.
#[tokio::test(flavor = "multi_thread")]
async fn admin_can_delete_rejected_service_type() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Reject Then Delete"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "reject_service_type", hash.clone())
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let rejected_before: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert!(rejected_before.iter().any(|r| r.signed_action.hashed.hash == hash));

    // Delete the rejected service type.
    let _: ActionHash = conductors[0]
        .call(&alice.zome("service_types"), "delete_service_type", hash.clone())
        .await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let rejected_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    assert!(!rejected_after.iter().any(|r| r.signed_action.hashed.hash == hash));

    let approved_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert!(!approved_after.iter().any(|r| r.signed_action.hashed.hash == hash));
}

// ── Access control ────────────────────────────────────────────────────────────

/// Non-admins cannot approve or reject service types, and cannot read pending/rejected lists.
/// Translated from `admin-moderation.test.ts / Non-admin cannot moderate service types`
/// and `access-control.test.ts / Regular users cannot call create_service_type directly`.
#[tokio::test(flavor = "multi_thread")]
async fn non_admin_cannot_moderate_service_types() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob suggests a service type (accepted user can suggest).
    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Unauthorized Moderation"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob (non-admin) cannot approve.
    let approve_result = conductors[1]
        .call_fallible::<_, ()>(&bob.zome("service_types"), "approve_service_type", hash.clone())
        .await;
    assert!(approve_result.is_err(), "Non-admin should not approve service types");

    // Bob (non-admin) cannot reject.
    let reject_result = conductors[1]
        .call_fallible::<_, ()>(&bob.zome("service_types"), "reject_service_type", hash.clone())
        .await;
    assert!(reject_result.is_err(), "Non-admin should not reject service types");

    // Bob cannot read the pending list.
    let pending_result = conductors[1]
        .call_fallible::<_, Vec<Record>>(&bob.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(pending_result.is_err(), "Non-admin should not read pending list");

    // The service type should not be in the approved list (never approved).
    let approved: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert!(!approved.iter().any(|r| r.signed_action.hashed.hash == hash));
}

/// Regular users cannot call `create_service_type` directly (admin-only gate).
/// Translated from `access-control.test.ts / Regular users cannot call create_service_type directly`.
#[tokio::test(flavor = "multi_thread")]
async fn regular_user_cannot_call_create_service_type_directly() {
    let (conductors, alice, bob, _alice_user_hash, _bob_user_hash) = setup().await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob (non-admin) tries to call create_service_type directly.
    let result = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("service_types"),
            "create_service_type",
            sample_service_type("Direct Creation Attempt"),
        )
        .await;
    assert!(result.is_err(), "Non-admin should not call create_service_type");
}

// ── Edge cases ────────────────────────────────────────────────────────────────

/// A service type can only be in one status list at a time (pending → approved → rejected).
/// Translated from `edge-cases.test.ts / Service type cannot be in multiple status lists simultaneously`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_state_exclusivity() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("State Exclusivity"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let in_pending = |records: &[Record]| records.iter().any(|r| r.signed_action.hashed.hash == hash);
    let in_approved = |records: &[Record]| records.iter().any(|r| r.signed_action.hashed.hash == hash);
    let in_rejected = |records: &[Record]| records.iter().any(|r| r.signed_action.hashed.hash == hash);

    // Initially pending only.
    let p: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_pending_service_types", ()).await;
    let a: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_approved_service_types", ()).await;
    let r: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_rejected_service_types", ()).await;
    assert!(in_pending(&p), "Should be in pending");
    assert!(!in_approved(&a), "Should not be in approved");
    assert!(!in_rejected(&r), "Should not be in rejected");

    // After approval — approved only.
    let _: () = conductors[0].call(&alice.zome("service_types"), "approve_service_type", hash.clone()).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();
    let p: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_pending_service_types", ()).await;
    let a: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_approved_service_types", ()).await;
    let r: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_rejected_service_types", ()).await;
    assert!(!in_pending(&p), "Should not be in pending after approval");
    assert!(in_approved(&a), "Should be in approved");
    assert!(!in_rejected(&r), "Should not be in rejected");

    // After rejection — rejected only.
    let _: () = conductors[0].call(&alice.zome("service_types"), "reject_approved_service_type", hash.clone()).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();
    let p: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_pending_service_types", ()).await;
    let a: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_approved_service_types", ()).await;
    let r: Vec<Record> = conductors[0].call(&alice.zome("service_types"), "get_rejected_service_types", ()).await;
    assert!(!in_pending(&p), "Should not be in pending after rejection");
    assert!(!in_approved(&a), "Should not be in approved after rejection");
    assert!(in_rejected(&r), "Should be in rejected");
}

/// Approving an already-approved service type fails gracefully.
/// Translated from `edge-cases.test.ts / Approving an already approved service type fails gracefully`.
#[tokio::test(flavor = "multi_thread")]
async fn approving_already_approved_fails() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Idempotent Approval"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // First approval succeeds.
    let _: () = conductors[0].call(&alice.zome("service_types"), "approve_service_type", hash.clone()).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Second approval must fail (no longer pending).
    let second = conductors[0]
        .call_fallible::<_, ()>(&alice.zome("service_types"), "approve_service_type", hash.clone())
        .await;
    assert!(second.is_err(), "Double-approving should fail");

    // Still appears exactly once in the approved list.
    let approved: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    let count = approved.iter().filter(|r| r.signed_action.hashed.hash == hash).count();
    assert_eq!(count, 1, "Should appear exactly once in approved list");
}

/// Rejecting an already-rejected service type fails gracefully.
/// Translated from `edge-cases.test.ts / Rejecting an already rejected service type fails gracefully`.
#[tokio::test(flavor = "multi_thread")]
async fn rejecting_already_rejected_fails() {
    let (conductors, alice, bob, _alice_user_hash, bob_user_hash) = setup().await;

    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Idempotent Rejection"))
        .await;
    let hash = suggestion.signed_action.hashed.hash.clone();
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // First rejection succeeds.
    let _: () = conductors[0].call(&alice.zome("service_types"), "reject_service_type", hash.clone()).await;
    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Second rejection must fail.
    let second = conductors[0]
        .call_fallible::<_, ()>(&alice.zome("service_types"), "reject_service_type", hash.clone())
        .await;
    assert!(second.is_err(), "Double-rejecting should fail");

    // Still appears exactly once in the rejected list.
    let rejected: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_rejected_service_types", ())
        .await;
    let count = rejected.iter().filter(|r| r.signed_action.hashed.hash == hash).count();
    assert_eq!(count, 1, "Should appear exactly once in rejected list");
}
