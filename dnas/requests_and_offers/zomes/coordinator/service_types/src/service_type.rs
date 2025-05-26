use hdk::prelude::*;
use service_types_integrity::{EntryTypes, LinkTypes, ServiceType};
use utils::{
  errors::{AdministrationError, CommonError},
  GetServiceTypeForEntityInput, ServiceTypeLinkInput, UpdateServiceTypeLinksInput,
};

use crate::external_calls::check_if_agent_is_administrator;

/// Input for creating a new service type
#[derive(Serialize, Deserialize, Debug)]
pub struct ServiceTypeInput {
  pub service_type: ServiceType,
}

/// Create a new service type
#[hdk_extern]
pub fn create_service_type(input: ServiceTypeInput) -> ExternResult<Record> {
  // Check if the agent is an administrator
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Create the service type entry
  let service_type_hash = create_entry(EntryTypes::ServiceType(input.service_type))?;

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

  // Delete the service type entry
  delete_entry(service_type_hash)
}

/// Get all service types
#[hdk_extern]
pub fn get_all_service_types(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("service_types");
  let path_hash = path.path_entry_hash()?;

  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllServiceTypes)?.build())?;

  let records: Vec<Record> = links
    .into_iter()
    .filter_map(|link| {
      let action_hash = link.target.into_action_hash().unwrap();
      match get(action_hash, GetOptions::default()) {
        Ok(Some(record)) => Some(record),
        _ => None, // Skip deleted or missing records
      }
    })
    .collect();

  Ok(records)
}

/// Get requests linked to a service type
#[hdk_extern]
pub fn get_requests_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToRequest)?.build(),
  )?;

  let records: Result<Vec<Record>, WasmError> = links
    .into_iter()
    .map(|link| {
      let record = get(
        link.target.into_action_hash().unwrap(),
        GetOptions::default(),
      )?;
      record.ok_or(CommonError::EntryNotFound("Could not find request record".to_string()).into())
    })
    .collect();

  records
}

/// Get offers linked to a service type
#[hdk_extern]
pub fn get_offers_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToOffer)?.build(),
  )?;

  let records: Result<Vec<Record>, WasmError> = links
    .into_iter()
    .map(|link| {
      let record = get(
        link.target.into_action_hash().unwrap(),
        GetOptions::default(),
      )?;
      record.ok_or(CommonError::EntryNotFound("Could not find offer record".to_string()).into())
    })
    .collect();

  records
}

#[hdk_extern]
pub fn get_service_type_for_entity(
  input: GetServiceTypeForEntityInput,
) -> ExternResult<Option<ActionHash>> {
  let link_type = match input.entity.as_str() {
    "request" => LinkTypes::ServiceTypeToRequest,
    "offer" => LinkTypes::ServiceTypeToOffer,
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
  };

  let links =
    get_links(GetLinksInputBuilder::try_new(input.original_action_hash, link_type)?.build())?;

  let service_type_hash = links
    .first()
    .map(|link| link.target.clone().into_action_hash().unwrap());

  Ok(service_type_hash)
}

/// Create a bidirectional link between a service type and a request or offer
#[hdk_extern]
pub fn link_to_service_type(input: ServiceTypeLinkInput) -> ExternResult<()> {
  let (service_to_entity_link_type, entity_to_service_link_type) = match input.entity.as_str() {
    "request" => (
      LinkTypes::ServiceTypeToRequest,
      LinkTypes::RequestToServiceType,
    ),
    "offer" => (LinkTypes::ServiceTypeToOffer, LinkTypes::OfferToServiceType),
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
  };

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

/// Remove bidirectional links between a service type and a request or offer
#[hdk_extern]
pub fn unlink_from_service_type(input: ServiceTypeLinkInput) -> ExternResult<()> {
  let (service_to_entity_link_type, entity_to_service_link_type) = match input.entity.as_str() {
    "request" => (
      LinkTypes::ServiceTypeToRequest,
      LinkTypes::RequestToServiceType,
    ),
    "offer" => (LinkTypes::ServiceTypeToOffer, LinkTypes::OfferToServiceType),
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
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

/// Update service type links for a request or offer
#[hdk_extern]
pub fn update_service_type_links(input: UpdateServiceTypeLinksInput) -> ExternResult<()> {
  let entity_to_service_link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToServiceType,
    "offer" => LinkTypes::OfferToServiceType,
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
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

/// Get all service type hashes linked to a request or offer
#[hdk_extern]
pub fn get_service_types_for_entity(
  input: GetServiceTypeForEntityInput,
) -> ExternResult<Vec<ActionHash>> {
  let entity_to_service_link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToServiceType,
    "offer" => LinkTypes::OfferToServiceType,
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
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
