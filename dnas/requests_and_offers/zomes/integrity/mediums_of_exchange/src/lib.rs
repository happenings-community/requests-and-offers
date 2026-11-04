use hdi::prelude::*;
use utils::grants::{check_act, Ability};

mod links;
mod medium_of_exchange;
pub use medium_of_exchange::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  MediumOfExchange(MediumOfExchange),
  MediumOfExchangeStatus(MediumOfExchangeStatus),
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

  // From a medium of exchange's original record to each status entry decided on it.
  MediumOfExchangeStatusUpdates,
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
fn validate_entry(
  app_entry: EntryTypes,
  author: &AgentPubKey,
  is_update: bool,
) -> ExternResult<ValidateCallbackResult> {
  match app_entry {
    EntryTypes::MediumOfExchange(medium_of_exchange) => {
      let grant = medium_of_exchange.grant.clone();
      match validate_medium_of_exchange(medium_of_exchange)? {
        ValidateCallbackResult::Valid => {
          validate_medium_of_exchange_grant(&grant, author, is_update)
        }
        invalid => Ok(invalid),
      }
    }
    EntryTypes::MediumOfExchangeStatus(status) => {
      if is_update {
        return Ok(ValidateCallbackResult::Invalid(
          "A status entry is never edited; a later decision is a new status entry".to_string(),
        ));
      }
      utils::links::check_catalogue_status(
        &status.medium_of_exchange,
        &status.state,
        &status.grant,
        author,
        &utils::links::MEDIUM_OF_EXCHANGE,
      )
    }
  }
}

/// Who may write a medium of exchange. An update needs an
/// admin grant. A create needs an admin grant, or else a member grant: an
/// accepted member suggests one, and it waits for an admin to approve it. A
/// delete carries no entry, so no grant; `delete_medium_of_exchange` checks
/// for an admin.
fn validate_medium_of_exchange_grant(
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  is_update: bool,
) -> ExternResult<ValidateCallbackResult> {
  if is_update {
    return Ok(match check_act(grant, author, &Ability::Administer, &None)? {
      Ok(_) => ValidateCallbackResult::Valid,
      Err(reason) => ValidateCallbackResult::Invalid(format!(
        "Changing a medium of exchange is a role act: {}",
        reason
      )),
    });
  }
  if check_act(grant, author, &Ability::Administer, &None)?.is_ok() {
    return Ok(ValidateCallbackResult::Valid);
  }
  Ok(match check_act(grant, author, &Ability::Participate, &None)? {
    Ok(_) => ValidateCallbackResult::Valid,
    Err(reason) => ValidateCallbackResult::Invalid(format!(
      "Creating a medium of exchange is a role act: {}",
      reason
    )),
  })
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
        return validate_entry(app_entry, action.author(), false);
      }
      OpEntry::UpdateEntry { app_entry, action, .. } => {
        return validate_entry(app_entry, action.author(), true);
      }
      _ => (),
    },
    FlatOp::CreateRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, action } => {
        return validate_entry(app_entry, action.author(), false);
      }
      OpRecord::UpdateEntry { app_entry, action, .. } => {
        return validate_entry(app_entry, action.author(), true);
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
          EntryTypes::MediumOfExchange(_) | EntryTypes::MediumOfExchangeStatus(_) => {
            return Ok(ValidateCallbackResult::Invalid(format!(
              "A medium of exchange and its statuses are never tombstoned; a role holder retires it through its status ({:?})",
              action.deletes_address
            )));
          }
        }
      }
      _ => (),
    },
    FlatOp::Delete(OpDelete { action }) => {
      for kind in [&utils::links::MEDIUM_OF_EXCHANGE, &utils::links::MEDIUM_OF_EXCHANGE_STATUS] {
        if let ValidateCallbackResult::Invalid(reason) =
          utils::links::refuse_tombstone(&action.deletes_address, kind)?
        {
          return Ok(ValidateCallbackResult::Invalid(reason));
        }
      }
      return Ok(ValidateCallbackResult::Valid);
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
  if medium_of_exchange.exchange_type != "base" && medium_of_exchange.exchange_type != "currency" {
    return Ok(ValidateCallbackResult::Invalid(
      "MediumOfExchange exchange_type must be either 'base' or 'currency'".to_string(),
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

  use crate::{validate, EntryTypes, LinkTypes, MediumOfExchange};

  fn codeless_medium() -> SerializedBytes {
    MediumOfExchange {
      code: String::new(),
      name: "Hours".to_string(),
      description: None,
      exchange_type: "base".to_string(),
      resource_spec_hrea_id: None,
      grant: None,
    }
    .try_into()
    .unwrap()
  }

  fn ungranted_medium() -> SerializedBytes {
    MediumOfExchange {
      code: "HOURS".to_string(),
      name: "Hours".to_string(),
      description: None,
      exchange_type: "base".to_string(),
      resource_spec_hrea_id: None,
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
    let (entry, record) = verdicts(create_ops(0, codeless_medium()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("MediumOfExchange code cannot be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_update_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(update_ops(0, codeless_medium()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("MediumOfExchange code cannot be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn a_create_without_a_grant_is_refused_on_both_ops() {
    let (entry, record) = verdicts(create_ops(0, ungranted_medium()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid(
        "Creating a medium of exchange is a role act: this write needs a grant for Participate"
          .into()
      )
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_update_without_a_grant_is_refused_on_both_ops() {
    let (entry, record) = verdicts(update_ops(0, ungranted_medium()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid(
        "Changing a medium of exchange is a role act: this write needs a grant for Administer"
          .into()
      )
    );
    assert_eq!(record, entry);
  }
}
