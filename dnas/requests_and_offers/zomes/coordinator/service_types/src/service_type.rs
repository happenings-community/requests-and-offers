use hdk::prelude::*;
use service_types_integrity::{EntryTypes, LinkTypes, ServiceType};
use utils::errors::{AdministrationError, CommonError};

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
  let path = Path::from("all_service_types");
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

  // Delete the service type entry
  delete_entry(service_type_hash)
}

/// Get all service types
#[hdk_extern]
pub fn get_all_service_types(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("all_service_types");
  let path_hash = path.path_entry_hash()?;

  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllServiceTypes)?.build())?;

  let records: Result<Vec<Record>, WasmError> = links
    .into_iter()
    .map(|link| {
      let record = get(
        link.target.into_action_hash().unwrap(),
        GetOptions::default(),
      )?;
      record
        .ok_or(CommonError::EntryNotFound("Could not find service type record".to_string()).into())
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
