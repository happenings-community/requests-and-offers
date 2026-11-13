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
    // The same rules again for the authorities of the *original*: an update is
    // also delivered, as its own op, to whoever holds the record it changes,
    // and that authority never sees the record op below. Left to fall through,
    // it would show an update whose own record authority had refused it.
    FlatOp::Update(OpUpdate::Entry { app_entry, action }) => {
      return validate_entry(
        app_entry,
        action.author(),
        Some(&action.original_action_address),
      );
    }
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
          EntryTypes::Organization(_original_organization) => {
            return Ok(ValidateCallbackResult::Valid)
          }
        }
      }
      _ => (),
    },
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
      // The two links that say who a member is (#473).
      LinkTypes::UserAgents | LinkTypes::MyUser => {
        return validate_create_identity_link(
          &link_type,
          &action.base_address,
          &action.target_address,
          action.author(),
        );
      }
      _ => (),
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
      // the links that say who a member is are never tombstoned, by anyone (documentation/architecture/validation.md)
      LinkTypes::UserAgents | LinkTypes::MyUser => {
        return invalid("UserAgents and MyUser links are never deleted");
      }
      _ => (),
    },
    _ => (),
  }
  Ok(ValidateCallbackResult::Valid)
}

/// Whether `hash` is a User record written by `author`.
///
/// `UserAgents` and `MyUser` decide who a member is: `get_user_agents` reads
/// `UserAgents`, and `send_message` encrypts a copy of every message to each
/// key it returns. A link anchored at someone else's User would hand its
/// writer that member's messages, so both links must belong to the User's
/// own author.
fn is_user_authored_by(hash: &AnyLinkableHash, author: &AgentPubKey) -> ExternResult<bool> {
  let Some(action_hash) = hash.clone().into_action_hash() else {
    return Ok(false);
  };
  let record = must_get_valid_record(action_hash)?;
  // only a User's original create: integrity does not tie an update's author to the original's,
  // so a revision written by someone else must never count as that member's User
  if !matches!(record.action().data, ActionData::Create(_)) {
    return Ok(false);
  }
  let Ok(creation) = TypedAction::<EntryCreationData>::try_from(record.action().clone()) else {
    return Ok(false);
  };
  let EntryType::App(app_entry_type) = creation.entry_type() else {
    return Ok(false);
  };
  let Some(entry) = record.entry().as_option() else {
    return Ok(false);
  };
  let is_user = matches!(
    EntryTypes::deserialize_from_type(
      *app_entry_type.zome_index,
      app_entry_type.entry_index,
      entry
    )?,
    Some(EntryTypes::User(_))
  );
  Ok(is_user && record.action().author() == author)
}

fn invalid(reason: &str) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Invalid(reason.to_string()))
}

/// Who may write the two links that say who a member is.
fn validate_create_identity_link(
  link_type: &LinkTypes,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  author: &AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
  match link_type {
    LinkTypes::UserAgents => {
      if !is_user_authored_by(base, author)? {
        return invalid("only a User's author may link agents to it");
      }
      // A second device of the same member needs a rule of its own (a proof
      // from the first key); until then a User has exactly its author's key.
      if target.clone().into_agent_pub_key().as_ref() != Some(author) {
        return invalid("a UserAgents link must point to its author's own key");
      }
    }
    LinkTypes::MyUser => {
      if base.clone().into_agent_pub_key().as_ref() != Some(author) {
        return invalid("a MyUser link must start at its author's own key");
      }
      if !is_user_authored_by(target, author)? {
        return invalid("a MyUser link must point to a User its author wrote");
      }
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
  use utils::validation_harness::{
    create_ops, set_zome_types, update_op_for_the_original, update_ops,
  };

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

  /// Goes red if the `FlatOp::Update` arm is removed from `validate`.
  #[test]
  fn a_user_update_the_entry_op_refuses_is_refused_on_the_op_the_original_receives() {
    set_zome_types(EntryTypes::ENUM_LEN, LinkTypes::ENUM_LEN);
    let verdict = validate(update_op_for_the_original(USER, nameless_user())).unwrap();
    assert_eq!(
      verdict,
      ValidateCallbackResult::Invalid("User name cannot be empty".into())
    );
  }

  /// Goes red if the `FlatOp::Update` arm is removed from `validate`.
  #[test]
  fn an_organization_update_the_entry_op_refuses_is_refused_on_the_op_the_original_receives() {
    set_zome_types(EntryTypes::ENUM_LEN, LinkTypes::ENUM_LEN);
    let verdict = validate(update_op_for_the_original(ORGANIZATION, organization_without_legal_name())).unwrap();
    assert_eq!(
      verdict,
      ValidateCallbackResult::Invalid("Full legal name must not be empty".into())
    );
  }
}
