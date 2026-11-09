//! Requests zome tests.
//! Translated from `requests-tests/requests.test.ts` and `requests-archive.test.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_request_crud_operations() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users. Alice (progenitor) is auto-registered as admin via init callback.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Accept Alice's user profile so she can create requests.
    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash.clone()).await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // A listing names one service type, so Alice creates one first.
    // A progenitor's service type lands approved.
    let st_record: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Gardening"),
        )
        .await;
    let st_hash = st_record.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Alice creates a request.
    let req_record: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "create_request",
            sample_request("Help with gardening", st_hash.clone()),
        )
        .await;

    let req_hash = req_record.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob reads the request.
    let req_from_bob: Option<Record> = conductors[1]
        .call(&bob.zome("requests"), "get_latest_request_record", req_hash.clone())
        .await;
    assert!(req_from_bob.is_some(), "Bob should read the request");

    // Get all requests.
    let all_requests: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_active_requests", ())
        .await;
    assert!(!all_requests.is_empty());

    // Get Alice's requests.
    let alice_requests: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_user_requests", alice_user_hash.clone())
        .await;
    assert_eq!(alice_requests.len(), 1, "Alice should have one request");

    // Alice updates the request.
    let mut updated_input = sample_request("Help with gardening (updated)", st_hash.clone());
    updated_input.request.title = "Help with gardening (updated)".to_string();
    let _: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "update_request",
            serde_json::json!({
                "original_action_hash": req_hash,
                "previous_action_hash": req_record.signed_action.hashed.hash,
                "updated_request": updated_input.request,
                "service_type_hash": st_hash,
                "medium_of_exchange_hashes": []
            }),
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_latest_request_record", req_hash.clone())
        .await;
    let updated_req: Request = latest.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(updated_req.title, "Help with gardening (updated)");

    // The list endpoints resolve each link target to its latest revision, so the
    // edit shows on both lists. UserRequests stays anchored at the Create, so this
    // is the list that only the resolve can get right.
    let active: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_active_requests", ())
        .await;
    let mine: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_user_requests", alice_user_hash)
        .await;
    for (list, listed) in [("get_active_requests", active), ("get_user_requests", mine)] {
        let titles: Vec<String> = listed
            .iter()
            .map(|record| record.entry().to_app_option::<Request>().unwrap().unwrap().title)
            .collect();
        assert_eq!(titles, vec!["Help with gardening (updated)".to_string()], "{list}");
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn request_archive_and_delete() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users. Alice (progenitor) is auto-registered as admin via init callback.
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Accept Alice's user profile so she can create requests.
    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash).await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // A listing names one service type.
    let st_record: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Archival Services"),
        )
        .await;
    let st_hash = st_record.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Alice creates a request.
    let req_record: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "create_request",
            sample_request("Request to archive", st_hash.clone()),
        )
        .await;
    let req_hash = req_record.signed_action.hashed.hash.clone();

    // Archive the request (set status to Archived).
    let archived_request = RequestData {
        title: "Request to archive".to_string(),
        status: "Archived".to_string(),
        ..sample_request("x", st_hash.clone()).request
    };
    let _: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "update_request",
            serde_json::json!({
                "original_action_hash": req_hash,
                "previous_action_hash": req_record.signed_action.hashed.hash,
                "updated_request": archived_request,
                "service_type_hash": st_hash,
                "medium_of_exchange_hashes": []
            }),
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let archived: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_latest_request_record", req_hash.clone())
        .await;
    let archived_req: Request =
        archived.unwrap().entry().to_app_option().unwrap().expect("entry");
    assert_eq!(archived_req.status, "Archived");

    // archive_request moves the listing onto the archived path, and the archived
    // list resolves it to its latest revision like every other list.
    let _: bool = conductors[0]
        .call(&alice.zome("requests"), "archive_request", req_hash.clone())
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let archived_list: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_archived_requests", ())
        .await;
    assert_eq!(archived_list.len(), 1, "one archived request");
    let listed: Request = archived_list[0].entry().to_app_option().unwrap().expect("entry");
    assert_eq!(listed.status, "Archived");

    // Delete the request.
    let _: bool = conductors[0]
        .call(&alice.zome("requests"), "delete_request", req_hash.clone())
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let after_delete: Option<Record> = conductors[1]
        .call(&bob.zome("requests"), "get_latest_request_record", req_hash)
        .await;
    assert!(after_delete.is_none(), "Deleted request should not be found");
}

/// Archiving through a revision hash, the hash a client holds once a listing has
/// been edited, must leave the listing Archived wherever it is read from the root.
/// Before the fix the archive's update link hung off the revision, so reads from the
/// root (get_my_listings, get_latest_request_record) still found the edit as newest and
/// reported the listing Active.
#[tokio::test(flavor = "multi_thread")]
async fn request_archived_through_an_edited_revision_reads_archived_from_the_root() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let alice_links: Vec<Link> = conductors[0]
        .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash.clone()).await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let st_record: Record = conductors[0]
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type("Edited then archived"))
        .await;
    let st_hash = st_record.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let created: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Before the edit", st_hash.clone()))
        .await;
    let root = created.signed_action.hashed.hash.clone();

    // An edit, so the listing's latest revision is no longer its root.
    let edited_input = sample_request("After the edit", st_hash.clone());
    let edited: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "update_request",
            serde_json::json!({
                "original_action_hash": root,
                "previous_action_hash": root,
                "updated_request": edited_input.request,
                "service_type_hash": st_hash,
                "medium_of_exchange_hashes": []
            }),
        )
        .await;
    let revision = edited.signed_action.hashed.hash.clone();
    assert_ne!(revision, root, "the edit is a new revision");
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Archived through the revision hash, as the interface does.
    let _: bool = conductors[0]
        .call(&alice.zome("requests"), "archive_request", revision.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_latest_request_record", root.clone())
        .await;
    let latest: Request = latest.expect("found from the root").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.status, "Archived", "read from the root, the listing is archived");

    let mine: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_my_listings", alice_user_hash)
        .await;
    assert_eq!(mine.len(), 1, "one listing of mine");
    let mine: Request = mine[0].entry().to_app_option().unwrap().expect("entry");
    assert_eq!(mine.status, "Archived", "get_my_listings reports it archived");
}
