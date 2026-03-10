use hdi::prelude::*;
use status::*;
use utils::DnaProperties;

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
// ADMIN LINK VALIDATION HELPERS
// ============================================================================

/// Returns `true` if `agent` matches the network progenitor public key stored in DNA properties.
///
/// This check is deterministic (no DHT reads) and available in integrity validation contexts.
/// The progenitor's key is fixed at install time and cannot change, making this safe for use
/// inside the `validate` callback where `get_links` / `get()` are not available.
///
/// NOTE: Dynamic admin-membership checks (is-an-admin?) require DHT reads and are therefore
/// enforced by the coordinator layer via `check_if_agent_is_administrator`.
fn is_progenitor(agent: &AgentPubKey) -> ExternResult<bool> {
  match DnaProperties::get_progenitor_pubkey()? {
    Some(progenitor_pubkey) => Ok(agent == &progenitor_pubkey),
    None => Ok(false),
  }
}

// ============================================================================
// AllAdministrators LINK VALIDATION
// ============================================================================

/// Validates `AllAdministrators` link creation.
///
/// When the network progenitor writes the first admin link, their authorship is
/// cryptographically verified against the `progenitor_pubkey` in DNA properties —
/// a deterministic, DHT-read-free check available in integrity validation.
///
/// All other admin-link creation is authorized by the coordinator layer
/// (`add_administrator` → `check_if_agent_is_administrator`). Integrity defaults to
/// `Valid` for non-progenitor callers because `get_links` is not available in
/// HDI 0.7.0 validation callbacks — admin membership checks require DHT reads
/// which cannot be performed here.
fn validate_create_link_all_administrators(
  action: CreateLink,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  if is_progenitor(&action.author)? {
    return Ok(ValidateCallbackResult::Valid);
  }
  // Non-progenitor creates are authorized at the coordinator layer.
  // Integrity cannot perform DHT reads, so we default-allow here.
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
/// Same progenitor-bootstrap / coordinator-delegation policy as
/// [`validate_create_link_all_administrators`]: progenitor is always allowed; all other
/// callers are verified by the coordinator before the call reaches the DHT.
/// Integrity defaults to `Valid` for non-progenitor callers because `get_links` is not
/// available in HDI 0.7.0 validation callbacks.
fn validate_create_link_agent_administrators(
  action: CreateLink,
  _base_address: AnyLinkableHash,
  _target_address: AnyLinkableHash,
  _tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  if is_progenitor(&action.author)? {
    return Ok(ValidateCallbackResult::Valid);
  }
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
      },
      OpEntry::UpdateEntry { app_entry, .. } => match app_entry {
        EntryTypes::Status(status) => validate_status(status),
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
