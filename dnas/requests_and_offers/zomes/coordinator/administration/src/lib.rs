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
