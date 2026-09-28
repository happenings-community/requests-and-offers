//! Messaging zome substrate test.
//!
//! Proves cross-agent signal delivery end to end: Alice's `send_message` reaches
//! Bob as a `Signal::Message` with the correct content and a `from` field set to
//! Alice via call provenance. Two conductors are used so the signal genuinely
//! crosses the network rather than short-circuiting within one node.
//!
//! No priming call, and no settling sleep. An inbound remote signal is itself a
//! zome call, so the conductor runs Bob's `init` (committing the cap grant that
//! authorises `recv_remote_signal`) before it checks whether Alice's call is
//! authorised: `handle_call_remote` goes through the same `call_zome`, which runs
//! `check_or_run_zome_init` first (holochain 0.6.1, `conductor/cell.rs:396` then
//! `:721`, with `is_authorized` reached later at
//! `core/workflow/call_zome_workflow.rs:250`).
//!
//! What that costs is worth knowing, because it sets the deadline below. The
//! first zome call on a cell costs about twenty seconds here, whatever it calls,
//! and an inbound signal is Bob's first call. It is not the cost of doing `init`
//! work: of the nine coordinator zomes, six have `init` returning
//! `Ok(InitCallbackResult::Pass)` and nothing else, `exchanges` and `misc` have
//! no `init` at all, and only `messaging`'s commits anything (one cap grant).
//! Measured on a 5820, one test at a time:
//!
//! | phase                          | unprimed | after a `misc::ping` first |
//! |--------------------------------|----------|----------------------------|
//! | `send_message` returns         | 19.8s    | 9.9ms                      |
//! | signal reaches Bob             | +18.7s   | +9.3ms                     |
//! | total                          | 62.2s    | 62.8s                      |
//!
//! Priming does not make the test quicker, it only moves the same ~20s into the
//! priming call. So these tests stay unprimed, which is also the only way they
//! prove an unprimed recipient receives anything at all, and the deadline is set
//! from that measurement instead.
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

/// How long to wait for a signal before treating it as non-delivery.
///
/// Set from measurement, not taste. The slowest unprimed arrival seen on a 5820
/// running one test at a time was 20.1s, and CI runs every case on its own
/// (`tests-manual.yml`, the `--exact` loop), so that is the figure that matters.
/// 75s is over three times it, which leaves room for a 4-core hosted runner.
///
/// Do not cut this to 30s. That is close enough to ~20s that the test fails when
/// two of these run at once, which is what `cargo test` does by default locally.
const SIGNAL_DEADLINE: Duration = Duration::from_secs(75);

/// Wait for one `MessagingSignal` on `signals`, or panic with what did arrive.
///
/// Non-delivery is silent by nature, so there is nothing to observe on failure
/// unless the test keeps it: `send_remote_signal` skips any recipient missing
/// from the sender's peer store with a bare `continue` and no error
/// (holochain_p2p 0.6.1, `spawn/actor.rs:1575-1583`), and the host function
/// spawns a detached task that logs transport failures rather than returning
/// them (holochain 0.6.1, `host_fn/send_remote_signal.rs:46`, returning `Ok(())`
/// at `:118`). So on timeout this reports the last app signal that arrived but
/// could not be decoded as a `MessagingSignal`, separating "nothing arrived at
/// all" from "something arrived in a shape this test does not recognise".
/// `recipient` names whose stream it is, so a fan-out failure says who missed out.
async fn await_messaging_signal(
    signals: &mut tokio::sync::broadcast::Receiver<Signal>,
    recipient: &str,
) -> MessagingSignal {
    let mut last_undecodable: Option<String> = None;

    let result = tokio::time::timeout(SIGNAL_DEADLINE, async {
        loop {
            match signals
                .recv()
                .await
                .unwrap_or_else(|e| panic!("{recipient} signal channel error: {e:?}"))
            {
                Signal::App { signal, .. } => {
                    let bytes = signal.into_inner();
                    match bytes.decode::<MessagingSignal>() {
                        Ok(msg) => break msg,
                        Err(e) => {
                            // Another app signal's shape; keep waiting, but
                            // remember it in case ours never comes.
                            let preview = String::from_utf8_lossy(&bytes.0)
                                .chars()
                                .take(120)
                                .collect::<String>();
                            last_undecodable = Some(format!(
                                "{} bytes, decode error {e:?}, lossy preview {preview:?}",
                                bytes.0.len()
                            ));
                        }
                    }
                }
                // System signals are irrelevant here; keep waiting.
                Signal::System(_) => {}
            }
        }
    })
    .await;

    match result {
        Ok(msg) => msg,
        Err(_) => panic!(
            "Timed out after {SIGNAL_DEADLINE:?} waiting for {recipient} to receive the \
             message signal. Last app signal that failed to decode: {}",
            last_undecodable
                .as_deref()
                .unwrap_or("none - no app signal reached this subscriber at all"),
        ),
    }
}

/// Assert a received signal carries what Alice sent, and names Alice as sender.
fn assert_message(
    received: &MessagingSignal,
    stream_id: &str,
    content: &str,
    sender: &AgentPubKey,
    who: &str,
) {
    match received {
        MessagingSignal::Message {
            stream_id: got_stream,
            content: got_content,
            from,
        } => {
            assert_eq!(got_stream, stream_id, "{who}: stream_id should round-trip");
            assert_eq!(got_content, content, "{who}: content should round-trip");
            assert_eq!(
                from, sender,
                "{who}: sender should be Alice, taken from call provenance"
            );
        }
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn send_message_delivers_remote_signal_to_recipient() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Subscribe Bob before Alice sends.
    let mut bob_signals =
        conductors[1].subscribe_to_app_signals("requests_and_offers".to_string());

    let stream_id = "alice-bob".to_string();
    let content = "hello bob".to_string();

    // Bob has received no zome call at this point, and gets none before the
    // signal: his cap grant is committed by `init`, run as part of handling that
    // signal. Do not add a priming call here. It would mask whether that still
    // works, and would not make this test any quicker.
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

    let received = await_messaging_signal(&mut bob_signals, "Bob").await;
    assert_message(&received, &stream_id, &content, alice.agent_pubkey(), "Bob");
}

/// One `send_message` call with two recipients reaches both of them.
///
/// The two-agent test above cannot distinguish "delivers to every recipient"
/// from "delivers to the only recipient there was", because
/// `send_remote_signal` loops over recipients and a one-element loop proves
/// nothing about the second iteration. Features that fan out to a group (every
/// coordinator of an organisation, notification recipients) rest on this, so it
/// is worth a test of its own rather than a second assertion in the test above.
#[tokio::test(flavor = "multi_thread")]
async fn send_message_reaches_every_recipient_in_one_call() {
    let (conductors, alice, bob, carol) = setup_three_agents().await;

    // Subscribe both recipients before Alice sends.
    let mut bob_signals =
        conductors[1].subscribe_to_app_signals("requests_and_offers".to_string());
    let mut carol_signals =
        conductors[2].subscribe_to_app_signals("requests_and_offers".to_string());

    let stream_id = "alice-bob-carol".to_string();
    let content = "hello both".to_string();

    // As above, neither recipient is primed with a zome call first.
    let _: () = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                stream_id: stream_id.clone(),
                content: content.clone(),
                agents: vec![bob.agent_pubkey().clone(), carol.agent_pubkey().clone()],
            },
        )
        .await;

    // Waited on together, not one after the other, so both deadlines run from
    // the send rather than the second starting once the first has finished. A
    // recipient that lags behind the other therefore fails the test instead of
    // being handed a fresh 75s of its own.
    let (for_bob, for_carol) = tokio::join!(
        await_messaging_signal(&mut bob_signals, "Bob"),
        await_messaging_signal(&mut carol_signals, "Carol"),
    );

    assert_message(&for_bob, &stream_id, &content, alice.agent_pubkey(), "Bob");
    assert_message(
        &for_carol,
        &stream_id,
        &content,
        alice.agent_pubkey(),
        "Carol",
    );
}
