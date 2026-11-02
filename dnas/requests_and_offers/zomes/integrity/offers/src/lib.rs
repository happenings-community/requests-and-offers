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

/// Every rule for a new or updated entry, run for both ops of the write.
///
/// Holochain sends the entry op and the record op of a create or update to
/// different authorities, by entry hash and by action hash, and
/// `must_get_valid_record` trusts the record authority's verdict. A rule run
/// on the entry op alone is never seen by the authority that answers for
/// the record.
/// The rules an offer entry is held to, given the action that writes it: its
/// timestamp, and for an update the version it replaces. The entry op and the
/// record op both come here, so they give the same verdict (#348), timeframes
/// included.
fn validate_entry(
  app_entry: EntryTypes,
  at: Timestamp,
  replaces: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  match (app_entry, replaces) {
    (EntryTypes::Offer(offer), None) => validate_offer_create(offer, at),
    (EntryTypes::Offer(offer), Some(original)) => validate_offer_update(offer, original, at),
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

  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::CreateEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, action } => {
        return validate_entry(app_entry, action.timestamp(), None);
      }
      OpEntry::UpdateEntry { app_entry, action } => {
        return validate_entry(app_entry, action.timestamp(), Some(&action.original_action_address));
      }
      _ => (),
    },
    FlatOp::CreateRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, action } => {
        return validate_entry(app_entry, action.timestamp(), None);
      }
      OpRecord::UpdateEntry { app_entry, action } => {
        return validate_entry(app_entry, action.timestamp(), Some(&action.original_action_address));
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
    },
    _ => (),
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
  use utils::validation_harness::{create_ops, set_zome_types, update_ops, when};
  use utils::{Timeframe, InteractionType, TimePreference};

  use crate::{validate, EntryTypes, LinkTypes, ListingStatus, Offer};

  fn untitled_offer() -> SerializedBytes {
    Offer {
      title: String::new(),
      description: "Help with a garden".to_string(),
      timeframe: None,
      time_estimate_hours: None,
      amount: None,
      time_preference: TimePreference::NoPreference,
      time_zone: None,
      interaction_type: InteractionType::InPerson,
      links: vec![],
      status: ListingStatus::Active,
    }
    .try_into()
    .unwrap()
  }
  fn offer_whose_timeframe_has_ended() -> SerializedBytes {
    Offer {
      title: "A titled offer".to_string(),
      description: "Help with a garden".to_string(),
      timeframe: Some(Timeframe::Dates {
        start: None,
        end: Timestamp::from_micros(when().as_micros() - 86_400_000_000),
      }),
      time_estimate_hours: None,
      amount: None,
      time_preference: TimePreference::NoPreference,
      time_zone: None,
      interaction_type: InteractionType::InPerson,
      links: vec![],
      status: ListingStatus::Active,
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
    let (entry, record) = verdicts(create_ops(0, untitled_offer()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("Offer title cannot be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_update_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(update_ops(0, untitled_offer()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("Offer title cannot be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn a_timeframe_that_has_already_ended_is_refused_on_the_record_op_too() {
    // The rule reads the writing action's timestamp, which both ops carry, so
    // a forged offer can't read as valid through must_get_valid_record (#348).
    let (entry, record) = verdicts(create_ops(0, offer_whose_timeframe_has_ended()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("a timeframe must end after the moment it is written".into())
    );
    assert_eq!(record, entry);
  }
}
