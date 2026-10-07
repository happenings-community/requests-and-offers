//! Messaging zome substrate test.
//!
//! Proves cross-agent signal delivery end to end: Alice's `send_nudge` reaches Bob
//! as a `Signal::Nudge` carrying the same `ActionHash`, with `from` set to Alice
//! via call provenance rather than from the payload. Two conductors are used so the
//! signal genuinely crosses the network rather than short-circuiting within one
//! node.
//!
//! A nudge carries one `ActionHash` and never content, so these tests do not
//! assert anything about a message body: there is none to assert. Nothing fetches
//! the hash either, which is why an arbitrary well-formed one is enough here.
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
//! Measured on a 16-core machine, one test at a time:
//!
//! | phase                          | unprimed | after a `misc::ping` first |
//! |--------------------------------|----------|----------------------------|
//! | the send returns               | 19.8s    | 9.9ms                      |
//! | signal reaches Bob             | +18.7s   | +9.3ms                     |
//! | total                          | 62.2s    | 62.8s                      |
//!
//! Priming does not make the test quicker, it only moves the same ~20s into the
//! priming call. So these tests stay unprimed, which is also the only way they
//! prove an unprimed recipient receives anything at all.
//!
//! A hosted runner is about 3.5x slower than the numbers above, which is why the
//! deadline is what it is; see `SIGNAL_DEADLINE`. Both tests log each recipient's
//! arrival time so that figure comes from the runner in future rather than from
//! an inference off this table.
//!
//! The zome's own `Signal` and `SendNudgeInput` types cannot be imported
//! (coordinator crates require a wasm target), so they are mirrored here with a
//! matching serde shape, exactly as `common/mirrors.rs` does for entry types.

use holochain::prelude::*;
use requests_and_offers_sweettest::common::*;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// Mirror of the messaging zome's `SendNudgeInput` (camelCase to match the zome).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendNudgeInput {
    hash: ActionHash,
    agents: Vec<AgentPubKey>,
}

/// Mirror of the messaging zome's `Signal` (internally tagged on `type`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum MessagingSignal {
    Nudge {
        hash: ActionHash,
        from: AgentPubKey,
    },
}

/// A well-formed `ActionHash` that names nothing.
///
/// A nudge is not fetched by the substrate, so the tests do not need the hash to
/// exist: what they prove is that one crosses the network intact and arrives
/// tagged with its sender. `byte` keeps the two tests' hashes distinguishable.
fn nudge_hash(byte: u8) -> ActionHash {
    ActionHash::from_raw_36(vec![byte; 36])
}

/// How long to wait for a signal before treating it as non-delivery.
///
/// Set from measurement on both machines that run this suite, because the first
/// attempt used only the fast one and CI caught it.
///
/// Arrival here means the gap between `send_nudge` returning and the signal
/// reaching the recipient. Measured on a 16-core machine:
///
/// | test | load | arrival |
/// |---|---|---|
/// | two-agent | alone | 20.1s |
/// | fan-out (three conductors) | alone, as CI runs it | 33.9s |
/// | two-agent | both tests at once | 45 to 48s |
/// | fan-out | both tests at once | 45 to 47s |
///
/// Two separate effects, and the fan-out test sits on the wrong side of both. A
/// third conductor costs about 14s even on an idle 16-core box, and contention
/// costs another 12s or so on top. A hosted runner has 4 cores and ran the
/// two-agent test at 221s against ~62s here, so call it 3.5x slower: 33.9s scaled
/// by that is about 119s, comfortably past the 75s this used to be, which is
/// exactly the failure CI reported.
///
/// That was an estimate. The runner's own figure is the one that counts, and CI
/// has since measured it (run 36577965047, on `420d070e`):
///
/// | test | arrival on the runner |
/// |---|---|
/// | two-agent | 68.4s |
/// | fan-out, Carol | 125.7s |
/// | fan-out, Bob | 128.8s |
///
/// 240s is about 1.9 times the slowest of those. The previous two values of this
/// constant were both set from local runs and both turned out too low.
///
/// This costs nothing when the tests pass: the deadline only bounds a failure.
/// Do not tune it down from a local run alone, which is the mistake that produced
/// both 30s and 75s. The arrival times logged by `await_messaging_signal` are
/// there so the next change to this number can be made from the runner's own
/// measurements.
const SIGNAL_DEADLINE: Duration = Duration::from_secs(240);

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
///
/// On success it logs how long the signal took to arrive, measured from `sent`,
/// which is the instant `send_nudge` returned. That number is the only thing
/// that tells us what a hosted runner actually costs, rather than what we infer
/// it costs from a 16-core machine. libtest hides a passing test's output, so the
/// CI loop passes `--show-output`; locally, use `--nocapture`.
async fn await_messaging_signal(
    signals: &mut tokio::sync::broadcast::Receiver<Signal>,
    recipient: &str,
    sent: Instant,
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
        Ok(msg) => {
            eprintln!(
                "[messaging] {recipient} received the signal {:?} after the send returned \
                 (deadline {SIGNAL_DEADLINE:?})",
                sent.elapsed()
            );
            msg
        }
        Err(_) => panic!(
            "Timed out after {SIGNAL_DEADLINE:?} waiting for {recipient} to receive the \
             message signal. Last app signal that failed to decode: {}",
            last_undecodable
                .as_deref()
                .unwrap_or("none - no app signal reached this subscriber at all"),
        ),
    }
}

/// Assert a received nudge carries the hash Alice sent, and names Alice as sender.
fn assert_nudge(received: &MessagingSignal, hash: &ActionHash, sender: &AgentPubKey, who: &str) {
    match received {
        MessagingSignal::Nudge {
            hash: got_hash,
            from,
        } => {
            assert_eq!(got_hash, hash, "{who}: hash should round-trip");
            assert_eq!(
                from, sender,
                "{who}: sender should be Alice, taken from call provenance"
            );
        }
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn send_nudge_reaches_recipient() {
    let (conductors, alice, bob) = setup_two_agents().await;

    // Subscribe Bob before Alice sends.
    let mut bob_signals =
        conductors[1].subscribe_to_app_signals("requests_and_offers".to_string());

    let hash = nudge_hash(0xa1);

    // Bob has received no zome call at this point, and gets none before the
    // signal: his cap grant is committed by `init`, run as part of handling that
    // signal. Do not add a priming call here. It would mask whether that still
    // works, and would not make this test any quicker.
    let _: () = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_nudge",
            SendNudgeInput {
                hash: hash.clone(),
                agents: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;
    let sent = Instant::now();

    let received = await_messaging_signal(&mut bob_signals, "Bob [two-agent]", sent).await;
    assert_nudge(&received, &hash, alice.agent_pubkey(), "Bob");
}

/// One `send_nudge` call with two recipients reaches both of them.
///
/// The two-agent test above cannot distinguish "delivers to every recipient"
/// from "delivers to the only recipient there was", because
/// `send_remote_signal` loops over recipients and a one-element loop proves
/// nothing about the second iteration. Features that fan out to a group (every
/// coordinator of an organisation, notification recipients) rest on this, so it
/// is worth a test of its own rather than a second assertion in the test above.
#[tokio::test(flavor = "multi_thread")]
async fn send_nudge_reaches_every_recipient_in_one_call() {
    let (conductors, alice, bob, carol) = setup_three_agents().await;

    // Subscribe both recipients before Alice sends.
    let mut bob_signals =
        conductors[1].subscribe_to_app_signals("requests_and_offers".to_string());
    let mut carol_signals =
        conductors[2].subscribe_to_app_signals("requests_and_offers".to_string());

    let hash = nudge_hash(0xc2);

    // As above, neither recipient is primed with a zome call first.
    let _: () = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_nudge",
            SendNudgeInput {
                hash: hash.clone(),
                agents: vec![bob.agent_pubkey().clone(), carol.agent_pubkey().clone()],
            },
        )
        .await;
    let sent = Instant::now();

    // Waited on together, not one after the other, so both deadlines run from
    // the send rather than the second starting once the first has finished. A
    // recipient that lags behind the other therefore fails the test instead of
    // being handed a fresh 75s of its own.
    let (for_bob, for_carol) = tokio::join!(
        await_messaging_signal(&mut bob_signals, "Bob [fan-out]", sent),
        await_messaging_signal(&mut carol_signals, "Carol [fan-out]", sent),
    );

    assert_nudge(&for_bob, &hash, alice.agent_pubkey(), "Bob");
    assert_nudge(&for_carol, &hash, alice.agent_pubkey(), "Carol");
}
