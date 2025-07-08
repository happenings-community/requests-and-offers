use hdk::prelude::*;
use mediums_of_exchange_integrity::{EntryTypes, LinkTypes, MediumOfExchange};
use utils::errors::{AdministrationError, CommonError};

use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, get_agent_user,
};

// Path anchor constants for medium of exchange status
const PENDING_MEDIUMS_OF_EXCHANGE_PATH: &str = "mediums_of_exchange.status.pending";
const APPROVED_MEDIUMS_OF_EXCHANGE_PATH: &str = "mediums_of_exchange.status.approved";
const REJECTED_MEDIUMS_OF_EXCHANGE_PATH: &str = "mediums_of_exchange.status.rejected";

// Helper function to get path entry hash for a status path
fn get_status_path_hash(status_path: &str) -> ExternResult<EntryHash> {
  Path::from(status_path).path_entry_hash()
}

/// Input for creating/suggesting a new medium of exchange
#[derive(Serialize, Deserialize, Debug)]
pub struct MediumOfExchangeInput {
  pub medium_of_exchange: MediumOfExchange,
}

/// Suggest a new medium of exchange (only accepted users, pending approval)
#[hdk_extern]
pub fn suggest_medium_of_exchange(input: MediumOfExchangeInput) -> ExternResult<Record> {
  // Check if the agent is an accepted user
  let agent_pubkey = agent_info()?.agent_initial_pubkey;
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

  // Ensure resource_spec_hrea_id is None for suggested entries
  let mut medium_of_exchange = input.medium_of_exchange;
  medium_of_exchange.resource_spec_hrea_id = None;

  // Create the medium of exchange entry
  let medium_of_exchange_hash =
    create_entry(EntryTypes::MediumOfExchange(medium_of_exchange.clone()))?;

  // Get the created record
  let record = get(medium_of_exchange_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the newly created medium of exchange".to_string()),
  )?;

  // Create link from all_mediums_of_exchange path
  let path = Path::from("mediums_of_exchange");
  let path_hash = path.path_entry_hash()?;
  create_link(
    path_hash,
    medium_of_exchange_hash.clone(),
    LinkTypes::AllMediumsOfExchange,
    (),
  )?;

  // Remove from all status paths to ensure it only has one status
  remove_medium_of_exchange_from_status_paths(medium_of_exchange_hash.clone())?;

  // Link to pending_mediums_of_exchange path
  let pending_path_hash = get_status_path_hash(PENDING_MEDIUMS_OF_EXCHANGE_PATH)?;
  create_link(
    pending_path_hash,
    medium_of_exchange_hash.clone(),
    LinkTypes::AllMediumsOfExchange,
    (),
  )?;

  Ok(record)
}

/// Get a medium of exchange by its action hash
#[hdk_extern]
pub fn get_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(medium_of_exchange_hash, GetOptions::default())
}

/// Get all mediums of exchange
#[hdk_extern]
pub fn get_all_mediums_of_exchange(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("mediums_of_exchange");
  let links = get_links(
    GetLinksInputBuilder::try_new(path.path_entry_hash()?, LinkTypes::AllMediumsOfExchange)?
      .build(),
  )?;
  let get_input: Vec<GetInput> = links
    .into_iter()
    .map(|link| {
      GetInput::new(
        link
          .target
          .clone()
          .into_any_dht_hash()
          .expect("Failed to convert link target"),
        GetOptions::default(),
      )
    })
    .collect();
  let records = HDK
    .with(|hdk| hdk.borrow().get(get_input))?
    .into_iter()
    .flatten()
    .collect();
  Ok(records)
}

/// Get pending mediums of exchange (admin only)
#[hdk_extern]
pub fn get_pending_mediums_of_exchange(_: ()) -> ExternResult<Vec<Record>> {
  // Check admin permission
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  get_mediums_of_exchange_by_status(PENDING_MEDIUMS_OF_EXCHANGE_PATH)
}

/// Get approved mediums of exchange
#[hdk_extern]
pub fn get_approved_mediums_of_exchange(_: ()) -> ExternResult<Vec<Record>> {
  get_mediums_of_exchange_by_status(APPROVED_MEDIUMS_OF_EXCHANGE_PATH)
}

/// Get rejected mediums of exchange (admin only)
#[hdk_extern]
pub fn get_rejected_mediums_of_exchange(_: ()) -> ExternResult<Vec<Record>> {
  // Check admin permission
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  get_mediums_of_exchange_by_status(REJECTED_MEDIUMS_OF_EXCHANGE_PATH)
}

// Helper function to get mediums of exchange by status
fn get_mediums_of_exchange_by_status(status_path: &str) -> ExternResult<Vec<Record>> {
  let path_hash = get_status_path_hash(status_path)?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllMediumsOfExchange)?.build())?;
  let get_input: Vec<GetInput> = links
    .into_iter()
    .map(|link| {
      GetInput::new(
        link
          .target
          .clone()
          .into_any_dht_hash()
          .expect("Failed to convert link target"),
        GetOptions::default(),
      )
    })
    .collect();
  let records = HDK
    .with(|hdk| hdk.borrow().get(get_input))?
    .into_iter()
    .flatten()
    .collect();
  Ok(records)
}

/// Approve a medium of exchange (admin only)
/// This creates hREA ResourceSpecification and updates the entry
#[hdk_extern]
pub fn approve_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()> {
  // Check admin permission
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Get the current record
  let record = get(medium_of_exchange_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the medium of exchange".to_string()),
  )?;

  // Extract the entry
  let entry = match record.entry().to_app_option::<MediumOfExchange>() {
    Ok(Some(medium_of_exchange)) => medium_of_exchange,
    Ok(None) => {
      return Err(CommonError::EntryNotFound("MediumOfExchange entry not found".to_string()).into())
    }
    Err(e) => return Err(CommonError::Serialize(e).into()),
  };

  // TODO: Create hREA ResourceSpecification here
  // For now, we'll use a placeholder ID - this will be implemented when hREA integration is added
  let resource_spec_id = format!("hrea_resource_spec_{}", entry.code);

  // Update the entry with the hREA ResourceSpecification ID
  let updated_entry = MediumOfExchange {
    code: entry.code,
    name: entry.name,
    resource_spec_hrea_id: Some(resource_spec_id),
  };

  // Create update entry
  let updated_hash = update_entry(
    medium_of_exchange_hash.clone(),
    EntryTypes::MediumOfExchange(updated_entry),
  )?;

  // Create update link
  create_link(
    medium_of_exchange_hash.clone(),
    updated_hash,
    LinkTypes::MediumOfExchangeUpdates,
    (),
  )?;

  // Remove from all status paths
  remove_medium_of_exchange_from_status_paths(medium_of_exchange_hash.clone())?;

  // Link to approved path
  let approved_path_hash = get_status_path_hash(APPROVED_MEDIUMS_OF_EXCHANGE_PATH)?;
  create_link(
    approved_path_hash,
    medium_of_exchange_hash,
    LinkTypes::AllMediumsOfExchange,
    (),
  )?;

  Ok(())
}

/// Reject a medium of exchange (admin only)
#[hdk_extern]
pub fn reject_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()> {
  // Check admin permission
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Remove from all status paths
  remove_medium_of_exchange_from_status_paths(medium_of_exchange_hash.clone())?;

  // Link to rejected path
  let rejected_path_hash = get_status_path_hash(REJECTED_MEDIUMS_OF_EXCHANGE_PATH)?;
  create_link(
    rejected_path_hash,
    medium_of_exchange_hash,
    LinkTypes::AllMediumsOfExchange,
    (),
  )?;

  Ok(())
}

// Helper function to remove medium of exchange from all status paths
fn remove_medium_of_exchange_from_status_paths(
  medium_of_exchange_hash: ActionHash,
) -> ExternResult<()> {
  let status_paths = [
    PENDING_MEDIUMS_OF_EXCHANGE_PATH,
    APPROVED_MEDIUMS_OF_EXCHANGE_PATH,
    REJECTED_MEDIUMS_OF_EXCHANGE_PATH,
  ];

  for status_path in status_paths.iter() {
    let path_hash = get_status_path_hash(status_path)?;
    let links = get_links(
      GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllMediumsOfExchange)?.build(),
    )?;

    for link in links {
      if let Some(target_hash) = link.target.into_action_hash() {
        if target_hash == medium_of_exchange_hash {
          delete_link(link.create_link_hash)?;
        }
      }
    }
  }

  Ok(())
}
