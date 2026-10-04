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
  match op.flattened::<EntryTypes, LinkTypes>()? {
    // -- entries --
    FlatOp::StoreEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, .. } => match app_entry {
        EntryTypes::EncryptedMessage(message) => validate_encrypted_message(message),
        // The private entries hold an agent key or a read position, and are only ever
        // on their author's own chain. There is nothing for a third party to check, and
        // no other agent can see them.
        EntryTypes::Block(_) | EntryTypes::Unblock(_) | EntryTypes::ReadMarker(_) => {
          Ok(ValidateCallbackResult::Valid)
        }
      },
      // A message is not editable. Editing one would leave the recipient holding a
      // different message from the one they were nudged about, with no way to tell.
      // Send another instead.
      OpEntry::UpdateEntry { .. } => Ok(ValidateCallbackResult::Invalid(
        "Messaging entries cannot be updated".to_string(),
      )),
      _ => Ok(ValidateCallbackResult::Valid),
    },

    // -- deletes --
    FlatOp::RegisterDelete(delete) => {
      // Lookup, then the rule. `check_deleter_is_author` is unit-tested.
      let original = must_get_action(delete.action.deletes_address.clone())?;
      Ok(check_deleter_is_author(
        &delete.action.author,
        original.action().author(),
      ))
    }

    // -- links --
    FlatOp::RegisterCreateLink {
      link_type,
      base_address,
      target_address,
      action,
      ..
    } => match link_type {
      LinkTypes::Inbox => validate_create_inbox_link(base_address, target_address, action.author),
    },

    FlatOp::RegisterDeleteLink {
      link_type,
      original_action,
      action,
      ..
    } => match link_type {
      // The recipient must not be able to delete the sender's link: that would
      // destroy the sender's own record of what they sent. A recipient who does not
      // want to see a message hides it with a private marker instead.
      LinkTypes::Inbox => Ok(check_link_deleter_is_author(
        &action.author,
        &original_action.author,
      )),
    },

    _ => Ok(ValidateCallbackResult::Valid),
  }
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
