//! Service types zome tests.
//! Translated from `service-types-tests/service-types.test.ts` and related files.
//!
//! Status workflow tests live in `service_types_status.rs`.
//! Tag tests (tag-functionality, tag-based-discovery) are NOT ported:
//! the current ServiceType schema has no `tags` field.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_service_type_crud_operations() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users. Alice (progenitor) is auto-registered as admin via init callback.
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
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();

    // Register Alice as network admin (idempotent — progenitor init already did this).
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

    // Alice creates a service type (admin-only; auto-approved).
    let st_record: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Web Development"),
        )
        .await;

    let st_hash = st_record.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob reads the service type.
    let st_from_bob: Option<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_service_type", st_hash.clone())
        .await;
    assert!(st_from_bob.is_some(), "Bob should read the service type");

    let st: ServiceType = st_from_bob
        .unwrap()
        .entry()
        .to_app_option()
        .unwrap()
        .expect("entry");
    assert_eq!(st.name, "Web Development");

    // Get all approved service types (returns Vec<Record>).
    let all_types: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert!(!all_types.is_empty(), "Should have at least one service type");

    // Alice updates the service type.
    let update_input = UpdateServiceTypeInput {
        original_action_hash: st_hash.clone(),
        previous_action_hash: st_record.signed_action.hashed.hash.clone(),
        updated_service_type: ServiceTypeEntry {
            name: "Web Development (Updated)".to_string(),
            ..sample_service_type("placeholder").service_type
        },
    };
    let _: ActionHash = conductors[0]
        .call(&alice.zome("service_types"), "update_service_type", update_input)
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[0]
        .call(
            &alice.zome("service_types"),
            "get_latest_service_type_record",
            st_hash.clone(),
        )
        .await;
    let updated_st: ServiceType =
        latest.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(updated_st.name, "Web Development (Updated)");

    // Alice deletes the service type.
    let _: ActionHash = conductors[0]
        .call(&alice.zome("service_types"), "delete_service_type", st_hash.clone())
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let after_delete: Option<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_service_type", st_hash)
        .await;
    assert!(after_delete.is_none(), "Deleted service type should not be found");
}

// ── Admin permissions ─────────────────────────────────────────────────────────

/// Non-admin cannot create service types; admin can.
/// Translated from `service-types.test.ts / ServiceType admin permissions`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_admin_permissions() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob (non-admin) cannot create service types.
    let fail = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("service_types"),
            "create_service_type",
            sample_service_type("Design Services"),
        )
        .await;
    assert!(fail.is_err(), "Non-admin should not create service types");

    // Alice (auto-admin via progenitor) can create service types.
    let ok: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Design Services"),
        )
        .await;
    assert!(!ok.signed_action.hashed.hash.get_raw_39().is_empty());

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let all: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert_eq!(all.len(), 1, "Alice's service type should be visible");
}

/// Non-admin cannot update a service type created by the admin.
/// Translated from `service-types.test.ts / ServiceType error handling and edge cases`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_non_admin_cannot_update() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Test Service"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let update_input = UpdateServiceTypeInput {
        original_action_hash: st_hash.clone(),
        previous_action_hash: st_hash.clone(),
        updated_service_type: sample_service_type("Updated by Bob").service_type,
    };

    let result = conductors[1]
        .call_fallible::<_, ActionHash>(&bob.zome("service_types"), "update_service_type", update_input)
        .await;
    assert!(result.is_err(), "Non-admin/non-author should not update service type");
}

/// Non-admin cannot delete a service type.
/// Translated from `service-types.test.ts / ServiceType error handling and edge cases`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_non_admin_cannot_delete() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Test Service"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let result = conductors[1]
        .call_fallible::<_, ActionHash>(&bob.zome("service_types"), "delete_service_type", st_hash)
        .await;
    assert!(result.is_err(), "Non-admin/non-author should not delete service type");
}

// ── Validation ────────────────────────────────────────────────────────────────

/// Creating a service type with an empty name is rejected by validation.
/// Translated from `service-types.test.ts / ServiceType validation`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_validation_empty_name_fails() {
    let (conductors, alice, _bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency_s(15, [&alice]).await.unwrap();

    let invalid = ServiceTypeInput {
        service_type: ServiceTypeEntry {
            name: String::new(),
            description: "Valid description".to_string(),
            technical: false,
        },
    };

    let result = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("service_types"), "create_service_type", invalid)
        .await;
    assert!(result.is_err(), "Empty name should be rejected");
}

/// Creating a service type with an empty description is rejected by validation.
/// Translated from `service-types.test.ts / ServiceType validation`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_validation_empty_description_fails() {
    let (conductors, alice, _bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency_s(15, [&alice]).await.unwrap();

    let invalid = ServiceTypeInput {
        service_type: ServiceTypeEntry {
            name: "Valid Name".to_string(),
            description: String::new(),
            technical: false,
        },
    };

    let result = conductors[0]
        .call_fallible::<_, Record>(&alice.zome("service_types"), "create_service_type", invalid)
        .await;
    assert!(result.is_err(), "Empty description should be rejected");
}

// ── Linking ───────────────────────────────────────────────────────────────────

// ── Listings and their service type ──────────────────────────────────────────
//
// A listing names one approved service type when it is created, and creating
// it is what links it. Nothing links or unlinks a listing afterwards: the
// service type is what the listing is about, and proposals and agreements
// inherit it. Editing a listing replaces its one type with another through
// update_service_type_links; deleting a listing clears its links.
//
// Users will link and unlink skills on their profile through the same
// externs; that path is not built yet and is not tested here.

/// Alice (progenitor, admin) and Bob (accepted member) on two conductors.
/// Returns Bob's user hash alongside, since some tests need it.
macro_rules! two_agents_bob_accepted {
    () => {{
        let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

        conductors[0]
            .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
            .await;
        conductors[1]
            .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
            .await;

        await_consistency_s(15, [&alice, &bob]).await.unwrap();

        let bob_links: Vec<Link> = conductors[1]
            .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
            .await;
        let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
        accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

        await_consistency_s(15, [&alice, &bob]).await.unwrap();

        (conductors, alice, bob)
    }};
}

/// Creating a listing that names an approved service type links the two, in
/// both directions, without any further call.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_names_an_approved_service_type() {
    let (conductors, alice, bob) = two_agents_bob_accepted!();

    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Gardening"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Help in the garden", st_hash.clone()))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let requests: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", st_hash.clone())
        .await;
    assert_eq!(requests.len(), 1, "the service type has the request linked");
    assert_eq!(requests[0].signed_action.hashed.hash, req_hash, "and it is that request");

    let types: Vec<ActionHash> = conductors[0]
        .call(
            &alice.zome("service_types"),
            "get_service_types_for_entity",
            GetServiceTypeForEntityInput { original_action_hash: req_hash, entity: "request".to_string() },
        )
        .await;
    assert_eq!(types, vec![st_hash], "the request names exactly that service type");
}

/// A listing cannot name a service type that is still pending approval.
/// Creation links the type, and the link is refused for unapproved types.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_cannot_name_a_pending_service_type() {
    let (conductors, alice, bob) = two_agents_bob_accepted!();

    let pending: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Pending Service"))
        .await;
    let pending_hash = pending.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let result = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("requests"),
            "create_request",
            sample_request("Names a pending type", pending_hash),
        )
        .await;
    assert!(result.is_err(), "a listing cannot name a pending service type");
}

/// A listing cannot name a service type that an admin has rejected.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_cannot_name_a_rejected_service_type() {
    let (conductors, alice, bob) = two_agents_bob_accepted!();

    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Rejected Service"))
        .await;
    let rejected_hash = suggestion.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "reject_service_type", rejected_hash.clone())
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let result = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("offers"),
            "create_offer",
            sample_offer("Names a rejected type", rejected_hash),
        )
        .await;
    assert!(result.is_err(), "a listing cannot name a rejected service type");
}

/// Editing a listing replaces its one service type with another. This is
/// what update_request and update_offer send: a single hash, never a set.
#[tokio::test(flavor = "multi_thread")]
async fn editing_a_listing_replaces_its_service_type() {
    let (conductors, alice, bob) = two_agents_bob_accepted!();

    let first: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Web Development"))
        .await;
    let second: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Design"))
        .await;
    let first_hash = first.signed_action.hashed.hash.clone();
    let second_hash = second.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Help needed", first_hash.clone()))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "update_service_type_links",
            UpdateServiceTypeLinksInput {
                action_hash: req_hash.clone(),
                entity: "request".to_string(),
                new_service_type_hashes: vec![second_hash.clone()],
            },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let types: Vec<ActionHash> = conductors[0]
        .call(
            &alice.zome("service_types"),
            "get_service_types_for_entity",
            GetServiceTypeForEntityInput { original_action_hash: req_hash.clone(), entity: "request".to_string() },
        )
        .await;
    assert_eq!(types, vec![second_hash.clone()], "the request now names the second type, and only it");

    let for_first: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", first_hash)
        .await;
    assert_eq!(for_first.len(), 0, "the first type no longer has the request");

    let for_second: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", second_hash)
        .await;
    assert_eq!(for_second.len(), 1, "the second type has it");
    assert_eq!(for_second[0].signed_action.hashed.hash, req_hash);
}

/// Tombstoning one listing's service-type links leaves another listing's live,
/// even when both name the same type. Links are not erased: DeleteLink actions
/// mark them superseded, and queries stop returning them. This is what the
/// listing delete paths call.
#[tokio::test(flavor = "multi_thread")]
async fn tombstoning_one_listings_links_leaves_others_live() {
    let (conductors, alice, bob) = two_agents_bob_accepted!();

    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Shared Service"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Request naming it", st_hash.clone()))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    let offer: Record = conductors[1]
        .call(&bob.zome("offers"), "create_offer", sample_offer("Offer naming it", st_hash.clone()))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let requests_before: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", st_hash.clone())
        .await;
    let offers_before: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_offers_for_service_type", st_hash.clone())
        .await;
    assert_eq!(requests_before.len(), 1);
    assert_eq!(offers_before.len(), 1);

    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "delete_all_service_type_links_for_entity",
            GetServiceTypeForEntityInput { original_action_hash: req_hash, entity: "request".to_string() },
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let requests_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", st_hash.clone())
        .await;
    assert_eq!(requests_after.len(), 0, "the request's link is gone");

    let offers_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_offers_for_service_type", st_hash)
        .await;
    assert_eq!(offers_after.len(), 1, "the offer's link is untouched");
    assert_eq!(offers_after[0].signed_action.hashed.hash, offer.signed_action.hashed.hash);
}
