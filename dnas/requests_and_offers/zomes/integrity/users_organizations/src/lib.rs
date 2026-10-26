pub mod organization;
mod links;
mod tests;
pub mod user;

pub use organization::*;
pub use user::*;

use hdi::prelude::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  User(User),
  Organization(Organization),
  OrganizationRetirement(OrganizationRetirement),
  MembershipEnd(MembershipEnd),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  // Users Links
  UserUpdates,
  AllUsers,
  MyUser,
  UserAgents,
  UserStatus,
  UserOrganizations,

  // Organizations Links
  OrganizationUpdates,
  AllOrganizations,
  OrganizationCoordinators,
  OrganizationMembers,
  OrganizationStatus,
  OrganizationContacts,
  /// From an organisation to the entry that retired it (#234). Appended, so
  /// the indexes above stay as other zomes read them.
  OrganizationRetirements,
  /// From an organisation to each membership end in it; the tag names the
  /// member and the role (#234).
  MembershipEnds,
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
  update_of: Option<&ActionHash>,
) -> ExternResult<ValidateCallbackResult> {
  match app_entry {
    EntryTypes::User(user) => validate_user(user),
    EntryTypes::Organization(organization) => {
      validate_organization_write(organization, author, update_of)
    }
    EntryTypes::OrganizationRetirement(retirement) => {
      validate_organization_retirement(retirement, author, update_of)
    }
    EntryTypes::MembershipEnd(end) => validate_membership_end(end, author, update_of),
  }
}

/// Validates the provided `Op` to ensure the entry and link types adhere to the defined constraints.
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
          Some(&action.original_action_address),
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
          Some(&action.original_action_address),
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
          EntryTypes::User(_original_user) => {
            return Ok(ValidateCallbackResult::Invalid(String::from(
              "User profile cannot be deleted",
            )))
          }
          // An organisation is shared: members, coordinators, listings and
          // exchanges name it. It is retired, never tombstoned (#234).
          EntryTypes::Organization(_) | EntryTypes::OrganizationRetirement(_) => {
            return Ok(ValidateCallbackResult::Invalid(String::from(
              "an organisation is never tombstoned; a coordinator or an administrator retires it",
            )))
          }
          EntryTypes::MembershipEnd(_) => {
            return Ok(ValidateCallbackResult::Invalid(String::from(
              "a membership end is a record and is never tombstoned",
            )))
          }
        }
      }
      _ => (),
    },
    // The entry op of the same tombstone, refused for the same reason.
    FlatOp::Delete(OpDelete { action }) => {
      for kind in [
        &utils::links::USER,
        &utils::links::ORGANIZATION,
        &utils::links::ORGANIZATION_RETIREMENT,
        &utils::links::MEMBERSHIP_END,
      ] {
        if let ValidateCallbackResult::Invalid(reason) =
          utils::links::refuse_tombstone(&action.deletes_address, kind)?
        {
          return Ok(ValidateCallbackResult::Invalid(reason));
        }
      }
      return Ok(ValidateCallbackResult::Valid);
    }
    FlatOp::Link(OpLink::CreateLink { link_type, action }) => match link_type {
      LinkTypes::OrganizationMembers => {
        return validate_create_link_organization_membership(
          action.author(),
          &action.base_address,
          &action.tag,
          "members",
        );
      }
      LinkTypes::OrganizationCoordinators => {
        return validate_create_link_organization_membership(
          action.author(),
          &action.base_address,
          &action.tag,
          "coordinators",
        );
      }
      // The update-chain rules, routed as they are (#234): both ends of the
      // link are records of this type.
      LinkTypes::UserUpdates => {
        return validate_create_link_user_updates(
          action.clone(),
          action.base_address.clone(),
          action.target_address.clone(),
          action.tag.clone(),
        );
      }
      LinkTypes::OrganizationUpdates => {
        return validate_create_link_organization_updates(
          action.clone(),
          action.base_address.clone(),
          action.target_address.clone(),
          action.tag.clone(),
        );
      }
      other => {
        return links::validate_create_link(
          &other,
          action.author(),
          &action.base_address,
          &action.target_address,
          &action.tag,
        );
      }
    },
    FlatOp::Link(OpLink::DeleteLink {
      link_type,
      action,
      original_action,
    }) => match link_type {
      LinkTypes::UserUpdates => {
        return validate_delete_link_user_updates(
          action.clone(),
          original_action.clone(),
          action.base_address.clone(),
          original_action.target_address.clone(),
          original_action.tag.clone(),
        );
      }
      LinkTypes::OrganizationUpdates => {
        return validate_delete_link_organization_updates(
          action.clone(),
          original_action.clone(),
          action.base_address.clone(),
          original_action.target_address.clone(),
          original_action.tag.clone(),
        );
      }
      // Membership is ended by a `MembershipEnd`, never by tombstoning the
      // index (#234): a tombstone carries no grant to say who may.
      LinkTypes::OrganizationMembers | LinkTypes::OrganizationCoordinators => {
        return Ok(ValidateCallbackResult::Invalid(String::from(
          "a membership link is never tombstoned; a membership end records who left or was removed",
        )));
      }
      other => {
        return Ok(links::validate_delete_link(&other, original_action.author(), action.author()));
      }
    },
    _ => (),
  }
  Ok(ValidateCallbackResult::Valid)
}

#[cfg(test)]
mod link_index_tests {
  //! `utils::grants::membership_admits` recognises an `OrganizationMembers` link
  //! by its index in this zome, so the constant there must match the enum here.
  use utils::grants::ORGANIZATION_MEMBERS_LINK_TYPE;

  use crate::LinkTypes;

  #[test]
  fn the_members_link_index_other_zomes_rely_on_is_right() {
    assert_eq!(LinkTypes::OrganizationMembers as u8, ORGANIZATION_MEMBERS_LINK_TYPE);
  }
}

#[cfg(test)]
mod record_op_tests {
  //! A create or update reaches the DHT as two ops that go to different
  //! authorities, `CreateEntry` by entry hash and `CreateRecord` by action hash,
  //! and `must_get_valid_record` asks the record authority. So every rule the
  //! entry op runs must give the same verdict on the record op.
  use hdi::prelude::*;
  use utils::validation_harness::{create_ops, set_zome_types, update_ops};

  use crate::{validate, EntryTypes, LinkTypes, Organization, User};

  const USER: u8 = 0;
  const ORGANIZATION: u8 = 1;

  fn nameless_user() -> SerializedBytes {
    User {
      name: String::new(),
      nickname: "Jo".to_string(),
      bio: String::new(),
      picture: None,
      user_type: "advocate".to_string(),
      email: "jo@example.org".to_string(),
      phone: None,
      time_zone: "Europe/London".to_string(),
      location: "Colchester".to_string(),
    }
    .try_into()
    .unwrap()
  }

  fn organization_without_legal_name() -> SerializedBytes {
    Organization {
      name: "Allotment Society".to_string(),
      description: String::new(),
      full_legal_name: String::new(),
      logo: None,
      email: "hello@example.org".to_string(),
      urls: vec![],
      location: "Colchester".to_string(),
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
  fn a_user_create_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(create_ops(USER, nameless_user()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("User name cannot be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn a_user_update_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(update_ops(USER, nameless_user()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("User name cannot be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_organization_create_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(create_ops(ORGANIZATION, organization_without_legal_name()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("Full legal name must not be empty".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_organization_update_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(update_ops(ORGANIZATION, organization_without_legal_name()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("Full legal name must not be empty".into())
    );
    assert_eq!(record, entry);
  }
}
