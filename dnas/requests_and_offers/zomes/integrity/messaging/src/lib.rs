use hdi::prelude::*;

mod message;
pub use message::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  EncryptedMessage(EncryptedMessage),
  #[entry_type(visibility = "private")]
  Block(Block),
  #[entry_type(visibility = "private")]
  Unblock(Unblock),
  #[entry_type(visibility = "private")]
  ReadMarker(ReadMarker),
  #[entry_type(visibility = "private")]
  ReportResolution(ReportResolution),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  /// Recipient's `AgentPubKey` -> the `ActionHash` of an `EncryptedMessage`.
  ///
  /// The target is an action hash rather than an entry hash on purpose. Validation
  /// has to prove the link's author is the message's author, and reading wants the
  /// message's timestamp; the action carries both, an entry hash carries neither.
  Inbox,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

#[allow(clippy::collapsible_match, clippy::single_match)]
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  // Fast path, as in every other integrity zome since #280. `op.flattened()` below is
  // the expensive call. Agent-activity ops are the only ones Holochain delivers to
  // every integrity zome in the DNA, and this zome has no rule for them, so that is the
  // one op kind skipped. Every other op kind reaches only the zome that owns its type
  // and still goes through `flattened()`.
  //
  // WARNING: if you ever add a rule for agent-activity ops to this zome, you must
  // delete this guard here first. It returns Valid before the match below ever sees the
  // op, so the new rule would silently never run.
  if matches!(&op, Op::AgentActivity(_)) {
    return Ok(ValidateCallbackResult::Valid);
  }

  match op.flattened::<EntryTypes, LinkTypes>()? {
    // -- entries --
    // A create or update is published as two ops: `CreateEntry` to the entry's
    // authority and `CreateRecord` to the action's. `must_get_valid_record`, which the
    // `Inbox` link rule uses, asks the action's authority, so both ops run the same
    // rules.
    FlatOp::CreateEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, .. } => validate_entry(app_entry),
      OpEntry::UpdateEntry { .. } => Ok(refuse_update()),
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::CreateRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, .. } => validate_entry(app_entry),
      OpRecord::UpdateEntry { .. } | OpRecord::UpdatePrivateEntry { .. } => Ok(refuse_update()),
      _ => Ok(ValidateCallbackResult::Valid),
    },

    // -- deletes --
    FlatOp::Delete(delete) => {
      // Lookup, then the rule. `check_deleter_is_author` is unit-tested.
      let original = must_get_action(delete.action.deletes_address.clone())?;
      Ok(check_deleter_is_author(
        delete.action.author(),
        original.action().author(),
      ))
    }

    // -- links --
    FlatOp::Link(OpLink::CreateLink { link_type, action }) => match link_type {
      LinkTypes::Inbox => match check_inbox_tag_is_empty(&action.tag) {
        ValidateCallbackResult::Valid => validate_create_inbox_link(
          action.base_address.clone(),
          action.target_address.clone(),
          action.author().clone(),
        ),
        refused => Ok(refused),
      },
    },

    FlatOp::Link(OpLink::DeleteLink {
      link_type,
      original_action,
      action,
    }) => match link_type {
      // The recipient must not be able to delete the sender's link: that would
      // destroy the sender's own record of what they sent. A recipient who does not
      // want to see a message hides it with a private marker instead.
      LinkTypes::Inbox => Ok(check_link_deleter_is_author(
        action.author(),
        original_action.author(),
      )),
    },

    _ => Ok(ValidateCallbackResult::Valid),
  }
}

/// The rules for a new entry, run on both the entry op and the record op.
fn validate_entry(app_entry: EntryTypes) -> ExternResult<ValidateCallbackResult> {
  match app_entry {
    EntryTypes::EncryptedMessage(message) => validate_encrypted_message(message),
    // The private entries hold an agent key, a read position or a report's hash,
    // and are only ever on their author's own chain. There is nothing for a third
    // party to check, and no other agent can see them.
    EntryTypes::Block(_)
    | EntryTypes::Unblock(_)
    | EntryTypes::ReadMarker(_)
    | EntryTypes::ReportResolution(_) => Ok(ValidateCallbackResult::Valid),
  }
}

/// A message is not editable. Editing one would leave the recipient holding a
/// different message from the one they were nudged about, with no way to tell.
/// Send another instead. Nothing in this zome updates its private entries either.
fn refuse_update() -> ValidateCallbackResult {
  ValidateCallbackResult::Invalid("Messaging entries cannot be updated".to_string())
}

/// An `Inbox` link is only valid if it points a recipient at a message its own
/// author wrote.
///
/// Without the author check, any agent could link anyone else's message into a
/// third party's inbox, and the recipient would see a message that the apparent
/// sender never addressed to them.
fn validate_create_inbox_link(
  base_address: AnyLinkableHash,
  target_address: AnyLinkableHash,
  link_author: AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
  if base_address.into_agent_pub_key().is_none() {
    return Ok(ValidateCallbackResult::Invalid(
      "An Inbox link's base must be an agent key".to_string(),
    ));
  }

  let Some(target) = target_address.into_action_hash() else {
    return Ok(ValidateCallbackResult::Invalid(
      "An Inbox link's target must be an action hash".to_string(),
    ));
  };

  let record = must_get_valid_record(target)?;

  // The action has to have *created an EncryptedMessage*, not merely hold bytes
  // that happen to deserialise as one. Without checking the entry type, a sender
  // could link any of their own actions into someone else's inbox, and a struct
  // from another zome with a compatible shape would pass a deserialise-only test.
  // `deserialize_from_type` checks the zome index too, so another zome's entry
  // cannot satisfy it either.
  let Some(EntryType::App(app_entry_def)) = record.action().entry_type() else {
    return Ok(ValidateCallbackResult::Invalid(
      "An Inbox link's target must be an app entry".to_string(),
    ));
  };

  let Some(entry) = record.entry().as_option() else {
    return Ok(ValidateCallbackResult::Invalid(
      "An Inbox link's target record must contain its entry".to_string(),
    ));
  };

  match EntryTypes::deserialize_from_type(
    *app_entry_def.zome_index,
    app_entry_def.entry_index,
    entry,
  )? {
    Some(EntryTypes::EncryptedMessage(_)) => (),
    _ => {
      return Ok(ValidateCallbackResult::Invalid(
        "An Inbox link's target must be an EncryptedMessage".to_string(),
      ))
    }
  }

  Ok(check_link_author_matches_message(
    &link_author,
    record.action().author(),
  ))
}

#[cfg(test)]
mod record_op_tests {
  //! A create or update reaches the DHT as two ops that go to different
  //! authorities, `CreateEntry` by entry hash and `CreateRecord` by action hash,
  //! and `must_get_valid_record` asks the record authority. The `Inbox` link rule
  //! reads its target with `must_get_valid_record`, so every rule the entry op runs
  //! must give the same verdict on the record op.
  use hdi::prelude::*;
  use utils::validation_harness::{create_ops, set_zome_types, update_ops};

  use crate::{validate, EncryptedMessage, EntryTypes, LinkTypes, MAX_CIPHERTEXT_BYTES};

  fn message(ciphertext_bytes: usize) -> SerializedBytes {
    EncryptedMessage {
      encrypted: XSalsa20Poly1305EncryptedData::new(
        holochain_integrity_types::x_salsa20_poly1305::nonce::XSalsa20Poly1305Nonce::from([0u8; 24]),
        vec![0u8; ciphertext_bytes],
      ),
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
  fn a_message_within_the_limit_is_valid_on_both_ops() {
    let (entry, record) = verdicts(create_ops(0, message(MAX_CIPHERTEXT_BYTES)));
    assert_eq!(entry, ValidateCallbackResult::Valid);
    assert_eq!(record, entry);
  }

  #[test]
  fn an_oversized_message_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(create_ops(0, message(MAX_CIPHERTEXT_BYTES + 1)));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid(format!(
        "Encrypted message is {} bytes, over the {MAX_CIPHERTEXT_BYTES} byte limit",
        MAX_CIPHERTEXT_BYTES + 1
      ))
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_update_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(update_ops(0, message(16)));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("Messaging entries cannot be updated".into())
    );
    assert_eq!(record, entry);
  }
}
