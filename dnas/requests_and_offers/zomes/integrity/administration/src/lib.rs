use grants::*;
use hdi::prelude::*;
use status::*;
use utils::grants::{Role, RoleGrant, RoleRevocation};

pub mod grants;
pub mod status;
mod tests;

/// Registry of all HDK entry types defined in this integrity zome.
///
/// [`Status`] is the moderation lifecycle entry used to track the approval state of any
/// entity (user, offer, request, etc.) in the network. `RoleGrant` and `RoleRevocation`
/// are the chain of grants: who holds which role, and by whose authority.
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
  /// A roster index for listing. Whether an agent administers is asked of the grants
  /// (`can`), not of this link.
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
// The grant indexes (`AgentGrants`, `AllGrants`, `GrantRevocations`) are
// never tombstoned: `can` reads the first and the last, so a tombstone would
// hide a grant or undo a revocation for every reader. The administrator
// roster links are tombstoned by `remove_administrator`; who may do that is
// still open (#234's list), and `can` does not read them.

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

/// The original entry a delete points at, read back as one of this zome's types, or
/// `None` when it is not this zome's to judge: a system entry such as a capability
/// grant, whose delete Holochain shows to every integrity zome, or another zome's entry.
fn deleted_entry(
  action: &TypedAction<DeleteData>,
) -> ExternResult<Result<Option<EntryTypes>, String>> {
  let original = must_get_valid_record(action.deletes_address.clone())?;
  let Ok(creation) = TypedAction::<EntryCreationData>::try_from(original.action().clone()) else {
    return Ok(Err(
      "Original action for a delete must be a Create or Update action".to_string(),
    ));
  };
  let EntryType::App(def) = creation.entry_type() else {
    return Ok(Ok(None));
  };
  let Some(entry) = original.entry().as_option() else {
    return Ok(Err("Original record for a delete must contain an entry".to_string()));
  };
  Ok(Ok(EntryTypes::deserialize_from_type(
    *def.zome_index,
    def.entry_index,
    entry,
  )?))
}

/// Nothing in this zome is deleted: a status is a history, a grant or a
/// revocation is the record an act rests on. One function, called for the
/// record op of a delete and for the op its original's authorities receive,
/// so the rule cannot hold on one and not the other (#234).
fn validate_delete(action: &TypedAction<DeleteData>) -> ExternResult<ValidateCallbackResult> {
  match deleted_entry(action)? {
    Ok(Some(EntryTypes::Status(_))) => Ok(ValidateCallbackResult::Invalid(String::from(
      "Status cannot be deleted",
    ))),
    Ok(Some(EntryTypes::RoleGrant(_))) | Ok(Some(EntryTypes::RoleRevocation(_))) => {
      Ok(ValidateCallbackResult::Invalid(String::from(
        "A grant or a revocation is a record and cannot be deleted; revoke a grant instead",
      )))
    }
    // Not this zome's entry: nothing here to refuse.
    Ok(None) => Ok(ValidateCallbackResult::Valid),
    Err(reason) => Ok(ValidateCallbackResult::Invalid(reason)),
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
    // A grant or a revocation is a record: never updated, as it is never
    // deleted. An update would be the other way to rewrite one.
    EntryTypes::RoleGrant(_) | EntryTypes::RoleRevocation(_) if is_update => Ok(
      ValidateCallbackResult::Invalid(String::from("a grant or a revocation is never updated")),
    ),
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
      OpRecord::DeleteEntry { action } => validate_delete(&action),
      _ => Ok(ValidateCallbackResult::Valid),
    },
    // The same two rules again, for the authorities of the *original*: an
    // update or a delete is also delivered, as its own op, to whoever holds
    // the record it changes, and that authority never sees the record op
    // above. Left to fall through, it would mark a grant deleted on the word
    // of a node whose own record authority had refused the delete.
    FlatOp::Update(OpUpdate::Entry { app_entry, action }) => {
      validate_entry(app_entry, action.author(), true)
    }
    FlatOp::Delete(OpDelete { action }) => validate_delete(&action),
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
      // The grant indexes are what `can` reads. A tombstone on a holder's
      // index would hide their grant from every reader; one on a revocation
      // link would bring a revoked grant back. No coordinator tombstones
      // them, so every such delete is a forgery.
      LinkTypes::AgentGrants | LinkTypes::AllGrants | LinkTypes::GrantRevocations => {
        Ok(ValidateCallbackResult::Invalid(String::from(
          "a grant index is a record and is never tombstoned",
        )))
      }
      // The administrator roster links are tombstoned by `remove_administrator`,
      // by another administrator; a tombstone carries no grant, so who may
      // write one is still open (#234's list). `can` does not read them.
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

  // -- The ops the *original* receives --
  //
  // An update or a delete is delivered a second time, as its own op, to the
  // authorities of the record it changes. They never see the record op, so a
  // rule that ran there alone would let them mark a grant updated or deleted.
  // A Sweettest cannot show this: the author's own conductor validates every
  // op of a commit and refuses on the first, which here is the record op.

  use utils::grants::{Authority, RoleGrant};
  use utils::validation_harness::{
    created_cap_grant, created_record, delete_ops, set_zome_types_holding,
    update_op_for_the_original,
  };

  use crate::UnitEntryTypes;

  fn a_grant() -> SerializedBytes {
    RoleGrant {
      role: "admin".to_string(),
      holder: AgentPubKey::from_raw_36(vec![9; 36]),
      scope: None,
      authority: Authority::Progenitor {
        signature: Signature([0; SIGNATURE_BYTES]),
      },
    }
    .try_into()
    .unwrap()
  }

  fn delete_verdicts(original: Record) -> (ValidateCallbackResult, ValidateCallbackResult) {
    let (record_op, original_op) = delete_ops(&original);
    set_zome_types_holding(EntryTypes::ENUM_LEN, LinkTypes::ENUM_LEN, vec![original]);
    let record = validate(record_op).unwrap();
    let at_the_original = validate(original_op).unwrap();
    println!("record op: {record:?}\noriginal's op: {at_the_original:?}");
    (record, at_the_original)
  }

  /// Goes red if the `FlatOp::Update` arm is removed from `validate`.
  #[test]
  fn an_update_of_a_grant_is_refused_on_the_op_the_original_receives() {
    set_zome_types(EntryTypes::ENUM_LEN, LinkTypes::ENUM_LEN);
    let verdict = validate(update_op_for_the_original(
      UnitEntryTypes::RoleGrant as u8,
      a_grant(),
    ))
    .unwrap();
    assert_eq!(
      verdict,
      ValidateCallbackResult::Invalid("a grant or a revocation is never updated".into())
    );
  }

  /// Goes red if the `FlatOp::Delete` arm is removed from `validate`.
  #[test]
  fn a_delete_of_a_grant_is_refused_on_both_ops() {
    let refusal = ValidateCallbackResult::Invalid(
      "A grant or a revocation is a record and cannot be deleted; revoke a grant instead".into(),
    );
    let (record, at_the_original) =
      delete_verdicts(created_record(UnitEntryTypes::RoleGrant as u8, a_grant()));
    assert_eq!(record, refusal);
    assert_eq!(at_the_original, refusal);
  }

  /// Goes red if the `FlatOp::Delete` arm is removed from `validate`.
  #[test]
  fn a_delete_of_a_status_is_refused_on_both_ops() {
    let status: SerializedBytes = Status {
      status_type: "accepted".to_string(),
      reason: None,
      suspended_until: None,
      grant: None,
    }
    .try_into()
    .unwrap();
    let refusal = ValidateCallbackResult::Invalid("Status cannot be deleted".into());
    let (record, at_the_original) =
      delete_verdicts(created_record(UnitEntryTypes::Status as u8, status));
    assert_eq!(record, refusal);
    assert_eq!(at_the_original, refusal);
  }

  /// Holochain shows the delete of a capability grant to every integrity zome. It is
  /// not this zome's entry, so there is nothing here to refuse: refusing it would stop
  /// any agent ever deleting a capability grant on this network.
  ///
  /// Goes red if `deleted_entry` treats an entry that is not an app entry as an error.
  #[test]
  fn a_delete_of_a_capability_grant_is_not_this_zomes_to_refuse() {
    let (record, at_the_original) = delete_verdicts(created_cap_grant());
    assert_eq!(record, ValidateCallbackResult::Valid);
    assert_eq!(at_the_original, ValidateCallbackResult::Valid);
  }
}
