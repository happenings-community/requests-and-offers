use hdi::prelude::*;

mod service_type;
pub use service_type::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  ServiceType(ServiceType),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  ServiceTypeUpdates,
  AllServiceTypes,
  ServiceTypeToRequest,
  RequestToServiceType,
  ServiceTypeToOffer,
  OfferToServiceType,
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
          EntryTypes::ServiceType(service_type) => {
            return validate_service_type(service_type);
          }
        }
      }
      _ => (),
    }
  }
  // TODO: Implement link validation for ServiceType links
  // This will be added in a future task to validate:
  // - ServiceTypeToRequest/RequestToServiceType links
  // - ServiceTypeToOffer/OfferToServiceType links
  // - AllServiceTypes links
  // - ServiceTypeUpdates links

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
          EntryTypes::ServiceType(_original_service_type) => {
            // You can add specific delete validation for service types here if needed
          }
        }
      }
      _ => (),
    }
  }
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_service_type(service_type: ServiceType) -> ExternResult<ValidateCallbackResult> {
  if service_type.name.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType name cannot be empty".to_string(),
    ));
  }
  if service_type.description.is_empty() {
    return Ok(ValidateCallbackResult::Invalid(
      "ServiceType description cannot be empty".to_string(),
    ));
  }

  Ok(ValidateCallbackResult::Valid)
}
