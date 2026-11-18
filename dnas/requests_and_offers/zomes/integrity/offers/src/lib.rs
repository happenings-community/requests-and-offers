use hdi::prelude::*;
use utils::errors::{invalid, CommonValidationError};

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
/// rule needs it to find the offer's creator, and the timeframe rule to see
/// whether the window changed. `at` is the writing action's own timestamp.
/// Field rules run first, then the timeframe, then the grant.
fn validate_entry(
  app_entry: EntryTypes,
  author: &AgentPubKey,
  at: Timestamp,
  update: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  match app_entry {
    EntryTypes::Offer(offer) => {
      let grant = offer.grant.clone();
      let timeframe = offer.timeframe.clone();
      match validate_offer(offer)? {
        ValidateCallbackResult::Valid => {}
        other => return Ok(other),
      }
      match validate_offer_timeframe(&timeframe, at, update)? {
        ValidateCallbackResult::Valid => validate_offer_grant(&grant, author, update),
        other => Ok(other),
      }
    }
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
        return validate_entry(app_entry, action.author(), action.timestamp(), None);
      }
      OpEntry::UpdateEntry { app_entry, action } => {
        return validate_entry(
          app_entry,
          action.author(),
          action.timestamp(),
          Some(&action.data.original_action_address),
        );
      }
      _ => (),
    },
    // The same rules again for the authorities of the *original*: an update is
    // also delivered, as its own op, to whoever holds the record it changes,
    // and that authority never sees the record op below. Left to fall through,
    // it would show an update whose own record authority had refused it.
    FlatOp::Update(OpUpdate::Entry { app_entry, action }) => {
      return validate_entry(
        app_entry,
        action.author(),
        action.timestamp(),
        Some(&action.data.original_action_address),
      );
    }
    FlatOp::CreateRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, action } => {
        return validate_entry(app_entry, action.author(), action.timestamp(), None);
      }
      OpRecord::UpdateEntry { app_entry, action } => {
        return validate_entry(
          app_entry,
          action.author(),
          action.timestamp(),
          Some(&action.data.original_action_address),
        );
      }
      OpRecord::DeleteEntry { action } => {
        let original_record = must_get_valid_record(action.deletes_address.clone())?;
        let original_action =
          match TypedAction::<EntryCreationData>::try_from(original_record.action().clone()) {
            Ok(original_action) => original_action,
            Err(_) => {
              return invalid(CommonValidationError::DeleteOfNonCreation);
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
              return invalid(CommonValidationError::DeletedPublicEntryMissing);
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
            return invalid(CommonValidationError::UnknownAppEntry);
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
  use utils::validation_harness::{
    create_ops, created_record, set_zome_types, set_zome_types_holding, update_op_for_the_original,
    update_ops, update_ops_of, when,
  };
  use utils::{decimal::Quantity, Timeframe, TimeframePreset};
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
      timeframe: None,
      time_estimate_hours: None,
      amount: None,
      status: ListingStatus::Active,
      grant: None,
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

  /// Goes red if the `FlatOp::Update` arm is removed from `validate`.
  #[test]
  fn an_update_the_entry_op_refuses_is_refused_on_the_op_the_original_receives() {
    set_zome_types(EntryTypes::ENUM_LEN, LinkTypes::ENUM_LEN);
    let verdict = validate(update_op_for_the_original(0, untitled_offer())).unwrap();
    assert_eq!(
      verdict,
      ValidateCallbackResult::Invalid("Offer title cannot be empty".into())
    );
  }

  const DAY: i64 = 24 * 60 * 60 * 1_000_000;

  /// A titled offer, so the field rules pass and the timeframe rule is reached.
  fn offer_with(
    timeframe: Option<Timeframe>,
    hours: Option<&str>,
    amount: Option<Quantity>,
  ) -> Offer {
    Offer {
      title: "Gardening".to_string(),
      description: "Help with a garden".to_string(),
      time_preference: TimePreference::NoPreference,
      time_zone: None,
      interaction_type: InteractionType::InPerson,
      links: vec![],
      timeframe,
      time_estimate_hours: hours.map(str::to_string),
      amount,
      status: ListingStatus::Active,
      grant: None,
    }
  }

  fn bytes(entry: Offer) -> SerializedBytes {
    entry.try_into().unwrap()
  }

  /// A window ending `days` after the harness's action time.
  fn ending_in(days: i64) -> Timeframe {
    Timeframe::Dates {
      start: None,
      end: Timestamp::from_micros(when().as_micros() + days * DAY),
    }
  }

  fn after(days: i64) -> Timestamp {
    Timestamp::from_micros(when().as_micros() + days * DAY)
  }

  fn all_three((a, b, c): (Op, Op, Op), original: Record) -> [ValidateCallbackResult; 3] {
    set_zome_types_holding(EntryTypes::ENUM_LEN, LinkTypes::ENUM_LEN, vec![original]);
    [
      validate(a).unwrap(),
      validate(b).unwrap(),
      validate(c).unwrap(),
    ]
  }

  /// Goes red if the timeframe rule is skipped, or measured against anything but the
  /// writing action's own timestamp, on either op.
  #[test]
  fn a_create_with_an_ended_window_is_refused_on_both_ops() {
    let (entry, record) = verdicts(create_ops(
      0,
      bytes(offer_with(Some(ending_in(-1)), None, None)),
    ));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("a timeframe must end after the moment it is written".into())
    );
    assert_eq!(record, entry);
  }

  /// An expired offer can still be archived or edited: an update that leaves the window
  /// as it was is not checked again. Goes red without the "unchanged" shortcut.
  #[test]
  fn an_update_that_keeps_an_expired_window_is_accepted_on_all_three_ops() {
    let window = Some(ending_in(5));
    let original = created_record(0, bytes(offer_with(window.clone(), None, None)));
    let verdicts = all_three(
      update_ops_of(
        0,
        &original,
        bytes(offer_with(window, None, None)),
        after(30),
      ),
      original,
    );
    for verdict in verdicts {
      assert_eq!(verdict, ValidateCallbackResult::Valid);
    }
  }

  /// Goes red if any of the three arms skips the timeframe rule on an update.
  #[test]
  fn an_update_that_moves_the_window_into_the_past_is_refused_on_all_three_ops() {
    let original = created_record(0, bytes(offer_with(Some(ending_in(40)), None, None)));
    let verdicts = all_three(
      update_ops_of(
        0,
        &original,
        bytes(offer_with(Some(ending_in(5)), None, None)),
        after(30),
      ),
      original,
    );
    for verdict in verdicts {
      assert_eq!(
        verdict,
        ValidateCallbackResult::Invalid(
          "a timeframe must end after the moment it is written".into()
        )
      );
    }
  }

  #[test]
  fn a_preset_needs_no_date_and_zero_hours_are_an_estimate() {
    let preset = Some(Timeframe::Preset(TimeframePreset::WithinTwoWeeks));
    let (entry, record) = verdicts(create_ops(0, bytes(offer_with(preset, Some("0"), None))));
    // The grant rule is reached and refuses for the missing grant: the field and
    // timeframe rules passed.
    assert!(
      matches!(&entry, ValidateCallbackResult::Invalid(r) if r.contains("role act")),
      "{entry:?}"
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn a_time_estimate_or_an_amount_that_is_not_a_decimal_is_refused() {
    let (entry, _) = verdicts(create_ops(0, bytes(offer_with(None, Some("1e3"), None))));
    assert!(
      matches!(&entry, ValidateCallbackResult::Invalid(r) if r.starts_with("a time estimate is not a decimal")),
      "{entry:?}"
    );
    let zero = Some(Quantity {
      value: "0".into(),
      unit: "GBP".into(),
    });
    let (entry, _) = verdicts(create_ops(0, bytes(offer_with(None, None, zero))));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("an amount must be above zero, with a unit".into())
    );
  }
}
