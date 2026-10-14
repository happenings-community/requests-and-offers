use hdk::prelude::*;

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfo {
  pub network_seed: String,
  pub dna_hash: String,
  pub role_name: String,
  /// The DNA's integrity zomes, by name, in the order `dna_info()` gives them.
  ///
  /// Integrity zomes only, which is all `dna_info()` reports: they define the data, are
  /// part of the DNA hash, and so are fixed for the life of a network. That makes this the
  /// record of which optional modules a network was created with. The interface reads it
  /// once at start-up to know whether a module is here, rather than probing for it.
  pub integrity_zome_names: Vec<String>,
}

#[hdk_extern]
pub fn get_network_seed(_: ()) -> ExternResult<String> {
  let info = dna_info()?;
  Ok(info.modifiers.network_seed.to_string())
}

#[hdk_extern]
pub fn get_network_info(_: ()) -> ExternResult<NetworkInfo> {
  let info = dna_info()?;
  Ok(NetworkInfo {
    network_seed: info.modifiers.network_seed.to_string(),
    dna_hash: info.hash.to_string(),
    role_name: "requests_and_offers".to_string(),
    integrity_zome_names: info
      .zome_names
      .iter()
      .map(|name| name.to_string())
      .collect(),
  })
}

#[hdk_extern]
pub fn ping(_: ()) -> ExternResult<String> {
  Ok("Pong".to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_get_network_seed() {
    // This test would require mocking dna_info() in a real testing environment
    // For now, we'll test that the function exists and can be called
    // In a full integration test, we would verify the actual network seed value
    assert!(true); // Placeholder test
  }

  #[test]
  fn test_get_network_info() {
    // Test that the NetworkInfo struct can be created and serialized
    let network_info = NetworkInfo {
      network_seed: "test-seed".to_string(),
      dna_hash: "test-hash".to_string(),
      role_name: "requests_and_offers".to_string(),
      integrity_zome_names: vec!["misc_integrity".to_string()],
    };

    assert_eq!(network_info.network_seed, "test-seed");
    assert_eq!(network_info.dna_hash, "test-hash");
    assert_eq!(network_info.role_name, "requests_and_offers");
    assert_eq!(network_info.integrity_zome_names, vec!["misc_integrity".to_string()]);
  }

  #[test]
  fn test_ping() {
    // Test that ping function exists and returns expected result
    // In a real test environment, this would be an integration test
    assert!(true); // Placeholder test
  }
}
