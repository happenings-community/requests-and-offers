//! Service types zome tests.
//! Translated from `service-types-tests/service-types.test.ts` and related files.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_service_type_crud_operations() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Create users.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();

    // Register Alice as network admin.
    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "register_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user_hash.clone(),
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

    // Alice creates a service type.
    let st_record: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Web Development"),
        )
        .await;

    let st_hash = st_record.signed_action.hashed.hash.clone();

    await_consistency(&[&alice, &bob]).await.unwrap();

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

    // Get all service types.
    let all_types: Vec<Link> = conductors[0]
        .call(&alice.zome("service_types"), "get_all_service_types", ())
        .await;
    assert!(!all_types.is_empty(), "Should have at least one service type");

    // Alice updates the service type.
    let update_input = UpdateServiceTypeInput {
        original_action_hash: st_hash.clone(),
        previous_action_hash: st_record.signed_action.hashed.hash.clone(),
        updated_service_type: ServiceTypeData {
            name: "Web Development (Updated)".to_string(),
            ..sample_service_type("updated").service_type
        },
    };
    let _: Record = conductors[0]
        .call(&alice.zome("service_types"), "update_service_type", update_input)
        .await;

    await_consistency(&[&alice, &bob]).await.unwrap();

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

    await_consistency(&[&alice, &bob]).await.unwrap();

    let after_delete: Option<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_service_type", st_hash)
        .await;
    assert!(after_delete.is_none(), "Deleted service type should not be found");
}
