//! Reads and deletes given a revision hash, as the interface holds one once a record has
//! been edited (#229).
//!
//! Every update link is anchored at the chain root (#184), so a `get_latest_*_record`
//! asked with a revision found no links and returned that revision as if it were the
//! latest. Each read case edits a record twice and asks with the first revision: against
//! the unpatched zomes it returns the first edit.
//!
//! A delete left an edited listing reachable. It never removed the active list's link,
//! which an edit moves to the newest revision, nor the service type and medium links each
//! edit makes from its revision, and it deleted only the one record it was given. Each
//! delete case is one the unpatched zomes leave listed: two edits deleted through the
//! first revision, or one edit deleted through the root.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

/// Alice, the progenitor, with an accepted profile and one service type to name.
async fn alice_ready() -> (SweetConductorBatch, SweetCell, SweetCell, ActionHash, ActionHash) {
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
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Chain root reads"),
        )
        .await;
    let st_hash = st_record.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    (conductors, alice, bob, alice_user_hash, st_hash)
}

fn hash_of(record: &Record) -> ActionHash {
    record.signed_action.hashed.hash.clone()
}

// ── Offers ───────────────────────────────────────────────────

async fn edit_offer(
    conductor: &SweetConductor,
    cell: &SweetCell,
    original: &ActionHash,
    previous: &ActionHash,
    title: &str,
    st_hash: &ActionHash,
) -> Record {
    conductor
        .call(
            &cell.zome("offers"),
            "update_offer",
            serde_json::json!({
                "original_action_hash": original,
                "previous_action_hash": previous,
                "updated_offer": sample_offer(title, st_hash.clone()).offer,
                "service_type_hash": st_hash,
                "medium_of_exchange_hashes": []
            }),
        )
        .await
}

#[tokio::test(flavor = "multi_thread")]
async fn an_offer_read_through_its_first_revision_is_its_latest() {
    let (conductors, alice, bob, _, st_hash) = alice_ready().await;

    let created: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Created", st_hash.clone()))
        .await;
    let root = hash_of(&created);
    let first = hash_of(&edit_offer(&conductors[0], &alice, &root, &root, "First edit", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    // The interface's "original" after one edit is the revision it read back.
    edit_offer(&conductors[0], &alice, &first, &first, "Second edit", &st_hash).await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("offers"), "get_latest_offer_record", first)
        .await;
    let latest: Offer = latest.expect("found").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.title, "Second edit", "read from a revision, the latest is the second edit");
}

/// Every surface that lists an offer, read once it has been deleted.
async fn assert_offer_gone(
    conductors: &SweetConductorBatch,
    alice: &SweetCell,
    bob: &SweetCell,
    alice_user_hash: &ActionHash,
    st_hash: &ActionHash,
    hashes: &[ActionHash],
) {
    let active: Vec<Record> = conductors[1]
        .call(&bob.zome("offers"), "get_active_offers", ())
        .await;
    assert!(active.is_empty(), "not in the active list");
    let for_type: Vec<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_offers_for_service_type", st_hash.clone())
        .await;
    assert!(for_type.is_empty(), "not under its service type");
    // Both read the author's own links, so they are asked as the author.
    let users: Vec<Record> = conductors[0]
        .call(&alice.zome("offers"), "get_user_offers", alice_user_hash.clone())
        .await;
    assert!(users.is_empty(), "not in the member's offers");
    let mine: Vec<Record> = conductors[0]
        .call(&alice.zome("offers"), "get_my_listings", alice_user_hash.clone())
        .await;
    assert!(mine.is_empty(), "not in the member's own listings");
    for hash in hashes {
        let latest: Option<Record> = conductors[1]
            .call(&bob.zome("offers"), "get_latest_offer_record", hash.clone())
            .await;
        assert!(latest.is_none(), "not read from its root or any revision");
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn an_offer_deleted_through_its_first_revision_after_two_edits_leaves_every_list() {
    let (conductors, alice, bob, alice_user_hash, st_hash) = alice_ready().await;

    let created: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Created", st_hash.clone()))
        .await;
    let root = hash_of(&created);
    let first = hash_of(&edit_offer(&conductors[0], &alice, &root, &root, "First edit", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let second =
        hash_of(&edit_offer(&conductors[0], &alice, &first, &first, "Second edit", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: bool = conductors[0]
        .call(&alice.zome("offers"), "delete_offer", first.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    assert_offer_gone(&conductors, &alice, &bob, &alice_user_hash, &st_hash, &[root, first, second])
        .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn an_offer_deleted_through_its_root_after_an_edit_leaves_every_list() {
    let (conductors, alice, bob, alice_user_hash, st_hash) = alice_ready().await;

    let created: Record = conductors[0]
        .call(&alice.zome("offers"), "create_offer", sample_offer("Created", st_hash.clone()))
        .await;
    let root = hash_of(&created);
    let revision = hash_of(&edit_offer(&conductors[0], &alice, &root, &root, "Edited", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: bool = conductors[0]
        .call(&alice.zome("offers"), "delete_offer", root.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    assert_offer_gone(&conductors, &alice, &bob, &alice_user_hash, &st_hash, &[root, revision]).await;
}

// ── Requests ─────────────────────────────────────────────────

async fn edit_request(
    conductor: &SweetConductor,
    cell: &SweetCell,
    original: &ActionHash,
    previous: &ActionHash,
    title: &str,
    st_hash: &ActionHash,
) -> Record {
    conductor
        .call(
            &cell.zome("requests"),
            "update_request",
            serde_json::json!({
                "original_action_hash": original,
                "previous_action_hash": previous,
                "updated_request": sample_request(title, st_hash.clone()).request,
                "service_type_hash": st_hash,
                "medium_of_exchange_hashes": []
            }),
        )
        .await
}

#[tokio::test(flavor = "multi_thread")]
async fn a_request_read_through_its_first_revision_is_its_latest() {
    let (conductors, alice, bob, _, st_hash) = alice_ready().await;

    let created: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Created", st_hash.clone()))
        .await;
    let root = hash_of(&created);
    let first =
        hash_of(&edit_request(&conductors[0], &alice, &root, &root, "First edit", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    edit_request(&conductors[0], &alice, &first, &first, "Second edit", &st_hash).await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("requests"), "get_latest_request_record", first)
        .await;
    let latest: Request = latest.expect("found").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.title, "Second edit", "read from a revision, the latest is the second edit");
}

/// Every surface that lists a request, read once it has been deleted.
async fn assert_request_gone(
    conductors: &SweetConductorBatch,
    alice: &SweetCell,
    bob: &SweetCell,
    alice_user_hash: &ActionHash,
    st_hash: &ActionHash,
    hashes: &[ActionHash],
) {
    let active: Vec<Record> = conductors[1]
        .call(&bob.zome("requests"), "get_active_requests", ())
        .await;
    assert!(active.is_empty(), "not in the active list");
    let for_type: Vec<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_requests_for_service_type", st_hash.clone())
        .await;
    assert!(for_type.is_empty(), "not under its service type");
    // Both read the author's own links, so they are asked as the author.
    let users: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_user_requests", alice_user_hash.clone())
        .await;
    assert!(users.is_empty(), "not in the member's requests");
    let mine: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_my_listings", alice_user_hash.clone())
        .await;
    assert!(mine.is_empty(), "not in the member's own listings");
    for hash in hashes {
        let latest: Option<Record> = conductors[1]
            .call(&bob.zome("requests"), "get_latest_request_record", hash.clone())
            .await;
        assert!(latest.is_none(), "not read from its root or any revision");
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn a_request_deleted_through_its_first_revision_after_two_edits_leaves_every_list() {
    let (conductors, alice, bob, alice_user_hash, st_hash) = alice_ready().await;

    let created: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Created", st_hash.clone()))
        .await;
    let root = hash_of(&created);
    let first =
        hash_of(&edit_request(&conductors[0], &alice, &root, &root, "First edit", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let second =
        hash_of(&edit_request(&conductors[0], &alice, &first, &first, "Second edit", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: bool = conductors[0]
        .call(&alice.zome("requests"), "delete_request", first.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    assert_request_gone(&conductors, &alice, &bob, &alice_user_hash, &st_hash, &[root, first, second])
        .await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_request_deleted_through_its_root_after_an_edit_leaves_every_list() {
    let (conductors, alice, bob, alice_user_hash, st_hash) = alice_ready().await;

    let created: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Created", st_hash.clone()))
        .await;
    let root = hash_of(&created);
    let revision =
        hash_of(&edit_request(&conductors[0], &alice, &root, &root, "Edited", &st_hash).await);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: bool = conductors[0]
        .call(&alice.zome("requests"), "delete_request", root.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    assert_request_gone(&conductors, &alice, &bob, &alice_user_hash, &st_hash, &[root, revision])
        .await;
}

// ── Users, organisations, statuses ───────────────────────────

#[tokio::test(flavor = "multi_thread")]
async fn a_user_read_through_their_first_revision_is_their_latest() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    let created: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    let root = hash_of(&created);
    let edit = |original: ActionHash, previous: ActionHash, bio: &str| UpdateUserInput {
        original_action_hash: original,
        previous_action_hash: previous,
        updated_user: UserInput { bio: bio.to_string(), ..sample_user("Alice") },
    };
    let first: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "update_user", edit(root.clone(), root, "First edit"))
        .await;
    let first = hash_of(&first);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let _: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "update_user",
            edit(first.clone(), first.clone(), "Second edit"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_latest_user_record", first)
        .await;
    let latest: User = latest.expect("found").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.bio, "Second edit", "read from a revision, the latest is the second edit");
}

#[tokio::test(flavor = "multi_thread")]
async fn an_organisation_read_through_its_first_revision_is_its_latest() {
    let (conductors, alice, bob, _, _) = alice_ready().await;

    let created: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "create_organization",
            sample_organization("Created"),
        )
        .await;
    let root = hash_of(&created);
    let edit = |original: &ActionHash, previous: &ActionHash, name: &str| {
        serde_json::json!({
            "original_action_hash": original,
            "previous_action_hash": previous,
            "updated_organization": sample_organization(name)
        })
    };
    let first: Record = conductors[0]
        .call(&alice.zome("users_organizations"), "update_organization", edit(&root, &root, "First edit"))
        .await;
    let first = hash_of(&first);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let _: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "update_organization",
            edit(&first, &first, "Second edit"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_latest_organization_record", first)
        .await;
    let latest: Organization =
        latest.expect("found").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.name, "Second edit", "read from a revision, the latest is the second edit");
}

#[tokio::test(flavor = "multi_thread")]
async fn a_status_read_through_its_first_revision_is_its_latest() {
    // Alice's own profile is what registers her, the progenitor, as an administrator.
    let (conductors, alice, bob, _, _) = alice_ready().await;

    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();

    // Accepting is the status's first revision.
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash.clone()).await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let first: Option<Record> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({ "entity": ENTITY_USERS, "entity_original_action_hash": bob_user_hash }),
        )
        .await;
    let first = hash_of(&first.expect("a status"));

    let _: Record = conductors[0]
        .call(
            &alice.zome("administration"),
            "update_entity_status",
            UpdateEntityStatusInput {
                entity: ENTITY_USERS.to_string(),
                entity_original_action_hash: bob_user_hash,
                status_original_action_hash: first.clone(),
                status_previous_action_hash: first.clone(),
                new_status: rejected_status("a second revision"),
            },
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("administration"), "get_latest_status_record", first)
        .await;
    let latest: Status = latest.expect("found").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.status_type, "rejected", "read from a revision, the latest is the second");
}

// ── Service types and mediums of exchange ────────────────────

#[tokio::test(flavor = "multi_thread")]
async fn a_service_type_read_through_its_first_revision_is_its_latest() {
    let (conductors, alice, bob, _, root) = alice_ready().await;

    let edit = |original: ActionHash, previous: ActionHash, name: &str| UpdateServiceTypeInput {
        original_action_hash: original,
        previous_action_hash: previous,
        updated_service_type: sample_service_type(name).service_type,
    };
    // update_service_type answers with the new revision's hash, not its record.
    let first: ActionHash = conductors[0]
        .call(&alice.zome("service_types"), "update_service_type", edit(root.clone(), root, "First edit"))
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let _: ActionHash = conductors[0]
        .call(
            &alice.zome("service_types"),
            "update_service_type",
            edit(first.clone(), first.clone(), "Second edit"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_latest_service_type_record", first)
        .await;
    let latest: ServiceType = latest.expect("found").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.name, "Second edit", "read from a revision, the latest is the second edit");
}

#[derive(serde::Serialize, Debug)]
struct MoEUpdateInput {
    original_action_hash: ActionHash,
    previous_action_hash: ActionHash,
    updated_medium_of_exchange: MediumOfExchangeData,
}

#[tokio::test(flavor = "multi_thread")]
async fn a_medium_of_exchange_read_through_its_first_revision_is_its_latest() {
    let (conductors, alice, bob, _, _) = alice_ready().await;

    let suggested: Record = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "suggest_medium_of_exchange",
            sample_medium_of_exchange("ROOT", "Created"),
        )
        .await;
    let root = hash_of(&suggested);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let _: () = conductors[0]
        .call(&alice.zome("mediums_of_exchange"), "approve_medium_of_exchange", root.clone())
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let edit = |original: ActionHash, previous: ActionHash, name: &str| MoEUpdateInput {
        original_action_hash: original,
        previous_action_hash: previous,
        updated_medium_of_exchange: sample_medium_of_exchange("ROOT", name).medium_of_exchange,
    };
    // Approval may itself write a revision, so the first edit follows the latest.
    let approved: Option<Record> = conductors[0]
        .call(&alice.zome("mediums_of_exchange"), "get_latest_medium_of_exchange_record", root.clone())
        .await;
    let approved = hash_of(&approved.expect("the approved medium"));
    let first: Record = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "update_medium_of_exchange",
            edit(root.clone(), approved, "First edit"),
        )
        .await;
    let first = hash_of(&first);
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let _: Record = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "update_medium_of_exchange",
            edit(first.clone(), first.clone(), "Second edit"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("mediums_of_exchange"), "get_latest_medium_of_exchange_record", first)
        .await;
    let latest: MediumOfExchange =
        latest.expect("found").entry().to_app_option().unwrap().expect("entry");
    assert_eq!(latest.name, "Second edit", "read from a revision, the latest is the second edit");
}
