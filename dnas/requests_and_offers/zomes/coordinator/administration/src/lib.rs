pub mod administration;
pub mod status;

use administration_integrity::*;
use hdk::prelude::*;
use utils::errors::CommonError;

#[hdk_extern]
pub fn init(_: ()) -> ExternResult<InitCallbackResult> {
  Ok(InitCallbackResult::Pass)
}

/// Signal variants emitted after every successful DHT write in this coordinator zome.
///
/// The UI subscribes to these signals to keep its local state in sync with the DHT without
/// polling. Each variant carries the signed action that triggered it, plus the relevant
/// entry or link type for dispatch on the client side.
#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum Signal {
  /// Emitted when a new link is committed to the DHT.
  LinkCreated {
    action: SignedActionHashed,
    link_type: LinkTypes,
  },
  /// Emitted when an existing link is deleted from the DHT.
  LinkDeleted {
    action: SignedActionHashed,
    link_type: LinkTypes,
  },
  /// Emitted when a new app entry is committed to the DHT.
  EntryCreated {
    action: SignedActionHashed,
    app_entry: EntryTypes,
  },
  /// Emitted when an existing app entry is updated on the DHT.
  EntryUpdated {
    action: SignedActionHashed,
    app_entry: EntryTypes,
    original_app_entry: EntryTypes,
  },
  /// Emitted when an existing app entry is deleted from the DHT.
  EntryDeleted {
    action: SignedActionHashed,
    original_app_entry: EntryTypes,
  },
}

/// HDK post-commit callback. Called by the Holochain runtime after every batch of actions
/// is successfully committed to the source chain. Iterates over each committed action and
/// emits the corresponding [`Signal`] variant via [`signal_action`].
#[hdk_extern(infallible)]
pub fn post_commit(committed_actions: Vec<SignedActionHashed>) {
  for action in committed_actions {
    if let Err(err) = signal_action(action) {
      error!("Error signaling new action: {:?}", err);
    }
  }
}

/// Maps a single committed action to its corresponding [`Signal`] variant and emits it.
///
/// Handles `CreateLink`, `DeleteLink`, `Create`, `Update`, and `Delete` action types.
/// For link actions, resolves the link type from the zome/link-type indices. For entry
/// actions, resolves the deserialized [`EntryTypes`] value from the action hash. Actions
/// of other types (agent activity, etc.) are silently ignored.
fn signal_action(action: SignedActionHashed) -> ExternResult<()> {
  match action.hashed.content.clone() {
    Action::CreateLink(create_link) => {
      if let Ok(Some(link_type)) =
        LinkTypes::from_type(create_link.zome_index, create_link.link_type)
      {
        emit_signal(Signal::LinkCreated { action, link_type })?;
      }
      Ok(())
    }
    Action::DeleteLink(delete_link) => {
      let record = get(delete_link.link_add_address.clone(), GetOptions::default())?.ok_or(
        CommonError::LinkNotFound("Failed to fetch CreateLink action".to_string()),
      )?;
      match record.action() {
        Action::CreateLink(create_link) => {
          if let Ok(Some(link_type)) =
            LinkTypes::from_type(create_link.zome_index, create_link.link_type)
          {
            emit_signal(Signal::LinkDeleted { action, link_type })?;
          }
          Ok(())
        }
        _ => Err(CommonError::LinkNotFound("Create Link should exist".to_string()).into()),
      }
    }
    Action::Create(_create) => {
      if let Ok(Some(app_entry)) = get_entry_for_action(&action.hashed.hash) {
        emit_signal(Signal::EntryCreated { action, app_entry })?;
      }
      Ok(())
    }
    Action::Update(update) => {
      if let Ok(Some(app_entry)) = get_entry_for_action(&action.hashed.hash) {
        if let Ok(Some(original_app_entry)) = get_entry_for_action(&update.original_action_address)
        {
          emit_signal(Signal::EntryUpdated {
            action,
            app_entry,
            original_app_entry,
          })?;
        }
      }
      Ok(())
    }
    Action::Delete(delete) => {
      if let Ok(Some(original_app_entry)) = get_entry_for_action(&delete.deletes_address) {
        emit_signal(Signal::EntryDeleted {
          action,
          original_app_entry,
        })?;
      }
      Ok(())
    }
    _ => Ok(()),
  }
}

/// Retrieves and deserializes the [`EntryTypes`] value for the entry referenced by
/// `action_hash`. Returns `Ok(None)` if the record does not exist, has no entry, or is
/// not an app entry type recognized by this zome.
fn get_entry_for_action(action_hash: &ActionHash) -> ExternResult<Option<EntryTypes>> {
  let record = match get_details(action_hash.clone(), GetOptions::default())? {
    Some(Details::Record(record_details)) => record_details.record,
    _ => {
      return Ok(None);
    }
  };
  let entry = match record.entry().as_option() {
    Some(entry) => entry,
    None => {
      return Ok(None);
    }
  };
  let (zome_index, entry_index) = match record.action().entry_type() {
    Some(EntryType::App(AppEntryDef {
      zome_index,
      entry_index,
      ..
    })) => (zome_index, entry_index),
    _ => {
      return Ok(None);
    }
  };
  EntryTypes::deserialize_from_type(*zome_index, *entry_index, entry)
}


// --- SPIKE 1 (throwaway, do not merge): encrypt-to-agent-key round-trip ---
#[derive(Serialize, Deserialize, Debug)]
pub struct SpikeEncryptInput {
    pub recipient: AgentPubKey,
    pub plaintext: Vec<u8>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SpikeDecryptInput {
    pub sender: AgentPubKey,
    pub encrypted: XSalsa20Poly1305EncryptedData,
}

#[hdk_extern]
pub fn spike_encrypt(input: SpikeEncryptInput) -> ExternResult<XSalsa20Poly1305EncryptedData> {
    let sender = agent_info()?.agent_initial_pubkey;
    ed_25519_x_salsa20_poly1305_encrypt(
        sender,
        input.recipient,
        XSalsa20Poly1305Data::from(input.plaintext),
    )
}

#[hdk_extern]
pub fn spike_decrypt(input: SpikeDecryptInput) -> ExternResult<Vec<u8>> {
    let recipient = agent_info()?.agent_initial_pubkey;
    // If the assert fails at runtime, swap `recipient` and `input.sender` below.
    let data = ed_25519_x_salsa20_poly1305_decrypt(recipient, input.sender, input.encrypted)?;
    Ok(data.as_ref().to_vec())
}
// --- END SPIKE 1 ---


// --- SPIKE 2 (throwaway, do not merge): shared-secret content key + re-wrap ---
#[hdk_extern]
pub fn spike_new_x25519(_: ()) -> ExternResult<X25519PubKey> {
    create_x25519_keypair()
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateCaseOutput {
    pub key_ref: XSalsa20Poly1305KeyRef,
    pub ciphertext: XSalsa20Poly1305EncryptedData,
}

#[hdk_extern]
pub fn spike_create_case(plaintext: Vec<u8>) -> ExternResult<CreateCaseOutput> {
    let key_ref = x_salsa20_poly1305_shared_secret_create_random(None)?;
    let ciphertext =
        x_salsa20_poly1305_encrypt(key_ref.clone(), XSalsa20Poly1305Data::from(plaintext))?;
    Ok(CreateCaseOutput { key_ref, ciphertext })
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WrapInput {
    pub sender_x: X25519PubKey,
    pub recipient_x: X25519PubKey,
    pub key_ref: XSalsa20Poly1305KeyRef,
}

#[hdk_extern]
pub fn spike_wrap(input: WrapInput) -> ExternResult<XSalsa20Poly1305EncryptedData> {
    x_salsa20_poly1305_shared_secret_export(input.sender_x, input.recipient_x, input.key_ref)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct OpenInput {
    pub recipient_x: X25519PubKey,
    pub sender_x: X25519PubKey,
    pub wrapped_key: XSalsa20Poly1305EncryptedData,
    pub ciphertext: XSalsa20Poly1305EncryptedData,
}

#[hdk_extern]
pub fn spike_open(input: OpenInput) -> ExternResult<Vec<u8>> {
    let key_ref = x_salsa20_poly1305_shared_secret_ingest(
        input.recipient_x,
        input.sender_x,
        input.wrapped_key,
        None,
    )?;
    let data = x_salsa20_poly1305_decrypt(key_ref, input.ciphertext)?
        .ok_or_else(|| wasm_error!(WasmErrorInner::Guest("decrypt returned None".into())))?;
    Ok(data.as_ref().to_vec())
}
// --- END SPIKE 2 ---
