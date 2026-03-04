use hdk::prelude::*;

use crate::errors::CommonError;

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct DnaProperties {
  pub progenitor_pubkey: Option<String>,
}

impl DnaProperties {
  pub fn get() -> ExternResult<Self> {
    dna_info()?
      .modifiers
      .properties
      .try_into()
      .map_err(|err| CommonError::Serialize(err).into())
  }

  /// Returns the configured progenitor public key, or `None` when not set (e.g. dev mode).
  pub fn get_progenitor_pubkey() -> ExternResult<Option<AgentPubKey>> {
    match DnaProperties::get()?.progenitor_pubkey {
      None => Ok(None),
      Some(s) => AgentPubKey::try_from(s)
        .map(Some)
        .map_err(|err| CommonError::HoloHash(err).into()),
    }
  }
}
