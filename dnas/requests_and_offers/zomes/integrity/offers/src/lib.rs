use hdi::prelude::*;

mod offer;
pub use offer::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  Offer(Offer),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  OfferUpdates,
  AllOffers,
  ActiveOffers,
  ArchivedOffers,
  UserOffers,
  OrganizationOffers,
  OfferCreator,
  OfferOrganization,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

#[allow(clippy::collapsible_match, clippy::single_match)]
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  // Fast path. `op.flattened()` below is the expensive call. Agent-activity
  // ops are the only ones Holochain delivers to every integrity zome in the
  // DNA, and no zome here has a rule for them, so that is the one op kind
  // skipped. Every other op kind reaches only the zome that owns its type and
  // still goes through `flattened()` exactly as before.
  //
  // WARNING: if you ever add a rule for agent-activity ops to this zome, you
  // must delete this guard here first. It returns Valid before the match below
  // ever sees the op, so the new rule would silently never run.
  if matches!(&op, Op::RegisterAgentActivity(_)) {
    return Ok(ValidateCallbackResult::Valid);
  }

  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::StoreEntry(store_entry) => match store_entry {
        OpEntry::CreateEntry { app_entry, .. } | OpEntry::UpdateEntry { app_entry, .. } => {
          match app_entry {
            EntryTypes::Offer(offer) => {
              return validate_offer(offer);
            }
          }
        }
        _ => (),
      }
  ,
    FlatOp::StoreRecord(store_record) => match store_record {
        OpRecord::DeleteEntry {
          original_action_hash,
          ..
        } => {
          let original_record = must_get_valid_record(original_action_hash)?;
          let original_action = original_record.action().clone();
          let original_action = match original_action {
            Action::Create(create) => EntryCreationAction::Create(create),
            Action::Update(update) => EntryCreationAction::Update(update),
            _ => {
              return Ok(ValidateCallbackResult::Invalid(
                "Original action for a delete must be a Create or Update action".to_string(),
              ));
            }
          };
          let app_entry_type = match original_action.entry_type() {
            EntryType::App(app_entry_type) => app_entry_type,
            _ => {
              return Ok(ValidateCallbackResult::Valid);
            }
          };
          let entry = match original_record.entry().as_option() {
            Some(entry) => entry,
            None => {
              if original_action.entry_type().visibility().is_public() {
                return Ok(ValidateCallbackResult::Invalid(
                  "Original record for a delete of a public entry must contain an entry".to_string(),
                ));
              } else {
                return Ok(ValidateCallbackResult::Valid);
              }
            }
          };
          let original_app_entry = match EntryTypes::deserialize_from_type(
            *app_entry_type.zome_index,
            app_entry_type.entry_index,
            entry,
          )? {
            Some(app_entry) => app_entry,
            None => {
              return Ok(ValidateCallbackResult::Invalid(
                "Original app entry must be one of the defined entry types for this zome".to_string(),
              ));
            }
          };
          match original_app_entry {
            EntryTypes::Offer(_original_offer) => {
              // You can add specific delete validation for offers here if needed
            }
          }
        }
        _ => (),
      }
  ,
    _ => (),
  }
  Ok(ValidateCallbackResult::Valid)
}
