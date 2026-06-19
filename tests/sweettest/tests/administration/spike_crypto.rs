//! SPIKE 1 (throwaway): cross-agent async encryption round-trip on hdk 0.6.0.
//! Alice encrypts to Bob's existing agent key; Bob decrypts in his own cell,
//! using only his keystore + Alice's public key (Alice not consulted).

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct SpikeEncryptInput {
    recipient: AgentPubKey,
    plaintext: Vec<u8>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct SpikeDecryptInput {
    sender: AgentPubKey,
    encrypted: XSalsa20Poly1305EncryptedData,
}

#[tokio::test(flavor = "multi_thread")]
async fn spike_crypto_roundtrip() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    let secret = b"steward eyes only".to_vec();

    let encrypted: XSalsa20Poly1305EncryptedData = conductors[0]
        .call(
            &alice.zome("administration"),
            "spike_encrypt",
            SpikeEncryptInput { recipient: bob.agent_pubkey().clone(), plaintext: secret.clone() },
        )
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let recovered: Vec<u8> = conductors[1]
        .call(
            &bob.zome("administration"),
            "spike_decrypt",
            SpikeDecryptInput { sender: alice.agent_pubkey().clone(), encrypted },
        )
        .await;

    assert_eq!(
        recovered, secret,
        "Bob should recover Alice's plaintext using only his keystore + Alice's pubkey"
    );
}
