//! Conversation membrane tests.
//!
//! The conversation role is provisioned directly with real properties rather than
//! cloned, because that is the shortest path to exercising `check_agent` at genesis.
//! The clone lifecycle is a separate concern with its own harness.

use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

const CONVERSATION_ID: &str = "test-conversation-0001";

#[tokio::test(flavor = "multi_thread")]
async fn peer_is_admitted_without_a_membrane_proof() {
    let conductor = SweetConductor::from_standard_config().await;
    let (alice, bob) = SweetAgents::two(conductor.keystore()).await;

    let peers = ordered_peers(&[alice.clone(), bob.clone()]);
    let props = conversation_properties(&peers, CONVERSATION_ID);

    let installed = install_with_conversation(&conductor, props, None, Some(alice.clone()))
        .await
        .expect("installing with alice as a listed peer should succeed");

    assert_eq!(
        installed.role_assignments().len(),
        3,
        "expected the three roles from happ.yaml"
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn unordered_peers_are_refused() {
    let conductor = SweetConductor::from_standard_config().await;
    let (alice, bob) = SweetAgents::two(conductor.keystore()).await;

    // Deliberately reversed relative to `ordered_peers`, so the pair is descending.
    let mut peers = ordered_peers(&[alice.clone(), bob.clone()]);
    peers.reverse();

    let props = conversation_properties_unchecked(&peers, CONVERSATION_ID);
    let result = install_with_conversation(&conductor, props, None, Some(alice.clone())).await;

    assert_refused(result, "ascending and distinct");
}

#[tokio::test(flavor = "multi_thread")]
async fn stranger_without_a_proof_is_refused() {
    let conductor = SweetConductor::from_standard_config().await;
    let (alice, bob) = SweetAgents::two(conductor.keystore()).await;
    let carol = SweetAgents::one(conductor.keystore()).await;

    let peers = ordered_peers(&[alice, bob]);
    let props = conversation_properties(&peers, CONVERSATION_ID);

    let result = install_with_conversation(&conductor, props, None, Some(carol)).await;

    assert_refused(result, "a membrane proof is required");
}

#[tokio::test(flavor = "multi_thread")]
async fn stranger_with_a_peer_signed_proof_is_admitted() {
    let conductor = SweetConductor::from_standard_config().await;
    let (alice, bob) = SweetAgents::two(conductor.keystore()).await;
    let carol = SweetAgents::one(conductor.keystore()).await;

    let peers = ordered_peers(&[alice.clone(), bob.clone()]);
    let props = conversation_properties(&peers, CONVERSATION_ID);
    let proof = issue_proof(&conductor, &alice, &carol, CONVERSATION_ID).await;

    install_with_conversation(&conductor, props, Some(proof), Some(carol))
        .await
        .expect("a proof signed by a peer should admit an invited agent");
}

#[tokio::test(flavor = "multi_thread")]
async fn proof_signed_by_a_non_peer_is_refused() {
    let conductor = SweetConductor::from_standard_config().await;
    let (alice, bob) = SweetAgents::two(conductor.keystore()).await;
    let carol = SweetAgents::one(conductor.keystore()).await;
    let mallory = SweetAgents::one(conductor.keystore()).await;

    let peers = ordered_peers(&[alice, bob]);
    let props = conversation_properties(&peers, CONVERSATION_ID);
    let proof = issue_proof(&conductor, &mallory, &carol, CONVERSATION_ID).await;

    let result = install_with_conversation(&conductor, props, Some(proof), Some(carol)).await;

    assert_refused(result, "not signed by a participant");
}
