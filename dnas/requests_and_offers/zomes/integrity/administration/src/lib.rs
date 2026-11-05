use grants::*;
use hdi::prelude::*;
use status::*;
use utils::grants::{Role, RoleGrant, RoleRevocation};

pub mod grants;
pub mod status;
mod tests;

/// Registry of all HDK entry types defined in this integrity zome.
///
/// The single variant wraps [`Status`], the moderation lifecycle entry used to track the
/// approval state of any entity (user, offer, request, etc.) in the network.
#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  /// A moderation/lifecycle status entry for a network entity.
  Status(Status),

  /// One agent holding one role in one scope, and what authorised it: the
  /// chain of grants. `utils::grants` has the type; this zome
  /// registers it, at the index `utils::grants::ROLE_GRANT_ENTRY_INDEX`.
  RoleGrant(RoleGrant),

  /// A grant withdrawn. The grant and the acts made under it stand.
  RoleRevocation(RoleRevocation),
}

/// Registry of all link types defined in this integrity zome.
///
/// Links are the primary indexing mechanism on the Holochain DHT. Each variant represents
/// a distinct semantic relationship between two addressable items.
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  /// Index link from a path (`"{entity}.administrators"`) to the original action hash of
  /// an administrator entity. Enables listing all administrators for a given entity type.
  AllAdministrators,

  /// Index link from an agent's public key to the `"{entity}.administrators"` path entry hash.
  /// Enables efficient membership queries: "is this agent an administrator?"
  AgentAdministrators,

  /// Update-chain link from a status entry's original action hash to the action hash of its
  /// next revision. Forms a linked-list of status revisions for audit history.
  StatusUpdates,

  /// Index link from the `"{entity}.status"` path entry hash to a status action hash.
  /// Enables listing all status entries ever created for a given entity type.
  AllStatuses,

  /// Direct link from an entity's original action hash to its current status action hash.
  /// Enables `O(1)` lookup of an entity's active status without traversing all revisions.
  EntityStatus,

  /// Index link from the `"{entity}.status.accepted"` path entry hash to an entity's original
  /// action hash. Enables listing all currently accepted entities of a given type.
  AcceptedEntity,

  // New variants are appended, never inserted. Link type discriminants are positional,
  // so inserting one renumbers every variant after it and orphans existing links.
  /// Index link from a holder's public key to one of their grants; the tag carries the
  /// grant's hash. What `can` reads.
  AgentGrants,

  /// Index link from the `"grants.{role}"` path to a grant, for listing every grant of a
  /// role. The tag carries the grant's hash.
  AllGrants,

  /// Index link from a grant to a revocation of it. `can` treats a grant with one as
  /// withdrawn.
  GrantRevocations,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

// ============================================================================
// ROLE INDEX LINKS
// ============================================================================
//
// Every link that indexes a role holder carries, in its tag, the grant it
// indexes, and is written by the agent who wrote that grant. The grant is
// what the network trusts; the links are how a holder is found quickly.
//
// Deleting these links is coordinator-only: a delete-link action has no tag of
// its own and carries no grant, so validation cannot see who is removing an
// index entry. A vandal can damage the index; the grants stand, and `can`
// reads grants. Stated as the limit rather than hidden.

/// `AllAdministrators`: path to a user entity, tag the new admin's grant.
fn validate_create_link_all_administrators(
  link_author: &AgentPubKey,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  validate_roster_link(link_author, tag, Role::Admin)
}

/// `AgentAdministrators`: holder's key to the path, tag the holder's grant.
fn validate_create_link_agent_administrators(
  link_author: &AgentPubKey,
  base_address: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  validate_holder_role_link(link_author, base_address, tag, Role::Admin)
}

/// The original entry a delete points at, read back as one of this zome's types.
fn deleted_entry(action: &TypedAction<DeleteData>) -> ExternResult<Result<EntryTypes, String>> {
  let original = must_get_valid_record(action.deletes_address.clone())?;
  let Ok(creation) = TypedAction::<EntryCreationData>::try_from(original.action().clone()) else {
    return Ok(Err(
      "Original action for a delete must be a Create or Update action".to_string(),
    ));
  };
  let EntryType::App(def) = creation.entry_type() else {
    return Ok(Err("a delete in this zome points at an app entry".to_string()));
  };
  let Some(entry) = original.entry().as_option() else {
    return Ok(Err("Original record for a delete must contain an entry".to_string()));
  };
  match EntryTypes::deserialize_from_type(*def.zome_index, def.entry_index, entry)? {
    Some(app_entry) => Ok(Ok(app_entry)),
    None => Ok(Err(
      "Original app entry must be one of the defined entry types for this zome".to_string(),
    )),
  }
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
    EntryTypes::Status(status) => validate_status(status, author, is_update),
    EntryTypes::RoleGrant(grant) => validate_role_grant(author, &grant),
    EntryTypes::RoleRevocation(revocation) => validate_role_revocation(author, &revocation),
  }
}

// ============================================================================
// VALIDATE CALLBACK
// ============================================================================

/// HDK integrity validation callback. Dispatches every DHT operation to the appropriate
/// type-specific validator.
///
/// - `CreateEntry` and `CreateRecord` ops for a create or update are routed to the
///   entry-type validators (e.g., `validate_status`) through [`validate_entry`].
/// - `Link` ops (create and delete) are routed to link-type validators.
/// - All other ops (agent activity, countersigning, etc.) return `Valid` by default.
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
      OpEntry::CreateEntry { app_entry, action } => validate_entry(app_entry, action.author(), false),
      OpEntry::UpdateEntry { app_entry, action, .. } => {
        validate_entry(app_entry, action.author(), true)
      }
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::CreateRecord(store_record) => match store_record {
      OpRecord::CreateEntry { app_entry, action } => {
        validate_entry(app_entry, action.author(), false)
      }
      OpRecord::UpdateEntry { app_entry, action, .. } => {
        validate_entry(app_entry, action.author(), true)
      }
      // Nothing in this zome is deleted: a status is a history, a grant or a
      // revocation is the record an act rests on. Routed here rather than left
      // to fall through (#234).
      OpRecord::DeleteEntry { action } => match deleted_entry(&action)? {
        Ok(EntryTypes::Status(_)) => Ok(ValidateCallbackResult::Invalid(String::from(
          "Status cannot be deleted",
        ))),
        Ok(EntryTypes::RoleGrant(_)) | Ok(EntryTypes::RoleRevocation(_)) => {
          Ok(ValidateCallbackResult::Invalid(String::from(
            "A grant or a revocation is a record and cannot be deleted; revoke a grant instead",
          )))
        }
        Err(reason) => Ok(ValidateCallbackResult::Invalid(reason)),
      },
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::Link(OpLink::CreateLink { link_type, action }) => {
      let author = action.author();
      let base = &action.base_address;
      let target = &action.target_address;
      let tag = &action.tag;
      match link_type {
        LinkTypes::AllAdministrators => validate_create_link_all_administrators(author, tag),
        LinkTypes::AgentAdministrators => {
          validate_create_link_agent_administrators(author, base, tag)
        }
        LinkTypes::AgentGrants => validate_grant_index_link(author, base, target, tag, true),
        LinkTypes::AllGrants => validate_grant_index_link(author, base, target, tag, false),
        LinkTypes::GrantRevocations => validate_grant_revocation_link(author, base, target),
        LinkTypes::EntityStatus => validate_create_link_entity_status(author, target),
        LinkTypes::AcceptedEntity => validate_create_link_accepted_entity(author, tag),
        LinkTypes::StatusUpdates => validate_create_link_status_updates(
          action.clone(),
          base.clone(),
          target.clone(),
          tag.clone(),
        ),
        LinkTypes::AllStatuses => Ok(ValidateCallbackResult::Valid),
      }
    }
    FlatOp::Link(OpLink::DeleteLink {
      link_type,
      action,
      original_action,
    }) => match link_type {
      LinkTypes::StatusUpdates => validate_delete_link_status_updates(
        action.clone(),
        original_action.clone(),
        action.base_address.clone(),
        original_action.target_address.clone(),
        original_action.tag.clone(),
      ),
      // Index links come and go with the coordinator (see ROLE INDEX LINKS).
      _ => Ok(ValidateCallbackResult::Valid),
    },
    _ => Ok(ValidateCallbackResult::Valid),
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

  use crate::{validate, EntryTypes, LinkTypes, Status};

  fn unknown_status() -> SerializedBytes {
    Status {
      status_type: "bogus".to_string(),
      reason: None,
      suspended_until: None,
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
    let (entry, record) = verdicts(create_ops(0, unknown_status()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("Invalid status type: bogus".into())
    );
    assert_eq!(record, entry);
  }

  #[test]
  fn an_update_the_entry_op_refuses_is_refused_on_the_record_op_too() {
    let (entry, record) = verdicts(update_ops(0, unknown_status()));
    assert_eq!(
      entry,
      ValidateCallbackResult::Invalid("Invalid status type: bogus".into())
    );
    assert_eq!(record, entry);
  }
}
