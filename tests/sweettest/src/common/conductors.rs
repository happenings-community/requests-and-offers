//! Conductor setup helpers.
//!
//! These replace the TypeScript `runScenario` / `runScenarioWithTwoAgents`
//! helpers from `tests/src/requests_and_offers/utils.ts`.

use holochain::prelude::*;
use holochain::sweettest::*;
use serde::{Deserialize, Serialize};

/// Path to the compiled requests-and-offers DNA bundle.
/// Resolved relative to this crate's Cargo.toml.
pub const DNA_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../workdir/requests_and_offers.dna"
);

/// The hardcoded progenitor pubkey from workdir/happ.yaml.
///
/// Tests that require Alice to be the network progenitor should use
/// `setup_two_agents_with_alice_as_progenitor()` instead.
pub const HARDCODED_PROGENITOR_PUBKEY: &str =
    "uhCAkVNjcdnXfoExk87X1hKArKH43bZnAidlsSgqBqeGvFpOPiUCT";

/// DNA properties struct — mirrors `DnaProperties` from `utils/dna_properties.rs`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DnaProperties {
    pub progenitor_pubkey: String,
}
// Required to call SerializedBytes::try_from(DnaProperties {...}).
holochain_serialized_bytes::holochain_serial!(DnaProperties);

/// Build a `SweetDnaFile` with the given progenitor pubkey embedded as a
/// DNA property modifier.
///
/// Uses `from_bundle_with_overrides` so each call also applies a fresh
/// network seed — tests run in isolation.
async fn build_dna(progenitor_pubkey: impl Into<String>) -> DnaFile {
    let props = DnaProperties {
        progenitor_pubkey: progenitor_pubkey.into(),
    };
    let props_bytes = SerializedBytes::try_from(props)
        .expect("Failed to serialize DnaProperties");

    SweetDnaFile::from_bundle_with_overrides(
        std::path::Path::new(DNA_PATH),
        DnaModifiersOpt::default().with_properties(props_bytes),
    )
    .await
    .unwrap_or_else(|e| {
        panic!(
            "Failed to load requests-and-offers DNA bundle at {DNA_PATH}: {e}\n\
             Did you run `bun run build:happ`?"
        )
    })
}

/// Spin up two conductors, each with the requests-and-offers DNA installed.
///
/// Uses the hardcoded progenitor pubkey from `happ.yaml`. Suitable for all
/// tests that do not need Alice to be the network progenitor.
///
/// Returns `(conductors, cell_alice, cell_bob)`.
pub async fn setup_two_agents() -> (SweetConductorBatch, SweetCell, SweetCell) {
    let mut conductors =
        SweetConductorBatch::from_config_rendezvous(2, SweetConductorConfig::standard()).await;

    let dna = build_dna(HARDCODED_PROGENITOR_PUBKEY).await;

    let apps = conductors
        .setup_app("requests_and_offers", &[dna])
        .await
        .expect("Failed to install requests-and-offers app");

    conductors.exchange_peer_info().await;

    let ((cell_alice,), (cell_bob,)) = apps.into_tuples();
    (conductors, cell_alice, cell_bob)
}

/// Accept an entity's status using an admin conductor's administration zome.
///
/// Fetches the current status record for the entity via
/// `get_latest_status_record_for_entity`, then calls `update_entity_status`
/// with an "accepted" status. The `admin_conductor` / `admin_cell` pair must
/// belong to an agent that is already registered as a network administrator.
///
/// # Panics
///
/// Panics if the entity has no status record yet (i.e. it was never
/// created through a zome call that initialises a status).
pub async fn accept_entity(
    admin_conductor: &SweetConductor,
    admin_cell: &SweetCell,
    entity: &str,
    entity_hash: ActionHash,
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

    let status_record =
        status_record.unwrap_or_else(|| panic!("No status record found for entity {entity}"));
    let status_hash = status_record.signed_action.hashed.hash.clone();

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
                    "status_type": "accepted",
                    "reason": null,
                    "suspended_until": null
                }
            }),
        )
        .await;
}

/// Spin up two conductors where Alice's `AgentPubKey` is embedded as the
/// progenitor in the DNA properties.
///
/// Use this for tests that exercise progenitor-gated operations (e.g. initial
/// network administrator registration when progenitor check is enforced).
///
/// Returns `(conductors, cell_alice, cell_bob)`.
pub async fn setup_two_agents_with_alice_as_progenitor() -> (
    SweetConductorBatch,
    SweetCell,
    SweetCell,
) {
    // Conductors must exist before we can generate keys from their keystore.
    let mut conductors =
        SweetConductorBatch::from_config_rendezvous(2, SweetConductorConfig::standard()).await;

    // Generate Alice's key BEFORE installing the app so we can embed it.
    let alice_key = SweetAgents::one(conductors[0].keystore()).await;

    // Encode key as the hc-style base64url string with leading 'u'.
    let alice_key_str = alice_key.to_string();

    let dna = build_dna(alice_key_str).await;

    // Install for Alice using the pre-generated key.
    let alice_app = conductors[0]
        .setup_app_for_agent("requests_and_offers", alice_key, &[dna.clone()])
        .await
        .expect("Failed to install app for Alice");

    // Bob gets a freshly-generated key.
    let bob_app = conductors[1]
        .setup_app("requests_and_offers", &[dna])
        .await
        .expect("Failed to install app for Bob");

    conductors.exchange_peer_info().await;

    let (cell_alice,) = alice_app.into_tuple();
    let (cell_bob,) = bob_app.into_tuple();

    (conductors, cell_alice, cell_bob)
}
