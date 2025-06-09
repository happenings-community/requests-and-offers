use hdk::prelude::*;
use service_types_integrity::{EntryTypes, LinkTypes, ServiceType};
use utils::{
  errors::{AdministrationError, CommonError},
  GetServiceTypeForEntityInput, ServiceTypeLinkInput, UpdateServiceTypeLinksInput,
};

use crate::external_calls::check_if_agent_is_administrator;

// Path anchor constants for service type status
const PENDING_SERVICE_TYPES_PATH: &str = "service_types.status.pending";
const APPROVED_SERVICE_TYPES_PATH: &str = "service_types.status.approved";
const REJECTED_SERVICE_TYPES_PATH: &str = "service_types.status.rejected";
const ALL_TAGS_PATH: &str = "service_types.all_tags";

// Helper function to get path entry hash for a status path
fn get_status_path_hash(status_path: &str) -> ExternResult<EntryHash> {
  Path::from(status_path).path_entry_hash()
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

  // Create the service type entry
  let service_type_hash = create_entry(EntryTypes::ServiceType(input.service_type.clone()))?;

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

  // Remove from all status paths to ensure it only has one status
  remove_service_type_from_status_paths(service_type_hash.clone())?;

  // Link to approved_service_types path (admin-created service types are automatically approved)
  let approved_path_hash = get_status_path_hash(APPROVED_SERVICE_TYPES_PATH)?;
  create_link(
    approved_path_hash,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    (),
  )?;

  // Index tags if present
  index_service_type_tags(&input.service_type, &service_type_hash)?;

  Ok(record)
}

/// Suggest a new service type (any user, pending approval)
#[hdk_extern]
pub fn suggest_service_type(input: ServiceTypeInput) -> ExternResult<Record> {
  // Create the service type entry
  let service_type_hash = create_entry(EntryTypes::ServiceType(input.service_type.clone()))?;

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

  // Remove from all status paths to ensure it only has one status
  remove_service_type_from_status_paths(service_type_hash.clone())?;

  // Link to pending_service_types path
  let pending_path_hash = get_status_path_hash(PENDING_SERVICE_TYPES_PATH)?;
  create_link(
    pending_path_hash,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    (),
  )?;

  // Index tags if present
  index_service_type_tags(&input.service_type, &service_type_hash)?;

  Ok(record)
}

// Helper function to index service type tags
fn index_service_type_tags(
  service_type: &ServiceType,
  service_type_hash: &ActionHash,
) -> ExternResult<()> {
  // Skip if no tags
  if service_type.tags.is_empty() {
    return Ok(());
  }

  // Create links for each tag
  for tag in &service_type.tags {
    // Create path for this tag
    let tag_path = format!("service_types.tags.{}", tag);
    let tag_path_hash = Path::from(tag_path).path_entry_hash()?;

    // Link service type to this tag path
    create_link(
      tag_path_hash.clone(),
      service_type_hash.clone(),
      LinkTypes::AllServiceTypes,
      (),
    )?;

    // Add tag to all_tags list if not already there
    let all_tags_path_hash = get_status_path_hash(ALL_TAGS_PATH)?;

    // Check if tag already exists in all_tags
    let existing_tag_links = get_links(
      GetLinksInputBuilder::try_new(all_tags_path_hash.clone(), LinkTypes::AllServiceTypes)?
        .tag_prefix(tag.clone().into())
        .build(),
    )?;

    if existing_tag_links.is_empty() {
      // Link tag to all_tags path
      create_link(
        all_tags_path_hash,
        tag_path_hash,
        LinkTypes::AllServiceTypes,
        tag.clone(),
      )?;
    }
  }

  Ok(())
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
  let links = get_links(
    GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::ServiceTypeUpdates)?
      .build(),
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
  pub original_service_type_hash: ActionHash,
  pub previous_service_type_hash: ActionHash,
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

  // Update the service type entry
  let updated_action_hash = update_entry(
    input.previous_service_type_hash,
    &input.updated_service_type,
  )?;

  // Create a link from the original service type to the updated one
  create_link(
    input.original_service_type_hash,
    updated_action_hash.clone(),
    LinkTypes::ServiceTypeUpdates,
    (),
  )?;

  Ok(updated_action_hash)
}

/// Delete a service type
#[hdk_extern]
pub fn delete_service_type(service_type_hash: ActionHash) -> ExternResult<ActionHash> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Remove the AllServiceTypes link
  let path = Path::from("service_types");
  let path_hash = path.path_entry_hash()?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllServiceTypes)?.build())?;

  // Find and delete the link to this service type
  for link in links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == service_type_hash {
        delete_link(link.create_link_hash)?;
        break;
      }
    }
  }

  // Remove status links (pending, approved, or rejected)
  remove_service_type_from_status_paths(service_type_hash.clone())?;

  // Delete the service type entry
  delete_entry(service_type_hash)
}

/// Get all service type tags
#[hdk_extern]
pub fn get_all_service_type_tags(_: ()) -> ExternResult<Vec<String>> {
  // Get the all tags path hash
  let all_tags_path_hash = get_status_path_hash(ALL_TAGS_PATH)?;

  // Get all links from the path
  let links = get_links(
    GetLinksInputBuilder::try_new(all_tags_path_hash, LinkTypes::AllServiceTypes)?.build(),
  )?;

  // Extract tags from link tags
  let tags = links
    .into_iter()
    .filter_map(|link| String::from_utf8(link.tag.into_inner()).ok())
    .collect();

  Ok(tags)
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
  // Get the path hash for the status
  let path_hash = get_status_path_hash(status_path)?;

  // Get all links from the path
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllServiceTypes)?.build())?;

  // Get all records
  let mut records = Vec::new();
  for link in links {
    if let Some(target_hash) = link.target.into_action_hash() {
      if let Some(record) = get_latest_service_type_record(target_hash.clone())? {
        records.push(record);
      }
    }
  }

  Ok(records)
}

/// Approve a pending service type (admin only)
#[hdk_extern]
pub fn approve_service_type(service_type_hash: ActionHash) -> ExternResult<()> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Get the pending path hash
  let pending_path_hash = get_status_path_hash(PENDING_SERVICE_TYPES_PATH)?;

  // Get the approved path hash
  let approved_path_hash = get_status_path_hash(APPROVED_SERVICE_TYPES_PATH)?;

  // Check if the service type is in the pending path
  let pending_links = get_links(
    GetLinksInputBuilder::try_new(pending_path_hash.clone(), LinkTypes::AllServiceTypes)?.build(),
  )?;

  let found_pending = pending_links
    .into_iter()
    .any(|link| link.target.into_action_hash() == Some(service_type_hash.clone()));

  if !found_pending {
    return Err(CommonError::InvalidData("Service type is not pending".to_string()).into());
  }

  // Remove from all status paths to ensure it only has one status
  remove_service_type_from_status_paths(service_type_hash.clone())?;

  // Add to approved path
  create_link(
    approved_path_hash,
    service_type_hash,
    LinkTypes::AllServiceTypes,
    (),
  )?;

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

  // Get the pending path hash
  let pending_path_hash = get_status_path_hash(PENDING_SERVICE_TYPES_PATH)?;

  // Get the rejected path hash
  let rejected_path_hash = get_status_path_hash(REJECTED_SERVICE_TYPES_PATH)?;

  // Check if the service type is in the pending path
  let pending_links = get_links(
    GetLinksInputBuilder::try_new(pending_path_hash.clone(), LinkTypes::AllServiceTypes)?.build(),
  )?;

  let found_pending = pending_links
    .into_iter()
    .any(|link| link.target.into_action_hash() == Some(service_type_hash.clone()));

  if !found_pending {
    return Err(CommonError::InvalidData("Service type is not pending".to_string()).into());
  }

  // Remove from all status paths to ensure it only has one status
  remove_service_type_from_status_paths(service_type_hash.clone())?;

  // Create link to rejected path
  create_link(
    rejected_path_hash,
    service_type_hash,
    LinkTypes::AllServiceTypes,
    (),
  )?;

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

  // Get the approved path hash
  let approved_path_hash = get_status_path_hash(APPROVED_SERVICE_TYPES_PATH)?;

  // Get the rejected path hash
  let rejected_path_hash = get_status_path_hash(REJECTED_SERVICE_TYPES_PATH)?;

  // Check if the service type is in the approved path
  let approved_links = get_links(
    GetLinksInputBuilder::try_new(approved_path_hash.clone(), LinkTypes::AllServiceTypes)?.build(),
  )?;

  let found_approved = approved_links
    .into_iter()
    .any(|link| link.target.into_action_hash() == Some(service_type_hash.clone()));

  if !found_approved {
    return Err(CommonError::InvalidData("Service type is not approved".to_string()).into());
  }

  // Remove from all status paths to ensure it only has one status
  remove_service_type_from_status_paths(service_type_hash.clone())?;

  // Create link to rejected path
  create_link(
    rejected_path_hash,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    (),
  )?;

  // Clean up links to requests and offers
  // 1. Get all requests linked to this service type
  let request_links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash.clone(), LinkTypes::ServiceTypeToRequest)?
      .build(),
  )?;

  // 2. Remove links for each request
  for link in request_links {
    if let Some(request_hash) = link.target.clone().into_action_hash() {
      unlink_from_service_type(ServiceTypeLinkInput {
        service_type_hash: service_type_hash.clone(),
        action_hash: request_hash,
        entity: "request".to_string(),
      })?;
    }
  }

  // 3. Get all offers linked to this service type
  let offer_links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash.clone(), LinkTypes::ServiceTypeToOffer)?
      .build(),
  )?;

  // 4. Remove links for each offer
  for link in offer_links {
    if let Some(offer_hash) = link.target.clone().into_action_hash() {
      unlink_from_service_type(ServiceTypeLinkInput {
        service_type_hash: service_type_hash.clone(),
        action_hash: offer_hash,
        entity: "offer".to_string(),
      })?;
    }
  }

  Ok(())
}

/// Helper function to remove a service type from all status paths
fn remove_service_type_from_status_paths(service_type_hash: ActionHash) -> ExternResult<()> {
  // Get the path hashes
  let pending_path_hash = get_status_path_hash(PENDING_SERVICE_TYPES_PATH)?;
  let approved_path_hash = get_status_path_hash(APPROVED_SERVICE_TYPES_PATH)?;
  let rejected_path_hash = get_status_path_hash(REJECTED_SERVICE_TYPES_PATH)?;

  // Get links from each path
  let pending_links = get_links(
    GetLinksInputBuilder::try_new(pending_path_hash, LinkTypes::AllServiceTypes)?.build(),
  )?;
  let approved_links = get_links(
    GetLinksInputBuilder::try_new(approved_path_hash, LinkTypes::AllServiceTypes)?.build(),
  )?;
  let rejected_links = get_links(
    GetLinksInputBuilder::try_new(rejected_path_hash, LinkTypes::AllServiceTypes)?.build(),
  )?;

  // Remove links from each path
  for link in pending_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == service_type_hash {
        delete_link(link.create_link_hash)?;
      }
    }
  }

  for link in approved_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == service_type_hash {
        delete_link(link.create_link_hash)?;
      }
    }
  }

  for link in rejected_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == service_type_hash {
        delete_link(link.create_link_hash)?;
      }
    }
  }

  Ok(())
}

/// Check if a service type is approved (for internal/cross-zome use)
#[hdk_extern]
pub fn is_service_type_approved(service_type_hash: ActionHash) -> ExternResult<bool> {
  // Get the approved path hash
  let approved_path_hash = get_status_path_hash(APPROVED_SERVICE_TYPES_PATH)?;

  // Check if there's a link from approved path to this service type
  let links = get_links(
    GetLinksInputBuilder::try_new(approved_path_hash, LinkTypes::AllServiceTypes)?.build(),
  )?;

  let found_approved = links
    .into_iter()
    .any(|link| link.target.into_action_hash() == Some(service_type_hash.clone()));

  Ok(found_approved)
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
  let links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToRequest)?.build(),
  )?;

  get_records_for_service_type(links, "request")
}

/// Get offers linked to a service type
#[hdk_extern]
pub fn get_offers_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToOffer)?.build(),
  )?;

  get_records_for_service_type(links, "offer")
}

/// Get users linked to a service type
#[hdk_extern]
pub fn get_users_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToUser)?.build(),
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

  let links =
    get_links(GetLinksInputBuilder::try_new(input.original_action_hash, link_type)?.build())?;

  let service_type_hash = links
    .first()
    .map(|link| link.target.clone().into_action_hash().unwrap());

  Ok(service_type_hash)
}

/// Create a bidirectional link between a service type and a request, offer, or user
#[hdk_extern]
pub fn link_to_service_type(input: ServiceTypeLinkInput) -> ExternResult<()> {
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
    let is_approved = is_service_type_approved(input.service_type_hash.clone())?;
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
  let service_to_entity_links = get_links(
    GetLinksInputBuilder::try_new(input.service_type_hash.clone(), service_to_entity_link_type)?
      .build(),
  )?;

  for link in service_to_entity_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == input.action_hash {
        delete_link(link.create_link_hash)?;
        break;
      }
    }
  }

  // Find and delete Request/Offer -> ServiceType links
  let entity_to_service_links = get_links(
    GetLinksInputBuilder::try_new(input.action_hash.clone(), entity_to_service_link_type)?.build(),
  )?;

  for link in entity_to_service_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == input.service_type_hash {
        delete_link(link.create_link_hash)?;
        break;
      }
    }
  }

  Ok(())
}

/// Update service type links for a request, offer, or user
#[hdk_extern]
pub fn update_service_type_links(input: UpdateServiceTypeLinksInput) -> ExternResult<()> {
  let entity_to_service_link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToServiceType,
    "offer" => LinkTypes::OfferToServiceType,
    "user" => LinkTypes::UserToServiceType,
    _ => {
      return Err(CommonError::InvalidData("Must be request, offer, or user".to_string()).into())
    }
  };

  // Get existing service type links
  let existing_links = get_links(
    GetLinksInputBuilder::try_new(input.action_hash.clone(), entity_to_service_link_type)?.build(),
  )?;

  let existing_service_type_hashes: Vec<ActionHash> = existing_links
    .iter()
    .filter_map(|link| link.target.clone().into_action_hash())
    .collect();

  // Remove links that are no longer needed
  for existing_hash in &existing_service_type_hashes {
    if !input.new_service_type_hashes.contains(existing_hash) {
      unlink_from_service_type(ServiceTypeLinkInput {
        service_type_hash: existing_hash.clone(),
        action_hash: input.action_hash.clone(),
        entity: input.entity.clone(),
      })?;
    }
  }

  // Add new links
  for new_hash in &input.new_service_type_hashes {
    if !existing_service_type_hashes.contains(new_hash) {
      link_to_service_type(ServiceTypeLinkInput {
        service_type_hash: new_hash.clone(),
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

  let links = get_links(
    GetLinksInputBuilder::try_new(input.original_action_hash, entity_to_service_link_type)?.build(),
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
      service_type_hash,
      action_hash: input.original_action_hash.clone(),
      entity: input.entity.clone(),
    })?;
  }

  Ok(())
}
