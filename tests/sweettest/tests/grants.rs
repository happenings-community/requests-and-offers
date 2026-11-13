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

fn a_request(title: &str, grant: Option<ActionHash>) -> Request {
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
    }
}

fn an_offer(title: &str, grant: Option<ActionHash>) -> Offer {
    Offer {
        title: title.to_string(),
        description: "forged past the coordinator".to_string(),
        time_preference: "Morning".to_string(),
        time_zone: None,
        interaction_type: "Virtual".to_string(),
        links: vec![],
        status: "Active".to_string(),
        grant,
    }
}

/// Mirror of `EncryptedMessage` from `messaging_integrity`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct EncryptedMessage {
    encrypted: XSalsa20Poly1305EncryptedData,
    #[serde(default)]
    grant: Option<ActionHash>,
}
holochain_serialized_bytes::holochain_serial!(EncryptedMessage);

/// Mirror of the messaging coordinator's `SendMessageInput`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SendMessageInput {
    to_user: ActionHash,
    content: String,
}

/// Mirror of the messaging coordinator's `SentMessage`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SentMessage {
    agent: AgentPubKey,
    hash: ActionHash,
}

/// Mirror of `Interest` from `exchanges_integrity`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct Interest {
    listing: ActionHash,
    listing_type: String,
    user: ActionHash,
    grant: Option<ActionHash>,
}
holochain_serialized_bytes::holochain_serial!(Interest);

/// Mirror of `MediumOfExchange` from `mediums_of_exchange_integrity`, with the
/// grant field a forged update has to carry.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct MediumWithGrant {
    code: String,
    name: String,
    description: Option<String>,
    exchange_type: String,
    resource_spec_hrea_id: Option<String>,
    grant: Option<ActionHash>,
}
holochain_serialized_bytes::holochain_serial!(MediumWithGrant);

/// An organisation and one of its people, as the membership calls take them.
fn pair(organization: &ActionHash, user: &ActionHash) -> serde_json::Value {
    serde_json::json!({
        "organization_original_action_hash": organization,
        "user_original_action_hash": user,
    })
}

/// Whether the coordinator link names this user, as the interface asks it.
async fn is_coordinator(
    conductor: &SweetConductor,
    cell: &SweetCell,
    organization: &ActionHash,
    user: &ActionHash,
) -> bool {
    conductor
        .call(
            &cell.zome("users_organizations"),
            "is_organization_coordinator",
            pair(organization, user),
        )
        .await
}

/// The grant that lets `agent` do something to an organisation, or none.
async fn grant_over(
    conductor: &SweetConductor,
    cell: &SweetCell,
    agent: &AgentPubKey,
    ability: &str,
    organization: &ActionHash,
) -> Option<ActionHash> {
    conductor
        .call(
            &cell.zome("administration"),
            "can",
            serde_json::json!({ "agent": agent, "ability": ability, "scope": organization }),
        )
        .await
}

/// An administrator moves an organisation to a status, from whatever it holds now.
async fn set_organization_status(
    conductor: &SweetConductor,
    admin: &SweetCell,
    organization: &ActionHash,
    status_type: &str,
    reason: Option<&str>,
) {
    let latest: Option<Record> = conductor
        .call(
            &admin.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({
                "entity": ENTITY_ORGANIZATIONS,
                "entity_original_action_hash": organization,
            }),
        )
        .await;
    let latest = latest.expect("the organisation has a status").action_address().clone();
    let _: Record = conductor
        .call(
            &admin.zome("administration"),
            "update_entity_status",
            serde_json::json!({
                "entity": ENTITY_ORGANIZATIONS,
                "entity_original_action_hash": organization,
                "status_original_action_hash": latest,
                "status_previous_action_hash": latest,
                "new_status": {
                    "status_type": status_type,
                    "reason": reason,
                    "suspended_until": null
                }
            }),
        )
        .await;
}

/// `delete_organization` through the app, with the refusal as text.
async fn delete_organization(
    conductor: &SweetConductor,
    cell: &SweetCell,
    organization: &ActionHash,
) -> Result<ActionHash, String> {
    reason(
        conductor
            .call_fallible(
                &cell.zome("users_organizations"),
                "delete_organization",
                organization.clone(),
            )
            .await,
    )
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

async fn forge_delete_link(
    conductor: &SweetConductor,
    mallory: &SweetCell,
    create_link_hash: ActionHash,
) -> Result<ActionHash, String> {
    reason(
        conductor
            .call_fallible::<_, ActionHash>(&mallory.zome("forge"), "forge_delete_link", create_link_hash)
            .await,
    )
}

/// The links of one type from a base, read through the forge.
async fn links_of(
    conductor: &SweetConductor,
    mallory: &SweetCell,
    base: AnyLinkableHash,
    zome_index: u8,
    link_type: u8,
) -> Vec<Link> {
    conductor
        .call(
            &mallory.zome("forge"),
            "forge_get_links",
            serde_json::json!({ "base": base, "zome_index": zome_index, "link_type": link_type }),
        )
        .await
}

/// Mallory's latest status record.
async fn status_of(conductor: &SweetConductor, cell: &SweetCell, user: &ActionHash) -> Record {
    let status: Option<Record> = conductor
        .call(
            &cell.zome("administration"),
            "get_latest_status_record_for_entity",
            serde_json::json!({ "entity": ENTITY_USERS, "entity_original_action_hash": user }),
        )
        .await;
    status.expect("the user has a status")
}

/// A link of any type, with any tag, written past the coordinator.
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
            .call_fallible(
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

/// The app's one permission question, as any honest node asks it: the grant
/// that lets `agent` administer the network, or none.
async fn admin_grant_of(
    conductor: &SweetConductor,
    cell: &SweetCell,
    agent: &AgentPubKey,
) -> Option<ActionHash> {
    conductor
        .call(
            &cell.zome("administration"),
            "can",
            serde_json::json!({ "agent": agent, "ability": "Administer", "scope": null }),
        )
        .await
}

/// A `Status` with one field too many. It decodes as a `Status` (serde ignores
/// the extra key) and, read by anything that does not check the entry type, as
/// a `RoleRevocation { grant, authority, reason }` as well.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct StatusShapedLikeARevocation {
    status_type: String,
    reason: Option<String>,
    suspended_until: Option<String>,
    grant: Option<ActionHash>,
    authority: ActionHash,
}
holochain_serialized_bytes::holochain_serial!(StatusShapedLikeARevocation);

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

/// `Status`, the first entry type of `administration_integrity`.
const STATUS: u8 = 0;
const REQUEST: u8 = 0;
const OFFER: u8 = 0;
const ENCRYPTED_MESSAGE: u8 = 0;
/// `Inbox` in `messaging_integrity::LinkTypes`.
const INBOX_LINK: u8 = 0;
/// `Interest`, the first entry type of `exchanges_integrity`.
const INTEREST: u8 = 0;
/// `UserUpdates` and `OrganizationUpdates` in `users_organizations_integrity::LinkTypes`.
const USER_UPDATES_LINK: u8 = 0;
const ORGANIZATION_UPDATES_LINK: u8 = 6;
/// `OrganizationMembers`, after `OrganizationCoordinators`.
const ORGANIZATION_MEMBERS_LINK: u8 = 9;
const SERVICE_TYPE: u8 = 0;
/// After `Status`: `utils::grants::ROLE_GRANT_ENTRY_INDEX`.
const ROLE_GRANT: u8 = 1;
/// `OrganizationCoordinators` in `users_organizations_integrity::LinkTypes`.
const ORGANIZATION_COORDINATORS_LINK: u8 = 8;
/// `AgentAdministrators` in `administration_integrity::LinkTypes`.
const AGENT_ADMINISTRATORS_LINK: u8 = 1;
/// `AllGrants`, between `AgentGrants` and `GrantRevocations`.
const ALL_GRANTS_LINK: u8 = 7;
/// `AgentGrants` and `GrantRevocations` in `administration_integrity::LinkTypes`.
const AGENT_GRANTS_LINK: u8 = 6;
const GRANT_REVOCATIONS_LINK: u8 = 8;

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
    let no_grant = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("no grant", None)).await;
    refused(&no_grant, "needs a grant for Participate", "a listing with no grant");

    // Someone else's grant.
    let bobs = grant_for_role(&conductors[1], bob, bob.agent_pubkey(), "member").await;
    let borrowed = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("borrowed", Some(bobs))).await;
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
    let wrong_role = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("as admin", Some(admin))).await;
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

    // The honest write: her own member grant.
    let honest = forge_entry(&conductors[2], &mallory, requests, REQUEST, a_request("honest", Some(mine))).await;
    let hash = honest.unwrap_or_else(|e| panic!("a listing with its author's member grant should be written; got {e}"));
    await_consistency_s(30, [alice, bob, &mallory]).await.unwrap();
    let read: Option<Record> = conductors[0]
        .call(&alice.zome("requests"), "get_request", hash)
        .await;
    assert!(read.is_some(), "Alice should read the listing Mallory wrote with her grant");
}

/// A message carries the member grant its author holds, so an agent who was
/// never accepted cannot use the network to carry messages.
///
/// Mallory applies and is not accepted. The coordinator refuses her; past it,
/// she replays the ciphertext of a real message Bob sent, under her own name,
/// with no grant and then with Bob's. Both are refused, so neither is
/// published and no `Inbox` link can point at them. Once Alice accepts her,
/// her own grant carries a forged message and its `Inbox` link, and the
/// coordinator sends for her, filling the grant in itself.
///
/// **To make this go red:** in `messaging_integrity/src/message.rs`, return
/// `Valid` from `validate_encrypted_message` after the size rule. Both
/// forgeries are then written. Leaving the grant out of `deliver` in the
/// coordinator instead fails the last step, and every honest send in the
/// messaging suites.
#[tokio::test(flavor = "multi_thread")]
async fn a_message_carries_the_member_grant_its_author_holds() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob]).await;
    conductors[2]
        .call::<_, Record>(
            &mallory.zome("users_organizations"),
            "create_user",
            sample_user("Mallory"),
        )
        .await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let mallorys_user = user_of(&conductors[2], &mallory).await;
    let messaging = zome_index(&conductors[2], &mallory, "messaging_integrity").await;

    // The coordinator refuses an applicant first, with the clearer error.
    let through_the_app: Result<Vec<SentMessage>, String> = reason(
        conductors[2]
            .call_fallible(
                &mallory.zome("messaging"),
                "send_message",
                SendMessageInput {
                    to_user: users[1].clone(),
                    content: "let me in".to_string(),
                },
            )
            .await,
    );
    match through_the_app {
        Ok(sent) => panic!("an applicant's message should be refused, but was sent as {sent:?}"),
        Err(text) => assert!(
            text.contains("not accepted yet"),
            "an applicant's message should be refused as not accepted; got {text}"
        ),
    }

    // A real ciphertext to replay: Bob writes to Alice through the app.
    let sent: Vec<SentMessage> = conductors[1]
        .call(
            &bob.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: users[0].clone(),
                content: "the kettle is on".to_string(),
            },
        )
        .await;
    await_consistency_s(30, [alice, bob, &mallory]).await.unwrap();
    let bobs_record: Option<Record> = conductors[2]
        .call(&mallory.zome("forge"), "forge_get", sent[0].hash.clone())
        .await;
    let bobs_message: EncryptedMessage = bobs_record
        .expect("Mallory should see the message Bob sent")
        .entry()
        .to_app_option()
        .unwrap()
        .expect("an EncryptedMessage entry");
    assert!(bobs_message.grant.is_some(), "Bob's message should carry his member grant");
    let replay = |grant: Option<ActionHash>| EncryptedMessage {
        encrypted: bobs_message.encrypted.clone(),
        grant,
    };

    // No grant.
    let no_grant = forge_entry(&conductors[2], &mallory, messaging, ENCRYPTED_MESSAGE, replay(None)).await;
    refused(&no_grant, "needs a grant for Participate", "an applicant's message with no grant");

    // Bob's grant, copied from his own message.
    let borrowed = forge_entry(&conductors[2], &mallory, messaging, ENCRYPTED_MESSAGE, replay(bobs_message.grant.clone())).await;
    refused(&borrowed, "held by someone else", "an applicant's message with Bob's grant");

    // Accepted, her own grant carries a message and its Inbox link.
    accept_entity(&conductors[0], alice, ENTITY_USERS, mallorys_user).await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let mine = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "member").await;
    let honest = forge_entry(&conductors[2], &mallory, messaging, ENCRYPTED_MESSAGE, replay(Some(mine))).await;
    let hash = honest.unwrap_or_else(|e| panic!("a member's message with her own grant should be written; got {e}"));
    let link = reason(
        conductors[2]
            .call_fallible::<_, ActionHash>(
                &mallory.zome("forge"),
                "forge_link",
                serde_json::json!({
                    "base": AnyLinkableHash::from(bob.agent_pubkey().clone()),
                    "target": AnyLinkableHash::from(hash),
                    "zome_index": messaging,
                    "link_type": INBOX_LINK,
                    "tag": Vec::<u8>::new(),
                }),
            )
            .await,
    );
    link.unwrap_or_else(|e| panic!("an Inbox link to a member's own message should be written; got {e}"));

    // And the coordinator fills the grant in for her.
    let sent: Vec<SentMessage> = conductors[2]
        .call(
            &mallory.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: users[1].clone(),
                content: "thanks for having me".to_string(),
            },
        )
        .await;
    assert!(!sent.is_empty(), "an accepted member's message should be sent through the app");
}

/// A listing is edited by its author, who needs no grant, or by an
/// administrator, whose update carries the admin grant. Anyone else is refused.
///
/// **To make this go red:** make `validate_request_grant` in
/// `requests_integrity/src/request.rs` return `Valid` for an update. Mallory's
/// forged edit is then written.
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
    let forged = forge_update(&conductors[2], &mallory, &original, a_request("Mallory's edit", None)).await;
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
/// coordinator, on both the record and the membership links. At the end an
/// administrator revokes the creator's grant on its own, leaving the link, and
/// gives it back through the same call that adds a coordinator.
///
/// **To make this go red:** in `users_organizations_integrity`, make
/// `validate_organization_write` return `Valid` for an update (the forged edit
/// is written), or make `validate_create_link_organization_membership` return
/// `Valid` before it reads the tag (the forged links are). In the coordinator,
/// drop `require_coordinate` from `add_member_to_organization`: the pending
/// creator is then refused for the organisation's status, not for the role.
/// Or let `register_approved_coordinator` take a coordinator's grant: Bob's
/// direct call then writes the links.
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

    let mallory_as_member = serde_json::json!({
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
            .call_fallible::<_, bool>(&bob.zome("users_organizations"), "add_member_to_organization", mallory_as_member.clone())
            .await,
    );
    match early {
        Ok(_) => panic!("a pending organisation's creator should not be able to add members"),
        Err(text) => assert!(
            text.contains("Not a coordinator"),
            "a pending organisation's creator should be refused as not a coordinator; got {text}"
        ),
    }

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

    // The call that writes an approval's links is the approver's. A coordinator
    // adds people through the calls that check the user and write the grant.
    let direct = reason(
        conductors[1]
            .call_fallible::<_, bool>(
                &bob.zome("users_organizations"),
                "register_approved_coordinator",
                serde_json::json!({
                    "organization_original_action_hash": org,
                    "user_original_action_hash": users[2],
                }),
            )
            .await,
    );
    match direct {
        Ok(_) => panic!("a coordinator should not be able to write an approval's links"),
        Err(text) => assert!(
            text.contains("Unauthorized"),
            "a coordinator writing an approval's links should be refused as unauthorized; got {text}"
        ),
    }
    let added: bool = conductors[1]
        .call(&bob.zome("users_organizations"), "add_member_to_organization", mallory_as_member)
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

    // The member link runs the same rule.
    let forged_member = forge_link(
        &conductors[2],
        &mallory,
        org.clone().into(),
        users[2].clone().into(),
        users_organizations,
        ORGANIZATION_MEMBERS_LINK,
        her_grant.get_raw_39().to_vec(),
    )
    .await;
    refused(&forged_member, "changing an organisation's members is a role act", "a member link with another organisation's grant");

    // A coordinator link starts at an organisation.
    let from_a_user = forge_link(
        &conductors[2],
        &mallory,
        users[2].clone().into(),
        users[2].clone().into(),
        users_organizations,
        ORGANIZATION_COORDINATORS_LINK,
        her_grant.get_raw_39().to_vec(),
    )
    .await;
    refused(&from_a_user, "a link to an organisation's coordinators starts at the organisation", "a coordinator link that starts at a user");

    // Her grant is good for her own organisation, and a coordinator link there
    // still has to point at a user.
    let not_a_user = reason(
        conductors[2]
            .call_fallible::<_, ActionHash>(
                &mallory.zome("forge"),
                "forge_link",
                serde_json::json!({
                    "base": hers,
                    "target": org,
                    "zome_index": users_organizations,
                    "link_type": ORGANIZATION_COORDINATORS_LINK,
                    "tag": her_grant.get_raw_39(),
                }),
            )
            .await,
    );
    refused(&not_a_user, "a link to an organisation's coordinators points at a user", "a coordinator link that points at an organisation");

    // Bob's own edit, now that it is approved, carries his coordinator grant.
    let by_bob: Record = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "update_organization",
            serde_json::json!({
                "original_action_hash": org,
                "previous_action_hash": org,
                "updated_organization": sample_organization("Bob's, by Bob"),
            }),
        )
        .await;
    let bobs: Organization = by_bob.entry().to_app_option().unwrap().expect("an organisation");
    let bobs_grant = grant_for_role(&conductors[1], bob, bob.agent_pubkey(), "org_coordinator").await;
    assert_eq!(
        bobs.grant,
        Some(bobs_grant.clone()),
        "after approval the creator's edit carries his coordinator grant"
    );
    // Alice updates Bob's revision, so it has to have reached her first.
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let by_alice: Record = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "update_organization",
            serde_json::json!({
                "original_action_hash": org,
                "previous_action_hash": by_bob.action_address(),
                "updated_organization": sample_organization("Bob's, tidied"),
            }),
        )
        .await;
    let written: Organization = by_alice.entry().to_app_option().unwrap().expect("an organisation");
    assert!(written.grant.is_some(), "the administrator's edit carries her grant");

    // Alice revokes Bob's coordinator grant on its own. His coordinator link
    // stays, so he is still listed, and holds no grant.
    let _: ActionHash = conductors[0]
        .call(
            &alice.zome("administration"),
            "revoke_role",
            serde_json::json!({ "grant": bobs_grant, "reason": "revoked on its own" }),
        )
        .await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    assert!(is_coordinator(&conductors[1], bob, &org, &users[1]).await);
    assert!(
        grant_over(&conductors[1], bob, bob.agent_pubkey(), "Dissolve", &org)
            .await
            .is_none(),
        "the revoked grant no longer answers"
    );
    // Adding him again writes the grant back and leaves the link alone.
    let restored: bool = conductors[0]
        .call(
            &alice.zome("users_organizations"),
            "add_coordinator_to_organization",
            pair(&org, &users[1]),
        )
        .await;
    assert!(restored);
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    assert!(
        grant_over(&conductors[1], bob, bob.agent_pubkey(), "Dissolve", &org)
            .await
            .is_some(),
        "a listed coordinator with no grant gets one back"
    );
    let again = reason(
        conductors[0]
            .call_fallible::<_, bool>(
                &alice.zome("users_organizations"),
                "add_coordinator_to_organization",
                pair(&org, &users[1]),
            )
            .await,
    );
    match again {
        Ok(_) => panic!("adding a coordinator who holds the grant and the link should be refused"),
        Err(text) => assert!(
            text.contains("Already a coordinator"),
            "adding a coordinator twice should be refused as already one; got {text}"
        ),
    }
}

/// An offer carries the member grant its author holds, as a request does.
///
/// `offers_integrity` runs the same rule as `requests_integrity`; this is the
/// forged write that shows it, so the two listing types cannot drift apart.
///
/// **To make this go red:** make `validate_offer_grant` in
/// `offers_integrity/src/offer.rs` return `Valid` for a create (both forged
/// creates are then written) or for an update (the forged edit is).
#[tokio::test(flavor = "multi_thread")]
async fn an_offer_carries_the_member_grant_its_author_holds() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let offers = zome_index(&conductors[2], &mallory, "offers_integrity").await;

    let no_grant = forge_entry(&conductors[2], &mallory, offers, OFFER, an_offer("no grant", None)).await;
    refused(&no_grant, "needs a grant for Participate", "an offer with no grant");

    let bobs = grant_for_role(&conductors[1], bob, bob.agent_pubkey(), "member").await;
    let borrowed = forge_entry(&conductors[2], &mallory, offers, OFFER, an_offer("borrowed", Some(bobs))).await;
    refused(&borrowed, "held by someone else", "an offer with Bob's grant");

    let mine = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "member").await;
    let honest = forge_entry(&conductors[2], &mallory, offers, OFFER, an_offer("honest", Some(mine))).await;
    let hash = honest.unwrap_or_else(|e| panic!("an offer with its author's member grant should be written; got {e}"));
    await_consistency_s(30, [alice, bob, &mallory]).await.unwrap();
    let read: Option<Record> = conductors[0]
        .call(&alice.zome("offers"), "get_offer", hash)
        .await;
    assert!(read.is_some(), "Alice should read the offer Mallory wrote with her grant");

    // And an offer is changed by its author or an administrator, as a request is.
    let st = a_service_type(&conductors[0], alice, "Gardening").await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let bobs_offer: Record = conductors[1]
        .call(&bob.zome("offers"), "create_offer", sample_offer("Bob's offer", st))
        .await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let forged = forge_update(
        &conductors[2],
        &mallory,
        bobs_offer.action_address(),
        an_offer("Mallory's edit", None),
    )
    .await;
    refused(&forged, "needs a grant for Administer", "an edit of an offer by a member who is not its author");
}

/// An interest carries the member grant its author holds: showing interest in
/// a listing is the first act of an exchange, and an accepted member's.
///
/// Mallory forges three interests in a real listing, all naming her own user:
/// with no grant, with Bob's, and with her own. Only the last is written.
///
/// **To make this go red:** remove the `check_act` call from
/// `validate_interest` in `exchanges_integrity/src/lib.rs`. Both forgeries
/// are then written.
#[tokio::test(flavor = "multi_thread")]
async fn an_interest_carries_the_member_grant_its_author_holds() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let requests = zome_index(&conductors[2], &mallory, "requests_integrity").await;
    let exchanges = zome_index(&conductors[2], &mallory, "exchanges_integrity").await;
    let mine = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "member").await;
    let bobs = grant_for_role(&conductors[1], bob, bob.agent_pubkey(), "member").await;

    // A real listing to be interested in.
    let listing = forge_entry(
        &conductors[2],
        &mallory,
        requests,
        REQUEST,
        a_request("a listing", Some(mine.clone())),
    )
    .await
    .unwrap_or_else(|e| panic!("the listing should be written; got {e}"));
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let interest = |grant: Option<ActionHash>| Interest {
        listing: listing.clone(),
        listing_type: "Request".to_string(),
        user: users[2].clone(),
        grant,
    };

    let no_grant = forge_entry(&conductors[2], &mallory, exchanges, INTEREST, interest(None)).await;
    refused(
        &no_grant,
        "an interest is a role act: this write needs a grant for Participate",
        "an interest with no grant",
    );

    let borrowed = forge_entry(&conductors[2], &mallory, exchanges, INTEREST, interest(Some(bobs))).await;
    refused(
        &borrowed,
        "an interest is a role act: the grant carried is held by someone else",
        "an interest with Bob's grant",
    );

    let honest = forge_entry(&conductors[2], &mallory, exchanges, INTEREST, interest(Some(mine))).await;
    honest.unwrap_or_else(|e| panic!("an interest with its author's member grant should be written; got {e}"));
    await_consistency_s(30, [alice, bob, &mallory]).await.unwrap();
}

/// A service type and a medium of exchange are changed on an admin grant, and
/// a member grant, which is enough to suggest one, is not enough to change one.
///
/// Alice creates one of each. Mallory, an accepted member, forges an update of
/// each carrying her own member grant. Both are refused for the role.
///
/// **To make this go red:** in `validate_service_type_grant`
/// (`service_types_integrity/src/lib.rs`) or `validate_medium_of_exchange_grant`
/// (`mediums_of_exchange_integrity/src/lib.rs`), check the update for
/// `Ability::Participate` in place of `Ability::Administer`. That forged
/// update is then written.
#[tokio::test(flavor = "multi_thread")]
async fn a_service_type_and_a_medium_of_exchange_are_changed_on_an_admin_grant_only() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let service_type = a_service_type(&conductors[0], alice, "Gardening").await;
    let medium: Record = conductors[0]
        .call(
            &alice.zome("mediums_of_exchange"),
            "create_medium_of_exchange",
            sample_medium_of_exchange("HRS", "Hours"),
        )
        .await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let mine = grant_for_role(&conductors[2], &mallory, mallory.agent_pubkey(), "member").await;

    let forged_service_type = forge_update(
        &conductors[2],
        &mallory,
        &service_type,
        ServiceType {
            name: "Gardening, taken over".to_string(),
            description: "Rewritten by a member who is not an administrator".to_string(),
            technical: false,
            grant: Some(mine.clone()),
        },
    )
    .await;
    refused(
        &forged_service_type,
        "Changing a service type is a role act: a member grant does not cover Administer here",
        "an update of a service type on a member grant",
    );

    let forged_medium = forge_update(
        &conductors[2],
        &mallory,
        medium.action_address(),
        MediumWithGrant {
            code: "HRS".to_string(),
            name: "Hours, taken over".to_string(),
            description: None,
            exchange_type: "currency".to_string(),
            resource_spec_hrea_id: None,
            grant: Some(mine),
        },
    )
    .await;
    refused(
        &forged_medium,
        "Changing a medium of exchange is a role act: a member grant does not cover Administer here",
        "an update of a medium of exchange on a member grant",
    );
}

/// Approval makes the creator coordinator once. A creator who has since been
/// removed as coordinator is not made one again when the organisation comes
/// back from a suspension, and cannot delete it as its creator either.
///
/// Bob founds an organisation and Alice approves it. Bob makes Mallory a
/// coordinator; Mallory removes Bob. Alice suspends the organisation and
/// accepts it again. Bob is still not a coordinator; Mallory still is.
///
/// Between the two, Bob's edit of it through the app is refused: from the
/// first approval on, an edit rests on a grant, the creator's included.
///
/// **To make this go red:** in `approve_organization`
/// (`coordinator/administration/src/status.rs`), ask `live_grants_of` for a
/// coordinator grant in place of `was_ever_granted`. Bob's revoked grant is
/// then not counted, and the second approval makes him coordinator again. Or,
/// in `update_organization`, let the creator through whether or not the
/// organisation has a coordinator: Bob's edit is then written.
#[tokio::test(flavor = "multi_thread")]
async fn approval_makes_the_creator_coordinator_once() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;

    let org: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_organization", sample_organization("Bob's"))
        .await;
    let org = org.action_address().clone();
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    accept_entity(&conductors[0], alice, ENTITY_ORGANIZATIONS, org.clone()).await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    assert!(
        is_coordinator(&conductors[1], bob, &org, &users[1]).await,
        "the first approval makes the creator coordinator"
    );

    // Bob makes Mallory a coordinator, on his own grant.
    let added: bool = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "add_coordinator_to_organization",
            pair(&org, &users[2]),
        )
        .await;
    assert!(added);
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    assert!(
        grant_over(&conductors[2], &mallory, mallory.agent_pubkey(), "Coordinate", &org)
            .await
            .is_some(),
        "a coordinator added by a coordinator holds a grant for the organisation"
    );

    // Mallory removes Bob, on hers: his grant is revoked and his link goes.
    let removed: bool = conductors[2]
        .call(
            &mallory.zome("users_organizations"),
            "remove_organization_coordinator",
            pair(&org, &users[1]),
        )
        .await;
    assert!(removed);
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    assert!(!is_coordinator(&conductors[1], bob, &org, &users[1]).await);
    assert!(
        grant_over(&conductors[1], bob, bob.agent_pubkey(), "Coordinate", &org)
            .await
            .is_none(),
        "a removed coordinator holds no live grant for the organisation"
    );

    // Its creator, no longer a coordinator, no longer edits it.
    let edit_by_its_creator: Result<Record, String> = reason(
        conductors[1]
            .call_fallible(
                &bob.zome("users_organizations"),
                "update_organization",
                serde_json::json!({
                    "original_action_hash": org,
                    "previous_action_hash": org,
                    "updated_organization": sample_organization("Bob's, again"),
                }),
            )
            .await,
    );
    match edit_by_its_creator {
        Ok(record) => panic!(
            "an edit by a creator who is no longer a coordinator should be refused, but was written as {}",
            record.action_address()
        ),
        Err(text) => assert!(
            text.contains("Not a coordinator"),
            "an edit by a creator who is no longer a coordinator should be refused as not a coordinator; got {text}"
        ),
    }

    // Suspended. Its creator, no longer a coordinator, cannot delete it.
    set_organization_status(
        &conductors[0],
        alice,
        &org,
        "suspended indefinitely",
        Some("under review"),
    )
    .await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let by_its_creator = delete_organization(&conductors[1], bob, &org).await;
    refused(
        &by_its_creator,
        "Not a coordinator",
        "a delete by a creator who is no longer a coordinator",
    );

    // Accepted again: the second approval gives Bob nothing back.
    accept_entity(&conductors[0], alice, ENTITY_ORGANIZATIONS, org.clone()).await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    assert!(
        !is_coordinator(&conductors[1], bob, &org, &users[1]).await,
        "a second approval must not make a removed creator coordinator again"
    );
    assert!(
        grant_over(&conductors[1], bob, bob.agent_pubkey(), "Coordinate", &org)
            .await
            .is_none(),
        "a second approval must not write the removed creator a new grant"
    );
    assert!(
        is_coordinator(&conductors[2], &mallory, &org, &users[2]).await,
        "the coordinator who stayed is still one"
    );
    assert!(
        grant_over(&conductors[2], &mallory, mallory.agent_pubkey(), "Coordinate", &org)
            .await
            .is_some(),
        "and still holds her grant"
    );
}

/// Who deletes an organisation: a coordinator of it, alone, or the creator of
/// a proposal that was never approved. Nobody outside it, an administrator
/// included.
///
/// Bob proposes an organisation. Mallory, a member, and Alice, the
/// administrator, are each refused; Bob withdraws it himself. He proposes a
/// second, Alice approves it and is still refused; Bob makes Mallory a
/// coordinator and she deletes it on her own. Both coordinator grants are
/// revoked with it.
///
/// **To make this go red:** in `roles_for` (`utils/src/grants.rs`), add
/// `Role::Admin` to `Ability::Dissolve`. Alice's delete of the approved
/// organisation then goes through. Or drop the creator's branch from
/// `require_dissolve` in `coordinator/users_organizations/src/organization.rs`:
/// Bob can then not withdraw his own proposal.
#[tokio::test(flavor = "multi_thread")]
async fn an_organisation_is_deleted_by_a_coordinator_alone_and_by_nobody_outside_it() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;

    // A proposal, not yet approved.
    let proposal: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_organization", sample_organization("Proposed"))
        .await;
    let proposal = proposal.action_address().clone();
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let by_a_member = delete_organization(&conductors[2], &mallory, &proposal).await;
    refused(&by_a_member, "Not a coordinator", "a delete of someone else's proposal");
    let by_the_administrator = delete_organization(&conductors[0], alice, &proposal).await;
    refused(
        &by_the_administrator,
        "Not a coordinator",
        "an administrator's delete of a proposal",
    );
    delete_organization(&conductors[1], bob, &proposal)
        .await
        .unwrap_or_else(|e| panic!("its creator should be able to withdraw a proposal; got {e}"));
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    // An approved organisation.
    let org: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_organization", sample_organization("Approved"))
        .await;
    let org = org.action_address().clone();
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    accept_entity(&conductors[0], alice, ENTITY_ORGANIZATIONS, org.clone()).await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    assert!(
        grant_over(&conductors[1], bob, bob.agent_pubkey(), "Dissolve", &org)
            .await
            .is_some(),
        "its coordinator may delete it"
    );
    assert!(
        grant_over(&conductors[0], alice, alice.agent_pubkey(), "Dissolve", &org)
            .await
            .is_none(),
        "an administrator's grant does not cover deleting an organisation"
    );
    let by_the_administrator = delete_organization(&conductors[0], alice, &org).await;
    refused(
        &by_the_administrator,
        "Not a coordinator",
        "an administrator's delete of an approved organisation",
    );

    // A second coordinator, who is not its creator, deletes it alone.
    let added: bool = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "add_coordinator_to_organization",
            pair(&org, &users[2]),
        )
        .await;
    assert!(added);
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    delete_organization(&conductors[2], &mallory, &org)
        .await
        .unwrap_or_else(|e| panic!("a coordinator should be able to delete the organisation alone; got {e}"));
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    for (conductor, cell, who) in [(&conductors[1], bob, "Bob"), (&conductors[2], &mallory, "Mallory")] {
        assert!(
            grant_over(conductor, cell, cell.agent_pubkey(), "Coordinate", &org)
                .await
                .is_none(),
            "{who}'s coordinator grant should be revoked with the organisation"
        );
    }
}

/// The link from a record to one of its updates is what readers follow to the
/// latest revision. It is never deleted, and it is only ever the real update's
/// author pointing the record's original at that update.
///
/// Bob's organisation is approved and edited once, and Bob edits his profile
/// once, so each has an update link. Mallory, past the coordinator:
///
/// - deletes each update link: refused;
/// - points Bob's organisation at a user, and at an organisation of her own
///   (a create, not an update): refused;
/// - points it at an update of her own organisation: refused, another chain;
/// - points it at Bob's real update, as a newer link: refused, not hers;
/// - points her own user at Bob's organisation: refused.
///
/// **To make this go red:** in `users_organizations_integrity/src/lib.rs`,
/// remove an update-link arm under `OpLink::DeleteLink` (that delete is then
/// written), or return `Valid` at the top of `validate_update_link` (every
/// forged link is).
#[tokio::test(flavor = "multi_thread")]
async fn an_update_link_is_never_deleted_and_points_at_a_real_update_by_its_author() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let users_organizations = zome_index(&conductors[2], &mallory, "users_organizations_integrity").await;

    // Bob's organisation, approved, edited once.
    let created: Record = conductors[1]
        .call(&bob.zome("users_organizations"), "create_organization", sample_organization("Bob's"))
        .await;
    let org = created.action_address().clone();
    // Mallory's own, edited once while it is still her proposal.
    let hers: Record = conductors[2]
        .call(&mallory.zome("users_organizations"), "create_organization", sample_organization("Mallory's"))
        .await;
    let hers = hers.action_address().clone();
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    accept_entity(&conductors[0], alice, ENTITY_ORGANIZATIONS, org.clone()).await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    let bobs_update: Record = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "update_organization",
            serde_json::json!({
                "original_action_hash": org,
                "previous_action_hash": org,
                "updated_organization": sample_organization("Bob's, renamed"),
            }),
        )
        .await;
    let bobs_update = bobs_update.action_address().clone();
    let her_update: Record = conductors[2]
        .call(
            &mallory.zome("users_organizations"),
            "update_organization",
            serde_json::json!({
                "original_action_hash": hers,
                "previous_action_hash": hers,
                "updated_organization": sample_organization("Mallory's, renamed"),
            }),
        )
        .await;
    let her_update = her_update.action_address().clone();
    // Bob edits his profile once.
    let _: Record = conductors[1]
        .call(
            &bob.zome("users_organizations"),
            "update_user",
            serde_json::json!({
                "original_action_hash": users[1],
                "previous_action_hash": users[1],
                "updated_user": sample_user("Bob, renamed"),
            }),
        )
        .await;
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    // Neither update link is deleted.
    for (base, link_type, expected, what) in [
        (
            &org,
            ORGANIZATION_UPDATES_LINK,
            "OrganizationUpdates links cannot be deleted",
            "a delete of an organisation's update link",
        ),
        (
            &users[1],
            USER_UPDATES_LINK,
            "UserUpdates links cannot be deleted",
            "a delete of a user's update link",
        ),
    ] {
        let links = links_of(&conductors[2], &mallory, base.clone().into(), users_organizations, link_type).await;
        assert_eq!(links.len(), 1, "one edit, one update link ({what})");
        let deleted = forge_delete_link(&conductors[2], &mallory, links[0].create_link_hash.clone()).await;
        refused(&deleted, expected, what);
    }

    // Forged update links from Bob's organisation.
    let from_bobs = |target: ActionHash| {
        forge_link(
            &conductors[2],
            &mallory,
            org.clone().into(),
            target.into(),
            users_organizations,
            ORGANIZATION_UPDATES_LINK,
            vec![],
        )
    };
    refused(
        &from_bobs(users[2].clone()).await,
        "an OrganizationUpdates link points at an update of an Organization",
        "an organisation update link that points at a user",
    );
    refused(
        &from_bobs(hers.clone()).await,
        "an OrganizationUpdates link points at an update of an Organization",
        "an organisation update link that points at another organisation's create",
    );
    refused(
        &from_bobs(her_update).await,
        "an OrganizationUpdates link points at an update of the record it starts at",
        "an organisation update link that points at an update of another organisation",
    );
    refused(
        &from_bobs(bobs_update).await,
        "an OrganizationUpdates link is written by the author of the update it points at",
        "a second link to Bob's update, written by Mallory",
    );

    let to_an_organisation = forge_link(
        &conductors[2],
        &mallory,
        users[2].clone().into(),
        org.clone().into(),
        users_organizations,
        USER_UPDATES_LINK,
        vec![],
    )
    .await;
    refused(
        &to_an_organisation,
        "a UserUpdates link points at an update of a User",
        "a user update link that points at an organisation",
    );
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
    match through_the_app {
        Ok(record) => panic!(
            "the coordinator should refuse a removed administrator, but wrote {}",
            record.action_address()
        ),
        Err(text) => assert!(
            text.contains("Unauthorized"),
            "the coordinator should refuse a removed administrator as unauthorized; got {text}"
        ),
    }

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

/// The grant indexes are what `can` reads, so a tombstone on one is refused.
/// Alice revokes Mallory's member grant; Mallory cannot tombstone the link
/// that records the revocation and come back, and `get_agent_grants` still
/// says she is revoked. Then she cannot hide her own index either (which
/// would lock an honest holder out the same way). The revocation comes
/// first so that the final read goes through an intact index: with the
/// rule gone, the comeback is what that read shows.
///
/// **To make it go red:** in `administration_integrity/src/lib.rs`, the
/// `DeleteLink` match, remove the `AgentGrants | AllGrants | GrantRevocations`
/// arm so those deletes fall through to `Valid`. The revocation tombstone is
/// written; with the first `refused` off as well, `get_agent_grants` returns
/// Mallory's revoked member grant as live again (Aria, 4 November, R1c).
#[tokio::test(flavor = "multi_thread")]
async fn a_grant_index_is_never_tombstoned() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, false).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;
    let me = mallory.agent_pubkey().clone();

    // Acceptance gave Mallory a member grant, indexed from her key.
    let mine = grants_of(&conductors[1], &mallory, &me).await;
    let (grant, _) = mine
        .iter()
        .find(|(_, g)| g.role == "member")
        .cloned()
        .expect("acceptance issued a member grant");

    // Alice revokes the grant; the revocation hangs from it as a link.
    conductors[0]
        .call::<_, ActionHash>(
            &alice.zome("administration"),
            "revoke_role",
            serde_json::json!({ "grant": grant, "reason": "a test" }),
        )
        .await;
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    let revocations =
        links_of(&conductors[1], &mallory, grant.clone().into(), administration, GRANT_REVOCATIONS_LINK).await;
    let revocation_link = revocations
        .first()
        .expect("the revocation is linked from the grant")
        .create_link_hash
        .clone();

    let undone = forge_delete_link(&conductors[1], &mallory, revocation_link).await;
    refused(&undone, "never tombstoned", "tombstoning a revocation link");

    let live = grants_of(&conductors[1], &mallory, &me).await;
    assert!(
        !live.iter().any(|(h, _)| *h == grant),
        "the revoked member grant stays revoked; live grants: {live:?}"
    );

    // Her own index link, which `can` would read, is a record too.
    let index = links_of(&conductors[1], &mallory, me.clone().into(), administration, AGENT_GRANTS_LINK).await;
    let index_link = index
        .iter()
        .find(|l| l.target == grant.clone().into())
        .expect("the member grant is still indexed from Mallory's key")
        .create_link_hash
        .clone();
    let hidden = forge_delete_link(&conductors[1], &mallory, index_link).await;
    refused(&hidden, "never tombstoned", "tombstoning a holder's grant index");
}

/// A grant is a record: Mallory cannot update her member grant any more than
/// delete it. An update to the same entry is refused, as one to a different
/// role would be.
///
/// **To make it go red:** in `administration_integrity/src/lib.rs`,
/// `validate_entry`, remove the `if is_update` arm for `RoleGrant` and
/// `RoleRevocation`: the update is validated as a fresh grant and written.
#[tokio::test(flavor = "multi_thread")]
async fn a_grant_is_never_updated() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, false).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let me = mallory.agent_pubkey().clone();

    let mine = grants_of(&conductors[1], &mallory, &me).await;
    let (grant, entry) = mine
        .iter()
        .find(|(_, g)| g.role == "member")
        .cloned()
        .expect("acceptance issued a member grant");

    let rewritten = forge_update(&conductors[1], &mallory, &grant, entry).await;
    refused(&rewritten, "never updated", "updating a grant to itself");
}

/// An issuer cannot rewrite a grant they issued either. Mallory, holding a
/// root admin grant (no key: any root is accepted), issues Alice a member
/// grant resting on it, the honest shape; an update of that grant is
/// refused. This is the case the `is_update` arm alone guards: a self-update
/// is also caught by "written by the holder of the grant it rests on", but
/// the issuer *is* that holder (Aria, 4 November, R2).
///
/// **To make it go red:** the same edit as `a_grant_is_never_updated`; the
/// update is validated as a fresh grant, which the issuer may write, and is
/// written.
#[tokio::test(flavor = "multi_thread")]
async fn an_issuer_cannot_rewrite_a_grant_they_issued() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, false).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;

    let root = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "admin".to_string(),
            holder: mallory.agent_pubkey().clone(),
            scope: None,
            authority: Authority::Progenitor { signature: Signature([0; 64]) },
        },
    )
    .await
    .expect("without a key Mallory's root is accepted");
    let issued_entry = RoleGrant {
        role: "member".to_string(),
        holder: alice.agent_pubkey().clone(),
        scope: None,
        authority: Authority::Grant(root),
    };
    let issued = forge_entry(&conductors[1], &mallory, administration, ROLE_GRANT, issued_entry.clone())
        .await
        .expect("a member grant resting on a held admin grant is valid");

    let rewritten = forge_update(&conductors[1], &mallory, &issued, issued_entry).await;
    refused(&rewritten, "never updated", "an issuer updating a grant they issued");
}

/// A status change is a role act: Mallory cannot move her own status past
/// pending, with no grant or with the administrator's grant, which is held
/// by someone else. Each attempt is an update of her real status through the
/// forge, the shape the coordinator writes.
///
/// **To make it go red:** in `administration_integrity/src/status.rs`,
/// `validate_status`, remove the `check_act` block: both updates are written
/// and Mallory reads back as accepted.
#[tokio::test(flavor = "multi_thread")]
async fn a_status_change_carries_the_administrators_grant() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, false).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;

    // Mallory's current status, written by Alice when she accepted her: a real one to rewrite.
    let current = status_of(&conductors[1], &mallory, &users[1]).await;
    let alices = grants_of(&conductors[0], alice, alice.agent_pubkey()).await;
    let (alices_admin, _) = alices
        .iter()
        .find(|(_, g)| g.role == "admin")
        .cloned()
        .expect("Alice holds the admin grant");

    let accepted = |grant: Option<ActionHash>| Status {
        status_type: "accepted".to_string(),
        reason: None,
        suspended_until: None,
        grant,
    };
    let without = forge_update(
        &conductors[1],
        &mallory,
        current.action_address(),
        accepted(None),
    )
    .await;
    refused(&without, "a status change is a role act", "a status change with no grant");

    let borrowed = forge_update(
        &conductors[1],
        &mallory,
        current.action_address(),
        accepted(Some(alices_admin)),
    )
    .await;
    refused(
        &borrowed,
        "held by someone else",
        "a status change carrying the administrator's grant",
    );
}

/// With a progenitor key, a root grant is written by the progenitor and
/// nobody else, even with the progenitor's own signature on it: the
/// signature covers only the body, so a signed body written again by its
/// holder would be a second grant that no revocation names.
///
/// **To make it go red:** in `utils/src/grants.rs`, `root_is_valid`, remove
/// the `author != &progenitor` check: Alice's signature verifies and the
/// grant is written by Mallory.
#[tokio::test(flavor = "multi_thread")]
async fn with_a_progenitor_key_the_root_is_written_by_the_progenitor() {
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
    // The progenitor's real signature over a body naming Mallory.
    let signature = conductors[0]
        .keystore()
        .sign(alice.agent_pubkey().clone(), bytes.into())
        .await
        .expect("Alice signs with the progenitor key");
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
    refused(&forged, "written by the progenitor", "a root grant Mallory wrote with Alice's signature");
}

/// Mirror of the messaging coordinator's `InboxEntry`, enough to see who wrote each one.
#[derive(Debug, serde::Deserialize)]
#[serde(tag = "type")]
enum InboxEntry {
    Read(InboxMessage),
    Unreadable { from: AgentPubKey },
}

#[derive(Debug, serde::Deserialize)]
struct InboxMessage {
    from: AgentPubKey,
}

impl InboxEntry {
    fn from(&self) -> &AgentPubKey {
        match self {
            InboxEntry::Read(m) => &m.from,
            InboxEntry::Unreadable { from } => from,
        }
    }
}

async fn inbox_authors(conductor: &SweetConductor, cell: &SweetCell) -> Vec<AgentPubKey> {
    let inbox: Vec<InboxEntry> = conductor.call(&cell.zome("messaging"), "get_inbox", ()).await;
    inbox.iter().map(|entry| entry.from().clone()).collect()
}

/// While a member is not accepted, only an administrator reaches their inbox.
///
/// `send_message` refuses a non-administrator writing to a member who is not
/// accepted, but a modified client can skip it: Mallory, accepted and holding
/// her own member grant, forges a message and an `Inbox` link to Carol, who is
/// still pending. Validation lets both through (the grant is hers), so the rule
/// has to hold where Carol reads. Two controls show it holds for that reason:
/// Alice's message, an administrator's, does reach pending Carol; and once
/// Carol is accepted, Mallory's forged message is shown.
///
/// **To make this go red:** remove the `restricted` check in
/// `read_inbox_entries` (coordinator `messaging/src/inbox.rs`). Pending Carol
/// then sees Mallory's message.
#[tokio::test(flavor = "multi_thread")]
async fn a_member_who_is_not_accepted_hears_only_from_administrators() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(3, true).await;
    let (alice, bob, carol) = (&cells[0], &cells[1], &cells[2]);
    let users = everyone_accepted(&conductors, &[alice, bob]).await;

    // Carol applies and stays pending; Mallory applies and is accepted.
    conductors[2]
        .call::<_, Record>(&carol.zome("users_organizations"), "create_user", sample_user("Carol"))
        .await;
    conductors[3]
        .call::<_, Record>(&mallory.zome("users_organizations"), "create_user", sample_user("Mallory"))
        .await;
    await_consistency_s(15, [alice, bob, carol, &mallory]).await.unwrap();
    let carols_user = user_of(&conductors[2], carol).await;
    let mallorys_user = user_of(&conductors[3], &mallory).await;
    accept_entity(&conductors[0], alice, ENTITY_USERS, mallorys_user).await;
    await_consistency_s(15, [alice, bob, carol, &mallory]).await.unwrap();

    // Control: an administrator may write to a member who is not accepted.
    let _: Vec<SentMessage> = conductors[0]
        .call(
            &alice.zome("messaging"),
            "send_message",
            SendMessageInput { to_user: carols_user.clone(), content: "welcome, Carol".to_string() },
        )
        .await;

    // The app refuses Mallory, who is no administrator.
    let through_the_app: Result<Vec<SentMessage>, String> = reason(
        conductors[3]
            .call_fallible(
                &mallory.zome("messaging"),
                "send_message",
                SendMessageInput { to_user: carols_user.clone(), content: "hello".to_string() },
            )
            .await,
    );
    assert!(
        through_the_app.as_ref().is_err_and(|e| e.contains("not accepted yet")),
        "the app should refuse a member writing to a pending member; got {through_the_app:?}"
    );

    // So she forges it: a real ciphertext of hers (sent to Bob), stored again with her
    // own grant, and an Inbox link at Carol's key. Both pass validation.
    let sent: Vec<SentMessage> = conductors[3]
        .call(
            &mallory.zome("messaging"),
            "send_message",
            SendMessageInput { to_user: users[1].clone(), content: "a ciphertext to reuse".to_string() },
        )
        .await;
    let record: Option<Record> = conductors[3]
        .call(&mallory.zome("forge"), "forge_get", sent[0].hash.clone())
        .await;
    let theirs: EncryptedMessage =
        record.expect("her own message").entry().to_app_option().unwrap().expect("an EncryptedMessage");
    let messaging = zome_index(&conductors[3], &mallory, "messaging_integrity").await;
    let grant = grant_for_role(&conductors[3], &mallory, mallory.agent_pubkey(), "member").await;
    let forged = forge_entry(
        &conductors[3],
        &mallory,
        messaging,
        ENCRYPTED_MESSAGE,
        EncryptedMessage { encrypted: theirs.encrypted.clone(), grant: Some(grant) },
    )
    .await
    .unwrap_or_else(|e| panic!("a member's message with her own grant should be written; got {e}"));
    reason(
        conductors[3]
            .call_fallible::<_, ActionHash>(
                &mallory.zome("forge"),
                "forge_link",
                serde_json::json!({
                    "base": AnyLinkableHash::from(carol.agent_pubkey().clone()),
                    "target": AnyLinkableHash::from(forged),
                    "zome_index": messaging,
                    "link_type": INBOX_LINK,
                    "tag": Vec::<u8>::new(),
                }),
            )
            .await,
    )
    .unwrap_or_else(|e| panic!("the forged Inbox link should be written; got {e}"));
    await_consistency_s(30, [alice, bob, carol, &mallory]).await.unwrap();

    let pending = inbox_authors(&conductors[2], carol).await;
    assert!(pending.contains(alice.agent_pubkey()), "pending Carol should see the administrator's message");
    assert!(
        !pending.contains(mallory.agent_pubkey()),
        "pending Carol should not see a message from a member who is not an administrator"
    );

    // Control: accepted, Carol hears from members too, the forged message included.
    accept_entity(&conductors[0], alice, ENTITY_USERS, carols_user).await;
    await_consistency_s(15, [alice, bob, carol, &mallory]).await.unwrap();
    let accepted = inbox_authors(&conductors[2], carol).await;
    assert!(
        accepted.contains(mallory.agent_pubkey()),
        "once accepted, Carol should see Mallory's message; the rule is about her status"
    );
}

/// A revocation link points at a revocation, not at anything shaped like one.
///
/// Mallory, an ordinary member, wants Alice's admin grant to read as revoked.
/// She cannot write a `RoleRevocation`: its rule needs a grant of her own that
/// could have given the role. But anyone may write a pending `Status`, and a
/// pending `Status` with one extra field decodes as a `RoleRevocation` naming
/// Alice's grant. If the `GrantRevocations` link rule reads its target without
/// checking the entry type, the link is written, and `can` treats any such
/// link as a revocation: every administrator can be stripped by any member.
///
/// **To make it go red:** in `utils/src/grants.rs`, `load_revocation`, drop
/// the `is_administration_entry` check, so the target is trusted by shape.
/// The link is written and Alice stops being an administrator (seen at
/// `a1bf2cb6`, before the check existed).
#[tokio::test(flavor = "multi_thread")]
async fn a_revocation_link_points_at_a_real_revocation() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;

    let alices_admin = admin_grant_of(&conductors[0], alice, alice.agent_pubkey())
        .await
        .expect("Alice, the progenitor, administers the network");

    // A valid pending status, by its own rules.
    let lookalike = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        STATUS,
        StatusShapedLikeARevocation {
            status_type: "pending".to_string(),
            reason: Some("not a revocation".to_string()),
            suspended_until: None,
            grant: Some(alices_admin.clone()),
            authority: alices_admin.clone(),
        },
    )
    .await
    .expect("a pending status is anyone's to write");

    let linked = forge_link(
        &conductors[1],
        &mallory,
        alices_admin.clone().into(),
        lookalike.into(),
        administration,
        GRANT_REVOCATIONS_LINK,
        Vec::new(),
    )
    .await;
    refused(
        &linked,
        "a revocation link points at a revocation record",
        "a revocation link to a status shaped like a revocation",
    );

    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    assert_eq!(
        admin_grant_of(&conductors[0], alice, alice.agent_pubkey()).await,
        Some(alices_admin),
        "Alice's admin grant is still live"
    );
}

/// A removed administrator with a modified client: what the roster cannot
/// give her, and the limit that is stated and not closed.
///
/// Mallory was an administrator and Alice removed her. Her old admin grant is
/// still a valid record, as every grant is for ever, so validation accepts a
/// new grant resting on it: validation can prove a grant exists and cannot
/// prove that no revocation names it.
///
/// First, the roster. A roster link is valid when its tag carries an admin
/// grant its author wrote, and her fresh grant is one. Whether an agent
/// administers is asked of the grants (`can`), never of the roster, so the
/// link gives her nothing.
///
/// Second, the limit. When she also indexes the fresh grant under her own
/// key, `can` returns it: nobody has revoked *that* grant, and the reader
/// does not ask whether the grant beneath it was revoked first. Revocation is
/// a record of who was removed and when, not a wall against a modified
/// client (the spec, *Not closed here*). The assertion is here so the limit
/// is seen in a test, and so that closing it changes this line.
///
/// **To make it go red:** have `check_if_agent_is_administrator` read the
/// `AgentAdministrators` roster link again: the first question then answers
/// yes.
#[tokio::test(flavor = "multi_thread")]
async fn a_removed_administrator_with_a_modified_client() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;
    let me = mallory.agent_pubkey().clone();

    let added: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            serde_json::json!({
                "entity": "network",
                "entity_original_action_hash": users[1],
                "agent_pubkeys": [me],
            }),
        )
        .await;
    assert!(added, "Alice makes Mallory an administrator");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    let old_grant = admin_grant_of(&conductors[0], alice, &me)
        .await
        .expect("Mallory administers the network while her grant stands");

    let removed: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "remove_administrator",
            serde_json::json!({
                "entity": "network",
                "entity_original_action_hash": users[1],
                "agent_pubkeys": [me],
            }),
        )
        .await;
    assert!(removed, "Alice removes Mallory");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    assert_eq!(
        admin_grant_of(&conductors[0], alice, &me).await,
        None,
        "a removed administrator's grant is revoked"
    );

    // Validation accepts the write: the old grant is a valid record, held by
    // the author, and an admin may grant admin.
    let fresh = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "admin".to_string(),
            holder: me.clone(),
            scope: None,
            authority: Authority::Grant(old_grant),
        },
    )
    .await
    .expect("validation cannot see the revocation, so the grant is written");

    // The roster link: valid, because its tag carries an admin grant written
    // by the link's author.
    forge_link(
        &conductors[1],
        &mallory,
        me.clone().into(),
        fresh.clone().into(),
        administration,
        AGENT_ADMINISTRATORS_LINK,
        fresh.get_raw_39().to_vec(),
    )
    .await
    .expect("the roster link carries a valid admin grant written by its author");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    let still_admin: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "check_if_agent_is_administrator",
            serde_json::json!({ "entity": "network", "agent_pubkey": me }),
        )
        .await;
    assert!(
        !still_admin,
        "a forged roster link does not make a removed administrator one again"
    );

    // The stated limit: indexed under her key, the fresh grant is returned.
    forge_link(
        &conductors[1],
        &mallory,
        me.clone().into(),
        fresh.clone().into(),
        administration,
        AGENT_GRANTS_LINK,
        fresh.get_raw_39().to_vec(),
    )
    .await
    .expect("the index link carries a valid grant written by its author");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    assert_eq!(
        admin_grant_of(&conductors[0], alice, &me).await,
        Some(fresh),
        "the stated limit: a grant resting on a revoked grant is valid, and `can` returns it"
    );
}

/// The links that index a grant are the granter's record of it: each create
/// rule, met by a forged link.
///
/// On a network with no key Mallory can write herself a root, so she has
/// grants of her own to mislink as well as Alice's to borrow. One row per
/// rule; each names the check that refuses it.
///
/// **To make it go red:** in `administration_integrity/src/grants.rs`, remove
/// the check a row names (`validate_grant_index_link` for the first four,
/// `grant_in_tag` and `validate_holder_role_link` for the roster rows): that
/// row's link is written.
#[tokio::test(flavor = "multi_thread")]
async fn a_grant_index_link_is_the_granters_record_of_a_real_grant() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, false).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;
    let me = mallory.agent_pubkey().clone();
    let alice_key = alice.agent_pubkey().clone();

    let alices_admin = admin_grant_of(&conductors[0], alice, &alice_key)
        .await
        .expect("Alice, the first user, administers the network");
    // Mallory's own grants: a root (no key, so it is accepted) and a member
    // grant resting on it.
    let my_root = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "admin".to_string(),
            holder: me.clone(),
            scope: None,
            authority: Authority::Progenitor { signature: Signature([0; 64]) },
        },
    )
    .await
    .expect("without a key Mallory's root is accepted");
    let my_member = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        RoleGrant {
            role: "member".to_string(),
            holder: me.clone(),
            scope: None,
            authority: Authority::Grant(my_root.clone()),
        },
    )
    .await
    .expect("a member grant resting on a held admin grant is valid");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();

    let tag = |grant: &ActionHash| grant.get_raw_39().to_vec();
    let link = |base: AnyLinkableHash, target: AnyLinkableHash, link_type: u8, tag: Vec<u8>| {
        forge_link(&conductors[1], &mallory, base, target, administration, link_type, tag)
    };

    // AgentGrants and AllGrants.
    refused(
        &link(me.clone().into(), alices_admin.clone().into(), AGENT_GRANTS_LINK, tag(&alices_admin)).await,
        "an index link is written by the agent who wrote the grant",
        "indexing a grant somebody else wrote",
    );
    refused(
        &link(alice_key.clone().into(), my_root.clone().into(), AGENT_GRANTS_LINK, tag(&my_root)).await,
        "an agent's grant index holds that agent's grants",
        "indexing a grant from a key that does not hold it",
    );
    refused(
        &link(me.clone().into(), my_member.clone().into(), AGENT_GRANTS_LINK, tag(&my_root)).await,
        "a grant index link points at the grant its tag carries",
        "an index link whose target is not the grant in its tag",
    );
    refused(
        &link(me.clone().into(), my_root.clone().into(), ALL_GRANTS_LINK, vec![1, 2, 3]).await,
        "the link's tag does not carry a grant",
        "an index link whose tag is not a grant",
    );

    // The administrator roster.
    refused(
        &link(me.clone().into(), users[1].clone().into(), AGENT_ADMINISTRATORS_LINK, tag(&my_member)).await,
        "and the tag carries a member grant",
        "a roster link carrying a member grant",
    );
    refused(
        &link(alice_key.into(), users[0].clone().into(), AGENT_ADMINISTRATORS_LINK, tag(&my_root)).await,
        "index link starts at the grant's holder",
        "a roster link from a key that does not hold the grant",
    );
}

/// The network is never left with no administrator, counted from the grants.
///
/// `revoke_role` is a public call and ends a role without touching the roster
/// links, so after it the roster still lists two administrators where the
/// grants say one. The guard used to count roster links, and so let the one
/// administrator who was left be removed (found on the home server run of
/// 12 November). Both doors are tried: `remove_administrator`, and
/// `revoke_role` on the last live admin grant.
///
/// **To make this go red:** drop the guard from `revoke_role`: the second
/// door opens and the last grant is revoked. The removal assertion needs both
/// guards gone, because `remove_administrator` asks the same rule first,
/// before anything is written, and then revokes through `revoke_role`.
#[tokio::test(flavor = "multi_thread")]
async fn the_last_administrator_is_counted_from_the_grants() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let her = mallory.agent_pubkey().clone();
    let me = alice.agent_pubkey().clone();

    let added: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            serde_json::json!({
                "entity": "network",
                "entity_original_action_hash": users[1],
                "agent_pubkeys": [her],
            }),
        )
        .await;
    assert!(added, "Alice makes Mallory an administrator");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    let her_grant = admin_grant_of(&conductors[0], alice, &her)
        .await
        .expect("Mallory administers the network while her grant stands");
    let my_grant = admin_grant_of(&conductors[0], alice, &me)
        .await
        .expect("Alice administers the network");

    // The honest revocation, by the public call: the roster is not touched.
    let _: ActionHash = conductors[0]
        .call(
            &alice.zome("administration"),
            "revoke_role",
            serde_json::json!({ "grant": her_grant, "reason": "testing the last-administrator count" }),
        )
        .await;
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    assert_eq!(
        admin_grant_of(&conductors[0], alice, &her).await,
        None,
        "Mallory no longer administers"
    );

    let removal = reason(
        conductors[0]
            .call_fallible::<_, bool>(
                &alice.zome("administration"),
                "remove_administrator",
                serde_json::json!({
                    "entity": "network",
                    "entity_original_action_hash": users[0],
                    "agent_pubkeys": [me],
                }),
            )
            .await,
    );
    match &removal {
        Ok(_) => panic!("removing the only administrator with a live grant should be refused"),
        Err(text) => assert!(
            text.contains("Cannot remove last admin"),
            "the removal should be refused as the last administrator; got {text}"
        ),
    }

    let revocation = reason(
        conductors[0]
            .call_fallible::<_, ActionHash>(
                &alice.zome("administration"),
                "revoke_role",
                serde_json::json!({ "grant": my_grant, "reason": "testing the other door" }),
            )
            .await,
    );
    refused(
        &revocation,
        "Cannot remove last admin",
        "revoking the last live admin grant",
    );

    assert!(
        admin_grant_of(&conductors[0], alice, &me).await.is_some(),
        "Alice still administers the network after both refusals"
    );
}

/// Makes Mallory an administrator, by Alice, and returns Mallory's admin grant.
async fn made_administrator(
    conductors: &SweetConductorBatch,
    alice: &SweetCell,
    mallory: &SweetCell,
    mallory_user: &ActionHash,
) -> ActionHash {
    let her = mallory.agent_pubkey().clone();
    let added: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "add_administrator",
            serde_json::json!({
                "entity": "network",
                "entity_original_action_hash": mallory_user,
                "agent_pubkeys": [her],
            }),
        )
        .await;
    assert!(added, "Alice makes Mallory an administrator");
    await_consistency_s(15, [alice, mallory]).await.unwrap();
    admin_grant_of(&conductors[0], alice, &her)
        .await
        .expect("Mallory administers the network while her grant stands")
}

/// The rules for who may write a grant, each met by a forged grant.
///
/// Mallory is an accepted member and nothing more. Four grants, one per rule
/// in `validate_role_grant`: an admin grant resting on Alice's admin grant
/// (borrowed authority), one resting on her own member grant (a member grants
/// nothing), an admin grant with a scope, and a member grant that claims the
/// progenitor's signature. Then the honest question: she administers nothing.
///
/// **To make it go red:** in `administration_integrity/src/grants.rs`, remove
/// the check a row names: that row is no longer refused for the reason it
/// names (the first two grants are then written; the last two meet the next
/// check and are refused with a different message).
#[tokio::test(flavor = "multi_thread")]
async fn a_grant_is_refused_when_its_author_has_no_authority_for_it() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let administration = zome_index(&conductors[1], &mallory, "administration_integrity").await;
    let me = mallory.agent_pubkey().clone();

    let alices_grant = admin_grant_of(&conductors[0], alice, alice.agent_pubkey())
        .await
        .expect("Alice, the progenitor, administers the network");
    let my_member_grant = grants_of(&conductors[1], &mallory, &me)
        .await
        .into_iter()
        .find(|(_, grant)| grant.role == "member")
        .map(|(hash, _)| hash)
        .expect("an accepted member holds a member grant");

    let admin_resting_on = |authority: Authority, scope: Option<ActionHash>, role: &str| RoleGrant {
        role: role.to_string(),
        holder: me.clone(),
        scope,
        authority,
    };

    let borrowed = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        admin_resting_on(Authority::Grant(alices_grant.clone()), None, "admin"),
    )
    .await;
    refused(
        &borrowed,
        "a grant is written by the holder of the grant it rests on",
        "an admin grant resting on somebody else's grant",
    );

    let from_a_member = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        admin_resting_on(Authority::Grant(my_member_grant), None, "admin"),
    )
    .await;
    refused(
        &from_a_member,
        "a member may not grant admin here",
        "an admin grant resting on a member grant",
    );

    let scoped = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        admin_resting_on(Authority::Grant(alices_grant), Some(users[1].clone()), "admin"),
    )
    .await;
    refused(&scoped, "does not take a scope", "an admin grant with a scope");

    let root_for_a_member = forge_entry(
        &conductors[1],
        &mallory,
        administration,
        ROLE_GRANT,
        admin_resting_on(
            Authority::Progenitor {
                signature: Signature([0u8; 64]),
            },
            None,
            "member",
        ),
    )
    .await;
    refused(
        &root_for_a_member,
        "the progenitor key grants the first administrators, nothing else",
        "a member grant claiming the progenitor's signature",
    );

    assert_eq!(
        admin_grant_of(&conductors[0], alice, &me).await,
        None,
        "after four refusals Mallory administers nothing"
    );
}

/// An administrator whose roster link is gone can still be removed.
///
/// The roster is an index for listing administrators, and anyone can
/// tombstone a roster link (no rule refuses it yet). `remove_administrator`
/// used to fail when it could not find the link, so one forged tombstone made
/// an administrator impossible to remove. Mallory tombstones her own.
///
/// **To make it go red:** have `remove_administrator` return an error when the
/// entity's `AllAdministrators` link is not found.
#[tokio::test(flavor = "multi_thread")]
async fn an_administrator_whose_roster_link_is_gone_can_still_be_removed() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let me = mallory.agent_pubkey().clone();
    made_administrator(&conductors, alice, &mallory, &users[1]).await;

    let roster: Vec<Link> = conductors[1]
        .call(
            &mallory.zome("administration"),
            "get_all_administrators_links",
            "network".to_string(),
        )
        .await;
    let mine = roster
        .into_iter()
        .find(|link| link.target == users[1].clone().into())
        .expect("Mallory's entity is on the roster");
    forge_delete_link(&conductors[1], &mallory, mine.create_link_hash)
        .await
        .expect("no rule refuses a tombstone on a roster link yet");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();

    let removed: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "remove_administrator",
            serde_json::json!({
                "entity": "network",
                "entity_original_action_hash": users[1],
                "agent_pubkeys": [me],
            }),
        )
        .await;
    assert!(removed, "Alice removes Mallory though her roster link is gone");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    assert_eq!(
        admin_grant_of(&conductors[0], alice, &me).await,
        None,
        "and the removal took her grant"
    );
}

/// An administrator revoked by `revoke_role` can be made one again.
///
/// `revoke_role` ends the role and leaves the roster link, so the roster
/// still lists the entity. `add_administrator` used to return early on the
/// roster's word and write nothing, leaving a listed administrator with no
/// grant and no way to give them one through the app.
///
/// **To make it go red:** have `add_administrator` return `true` when
/// `check_if_entity_is_administrator` says the entity is listed.
#[tokio::test(flavor = "multi_thread")]
async fn an_administrator_revoked_by_revoke_role_can_be_added_again() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let her = mallory.agent_pubkey().clone();
    let first_grant = made_administrator(&conductors, alice, &mallory, &users[1]).await;

    let _: ActionHash = conductors[0]
        .call(
            &alice.zome("administration"),
            "revoke_role",
            serde_json::json!({ "grant": first_grant, "reason": "testing a second appointment" }),
        )
        .await;
    await_consistency_s(15, [alice, &mallory]).await.unwrap();
    assert_eq!(
        admin_grant_of(&conductors[0], alice, &her).await,
        None,
        "revoked, Mallory administers nothing"
    );

    let second_grant = made_administrator(&conductors, alice, &mallory, &users[1]).await;
    assert_ne!(
        second_grant, first_grant,
        "the second appointment is a new grant, not the revoked one"
    );
}

/// With the roster emptied by a forged tombstone, a new user still registers,
/// and does not become an administrator.
///
/// No progenitor key, as alpha 2 ships. Alice is the first user and so the
/// administrator. Mallory tombstones Alice's roster link, which no rule
/// refuses yet. `create_user` offers the root to the first user, and it used
/// to decide "first" by the roster: read that way, Bob would be made an
/// administrator (before the grants were asked anywhere), or `create_user`
/// would fail for him and everyone after him (once `add_administrator` asked
/// the grants and `create_user` did not).
///
/// **To make it go red:** have `create_user` decide from
/// `get_all_administrators_links` again: Bob's registration fails.
#[tokio::test(flavor = "multi_thread")]
async fn a_new_user_registers_when_the_roster_has_been_emptied() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, false).await;
    let (alice, bob) = (&cells[0], &cells[1]);

    // One at a time: on a network with no key, who is first is the question.
    for (i, cell, name) in [(0usize, alice, "Alice"), (2, &mallory, "Mallory")] {
        conductors[i]
            .call::<_, Record>(&cell.zome("users_organizations"), "create_user", sample_user(name))
            .await;
        await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    }
    assert!(
        admin_grant_of(&conductors[0], alice, alice.agent_pubkey()).await.is_some(),
        "Alice, the first user, administers the network"
    );

    let roster: Vec<Link> = conductors[2]
        .call(
            &mallory.zome("administration"),
            "get_all_administrators_links",
            "network".to_string(),
        )
        .await;
    assert!(!roster.is_empty(), "the roster lists Alice before the tombstone");
    for link in roster {
        forge_delete_link(&conductors[2], &mallory, link.create_link_hash)
            .await
            .expect("no rule refuses a tombstone on a roster link yet");
    }
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let registered = reason(
        conductors[1]
            .call_fallible::<_, Record>(
                &bob.zome("users_organizations"),
                "create_user",
                sample_user("Bob"),
            )
            .await,
    );
    assert!(
        registered.is_ok(),
        "Bob registers though the roster reads empty; got {registered:?}"
    );
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();
    assert_eq!(
        admin_grant_of(&conductors[0], alice, bob.agent_pubkey()).await,
        None,
        "and is not made an administrator: Alice still holds a live grant"
    );
    assert!(
        admin_grant_of(&conductors[0], alice, alice.agent_pubkey()).await.is_some(),
        "Alice still administers"
    );
}

/// An administrator who removes the one who appointed them still stands.
///
/// Mallory's grant rests on Alice's. Removing Alice revokes Alice's grant,
/// not Mallory's: what a holder gave while they held a role stands when they
/// lose it (removing a role never undoes past acts). Through the honest
/// calls, on Mallory's own conductor.
///
/// **To make it go red:** have `live_grants_of` leave out any grant whose
/// authority has been revoked: Mallory then holds nothing.
#[tokio::test(flavor = "multi_thread")]
async fn an_administrator_who_removes_their_appointer_still_stands() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(1, true).await;
    let alice = &cells[0];
    let users = everyone_accepted(&conductors, &[alice, &mallory]).await;
    let me = mallory.agent_pubkey().clone();
    made_administrator(&conductors, alice, &mallory, &users[1]).await;

    let removed: bool = conductors[1]
        .call(
            &mallory.zome("administration"),
            "remove_administrator",
            serde_json::json!({
                "entity": "network",
                "entity_original_action_hash": users[0],
                "agent_pubkeys": [alice.agent_pubkey()],
            }),
        )
        .await;
    assert!(removed, "Mallory removes Alice, who appointed her");
    await_consistency_s(15, [alice, &mallory]).await.unwrap();

    for (i, cell, where_asked) in [(0usize, alice, "Alice's"), (1, &mallory, "Mallory's")] {
        assert!(
            admin_grant_of(&conductors[i], cell, &me).await.is_some(),
            "Mallory still administers, asked on {where_asked} conductor"
        );
        assert_eq!(
            admin_grant_of(&conductors[i], cell, alice.agent_pubkey()).await,
            None,
            "Alice no longer does, asked on {where_asked} conductor"
        );
    }
}

/// An administrator removes several keys in one call, their own among them.
///
/// Alice appoints Bob and Mallory, then removes herself and Mallory together,
/// her own key listed first. Each revocation rests on the caller's own grant,
/// so her own key has to go last or she could not revoke the other. Bob is
/// left administering. An empty list of keys is refused first: it would pass
/// the last-administrator rule and tidy a roster link while removing nobody.
///
/// **To make it go red:** have `remove_administrator` revoke the keys in the
/// order given: revoking Mallory then fails as `Unauthorized`.
#[tokio::test(flavor = "multi_thread")]
async fn several_keys_are_removed_in_one_call_the_callers_own_last() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let me = alice.agent_pubkey().clone();
    for (user, cell) in [(&users[1], bob), (&users[2], &mallory)] {
        let added: bool = conductors[0]
            .call(
                &alice.zome("administration"),
                "add_administrator",
                serde_json::json!({
                    "entity": "network",
                    "entity_original_action_hash": user,
                    "agent_pubkeys": [cell.agent_pubkey()],
                }),
            )
            .await;
        assert!(added, "Alice appoints a second and a third administrator");
    }
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    let nobody = reason(
        conductors[0]
            .call_fallible::<_, bool>(
                &alice.zome("administration"),
                "remove_administrator",
                serde_json::json!({
                    "entity": "network",
                    "entity_original_action_hash": users[0],
                    "agent_pubkeys": [],
                }),
            )
            .await,
    );
    match &nobody {
        Ok(_) => panic!("a removal that names no key should be refused"),
        Err(text) => assert!(
            text.contains("an administrator needs an agent key"),
            "a removal that names no key should say so; got {text}"
        ),
    }

    let removed: bool = conductors[0]
        .call(
            &alice.zome("administration"),
            "remove_administrator",
            serde_json::json!({
                "entity": "network",
                "entity_original_action_hash": users[0],
                "agent_pubkeys": [me, mallory.agent_pubkey()],
            }),
        )
        .await;
    assert!(removed, "Alice removes herself and Mallory in one call");
    await_consistency_s(15, [alice, bob, &mallory]).await.unwrap();

    assert_eq!(admin_grant_of(&conductors[1], bob, &me).await, None);
    assert_eq!(
        admin_grant_of(&conductors[1], bob, mallory.agent_pubkey()).await,
        None
    );
    assert!(
        admin_grant_of(&conductors[1], bob, bob.agent_pubkey()).await.is_some(),
        "Bob is left administering the network"
    );
}

/// An `Inbox` link is its author's record of their own message, through
/// `validate` and not only as pure functions.
///
/// Three of the link rules of `messaging_integrity` (the tag, the author
/// match, who may delete) are unit-tested as `check_*` functions; the other
/// two (the base is an agent key, the target is a message) are inline in
/// `validate`. This drives all five through the network with a forged link,
/// so a rule computed in `validate` and not returned would show. Everyone is
/// an accepted member, so the grant rule is not what refuses anything here.
///
/// **To make it go red:** in `messaging_integrity/src/lib.rs`, the `Inbox`
/// arms of `validate`, return `Valid` before the check a row names: that
/// row's link, or the tombstone, is written.
#[tokio::test(flavor = "multi_thread")]
async fn an_inbox_link_is_its_authors_record_of_their_own_message() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let messaging = zome_index(&conductors[2], &mallory, "messaging_integrity").await;
    let me = mallory.agent_pubkey().clone();
    let alice_key = alice.agent_pubkey().clone();

    // Bob writes to Alice, and Mallory to Bob, through the app.
    let from_bob: Vec<SentMessage> = conductors[1]
        .call(
            &bob.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: users[0].clone(),
                content: "for Alice only".to_string(),
            },
        )
        .await;
    let from_mallory: Vec<SentMessage> = conductors[2]
        .call(
            &mallory.zome("messaging"),
            "send_message",
            SendMessageInput {
                to_user: users[1].clone(),
                content: "hello Bob".to_string(),
            },
        )
        .await;
    await_consistency_s(30, [alice, bob, &mallory]).await.unwrap();
    let bobs_message = from_bob
        .iter()
        .find(|sent| sent.agent == alice_key)
        .expect("Bob's message has a copy for Alice")
        .hash
        .clone();
    let mallorys_message = from_mallory[0].hash.clone();

    let link = |base: AnyLinkableHash, target: AnyLinkableHash, tag: Vec<u8>| {
        forge_link(&conductors[2], &mallory, base, target, messaging, INBOX_LINK, tag)
    };

    // An interloper cannot link somebody else's message into an inbox.
    refused(
        &link(me.clone().into(), bobs_message.clone().into(), Vec::new()).await,
        "must be authored by the author of the message it points to",
        "linking Bob's message into another inbox",
    );
    // Her own message, but a tag that could carry a label.
    refused(
        &link(alice_key.clone().into(), mallorys_message.clone().into(), vec![1]).await,
        "tag must be empty",
        "an Inbox link with a tag",
    );
    // Her own message, hung from something that is not anybody's inbox.
    refused(
        &link(users[0].clone().into(), mallorys_message.into(), Vec::new()).await,
        "An Inbox link's base must be an agent key",
        "an Inbox link whose base is a User record",
    );
    // A target that is not a message at all.
    refused(
        &link(alice_key.clone().into(), users[0].clone().into(), Vec::new()).await,
        "target must be an EncryptedMessage",
        "an Inbox link to a User record",
    );

    // And nobody but its author takes a link out of an inbox.
    let inbox = links_of(&conductors[2], &mallory, alice_key.into(), messaging, INBOX_LINK).await;
    let bobs_link = inbox
        .iter()
        .find(|l| l.target == bobs_message.clone().into())
        .expect("Bob's Inbox link to Alice is held by Mallory's node")
        .create_link_hash
        .clone();
    let removed = forge_delete_link(&conductors[2], &mallory, bobs_link).await;
    refused(
        &removed,
        "Only the author of an Inbox link may delete it",
        "tombstoning Bob's Inbox link",
    );
}

/// An accepted member with no member grant is told so, and nothing is written.
///
/// Acceptance writes the grant and the accepted link together, so the usual way
/// to be accepted without a grant is propagation: one reached this node before
/// the other. The same state is reached here without a race: Alice revokes
/// Bob's member grant with `revoke_role` and leaves his status accepted. His
/// send is then refused by the app with the error that names the grant, before
/// anything is encrypted or committed, and he has sent nothing.
///
/// **To make it go red:** in `deliver`, attach `None` when `can_i` finds no
/// grant instead of returning `NoMemberGrantYet`: the send then fails on the
/// validation message ("a message is a role act"), not on this one.
#[tokio::test(flavor = "multi_thread")]
async fn an_accepted_member_with_no_grant_is_told_so_and_sends_nothing() {
    let (conductors, cells, mallory) = setup_agents_and_a_forger(2, true).await;
    let (alice, bob) = (&cells[0], &cells[1]);
    let users = everyone_accepted(&conductors, &[alice, bob, &mallory]).await;
    let bobs_member_grant = grants_of(&conductors[0], alice, bob.agent_pubkey())
        .await
        .into_iter()
        .find(|(_, grant)| grant.role == "member")
        .map(|(hash, _)| hash)
        .expect("an accepted member holds a member grant");

    let _: ActionHash = conductors[0]
        .call(
            &alice.zome("administration"),
            "revoke_role",
            serde_json::json!({ "grant": bobs_member_grant, "reason": "testing a send with no grant" }),
        )
        .await;
    await_consistency_s(30, [alice, bob, &mallory]).await.unwrap();

    let sent = reason(
        conductors[1]
            .call_fallible::<_, Vec<SentMessage>>(
                &bob.zome("messaging"),
                "send_message",
                SendMessageInput {
                    to_user: users[0].clone(),
                    content: "can you hear me".to_string(),
                },
            )
            .await,
    );
    match &sent {
        Ok(copies) => panic!("a member with no grant should not send; wrote {copies:?}"),
        Err(text) => assert!(
            text.contains("no member grant yet"),
            "the refusal should name the missing grant; got {text}"
        ),
    }

    let bobs_sent: Vec<serde_json::Value> = conductors[1]
        .call(&bob.zome("messaging"), "get_sent", ())
        .await;
    assert!(
        bobs_sent.is_empty(),
        "nothing was written by the refused send; got {bobs_sent:?}"
    );
}
