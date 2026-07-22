//! Messaging zome substrate test.
//!
//! Proves the cross-agent signal path end to end: Alice calls `send_message`
//! addressed to Bob, and Bob's conductor receives the emitted signal with the
//! correct content and a `from` field set to Alice via call provenance.
//!
//! Both cells are primed with a `ping` call first, because `init` runs lazily
//! on a cell's first zome call, and it is `init` that commits the cap grant
//! authorising `recv_remote_signal`. Without priming Bob, his grant would not
//! exist when Alice's signal arrives and it would be silently dropped.
//!
//! canonical `remote_signal_test` does); `RUST_LOG` alone is not enough.

use holochain::prelude::*;
use requests_and_offers_sweettest::common::*;
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Mirror of the messaging zome's `SendMessageInput` (camelCase to match the zome).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageInput {
    stream_id: String,
    content: String,
    agents: Vec<AgentPubKey>,
}

/// Mirror of the messaging zome's `Signal` (internally tagged on `type`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum MessagingSignal {
    Message {
        stream_id: String,
        content: String,
        from: AgentPubKey,
    },
}

#[tokio::test(flavor = "multi_thread")]
async fn send_message_delivers_remote_signal_to_recipient() {
    // Turn on conductor tracing so RUST_LOG=info actually surfaces logs.

    let (conductors, alice, bob) = setup_two_agents().await;

    // Prime both cells so their `init` runs and the cap grant for
    // `recv_remote_signal` is committed before any signal is sent.
    let alice_ping: String = conductors[0]
        .call(&alice.zome("messaging"), "ping", ())
        .await;
    let bob_ping: String = conductors[1]
        .call(&bob.zome("messaging"), "ping", ())
        .await;
    println!("PRIME: alice ping = {alice_ping:?}, bob ping = {bob_ping:?}");

    // Give the cap grants and peer connections a moment to settle.
    tokio::time::sleep(Duration::from_secs(2)).await;

    // Subscribe Bob before Alice sends.
    let mut bob_signals =
        conductors[1].subscribe_to_app_signals("requests_and_offers".to_string());

    let stream_id = "alice-bob".to_string();
    let content = "hello bob".to_string();

    println!("SEND: alice -> bob ({})", bob.agent_pubkey());
    let _: () = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                stream_id: stream_id.clone(),
                content: content.clone(),
                agents: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;
    println!("SEND: send_message returned ok");

    let received: MessagingSignal = tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            match bob_signals.recv().await.expect("Bob signal channel error") {
                Signal::App { signal, .. } => {
                    match signal.into_inner().decode::<MessagingSignal>() {
                        Ok(msg) => {
                            println!("RECV: bob decoded a MessagingSignal");
                            break msg;
                        }
                        Err(e) => println!("RECV: bob got an app signal we could not decode: {e:?}"),
                    }
                }
                other => println!("RECV: bob got a non-app signal: {other:?}"),
            }
        }
    })
    .await
    .expect("Timed out waiting for Bob to receive the message signal");

    match received {
        MessagingSignal::Message {
            stream_id: got_stream,
            content: got_content,
            from,
        } => {
            assert_eq!(got_stream, stream_id, "stream_id should round-trip");
            assert_eq!(got_content, content, "content should round-trip");
            assert_eq!(
                &from,
                alice.agent_pubkey(),
                "sender should be Alice, taken from call provenance"
            );
        }
    }
}
