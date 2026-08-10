use hdi::prelude::*;

/// Volla's production shape: a plain `AgentPubKey`, not the base64 string the shared
/// `requests_and_offers` DNA uses, because a clone receives its properties from the clone
/// creation call at runtime rather than from YAML.
#[derive(Serialize, Deserialize, Debug, SerializedBytes, Clone)]
pub struct Properties {
  /// Every participant in this conversation, ascending by key bytes.
  ///
  /// Properties feed the DNA hash, so an unordered pair would let two participants derive
  /// two different hashes from the same conversation and land in separate networks with no
  /// error anywhere. `check_agent` enforces the ordering rather than trusting it.
  ///
  /// Both hold the same authority: either may admit an administrator. This is what makes
  /// unilateral invitation possible for both participants rather than only the one who
  /// answered the listing.
  pub peers: Vec<AgentPubKey>,

  /// Opaque random identifier, deliberately NOT the network seed as it is in Volla. A
  /// conversation id may reach a public hREA agreement, and the seed must stay secret:
  /// kitsune2 0.4.1's `GET /bootstrap/{space}` returns a space's agent list to any caller
  /// when no authentication hook is configured (note section 6). The seed must also be
  /// random and transmitted, never derived from public values.
  pub conversation_id: String,
}

/// False for the empty base cell, which carries no properties.
///
/// A base cell is provisioned on every install because `strategy: clone_only` hits
/// `unimplemented!()` in `holochain_conductor_api-0.6.1/src/app_interface.rs` at line 491,
/// byte-identical on upstream `main-0.6`. `deferred: true` is the same branch.
/// `dna_info()` is deterministic, so this is permitted in validation.
pub fn is_conversation_cell() -> ExternResult<bool> {
  Ok(dna_info()?.modifiers.properties.bytes().len() != 1)
}

/// Volla's naming. Their `as_role: u32` is not adopted: note section 10 gives an invited
/// administrator no distinct role.
#[derive(Serialize, Deserialize, Debug, SerializedBytes, Clone)]
pub struct MembraneProofData {
  pub conversation_id: String,
  pub for_agent: AgentPubKey,

  /// Inside the signed data, not on the envelope: the signature covers the claim of who
  /// issued it, so the signer field cannot be swapped for another peer's after signing.
  pub signer: AgentPubKey,
}

#[derive(Serialize, Deserialize, Debug, SerializedBytes)]
pub struct MembraneProofEnvelope {
  pub signature: Signature,
  pub data: MembraneProofData,
}

/// Deterministic: a properties read and a signature verification, no DHT access.
///
/// The signature covers the `MembraneProofData` struct rather than raw bytes, so `sign` and
/// `verify_signature` serialise through the same mechanism and cannot drift apart. No shared
/// byte-encoding helper is needed; do not add one.
pub fn check_agent(
  agent_pub_key: AgentPubKey,
  membrane_proof: Option<MembraneProof>,
) -> ExternResult<ValidateCallbackResult> {
  // The base cell must be joinable or the app will not install. It is not writable.
  if !is_conversation_cell()? {
    return Ok(ValidateCallbackResult::Valid);
  }

  let props =
    Properties::try_from(dna_info()?.modifiers.properties).map_err(|e| wasm_error!(e))?;

  // `windows(2)` with strict `<` rejects an unordered pair and a duplicated key together.
  // Not `is_sorted`, whose stabilisation varies by toolchain.
  if props.peers.len() < 2 || !props.peers.windows(2).all(|w| w[0] < w[1]) {
    return Ok(ValidateCallbackResult::Invalid(
      "conversation properties must carry at least two peers, ascending and distinct".to_string(),
    ));
  }

  // Participants are admitted by identity; nobody issues them a proof for their own clone.
  if props.peers.contains(&agent_pub_key) {
    return Ok(ValidateCallbackResult::Valid);
  }

  match membrane_proof {
    None => Ok(ValidateCallbackResult::Invalid(
      "a membrane proof is required to join this conversation".to_string(),
    )),
    Some(serialized_proof) => {
      let envelope =
        MembraneProofEnvelope::try_from((*serialized_proof).clone()).map_err(|e| wasm_error!(e))?;

      if envelope.data.conversation_id != props.conversation_id {
        return Ok(ValidateCallbackResult::Invalid(
          "membrane proof is not for this conversation".to_string(),
        ));
      }

      if envelope.data.for_agent != agent_pub_key {
        return Ok(ValidateCallbackResult::Invalid(
          "membrane proof is not for this agent".to_string(),
        ));
      }

      if !props.peers.contains(&envelope.data.signer) {
        return Ok(ValidateCallbackResult::Invalid(
          "membrane proof was not signed by a participant in this conversation".to_string(),
        ));
      }

      if verify_signature(
        envelope.data.signer.clone(),
        envelope.signature,
        envelope.data,
      )? {
        return Ok(ValidateCallbackResult::Valid);
      }

      Ok(ValidateCallbackResult::Invalid(
        "membrane proof signature invalid".to_string(),
      ))
    }
  }
}

/// Request, Offer, Direct. The note's list; Organization is not in it.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ContextType {
  Request,
  Offer,
  Direct,
}

/// Committed rather than rendered, because note section 10 requires the administrator
/// invitation announcement to be an entry a modified client cannot suppress. Structured
/// rather than prose so the member-facing wording stays a UI string, revisable and
/// translatable without a DNA change. `AdminInvited` names only the administrator; the
/// inviting participant is the action's author. Invitation policy is recorded on #91, and
/// the wording is a governance matter.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum SystemEvent {
  AdminInvited { admin: AgentPubKey },
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum MessageType {
  Text,
  System(SystemEvent),
}

/// No `participants` field: participants are the clone's membrane, not entry data (note
/// section 9). No `created_at`, so this entry is addressed purely by its content and
/// committing the same configuration twice yields one entry rather than two.
#[hdk_entry_helper]
#[derive(Clone)]
pub struct ConversationConfig {
  /// Points into the shared DNA. Resolved frontend-side, as hREA proposals already are.
  pub context_hash: Option<ActionHash>,

  pub context_type: ContextType,

  /// Also resolved frontend-side.
  pub proposal_id: Option<String>,
}

/// No `created_at`. The action header carries a timestamp, and a client-supplied one would
/// be forgeable: a participant could date a message into the past and have every client
/// render it earlier in the thread than it was sent.
#[hdk_entry_helper]
#[derive(Clone)]
pub struct Message {
  /// Plaintext (note section 6), and empty for system messages, whose payload is the event.
  pub content: String,

  pub message_type: MessageType,
  pub reply_to: Option<ActionHash>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  ConversationConfig(ConversationConfig),
  Message(Message),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  /// Time-bucketed for pagination. Bucket width not yet chosen.
  PathToMessage,

  MessageUpdates,

  /// NOT IN THE DESIGN NOTE. The note does not say how the configuration entry is
  /// discovered, and an entry nothing links to is unreachable. Reconcile against the note.
  PathToConfig,
}

/// Pinned to the lair IPC ceiling rather than a round number. Note section 6 records that
/// every zome crypto primitive rejects a single call above 8192 bytes and keeps two
/// encryption routes open, so a higher cap would foreclose encrypting one message unchunked.
const MAX_MESSAGE_BYTES: usize = 8192;

fn validate_message(message: &Message) -> ExternResult<ValidateCallbackResult> {
  match &message.message_type {
    // The event is the payload.
    MessageType::System(_) => {
      if !message.content.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
          "a system message must carry no content; its event is the payload".to_string(),
        ));
      }
    }

    MessageType::Text => {
      if message.content.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
          "message content must not be empty".to_string(),
        ));
      }

      // `String::len` is bytes, not chars, which is what the ceiling is measured in.
      if message.content.len() > MAX_MESSAGE_BYTES {
        return Ok(ValidateCallbackResult::Invalid(format!(
          "message content exceeds {} bytes",
          MAX_MESSAGE_BYTES
        )));
      }
    }
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Nothing checkable yet: `context_type` is type-checked by deserialisation, and the two
/// identifiers resolve in other cells, which validation cannot read.
fn validate_conversation_config(
  _config: &ConversationConfig,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

fn validate_entry(entry: &EntryTypes) -> ExternResult<ValidateCallbackResult> {
  match entry {
    EntryTypes::Message(message) => validate_message(message),
    EntryTypes::ConversationConfig(config) => validate_conversation_config(config),
  }
}

/// The base cell may be joined but never written to.
///
/// Its membrane admits anyone and every install shares its DNA hash, so it is one open
/// network every member joins. Nothing sensitive can leak from it, but left writable it is a
/// storage-abuse surface, since anything committed there is stored and gossiped by every
/// member's node. Integrity-level because a coordinator guard stops nobody who compiles
/// their own coordinator against this crate.
fn refuse_base_cell_write() -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(
    "the base conversation cell holds no conversation and accepts no writes".to_string(),
  ))
}

/// NOT IN THE DESIGN NOTE. Without it either participant could rewrite the other's messages
/// through the update chain, and the plain read every client performs would show the altered
/// text under the original author's name. `must_get_action` on a hash the action already
/// names is deterministic, so it is permitted here; enumerating with `get_links` would not be.
fn validate_update_author(
  original_action_hash: ActionHash,
  updating_author: &AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
  let original = must_get_action(original_action_hash)?;

  if original.action().author() != updating_author {
    return Ok(ValidateCallbackResult::Invalid(
      "only the agent who authored an entry may update it".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}

/// NOT IN THE DESIGN NOTE. The same forgery one layer down: linking an entry you authored
/// yourself from the other participant's message as its update.
fn validate_update_link_author(
  base_address: AnyLinkableHash,
  linking_author: &AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
  let Some(base_action_hash) = base_address.into_action_hash() else {
    return Ok(ValidateCallbackResult::Invalid(
      "a MessageUpdates link must be based on an action hash".to_string(),
    ));
  };

  let base = must_get_action(base_action_hash)?;

  match base.action().author() == linking_author {
    true => Ok(ValidateCallbackResult::Valid),
    false => Ok(ValidateCallbackResult::Invalid(
      "only the agent who authored a message may link an update to it".to_string(),
    )),
  }
}

/// Note section 8: crypto-shredding is unavailable on this stack, so removal is
/// leave-and-remove, which uninstalls the clone and its local databases. A delete would only
/// write a tombstone beside an entry that remains in the DHT regardless. Archiving is clone
/// disable. Volla does permit deletes, so this is a conscious divergence.
fn reject_delete() -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(
    "entries are not deletable in a conversation; removal is leaving the conversation".to_string(),
  ))
}

/// Runs on the joining agent's own device: a courtesy check a modified conductor can skip,
/// not the gate. The macro maps this to the versioned extern `genesis_self_check_2`.
#[hdk_extern]
pub fn genesis_self_check(data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  check_agent(data.agent_key, data.membrane_proof)
}

/// Runs on every agent already in the clone. This is the real gate.
pub fn validate_agent_joining(
  agent_pub_key: AgentPubKey,
  membrane_proof: &Option<MembraneProof>,
) -> ExternResult<ValidateCallbackResult> {
  check_agent(agent_pub_key, (*membrane_proof).clone())
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  // Read once. Only the app-entry and link arms consult it, because the base cell must stay
  // joinable.
  let in_conversation = is_conversation_cell()?;

  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::StoreEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, .. } | OpEntry::UpdateEntry { app_entry, .. } => {
        if !in_conversation {
          return refuse_base_cell_write();
        }
        validate_entry(&app_entry)
      }
      _ => Ok(ValidateCallbackResult::Valid),
    },

    FlatOp::RegisterUpdate(update_entry) => match update_entry {
      OpUpdate::Entry { app_entry, action } => {
        if !in_conversation {
          return refuse_base_cell_write();
        }
        match validate_update_author(action.original_action_address, &action.author)? {
          ValidateCallbackResult::Valid => validate_entry(&app_entry),
          other => Ok(other),
        }
      }
      _ => Ok(ValidateCallbackResult::Valid),
    },

    FlatOp::RegisterDelete(_) => reject_delete(),

    FlatOp::RegisterCreateLink {
      link_type,
      base_address,
      action,
      ..
    } => {
      if !in_conversation {
        return refuse_base_cell_write();
      }
      match link_type {
        LinkTypes::PathToMessage => Ok(ValidateCallbackResult::Valid),
        LinkTypes::PathToConfig => Ok(ValidateCallbackResult::Valid),
        LinkTypes::MessageUpdates => validate_update_link_author(base_address, &action.author),
      }
    }

    FlatOp::RegisterDeleteLink { link_type, .. } => match link_type {
      LinkTypes::PathToMessage => Ok(ValidateCallbackResult::Valid),
      LinkTypes::MessageUpdates => Ok(ValidateCallbackResult::Valid),
      LinkTypes::PathToConfig => Ok(ValidateCallbackResult::Valid),
    },

    FlatOp::StoreRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, .. } | OpRecord::UpdateEntry { app_entry, .. } => {
        if !in_conversation {
          return refuse_base_cell_write();
        }
        validate_entry(&app_entry)
      }
      OpRecord::DeleteEntry { .. } => reject_delete(),
      _ => Ok(ValidateCallbackResult::Valid),
    },

    // The membrane: a CreateAgent action is preceded by an AgentValidationPkg carrying the
    // joining agent's proof.
    FlatOp::RegisterAgentActivity(agent_activity) => match agent_activity {
      OpActivity::CreateAgent { agent, action } => {
        let previous_action = must_get_action(action.prev_action)?;
        match previous_action.action() {
          Action::AgentValidationPkg(AgentValidationPkg { membrane_proof, .. }) => {
            validate_agent_joining(agent, membrane_proof)
          }
          _ => Ok(ValidateCallbackResult::Invalid(
            "the previous action for a CreateAgent action must be an AgentValidationPkg"
              .to_string(),
          )),
        }
      }
      _ => Ok(ValidateCallbackResult::Valid),
    },
  }
}
