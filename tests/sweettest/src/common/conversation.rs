//! Conductor setup for the conversation DNA.
//!
//! Separate from `conductors.rs` because that module installs a single DNA via
//! `SweetConductor::setup_app`, which hardcodes `None` for every membrane proof
//! (`holochain-0.6.1/src/sweettest/sweet_conductor.rs` line 323, an upstream TODO,
//! unchanged in 0.6.3 and 0.7.0). The conversation DNA gates genesis on a proof, so
//! it needs `ConductorHandle::install_app_bundle`, which is public and takes a
//! per-role `RoleSettings::Provisioned { membrane_proof, modifiers }`.

use holochain::conductor::error::ConductorResult;
use holochain::prelude::*;
use holochain::sweettest::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Path to the packed hApp bundle. `bun run build:happ` must have been run.
pub const HAPP_PATH: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../workdir/requests_and_offers.happ"
);

/// The conversation role name in `workdir/happ.yaml`.
pub const CONVERSATION_ROLE: &str = "conversation";

/// Mirror of `Properties` from `conversation_integrity`.
///
/// Mirrored rather than imported: each integrity crate emits C-level
/// `__num_entry_types` / `__num_link_types` symbols that collide when two are linked
/// into one binary (see `mirrors.rs`).
///
/// Keys are base64 strings here because the conductor takes properties as
/// `YamlProperties` and converts to msgpack, which the zome then reads as typed
/// `AgentPubKey`. This is the shape Volla uses in production.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationProperties {
    pub peers: Vec<String>,
    pub conversation_id: String,
}

/// Mirror of `MembraneProofData`.
#[derive(Debug, Clone, Serialize, Deserialize, SerializedBytes)]
pub struct MembraneProofData {
    pub conversation_id: String,
    pub for_agent: AgentPubKey,
    pub signer: AgentPubKey,
}

/// Mirror of `MembraneProofEnvelope`.
#[derive(Debug, Clone, Serialize, Deserialize, SerializedBytes)]
pub struct MembraneProofEnvelope {
    pub signature: Signature,
    pub data: MembraneProofData,
}

/// Sort keys as the integrity zome requires: ascending and distinct.
pub fn ordered_peers(keys: &[AgentPubKey]) -> Vec<AgentPubKey> {
    let mut out = keys.to_vec();
    out.sort();
    out.dedup();
    out
}

/// Build conversation properties from the peer list exactly as given, including an
/// order the integrity zome will refuse. For tests that exercise the ordering guard.
pub fn conversation_properties_unchecked(
    peers: &[AgentPubKey],
    conversation_id: &str,
) -> YamlProperties {
    let props = ConversationProperties {
        peers: peers.iter().map(|k| k.to_string()).collect(),
        conversation_id: conversation_id.to_string(),
    };

    YamlProperties::new(serde_yaml::to_value(props).expect("properties should serialise to YAML"))
}

/// Build conversation properties for a peer set, sorted as the zome requires.
pub fn conversation_properties(
    peers: &[AgentPubKey],
    conversation_id: &str,
) -> YamlProperties {
    conversation_properties_unchecked(&ordered_peers(peers), conversation_id)
}

/// Install the hApp on `conductor`, provisioning the conversation role with the given
/// properties and optional membrane proof.
///
/// `ignore_genesis_failure` is set so a refused proof leaves the app installed with
/// empty cells rather than uninstalling it, which makes the refusal observable.
pub async fn install_with_conversation(
    conductor: &SweetConductor,
    properties: YamlProperties,
    membrane_proof: Option<MembraneProof>,
    agent: Option<AgentPubKey>,
) -> ConductorResult<InstalledApp> {
    let mut roles_settings: RoleSettingsMap = HashMap::new();
    roles_settings.insert(
        CONVERSATION_ROLE.to_string(),
        RoleSettings::Provisioned {
            membrane_proof,
            modifiers: Some(DnaModifiersOpt::default().with_properties(properties)),
        },
    );

    conductor
        .raw_handle()
        .install_app_bundle(InstallAppPayload {
            source: AppBundleSource::Path(std::path::PathBuf::from(HAPP_PATH)),
            agent_key: agent,
            installed_app_id: Some("requests_and_offers".to_string()),
            network_seed: None,
            roles_settings: Some(roles_settings),
            ignore_genesis_failure: true,
        })
        .await
}

/// Assert an install was refused, and refused for the expected reason.
///
/// Validation messages reach the caller intact inside
/// `GenesisFailed -> WorkflowError -> GenesisFailure`, so a substring match is enough.
pub fn assert_refused<T>(result: ConductorResult<T>, expected: &str) {
    match result {
        Ok(_) => panic!("expected genesis to be refused, but the install succeeded"),
        Err(err) => {
            let text = format!("{err:?}");
            assert!(
                text.contains(expected),
                "refused, but not for the expected reason.\n  expected: {expected}\n  actual: {text}"
            );
        }
    }
}

/// Sign a membrane proof admitting `for_agent`, as `issue_membrane_proof` does.
pub async fn issue_proof(
    conductor: &SweetConductor,
    signer: &AgentPubKey,
    for_agent: &AgentPubKey,
    conversation_id: &str,
) -> MembraneProof {
    let data = MembraneProofData {
        conversation_id: conversation_id.to_string(),
        for_agent: for_agent.clone(),
        signer: signer.clone(),
    };

    // The keystore signs raw bytes. The zome's `sign(key, data)` serialises the struct
    // to msgpack via SerializedBytes first, so this must do the same or the signature
    // will not verify inside the DNA.
    let bytes = SerializedBytes::try_from(data.clone()).expect("proof data should serialise");
    let signature = conductor
        .raw_handle()
        .keystore()
        .sign(signer.clone(), bytes.bytes().to_vec().into())
        .await
        .expect("signing should succeed");

    let envelope = MembraneProofEnvelope { signature, data };

    Arc::new(SerializedBytes::try_from(envelope).expect("envelope should serialise"))
}
