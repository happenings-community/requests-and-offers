use hdi::prelude::*;

mod medium_of_exchange;
pub use medium_of_exchange::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  MediumOfExchange(MediumOfExchange),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  MediumOfExchangeUpdates,
  AllMediumsOfExchange,

  // For future integration with Requests/Offers if needed
  MediumOfExchangeToRequest,
  RequestToMediumOfExchange,

  MediumOfExchangeToOffer,
  OfferToMediumOfExchange,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

#[allow(clippy::collapsible_match, clippy::single_match)]
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  if let FlatOp::StoreEntry(store_entry) = op.flattened::<EntryTypes, LinkTypes>()? {
    match store_entry {
      OpEntry::CreateEntry { app_entry, .. } | OpEntry::UpdateEntry { app_entry, .. } => {
        match app_entry {
          EntryTypes::MediumOfExchange(medium_of_exchange) => {
            return validate_medium_of_exchange(medium_of_exchange);
          }
        }
      }
      _ => (),
    }
  }

  if let FlatOp::StoreRecord(store_record) = op.flattened::<EntryTypes, LinkTypes>()? {
    match store_record {
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
          app_entry_type.zome_index,
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
          EntryTypes::MediumOfExchange(_original_medium_of_exchange) => {
            // You can add specific delete validation for mediums of exchange here if needed
          }
        }
      }
      _ => (),
    }
  }
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_medium_of_exchange(
  medium_of_exchange: MediumOfExchange,
) -> ExternResult<ValidateCallbackResult> {
  if medium_of_exchange.code.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "MediumOfExchange code cannot be empty".to_string(),
    ));
  }
  if medium_of_exchange.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "MediumOfExchange name cannot be empty".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}
