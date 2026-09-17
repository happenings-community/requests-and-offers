//! Notifications zome test. Draft for #51, built from NOTIFICATION_ARCHITECTURE.md.
//!
//! Exercises the four things compilation cannot prove: the cross-zome eligibility
//! calls, the inbox link and revision read, the rate-cap chain query, and the
//! connection pair logic. The live signal is not asserted; on this branch the
//! messaging zome is absent and the coordinator warns and continues, by design.
//!
//! The zome's input types are mirrored here with matching serde shape, as the
//! messaging test does, because coordinator crates require a wasm target.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateNotificationInput {
    kind: String,
    recipient: AgentPubKey,
    subject: Option<AnyLinkableHash>,
    payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RetractNotificationInput {
    original_action_hash: ActionHash,
    previous_action_hash: ActionHash,
}

fn marker(to: &AgentPubKey, subject: Option<AnyLinkableHash>, text: &str) -> CreateNotificationInput {
    CreateNotificationInput {
        kind: "InterestMarker".to_string(),
        recipient: to.clone(),
        subject,
        payload: text.to_string(),
    }
}

async fn user_hash(conductor: &SweetConductor, cell: &SweetCell) -> ActionHash {
    let links: Vec<Link> = conductor
        .call(&cell.zome("users_organizations"), "get_agent_user", cell.agent_pubkey().clone())
        .await;
    links[0].target.clone().into_action_hash().unwrap()
}

#[tokio::test(flavor = "multi_thread")]
async fn interest_marker_lifecycle_and_cap() {
    let (conductors, alice, bob, carol) = setup_three_agents_with_alice_as_progenitor().await;

    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;
    await_consistency_s(15, [&alice, &bob, &carol]).await.unwrap();

    let alice_user = user_hash(&conductors[0], &alice).await;
    let bob_user = user_hash(&conductors[1], &bob).await;

    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user.clone(),
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol]).await.unwrap();

    accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user.clone()).await;
    accept_entity(&conductors[0], &alice, ENTITY_USERS, bob_user.clone()).await;
    await_consistency_s(15, [&alice, &bob, &carol]).await.unwrap();

    // 1. Alice marks interest in Bob's listing. Subject is Bob's user hash here,
    //    standing in for a listing; the zome does not care what it points at.
    let subject: AnyLinkableHash = bob_user.clone().into();
    let created: Record = conductors[0]
        .call(
            &alice.zome("notifications"),
            "create_notification",
            marker(bob.agent_pubkey(), Some(subject.clone()), "keen to help with this"),
        )
        .await;
    let marker_hash = created.signed_action.hashed.hash.clone();
    await_consistency_s(15, [&alice, &bob, &carol]).await.unwrap();

    // 2. Bob's inbox has exactly one.
    let inbox: Vec<Record> = conductors[1]
        .call(&bob.zome("notifications"), "get_my_notifications", ())
        .await;
    assert_eq!(inbox.len(), 1, "Bob should see one open notification");

    // 3. A duplicate on the same subject is refused.
    let dup: Result<Record, _> = conductors[0]
        .call_fallible(
            &alice.zome("notifications"),
            "create_notification",
            marker(bob.agent_pubkey(), Some(subject.clone()), "again"),
        )
        .await;
    assert!(dup.is_err(), "duplicate open marker on the same subject should be refused");

    // 4. Bob marks it seen.
    let _: ActionHash = conductors[1]
        .call(&bob.zome("notifications"), "mark_seen", marker_hash.clone())
        .await;
    let seen: Vec<ActionHash> = conductors[1]
        .call(&bob.zome("notifications"), "get_seen_notification_hashes", ())
        .await;
    assert_eq!(seen, vec![marker_hash.clone()], "seen list should hold the original hash");

    // 5. Alice retracts; Bob's inbox empties. This is the revision read.
    let _: Record = conductors[0]
        .call(
            &alice.zome("notifications"),
            "retract_notification",
            RetractNotificationInput {
                original_action_hash: marker_hash.clone(),
                previous_action_hash: marker_hash.clone(),
            },
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol]).await.unwrap();
    let inbox: Vec<Record> = conductors[1]
        .call(&bob.zome("notifications"), "get_my_notifications", ())
        .await;
    assert_eq!(inbox.len(), 0, "retracted notification should not appear");

    // 6. Cap, unconnected tier. One create so far; nine more create-and-retract
    //    pairs bring the 24h count to ten. The eleventh must be refused.
    for i in 0..9 {
        let r: Record = conductors[0]
            .call(
                &alice.zome("notifications"),
                "create_notification",
                marker(bob.agent_pubkey(), None, &format!("ping {i}")),
            )
            .await;
        let h = r.signed_action.hashed.hash.clone();
        let _: Record = conductors[0]
            .call(
                &alice.zome("notifications"),
                "retract_notification",
                RetractNotificationInput { original_action_hash: h.clone(), previous_action_hash: h },
            )
            .await;
    }
    let eleventh: Result<Record, _> = conductors[0]
        .call_fallible(
            &alice.zome("notifications"),
            "create_notification",
            marker(bob.agent_pubkey(), None, "one too many"),
        )
        .await;
    assert!(eleventh.is_err(), "eleventh unconnected marker in 24h should be refused");

    // 7. Bob reciprocates. Connection is directional: Alice now holds an open
    //    marker from Bob, so Alice is connected to Bob; Alice's markers to Bob
    //    are all retracted, so Bob is not connected to Alice.
    let _: Record = conductors[1]
        .call(
            &bob.zome("notifications"),
            "create_notification",
            marker(alice.agent_pubkey(), None, "likewise"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol]).await.unwrap();

    let alice_to_bob: bool = conductors[0]
        .call(&alice.zome("notifications"), "is_connected", bob.agent_pubkey().clone())
        .await;
    let bob_to_alice: bool = conductors[1]
        .call(&bob.zome("notifications"), "is_connected", alice.agent_pubkey().clone())
        .await;
    assert!(alice_to_bob, "Alice should see Bob's open marker and be connected");
    assert!(!bob_to_alice, "Bob should not be connected; Alice's markers are retracted");

    // 8. Connected tier: Alice's ten sends to Bob are under the connected
    //    allowance, so one more is now permitted where it was refused above.
    let twelfth: Result<Record, _> = conductors[0]
        .call_fallible(
            &alice.zome("notifications"),
            "create_notification",
            marker(bob.agent_pubkey(), None, "now we are connected"),
        )
        .await;
    assert!(twelfth.is_ok(), "connected tier should permit the marker the unconnected tier refused");

    // 9. Connected sends do not draw on the stranger budget. Alice has sent
    //    Bob eleven markers in the window, but Bob is connected, so her
    //    unconnected count is zero and a first marker to Carol is allowed.
    //    Carol needs no profile: only the actor must be accepted.
    let to_stranger: Result<Record, _> = conductors[0]
        .call_fallible(
            &alice.zome("notifications"),
            "create_notification",
            marker(carol.agent_pubkey(), None, "hello, stranger"),
        )
        .await;
    assert!(
        to_stranger.is_ok(),
        "sends to a connected peer should not count against the stranger budget"
    );
}
