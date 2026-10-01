//! Messaging inbox: encryption first.
//!
//! These three cases prove the encryption before anything else is built on it. A
//! recipient reads what was sent, a sender reads their own sent copy, and a third
//! member holding the same public entry cannot read it. Everything else in the inbox
//! rests on those, so they come first and they run first.
//!
//! The entry is public: sender, recipient and timestamp are on the DHT for the life of
//! the network, and only the content and the conversation grouping are private. That is
//! the trade recorded in the brief, and the third case is what demonstrates the private
//! half actually holds.
//!
//! Each conductor's first zome call costs about twenty seconds on a developer machine,
//! so expect minutes per case. Run one case per process.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};

/// Mirror of the coordinator's `SendMessageInput`, for an ordinary message.
///
/// **No `kind` field, deliberately.** The coordinator's `kind` is `#[serde(default)]`,
/// so a body sent through this struct arrives with no `kind` at all and has to decode as
/// `Personal`. Every case that predates technical reports still goes through here, which
/// makes the backward-compatibility claim a real test rather than one that sends
/// `kind: personal` explicitly and proves nothing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageInput {
    to_user: ActionHash,
    conversation_id: String,
    content: String,
}

/// Mirror of the coordinator's `MessageKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum MessageKind {
    #[default]
    Personal,
    AdminReport,
}

/// `SendMessageInput` with the kind set, for sending a technical report.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendReportInput {
    to_user: ActionHash,
    conversation_id: String,
    content: String,
    kind: MessageKind,
}

/// Mirror of the coordinator's `AdminReport`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminReport {
    message: Message,
    resolved: bool,
    resolved_at: Option<Timestamp>,
}

/// Mirror of the coordinator's `SentMessage`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SentMessage {
    agent: AgentPubKey,
    hash: ActionHash,
}

/// Mirror of the coordinator's `InboxEntry`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum InboxEntry {
    Read(Message),
    Unreadable {
        hash: ActionHash,
        from: AgentPubKey,
        at: Timestamp,
    },
}

/// The readable messages, failing loudly if any entry could not be decrypted.
///
/// Every `Inbox` link is encrypted to the agent reading it, so an `Unreadable` entry is a
/// fault. Routing every test's inbox read through this means none of them can pass while
/// quietly holding one.
fn readable(entries: Vec<InboxEntry>) -> Vec<Message> {
    let mut out = Vec::new();
    for entry in entries {
        match entry {
            InboxEntry::Read(message) => out.push(message),
            InboxEntry::Unreadable { hash, from, .. } => panic!(
                "inbox holds an undecryptable message {hash:?} from {from:?}; every inbox \
                 link is encrypted to this agent, so this is a fault"
            ),
        }
    }
    out
}

/// Mirror of the coordinator's `BlockEvent`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BlockEvent {
    agent: AgentPubKey,
    blocked: bool,
    at: Timestamp,
}

/// Mirror of the coordinator's `Blocks`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Blocks {
    blocked: Vec<AgentPubKey>,
    history: Vec<BlockEvent>,
}

/// Mirror of the coordinator's `MessageRead` outcomes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum MessageRead {
    NotFound,
    Withheld,
    Unreadable,
    Read(Message),
}

/// Mirror of the coordinator's read model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Message {
    hash: ActionHash,
    from: AgentPubKey,
    to: AgentPubKey,
    at: Timestamp,
    conversation_id: String,
    content: String,
    kind: MessageKind,
}

/// Alice as progenitor and admin, both users accepted, and each `User`'s hash.
///
/// Accepting both matters: `send_message` refuses anyone who is not an accepted member,
/// so without this the first case would fail on the membership check rather than telling
/// us anything about encryption.
async fn two_accepted_members() -> (SweetConductorBatch, SweetCell, SweetCell, ActionHash, ActionHash)
{
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(
            &alice.zome("users_organizations"),
            "create_user",
            sample_user("Alice"),
        )
        .await;
    conductors[1]
        .call::<_, Record>(
            &bob.zome("users_organizations"),
            "create_user",
            sample_user("Bob"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let alice_user = user_hash_of(&conductors[0], &alice).await;
    let bob_user = user_hash_of(&conductors[1], &bob).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user.clone()).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user.clone()).await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    (conductors, alice, bob, alice_user, bob_user)
}

async fn user_hash_of(conductor: &SweetConductor, cell: &SweetCell) -> ActionHash {
    let links: Vec<Link> = conductor
        .call(
            &cell.zome("users_organizations"),
            "get_agent_user",
            cell.agent_pubkey().clone(),
        )
        .await;
    links[0].target.clone().into_action_hash().unwrap()
}

/// P1: the recipient reads what was sent.
#[tokio::test(flavor = "multi_thread")]
async fn recipient_reads_the_message() {
    let (conductors, alice, bob, _alice_user, bob_user) = two_accepted_members().await;

    let sent: Vec<SentMessage> = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: bob_user,
                conversation_id: "alice-bob".to_string(),
                content: "the kettle is on".to_string(),
            },
        )
        .await;

    assert_eq!(
        sent.len(),
        1,
        "Bob has one agent, so there should be one copy"
    );
    assert_eq!(
        &sent[0].agent,
        bob.agent_pubkey(),
        "the copy should be addressed to Bob's agent"
    );

    await_consistency_s(30, [&alice, &bob]).await.unwrap();

    let inbox = readable(conductors[1].call(&bob.zome("messaging"), "get_inbox", ()).await);

    assert_eq!(inbox.len(), 1, "Bob should have exactly one message");
    assert_eq!(
        inbox[0].content, "the kettle is on",
        "content should round-trip through encryption"
    );
    assert_eq!(
        inbox[0].conversation_id, "alice-bob",
        "the conversation ID travels inside the ciphertext and should round-trip too"
    );
    assert_eq!(
        &inbox[0].from,
        alice.agent_pubkey(),
        "from should come from the action's author, not the payload"
    );
}

/// P2: the sender reads their own sent copy.
///
/// This is the shared-key assumption, and the reason it is a test rather than a comment:
/// `get_sent` decrypts the recipient's copy by passing the sender as recipient and the
/// recipient as sender, which only works if both directions derive the same secret.
#[tokio::test(flavor = "multi_thread")]
async fn sender_reads_their_own_sent_message() {
    let (conductors, alice, bob, _alice_user, bob_user) = two_accepted_members().await;

    let _: Vec<SentMessage> = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: bob_user,
                conversation_id: "alice-bob".to_string(),
                content: "I said the kettle is on".to_string(),
            },
        )
        .await;

    await_consistency_s(30, [&alice, &bob]).await.unwrap();

    let sent: Vec<Message> = conductors[0].call(&alice.zome("messaging"), "get_sent", ()).await;

    assert_eq!(sent.len(), 1, "Alice should see the one message she sent");
    assert_eq!(
        sent[0].content, "I said the kettle is on",
        "the sender should be able to decrypt their own copy"
    );
    assert_eq!(
        &sent[0].to,
        bob.agent_pubkey(),
        "the copy's recipient comes from the Inbox link's base"
    );
    assert_eq!(
        &sent[0].from,
        alice.agent_pubkey(),
        "Alice is the author of her own sent message"
    );
}

/// P3: a third member holds the entry and cannot read it.
///
/// Carol is an accepted member on the same DNA, so she gossips the same public entry.
/// The assertion is in two halves: she can fetch the record, proving the entry really is
/// public and she really does hold it, and her inbox is empty, proving the content is
/// not readable by her.
#[tokio::test(flavor = "multi_thread")]
async fn a_third_member_cannot_read_the_message() {
    let (conductors, alice, bob, carol) = setup_three_agents_with_alice_as_progenitor().await;

    for (i, (cell, name)) in [(&alice, "Alice"), (&bob, "Bob"), (&carol, "Carol")]
        .into_iter()
        .enumerate()
    {
        conductors[i]
            .call::<_, Record>(
                &cell.zome("users_organizations"),
                "create_user",
                sample_user(name),
            )
            .await;
    }
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    // Alice is the progenitor here, so she is the admin who can accept members. With
    // the plain three-agent setup nobody holds the progenitor key and acceptance fails
    // with Unauthorized, which is what the first attempt at this test did.
    let alice_user = user_hash_of(&conductors[0], &alice).await;
    let bob_user = user_hash_of(&conductors[1], &bob).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user.clone()).await;
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    let sent: Vec<SentMessage> = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: bob_user,
                conversation_id: "alice-bob".to_string(),
                content: "not for Carol".to_string(),
            },
        )
        .await;
    let hash = sent[0].hash.clone();

    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    // The claim is not that Carol sees nothing, which would be true anyway since no
    // Inbox link points at her. It is that she *holds* the entry and cannot read it.
    // Only `Unreadable` says both at once: `NotFound` would mean the DHT had not reached
    // her, and the assertion would prove nothing about the encryption.
    let carol_read: MessageRead = conductors[2]
        .call(&carol.zome("messaging"), "get_message", hash.clone())
        .await;
    assert!(
        matches!(carol_read, MessageRead::Unreadable),
        "Carol should hold the ciphertext and fail to decrypt it, got {carol_read:?}"
    );

    // And Bob, the actual recipient, reads the same hash.
    let bob_read: MessageRead = conductors[1]
        .call(&bob.zome("messaging"), "get_message", hash.clone())
        .await;
    match bob_read {
        MessageRead::Read(message) => assert_eq!(
            message.content, "not for Carol",
            "the recipient reads the same entry Carol cannot"
        ),
        other => panic!("Bob should be able to read his own message, got {other:?}"),
    }
}

/// P4: the recipient can be offline when the message is sent.
///
/// The stored entry is the delivery guarantee, so a message written while Bob is down
/// should be waiting for him when he comes back. Nothing here depends on the nudge,
/// which Bob cannot have received.
#[tokio::test(flavor = "multi_thread")]
async fn a_message_waits_for_an_offline_recipient() {
    let (mut conductors, alice, bob, _alice_user, bob_user) = two_accepted_members().await;

    conductors[1].shutdown().await;

    let _: Vec<SentMessage> = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: bob_user,
                conversation_id: "alice-bob".to_string(),
                content: "sent while you were out".to_string(),
            },
        )
        .await;

    conductors[1].startup(false).await;
    await_consistency_s(60, [&alice, &bob]).await.unwrap();

    let inbox = readable(conductors[1].call(&bob.zome("messaging"), "get_inbox", ()).await);

    assert_eq!(
        inbox.len(),
        1,
        "the stored entry is the delivery guarantee, so it should be waiting"
    );
    assert_eq!(inbox[0].content, "sent while you were out");
}

/// P5: the sender can be offline when the recipient reads.
///
/// This is the dependency worth proving rather than assuming: the guarantee is the
/// stored entry, but a DHT still needs *somebody* holding it to be online. Carol is that
/// somebody here. Alice sends while Bob is down, Carol takes the entry and the link,
/// Alice goes down, Bob comes up, and the message still arrives.
///
/// If this failed, delivery would depend on the sender staying online, which would make
/// the whole design weaker than advertised.
#[tokio::test(flavor = "multi_thread")]
async fn a_message_arrives_with_the_sender_offline() {
    let (mut conductors, alice, bob, carol) =
        setup_three_agents_with_alice_as_progenitor().await;

    for (i, (cell, name)) in [(&alice, "Alice"), (&bob, "Bob"), (&carol, "Carol")]
        .into_iter()
        .enumerate()
    {
        conductors[i]
            .call::<_, Record>(
                &cell.zome("users_organizations"),
                "create_user",
                sample_user(name),
            )
            .await;
    }
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    let alice_user = user_hash_of(&conductors[0], &alice).await;
    let bob_user = user_hash_of(&conductors[1], &bob).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user.clone()).await;
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    // Bob goes down before the message exists.
    conductors[1].shutdown().await;

    let sent: Vec<SentMessage> = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: bob_user,
                conversation_id: "alice-bob".to_string(),
                content: "Carol is holding this for you".to_string(),
            },
        )
        .await;
    let hash = sent[0].hash.clone();

    // Carol must hold the entry *locally* before Alice leaves, or there is nobody to
    // serve it and this test proves nothing about the sender being offline.
    //
    // `get_message` is not the way to establish that: it does a network `get`, so Carol
    // could report `Unreadable` having just fetched the entry from Alice, who is about to
    // disappear. Consistency is the right instrument, and it covers **both** published
    // items, the entry and the `Inbox` link, on both cells. Bob's `get_inbox` needs the
    // link as much as the entry.
    await_consistency_s(90, [&alice, &carol]).await.expect(
        "Alice and Carol never reached consistency, so Carol is not holding the message \
         and the sender-offline case cannot be tested",
    );

    // Now that holding is a local fact, this is a privacy assertion rather than a
    // liveness one: Carol has the ciphertext and cannot read it.
    let carol_read: MessageRead = conductors[2]
        .call(&carol.zome("messaging"), "get_message", hash.clone())
        .await;
    assert!(
        matches!(carol_read, MessageRead::Unreadable),
        "Carol should hold the ciphertext and fail to decrypt it, got {carol_read:?}"
    );

    // Now the sender leaves and the recipient returns.
    conductors[0].shutdown().await;
    conductors[1].startup(false).await;

    // Read once before waiting, purely to record whether this run hit the race. **Not
    // asserted on**: the count here depends on timing by design, and is 0 when Bob has not
    // reconnected yet and 1 when he has. The raw `Vec<InboxEntry>` is used rather than
    // `readable()` so an `Unreadable` entry is counted rather than panicked on.
    //
    // "before: 0, after: 1" on a runner shows the race and its fix in one run. "before: 1"
    // says that run did not hit the race, so its green proves less, and we know that rather
    // than assuming it.
    let before: Vec<InboxEntry> = conductors[1]
        .call(&bob.zome("messaging"), "get_inbox", ())
        .await;
    eprintln!(
        "[inbox] before the wait, Bob's inbox held {} entries",
        before.len()
    );

    // Bob is up but not yet talking to anyone. `get_inbox` reads from the network, so
    // without this it can return nothing simply because there is no peer to ask, which is
    // what failed on a hosted runner where reconnecting is slower than here. P4 restarts
    // Bob the same way and waits, which is why it passed.
    //
    // Alice is offline by this point, so consistency can only be reached through Carol.
    // That makes the wait part of the claim rather than a delay bolted on: it proves Bob is
    // being served by a holder that is not the sender.
    await_consistency_s(60, [&bob, &carol]).await.expect(
        "Bob never reached Carol after restarting, so nobody was serving the message and \
         this test cannot say anything about the sender being offline",
    );

    let after: Vec<InboxEntry> = conductors[1]
        .call(&bob.zome("messaging"), "get_inbox", ())
        .await;
    eprintln!(
        "[inbox] after the wait, Bob's inbox held {} entries",
        after.len()
    );
    let inbox = readable(after);

    assert_eq!(
        inbox.len(),
        1,
        "Carol was holding the entry and the link, so Bob should still receive it"
    );
    assert_eq!(inbox[0].content, "Carol is holding this for you");
    assert_eq!(
        &inbox[0].from,
        alice.agent_pubkey(),
        "from still names Alice, who is offline"
    );
}

/// Set an entity's status to rejected, as an admin.
///
/// Mirrors `accept_entity`, which only ever sets "accepted". Local to this file because
/// nothing else needs it yet; if a second suite wants it, move it to `common`.
async fn reject_entity(
    admin_conductor: &SweetConductor,
    admin_cell: &SweetCell,
    entity: &str,
    entity_hash: ActionHash,
    reason: &str,
) {
    let status_record: Option<Record> = admin_conductor
        .call(
            &admin_cell.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": entity,
                "entity_original_action_hash": entity_hash
            }),
        )
        .await;
    let status_hash = status_record
        .unwrap_or_else(|| panic!("no status record for {entity}, so it cannot be rejected"))
        .signed_action
        .hashed
        .hash
        .clone();

    let _: Record = admin_conductor
        .call(
            &admin_cell.zome("administration"),
            "update_entity_status",
            serde_json::json!({
                "entity": entity,
                "entity_original_action_hash": entity_hash,
                "status_original_action_hash": status_hash,
                "status_previous_action_hash": status_hash,
                "new_status": {
                    "status_type": "rejected",
                    "reason": reason,
                    "suspended_until": null
                }
            }),
        )
        .await;
}

/// P6a: a sender who is not an accepted member is refused.
#[tokio::test(flavor = "multi_thread")]
async fn an_unaccepted_sender_is_refused() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Both have profiles; only Alice is accepted. Bob's is left pending.
    conductors[0]
        .call::<_, Record>(
            &alice.zome("users_organizations"),
            "create_user",
            sample_user("Alice"),
        )
        .await;
    conductors[1]
        .call::<_, Record>(
            &bob.zome("users_organizations"),
            "create_user",
            sample_user("Bob"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let alice_user = user_hash_of(&conductors[0], &alice).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user.clone()).await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob, still pending, tries to write to Alice.
    let refused = conductors[1]
        .call_fallible::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: alice_user,
                conversation_id: "bob-alice".to_string(),
                content: "let me in".to_string(),
            },
        )
        .await;

    let err = match refused {
        Err(e) => format!("{e:?}"),
        Ok(sent) => panic!("a pending member's send should be refused, but it returned {sent:?}"),
    };
    assert!(
        err.contains("not accepted"),
        "the refusal should say the profile is not accepted, so the UI can explain it; got {err}"
    );
}

/// P6b: a message from an author who is no longer accepted disappears from the inbox.
///
/// The sender-side check passed when this message was written. What this proves is the
/// second check, on the reading side: the recipient's own node decides what they see, and
/// it decides again every time they look.
#[tokio::test(flavor = "multi_thread")]
async fn a_message_from_a_since_rejected_author_is_hidden() {
    let (conductors, alice, bob, alice_user, bob_user) = two_accepted_members().await;

    let _: Vec<SentMessage> = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: bob_user,
                conversation_id: "alice-bob".to_string(),
                content: "written while I was in good standing".to_string(),
            },
        )
        .await;
    await_consistency_s(30, [&alice, &bob]).await.unwrap();

    let before = readable(conductors[1].call(&bob.zome("messaging"), "get_inbox", ()).await);
    assert_eq!(
        before.len(),
        1,
        "Bob should see the message while its author is accepted"
    );

    // Alice, as admin, rejects her own profile. Contrived, but it is the same state
    // change as an admin rejecting anyone, and it needs no fourth agent.
    reject_entity(
        &conductors[0],
        &alice,
        ENTITY_USERS,
        alice_user,
        "testing the read-side recheck",
    )
    .await;
    await_consistency_s(30, [&alice, &bob]).await.unwrap();

    let after = readable(conductors[1].call(&bob.zome("messaging"), "get_inbox", ()).await);
    assert!(
        after.is_empty(),
        "once the author is no longer accepted the message should be hidden, got {after:?}"
    );
}

/// Copied from `tests/messaging.rs` (#213), which owns the nudge substrate and its
/// timings. Duplicated rather than shared because that file is under review: these move
/// to `common` once #213 merges.
///
/// Mirror of the messaging zome's `Signal`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
enum MessagingSignal {
    Nudge {
        hash: ActionHash,
        from: AgentPubKey,
    },
}

/// Also from #213. Generous because an unprimed recipient runs `init` for every
/// coordinator zome when the nudge arrives: measured at 68.4s for the first nudge on a
/// hosted runner.
const SIGNAL_DEADLINE: Duration = Duration::from_secs(240);

/// Wait for a nudge carrying `wanted`, reporting how long it took and every hash seen.
///
/// Returns `(Some(latency), seen)` if `wanted` arrived inside `window`, `(None, seen)`
/// otherwise. `seen` matters for the negative case: it is how the test can say that a
/// *different* nudge turned up, rather than only that the wanted one did not.
///
/// `sent` must be the instant the send was **issued**, not the instant this call started.
/// #213's `await_messaging_signal` takes the same parameter for the same reason: the
/// subscription buffers, so a nudge often arrives before anyone waits for it, and a clock
/// started here measures the time to pull it off a channel. Measured that way the first
/// nudge looked like 30µs; timed from the send it is about 1.5s on a developer machine.
/// Any window derived from the former is meaningless.
async fn watch_for_nudge(
    signals: &mut tokio::sync::broadcast::Receiver<Signal>,
    wanted: &ActionHash,
    window: Duration,
    who: &str,
    sent: Instant,
) -> (Option<Duration>, Vec<ActionHash>) {
    let mut seen: Vec<ActionHash> = Vec::new();

    let found = tokio::time::timeout(window, async {
        loop {
            match signals
                .recv()
                .await
                .unwrap_or_else(|e| panic!("{who} signal channel error: {e:?}"))
            {
                Signal::App { signal, .. } => {
                    if let Ok(MessagingSignal::Nudge { hash, .. }) =
                        signal.into_inner().decode::<MessagingSignal>()
                    {
                        seen.push(hash.clone());
                        if &hash == wanted {
                            break sent.elapsed();
                        }
                    }
                }
                Signal::System(_) => {}
            }
        }
    })
    .await;

    match found {
        Ok(latency) => {
            eprintln!("[inbox] {who} received the nudge for the wanted message in {latency:?}");
            (Some(latency), seen)
        }
        Err(_) => {
            eprintln!(
                "[inbox] {who} saw no nudge for the wanted message within {window:?}; \
                 hashes seen: {seen:?}"
            );
            (None, seen)
        }
    }
}

/// Send one message, for tests that send more than once.
async fn send_one(
    conductor: &SweetConductor,
    sender: &SweetCell,
    to_user: ActionHash,
    content: &str,
) -> ActionHash {
    let sent: Vec<SentMessage> = conductor
        .call(
            &sender.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user,
                conversation_id: "alice-bob".to_string(),
                content: content.to_string(),
            },
        )
        .await;
    sent
        .first()
        .unwrap_or_else(|| panic!("send_message returned no copies for {content:?}"))
        .hash
        .clone()
}

/// P7: blocking hides stored messages and drops nudges; unblocking restores both.
///
/// The negative step is the hard one. An earlier version waited a flat ten seconds and
/// used consistency as its clock. Two things were wrong with that, and one of them is
/// worth stating carefully.
///
/// The clear fault: nothing was sent after the unblock, so "unblocking restores nudges"
/// rested on a stored-message count alone. Step 5 exists for that.
///
/// The weaker one: the ten seconds was not derived from anything measured on the machine
/// running the test, and consistency does not time a nudge, since it is a gossip clock
/// and a nudge is a remote call. Nothing guaranteed a leak would be caught on a slower
/// machine. It might well have been caught here, because the test subscribed before
/// sending and waited for consistency first, so a leaked nudge would probably have been
/// buffered and seen.
///
/// So the window is now derived from a measurement taken in this same test: step 1
/// records how long a nudge actually takes here, and step 3 waits twice that, with a
/// ten-second floor. Step 5 then proves the block was the cause rather than the nudges
/// having stopped, and that the suppressed nudge is not merely late.
#[tokio::test(flavor = "multi_thread")]
async fn blocking_hides_messages_and_nudges_and_unblocking_restores_them() {
    let (conductors, alice, bob, _alice_user, bob_user) = two_accepted_members().await;

    // One subscription for the whole test, so a nudge suppressed in step 3 cannot slip
    // past unnoticed and then be attributed to step 5.
    let mut bob_signals =
        conductors[1].subscribe_to_app_signals("requests_and_offers".to_string());

    // 1. Unblocked: the nudge must arrive, and its latency sets the window below.
    let m1_sent = Instant::now();
    let m1 = send_one(&conductors[0], &alice, bob_user.clone(), "before the block").await;
    let (latency, _) =
        watch_for_nudge(&mut bob_signals, &m1, SIGNAL_DEADLINE, "Bob", m1_sent).await;
    let latency = latency.unwrap_or_else(|| {
        panic!(
            "no nudge arrived for the first message within {SIGNAL_DEADLINE:?}; without this \
             control the negative step below proves nothing"
        )
    });

    await_consistency_s(30, [&alice, &bob]).await.unwrap();
    let before = readable(conductors[1].call(&bob.zome("messaging"), "get_inbox", ()).await);
    assert_eq!(
        before.len(),
        1,
        "Bob should see the first message, got {before:?}"
    );

    // 2. Block.
    let _: () = conductors[1]
        .call(
            &bob.zome("messaging"),
            "block_agent",
            alice.agent_pubkey().clone(),
        )
        .await;

    let blocked = readable(conductors[1].call(&bob.zome("messaging"), "get_inbox", ()).await);
    assert!(
        blocked.is_empty(),
        "a blocked author's stored messages should be hidden, got {blocked:?}"
    );

    // 3. Blocked: no nudge for m2, watched for twice the measured latency.
    let window = std::cmp::max(latency * 2, Duration::from_secs(10));
    eprintln!(
        "[inbox] first nudge took {latency:?}, so the blocked window is {window:?}"
    );
    let m2_sent = Instant::now();
    let m2 = send_one(&conductors[0], &alice, bob_user.clone(), "while blocked").await;
    let (leaked, seen_while_blocked) =
        watch_for_nudge(&mut bob_signals, &m2, window, "Bob", m2_sent).await;
    assert!(
        leaked.is_none(),
        "a blocked sender's nudge reached the UI after {leaked:?}, within a {window:?} \
         window derived from the {latency:?} the first nudge took"
    );
    assert!(
        !seen_while_blocked.contains(&m2),
        "the blocked message's nudge was seen: {seen_while_blocked:?}"
    );

    // 4. Unblock: both stored messages come back.
    let _: () = conductors[1]
        .call(
            &bob.zome("messaging"),
            "unblock_agent",
            alice.agent_pubkey().clone(),
        )
        .await;

    await_consistency_s(30, [&alice, &bob]).await.unwrap();
    let restored = readable(conductors[1].call(&bob.zome("messaging"), "get_inbox", ()).await);
    assert_eq!(
        restored.len(),
        2,
        "unblocking should restore both messages, got {restored:?}"
    );

    // 5. Unblocked again: a fresh nudge arrives, and m2's never does.
    let m3_sent = Instant::now();
    let m3 = send_one(&conductors[0], &alice, bob_user.clone(), "after the unblock").await;
    let (after_unblock, seen_after) =
        watch_for_nudge(&mut bob_signals, &m3, SIGNAL_DEADLINE, "Bob", m3_sent).await;
    assert!(
        after_unblock.is_some(),
        "a nudge should arrive again once unblocked, so the block was the cause rather \
         than nudges having stopped; hashes seen: {seen_after:?}"
    );
    assert!(
        !seen_after.contains(&m2),
        "the nudge suppressed while blocked must not arrive late; hashes seen: {seen_after:?}"
    );

    // The history keeps both events, so a member can see what they did and undo it.
    let blocks: Blocks = conductors[1].call(&bob.zome("messaging"), "get_blocks", ()).await;
    assert!(
        blocks.blocked.is_empty(),
        "nobody should be blocked after the unblock, got {:?}",
        blocks.blocked
    );
    assert_eq!(
        blocks.history.len(),
        2,
        "the block and the unblock should both be kept, got {:?}",
        blocks.history
    );
    assert!(
        blocks.history[0].blocked && !blocks.history[1].blocked,
        "history should read block then unblock, in chain order; got {:?}",
        blocks.history
    );
}

// ── Technical reports to administrators ───────────────────────────────────────
//
// A technical report is an ordinary encrypted message marked as a report inside the
// encryption. Only the sender and the administrator can tell it apart from any other
// message, which is why the kind is a field of the plaintext rather than anything on
// the entry or the link.
//
// Alice is the progenitor in these setups and `create_user` auto-registers the
// progenitor as a network administrator (`users_organizations/src/user.rs:55-83`), which
// is the same reason she can accept members. Bob is an ordinary accepted member, so the
// pair gives one admin and one non-admin with no extra setup.

/// Register an existing accepted member as a second network administrator.
///
/// Called by an administrator, which `add_administrator` requires
/// (`administration/src/administration.rs:60-80`).
async fn add_network_admin(
    admin_conductor: &SweetConductor,
    admin_cell: &SweetCell,
    new_admin_user: ActionHash,
    new_admin_agent: AgentPubKey,
) {
    let registered: bool = admin_conductor
        .call(
            &admin_cell.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: new_admin_user,
                agent_pubkeys: vec![new_admin_agent],
            },
        )
        .await;
    assert!(
        registered,
        "the second administrator should have been newly registered, not already present"
    );
}

/// P8: a report reaches the admin area and stays out of the personal inbox.
///
/// Three claims in one case, because they are one fact seen from three sides: the report
/// is in `get_admin_reports`, it is not in the administrator's `get_inbox`, and
/// `get_message` on its hash reports it as a report. Splitting them would triple the
/// conductor startup cost to say the same thing.
#[tokio::test(flavor = "multi_thread")]
async fn a_report_reaches_the_admin_area_and_not_the_personal_inbox() {
    let (conductors, alice, bob, alice_user, _bob_user) = two_accepted_members().await;

    let sent: Vec<SentMessage> = conductors[1]
        .call(
            &bob.zome("messaging"),
            "send_message",
            SendReportInput {
                to_user: alice_user,
                conversation_id: "report:something".to_string(),
                content: "a message would not open".to_string(),
                kind: MessageKind::AdminReport,
            },
        )
        .await;
    assert_eq!(sent.len(), 1, "Alice has one agent, so there is one copy");
    let hash = sent[0].hash.clone();

    await_consistency_s(30, [&alice, &bob]).await.unwrap();

    let reports: Vec<AdminReport> = conductors[0]
        .call(&alice.zome("messaging"), "get_admin_reports", ())
        .await;
    assert_eq!(reports.len(), 1, "Alice should hold exactly one report");
    assert_eq!(
        reports[0].message.content, "a message would not open",
        "the report's content should round-trip through encryption"
    );
    assert_eq!(
        &reports[0].message.from,
        bob.agent_pubkey(),
        "the reporter comes from the action's author"
    );
    assert!(
        !reports[0].resolved && reports[0].resolved_at.is_none(),
        "a new report starts unresolved with no time, got {:?}",
        reports[0]
    );

    // The half that makes it a separate route rather than a label: an administrator's
    // personal inbox does not carry it, so it cannot be counted or read as personal mail.
    let inbox = readable(conductors[0].call(&alice.zome("messaging"), "get_inbox", ()).await);
    assert!(
        inbox.is_empty(),
        "an administrator's personal inbox should not hold a technical report, got {inbox:?}"
    );

    // And the nudge path can tell what arrived, which is what raises the admin count
    // rather than the personal one.
    let read: MessageRead = conductors[0]
        .call(&alice.zome("messaging"), "get_message", hash)
        .await;
    match read {
        MessageRead::Read(message) => assert_eq!(
            message.kind,
            MessageKind::AdminReport,
            "get_message should report the kind, so a nudge can be routed to the admin count"
        ),
        other => panic!("Alice should be able to read the report she was sent, got {other:?}"),
    }
}

/// P9: a report addressed to a member who is not an administrator is refused at send.
///
/// Alice, who is the administrator here, is the sender, so the case turns on the
/// recipient's role alone rather than on who is allowed to report.
#[tokio::test(flavor = "multi_thread")]
async fn a_report_to_a_non_administrator_is_refused() {
    let (conductors, alice, _bob, _alice_user, bob_user) = two_accepted_members().await;

    let refused = conductors[0]
        .call_fallible::<_, Vec<SentMessage>>(
            &alice.zome("messaging"),
            "send_message",
            SendReportInput {
                to_user: bob_user,
                conversation_id: "report:nowhere".to_string(),
                content: "this should not be deliverable".to_string(),
                kind: MessageKind::AdminReport,
            },
        )
        .await;

    let err = match refused {
        Err(e) => format!("{e:?}"),
        Ok(sent) => panic!(
            "a report to a member who is not an administrator should be refused, got {sent:?}"
        ),
    };
    assert!(
        err.contains("network administrator"),
        "the refusal should say the recipient is not a network administrator, so the UI can \
         explain it; got {err}"
    );
}

/// P10: the three administrator-only calls all refuse a member who is not one.
#[tokio::test(flavor = "multi_thread")]
async fn the_admin_report_calls_refuse_a_non_administrator() {
    let (conductors, alice, bob, alice_user, _bob_user) = two_accepted_members().await;

    // A real report, so the hash Bob passes names something that exists. The refusal
    // must come from his role, not from the hash being nonsense.
    let sent: Vec<SentMessage> = conductors[1]
        .call(
            &bob.zome("messaging"),
            "send_message",
            SendReportInput {
                to_user: alice_user,
                conversation_id: "report:something".to_string(),
                content: "a message would not open".to_string(),
                kind: MessageKind::AdminReport,
            },
        )
        .await;
    let hash = sent[0].hash.clone();
    await_consistency_s(30, [&alice, &bob]).await.unwrap();

    let listed = conductors[1]
        .call_fallible::<_, Vec<AdminReport>>(&bob.zome("messaging"), "get_admin_reports", ())
        .await;
    let err = match listed {
        Err(e) => format!("{e:?}"),
        Ok(reports) => panic!("a non-administrator should not read the reports, got {reports:?}"),
    };
    assert!(
        err.contains("network administrator"),
        "get_admin_reports should refuse with a reason naming the role; got {err}"
    );

    let resolved = conductors[1]
        .call_fallible::<_, ()>(&bob.zome("messaging"), "mark_report_resolved", hash.clone())
        .await;
    let err = match resolved {
        Err(e) => format!("{e:?}"),
        Ok(()) => panic!("a non-administrator should not be able to resolve a report"),
    };
    assert!(
        err.contains("network administrator"),
        "mark_report_resolved should refuse with a reason naming the role; got {err}"
    );

    let reopened = conductors[1]
        .call_fallible::<_, ()>(&bob.zome("messaging"), "reopen_report", hash)
        .await;
    let err = match reopened {
        Err(e) => format!("{e:?}"),
        Ok(()) => panic!("a non-administrator should not be able to reopen a report"),
    };
    assert!(
        err.contains("network administrator"),
        "reopen_report should refuse with a reason naming the role; got {err}"
    );
}

/// P11: resolving sets the flag and a time; reopening clears both.
#[tokio::test(flavor = "multi_thread")]
async fn resolving_and_reopening_a_report() {
    let (conductors, alice, bob, alice_user, _bob_user) = two_accepted_members().await;

    let sent: Vec<SentMessage> = conductors[1]
        .call(
            &bob.zome("messaging"),
            "send_message",
            SendReportInput {
                to_user: alice_user,
                conversation_id: "report:something".to_string(),
                content: "a message would not open".to_string(),
                kind: MessageKind::AdminReport,
            },
        )
        .await;
    let hash = sent[0].hash.clone();
    await_consistency_s(30, [&alice, &bob]).await.unwrap();

    let _: () = conductors[0]
        .call(
            &alice.zome("messaging"),
            "mark_report_resolved",
            hash.clone(),
        )
        .await;

    let reports: Vec<AdminReport> = conductors[0]
        .call(&alice.zome("messaging"), "get_admin_reports", ())
        .await;
    assert_eq!(reports.len(), 1, "the report is still listed once resolved");
    assert!(
        reports[0].resolved,
        "the report should read as resolved, got {:?}",
        reports[0]
    );
    let resolved_at = reports[0]
        .resolved_at
        .expect("a resolved report should carry the time it was resolved");

    // Reopening writes a second entry rather than deleting the first, and the later one
    // wins by chain order.
    let _: () = conductors[0]
        .call(&alice.zome("messaging"), "reopen_report", hash)
        .await;

    let reports: Vec<AdminReport> = conductors[0]
        .call(&alice.zome("messaging"), "get_admin_reports", ())
        .await;
    assert_eq!(reports.len(), 1, "reopening does not remove the report");
    assert!(
        !reports[0].resolved,
        "the reopened report should read as unresolved, got {:?}",
        reports[0]
    );
    assert!(
        reports[0].resolved_at.is_none(),
        "a reopened report is open now, so it carries no resolved time; it kept {resolved_at:?}"
    );
}

/// P12: one administrator resolving leaves another administrator's view untouched.
///
/// This is the privacy claim for the resolution: each admin marks their own copy and
/// nothing is shared. The reporter sends one report to each administrator, which is what
/// "a report is an ordinary message to each network administrator" means in practice.
///
/// Three conductors, so this is the case most exposed to the environment failures the
/// test-run rules describe. A setup failure here is environment, not a result.
#[tokio::test(flavor = "multi_thread")]
async fn one_admin_resolving_does_not_change_another_admins_view() {
    let (conductors, alice, bob, carol) = setup_three_agents_with_alice_as_progenitor().await;

    for (i, (cell, name)) in [(&alice, "Alice"), (&bob, "Bob"), (&carol, "Carol")]
        .into_iter()
        .enumerate()
    {
        conductors[i]
            .call::<_, Record>(
                &cell.zome("users_organizations"),
                "create_user",
                sample_user(name),
            )
            .await;
    }
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    let alice_user = user_hash_of(&conductors[0], &alice).await;
    let bob_user = user_hash_of(&conductors[1], &bob).await;
    let carol_user = user_hash_of(&conductors[2], &carol).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user.clone()).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, carol_user.clone()).await;

    // Carol becomes the second administrator, registered by Alice.
    add_network_admin(
        &conductors[0],
        &alice,
        carol_user.clone(),
        carol.agent_pubkey().clone(),
    )
    .await;
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    // Bob reports to both administrators: one ordinary encrypted message each.
    let to_alice: Vec<SentMessage> = conductors[1]
        .call(
            &bob.zome("messaging"),
            "send_message",
            SendReportInput {
                to_user: alice_user,
                conversation_id: "report:something".to_string(),
                content: "a message would not open".to_string(),
                kind: MessageKind::AdminReport,
            },
        )
        .await;
    let _: Vec<SentMessage> = conductors[1]
        .call(
            &bob.zome("messaging"),
            "send_message",
            SendReportInput {
                to_user: carol_user,
                conversation_id: "report:something".to_string(),
                content: "a message would not open".to_string(),
                kind: MessageKind::AdminReport,
            },
        )
        .await;
    await_consistency_s(30, [&alice, &bob, &carol]).await.unwrap();

    // Alice resolves her own copy.
    let _: () = conductors[0]
        .call(
            &alice.zome("messaging"),
            "mark_report_resolved",
            to_alice[0].hash.clone(),
        )
        .await;

    let alice_reports: Vec<AdminReport> = conductors[0]
        .call(&alice.zome("messaging"), "get_admin_reports", ())
        .await;
    assert_eq!(alice_reports.len(), 1, "Alice holds her one report");
    assert!(
        alice_reports[0].resolved,
        "Alice's own copy should be resolved, got {:?}",
        alice_reports[0]
    );

    let carol_reports: Vec<AdminReport> = conductors[2]
        .call(&carol.zome("messaging"), "get_admin_reports", ())
        .await;
    assert_eq!(carol_reports.len(), 1, "Carol holds her own copy of the report");
    assert!(
        !carol_reports[0].resolved && carol_reports[0].resolved_at.is_none(),
        "Alice resolving hers must not touch Carol's, got {:?}",
        carol_reports[0]
    );
}
