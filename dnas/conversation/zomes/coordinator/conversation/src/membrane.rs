use conversation_integrity::*;
use hdk::prelude::*;
use utils::errors::CommonError;

use crate::conversation_properties;
use crate::errors::ConversationError;

/// Issue a membrane proof admitting `for_agent` to this conversation clone.
///
/// Only for agents not named in the clone's properties, which in this design means an
/// invited administrator: participants are admitted by identity and need no proof.
///
/// Mirrors Volla's `generate_membrane_proof`
/// (`_reference/volla-messages/dnas/relay/zomes/coordinator/relay/src/lib.rs` line 257):
/// sign the data struct, wrap it, serialise. Signing over the struct rather than raw bytes
/// means `sign` here and `verify_signature` in `check_agent` serialise through one
/// mechanism and cannot drift apart. Do not add a byte-encoding helper.
///
/// `conversation_id` is read from `dna_info()` rather than taken as input, as Volla does:
/// a caller-supplied id that mismatched would produce a proof rejected at the recipient's
/// genesis, with nothing surfacing to the issuer.
#[hdk_extern]
pub fn issue_membrane_proof(for_agent: AgentPubKey) -> ExternResult<SerializedBytes> {
  let props = conversation_properties()?;
  let me = agent_info()?.agent_initial_pubkey;

  if !props.peers.contains(&me) {
    return Err(ConversationError::NotAParticipant.into());
  }

  let data = MembraneProofData {
    conversation_id: props.conversation_id,
    for_agent,
    signer: me.clone(),
  };

  let envelope = MembraneProofEnvelope {
    signature: sign(me, data.clone())?,
    data,
  };

  SerializedBytes::try_from(envelope).map_err(|e| CommonError::Serialize(e).into())
}
