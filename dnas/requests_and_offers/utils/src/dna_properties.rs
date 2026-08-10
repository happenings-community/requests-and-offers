use hdk::prelude::*;

use crate::errors::CommonError;

/// `deny_unknown_fields` is load-bearing rather than tidiness.
///
/// Without it, serde treats an absent `progenitor_pubkey` as `None` and silently skips
/// every field it does not recognise, so this struct deserialises successfully from *any*
/// DNA's properties and reports "no progenitor configured". `check_if_progenitor`
/// (`dnas/requests_and_offers/utils/src/lib.rs` line 16) then returns `false` permanently,
/// and the doc comment below invites a reader to treat that as dev mode. Proven by
/// `conversation_properties_are_rejected`.
///
/// The cost is a coupling: any property added to `workdir/happ.yaml` must be added here in
/// the same change, or every progenitor check in the app fails at the first zome call.
/// That is deliberate. A loud failure at deploy time beats silently denying the progenitor
/// their own status, which is the exact shape the membrane work would otherwise introduce
/// when it adds its own properties. Proven by `additional_properties_are_rejected`.
///
/// `workdir/happ.yaml` line 15 is the manifest this must stay in step with.
#[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
#[serde(deny_unknown_fields)]
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

#[cfg(test)]
mod tests {
  use super::*;

  /// A hand-written mirror of `conversation_integrity::Properties`
  /// (`dnas/conversation/zomes/integrity/conversation/src/lib.rs` line 16), copied field
  /// for field. A mirror rather than a dependency, because the shared DNA must not depend
  /// on a conversation DNA.
  #[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
  struct ConversationProperties {
    progenitor: AgentPubKey,
    conversation_id: String,
  }

  /// Models a `workdir/happ.yaml` that has gained a property this struct does not declare.
  /// Not speculative: separating an admin progenitor from a membrane signer is exactly the
  /// shape the membrane management work introduces.
  #[derive(Serialize, Deserialize, SerializedBytes, Debug, Clone)]
  struct WidenedProperties {
    progenitor_pubkey: Option<String>,
    membrane_progenitor: Option<String>,
  }

  /// The trap. Before `deny_unknown_fields` this returned `Ok(None)`, which
  /// `get_progenitor_pubkey` reports as an unconfigured DNA.
  #[test]
  fn conversation_properties_are_rejected() {
    let conversation = ConversationProperties {
      progenitor: AgentPubKey::from_raw_36(vec![0; 36]),
      conversation_id: "a-conversation".to_string(),
    };

    let bytes =
      SerializedBytes::try_from(conversation).expect("conversation properties should serialize");

    if let Ok(props) = DnaProperties::try_from(bytes) {
      panic!(
        "conversation properties deserialized as DnaProperties: {:?}, so deny_unknown_fields \
         is not doing its job",
        props
      );
    }
  }

  /// The one that matters most. Eleven crates depend on this reading correctly.
  /// `workdir/happ.yaml` line 15 is an explicit null, so the unset case is the live one.
  #[test]
  fn shared_dna_properties_still_deserialize() {
    let unset = DnaProperties {
      progenitor_pubkey: None,
    };
    let bytes = SerializedBytes::try_from(unset).expect("unset should serialize");
    let read = DnaProperties::try_from(bytes).expect("unset progenitor must still deserialize");
    assert_eq!(read.progenitor_pubkey, None);

    let set = DnaProperties {
      progenitor_pubkey: Some("uhCAkSomeAgentKey".to_string()),
    };
    let bytes = SerializedBytes::try_from(set).expect("set should serialize");
    let read = DnaProperties::try_from(bytes).expect("set progenitor must still deserialize");
    assert_eq!(
      read.progenitor_pubkey,
      Some("uhCAkSomeAgentKey".to_string())
    );
  }

  /// Documents the coupling cost as an executable fact. When this starts failing in
  /// earnest, the fix is to add the new field to `DnaProperties`, not to remove the
  /// attribute.
  #[test]
  fn additional_properties_are_rejected() {
    let widened = WidenedProperties {
      progenitor_pubkey: None,
      membrane_progenitor: Some("uhCAkSomeSignerKey".to_string()),
    };

    let bytes = SerializedBytes::try_from(widened).expect("widened should serialize");

    if DnaProperties::try_from(bytes).is_ok() {
      panic!("a widened properties map deserialized, so deny_unknown_fields is not live");
    }
  }
}
