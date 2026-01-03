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

/// Input for linking mediums of exchange to requests/offers
#[derive(Serialize, Deserialize, Debug)]
pub struct MediumOfExchangeLinkInput {
  pub medium_of_exchange_hash: ActionHash,
  pub action_hash: ActionHash,
  pub entity: String, // "request" or "offer"
}

/// Input for getting medium of exchange for an entity
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GetMediumOfExchangeForEntityInput {
  pub original_action_hash: ActionHash,
  pub entity: String, // "request" or "offer"
}

/// Input for updating medium of exchange links
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateMediumOfExchangeLinksInput {
  pub action_hash: ActionHash,
  pub entity: String, // "request" or "offer"
  pub new_medium_of_exchange_hashes: Vec<ActionHash>,
}

/// Input for updating a medium of exchange
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateMediumOfExchangeInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
  pub updated_medium_of_exchange: MediumOfExchange,
}

/// Suggest a new medium of exchange (accepted users only, currency type only, pending approval)
#[hdk_extern]
pub fn suggest_medium_of_exchange(input: MediumOfExchangeInput) -> ExternResult<Record> {
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

  // Validate that non-admin users can only suggest currency types
  if !is_admin && input.medium_of_exchange.exchange_type != "currency" {
    return Err(CommonError::InvalidData(
      "Users can only suggest currency types. Contact an administrator to create base exchange categories.".to_string()
    ).into());
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

/// Create a new medium of exchange (admin only, both base and currency types allowed)
#[hdk_extern]
pub fn create_medium_of_exchange(input: MediumOfExchangeInput) -> ExternResult<Record> {
  // Check admin permission
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Ensure resource_spec_hrea_id is None initially (will be set during approval)
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

  // Admin-created entries go directly to approved status
  let approved_path_hash = get_status_path_hash(APPROVED_MEDIUMS_OF_EXCHANGE_PATH)?;
  create_link(
    approved_path_hash,
    medium_of_exchange_hash.clone(),
    LinkTypes::AllMediumsOfExchange,
    (),
  )?;

  Ok(record)
}

/// Update a medium of exchange (admin only)
#[hdk_extern]
pub fn update_medium_of_exchange(input: UpdateMediumOfExchangeInput) -> ExternResult<Record> {
  // Check admin permission
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Get the original record to verify it exists
  get(input.original_action_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the original medium of exchange".to_string()),
  )?;

  // Update the entry
  let updated_medium_of_exchange_hash = update_entry(
    input.previous_action_hash.clone(),
    EntryTypes::MediumOfExchange(input.updated_medium_of_exchange),
  )?;

  // Create update link
  create_link(
    input.original_action_hash.clone(),
    updated_medium_of_exchange_hash.clone(),
    LinkTypes::MediumOfExchangeUpdates,
    (),
  )?;

  // Get the updated record
  let record = get(updated_medium_of_exchange_hash, GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the updated medium of exchange".to_string()),
  )?;

  Ok(record)
}

/// Delete a medium of exchange (admin only)
#[hdk_extern]
pub fn delete_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()> {
  // Check admin permission
  let is_admin = check_if_agent_is_administrator(agent_info()?.agent_initial_pubkey)?;
  if !is_admin {
    return Err(AdministrationError::Unauthorized.into());
  }

  // Get the record to verify it exists
  let _record = get(medium_of_exchange_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the medium of exchange to delete".to_string()),
  )?;

  // Remove from all status paths first
  remove_medium_of_exchange_from_status_paths(medium_of_exchange_hash.clone())?;

  // Delete the entry
  delete_entry(medium_of_exchange_hash)?;

  Ok(())
}

/// Get a medium of exchange by its action hash
#[hdk_extern]
pub fn get_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(medium_of_exchange_hash, GetOptions::default())
}

/// Get the latest version of a medium of exchange given the original action hash
#[hdk_extern]
pub fn get_latest_medium_of_exchange_record(
  original_action_hash: ActionHash,
) -> ExternResult<Option<Record>> {
  let link_type_filter = LinkTypes::MediumOfExchangeUpdates
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
      .ok_or(CommonError::ActionHashNotFound(
        "medium_of_exchange".to_string(),
      ))?,
    None => original_action_hash.clone(),
  };
  get(latest_action_hash, GetOptions::default())
}

/// Get all mediums of exchange
#[hdk_extern]
pub fn get_all_mediums_of_exchange(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("mediums_of_exchange");
  let link_type_filter = LinkTypes::AllMediumsOfExchange
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path.path_entry_hash()?, link_type_filter),
    GetStrategy::Network,
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
  let link_type_filter = LinkTypes::AllMediumsOfExchange
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path_hash, link_type_filter),
    GetStrategy::Network,
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
    description: entry.description,
    exchange_type: entry.exchange_type,
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
    let link_type_filter = LinkTypes::AllMediumsOfExchange
      .try_into_filter()
      .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
    let links = get_links(
      LinkQuery::new(path_hash, link_type_filter),
      GetStrategy::Network,
    )?;

    for link in links {
      if let Some(target_hash) = link.target.into_action_hash() {
        if target_hash == medium_of_exchange_hash {
          delete_link(link.create_link_hash, GetOptions::default())?;
        }
      }
    }
  }

  Ok(())
}

/// Get requests linked to a medium of exchange
#[hdk_extern]
pub fn get_requests_for_medium_of_exchange(
  medium_of_exchange_hash: ActionHash,
) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::MediumOfExchangeToRequest
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(medium_of_exchange_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  get_records_for_medium_of_exchange(links, "request")
}

/// Get offers linked to a medium of exchange
#[hdk_extern]
pub fn get_offers_for_medium_of_exchange(
  medium_of_exchange_hash: ActionHash,
) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::MediumOfExchangeToOffer
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(medium_of_exchange_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  get_records_for_medium_of_exchange(links, "offer")
}

// Helper function to get records for a medium of exchange
fn get_records_for_medium_of_exchange(links: Vec<Link>, entity: &str) -> ExternResult<Vec<Record>> {
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

/// Get medium of exchange for an entity (request or offer)
#[hdk_extern]
pub fn get_medium_of_exchange_for_entity(
  input: GetMediumOfExchangeForEntityInput,
) -> ExternResult<Option<ActionHash>> {
  let link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToMediumOfExchange,
    "offer" => LinkTypes::OfferToMediumOfExchange,
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
  };

  let link_type_filter = link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(input.original_action_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  let medium_of_exchange_hash = links
    .first()
    .map(|link| link.target.clone().into_action_hash().unwrap());

  Ok(medium_of_exchange_hash)
}

/// Create a bidirectional link between a medium of exchange and a request or offer
#[hdk_extern]
pub fn link_to_medium_of_exchange(input: MediumOfExchangeLinkInput) -> ExternResult<()> {
  let (medium_to_entity_link_type, entity_to_medium_link_type) = match input.entity.as_str() {
    "request" => (
      LinkTypes::MediumOfExchangeToRequest,
      LinkTypes::RequestToMediumOfExchange,
    ),
    "offer" => (
      LinkTypes::MediumOfExchangeToOffer,
      LinkTypes::OfferToMediumOfExchange,
    ),
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
  };

  // Check if the medium of exchange is approved
  let is_approved = is_medium_of_exchange_approved(input.medium_of_exchange_hash.clone())?;
  if !is_approved {
    return Err(
      CommonError::InvalidData(
        "Cannot link to a medium of exchange that is not approved".to_string(),
      )
      .into(),
    );
  }

  // Create MediumOfExchange -> Request/Offer link
  create_link(
    input.medium_of_exchange_hash.clone(),
    input.action_hash.clone(),
    medium_to_entity_link_type,
    (),
  )?;

  // Create Request/Offer -> MediumOfExchange link
  create_link(
    input.action_hash,
    input.medium_of_exchange_hash,
    entity_to_medium_link_type,
    (),
  )?;

  Ok(())
}

/// Remove bidirectional links between a medium of exchange and a request or offer
#[hdk_extern]
pub fn unlink_from_medium_of_exchange(input: MediumOfExchangeLinkInput) -> ExternResult<()> {
  let (medium_to_entity_link_type, entity_to_medium_link_type) = match input.entity.as_str() {
    "request" => (
      LinkTypes::MediumOfExchangeToRequest,
      LinkTypes::RequestToMediumOfExchange,
    ),
    "offer" => (
      LinkTypes::MediumOfExchangeToOffer,
      LinkTypes::OfferToMediumOfExchange,
    ),
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
  };

  // Find and delete MediumOfExchange -> Request/Offer links
  let link_type_filter = medium_to_entity_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let medium_to_entity_links = get_links(
    LinkQuery::new(input.medium_of_exchange_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  for link in medium_to_entity_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == input.action_hash {
        delete_link(link.create_link_hash, GetOptions::default())?;
        break;
      }
    }
  }

  // Find and delete Request/Offer -> MediumOfExchange links
  let link_type_filter = entity_to_medium_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let entity_to_medium_links = get_links(
    LinkQuery::new(input.action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  for link in entity_to_medium_links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if target_hash == input.medium_of_exchange_hash {
        delete_link(link.create_link_hash, GetOptions::default())?;
        break;
      }
    }
  }

  Ok(())
}

/// Update medium of exchange links for a request or offer
#[hdk_extern]
pub fn update_medium_of_exchange_links(
  input: UpdateMediumOfExchangeLinksInput,
) -> ExternResult<()> {
  let entity_to_medium_link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToMediumOfExchange,
    "offer" => LinkTypes::OfferToMediumOfExchange,
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
  };

  // Get existing medium of exchange links
  let link_type_filter = entity_to_medium_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let existing_links = get_links(
    LinkQuery::new(input.action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  let existing_medium_of_exchange_hashes: Vec<ActionHash> = existing_links
    .iter()
    .filter_map(|link| link.target.clone().into_action_hash())
    .collect();

  // Remove links that are no longer needed
  for existing_hash in &existing_medium_of_exchange_hashes {
    if !input.new_medium_of_exchange_hashes.contains(existing_hash) {
      unlink_from_medium_of_exchange(MediumOfExchangeLinkInput {
        medium_of_exchange_hash: existing_hash.clone(),
        action_hash: input.action_hash.clone(),
        entity: input.entity.clone(),
      })?;
    }
  }

  // Add new links
  for new_hash in &input.new_medium_of_exchange_hashes {
    if !existing_medium_of_exchange_hashes.contains(new_hash) {
      link_to_medium_of_exchange(MediumOfExchangeLinkInput {
        medium_of_exchange_hash: new_hash.clone(),
        action_hash: input.action_hash.clone(),
        entity: input.entity.clone(),
      })?;
    }
  }

  Ok(())
}

/// Get all medium of exchange hashes linked to a request or offer
#[hdk_extern]
pub fn get_mediums_of_exchange_for_entity(
  input: GetMediumOfExchangeForEntityInput,
) -> ExternResult<Vec<ActionHash>> {
  let entity_to_medium_link_type = match input.entity.as_str() {
    "request" => LinkTypes::RequestToMediumOfExchange,
    "offer" => LinkTypes::OfferToMediumOfExchange,
    _ => return Err(CommonError::InvalidData("Must be request or offer".to_string()).into()),
  };

  let link_type_filter = entity_to_medium_link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(input.original_action_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  let medium_of_exchange_hashes: Vec<ActionHash> = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .collect();

  Ok(medium_of_exchange_hashes)
}

/// Delete all medium of exchange links for a request or offer (used when deleting the entity)
#[hdk_extern]
pub fn delete_all_medium_of_exchange_links_for_entity(
  input: GetMediumOfExchangeForEntityInput,
) -> ExternResult<()> {
  let original_action_hash = input.original_action_hash.clone();
  let entity = input.entity.clone();
  let medium_of_exchange_hashes = get_mediums_of_exchange_for_entity(input)?;

  for medium_of_exchange_hash in medium_of_exchange_hashes {
    unlink_from_medium_of_exchange(MediumOfExchangeLinkInput {
      medium_of_exchange_hash,
      action_hash: original_action_hash.clone(),
      entity: entity.clone(),
    })?;
  }

  Ok(())
}

/// Check if a medium of exchange is approved (for internal use)
#[hdk_extern]
pub fn is_medium_of_exchange_approved(medium_of_exchange_hash: ActionHash) -> ExternResult<bool> {
  // Get the approved path hash
  let approved_path_hash = get_status_path_hash(APPROVED_MEDIUMS_OF_EXCHANGE_PATH)?;

  // Check if there's a link from approved path to this medium of exchange
  let link_type_filter = LinkTypes::AllMediumsOfExchange
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(approved_path_hash, link_type_filter),
    GetStrategy::Network,
  )?;

  let found_approved = links
    .into_iter()
    .any(|link| link.target.into_action_hash() == Some(medium_of_exchange_hash.clone()));

  Ok(found_approved)
}
