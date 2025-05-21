use hdk::prelude::*;

use crate::errors::CommonError;

#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
pub struct DnaProperties {
  pub progenitor_pubkey: String,
}

impl DnaProperties {
  pub fn get() -> ExternResult<Self> {
    dna_info()?
      .modifiers
      .properties
      .try_into()
      .map_err(|err| CommonError::Serialize(err).into())
  }

  pub fn get_progenitor_pubkey() -> ExternResult<AgentPubKey> {
    let progenitor_pubkey_string = DnaProperties::get()?.progenitor_pubkey;

    AgentPubKey::try_from(progenitor_pubkey_string.clone())
      .map_err(|err| CommonError::HoloHash(err).into())
  }
}
