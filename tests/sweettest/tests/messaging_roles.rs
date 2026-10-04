//! Role messages and cases: the admin role, end to end.
//!
//! A message to a role reaches every holder of it; holders claim, note, hand over and
//! close a case together; and the case's state is a fold over its events rather than
//! anything stored. That last point is what replaced #301's private `ReportResolution`,
//! so these cases are the evidence that nothing needs a second writer.
//!
//! Two things are deliberately proven by *absence*: a role message never appears in
//! anyone's `get_inbox`, and a role message whose author has lost the role disappears from
//! every reader. The second is the whole security claim of decision 11, so it is tested by
//! removing an administrator rather than by reasoning about it.
//!
//! Most cases here need three conductors, for two administrators and a member. Each
//! conductor's first zome call costs about twenty seconds, and the test-run rules record
//! that a three-conductor case on the server loses runs to app-install and database
//! timeouts. Claims are therefore combined per case rather than split one per assertion:
//! splitting them would multiply the startup cost without adding a fact. One case per
//! process.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;
use serde::{Deserialize, Serialize};

// -- mirrors of the coordinator's types --

/// Mirror of the coordinator's `RoleRef`.
///
/// Internally tagged, so `Admin` is `{"type": "admin"}` on the wire. The other two
/// variants are here to be refused, which is a fact worth testing: they are shaped now so
/// that briefs C and D add stewards and organisation coordinators without touching the
/// message body.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum RoleRef {
    Admin,
    Permission { name: String },
    OrgCoordinator { organization: ActionHash },
}

/// Mirror of the coordinator's `CaseKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum CaseKind {
    TechnicalReport,
}

/// Mirror of the coordinator's `CaseOutcome`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
enum CaseOutcome {
    Resolved,
    Dismissed,
}

/// Mirror of the coordinator's `CaseEvent`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum CaseEvent {
    Claim,
    Release,
    HandOverOffer { to: ActionHash },
    HandOverAccept,
    CaseNote,
    Complete { outcome: CaseOutcome },
    Reopen,
}

/// Mirror of the coordinator's `CaseRef`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaseRef {
    case_id: String,
    opener: ActionHash,
    kind: CaseKind,
    #[serde(default)]
    event: Option<CaseEvent>,
}

/// Mirror of the coordinator's `SendRoleMessageInput`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendRoleMessageInput {
    role: RoleRef,
    content: String,
    case_id: String,
    kind: CaseKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    opener: Option<ActionHash>,
    #[serde(skip_serializing_if = "Option::is_none")]
    event: Option<CaseEvent>,
}

/// Mirror of the coordinator's `SendMessageInput`, for the one personal message here.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageInput {
    to_user: ActionHash,
    content: String,
}

/// Mirror of the coordinator's `SentMessage`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SentMessage {
    #[allow(dead_code)]
    agent: AgentPubKey,
    #[allow(dead_code)]
    hash: ActionHash,
}

/// Mirror of the coordinator's read model.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Message {
    #[allow(dead_code)]
    hash: ActionHash,
    from: AgentPubKey,
    #[allow(dead_code)]
    to: AgentPubKey,
    #[allow(dead_code)]
    at: Timestamp,
    content: String,
    #[serde(default)]
    role: Option<RoleRef>,
    #[serde(default)]
    case: Option<CaseRef>,
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

/// Mirror of the coordinator's `HandOver`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HandOver {
    offered_by: AgentPubKey,
    to: ActionHash,
    #[allow(dead_code)]
    at: Timestamp,
}

/// Mirror of the coordinator's `CaseClosure`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CaseClosure {
    outcome: CaseOutcome,
    #[allow(dead_code)]
    at: Timestamp,
}

/// Mirror of the coordinator's `Case`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Case {
    case_id: String,
    opener: ActionHash,
    #[allow(dead_code)]
    kind: CaseKind,
    #[allow(dead_code)]
    opened_at: Timestamp,
    messages: Vec<Message>,
    claimed_by: Vec<AgentPubKey>,
    closed: Option<CaseClosure>,
    pending_hand_over: Option<HandOver>,
}

/// Mirror of the coordinator's `RoleCorrespondence`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoleCorrespondence {
    role: RoleRef,
    cases: Vec<Case>,
}

// -- helpers --

/// The readable messages, failing loudly if any entry could not be decrypted.
///
/// Same reasoning as `messaging_inbox.rs`: every `Inbox` link is encrypted to the agent
/// reading it, so an `Unreadable` entry is a fault and no case should pass while holding
/// one.
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

/// Alice as progenitor and administrator, Bob promoted to a second administrator, Carol
/// an ordinary accepted member.
///
/// Two administrators rather than one, because `remove_administrator` refuses to leave an
/// entity with none (`AdministrationError::LastAdmin`), and because a case claimed and
/// handed over between holders needs two holders to be a real test.
async fn two_admins_and_a_member() -> (
    SweetConductorBatch,
    SweetCell,
    SweetCell,
    SweetCell,
    ActionHash,
    ActionHash,
    ActionHash,
) {
    let (conductors, alice, bob, carol) = setup_three_agents_with_alice_as_progenitor().await;

    for (i, cell, name) in [
        (0usize, &alice, "Alice"),
        (1, &bob, "Bob"),
        (2, &carol, "Carol"),
    ] {
        conductors[i]
            .call::<_, Record>(
                &cell.zome("users_organizations"),
                "create_user",
                sample_user(name),
            )
            .await;
    }
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let alice_user = user_hash_of(&conductors[0], &alice).await;
    let bob_user = user_hash_of(&conductors[1], &bob).await;
    let carol_user = user_hash_of(&conductors[2], &carol).await;

    for user in [&alice_user, &bob_user, &carol_user] {
        accept_entity(&conductors[0], &alice, ENTITY_USERS, user.clone()).await;
    }
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    add_network_admin(
        &conductors[0],
        &alice,
        bob_user.clone(),
        bob.agent_pubkey().clone(),
    )
    .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    (
        conductors, alice, bob, carol, alice_user, bob_user, carol_user,
    )
}

/// Open a case, or add to one, as the caller's own.
fn open_case(case_id: &str, content: &str) -> SendRoleMessageInput {
    SendRoleMessageInput {
        role: RoleRef::Admin,
        content: content.to_string(),
        case_id: case_id.to_string(),
        kind: CaseKind::TechnicalReport,
        opener: None,
        event: None,
    }
}

/// Act on somebody else's case, as a holder.
fn on_case(
    case_id: &str,
    opener: &ActionHash,
    content: &str,
    event: Option<CaseEvent>,
) -> SendRoleMessageInput {
    SendRoleMessageInput {
        role: RoleRef::Admin,
        content: content.to_string(),
        case_id: case_id.to_string(),
        kind: CaseKind::TechnicalReport,
        opener: Some(opener.clone()),
        event,
    }
}

async fn role_inbox(conductor: &SweetConductor, cell: &SweetCell) -> Vec<Case> {
    conductor
        .call(&cell.zome("messaging"), "get_role_inbox", RoleRef::Admin)
        .await
}

async fn inbox(conductor: &SweetConductor, cell: &SweetCell) -> Vec<Message> {
    let entries: Vec<InboxEntry> = conductor
        .call(&cell.zome("messaging"), "get_inbox", ())
        .await;
    readable(entries)
}

// -- the cases --

/// P1, P2 and P11: a case reaches every holder, the reply comes back, and neither shows
/// up in a personal inbox.
///
/// Five claims in one case because they are one journey, and the journey is the fact:
/// Carol's report reaches both administrators and no personal inbox, Alice's reply reaches
/// the other administrator and Carol, and Carol sees the whole thing in her own area. Run
/// separately they would pay four more conductor startups to say the same thing.
#[tokio::test(flavor = "multi_thread")]
async fn a_case_reaches_every_holder_and_the_reply_comes_back() {
    let (conductors, alice, bob, carol, _alice_user, _bob_user, carol_user) =
        two_admins_and_a_member().await;

    // The count before, so the count after means something.
    assert!(
        role_inbox(&conductors[0], &alice).await.is_empty(),
        "Alice's role inbox should be empty before anything is sent"
    );

    let sent: Vec<SentMessage> = conductors[2]
        .call(
            &carol.zome("messaging"),
            "send_role_message",
            open_case("case-1", "the kettle will not boil"),
        )
        .await;
    assert_eq!(
        sent.len(),
        3,
        "one copy per recipient agent: both administrators and Carol's own copy; got {sent:?}"
    );
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    for (i, cell, who) in [(0usize, &alice, "Alice"), (1, &bob, "Bob")] {
        let cases = role_inbox(&conductors[i], cell).await;
        assert_eq!(
            cases.len(),
            1,
            "{who} should see exactly one case; got {cases:?}"
        );
        assert_eq!(cases[0].case_id, "case-1");
        assert_eq!(
            cases[0].opener, carol_user,
            "the case is keyed by its opener, who is Carol"
        );
        assert_eq!(cases[0].messages.len(), 1, "one message on the case so far");
        assert_eq!(cases[0].messages[0].content, "the kettle will not boil");
        assert!(
            cases[0].closed.is_none() && cases[0].claimed_by.is_empty(),
            "a freshly opened case is open and unclaimed"
        );
        assert!(
            inbox(&conductors[i], cell).await.is_empty(),
            "{who}'s personal inbox should hold no role message"
        );
    }

    assert!(
        inbox(&conductors[2], &carol).await.is_empty(),
        "Carol's own copy of her report is a role message and stays out of her personal inbox"
    );

    // Alice replies as an administrator, on Carol's case.
    conductors[0]
        .call::<_, Vec<SentMessage>>(
            &alice.zome("messaging"),
            "send_role_message",
            on_case("case-1", &carol_user, "which kettle, and what does it do?", None),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let bobs = role_inbox(&conductors[1], &bob).await;
    assert_eq!(bobs.len(), 1, "still one case, now with a reply on it");
    assert_eq!(
        bobs[0].messages.len(),
        2,
        "the other administrator sees the reply too; got {:?}",
        bobs[0].messages
    );

    let mine: Vec<RoleCorrespondence> = conductors[2]
        .call(&carol.zome("messaging"), "get_my_role_correspondence", ())
        .await;
    assert_eq!(mine.len(), 1, "one role, Admin; got {mine:?}");
    assert_eq!(mine[0].role, RoleRef::Admin);
    assert_eq!(mine[0].cases.len(), 1, "Carol's one case");
    assert_eq!(
        mine[0].cases[0].messages.len(),
        2,
        "Carol sees her report and the reply to it"
    );
    assert!(
        mine[0].cases[0]
            .messages
            .iter()
            .any(|m| &m.from == alice.agent_pubkey()),
        "the reply from the administrator should be in the member's own area"
    );
}

/// P4, P5 and P6: claiming, completing, reopening and handing over, as one fold.
///
/// One case rather than three, because each of these is a step in the same event log and
/// the state after every step is what is being checked. The order matters: both claims
/// stand, then a completion closes, then a reopen opens, then a hand-over moves the claim.
#[tokio::test(flavor = "multi_thread")]
async fn claiming_completing_reopening_and_handing_over() {
    let (conductors, alice, bob, carol, _alice_user, bob_user, carol_user) =
        two_admins_and_a_member().await;

    conductors[2]
        .call::<_, Vec<SentMessage>>(
            &carol.zome("messaging"),
            "send_role_message",
            open_case("case-2", "the app will not open my messages"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    // P4: both administrators claim, and both claims stand. Claims inform, never block.
    for (i, cell) in [(0usize, &alice), (1, &bob)] {
        conductors[i]
            .call::<_, Vec<SentMessage>>(
                &cell.zome("messaging"),
                "send_role_message",
                on_case(
                    "case-2",
                    &carol_user,
                    "I am looking at this",
                    Some(CaseEvent::Claim),
                ),
            )
            .await;
    }
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let cases = role_inbox(&conductors[0], &alice).await;
    assert_eq!(cases.len(), 1);
    assert_eq!(
        cases[0].claimed_by.len(),
        2,
        "both claims should stand; a claim informs and never blocks. got {:?}",
        cases[0].claimed_by
    );
    assert!(
        cases[0].claimed_by.contains(alice.agent_pubkey())
            && cases[0].claimed_by.contains(bob.agent_pubkey()),
        "both administrators should appear as claimants"
    );

    // P5: complete, then reopen. Both notes survive, in order.
    conductors[0]
        .call::<_, Vec<SentMessage>>(
            &alice.zome("messaging"),
            "send_role_message",
            on_case(
                "case-2",
                &carol_user,
                "fixed in the next build",
                Some(CaseEvent::Complete {
                    outcome: CaseOutcome::Resolved,
                }),
            ),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let cases = role_inbox(&conductors[1], &bob).await;
    let closed = cases[0]
        .closed
        .as_ref()
        .expect("the case should be closed after Complete");
    assert_eq!(closed.outcome, CaseOutcome::Resolved);

    conductors[1]
        .call::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_role_message",
            on_case(
                "case-2",
                &carol_user,
                "it is back, reopening",
                Some(CaseEvent::Reopen),
            ),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let cases = role_inbox(&conductors[0], &alice).await;
    assert!(
        cases[0].closed.is_none(),
        "Reopen should clear the closure; got {:?}",
        cases[0].closed
    );
    let notes: Vec<&str> = cases[0]
        .messages
        .iter()
        .map(|m| m.content.as_str())
        .collect();
    let completed_at = notes
        .iter()
        .position(|c| *c == "fixed in the next build")
        .expect("the completion note should be on the case");
    let reopened_at = notes
        .iter()
        .position(|c| *c == "it is back, reopening")
        .expect("the reopening note should be on the case");
    assert!(
        completed_at < reopened_at,
        "both notes should be present in the order they happened; got {notes:?}"
    );

    // P6: Alice offers the case to Bob, Bob accepts, and the claim moves.
    conductors[0]
        .call::<_, Vec<SentMessage>>(
            &alice.zome("messaging"),
            "send_role_message",
            on_case(
                "case-2",
                &carol_user,
                "over to you",
                Some(CaseEvent::HandOverOffer {
                    to: bob_user.clone(),
                }),
            ),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let cases = role_inbox(&conductors[1], &bob).await;
    let pending = cases[0]
        .pending_hand_over
        .as_ref()
        .expect("the offer should be pending before it is accepted");
    assert_eq!(&pending.offered_by, alice.agent_pubkey());
    assert_eq!(pending.to, bob_user);

    // Release Bob's own earlier claim first, so that "the claim moved" is visible rather
    // than hidden behind a claim he already had.
    conductors[1]
        .call::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_role_message",
            on_case(
                "case-2",
                &carol_user,
                "standing back for now",
                Some(CaseEvent::Release),
            ),
        )
        .await;
    conductors[1]
        .call::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_role_message",
            on_case("case-2", &carol_user, "taking it", Some(CaseEvent::HandOverAccept)),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let cases = role_inbox(&conductors[0], &alice).await;
    assert!(
        cases[0].pending_hand_over.is_none(),
        "an accepted offer is no longer pending"
    );
    assert!(
        cases[0].claimed_by.contains(bob.agent_pubkey()),
        "the accepting administrator should hold the claim; got {:?}",
        cases[0].claimed_by
    );
    assert!(
        !cases[0].claimed_by.contains(alice.agent_pubkey()),
        "the offering administrator's claim should have moved away; got {:?}",
        cases[0].claimed_by
    );
}

/// P3, the one that breaks on purpose: a removed administrator's role messages are
/// withheld from every reader.
///
/// This is decision 11's whole security claim. The role label inside the ciphertext is a
/// claim, and each reader tests it against the DHT when it reads. Bob replies as an
/// administrator, is then removed, and his reply disappears from Alice's view of the case
/// and from Carol's own area, without anything being deleted or rewritten.
///
/// **How to make this go red**, which is the check the brief asks for: in
/// `coordinator/messaging/src/inbox.rs`, make `role_claim_stands` return `Ok(true)`
/// before it reads the direction. Bob's reply then survives his removal and both counts
/// below are one too high.
#[tokio::test(flavor = "multi_thread")]
async fn a_removed_admins_role_messages_are_withheld() {
    let (conductors, alice, bob, carol, _alice_user, bob_user, carol_user) =
        two_admins_and_a_member().await;

    conductors[2]
        .call::<_, Vec<SentMessage>>(
            &carol.zome("messaging"),
            "send_role_message",
            open_case("case-3", "my profile picture will not upload"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    conductors[1]
        .call::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_role_message",
            on_case("case-3", &carol_user, "what format is the file?", None),
        )
        .await;
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let before = role_inbox(&conductors[0], &alice).await;
    assert_eq!(
        before[0].messages.len(),
        2,
        "while Bob is an administrator his reply is part of the case; got {:?}",
        before[0].messages
    );

    let removed: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "remove_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: bob_user.clone(),
                agent_pubkeys: vec![bob.agent_pubkey().clone()],
            },
        )
        .await;
    assert!(removed, "Bob should have been removed as an administrator");
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let after = role_inbox(&conductors[0], &alice).await;
    assert_eq!(
        after[0].messages.len(),
        1,
        "Bob's reply claimed a role he no longer holds and should be withheld on read; \
         got {:?}",
        after[0].messages
    );
    assert_eq!(
        after[0].messages[0].from,
        *carol.agent_pubkey(),
        "the message that survives is Carol's, who never claimed a role"
    );

    let mine: Vec<RoleCorrespondence> = conductors[2]
        .call(&carol.zome("messaging"), "get_my_role_correspondence", ())
        .await;
    assert_eq!(
        mine[0].cases[0].messages.len(),
        1,
        "the member's own area applies the same check; got {:?}",
        mine[0].cases[0].messages
    );
}

/// P8: two members who pick the same `case_id` get two cases, not one.
///
/// A case is keyed by the opener's `User` *and* the ID, because the sender chooses the ID.
/// Bob is an administrator here, so he is the reader; Carol and Alice are the two openers.
/// Alice is also an administrator, which does not matter: what is being tested is the key.
#[tokio::test(flavor = "multi_thread")]
async fn a_reused_case_id_from_another_member_opens_a_separate_case() {
    let (conductors, alice, bob, carol, alice_user, _bob_user, carol_user) =
        two_admins_and_a_member().await;

    for (i, cell, what) in [
        (2usize, &carol, "Carol cannot log in"),
        (0, &alice, "Alice cannot log in either"),
    ] {
        conductors[i]
            .call::<_, Vec<SentMessage>>(
                &cell.zome("messaging"),
                "send_role_message",
                open_case("shared-id", what),
            )
            .await;
    }
    await_consistency_s(15, [&alice, &bob, &carol])
        .await
        .unwrap();

    let cases = role_inbox(&conductors[1], &bob).await;
    assert_eq!(
        cases.len(),
        2,
        "the same case_id from two openers is two cases; got {cases:?}"
    );
    assert!(
        cases.iter().all(|c| c.case_id == "shared-id"),
        "both carry the ID that was reused"
    );
    let openers: Vec<&ActionHash> = cases.iter().map(|c| &c.opener).collect();
    assert!(
        openers.contains(&&carol_user) && openers.contains(&&alice_user),
        "the two cases should be distinguished by their openers; got {openers:?}"
    );
    assert!(
        cases.iter().all(|c| c.messages.len() == 1),
        "neither case should have collected the other's message; got {cases:?}"
    );
}

/// P7 and P9: the refusals, with their reasons.
///
/// Two conductors rather than three: a non-holder and one administrator is all these need,
/// and the test-run rules are clear about what a third conductor costs. Alice is the
/// progenitor and so an administrator; Bob is an ordinary accepted member.
#[tokio::test(flavor = "multi_thread")]
async fn the_role_calls_refuse_a_non_holder_and_the_roles_that_are_not_built_yet() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    for (i, cell, name) in [(0usize, &alice, "Alice"), (1, &bob, "Bob")] {
        conductors[i]
            .call::<_, Record>(
                &cell.zome("users_organizations"),
                "create_user",
                sample_user(name),
            )
            .await;
    }
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    let alice_user = user_hash_of(&conductors[0], &alice).await;
    let bob_user = user_hash_of(&conductors[1], &bob).await;
    for user in [&alice_user, &bob_user] {
        accept_entity(&conductors[0], &alice, ENTITY_USERS, user.clone()).await;
    }
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // Bob opens a case legitimately: writing *to* a role claims nothing.
    conductors[1]
        .call::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_role_message",
            open_case("case-4", "the search box does nothing"),
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();

    // P7a: a non-administrator cannot read the role inbox.
    let err = conductors[1]
        .call_fallible::<_, Vec<Case>>(&bob.zome("messaging"), "get_role_inbox", RoleRef::Admin)
        .await
        .expect_err("a non-administrator should not be able to read the admin role inbox")
        .to_string();
    assert!(
        err.contains("holder of that role") && err.contains("read that role's inbox"),
        "the refusal should name the role and what was attempted; got {err}"
    );

    // P7b: a non-administrator cannot send a case event, even on their own case.
    let err = conductors[1]
        .call_fallible::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_role_message",
            SendRoleMessageInput {
                event: Some(CaseEvent::Claim),
                ..open_case("case-4", "I will handle my own report")
            },
        )
        .await
        .expect_err("a non-administrator should not be able to send a case event")
        .to_string();
    assert!(
        err.contains("send a case event"),
        "the refusal should say what was attempted; got {err}"
    );

    // P7c: nor reply as the role on somebody else's case.
    let err = conductors[1]
        .call_fallible::<_, Vec<SentMessage>>(
            &bob.zome("messaging"),
            "send_role_message",
            on_case("case-5", &alice_user, "speaking for the admins", None),
        )
        .await
        .expect_err("a non-administrator should not be able to reply as the role")
        .to_string();
    assert!(
        err.contains("reply on another member's case as that role"),
        "the refusal should say what was attempted; got {err}"
    );

    // P9: the two roles this brief does not switch on, refused with a reason that says so.
    for role in [
        RoleRef::Permission {
            name: "steward".to_string(),
        },
        RoleRef::OrgCoordinator {
            organization: alice_user.clone(),
        },
    ] {
        let err = conductors[0]
            .call_fallible::<_, Vec<SentMessage>>(
                &alice.zome("messaging"),
                "send_role_message",
                SendRoleMessageInput {
                    role: role.clone(),
                    ..open_case("case-6", "anyone there?")
                },
            )
            .await
            .expect_err("a role that is not enabled yet should be refused")
            .to_string();
        assert!(
            err.contains("not enabled yet"),
            "the refusal for {role:?} should say the role is not enabled yet; got {err}"
        );
    }

    // And an administrator reading their own role inbox still works, so the refusals above
    // are about the role and not about the call being broken.
    let cases = role_inbox(&conductors[0], &alice).await;
    assert_eq!(
        cases.len(),
        1,
        "the administrator should see Bob's case; got {cases:?}"
    );

    // A personal message in the same network still behaves: it reaches the inbox and
    // carries no role.
    conductors[0]
        .call::<_, Vec<SentMessage>>(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: bob_user.clone(),
                content: "looking at your report now".to_string(),
            },
        )
        .await;
    await_consistency_s(15, [&alice, &bob]).await.unwrap();
    let bobs = inbox(&conductors[1], &bob).await;
    assert_eq!(bobs.len(), 1, "the personal message should arrive; got {bobs:?}");
    assert!(
        bobs[0].role.is_none(),
        "a personal message carries no role, which is what keeps it in get_inbox"
    );
}
