//! Every link type has a rule (#234), at the validation level.
//!
//! Mallory runs a modified client: her conductor carries the `forge` zome,
//! which writes links by type index past every coordinator rule. The
//! integrity zomes are the same as everyone else's, so a link her own
//! conductor refuses never reaches the network. Each case names, in its doc
//! comment, the change that makes it go red. Each case runs alone, one per
//! process.

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

/// Everyone creates a profile; Alice, the progenitor, is the administrator
/// and accepts everyone. Returns each agent's user hash in conductor order.
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

async fn zome_index(conductor: &SweetConductor, mallory: &SweetCell, name: &str) -> u8 {
    let names: Vec<String> = conductor
        .call(&mallory.zome("forge"), "integrity_zome_names", ())
        .await;
    names
        .iter()
        .position(|n| n == name)
        .unwrap_or_else(|| panic!("{name} is not an integrity zome; got {names:?}")) as u8
}

async fn path_hash(conductor: &SweetConductor, mallory: &SweetCell, path: &str) -> EntryHash {
    conductor
        .call(&mallory.zome("forge"), "forge_path_hash", path.to_string())
        .await
}

/// Mallory's member grant, read from her own grants.
async fn member_grant(conductor: &SweetConductor, cell: &SweetCell) -> ActionHash {
    let records: Vec<Record> = conductor
        .call(&cell.zome("administration"), "get_agent_grants", cell.agent_pubkey().clone())
        .await;
    records
        .into_iter()
        .find(|r| {
            let grant: RoleGrant = r.entry().to_app_option().unwrap().expect("a grant entry");
            grant.role == "member"
        })
        .expect("an accepted member holds a member grant")
        .action_address()
        .clone()
}

fn reason<T, E: std::fmt::Debug>(outcome: Result<T, E>) -> Result<T, String> {
    outcome.map_err(|e| format!("{e:?}"))
}

async fn forge_link(
    conductor: &SweetConductor,
    mallory: &SweetCell,
    base: AnyLinkableHash,
    target: AnyLinkableHash,
    zome_index: u8,
    link_type: u8,
    tag: Vec<u8>,
) -> Result<ActionHash, String> {
    reason(
        conductor
            .call_fallible::<_, ActionHash>(
                &mallory.zome("forge"),
                "forge_link",
                serde_json::json!({
                    "base": base,
                    "target": target,
                    "zome_index": zome_index,
                    "link_type": link_type,
                    "tag": tag,
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

async fn forge_tombstone(conductor: &SweetConductor, mallory: &SweetCell, hash: ActionHash) -> Result<ActionHash, String> {
    reason(
        conductor
            .call_fallible::<_, ActionHash>(&mallory.zome("forge"), "forge_delete", hash)
            .await,
    )
}

/// Mirror of `ServiceTypeStatus` in `service_types_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServiceTypeStatus {
    service_type: ActionHash,
    state: String,
    grant: Option<ActionHash>,
}
holochain_serialized_bytes::holochain_serial!(ServiceTypeStatus);

/// `ServiceTypeStatus` is the second entry type of `service_types_integrity`.
const SERVICE_TYPE_STATUS: u8 = 1;

// ── Link type indexes, from the integrity zomes' enums ──────────────────────

/// `users_organizations_integrity::LinkTypes`.
const ALL_USERS: u8 = 1;
const MY_USER: u8 = 2;
/// `offers_integrity::LinkTypes`.
const ALL_OFFERS: u8 = 1;
/// `service_types_integrity::LinkTypes`.
const ALL_SERVICE_TYPES: u8 = 1;
const USER_TO_SERVICE_TYPE: u8 = 7;

// ── Cases ───────────────────────────────────────────────────────────────────

/// A service type is approved when the approved status path links to it, and
/// readers trust that link. Mallory, an accepted member, suggests one and
/// then tries to approve it herself, past the coordinator: with an empty tag,
/// and with her own member grant in the tag. Both are refused. Alice, the
/// administrator, approves it through the app, and it is approved.
///
/// Red: in `service_types_integrity/src/links.rs`, return `Valid` for the
/// approved path instead of checking the grant in the tag.
#[tokio::test(flavor = "multi_thread")]
async fn an_approval_names_an_administrators_grant() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;

    let suggestion: Record = conductors[1]
        .call(&mallory.zome("service_types"), "suggest_service_type", sample_service_type("Mallory's"))
        .await;
    let suggestion = suggestion.action_address().clone();
    let service_types = zome_index(&conductors[1], &mallory, "service_types_integrity").await;
    let approved = path_hash(&conductors[1], &mallory, "service_types.status.approved").await;

    let no_grant = forge_link(
        &conductors[1],
        &mallory,
        approved.clone().into(),
        suggestion.clone().into(),
        service_types,
        ALL_SERVICE_TYPES,
        vec![],
    )
    .await;
    refused(&no_grant, "does not carry a grant", "an approval link with no grant");

    let hers = member_grant(&conductors[1], &mallory).await;
    let member_grant = forge_link(
        &conductors[1],
        &mallory,
        approved.into(),
        suggestion.clone().into(),
        service_types,
        ALL_SERVICE_TYPES,
        hers.get_raw_39().to_vec(),
    )
    .await;
    refused(&member_grant, "does not cover Administer", "an approval link with a member's grant");

    await_consistency_s(30, [alice, &mallory]).await.unwrap();
    let _: () = conductors[0]
        .call(&alice.zome("service_types"), "approve_service_type", suggestion.clone())
        .await;
    await_consistency_s(30, [alice, &mallory]).await.unwrap();
    let is_approved: bool = conductors[0]
        .call(&alice.zome("service_types"), "is_service_type_approved", suggestion)
        .await;
    assert!(is_approved, "the administrator's approval, with her grant, is written");
}

/// A link's base, target and tag are what its type declares. Mallory writes
/// an `AllUsers` link with text in its tag, one whose base is not the
/// `users` path, and one whose target is a service type rather than a user;
/// and an `AllOffers` link, a type nothing writes. All refused.
///
/// Red: in `utils/src/links.rs`, make `check_empty_tag` return `Ok(())`, or
/// `check_end` accept any end.
#[tokio::test(flavor = "multi_thread")]
async fn a_link_has_the_shape_its_type_declares() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let hers = users[1].clone();
    let users_organizations = zome_index(&conductors[1], &mallory, "users_organizations_integrity").await;
    let offers = zome_index(&conductors[1], &mallory, "offers_integrity").await;
    let users_path = path_hash(&conductors[1], &mallory, "users").await;

    let with_text = forge_link(
        &conductors[1],
        &mallory,
        users_path.clone().into(),
        hers.clone().into(),
        users_organizations,
        ALL_USERS,
        b"meet at the usual place".to_vec(),
    )
    .await;
    refused(&with_text, "tag must be empty", "a link carrying text in its tag");

    let wrong_base = forge_link(
        &conductors[1],
        &mallory,
        hers.clone().into(),
        hers.clone().into(),
        users_organizations,
        ALL_USERS,
        vec![],
    )
    .await;
    refused(&wrong_base, "must be one of its named paths", "an AllUsers link from a record");

    let offers_path = path_hash(&conductors[1], &mallory, "offers").await;
    let wrong_path = forge_link(
        &conductors[1],
        &mallory,
        offers_path.clone().into(),
        hers.clone().into(),
        users_organizations,
        ALL_USERS,
        vec![],
    )
    .await;
    refused(&wrong_path, "must be one of: users", "an AllUsers link from another path");

    let suggestion: Record = conductors[1]
        .call(&mallory.zome("service_types"), "suggest_service_type", sample_service_type("Not a user"))
        .await;
    let wrong_target = forge_link(
        &conductors[1],
        &mallory,
        users_path.into(),
        suggestion.action_address().clone().into(),
        users_organizations,
        ALL_USERS,
        vec![],
    )
    .await;
    refused(&wrong_target, "must be a user", "an AllUsers link to a service type");

    let unused = forge_link(
        &conductors[1],
        &mallory,
        offers_path.into(),
        hers.clone().into(),
        offers,
        ALL_OFFERS,
        vec![],
    )
    .await;
    refused(&unused, "nothing writes this link type", "an AllOffers link");

    // Closed after Aria's read: nothing writes a user's link to a service type.
    let service_types = zome_index(&conductors[1], &mallory, "service_types_integrity").await;
    let skill = forge_link(
        &conductors[1],
        &mallory,
        hers.clone().into(),
        suggestion.action_address().clone().into(),
        service_types,
        USER_TO_SERVICE_TYPE,
        vec![],
    )
    .await;
    refused(&skill, "nothing writes this link type", "a UserToServiceType link");
}

/// A link that hangs from a record is written by that record's author.
/// Mallory links her own agent key to Alice's user as `MyUser`, and lists
/// Alice's user under the `users` path as `AllUsers`. Both refused. Her own
/// `MyUser` link, written when she registered, stands.
///
/// Red: in `users_organizations_integrity/src/links.rs`, make `MyUser` and
/// `AllUsers` `Writer::Open`.
#[tokio::test(flavor = "multi_thread")]
async fn a_link_hangs_from_its_authors_record() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let alices = users[0].clone();
    let users_organizations = zome_index(&conductors[1], &mallory, "users_organizations_integrity").await;

    let my_user = forge_link(
        &conductors[1],
        &mallory,
        mallory.agent_pubkey().clone().into(),
        alices.clone().into(),
        users_organizations,
        MY_USER,
        vec![],
    )
    .await;
    refused(&my_user, "only the author of the link's target", "Mallory claiming Alice's profile as hers");

    let users_path = path_hash(&conductors[1], &mallory, "users").await;
    let all_users = forge_link(
        &conductors[1],
        &mallory,
        users_path.into(),
        alices.into(),
        users_organizations,
        ALL_USERS,
        vec![],
    )
    .await;
    refused(&all_users, "only the author of the link's target", "Mallory listing Alice's profile");

    let hers: Vec<Link> = conductors[1]
        .call(
            &mallory.zome("forge"),
            "forge_get_links",
            serde_json::json!({
                "base": AnyLinkableHash::from(mallory.agent_pubkey().clone()),
                "zome_index": users_organizations,
                "link_type": MY_USER,
            }),
        )
        .await;
    assert_eq!(hers.len(), 1, "Mallory's own MyUser link, written at registration, stands");
}

/// A link type that nothing tombstones refuses every tombstone, even from
/// the link's own author. Mallory tries to tombstone her own `MyUser` link.
/// Refused.
///
/// Red: in `users_organizations_integrity/src/links.rs`, make `MyUser`
/// `Tombstone::Author`.
#[tokio::test(flavor = "multi_thread")]
async fn a_link_nothing_tombstones_is_never_tombstoned() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let users_organizations = zome_index(&conductors[1], &mallory, "users_organizations_integrity").await;

    let hers: Vec<Link> = conductors[1]
        .call(
            &mallory.zome("forge"),
            "forge_get_links",
            serde_json::json!({
                "base": AnyLinkableHash::from(mallory.agent_pubkey().clone()),
                "zome_index": users_organizations,
                "link_type": MY_USER,
            }),
        )
        .await;
    let link = hers.first().expect("Mallory's MyUser link").create_link_hash.clone();

    let tombstone = reason(
        conductors[1]
            .call_fallible::<_, ActionHash>(&mallory.zome("forge"), "forge_delete_link", link)
            .await,
    );
    refused(&tombstone, "never tombstoned", "a tombstone of a MyUser link");
}

/// A decision on a service type is a status entry that carries an
/// administrator's grant. Mallory forges one approving her own suggestion,
/// with no grant and with her member grant. Both refused, and the suggestion
/// stays pending.
///
/// Red: in `utils/src/links.rs`, make `check_catalogue_status` return `Valid`
/// without `check_act`.
#[tokio::test(flavor = "multi_thread")]
async fn a_decision_needs_an_administrators_grant() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let suggestion: Record = conductors[1]
        .call(&mallory.zome("service_types"), "suggest_service_type", sample_service_type("Mallory's"))
        .await;
    let suggestion = suggestion.action_address().clone();
    let service_types = zome_index(&conductors[1], &mallory, "service_types_integrity").await;
    let hers = member_grant(&conductors[1], &mallory).await;

    for (grant, what) in [(None, "no grant"), (Some(hers), "a member's grant")] {
        let forged = forge_entry(
            &conductors[1],
            &mallory,
            service_types,
            SERVICE_TYPE_STATUS,
            ServiceTypeStatus { service_type: suggestion.clone(), state: "Approved".into(), grant },
        )
        .await;
        refused(&forged, "is a role act", &format!("an approval with {what}"));
    }

    let state: String = conductors[1]
        .call(&mallory.zome("service_types"), "get_service_type_status", suggestion)
        .await;
    assert_eq!(state, "pending");
}

/// A service type is shared, so nobody tombstones it, not even its author.
/// Mallory tries to tombstone her own suggestion: refused. Alice, the
/// administrator, retires it through its status instead: it reads as
/// retired and leaves the pending list.
///
/// Red: in `service_types_integrity/src/lib.rs`, return `Valid` from both
/// the `DeleteEntry` arm and the `FlatOp::Delete` arm for a service type. A
/// tombstone is refused if either of its ops is, so either arm alone stays
/// green.
#[tokio::test(flavor = "multi_thread")]
async fn a_shared_item_is_retired_never_tombstoned() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let suggestion: Record = conductors[1]
        .call(&mallory.zome("service_types"), "suggest_service_type", sample_service_type("Mallory's"))
        .await;
    let suggestion = suggestion.action_address().clone();

    let tombstone = forge_tombstone(&conductors[1], &mallory, suggestion.clone()).await;
    refused(&tombstone, "never tombstoned", "a tombstone of a service type by its own author");

    await_consistency_s(30, [alice, &mallory]).await.unwrap();
    let _: ActionHash = conductors[0]
        .call(&alice.zome("service_types"), "delete_service_type", suggestion.clone())
        .await;
    await_consistency_s(30, [alice, &mallory]).await.unwrap();
    let state: String = conductors[0]
        .call(&alice.zome("service_types"), "get_service_type_status", suggestion.clone())
        .await;
    assert_eq!(state, "retired");
    let pending: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_pending_service_types", ())
        .await;
    assert!(!pending.iter().any(|r| r.action_address() == &suggestion), "a retired service type leaves the pending list");
}

/// A request is tombstoned only by its creator. Mallory tries to tombstone
/// Alice's: refused. Alice tombstones her own.
///
/// Red: in `requests_integrity/src/lib.rs`, return `Valid` instead of
/// `check_creator_tombstone`.
#[tokio::test(flavor = "multi_thread")]
async fn only_a_listings_creator_tombstones_it() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let gardening = a_service_type(&conductors[0], alice, "Gardening").await;
    let request: Record = conductors[0]
        .call(&alice.zome("requests"), "create_request", sample_request("Alice's", gardening))
        .await;
    let request = request.action_address().clone();
    await_consistency_s(30, [alice, &mallory]).await.unwrap();

    let tombstone = forge_tombstone(&conductors[1], &mallory, request.clone()).await;
    refused(&tombstone, "only a request's creator tombstones it", "Mallory tombstoning Alice's request");

    let _: bool = conductors[0]
        .call(&alice.zome("requests"), "delete_request", request.clone())
        .await;
    await_consistency_s(30, [alice, &mallory]).await.unwrap();
    let gone: Option<Record> = conductors[1]
        .call(&mallory.zome("requests"), "get_latest_request_record", request)
        .await;
    assert!(gone.is_none(), "the creator's own tombstone is written");
}
