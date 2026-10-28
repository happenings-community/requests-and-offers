//! Misc zome tests — translated from `misc/misc.test.ts`.

use holochain::prelude::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn ping() {
    let (conductors, alice, _bob) = setup_two_agents().await;

    let result: String = conductors[0]
        .call(&alice.zome("misc"), "ping", ())
        .await;

    assert_eq!(result, "Pong");
}

/// Mirror of the misc zome's `NetworkInfo`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NetworkInfo {
    integrity_zome_names: Vec<String>,
}

/// `get_network_info` names the DNA's integrity zomes, and only those.
///
/// The interface reads this list to know whether an optional module is part of the
/// network. It is compared with the installed DNA's own definition rather than with a
/// list typed here, so the test stays right as modules are added or left out.
///
/// **To make this go red:** in the misc zome, drop one name before returning the list,
/// or return the coordinator zomes as well.
#[tokio::test(flavor = "multi_thread")]
async fn network_info_names_the_integrity_zomes() {
    let (conductors, alice, _bob) = setup_two_agents().await;

    let info: NetworkInfo = conductors[0]
        .call(&alice.zome("misc"), "get_network_info", ())
        .await;

    let dna_def = conductors[0]
        .get_dna_def(alice.cell_id())
        .expect("the installed DNA should have a definition");
    let expected: Vec<String> = dna_def
        .integrity_zomes
        .iter()
        .map(|(name, _)| name.to_string())
        .collect();

    assert_eq!(
        info.integrity_zome_names, expected,
        "the list should match the installed DNA's integrity zomes, in order"
    );
    assert!(
        !info.integrity_zome_names.iter().any(|name| name == "misc"),
        "coordinator zomes are not listed; misc has no integrity zome"
    );
}
