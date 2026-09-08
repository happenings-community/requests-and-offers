//! Messaging zome substrate test.
//!
//! Proves cross-agent signal delivery end to end: Alice's `send_message` reaches
//! Bob as a `Signal::Message` with the correct content and a `from` field set to
//! Alice via call provenance. Two conductors are used so the signal genuinely
//! crosses the network rather than short-circuiting within one node.
//!
//! Both cells are primed with a `ping` call first, because `init` runs lazily on
//! a cell's first zome call, and it is `init` that commits the cap grant
//! authorising `recv_remote_signal`. Without priming Bob, his grant would not
//! exist when Alice's signal arrives and it would be silently dropped.
//!
//! The zome's own `Signal` and `SendMessageInput` types cannot be imported
//! (coordinator crates require a wasm target), so they are mirrored here with a
//! matching serde shape, exactly as `common/mirrors.rs` does for entry types.

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
    let (conductors, alice, bob) = setup_two_agents().await;

    // Prime both cells so their `init` runs and the cap grant for
    // `recv_remote_signal` is committed before any signal is sent.
    let _: String = conductors[0]
        .call(&alice.zome("messaging"), "ping", ())
        .await;
    let _: String = conductors[1]
        .call(&bob.zome("messaging"), "ping", ())
        .await;

    // Let the cap grants and peer connections settle.
    tokio::time::sleep(Duration::from_secs(2)).await;

    // Subscribe Bob before Alice sends.
    let mut bob_signals =
        conductors[1].subscribe_to_app_signals("requests_and_offers".to_string());

    let stream_id = "alice-bob".to_string();
    let content = "hello bob".to_string();

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

    // Bob should receive the remote signal, decodable as our Message. The timeout
    // turns a silent non-delivery into a loud failure rather than a hang.
    let received: MessagingSignal = tokio::time::timeout(Duration::from_secs(30), async {
        loop {
            match bob_signals.recv().await.expect("Bob signal channel error") {
                Signal::App { signal, .. } => {
                    if let Ok(msg) = signal.into_inner().decode::<MessagingSignal>() {
                        break msg;
                    }
                    // Some other app-signal shape; keep waiting.
                }
                // System signals are irrelevant here; keep waiting.
                Signal::System(_) => {}
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
