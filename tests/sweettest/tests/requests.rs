//! Requests zome tests.
//! Translated from `requests-tests/requests.test.ts` and `requests-archive.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_request_crud_operations() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Create users.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Alice creates a request.
    let req_record: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Help with gardening"))
        .await;

    let req_hash = req_record.signed_action.hashed.hash.clone();

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Bob reads the request.
    let req_from_bob: Option<Record> = conductors[1]
        .call(&bob.zome("requests"), "get_latest_request_record", req_hash.clone())
        .await;
    assert!(req_from_bob.is_some(), "Bob should read the request");

    // Get all requests.
    let all_requests: Vec<Link> = conductors[0]
        .call(&alice.zome("requests"), "get_all_requests", ())
        .await;
    assert!(!all_requests.is_empty());

    // Get Alice's requests.
    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();

    let alice_requests: Vec<Link> = conductors[0]
        .call(&alice.zome("requests"), "get_user_requests", alice_user_hash)
        .await;
    assert_eq!(alice_requests.len(), 1, "Alice should have one request");

    // Alice updates the request.
    let mut updated_input = sample_request("Help with gardening (updated)");
    updated_input.request.title = "Help with gardening (updated)".to_string();
    let _: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "update_request",
            serde_json::json!({
                "original_action_hash": req_hash,
                "previous_action_hash": req_record.signed_action.hashed.hash,
                "updated_request": updated_input
            }),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_latest_request_record", req_hash.clone())
        .await;
    let updated_req: Request = latest.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(updated_req.title, "Help with gardening (updated)");
}

#[tokio::test(flavor = "multi_thread")]
async fn request_archive_and_delete() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Create users.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    // Alice creates a request.
    let req_record: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Request to archive"))
        .await;
    let req_hash = req_record.signed_action.hashed.hash.clone();

    // Archive the request (set status to Archived).
    let archived_input = CreateRequestInput {
        request: RequestData {
            title: "Request to archive".to_string(),
            status: "Archived".to_string(),
            ..sample_request("x").request
        },
        ..sample_request("x")
    };
    let _: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "update_request",
            serde_json::json!({
                "original_action_hash": req_hash,
                "previous_action_hash": req_record.signed_action.hashed.hash,
                "updated_request": archived_input
            }),
        )
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let archived: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_latest_request_record", req_hash.clone())
        .await;
    let archived_req: Request =
        archived.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(archived_req.status, "Archived");

    // Delete the request.
    let _: ActionHash = conductors[0]
        .call(&alice.zome("requests"), "delete_request", req_hash.clone())
        .await;

    await_consistency(60, [&alice, &bob]).await.unwrap();

    let after_delete: Option<Record> = conductors[1]
        .call(&bob.zome("requests"), "get_latest_request_record", req_hash)
        .await;
    assert!(after_delete.is_none(), "Deleted request should not be found");
}
