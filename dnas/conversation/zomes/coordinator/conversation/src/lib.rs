pub mod errors;
pub mod membrane;

use conversation_integrity::*;
use errors::ConversationError;
use hdk::prelude::*;
use utils::errors::CommonError;

#[hdk_extern]
pub fn init() -> ExternResult<InitCallbackResult> {
  Ok(InitCallbackResult::Pass)
}

// ============================================================================
// BASE CELL GUARD
// ============================================================================

/// Read this clone's properties, refusing to operate in a cell that holds no conversation.
///
/// `check_agent` in the integrity zome admits any agent, with no proof, to a cell whose
/// properties are absent. That escape is load-bearing rather than cosmetic:
/// `strategy: clone_only` panics the conductor in 0.6.1 and on upstream `main-0.6`, so a
/// base conversation cell is provisioned on every install and has to pass genesis.
///
/// The consequence is that the base cell is a live DHT with an open membrane, shared by
/// every install because they all derive it from the same `workdir/happ.yaml`. The integrity
/// zome refuses writes there; this guard makes our own functions refuse earlier, with a
/// readable error, and hands the caller the peer set and conversation id it needed anyway.
pub fn conversation_properties() -> ExternResult<Properties> {
  let info = dna_info()?;

  // Encoded msgpack nil is one byte. Same test as the integrity zome, same reason.
  if info.modifiers.properties.bytes().len() == 1 {
    return Err(ConversationError::NotAConversation.into());
  }

  Properties::try_from(info.modifiers.properties).map_err(|e| CommonError::Serialize(e).into())
}

// ============================================================================
// SIGNALS
// ============================================================================

/// Shape follows the shared DNA's `Signal`
/// (`dnas/requests_and_offers/zomes/coordinator/requests/src/lib.rs` line 16) so a frontend
/// service layer can reuse the same discriminated union.
///
/// One variant is deliberately absent. `EntryDeleted` has no counterpart here because
/// `reject_delete` in the integrity zome makes a delete unvalidatable: the removal
/// primitive in this design is leaving the clone, not deleting an entry. A delete could
/// still be written to a local source chain and fail on publish, so emitting a signal for
/// it would advertise a capability that does not exist. `Action::Delete` therefore falls
/// through to the catch-all in `signal_action`.
#[allow(clippy::large_enum_variant)]
#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum Signal {
  LinkCreated {
    action: SignedActionHashed,
    link_type: LinkTypes,
  },
  LinkDeleted {
    action: SignedActionHashed,
    link_type: LinkTypes,
  },
  EntryCreated {
    action: SignedActionHashed,
    app_entry: EntryTypes,
  },
  EntryUpdated {
    action: SignedActionHashed,
    app_entry: EntryTypes,
    original_app_entry: EntryTypes,
  },
}

#[hdk_extern(infallible)]
pub fn post_commit(committed_actions: Vec<SignedActionHashed>) {
  for action in committed_actions {
    if let Err(err) = signal_action(action) {
      error!("Error signaling new action: {:?}", err);
    }
  }
}

fn signal_action(action: SignedActionHashed) -> ExternResult<()> {
  match action.hashed.content.clone() {
    Action::CreateLink(create_link) => {
      if let Ok(Some(link_type)) = LinkTypes::from_type(create_link.zome_index, create_link.link_type)
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
        if let Ok(Some(original_app_entry)) = get_entry_for_action(&update.original_action_address) {
          emit_signal(Signal::EntryUpdated {
            action,
            app_entry,
            original_app_entry,
          })?;
        }
      }
      Ok(())
    }
    _ => Ok(()),
  }
}

/// Copied unchanged from the shared DNA (`requests/src/lib.rs` line 107).
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
