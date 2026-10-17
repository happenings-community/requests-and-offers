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

  // Requests
  ServiceTypeToRequest,
  RequestToServiceType,

  // Offers
  ServiceTypeToOffer,
  OfferToServiceType,

  // Users
  ServiceTypeToUser,
  UserToServiceType,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

/// Every rule for a new or updated entry, run for both ops of the write.
///
/// Holochain sends the entry op and the record op of a create or update to
/// different authorities, by entry hash and by action hash, and
/// `must_get_valid_record` trusts the record authority's verdict. A rule run
/// on the entry op alone is never seen by the authority that answers for
/// the record.
fn validate_entry(app_entry: EntryTypes) -> ExternResult<ValidateCallbackResult> {
  match app_entry {
    EntryTypes::ServiceType(service_type) => validate_service_type(service_type),
  }
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
  if matches!(&op, Op::AgentActivity(_)) {
    return Ok(ValidateCallbackResult::Valid);
  }

  // TODO: Implement link validation for ServiceType links
  // This will be completed in a future iteration after resolving HDI syntax
  // Current focus is on frontend implementation since backend is fully functional
  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::CreateEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, .. } | OpEntry::UpdateEntry { app_entry, .. } => {
        return validate_entry(app_entry);
      }
      _ => (),
    },
    FlatOp::CreateRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, .. } | OpRecord::UpdateEntry { app_entry, .. } => {
        return validate_entry(app_entry);
      }
      OpRecord::DeleteEntry { action } => {
        let original_record = must_get_valid_record(action.deletes_address.clone())?;
        let original_action =
          match TypedAction::<EntryCreationData>::try_from(original_record.action().clone()) {
            Ok(original_action) => original_action,
            Err(_) => {
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
    },
    _ => (),
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

#[cfg(test)]
mod record_op_tests {
  //! A create or update reaches the DHT as two ops that go to different
  //! authorities, `CreateEntry` by entry hash and `CreateRecord` by action hash,
  //! and `must_get_valid_record` asks the record authority. So every rule the
  //! entry op runs must give the same verdict on the record op.
  use hdi::prelude::*;
  use utils::validation_harness::{create_ops, set_zome_types, update_ops};

  use crate::{validate, EntryTypes, LinkTypes, ServiceType};

  fn nameless_service_type() -> SerializedBytes {
    ServiceType {
      name: String::new(),
      description: "Gardening".to_string(),
      technical: false,
    }
    .try_into()
    .unwrap()
  }

  fn verdicts((entry_op, record_op): (Op, Op)) -> (ValidateCallbackResult, ValidateCallbackResult) {
    set_zome_types(EntryTypes::ENUM_LEN, LinkTypes::ENUM_LEN);
    let entry = validate(entry_op).unwrap();
    let record = validate(record_op).unwrap();
    println!("entry op:  {entry:?}\nrecord op: {record:?}");
    (entry, record)
  }

  #[test]
  fn a_create_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(create_ops(0, nameless_service_type()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("ServiceType name cannot be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_update_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(update_ops(0, nameless_service_type()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("ServiceType name cannot be empty".into())
    );
    assert_eq!(record, entry);
  }
}
