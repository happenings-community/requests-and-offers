use hdk::prelude::*;
use service_types_integrity::{EntryTypes, LinkTypes, ServiceType, ServiceTypeStatus};
use utils::{
  errors::{AdministrationError, CommonError, ServiceTypeError},
  grants::{can_i, grant_tag, require_grant, Ability},
  links::CatalogueState,
  resolve_chain_root, GetServiceTypeForEntityInput, OriginalActionHash, PreviousActionHash,
  ServiceTypeLinkInput, UpdateServiceTypeLinksInput,
};

use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, get_agent_user,
};

// Path anchor constants for service type status
const PENDING_SERVICE_TYPES_PATH: &str = "service_types.status.pending";
const APPROVED_SERVICE_TYPES_PATH: &str = "service_types.status.approved";
const REJECTED_SERVICE_TYPES_PATH: &str = "service_types.status.rejected";

// Helper function to get path entry hash for a status path
fn get_status_path_hash(status_path: &str) -> ExternResult<EntryHash> {
  Path::from(status_path).path_entry_hash()
}

/// A service type's state: the latest decision linked from it, or pending
/// if there is none. The decision is read from each link's tag, which
/// validation checks against its status entry, so no entry is fetched and none
/// can be missed; ties are broken by the link's hash (#234).
fn current_state(service_type_hash: &ActionHash) -> ExternResult<CatalogueState> {
  let filter = LinkTypes::ServiceTypeStatusUpdates
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(service_type_hash.clone(), filter), GetStrategy::Network)?;
  Ok(utils::links::latest_catalogue_state(&links))
}

/// Records an administrator's decision on a service type: a status entry
/// carrying their grant, linked from the service type, and, for approved and
/// rejected, an index link on that status path. Nothing is tombstoned: the
/// service type is shared, and the latest decision is what readers see.
fn decide(service_type_hash: &ActionHash, state: CatalogueState) -> ExternResult<ActionHash> {
  let grant = require_grant(Ability::Administer, None)?;
  let status_hash = create_entry(EntryTypes::ServiceTypeStatus(ServiceTypeStatus {
    service_type: service_type_hash.clone(),
    state: state.clone(),
    grant: Some(grant.clone()),
  }))?;
  create_link(
    service_type_hash.clone(),
    status_hash.clone(),
    LinkTypes::ServiceTypeStatusUpdates,
    utils::links::catalogue_state_tag(&state),
  )?;
  let path = match state {
    CatalogueState::Approved => Some(APPROVED_SERVICE_TYPES_PATH),
    CatalogueState::Rejected => Some(REJECTED_SERVICE_TYPES_PATH),
    _ => None,
  };
  if let Some(path) = path {
    create_link(
      get_status_path_hash(path)?,
      service_type_hash.clone(),
      LinkTypes::AllServiceTypes,
      grant_tag(&grant),
    )?;
  }
  Ok(status_hash)
}

/// Input for creating a new service type
#[derive(Serialize, Deserialize, Debug)]
pub struct ServiceTypeInput {
  pub service_type: ServiceType,
}

/// Create a new service type (admin only, automatically approved)
#[hdk_extern]
pub fn create_service_type(input: ServiceTypeInput) -> ExternResult<Record> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Validation reads the grant, so it is ours, never the caller's.
  let mut service_type = input.service_type;
  service_type.grant = Some(require_grant(Ability::Administer, None)?);

  // Create the service type entry
  let service_type_hash = create_entry(EntryTypes::ServiceType(service_type))?;

  // Get the created record
  let record = get(service_type_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the newly created service type".to_string()),
  )?;

  // Create link from all_service_types path
  let path = Path::from("service_types");
  let path_hash = path.path_entry_hash()?;
  create_link(
    path_hash,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    (),
  )?;

  // An administrator's service type is approved as it is created.
  decide(&service_type_hash, CatalogueState::Approved)?;

  Ok(record)
}

/// Suggest a new service type (accepted users OR administrators, pending approval)
#[hdk_extern]
pub fn suggest_service_type(input: ServiceTypeInput) -> ExternResult<Record> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is an administrator first
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_admin {
    // If not an admin, check if the agent is an accepted user
    let user_action_hash = get_agent_user(agent_pubkey)?
      .first()
      .ok_or(CommonError::ActionHashNotFound("user".to_string()))?
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
    let is_accepted = check_if_entity_is_accepted("users".to_string(), user_action_hash)?;

    if !is_accepted {
      return Err(AdministrationError::Unauthorized.into());
    }
  }

  // Validation reads the grant, so it is ours, never the caller's: an admin
  // grant if we hold one, else a member grant.
  let mut service_type = input.service_type;
  service_type.grant = Some(match can_i(Ability::Administer, None)? {
    Some(grant) => grant,
    None => require_grant(Ability::Participate, None)?,
  });

  // Create the service type entry
  let service_type_hash = create_entry(EntryTypes::ServiceType(service_type))?;

  // Get the created record
  let record = get(service_type_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the newly created service type".to_string()),
  )?;

  // Create link from all_service_types path
  let path = Path::from("service_types");
  let path_hash = path.path_entry_hash()?;
  create_link(
    path_hash,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    (),
  )?;

  // Link to pending_service_types path
  let pending_path_hash = get_status_path_hash(PENDING_SERVICE_TYPES_PATH)?;
  create_link(
    pending_path_hash,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    (),
  )?;

  Ok(record)
}

/// Get a service type by its action hash
#[hdk_extern]
pub fn get_service_type(service_type_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(service_type_hash, GetOptions::default())
}

/// Get the latest version of a service type given the original action hash
#[hdk_extern]
pub fn get_latest_service_type_record(
  original_action_hash: ActionHash,
) -> ExternResult<Option<Record>> {
  let link_type_filter = LinkTypes::ServiceTypeUpdates
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(original_action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_action_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("service_type".to_string()))?,
    None => original_action_hash.clone(),
  };
  get(latest_action_hash, GetOptions::default())
}

/// Input for updating a service type
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateServiceTypeInput {
  pub original_action_hash: OriginalActionHash,
  pub previous_action_hash: PreviousActionHash,
  pub updated_service_type: ServiceType,
}

/// Update an existing service type
#[hdk_extern]
pub fn update_service_type(input: UpdateServiceTypeInput) -> ExternResult<ActionHash> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Validation reads the grant, so it is ours, never the caller's.
  let mut updated_service_type = input.updated_service_type;
  updated_service_type.grant = Some(require_grant(Ability::Administer, None)?);

  // Update the service type entry
  let updated_action_hash = update_entry(input.previous_action_hash.into(), &updated_service_type)?;

  // Create a link from the original service type to the updated one. The caller's
  // "original" may itself be a revision (list surfaces hand back the latest record),
  // so anchor at the chain root or the second edit starts a rival update chain that
  // get_latest_service_type_record will never see.
  create_link(
    resolve_chain_root(input.original_action_hash.0),
    updated_action_hash.clone(),
    LinkTypes::ServiceTypeUpdates,
    (),
  )?;

  Ok(updated_action_hash)
}

/// Delete a service type
#[hdk_extern]
pub fn delete_service_type(service_type_hash: ActionHash) -> ExternResult<ActionHash> {
  // Retires the service type. It is shared, and listings and exchanges may
  // name it, so it is never tombstoned (#234): an administrator moves its
  // status to retired, and it leaves every list. Returns the status entry.
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }
  decide(&resolve_chain_root(service_type_hash), CatalogueState::Retired)
}

/// Get all pending service types (admin only)
#[hdk_extern]
pub fn get_pending_service_types(_: ()) -> ExternResult<Vec<Record>> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Get service types by status
  get_service_types_by_status(PENDING_SERVICE_TYPES_PATH)
}

/// Get all approved service types (public)
#[hdk_extern]
pub fn get_approved_service_types(_: ()) -> ExternResult<Vec<Record>> {
  get_service_types_by_status(APPROVED_SERVICE_TYPES_PATH)
}

/// Get all rejected service types (admin only)
#[hdk_extern]
pub fn get_rejected_service_types(_: ()) -> ExternResult<Vec<Record>> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  get_service_types_by_status(REJECTED_SERVICE_TYPES_PATH)
}

/// Helper function to get service types by status path
fn get_service_types_by_status(status_path: &str) -> ExternResult<Vec<Record>> {
  // The status path indexes every service type that ever reached that status;
  // its latest status entry says whether it is there now.
  let wanted = match status_path {
    APPROVED_SERVICE_TYPES_PATH => CatalogueState::Approved,
    REJECTED_SERVICE_TYPES_PATH => CatalogueState::Rejected,
    _ => CatalogueState::Pending,
  };
  let path_hash = get_status_path_hash(status_path)?;
  let link_type_filter = LinkTypes::AllServiceTypes
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  let mut seen = std::collections::HashSet::new();
  let mut records = Vec::new();
  for link in links {
    if let Some(target_hash) = link.target.into_action_hash() {
      if !seen.insert(target_hash.clone()) || current_state(&target_hash)? != wanted {
        continue;
      }
      if let Some(record) = get_latest_service_type_record(target_hash.clone())? {
        records.push(record);
      }
    }
  }

  Ok(records)
}

/// Approve a service type from any state (admin only)
#[hdk_extern]
pub fn approve_service_type(service_type_hash: ActionHash) -> ExternResult<()> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Status paths are keyed by the chain root; a client holding a revision hash
  // would otherwise file this service type under a second, invisible identity.
  let service_type_hash = resolve_chain_root(service_type_hash);

  // A steward may approve a rejected suggestion, reversing an earlier refusal,
  // but approving twice is a mistake rather than a decision.
  if current_state(&service_type_hash)? == CatalogueState::Approved {
    return Err(ServiceTypeError::AlreadyApproved.into());
  }

  decide(&service_type_hash, CatalogueState::Approved)?;

  Ok(())
}

/// Reject a pending service type (admin only)
#[hdk_extern]
pub fn reject_service_type(service_type_hash: ActionHash) -> ExternResult<()> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Status paths are keyed by the chain root (see approve_service_type).
  let service_type_hash = resolve_chain_root(service_type_hash);

  if current_state(&service_type_hash)? != CatalogueState::Pending {
    return Err(CommonError::InvalidData("Service type is not pending".to_string()).into());
  }
  decide(&service_type_hash, CatalogueState::Rejected)?;

  Ok(())
}

/// Reject an approved service type (admin only)
/// This will also clean up links to requests and offers
#[hdk_extern]
pub fn reject_approved_service_type(service_type_hash: ActionHash) -> ExternResult<()> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Status paths are keyed by the chain root (see approve_service_type).
  let service_type_hash = resolve_chain_root(service_type_hash);

  if current_state(&service_type_hash)? != CatalogueState::Approved {
    return Err(CommonError::InvalidData("Service type is not approved".to_string()).into());
  }
  decide(&service_type_hash, CatalogueState::Rejected)?;

  // Clean up links to requests and offers
  // 1. Get all requests linked to this service type
  let link_type_filter = LinkTypes::ServiceTypeToRequest
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let request_links = get_links(
    LinkQuery::new(service_type_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  // 2. Remove links for each request
  for link in request_links {
    if let Some(request_hash) = link.target.clone().into_action_hash() {
      unlink_from_service_type(ServiceTypeLinkInput {
        service_type_hash: OriginalActionHash(service_type_hash.clone()),
        action_hash: OriginalActionHash(request_hash),
        entity: "request".to_string(),
      })?;
    }
  }

  // 3. Get all offers linked to this service type
  let link_type_filter = LinkTypes::ServiceTypeToOffer
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let offer_links = get_links(
    LinkQuery::new(service_type_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  // 4. Remove links for each offer
  for link in offer_links {
    if let Some(offer_hash) = link.target.clone().into_action_hash() {
      unlink_from_service_type(ServiceTypeLinkInput {
        service_type_hash: OriginalActionHash(service_type_hash.clone()),
        action_hash: OriginalActionHash(offer_hash),
        entity: "offer".to_string(),
      })?;
    }
  }

  Ok(())
}

/// Check if a service type is approved (for internal/cross-zome use)
#[hdk_extern]
pub fn is_service_type_approved(service_type_hash: ActionHash) -> ExternResult<bool> {
  Ok(current_state(&resolve_chain_root(service_type_hash))? == CatalogueState::Approved)
}

/// Get the status of a service type: pending, approved, rejected or retired
#[hdk_extern]
pub fn get_service_type_status(service_type_hash: ActionHash) -> ExternResult<String> {
  Ok(current_state(&resolve_chain_root(service_type_hash))?.as_str().to_string())
}

fn get_records_for_service_type(links: Vec<Link>, entity: &str) -> ExternResult<Vec<Record>> {
  let records: Result<Vec<Record>, WasmError> = links
    .into_iter()
    .map(|link| {
      let record = get(
        link.target.into_action_hash().unwrap(),
        GetOptions::default(),
      )?;
      record.ok_or(CommonError::EntryNotFound(format!("Could not find {} record", entity)).into())
    })
    .collect();

  records
}

/// Get requests linked to a service type
#[hdk_extern]
pub fn get_requests_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::ServiceTypeToRequest
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(service_type_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  get_records_for_service_type(links, "request")
}

/// Get offers linked to a service type
#[hdk_extern]
pub fn get_offers_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::ServiceTypeToOffer
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(service_type_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  get_records_for_service_type(links, "offer")
}

/// Get users linked to a service type
#[hdk_extern]
pub fn get_users_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::ServiceTypeToUser
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(service_type_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  get_records_for_service_type(links, "user")
}

#[hdk_extern]
pub fn get_service_type_for_entity(
  input: GetServiceTypeForEntityInput,
) -> ExternResult<Option<ActionHash>> {
  let link_type = match input.entity.as_str() {
    "request" => LinkTypes::ServiceTypeToRequest,
    "offer" => LinkTypes::ServiceTypeToOffer,
    "user" => LinkTypes::ServiceTypeToUser,
    _ => {
      return Err(CommonError::InvalidData("Must be request, offer, or user".to_string()).into())
    }
  };

  let link_type_filter = link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(input.original_action_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  let service_type_hash = links
    .first()
    .map(|link| link.target.clone().into_action_hash().unwrap());

  Ok(service_type_hash)
}

/// Create a bidirectional link between a service type and a request, offer, or user
#[hdk_extern]
pub fn link_to_service_type(input: ServiceTypeLinkInput) -> ExternResult<()> {
  // Canonicalise at receipt: links must anchor at the chain root regardless
  // of which revision hash the caller holds.
  let mut input = input;
  input.service_type_hash =
    OriginalActionHash(resolve_chain_root(input.service_type_hash.0.clone()));
  let (service_to_entity_link_type, entity_to_service_link_type) = match input.entity.as_str() {
    "request" => (
      LinkTypes::ServiceTypeToRequest,
      LinkTypes::RequestToServiceType,
    ),
    "offer" => (LinkTypes::ServiceTypeToOffer, LinkTypes::OfferToServiceType),
    "user" => (LinkTypes::ServiceTypeToUser, LinkTypes::UserToServiceType),
    _ => {
      return Err(CommonError::InvalidData("Must be request, offer, or user".to_string()).into())
    }
  };

  // For requests and offers, check if the service type is approved
  if input.entity == "request" || input.entity == "offer" {
    let is_approved = is_service_type_approved(input.service_type_hash.0.clone())?;
    if !is_approved {
      return Err(
        CommonError::InvalidData("Cannot link to a service type that is not approved".to_string())
          .into(),
      );
    }
  }

  // Create ServiceType -> Request/Offer link
  create_link(
    input.service_type_hash.clone(),
    input.action_hash.clone(),
    service_to_entity_link_type,
    (),
  )?;

  // Create Request/Offer -> ServiceType link
  create_link(
    input.action_hash,
    input.service_type_hash,
    entity_to_service_link_type,
    (),
  )?;

  Ok(())
}

/// Remove bidirectional links between a service type and a request, offer, or user
#[hdk_extern]
pub fn unlink_from_service_type(input: ServiceTypeLinkInput) -> ExternResult<()> {
  // Canonicalise at receipt: links must anchor at the chain root regardless
  // of which revision hash the caller holds.
  let mut input = input;
  input.service_type_hash =
    OriginalActionHash(resolve_chain_root(input.service_type_hash.0.clone()));
  let (service_to_entity_link_type, entity_to_service_link_type) = match input.entity.as_str() {
    "request" => (
      LinkTypes::ServiceTypeToRequest,
      LinkTypes::RequestToServiceType,
    ),
    "offer" => (LinkTypes::ServiceTypeToOffer, LinkTypes::OfferToServiceType),
    "user" => (LinkTypes::ServiceTypeToUser, LinkTypes::UserToServiceType),
    _ => {
      return Err(CommonError::InvalidData("Must be request, offer, or user".to_string()).into())
    }
  };

  // Find and delete ServiceType -> Request/Offer links
  let link_type_filter = service_to_entity_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let service_to_entity_links = get_links(
    LinkQuery::new(input.service_type_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  for link in service_to_entity_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == input.action_hash.0 {
        delete_link(link.create_link_hash, GetOptions::default())?;
        break;
      }
    }
  }

  // Find and delete Request/Offer -> ServiceType links
  let link_type_filter = entity_to_service_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let entity_to_service_links = get_links(
    LinkQuery::new(input.action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  for link in entity_to_service_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == input.service_type_hash.0 {
        delete_link(link.create_link_hash, GetOptions::default())?;
        break;
      }
    }
  }

  Ok(())
}

/// Update service type links for a request, offer, or user
#[hdk_extern]
pub fn update_service_type_links(input: UpdateServiceTypeLinksInput) -> ExternResult<()> {
  // Canonicalise at receipt: links must anchor at the chain root regardless
  // of which revision hash the caller holds.
  let mut input = input;
  input.new_service_type_hashes = input
    .new_service_type_hashes
    .clone()
    .into_iter()
    .map(resolve_chain_root)
    .collect();
  let entity_to_service_link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToServiceType,
    "offer" => LinkTypes::OfferToServiceType,
    "user" => LinkTypes::UserToServiceType,
    _ => {
      return Err(CommonError::InvalidData("Must be request, offer, or user".to_string()).into())
    }
  };

  // Get existing service type links
  let link_type_filter = entity_to_service_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let existing_links = get_links(
    LinkQuery::new(input.action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  let existing_service_type_hashes: Vec<ActionHash> = existing_links
    .iter()
    .filter_map(|link| link.target.clone().into_action_hash())
    .collect();

  // Remove links that are no longer needed
  for existing_hash in &existing_service_type_hashes {
    if !input.new_service_type_hashes.contains(existing_hash) {
      unlink_from_service_type(ServiceTypeLinkInput {
        service_type_hash: OriginalActionHash(existing_hash.clone()),
        action_hash: input.action_hash.clone(),
        entity: input.entity.clone(),
      })?;
    }
  }

  // Add new links
  for new_hash in &input.new_service_type_hashes {
    if !existing_service_type_hashes.contains(new_hash) {
      link_to_service_type(ServiceTypeLinkInput {
        service_type_hash: OriginalActionHash(new_hash.clone()),
        action_hash: input.action_hash.clone(),
        entity: input.entity.clone(),
      })?;
    }
  }

  Ok(())
}

/// Get all service type hashes linked to a request, offer, or user
#[hdk_extern]
pub fn get_service_types_for_entity(
  input: GetServiceTypeForEntityInput,
) -> ExternResult<Vec<ActionHash>> {
  let entity_to_service_link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToServiceType,
    "offer" => LinkTypes::OfferToServiceType,
    "user" => LinkTypes::UserToServiceType,
    _ => {
      return Err(CommonError::InvalidData("Must be request, offer, or user".to_string()).into())
    }
  };

  let link_type_filter = entity_to_service_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(input.original_action_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  let service_type_hashes: Vec<ActionHash> = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .collect();

  Ok(service_type_hashes)
}

/// Delete all service type links for a request or offer (used when deleting the entity)
#[hdk_extern]
pub fn delete_all_service_type_links_for_entity(
  input: GetServiceTypeForEntityInput,
) -> ExternResult<()> {
  let service_type_hashes = get_service_types_for_entity(input.clone())?;

  for service_type_hash in service_type_hashes {
    unlink_from_service_type(ServiceTypeLinkInput {
      service_type_hash: OriginalActionHash(service_type_hash),
      action_hash: input.original_action_hash.clone(),
      entity: input.entity.clone(),
    })?;
  }

  Ok(())
}
