//! SPIKE 2 (throwaway): per-case content key wrapped to a cohort, then RE-WRAPPED
//! to a returning/replacement admin. Three agents: Alice (handler), Bob (co-signer),
//! Carol (returning/replacement admin). Uses the proven setup_three_agents helper.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct CreateCaseOutput {
    key_ref: XSalsa20Poly1305KeyRef,
    ciphertext: XSalsa20Poly1305EncryptedData,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct WrapInput {
    sender_x: X25519PubKey,
    recipient_x: X25519PubKey,
    key_ref: XSalsa20Poly1305KeyRef,
}

#[derive(serde::Serialize, serde::Deserialize, Debug)]
struct OpenInput {
    recipient_x: X25519PubKey,
    sender_x: X25519PubKey,
    wrapped_key: XSalsa20Poly1305EncryptedData,
    ciphertext: XSalsa20Poly1305EncryptedData,
}

#[tokio::test(flavor = "multi_thread")]
async fn spike_sharedsecret_rewrap() {
    let (conductors, alice, bob, carol) = setup_three_agents().await;

    // 1. Each steward mints an x25519 encryption key.
    let alice_x: X25519PubKey = conductors[0]
        .call(&alice.zome("administration"), "spike_new_x25519", ())
        .await;
    let bob_x: X25519PubKey = conductors[1]
        .call(&bob.zome("administration"), "spike_new_x25519", ())
        .await;
    let carol_x: X25519PubKey = conductors[2]
        .call(&carol.zome("administration"), "spike_new_x25519", ())
        .await;

    let secret = b"steward eyes only".to_vec();

    // 2. Handler mints the per-case content key and encrypts the content once.
    let case: CreateCaseOutput = conductors[0]
        .call(&alice.zome("administration"), "spike_create_case", secret.clone())
        .await;

    // 3. Wrap to the co-signer; co-signer opens it.
    let wrap_bob: XSalsa20Poly1305EncryptedData = conductors[0]
        .call(
            &alice.zome("administration"),
            "spike_wrap",
            WrapInput { sender_x: alice_x.clone(), recipient_x: bob_x.clone(), key_ref: case.key_ref.clone() },
        )
        .await;
    let bob_plain: Vec<u8> = conductors[1]
        .call(
            &bob.zome("administration"),
            "spike_open",
            OpenInput {
                recipient_x: bob_x.clone(),
                sender_x: alice_x.clone(),
                wrapped_key: wrap_bob,
                ciphertext: case.ciphertext.clone(),
            },
        )
        .await;
    assert_eq!(bob_plain, secret, "co-signer (Bob) should decrypt the case");

    // 4. RE-WRAP the same content key to a returning/replacement admin; she opens it.
    let wrap_carol: XSalsa20Poly1305EncryptedData = conductors[0]
        .call(
            &alice.zome("administration"),
            "spike_wrap",
            WrapInput { sender_x: alice_x.clone(), recipient_x: carol_x.clone(), key_ref: case.key_ref.clone() },
        )
        .await;
    let carol_plain: Vec<u8> = conductors[2]
        .call(
            &carol.zome("administration"),
            "spike_open",
            OpenInput {
                recipient_x: carol_x.clone(),
                sender_x: alice_x.clone(),
                wrapped_key: wrap_carol,
                ciphertext: case.ciphertext.clone(),
            },
        )
        .await;
    assert_eq!(carol_plain, secret, "re-admitted steward (Carol) should decrypt via re-wrap");
}
