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

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Alice creates a service type (admin-only; auto-approved).
    let st_record: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Web Development"),
        )
        .await;

    let st_hash = st_record.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Test Service"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Test Service"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

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

    await_consistency(15, [&alice]).await.unwrap();

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

    await_consistency(15, [&alice]).await.unwrap();

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

/// Link and unlink a service type to a request; verify counts.
/// Translated from `service-types.test.ts / ServiceType linking with requests and offers`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_link_to_request_and_unlink() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Accept Bob so he can create requests.
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Alice creates two service types (admin-only → auto-approved).
    let web_dev: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Web Development"))
        .await;
    let _design: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Design Services"))
        .await;

    let web_dev_hash = web_dev.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob creates a request.
    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Help needed"))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Link the service type to the request.
    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "link_to_service_type",
            ServiceTypeLinkInput {
                service_type_hash: web_dev_hash.clone(),
                action_hash: req_hash.clone(),
                entity: "request".to_string(),
            },
        )
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let requests_for_st: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", web_dev_hash.clone())
        .await;
    assert_eq!(requests_for_st.len(), 1, "Should have one request linked");

    let sts_for_req: Vec<ActionHash> = conductors[0]
        .call(
            &alice.zome("service_types"),
            "get_service_types_for_entity",
            GetServiceTypeForEntityInput {
                original_action_hash: req_hash.clone(),
                entity: "request".to_string(),
            },
        )
        .await;
    assert_eq!(sts_for_req.len(), 1);
    assert_eq!(sts_for_req[0], web_dev_hash);

    // Unlink the service type.
    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "unlink_from_service_type",
            ServiceTypeLinkInput {
                service_type_hash: web_dev_hash.clone(),
                action_hash: req_hash.clone(),
                entity: "request".to_string(),
            },
        )
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let after_unlink: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", web_dev_hash)
        .await;
    assert_eq!(after_unlink.len(), 0, "No requests after unlinking");
}

/// `update_service_type_links` replaces the old set with the new set.
/// Translated from `service-types.test.ts / ServiceType update links management`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_update_links_replaces_old() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Accept Bob.
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Alice creates three service types.
    let web_dev: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Web Development"))
        .await;
    let design: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Design"))
        .await;
    let marketing: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Marketing"))
        .await;

    let web_dev_hash = web_dev.signed_action.hashed.hash.clone();
    let design_hash = design.signed_action.hashed.hash.clone();
    let marketing_hash = marketing.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob creates a request to use as the entity.
    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Help needed"))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Initial link set: web_dev + design.
    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "update_service_type_links",
            UpdateServiceTypeLinksInput {
                action_hash: req_hash.clone(),
                entity: "request".to_string(),
                new_service_type_hashes: vec![web_dev_hash.clone(), design_hash.clone()],
            },
        )
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let initial_sts: Vec<ActionHash> = conductors[0]
        .call(
            &alice.zome("service_types"),
            "get_service_types_for_entity",
            GetServiceTypeForEntityInput {
                original_action_hash: req_hash.clone(),
                entity: "request".to_string(),
            },
        )
        .await;
    assert_eq!(initial_sts.len(), 2);

    // Update links: web_dev + marketing (remove design, add marketing).
    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "update_service_type_links",
            UpdateServiceTypeLinksInput {
                action_hash: req_hash.clone(),
                entity: "request".to_string(),
                new_service_type_hashes: vec![web_dev_hash.clone(), marketing_hash.clone()],
            },
        )
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let updated_sts: Vec<ActionHash> = conductors[0]
        .call(
            &alice.zome("service_types"),
            "get_service_types_for_entity",
            GetServiceTypeForEntityInput {
                original_action_hash: req_hash.clone(),
                entity: "request".to_string(),
            },
        )
        .await;
    assert_eq!(updated_sts.len(), 2);

    // Design should no longer be linked to this request.
    let requests_for_design: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", design_hash)
        .await;
    assert_eq!(requests_for_design.len(), 0, "Design should have no request links after update");

    // Marketing should now be linked.
    let requests_for_marketing: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", marketing_hash)
        .await;
    assert_eq!(requests_for_marketing.len(), 1, "Marketing should have one request link");
}

/// `delete_all_service_type_links_for_entity` clears request links without affecting offer links.
/// Translated from `service-types.test.ts / ServiceType deletion and link cleanup`.
#[tokio::test(flavor = "multi_thread")]
async fn service_type_link_cleanup_for_entity() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Accept Bob.
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Test Service"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob creates a request and an offer.
    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Request for cleanup test"))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    let offer: Record = conductors[1]
        .call(&bob.zome("offers"), "create_offer", sample_offer("Offer for cleanup test"))
        .await;
    let offer_hash = offer.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Link the service type to both.
    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "link_to_service_type",
            ServiceTypeLinkInput { service_type_hash: st_hash.clone(), action_hash: req_hash.clone(), entity: "request".to_string() },
        )
        .await;
    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "link_to_service_type",
            ServiceTypeLinkInput { service_type_hash: st_hash.clone(), action_hash: offer_hash.clone(), entity: "offer".to_string() },
        )
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let requests_before: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", st_hash.clone())
        .await;
    let offers_before: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_offers_for_service_type", st_hash.clone())
        .await;
    assert_eq!(requests_before.len(), 1);
    assert_eq!(offers_before.len(), 1);

    // Delete all service type links for the request entity.
    let _: () = conductors[1]
        .call(
            &bob.zome("service_types"),
            "delete_all_service_type_links_for_entity",
            GetServiceTypeForEntityInput { original_action_hash: req_hash, entity: "request".to_string() },
        )
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let requests_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_requests_for_service_type", st_hash.clone())
        .await;
    assert_eq!(requests_after.len(), 0, "Request links should be cleared");

    // Offer links must remain untouched.
    let offers_after: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_offers_for_service_type", st_hash)
        .await;
    assert_eq!(offers_after.len(), 1, "Offer links should be unaffected");
}

// ── Linking enforcement ───────────────────────────────────────────────────────

/// Approved service types (created by admin) can be linked to requests.
/// Translated from `linking-enforcement.test.ts / Approved Service Types can be linked`.
#[tokio::test(flavor = "multi_thread")]
async fn approved_service_type_can_be_linked_to_request() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Accept Bob so he can create requests.
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Alice creates an approved service type.
    let st: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Approved Service"))
        .await;
    let st_hash = st.signed_action.hashed.hash.clone();

    // Bob creates a request.
    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Linking test"))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Linking an approved service type must succeed.
    let result = conductors[1]
        .call_fallible::<_, ()>(
            &bob.zome("service_types"),
            "link_to_service_type",
            ServiceTypeLinkInput { service_type_hash: st_hash, action_hash: req_hash, entity: "request".to_string() },
        )
        .await;
    assert!(result.is_ok(), "Approved service type should be linkable");
}

/// Pending service types (via suggest_service_type) cannot be linked.
/// Translated from `linking-enforcement.test.ts / Pending Service Types cannot be linked`.
#[tokio::test(flavor = "multi_thread")]
async fn pending_service_type_cannot_be_linked() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Accept Bob.
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob suggests a service type (lands in pending, not approved).
    let pending: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Pending Service"))
        .await;
    let pending_hash = pending.signed_action.hashed.hash.clone();

    let req: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Linking test"))
        .await;
    let req_hash = req.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Linking a pending service type must fail.
    let result = conductors[1]
        .call_fallible::<_, ()>(
            &bob.zome("service_types"),
            "link_to_service_type",
            ServiceTypeLinkInput { service_type_hash: pending_hash, action_hash: req_hash, entity: "request".to_string() },
        )
        .await;
    assert!(result.is_err(), "Pending service type should not be linkable");
}

/// Rejected service types cannot be linked.
/// Translated from `linking-enforcement.test.ts / Rejected Service Types cannot be linked`.
#[tokio::test(flavor = "multi_thread")]
async fn rejected_service_type_cannot_be_linked() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Accept Bob.
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob suggests; Alice rejects.
    let suggestion: Record = conductors[1]
        .call(&bob.zome("service_types"), "suggest_service_type", sample_service_type("Rejected Service"))
        .await;
    let st_hash = suggestion.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "reject_service_type", st_hash.clone())
        .await;

    let offer: Record = conductors[1]
        .call(&bob.zome("offers"), "create_offer", sample_offer("Offer for linking test"))
        .await;
    let offer_hash = offer.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Linking a rejected service type must fail.
    let result = conductors[1]
        .call_fallible::<_, ()>(
            &bob.zome("service_types"),
            "link_to_service_type",
            ServiceTypeLinkInput { service_type_hash: st_hash, action_hash: offer_hash, entity: "offer".to_string() },
        )
        .await;
    assert!(result.is_err(), "Rejected service type should not be linkable");
}
