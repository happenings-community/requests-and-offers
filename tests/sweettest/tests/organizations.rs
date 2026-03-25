//! Organizations zome tests.
//! Translated from `organizations/organizations.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_organization_operations() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users. Alice (progenitor) is auto-registered as admin via init callback.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();

    // Register Alice as admin (idempotent since progenitor auto-registration already did this).
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

    // Alice creates an organization.
    let org_record: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "create_organization",
            sample_organization("Test Org"),
        )
        .await;

    let org_hash = org_record.signed_action.hashed.hash.clone();
    let org: Organization = org_record.entry().to_app_option().unwrap().expect("org entry");
    assert_eq!(org.name, "Test Org");

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Bob reads the organization.
    let org_from_bob: Option<Record> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_latest_organization_record", org_hash.clone())
        .await;
    assert!(org_from_bob.is_some(), "Bob should read the organization");

    // Verify organization status starts as pending.
    let org_status: Option<Status> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_ORGANIZATIONS,
                "entity_original_action_hash": org_hash
            }),
        )
        .await;
    assert_eq!(org_status.unwrap().status_type, "pending");

    // Alice updates the organization.
    let updated_input = OrganizationInput {
        name: "Updated Test Org".to_string(),
        ..sample_organization("Updated Test Org")
    };
    let _: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "update_organization",
            serde_json::json!({
                "original_action_hash": org_hash,
                "previous_action_hash": org_record.signed_action.hashed.hash,
                "updated_organization": updated_input
            }),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_latest_organization_record",
            org_hash,
        )
        .await;
    let latest_org: Organization = latest.unwrap().entry().to_app_option().unwrap().expect("org");
    assert_eq!(latest_org.name, "Updated Test Org");
}

#[tokio::test(flavor = "multi_thread")]
async fn organization_membership_management() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users. Alice (progenitor) is auto-registered as admin via init callback.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
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

    // Accept Alice and Bob's user profiles so they can be org members.
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash.clone()).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash.clone()).await;

    // Alice creates organization.
    let org_record: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "create_organization",
            sample_organization("Member Test Org"),
        )
        .await;
    let org_hash = org_record.signed_action.hashed.hash.clone();

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Accept the organization so membership operations are allowed.
    accept_entity(&conductors[0], &alice, ENTITY_ORGANIZATIONS, org_hash.clone()).await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Add Bob as member.
    let _: bool = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "add_member_to_organization",
            serde_json::json!({
                "organization_original_action_hash": org_hash,
                "user_original_action_hash": bob_user_hash
            }),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let members: Vec<Link> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_organization_members_links",
            org_hash.clone(),
        )
        .await;
    // Alice is auto-added as member on create_organization; Bob makes it 2.
    assert_eq!(members.len(), 2, "Organization should have two members (Alice + Bob)");

    // Bob leaves the organization.
    let _: bool = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "leave_organization",
            org_hash.clone(),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let members_after: Vec<Link> = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "get_organization_members_links",
            org_hash,
        )
        .await;
    // Alice (creator) remains; only Bob left.
    assert_eq!(members_after.len(), 1, "Organization should have one member (Alice) after Bob leaves");
}
