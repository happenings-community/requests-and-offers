use hdi::prelude::*;
use concurrence::*;
use status::*;

pub mod concurrence;
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

  /// An act put forward for a second signatory. Inert until concurred with.
  Motion(Motion),

  /// A second signatory's agreement to a motion.
  Concurrence(Concurrence),
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
  /// Index link from a `"permission.{name}"` path entry hash to an agent's public key.
  /// Enables listing every holder of a named permission, which the public steward
  /// roster is rendered from.
  AllPermissionHolders,

  /// Index link from an agent's public key to a `"permission.{name}"` path entry hash.
  /// Enables the membership query: "does this agent hold this named permission?"
  AgentPermissions,

  /// Index link from a subject's original action hash to a motion put against it.
  SubjectMotions,

  /// Index link from a motion's action hash to the concurrence that carried it.
  /// A motion with no such link is still pending; the state derives from the records.
  MotionConcurrences,
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

// ============================================================================
// AllAdministrators LINK VALIDATION
// ============================================================================

/// Validates `AllAdministrators` link creation.
///
/// Authorization is enforced by the coordinator layer (`add_administrator` →
/// `check_if_agent_is_administrator`). Integrity defaults to `Valid` unconditionally
/// because `get_links` is not available in HDI 0.7.0 validation callbacks —
/// dynamic admin-membership checks require DHT reads which cannot be performed here.
///
/// NOTE: `is_progenitor` is intentionally not called here. It would return `Valid`
/// in both branches, making it dead code. If HDI ever exposes `get_links`, this
/// function is the right place to add real membership enforcement.
fn validate_create_link_all_administrators(
  _action: CreateLink,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

/// Validates `AllAdministrators` link deletion.
///
/// Deletion authorization (caller must be an existing admin) is enforced by the
/// coordinator layer. Integrity returns `Valid` unconditionally because `get_links`
/// is not available in HDI 0.7.0 validation callbacks.
fn validate_delete_link_all_administrators(
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  // Deletion authorization (admin-only) is enforced by the coordinator.
  Ok(ValidateCallbackResult::Valid)
}

// ============================================================================
// AgentAdministrators LINK VALIDATION
// ============================================================================

/// Validates `AgentAdministrators` link creation.
///
/// Same default-allow policy as [`validate_create_link_all_administrators`]:
/// authorization is enforced by the coordinator layer. See that function's doc
/// for the HDI 0.7.0 rationale.
fn validate_create_link_agent_administrators(
  _action: CreateLink,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

/// Validates `AgentAdministrators` link deletion.
///
/// Authorization is enforced by the coordinator layer. Integrity returns `Valid`
/// unconditionally because `get_links` is not available in HDI 0.7.0 validation
/// callbacks.
fn validate_delete_link_agent_administrators(
  _action: DeleteLink,
  _original_action: CreateLink,
  _base: AnyLinkableHash,
  _target: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

// ============================================================================
// VALIDATE CALLBACK
// ============================================================================

/// HDK integrity validation callback. Dispatches every DHT operation to the appropriate
/// type-specific validator.
///
/// - `StoreEntry` ops are routed to entry-type validators (e.g., `validate_status`).
/// - `RegisterCreateLink` / `RegisterDeleteLink` ops are routed to link-type validators.
/// - All other ops (agent activity, countersigning, etc.) return `Valid` by default.
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::StoreEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, .. } => match app_entry {
        EntryTypes::Status(status) => validate_status(status),
        EntryTypes::Motion(motion) => validate_motion(motion),
        EntryTypes::Concurrence(concurrence) => validate_concurrence(concurrence),
      },
      OpEntry::UpdateEntry { app_entry, .. } => match app_entry {
        EntryTypes::Status(status) => validate_status(status),
        EntryTypes::Motion(motion) => validate_motion(motion),
        EntryTypes::Concurrence(concurrence) => validate_concurrence(concurrence),
      },
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::RegisterCreateLink {
      link_type,
      action,
      base_address,
      target_address,
      tag,
    } => match link_type {
      LinkTypes::AllAdministrators => {
        validate_create_link_all_administrators(action, base_address, target_address, tag)
      }
      LinkTypes::AgentAdministrators => {
        validate_create_link_agent_administrators(action, base_address, target_address, tag)
      }
      LinkTypes::StatusUpdates => {
        validate_create_link_status_updates(action, base_address, target_address, tag)
      }
      _ => Ok(ValidateCallbackResult::Valid),
    },
    FlatOp::RegisterDeleteLink {
      link_type,
      action,
      original_action,
      base_address,
      target_address,
      tag,
    } => match link_type {
      LinkTypes::AllAdministrators => validate_delete_link_all_administrators(
        action,
        original_action,
        base_address,
        target_address,
        tag,
      ),
      LinkTypes::AgentAdministrators => validate_delete_link_agent_administrators(
        action,
        original_action,
        base_address,
        target_address,
        tag,
      ),
      LinkTypes::StatusUpdates => validate_delete_link_status_updates(
        action,
        original_action,
        base_address,
        target_address,
        tag,
      ),
      _ => Ok(ValidateCallbackResult::Valid),
    },
    _ => Ok(ValidateCallbackResult::Valid),
  }
}
