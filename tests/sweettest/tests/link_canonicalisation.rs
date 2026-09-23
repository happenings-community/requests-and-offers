//! Link canonicalisation regression test.
//!
//! Design rule under test: no link in the mediums_of_exchange or service_types
//! zomes is ever anchored off the chain root, regardless of which revision hash
//! the caller holds. A request created via a mid-chain (update) hash must be
//! findable from the medium's root, and no link may sit at the revision.
//!
//! Against the unpatched zomes this test fails: either link creation is refused
//! (approval check misses the revision) or the link lands at the revision and
//! the root query comes back empty. Either failure is the defect.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[derive(serde::Serialize, Debug)]
struct MoEUpdateData {
    code: String,
    name: String,
    description: Option<String>,
    exchange_type: String,
    resource_spec_hrea_id: Option<String>,
}

// Newtype wrappers (OriginalActionHash, PreviousActionHash) serialise as their
// inner value, so bare ActionHash fields match the zome's input shape.
#[derive(serde::Serialize, Debug)]
struct MoEUpdateInput {
    original_action_hash: ActionHash,
    previous_action_hash: ActionHash,
    updated_medium_of_exchange: MoEUpdateData,
}

#[tokio::test(flavor = "multi_thread")]
async fn links_created_via_revision_hash_anchor_at_chain_root() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Users. Alice (progenitor) is auto-registered as admin via init callback.
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
    let bob_links: Vec<Link> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_agent_user", bob.agent_pubkey().clone())
        .await;
    let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();
    let bob_user_hash = bob_links[0].target.clone().into_action_hash().unwrap();

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

    // Accept both users so they can suggest and create requests.
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user_hash).await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob suggests a medium of exchange; Alice approves it. The suggest action
    // hash is the chain root.
    let moe_record: Record = conductors[1]
        .call(
            &bob.zome("mediums_of_exchange"),
            "suggest_medium_of_exchange",
            sample_medium_of_exchange("CANON", "Canonicalisation Test Currency"),
        )
        .await;
    let root_hash = moe_record.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let _: () = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "approve_medium_of_exchange",
            root_hash.clone(),
        )
        .await;

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Alice (admin) updates the medium, minting a revision. The update record's
    // own hash is a mid-chain hash: valid, resolvable, but not the root.
    let update_record: Record = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "update_medium_of_exchange",
            MoEUpdateInput {
                original_action_hash: root_hash.clone(),
                previous_action_hash: root_hash.clone(),
                updated_medium_of_exchange: MoEUpdateData {
                    code: "CANON".to_string(),
                    name: "Canonicalisation Test Currency (revised)".to_string(),
                    description: Some("Revised to mint a mid-chain hash".to_string()),
                    exchange_type: "currency".to_string(),
                    resource_spec_hrea_id: None,
                },
            },
        )
        .await;
    let revision_hash = update_record.signed_action.hashed.hash.clone();
    assert_ne!(revision_hash, root_hash, "update must mint a distinct action hash");

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob creates a request holding the REVISION hash, exactly as a UI client
    // whose fetch returned the updated record would.
    let mut request_input = sample_request("Canonicalisation test request");
    request_input.medium_of_exchange_hashes = vec![revision_hash.clone()];
    let request_record: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", request_input)
        .await;
    let request_hash = request_record.signed_action.hashed.hash.clone();

    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Assertion 1: the request is findable from the chain root. This is what
    // every root-anchored reader (including the hREA mirror) depends on.
    let from_root: Vec<Record> = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "get_requests_for_medium_of_exchange",
            root_hash.clone(),
        )
        .await;
    assert!(
        from_root
            .iter()
            .any(|r| r.signed_action.hashed.hash == request_hash),
        "request created via revision hash must be findable from the chain root"
    );

    // Assertion 2: no link sits at the revision. Off-root anchors are the
    // scattering defect; the revision must be bare.
    let from_revision: Vec<Record> = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "get_requests_for_medium_of_exchange",
            revision_hash.clone(),
        )
        .await;
    assert!(
        from_revision.is_empty(),
        "no links may anchor at a mid-chain revision hash"
    );
}
