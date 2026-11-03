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

fn reason<T, E: std::fmt::Debug>(outcome: Result<T, E>) -> Result<T, String> {
    outcome.map_err(|e| format!("{e:?}"))
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
const SERVICE_TYPE: u8 = 0;
/// After `Status`: `utils::grants::ROLE_GRANT_ENTRY_INDEX`.
const ROLE_GRANT: u8 = 1;
/// `OrganizationCoordinators` in `users_organizations_integrity::LinkTypes`.
const ORGANIZATION_COORDINATORS_LINK: u8 = 8;
/// `AgentGrants` and `GrantRevocations` in `administration_integrity::LinkTypes`.
const AGENT_GRANTS_LINK: u8 = 6;
const GRANT_REVOCATIONS_LINK: u8 = 8;

// ── Cases ───────────────────────────────────────────────────────────────────

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

/// The grant indexes are what `can` reads, so a tombstone on one is refused:
/// Mallory cannot hide her own index (which would lock an honest holder out
/// the same way), and a revoked member cannot delete the link that records
/// the revocation and come back. After both refusals `can` still says what
/// it said.
///
/// **To make it go red:** in `administration_integrity/src/lib.rs`, the
/// `DeleteLink` match, remove the `AgentGrants | AllGrants | GrantRevocations`
/// arm so those deletes fall through to `Valid`. The first tombstone is
/// written, and after the second `get_agent_grants` returns Mallory's member
/// grant again.
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
    let index = links_of(&conductors[1], &mallory, me.clone().into(), administration, AGENT_GRANTS_LINK).await;
    let index_link = index
        .iter()
        .find(|l| l.target == grant.clone().into())
        .expect("the member grant is indexed from Mallory's key")
        .create_link_hash
        .clone();

    let hidden = forge_delete_link(&conductors[1], &mallory, index_link).await;
    refused(&hidden, "never tombstoned", "tombstoning a holder's grant index");

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

    // Alice suspends Mallory, so the status Mallory wants to rewrite is a real one.
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
