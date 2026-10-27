//! A listing is removed by an administrator or a coordinator of its
//! organisation, with who and why on the record, and deleted by its author.
//! Three attack cases Sam asked for sit beside the coordinator-of-another-
//! organisation one: a forged organisation at creation, a changed organisation
//! on an update, and a removal without a reason. Mallory's conductor carries
//! the `forge` zome; see `grants.rs` for the shape.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

async fn user_of(conductor: &SweetConductor, cell: &SweetCell) -> ActionHash {
    let links: Vec<Link> = conductor
        .call(
            &cell.zome("users_organizations"),
            "get_agent_user",
            cell.agent_pubkey().clone(),
        )
        .await;
    links[0].target.clone().into_action_hash().unwrap()
}

async fn everyone_accepted(conductors: &SweetConductorBatch, cells: &[&SweetCell]) -> Vec<ActionHash> {
    for (i, cell) in cells.iter().enumerate() {
        conductors[i]
            .call::<_, Record>(
                &cell.zome("users_organizations"),
                "create_user",
                sample_user(format!("Agent {i}")),
            )
            .await;
    }
    await_consistency_s(15, cells.iter().copied()).await.unwrap();
    let mut users = Vec::new();
    for (i, cell) in cells.iter().enumerate() {
        users.push(user_of(&conductors[i], cell).await);
    }
    for user in &users {
        accept_entity(&conductors[0], cells[0], ENTITY_USERS, user.clone()).await;
    }
    await_consistency_s(15, cells.iter().copied()).await.unwrap();
    users
}

/// An approved organisation founded by `founder` (conductor `i`), who is then
/// its coordinator.
async fn approved_organization(
    conductors: &SweetConductorBatch,
    cells: &[&SweetCell],
    i: usize,
    name: &str,
) -> ActionHash {
    let record: Record = conductors[i]
        .call(&cells[i].zome("users_organizations"), "create_organization", sample_organization(name))
        .await;
    let org = record.action_address().clone();
    await_consistency_s(15, cells.iter().copied()).await.unwrap();
    accept_entity(&conductors[0], cells[0], ENTITY_ORGANIZATIONS, org.clone()).await;
    await_consistency_s(15, cells.iter().copied()).await.unwrap();
    org
}

async fn add_member(conductors: &SweetConductorBatch, cell: &SweetCell, i: usize, org: &ActionHash, user: &ActionHash) {
    let added: bool = conductors[i]
        .call(
            &cell.zome("users_organizations"),
            "add_member_to_organization",
            serde_json::json!({ "organization_original_action_hash": org, "user_original_action_hash": user }),
        )
        .await;
    assert!(added);
}

async fn zome_index(conductor: &SweetConductor, mallory: &SweetCell, name: &str) -> u8 {
    let names: Vec<String> = conductor
        .call(&mallory.zome("forge"), "integrity_zome_names", ())
        .await;
    names.iter().position(|n| n == name).expect("an integrity zome") as u8
}

async fn grant_for_role(conductor: &SweetConductor, cell: &SweetCell, agent: &AgentPubKey, role: &str) -> ActionHash {
    let records: Vec<Record> = conductor
        .call(&cell.zome("administration"), "get_agent_grants", agent.clone())
        .await;
    records
        .into_iter()
        .find(|r| {
            r.entry()
                .to_app_option::<RoleGrant>()
                .ok()
                .flatten()
                .map(|g| g.role == role)
                .unwrap_or(false)
        })
        .unwrap_or_else(|| panic!("{agent:?} should hold a {role} grant"))
        .action_address()
        .clone()
}

fn reason<T, E: std::fmt::Debug>(outcome: Result<T, E>) -> Result<T, String> {
    outcome.map_err(|e| format!("{e:?}"))
}

fn refused(outcome: &Result<ActionHash, String>, expected: &str, what: &str) {
    match outcome {
        Ok(hash) => panic!("{what} should be refused, but was written as {hash}"),
        Err(text) => assert!(text.contains(expected), "{what} should be refused with {expected:?}; got {text}"),
    }
}

fn listing(title: &str, service_type: &ActionHash) -> Request {
    Request {
        title: title.to_string(),
        description: "forged past the coordinator".to_string(),
        contact_preference: "Email".to_string(),
        date_range: None,
        time_estimate_hours: None,
        time_preference: "Morning".to_string(),
        time_zone: None,
        interaction_type: "Virtual".to_string(),
        links: vec![],
        status: "Active".to_string(),
        grant: None,
        organization: None,
        membership: None,
        removal_reason: None,
        service_type_hash: Some(service_type.clone()),
    }
}

async fn forge_entry(conductor: &SweetConductor, mallory: &SweetCell, zome_index: u8, entry: Request) -> Result<ActionHash, String> {
    let bytes: SerializedBytes = entry.try_into().expect("serializes");
    reason(
        conductor
            .call_fallible(
                &mallory.zome("forge"),
                "forge_entry",
                serde_json::json!({ "zome_index": zome_index, "entry_index": 0, "entry": bytes }),
            )
            .await,
    )
}

async fn forge_update(conductor: &SweetConductor, mallory: &SweetCell, original: &ActionHash, entry: Request) -> Result<ActionHash, String> {
    let bytes: SerializedBytes = entry.try_into().expect("serializes");
    reason(
        conductor
            .call_fallible(
                &mallory.zome("forge"),
                "forge_update",
                serde_json::json!({ "original_action_hash": original, "entry": bytes }),
            )
            .await,
    )
}

/// Bob posts a request for his organisation; the request carries the
/// membership that admits him. Mallory, who is not a member, forges one for
/// it: with no membership, with Bob's membership, and with her membership of
/// her own organisation. Each refused.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_for_an_organisation_carries_its_authors_membership() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let all = [alice, bob, &mallory];
    let users = everyone_accepted(&conductors, &all).await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, all).await.unwrap();
    let bobs_org = approved_organization(&conductors, &all, 1, "Bob's").await;
    let mallorys_org = approved_organization(&conductors, &all, 2, "Mallory's").await;
    let requests = zome_index(&conductors[2], &mallory, "requests_integrity").await;

    // The honest write, through the coordinator.
    let mut input = sample_request("Bob's, for his organisation", gardening.clone());
    input.organization = Some(bobs_org.clone());
    let record: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", input)
        .await;
    let written: Request = record.entry().to_app_option().unwrap().expect("a request");
    assert_eq!(written.organization, Some(bobs_org.clone()));
    let bobs_membership = written.membership.expect("the request carries Bob's membership");

    // Mallory is not a member of Bob's organisation: the coordinator refuses her.
    let mut input = sample_request("Mallory's, for Bob's organisation", gardening.clone());
    input.organization = Some(bobs_org.clone());
    let through_the_app = reason(
        conductors[2]
            .call_fallible::<_, Record>(&mallory.zome("requests"), "create_request", input)
            .await,
    );
    assert!(through_the_app.is_err(), "the coordinator refuses a non-member");

    // Past the coordinator, with her member grant.
    let mine = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "member").await;
    let mut forged = listing("no membership", &gardening);
    forged.grant = Some(mine.clone());
    forged.organization = Some(bobs_org.clone());
    refused(
        &forge_entry(&conductors[2], &mallory, requests, forged).await,
        "it names no membership",
        "a listing for an organisation with no membership",
    );
    let mut forged = listing("Bob's membership", &gardening);
    forged.grant = Some(mine.clone());
    forged.organization = Some(bobs_org.clone());
    forged.membership = Some(bobs_membership);
    refused(
        &forge_entry(&conductors[2], &mallory, requests, forged).await,
        "someone else's",
        "a listing carrying Bob's membership",
    );
    // Her own membership, of her own organisation, named against Bob's.
    let her_links: Vec<Link> = conductors[2]
        .call(&mallory.zome("users_organizations"), "get_organization_members_links", mallorys_org.clone())
        .await;
    let her_membership = her_links
        .iter()
        .find(|l| l.target.clone().into_action_hash() == Some(users[2].clone()))
        .expect("Mallory is a member of her own organisation")
        .create_link_hash
        .clone();
    let mut forged = listing("another organisation's membership", &gardening);
    forged.grant = Some(mine);
    forged.organization = Some(bobs_org);
    forged.membership = Some(her_membership);
    refused(
        &forge_entry(&conductors[2], &mallory, requests, forged).await,
        "in another organisation",
        "a listing carrying a membership of another organisation",
    );
}

/// A listing stays in the organisation it was posted for: Mallory, as the
/// creator of her own listing, cannot move it into one (or out of one) on an
/// update, past the coordinator.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_stays_in_the_organisation_it_was_posted_for() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let all = [alice, &mallory];
    everyone_accepted(&conductors, &all).await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, all).await.unwrap();
    let org = approved_organization(&conductors, &all, 1, "Mallory's").await;

    let record: Record = conductors[1]
        .call(&mallory.zome("requests"), "create_request", sample_request("posted with no organisation", gardening.clone()))
        .await;
    let original = record.action_address().clone();

    let mut moved = listing("moved into an organisation", &gardening);
    moved.organization = Some(org);
    refused(
        &forge_update(&conductors[1], &mallory, &original, moved).await,
        "stays in the organisation it was posted for",
        "an update that moves a listing into an organisation",
    );
}

/// A removal by anyone but the creator says who and why: the coordinator of the
/// listing's organisation removes it with a reason, the author reads the reason
/// and the record leaves the active list; a coordinator of another organisation
/// is refused past the coordinator, and so is a removal without a reason, even
/// by an administrator.
#[tokio::test(flavor = "multi_thread")]
async fn a_removal_by_a_role_holder_says_who_and_why() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let all = [alice, bob, &mallory];
    let users = everyone_accepted(&conductors, &all).await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, all).await.unwrap();
    let bobs_org = approved_organization(&conductors, &all, 1, "Bob's").await;
    approved_organization(&conductors, &all, 2, "Mallory's").await;
    // Alice joins Bob's organisation and posts for it.
    add_member(&conductors, bob, 1, &bobs_org, &users[0]).await;
    await_consistency_s(15, all).await.unwrap();
    let mut input = sample_request("Alice's, for Bob's organisation", gardening.clone());
    input.organization = Some(bobs_org.clone());
    let record: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", input)
        .await;
    let original = record.action_address().clone();
    await_consistency_s(15, all).await.unwrap();

    // A coordinator of another organisation, past the coordinator.
    let her_grant = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "org_coordinator").await;
    let mut removal = listing("Alice's, for Bob's organisation", &gardening);
    removal.organization = Some(bobs_org.clone());
    removal.status = "Deleted".to_string();
    removal.grant = Some(her_grant);
    removal.removal_reason = Some("not my organisation, but I say so".to_string());
    refused(
        &forge_update(&conductors[2], &mallory, &original, removal).await,
        "does not cover Coordinate here",
        "a removal by a coordinator of another organisation",
    );

    // Through the coordinator: the same refusal, and the empty reason.
    let by_mallory = reason(
        conductors[2]
            .call_fallible::<_, Record>(
                &mallory.zome("requests"),
                "remove_request",
                serde_json::json!({ "original_action_hash": original, "reason": "I would like it gone" }),
            )
            .await,
    );
    assert!(by_mallory.is_err(), "the coordinator refuses a coordinator of another organisation");
    let no_reason = reason(
        conductors[2]
            .call_fallible::<_, Record>(
                &mallory.zome("requests"),
                "remove_request",
                serde_json::json!({ "original_action_hash": original, "reason": "   " }),
            )
            .await,
    );
    assert!(no_reason.is_err(), "the coordinator refuses a removal without a reason");

    // Bob, coordinator of the organisation it was posted for, with a reason.
    let removed: Record = conductors[1]
        .call(
            &bob.zome("requests"),
            "remove_request",
            serde_json::json!({ "original_action_hash": original, "reason": "duplicate of the lift share" }),
        )
        .await;
    let entry: Request = removed.entry().to_app_option().unwrap().expect("a request");
    assert_eq!(entry.status, "Deleted");
    assert_eq!(entry.removal_reason.as_deref(), Some("duplicate of the lift share"));
    assert_eq!(removed.action().author(), bob.agent_pubkey(), "who is the update's author");
    await_consistency_s(30, all).await.unwrap();

    // Alice, the author, reads the removal; the active list no longer has it.
    let latest: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_latest_request_record", original.clone())
        .await;
    let seen: Request = latest.expect("the author still finds it").entry().to_app_option().unwrap().expect("a request");
    assert_eq!(seen.removal_reason.as_deref(), Some("duplicate of the lift share"));
    let active: Vec<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_active_requests", ())
        .await;
    assert!(
        !active.iter().any(|r| r.action_address() == &original || r.action_address() == removed.action_address()),
        "a removed listing has left the active list"
    );
}

/// An administrator's removal without a reason is refused by validation: Mallory
/// is made an administrator and forges one.
#[tokio::test(flavor = "multi_thread")]
async fn an_administrators_removal_without_a_reason_is_refused() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let all = [alice, &mallory];
    let users = everyone_accepted(&conductors, &all).await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, all).await.unwrap();
    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "add_administrator",
            EntityActionHashAgents {
                entity: ENTITY_NETWORK.to_string(),
                entity_original_action_hash: users[1].clone(),
                agent_pubkeys: vec![mallory.agent_pubkey().clone()],
            },
        )
        .await;
    let record: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Alice's", gardening.clone()))
        .await;
    let original = record.action_address().clone();
    await_consistency_s(15, all).await.unwrap();

    let admin = grant_for_role(&conductors[1], &mallory, mallory.agent_pubkey(), "admin").await;
    let mut removal = listing("Alice's", &gardening);
    removal.status = "Deleted".to_string();
    removal.grant = Some(admin.clone());
    refused(
        &forge_update(&conductors[1], &mallory, &original, removal).await,
        "a removal by anyone but its author says why",
        "an administrator's removal with no reason",
    );
    // With a reason, the same write stands.
    let mut removal = listing("Alice's", &gardening);
    removal.status = "Deleted".to_string();
    removal.grant = Some(admin);
    removal.removal_reason = Some("against the terms".to_string());
    let written = forge_update(&conductors[1], &mallory, &original, removal).await;
    assert!(written.is_ok(), "an administrator's removal with a reason is accepted; got {written:?}");
}
