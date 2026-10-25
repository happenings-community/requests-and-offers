use hdi::prelude::*;

mod links;
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
///
/// `update` is the action an update updates, `None` for a create: the grant
/// rule needs it to find the offer's creator. Field rules run first.
fn validate_entry(
  app_entry: EntryTypes,
  author: &AgentPubKey,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  match app_entry {
    EntryTypes::Offer(offer) => match validate_offer(offer.clone())? {
      ValidateCallbackResult::Valid => validate_offer_write(&offer, author, update),
      other => Ok(other),
    },
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
        return validate_entry(app_entry, action.author(), None);
      }
      OpEntry::UpdateEntry { app_entry, action } => {
        return validate_entry(
          app_entry,
          action.author(),
          Some(&action.data.original_action_address),
        );
      }
      _ => (),
    },
    FlatOp::CreateRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, action } => {
        return validate_entry(app_entry, action.author(), None);
      }
      OpRecord::UpdateEntry { app_entry, action } => {
        return validate_entry(
          app_entry,
          action.author(),
          Some(&action.data.original_action_address),
        );
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
          EntryTypes::Offer(_) => {
            return utils::links::check_creator_tombstone(
              &action.deletes_address,
              action.author(),
              &utils::links::OFFER,
            );
          }
        }
      }
      _ => (),
    },
    FlatOp::Delete(OpDelete { action }) => {
      return utils::links::check_creator_tombstone(
        &action.deletes_address,
        action.author(),
        &utils::links::OFFER,
      );
    }
    FlatOp::Link(OpLink::CreateLink { link_type, action }) => {
      return links::validate_create_link(
        &link_type,
        action.author(),
        &action.base_address,
        &action.target_address,
        &action.tag,
      );
    }
    FlatOp::Link(OpLink::DeleteLink {
      link_type,
      action,
      original_action,
    }) => {
      return links::validate_delete_link(&link_type, original_action.author(), action.author());
    }
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
  use utils::validation_harness::{create_ops, set_zome_types, update_ops};
  use utils::{InteractionType, TimePreference};

  use crate::{validate, EntryTypes, LinkTypes, ListingStatus, Offer};

  fn untitled_offer() -> SerializedBytes {
    Offer {
      title: String::new(),
      description: "Help with a garden".to_string(),
      time_preference: TimePreference::NoPreference,
      time_zone: None,
      interaction_type: InteractionType::InPerson,
      links: vec![],
      status: ListingStatus::Active,
      grant: None,
      organization: None,
      membership: None,
      removal_reason: None,
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
}
