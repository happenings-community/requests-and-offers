//! Concurrence tests.
//!
//! Covers the inert motion, the refusals that make plural authority mean two people,
//! the status transition a concurrence carries, and the constrained pairing required
//! when the subject is an administrator.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

const PERMISSION_STEWARD: &str = "steward";

/// Creates a user for each agent and returns their user action hashes.
async fn create_users(
    conductors: &SweetConductorBatch,
    cells: [&SweetCell; 4],
    names: [&str; 4],
) -> Vec<ActionHash> {
    for (i, cell) in cells.iter().enumerate() {
        let _: Record = conductors[i]
            .call(
                &cell.zome("users_organizations"),
                "create_user",
                sample_user(names[i]),
            )
            .await;
    }

    await_consistency_s(20, cells).await.unwrap();

    let mut hashes = Vec::new();
    for (i, cell) in cells.iter().enumerate() {
        let links: Vec<Link> = conductors[i]
            .call(
                &cell.zome("users_organizations"),
                "get_agent_user",
                cell.agent_pubkey().clone(),
            )
            .await;
        hashes.push(links[0].target.clone().into_action_hash().unwrap());
    }
    hashes
}

#[tokio::test(flavor = "multi_thread")]
async fn two_stewards_carry_a_suspension() {
    let (conductors, alice, bob, carol, dave) =
        setup_four_agents_with_alice_as_progenitor().await;

    let hashes = create_users(
        &conductors,
        [&alice, &bob, &carol, &dave],
        ["Alice", "Bob", "Carol", "Dave"],
    )
    .await;
    let (alice_user, bob_user, dave_user) =
        (hashes[0].clone(), hashes[1].clone(), hashes[3].clone());

    // Alice becomes network administrator.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user.clone(),
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    // Members must be accepted before there is anything to suspend.
    for hash in [&hashes[1], &hashes[2], &hashes[3]] {
        accept_entity(&conductors[0], &alice, ENTITY_USERS, hash.clone()).await;
    }

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    // Bob and Carol become stewards.
    for (hash, cell) in [(&hashes[1], &bob), (&hashes[2], &carol)] {
        let _: bool = conductors[0]
            .call(
                &alice.zome("administration"),
                "grant_permission",
                serde_json::json!({
                    "permission": PERMISSION_STEWARD,
                    "holder_original_action_hash": hash,
                    "agent_pubkeys": [cell.agent_pubkey()]
                }),
            )
            .await;
    }

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    let motion_input = serde_json::json!({
        "kind": "suspension",
        "entity": ENTITY_USERS,
        "subject_agent": dave.agent_pubkey(),
        "subject_entity_hash": dave_user,
        "flavour": "temporary",
        "duration_days": 30,
        "reason": "Repeated commercial solicitation after a guidance finding"
    });

    // Dave holds no permission, so he cannot put a motion at all.
    let dave_motion = conductors[3]
        .call_fallible::<_, Record>(
            &dave.zome("administration"),
            "put_motion",
            motion_input.clone(),
        )
        .await;
    assert!(dave_motion.is_err(), "A non-steward should not put a motion");

    // Bob moves the suspension.
    let motion: Record = conductors[1]
        .call(&bob.zome("administration"), "put_motion", motion_input)
        .await;
    let motion_hash = motion.signed_action.hashed.hash.clone();

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    // The motion is inert: Dave is still accepted, and nothing carries it yet.
    let dave_status: Option<Status> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": dave_user
            }),
        )
        .await;
    assert_eq!(
        dave_status.unwrap().status_type,
        "accepted",
        "A motion alone should not change anyone's status"
    );

    let pending: Option<Record> = conductors[2]
        .call(
            &carol.zome("administration"),
            "get_concurrence_for_motion",
            motion_hash.clone(),
        )
        .await;
    assert!(pending.is_none(), "The motion should be awaiting a second steward");

    // Bob cannot carry his own motion.
    let self_concur = conductors[1]
        .call_fallible::<_, Record>(
            &bob.zome("administration"),
            "concur",
            motion_hash.clone(),
        )
        .await;
    assert!(
        self_concur.is_err(),
        "The moving steward should not be the concurring one"
    );

    // Alice administers but does not steward, so she cannot concur either.
    let admin_concur = conductors[0]
        .call_fallible::<_, Record>(
            &alice.zome("administration"),
            "concur",
            motion_hash.clone(),
        )
        .await;
    assert!(
        admin_concur.is_err(),
        "An administrator without the steward permission should not concur"
    );

    // Dave is the subject, and in any case holds no permission.
    let subject_concur = conductors[3]
        .call_fallible::<_, Record>(
            &dave.zome("administration"),
            "concur",
            motion_hash.clone(),
        )
        .await;
    assert!(subject_concur.is_err(), "The subject should not concur");

    // Carol carries it.
    let _: Record = conductors[2]
        .call(&carol.zome("administration"), "concur", motion_hash.clone())
        .await;

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    // The suspension is applied, read from a third conductor.
    let dave_after: Option<Status> = conductors[1]
        .call(
            &bob.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": dave_user
            }),
        )
        .await;
    let dave_after = dave_after.expect("Dave should have a status");
    assert_eq!(
        dave_after.status_type, "suspended temporarily",
        "The concurrence should carry the suspension"
    );
    assert!(
        dave_after.suspended_until.is_some(),
        "A temporary suspension computes its end date at concurrence"
    );

    // A second concurrence is refused, so the act cannot be applied twice.
    let second = conductors[1]
        .call_fallible::<_, Record>(&bob.zome("administration"), "concur", motion_hash)
        .await;
    assert!(
        second.is_err(),
        "A motion should carry only one concurrence"
    );

    // Bob and Carol are two stewards, so a motion about a member needed no administrator.
    let _ = (bob_user,);
}

#[tokio::test(flavor = "multi_thread")]
async fn a_motion_about_an_administrator_needs_an_administrator() {
    let (conductors, alice, bob, carol, dave) =
        setup_four_agents_with_alice_as_progenitor().await;

    let hashes = create_users(
        &conductors,
        [&alice, &bob, &carol, &dave],
        ["Alice", "Bob", "Carol", "Dave"],
    )
    .await;
    let (alice_user, dave_user) = (hashes[0].clone(), hashes[3].clone());

    // Alice becomes administrator first so she can accept the others.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: alice_user.clone(),
                agent_pubkeys: vec![alice.agent_pubkey().clone()],
            },
        )
        .await;

    for hash in [&hashes[1], &hashes[2], &hashes[3]] {
        accept_entity(&conductors[0], &alice, ENTITY_USERS, hash.clone()).await;
    }

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    // Dave is an administrator too; Bob and Carol are stewards.
    for (hash, cell) in [(&hashes[3], &dave)] {
        let _: bool = conductors[0]
            .call(
                &alice.zome("administration"),
                "add_administrator",
                EntityActionHashAgents {
                    entity: ENTITY_NETWORK.to_string(),
                    entity_original_action_hash: hash.clone(),
                    agent_pubkeys: vec![cell.agent_pubkey().clone()],
                },
            )
            .await;
    }

    for (hash, cell) in [(&hashes[1], &bob), (&hashes[2], &carol)] {
        let _: bool = conductors[0]
            .call(
                &alice.zome("administration"),
                "grant_permission",
                serde_json::json!({
                    "permission": PERMISSION_STEWARD,
                    "holder_original_action_hash": hash,
                    "agent_pubkeys": [cell.agent_pubkey()]
                }),
            )
            .await;
    }

    // Alice also stewards, so she can move and concur in her own right.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "grant_permission",
            serde_json::json!({
                "permission": PERMISSION_STEWARD,
                "holder_original_action_hash": alice_user,
                "agent_pubkeys": [alice.agent_pubkey()]
            }),
        )
        .await;

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    // Dave's status original, fixed for the life of the chain; the previous hash
    // rotates with every update but this does not.
    let dave_status_record: Option<Record> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": dave_user
            }),
        )
        .await;
    let dave_status_original = dave_status_record
        .expect("Dave should have a status")
        .signed_action
        .hashed
        .hash
        .clone();

    // The pairing rule turns on this being true. Assert it directly rather than
    // inferring it from the rule's behaviour.
    let dave_is_admin: bool = conductors[1]
        .call(
            &bob.zome("administration"),
            "check_if_entity_is_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "entity_original_action_hash": dave_user
            }),
        )
        .await;
    assert!(dave_is_admin, "Dave should be an administrator");

    let motion_input = serde_json::json!({
        "kind": "suspension",
        "entity": ENTITY_USERS,
        "subject_agent": dave.agent_pubkey(),
        "subject_entity_hash": dave_user,
        "flavour": "indefinite",
        "duration_days": serde_json::Value::Null,
        "reason": "Administrative authority used against the community agreement"
    });

    // Bob moves it. Carol is the other steward, so two stewards alone cannot carry it.
    let motion: Record = conductors[1]
        .call(
            &bob.zome("administration"),
            "put_motion",
            motion_input.clone(),
        )
        .await;
    let motion_hash = motion.signed_action.hashed.hash.clone();

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    let two_stewards = conductors[2]
        .call_fallible::<_, Record>(
            &carol.zome("administration"),
            "concur",
            motion_hash.clone(),
        )
        .await;
    assert!(
        two_stewards.is_err(),
        "Two stewards should not carry a motion about an administrator"
    );

    // Alice holds both roles, so she is the administrator half of the pairing.
    let _: Record = conductors[0]
        .call(&alice.zome("administration"), "concur", motion_hash)
        .await;

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    let dave_after: Option<Status> = conductors[2]
        .call(
            &carol.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": dave_user
            }),
        )
        .await;
    let dave_after = dave_after.expect("Dave should have a status");
    assert_eq!(
        dave_after.status_type, "suspended indefinitely",
        "An administrator with a steward should carry it"
    );
    assert!(
        dave_after.suspended_until.is_none(),
        "An indefinite suspension carries no end date"
    );

    // Return Dave to accepted so the next motion acts on a clean subject. Nothing in
    // the zome refuses a motion against an already-suspended member; whether it should
    // is a design question this test deliberately does not exercise.
    let suspended_record: Option<Record> = conductors[0]
        .call(
            &alice.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": dave_user
            }),
        )
        .await;
    let suspended_hash = suspended_record.unwrap().signed_action.hashed.hash.clone();

    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "unsuspend_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": dave_user,
                "status_original_action_hash": dave_status_original,
                "status_previous_action_hash": suspended_hash
            }),
        )
        .await;

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    // Two administrators can act on a third without a steward. An administrator is
    // answerable to their peers rather than unassailable.
    let _: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: hashes[2].clone(),
                agent_pubkeys: vec![carol.agent_pubkey().clone()],
            },
        )
        .await;

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    let second_motion: Record = conductors[0]
        .call(
            &alice.zome("administration"),
            "put_motion",
            serde_json::json!({
                "kind": "suspension",
                "entity": ENTITY_USERS,
                "subject_agent": dave.agent_pubkey(),
                "subject_entity_hash": dave_user,
                "flavour": "temporary",
                "duration_days": 7,
                "reason": "Second motion, carried by two administrators"
            }),
        )
        .await;
    let second_hash = second_motion.signed_action.hashed.hash.clone();

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    let _: Record = conductors[2]
        .call(&carol.zome("administration"), "concur", second_hash)
        .await;

    await_consistency_s(20, [&alice, &bob, &carol, &dave])
        .await
        .unwrap();

    let dave_finally: Option<Status> = conductors[1]
        .call(
            &bob.zome("administration"),
            "get_latest_status_for_entity",
            serde_json::json!({
                "entity": ENTITY_USERS,
                "entity_original_action_hash": dave_user
            }),
        )
        .await;
    assert_eq!(
        dave_finally.unwrap().status_type,
        "suspended temporarily",
        "Two administrators should carry a motion about a third"
    );
}
