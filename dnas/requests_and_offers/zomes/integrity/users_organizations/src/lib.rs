pub mod organization;
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
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_agent_joining(
  _agent_pub_key: AgentPubKey,
  _membrane_proof: &Option<MembraneProof>,
) -> ExternResult<ValidateCallbackResult> {
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
    EntryTypes::User(user) => validate_user(user),
    EntryTypes::Organization(organization) => validate_organization(organization),
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
          EntryTypes::Organization(_original_organization) => {
            return Ok(ValidateCallbackResult::Valid)
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
