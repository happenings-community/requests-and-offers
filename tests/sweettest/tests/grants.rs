//! The chain of grants, at the validation level.
//!
//! Mallory runs a modified client: her conductor carries the `forge` zome,
//! which writes entries and links by type index past every coordinator rule.
//! The integrity zomes are the same, so she is on the same network as Alice
//! and Bob. A write her own conductor refuses never reaches them; a write it
//! accepts does. Each case runs alone, one per process.

use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

// ── Helpers ─────────────────────────────────────────────────────────────────

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

/// Everyone creates a profile; Alice, the first real agent, is the
/// administrator (the progenitor, or the first user in development mode) and
/// accepts everyone. Returns each agent's user hash in conductor order.
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

/// The index of an integrity zome, read from the DNA, so the forged write
/// lands in the zome it is aimed at.
async fn zome_index(conductor: &SweetConductor, mallory: &SweetCell, name: &str) -> u8 {
    let names: Vec<String> = conductor
        .call(&mallory.zome("forge"), "integrity_zome_names", ())
        .await;
    names
        .iter()
        .position(|n| n == name)
        .unwrap_or_else(|| panic!("{name} is not an integrity zome; got {names:?}")) as u8
}

/// An agent's live grants, by hash, with their entries.
async fn grants_of(
    conductor: &SweetConductor,
    cell: &SweetCell,
    agent: &AgentPubKey,
) -> Vec<(ActionHash, RoleGrant)> {
    let records: Vec<Record> = conductor
        .call(&cell.zome("administration"), "get_agent_grants", agent.clone())
        .await;
    records
        .into_iter()
        .map(|r| {
            let grant: RoleGrant = r.entry().to_app_option().unwrap().expect("a grant entry");
            (r.action_address().clone(), grant)
        })
        .collect()
}

async fn grant_for_role(
    conductor: &SweetConductor,
    cell: &SweetCell,
    agent: &AgentPubKey,
    role: &str,
) -> ActionHash {
    grants_of(conductor, cell, agent)
        .await
        .into_iter()
        .find(|(_, g)| g.role == role)
        .unwrap_or_else(|| panic!("{agent:?} should hold a {role} grant"))
        .0
}

fn a_request(title: &str, grant: Option<ActionHash>, service_type: Option<ActionHash>) -> Request {
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
        grant,
        organization: None,
        membership: None,
        removal_reason: None,
        service_type_hash: service_type,
    }
}

/// An approved service type, written by Alice, the progenitor: a listing
/// must name one (#257), and hers land approved.
async fn a_service_type(conductor: &SweetConductor, alice: &SweetCell, name: &str) -> ActionHash {
    let record: Record = conductor
        .call(&alice.zome("service_types"), "create_service_type", sample_service_type(name))
        .await;
    record.action_address().clone()
}

fn reason<T, E: std::fmt::Debug>(outcome: Result<T, E>) -> Result<T, String> {
    outcome.map_err(|e| format!("{e:?}"))
}

/// Mallory writes an entry of the given type with the bytes as given.
async fn forge_entry<E: TryInto<SerializedBytes>>(
    conductor: &SweetConductor,
    mallory: &SweetCell,
    zome_index: u8,
    entry_index: u8,
    entry: E,
) -> Result<ActionHash, String>
where
    E::Error: std::fmt::Debug,
{
    let bytes: SerializedBytes = entry.try_into().expect("the entry should serialize");
    reason(
        conductor
            .call_fallible(
                &mallory.zome("forge"),
                "forge_entry",
                serde_json::json!({
                    "zome_index": zome_index,
                    "entry_index": entry_index,
                    "entry": bytes,
                }),
            )
            .await,
    )
}

async fn forge_update<E: TryInto<SerializedBytes>>(
    conductor: &SweetConductor,
    mallory: &SweetCell,
    original: &ActionHash,
    entry: E,
) -> Result<ActionHash, String>
where
    E::Error: std::fmt::Debug,
{
    let bytes: SerializedBytes = entry.try_into().expect("the entry should serialize");
    reason(
        conductor
            .call_fallible(
                &mallory.zome("forge"),
                "forge_update",
                serde_json::json!({
                    "original_action_hash": original,
                    "entry": bytes,
                }),
            )
            .await,
    )
}

fn refused(outcome: &Result<ActionHash, String>, expected: &str, what: &str) {
    match outcome {
        Ok(hash) => panic!("{what} should be refused, but was written as {hash}"),
        Err(text) => assert!(
            text.contains(expected),
            "{what} should be refused with {expected:?}; got {text}"
        ),
    }
}

// ── Entry indexes, from the integrity zomes' enums ──────────────────────────

const REQUEST: u8 = 0;
/// In `service_types_integrity::LinkTypes`: `ServiceTypeToRequest`,
/// `RequestToServiceType`, `OfferToServiceType`.
const SERVICE_TYPE_TO_REQUEST_LINK: u8 = 2;
const REQUEST_TO_SERVICE_TYPE_LINK: u8 = 3;
const OFFER_TO_SERVICE_TYPE_LINK: u8 = 5;
const SERVICE_TYPE: u8 = 0;
/// After `Status`: `utils::grants::ROLE_GRANT_ENTRY_INDEX`.
const ROLE_GRANT: u8 = 1;
/// `OrganizationCoordinators` in `users_organizations_integrity::LinkTypes`.
const ORGANIZATION_COORDINATORS_LINK: u8 = 8;

// ── Cases ───────────────────────────────────────────────────────────────────

/// A listing carries the member grant its author holds, and nothing else does.
///
/// Four forgeries and one honest write, all past the coordinator: no grant;
/// someone else's grant; a grant of the wrong role; a grant whose authority
/// could not give it. Then Mallory's own member grant, which Alice reads.
///
/// **To make this go red:** make `utils::grants::check_act` return `Ok(Ok(..))`
/// before it looks at anything. Every forgery is then written.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_carries_the_member_grant_its_author_holds() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let requests = zome_index(&conductors[2], &mallory, "requests_integrity").await;
    let administration = zome_index(&conductors[2], &mallory, "administration_integrity").await;

    // No grant.
    let no_grant = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("no grant", None, None)).await;
    refused(&no_grant, "needs a grant for Participate", "a listing with no grant");

    // Someone else's grant.
    let bobs = grant_for_role(&conductors[1], bob, bob.agent_pubkey(), "member").await;
    let borrowed = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("borrowed", Some(bobs), None)).await;
    refused(&borrowed, "held by someone else", "a listing with Bob's grant");

    // A grant of the wrong role: Alice makes Mallory an administrator.
    conductors[0]
        .call::<_, bool>(
            &alice.zome("administration"),
            "add_administrator",
            serde_json::json!({
                "entity": ENTITY_NETWORK,
                "entity_original_action_hash": users[2],
                "agent_pubkeys": [mallory.agent_pubkey()],
            }),
        )
        .await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let admin = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "admin").await;
    let wrong_role = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("as admin", Some(admin), None)).await;
    refused(&wrong_role, "does not cover Participate", "a listing with an admin grant");

    // A grant whose authority could not give it: a member grant resting on a
    // member grant. The grant itself is refused, so nothing can rest on it.
    let mine = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "member").await;
    let self_made = forge_entry(
        &conductors[2],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "member".to_string(),
            holder: mallory.agent_pubkey().clone(),
            scope: None,
            authority: Authority::Grant(mine.clone()),
        },
    )
    .await;
    refused(&self_made, "a member may not grant member", "a grant resting on a member grant");
    let on_bobs = forge_entry(
        &conductors[2],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "member".to_string(),
            holder: mallory.agent_pubkey().clone(),
            scope: None,
            authority: Authority::Grant(
                grant_for_role(&conductors[1], bob, bob.agent_pubkey(), "member").await,
            ),
        },
    )
    .await;
    refused(&on_bobs, "written by the holder of the grant it rests on", "a grant resting on Bob's grant");

    // The honest write: her own member grant, and a service type (#257).
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let honest = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("honest", Some(mine), Some(gardening))).await;
    let hash = honest.unwrap_or_else(|e| panic!("a listing with its author's member grant should be written; got {e}"));
    await_consistency_s(30, [alice, bob, &mallory]).await.unwrap();
    let read: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_request", hash)
        .await;
    assert!(read.is_some(), "Alice should read the listing Mallory wrote with her grant");
}

/// Mallory writes a link of the given type, past the coordinator.
async fn forge_a_link(
    conductor: &SweetConductor,
    mallory: &SweetCell,
    zome_index: u8,
    link_type: u8,
    base: &ActionHash,
    target: &ActionHash,
) -> Result<ActionHash, String> {
    reason(
        conductor
            .call_fallible(
                &mallory.zome("forge"),
                "forge_link",
                serde_json::json!({
                    "base": AnyLinkableHash::from(base.clone()),
                    "target": AnyLinkableHash::from(target.clone()),
                    "zome_index": zome_index,
                    "link_type": link_type,
                    "tag": Vec::<u8>::new(),
                }),
            )
            .await,
    )
}

/// A listing names one service type, and it is a real one (#257).
///
/// Past the coordinator, with her own member grant: a request naming no
/// service type is refused, and so is one naming something that is not a
/// service type (her grant's own record). One naming Alice's service type is
/// written.
///
/// **To make this go red:** make `utils::listings::check_listing_service_type`
/// return `Valid` for a create. Both forgeries are then written.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_names_one_real_service_type() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let requests = zome_index(&conductors[2], &mallory, "requests_integrity").await;
    let mine = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "member").await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let untyped = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("no type", Some(mine.clone()), None)).await;
    refused(&untyped, "must name its service type", "a request naming no service type");

    let not_a_type = forge_entry(
        &conductors[2],
        &mallory,
        requests,
        REQUEST,
        a_request("a grant for a type", Some(mine.clone()), Some(mine.clone())),
    )
    .await;
    refused(&not_a_type, "the original record of a service type", "a request naming a record that is not a service type");

    let typed = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("gardening", Some(mine), Some(gardening))).await;
    typed.unwrap_or_else(|e| panic!("a request naming a service type should be written; got {e}"));
}

/// A listing keeps its service type: an update naming another is refused,
/// through the coordinator and past it (#257).
///
/// Mallory posts a request for gardening through the app. The app refuses to
/// move it to design, with a reason. Past the coordinator, her own update
/// naming design is refused by validation; one keeping gardening is written.
///
/// **To make this go red:** make `utils::listings::check_unchanged` return
/// `Ok(())`. The forged update is then written.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_keeps_its_service_type() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    let design = a_service_type(&conductors[0], alice, "Design").await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let record: Record = conductors[2]
        .call(&mallory.zome("requests"), "create_request", sample_request("A lift", gardening.clone()))
        .await;
    let original = record.action_address().clone();
    let written: Request = record.entry().to_app_option().unwrap().expect("a request");
    assert_eq!(written.service_type_hash, Some(gardening.clone()), "the coordinator puts the service type on the entry");

    // Through the app: refused with a reason.
    let moved = reason(
        conductors[2]
            .call_fallible::<_, Record>(
                &mallory.zome("requests"),
                "update_request",
                serde_json::json!({
                    "original_action_hash": original,
                    "previous_action_hash": original,
                    "updated_request": sample_request("A lift", design.clone()).request,
                    "service_type_hash": design,
                    "medium_of_exchange_hashes": [],
                }),
            )
            .await,
    );
    match moved {
        Ok(record) => panic!("moving a listing to another service type should be refused, but wrote {}", record.action_address()),
        Err(text) => assert!(text.contains("cannot change"), "the refusal should say the type cannot change; got {text}"),
    }

    // Past the coordinator: validation refuses the move, and keeps the same type.
    let forged = forge_update(&conductors[2], &mallory, &original, a_request("A lift, moved", None, Some(design.clone()))).await;
    refused(&forged, "cannot change", "an update moving a listing to another service type");
    let kept = forge_update(&conductors[2], &mallory, &original, a_request("A lift, retitled", None, Some(gardening))).await;
    kept.unwrap_or_else(|e| panic!("an update keeping the service type should be written; got {e}"));
}

/// A listing is linked only to the service type its own entry names, in
/// either direction, and only a listing of the right kind (#257).
///
/// Mallory posts a request and an offer for gardening through the app. Past
/// the coordinator: links from the request to design, from design to the
/// request, and from the offer to design are refused; a request link whose
/// "request" is the offer is refused; a second link from the request to
/// gardening is written.
///
/// **To make this go red:** remove the link arm from `validate` in
/// `service_types_integrity`. Every forged link is then written.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_is_linked_only_to_its_own_service_type() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let service_types = zome_index(&conductors[2], &mallory, "service_types_integrity").await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    let design = a_service_type(&conductors[0], alice, "Design").await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let request: Record = conductors[2]
        .call(&mallory.zome("requests"), "create_request", sample_request("A lift", gardening.clone()))
        .await;
    let offer: Record = conductors[2]
        .call(&mallory.zome("offers"), "create_offer", sample_offer("Pruning", gardening.clone()))
        .await;
    let (request, offer) = (request.action_address().clone(), offer.action_address().clone());

    let to_design = forge_a_link(&conductors[2], &mallory, service_types, REQUEST_TO_SERVICE_TYPE_LINK, &request, &design).await;
    refused(&to_design, "its entry names", "a link from a request to another service type");

    let from_design = forge_a_link(&conductors[2], &mallory, service_types, SERVICE_TYPE_TO_REQUEST_LINK, &design, &request).await;
    refused(&from_design, "its entry names", "a link from another service type to a request");

    let offer_to_design = forge_a_link(&conductors[2], &mallory, service_types, OFFER_TO_SERVICE_TYPE_LINK, &offer, &design).await;
    refused(&offer_to_design, "its entry names", "a link from an offer to another service type");

    let wrong_kind = forge_a_link(&conductors[2], &mallory, service_types, REQUEST_TO_SERVICE_TYPE_LINK, &offer, &gardening).await;
    refused(&wrong_kind, "a listing of that kind", "a request link from an offer");

    let own = forge_a_link(&conductors[2], &mallory, service_types, REQUEST_TO_SERVICE_TYPE_LINK, &request, &gardening).await;
    own.unwrap_or_else(|e| panic!("a link from a request to its own service type should be written; got {e}"));
}

/// A listing is edited by its author, who needs no grant, or by an
/// administrator, whose update carries the admin grant. Anyone else is refused.
#[tokio::test(flavor = "multi_thread")]
async fn a_listing_is_edited_by_its_author_or_an_administrator() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let st = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let record: Record = conductors[1]
        .call(&bob.zome("requests"), "create_request", sample_request("Bob's listing", st.clone()))
        .await;
    let original = record.action_address().clone();
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    // Mallory, neither author nor administrator, past the coordinator.
    let forged = forge_update(&conductors[2], &mallory, &original, a_request("Mallory's edit", None, Some(st.clone()))).await;
    refused(&forged, "needs a grant for Administer", "an edit by a member who is not the author");

    let edit = |title: &str| {
        let mut input = sample_request(title, st.clone());
        input.request.title = title.to_string();
        serde_json::json!({
            "original_action_hash": original,
            "previous_action_hash": original,
            "updated_request": input.request,
            "service_type_hash": st,
            "medium_of_exchange_hashes": [],
        })
    };
    // The author.
    let by_bob: Record = conductors[1]
        .call(&bob.zome("requests"), "update_request", edit("Bob's edit"))
        .await;
    // Alice updates Bob's revision, so it has to have reached her first.
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    // An administrator, with her grant.
    let by_alice: Record = conductors[0]
        .call(
            &alice.zome("requests"),
            "update_request",
            serde_json::json!({
                "original_action_hash": original,
                "previous_action_hash": by_bob.action_address(),
                "updated_request": sample_request("Alice's edit", st.clone()).request,
                "service_type_hash": st,
                "medium_of_exchange_hashes": [],
            }),
        )
        .await;
    let written: Request = by_alice.entry().to_app_option().unwrap().expect("a request");
    assert_eq!(written.title, "Alice's edit");
    assert!(written.grant.is_some(), "the administrator's edit carries her grant");
    let bobs: Request = by_bob.entry().to_app_option().unwrap().expect("a request");
    assert!(bobs.grant.is_none(), "the author's edit carries no grant");
}

/// Approval is what makes an organisation's creator its coordinator: before
/// it the creator cannot act as one, after it they can, and `can` finds the
/// grant. A coordinator of another organisation is refused, past the
/// coordinator, on both the record and the membership link.
#[tokio::test(flavor = "multi_thread")]
async fn approval_makes_the_creator_coordinator_and_only_of_that_organisation() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;

    let org: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_organization", sample_organization("Bob's"))
        .await;
    let org = org.action_address().clone();
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let pair = serde_json::json!({
        "organization_original_action_hash": org,
        "user_original_action_hash": users[2],
    });
    // Pending: Bob is not a coordinator and cannot add a member.
    let before: bool = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "is_organization_coordinator",
            serde_json::json!({
                "organization_original_action_hash": org,
                "user_original_action_hash": users[1],
            }),
        )
        .await;
    assert!(!before, "the creator is not a coordinator while the organisation is pending");
    let early = reason(
        conductors[1]
            .call_fallible::<_, bool>(&bob.zome("users_organizations"), "add_member_to_organization", pair.clone())
            .await,
    );
    assert!(early.is_err(), "a pending organisation's creator cannot add members");

    // Approval.
    accept_entity(&conductors[0], alice, ENTITY_ORGANIZATIONS, org.clone()).await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let after: bool = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "is_organization_coordinator",
            serde_json::json!({
                "organization_original_action_hash": org,
                "user_original_action_hash": users[1],
            }),
        )
        .await;
    assert!(after, "approval makes the creator coordinator");
    let can: Option<ActionHash> = conductors[1]
        .call(
            &bob.zome("administration"),
            "can",
            serde_json::json!({ "agent": bob.agent_pubkey(), "ability": "Coordinate", "scope": org }),
        )
        .await;
    assert!(can.is_some(), "`can` finds the coordinator grant");
    let added: bool = conductors[1]
        .call(&bob.zome("users_organizations"), "add_member_to_organization", pair)
        .await;
    assert!(added);

    // Mallory founds her own organisation and is its coordinator.
    let hers: Record = conductors[2]
        .call(&mallory.zome("users_organizations"), "create_organization", sample_organization("Mallory's"))
        .await;
    let hers = hers.action_address().clone();
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    accept_entity(&conductors[0], alice, ENTITY_ORGANIZATIONS, hers.clone()).await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let her_grant = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "org_coordinator").await;

    // Her grant does not reach Bob's organisation: the record, then the link.
    let mut edit = sample_organization("Bob's, renamed");
    edit.name = "Bob's, renamed".to_string();
    let forged_edit = forge_update(
        &conductors[2],
        &mallory,
        &org,
        Organization {
            name: edit.name,
            description: edit.description,
            full_legal_name: edit.full_legal_name,
            logo: None,
            email: edit.email,
            urls: edit.urls,
            location: edit.location,
            grant: Some(her_grant.clone()),
        },
    )
    .await;
    refused(&forged_edit, "does not cover Coordinate here", "an edit with another organisation's coordinator grant");

    let users_organizations = zome_index(&conductors[2], &mallory, "users_organizations_integrity").await;
    let forged_link = reason(
        conductors[2]
            .call_fallible::<_, ActionHash>(
                &mallory.zome("forge"),
                "forge_link",
                serde_json::json!({
                    "base": org,
                    "target": users[2],
                    "zome_index": users_organizations,
                    "link_type": ORGANIZATION_COORDINATORS_LINK,
                    "tag": her_grant.get_raw_39(),
                }),
            )
            .await,
    );
    refused(&forged_link, "changing an organisation's coordinators is a role act", "a coordinator link with another organisation's grant");

    // Bob's own edit, and Alice's as administrator, go through the coordinator.
    let latest: Option<Record> = conductors[1]
        .call(&bob.zome("users_organizations"), "get_latest_organization_record", org.clone())
        .await;
    let by_alice: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "update_organization",
            serde_json::json!({
                "original_action_hash": org,
                "previous_action_hash": latest.unwrap().action_address(),
                "updated_organization": sample_organization("Bob's, tidied"),
            }),
        )
        .await;
    let written: Organization = by_alice.entry().to_app_option().unwrap().expect("an organisation");
    assert!(written.grant.is_some(), "the administrator's edit carries her grant");
}

/// A status is never deleted, by anyone: the delete is refused by validation.
#[tokio::test(flavor = "multi_thread")]
async fn a_status_is_never_deleted() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;

    let status: Option<Record> = conductors[1]
        .call(
            &mallory.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({ "entity": ENTITY_USERS, "entity_original_action_hash": users[1] }),
        )
        .await;
    let status = status.expect("Mallory has a status").action_address().clone();
    let deleted = reason(
        conductors[1]
            .call_fallible::<_, ActionHash>(&mallory.zome("forge"), "forge_delete", status)
            .await,
    );
    refused(&deleted, "Status cannot be deleted", "deleting a status");
}

/// Removal never undoes a grant: a revoked administrator's grant still
/// validates a forged write, which is a known limit. The app is
/// where removal bites: `can` returns none and the coordinator refuses them.
#[tokio::test(flavor = "multi_thread")]
async fn a_revoked_grant_still_validates_but_the_app_refuses_its_holder() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;

    let mallory_admin = EntityActionHashAgents {
        entity: ENTITY_NETWORK.to_string(),
        entity_original_action_hash: users[1].clone(),
        agent_pubkeys: vec![mallory.agent_pubkey().clone()],
    };
    conductors[0]
        .call::<_, bool>(&alice.zome("administration"), "add_administrator", mallory_admin.clone())
        .await;
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    let admin_grant = grant_for_role(&conductors[1], &mallory, mallory.agent_pubkey(), "admin").await;
    conductors[0]
        .call::<_, bool>(&alice.zome("administration"), "remove_administrator", mallory_admin)
        .await;
    await_consistency_s(15, [alice, &mallory]).await.unwrap();

    let can: Option<ActionHash> = conductors[1]
        .call(
            &mallory.zome("administration"),
            "can",
            serde_json::json!({ "agent": mallory.agent_pubkey(), "ability": "Administer", "scope": null }),
        )
        .await;
    assert!(can.is_none(), "`can` ignores a revoked grant");
    let through_the_app = reason(
        conductors[1]
            .call_fallible::<_, Record>(
                &mallory.zome("service_types"),
                "create_service_type",
                serde_json::json!({ "service_type": { "name": "Lifts", "description": "To the station", "technical": false } }),
            )
            .await,
    );
    assert!(through_the_app.is_err(), "the coordinator refuses a removed administrator");

    // The limit: validation cannot see the revocation.
    let service_types = zome_index(&conductors[1], &mallory, "service_types_integrity").await;
    let forged = forge_entry(
        &conductors[1],
        &mallory,
        service_types,
        SERVICE_TYPE,
        ServiceType {
            name: "Lifts".to_string(),
            description: "forced through after removal".to_string(),
            technical: false,
            grant: Some(admin_grant),
        },
    )
    .await;
    assert!(
        forged.is_ok(),
        "a forged write under a revoked grant still validates; that is the stated limit, caught on read. Got {forged:?}"
    );
}

/// With a progenitor key in the DNA properties, a root grant is the
/// progenitor's signature and nobody else's.
#[tokio::test(flavor = "multi_thread")]
async fn with_a_progenitor_key_a_root_signed_by_someone_else_is_refused() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;

    let body = GrantBody {
        role: "admin".to_string(),
        holder: mallory.agent_pubkey().clone(),
        scope: None,
    };
    let bytes = holochain_serialized_bytes::encode(&body).expect("the body serializes");
    let signature = conductors[1]
        .keystore()
        .sign(mallory.agent_pubkey().clone(), bytes.into())
        .await
        .expect("Mallory signs with her own key");
    let forged = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: body.role,
            holder: body.holder,
            scope: body.scope,
            authority: Authority::Progenitor { signature },
        },
    )
    .await;
    refused(&forged, "not signed by the progenitor key", "a root grant Mallory signed herself");

    // Alice's own root, written at bootstrap, is what everything rests on.
    let alices = grants_of(&conductors[0], alice, alice.agent_pubkey()).await;
    assert!(
        alices.iter().any(|(_, g)| g.role == "admin" && matches!(g.authority, Authority::Progenitor { .. })),
        "the progenitor's admin grant rests on her signature; got {alices:?}"
    );
}

/// With no key configured, as in development, the root is accepted: the
/// properties are part of the DNA hash, so this is a different network from
/// any that has a key.
#[tokio::test(flavor = "multi_thread")]
async fn without_a_progenitor_key_the_root_is_accepted() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, false).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;

    let forged = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "admin".to_string(),
            holder: mallory.agent_pubkey().clone(),
            scope: None,
            authority: Authority::Progenitor {
                signature: Signature([0; 64]),
            },
        },
    )
    .await;
    assert!(forged.is_ok(), "without a key the root is accepted; got {forged:?}");
}

/// A network without the stewarding module has no steward role. Mallory
/// holds an admin grant, which may grant steward on a network that has the
/// module, and forges a steward grant resting on it: refused, because this DNA
/// has no `stewarding_integrity` zome.
#[tokio::test(flavor = "multi_thread")]
async fn without_stewarding_a_steward_grant_is_refused() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, false).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;

    // With no progenitor key the root is accepted, so Mallory's admin grant stands.
    let admin = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "admin".to_string(),
            holder: mallory.agent_pubkey().clone(),
            scope: None,
            authority: Authority::Progenitor {
                signature: Signature([0; 64]),
            },
        },
    )
    .await
    .expect("without a key Mallory's root admin grant is accepted");

    let steward = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "steward".to_string(),
            holder: mallory.agent_pubkey().clone(),
            scope: None,
            authority: Authority::Grant(admin),
        },
    )
    .await;
    refused(
        &steward,
        "needs the stewarding module",
        "a steward grant on a network without stewarding",
    );
}
