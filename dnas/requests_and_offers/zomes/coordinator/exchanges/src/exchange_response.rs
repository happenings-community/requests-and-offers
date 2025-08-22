use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, get_agent_user,
  get_request_or_offer_record,
};
use exchanges_integrity::{
  CreateExchangeResponseInput, EntryTypes, ExchangeResponse, LinkTypes, ExchangeResponseStatus,
  UpdateExchangeResponseStatusInput,
};
use hdk::prelude::*;
use utils::errors::{AdministrationError, CommonError};

// Path anchor constants - simplified
const ALL_RESPONSES_PATH: &str = "exchanges.responses.all";

/// Helper function to get path entry hash
fn get_path_hash(path: &str) -> ExternResult<EntryHash> {
  Path::from(path).path_entry_hash()
}

/// Create a new exchange response
#[hdk_extern]
pub fn create_exchange_response(input: CreateExchangeResponseInput) -> ExternResult<Record> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is authorized (accepted user or administrator)
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_admin {
    // Check if agent is an accepted user
    let user_links = get_agent_user(agent_pubkey.clone())?;
    if let Some(user_link) = user_links.first() {
      let user_hash = user_link
        .target
        .clone()
        .into_action_hash()
        .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
      let is_accepted = check_if_entity_is_accepted("users".to_string(), user_hash)?;
      if !is_accepted {
        return Err(AdministrationError::Unauthorized.into());
      }
    } else {
      return Err(AdministrationError::Unauthorized.into());
    }
  }

  // Validate target entity exists
  let _target_record = get_request_or_offer_record(input.target_entity_hash.clone())?.ok_or(
    CommonError::EntryNotFound("Target request or offer not found".to_string()),
  )?;

  // Check for existing pending responses from the same agent
  let existing_responses = get_responses_for_entity(input.target_entity_hash.clone())?;
  for existing_record in existing_responses {
    // Check if this response was created by the current agent
    let response_hash = existing_record.action_address().clone();
    let responder_links = get_links(
      GetLinksInputBuilder::try_new(response_hash, LinkTypes::ResponseToResponder)?.build(),
    )?;
    
    for link in responder_links {
      if let Some(responder) = link.target.into_agent_pub_key() {
        if responder == agent_pubkey {
          // Found an existing response from this agent, check its status
          if let Some(existing_entry) = existing_record
            .entry()
            .to_app_option::<ExchangeResponse>()
            .map_err(|err| CommonError::Serialize(err))?
          {
            if existing_entry.status == ExchangeResponseStatus::Pending {
              return Err(CommonError::InvalidData(
                "You already have a pending response to this request/offer. Please wait for the creator to review it before creating a new response.".to_string()
              ).into());
            }
          }
        }
      }
    }
  }

  // Get current timestamp from host
  let now = sys_time()?;

  // Create the response entry - simplified single type
  let response = ExchangeResponse::new(
    input.service_details.clone(),
    input.terms.clone(),
    input.exchange_medium.clone(),
    input.exchange_value.clone(),
    input.delivery_timeframe.clone(),
    input.notes.clone(),
    now,
  );

  let response_hash = create_entry(EntryTypes::ExchangeResponse(response.clone()))?;

  // Get the created record
  let record = get(response_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find newly created response".to_string()),
  )?;

  // Create simplified links
  create_response_links(&response_hash, &input, &agent_pubkey)?;

  Ok(record)
}

fn create_response_links(
  response_hash: &ActionHash,
  input: &CreateExchangeResponseInput,
  agent_pubkey: &AgentPubKey,
) -> ExternResult<()> {
  // Link from target entity to response
  create_link(
    input.target_entity_hash.clone(),
    response_hash.clone(),
    LinkTypes::RequestToResponse, // Will work for both requests and offers
    (),
  )?;

  // Link from response to responder (agent who created the response)
  create_link(
    response_hash.clone(),
    agent_pubkey.clone(),
    LinkTypes::ResponseToResponder,
    (),
  )?;

  // Link from response to original poster (target entity author)
  let target_record = get_request_or_offer_record(input.target_entity_hash.clone())?.ok_or(
    CommonError::EntryNotFound("Target entity not found".to_string()),
  )?;
  let original_poster = target_record.action().author().clone();

  create_link(
    response_hash.clone(),
    original_poster,
    LinkTypes::ResponseToOriginalPoster,
    (),
  )?;

  // Simple all responses index
  let all_responses_path_hash = get_path_hash(ALL_RESPONSES_PATH)?;
  create_link(
    all_responses_path_hash,
    response_hash.clone(),
    LinkTypes::AllResponses,
    (),
  )?;

  Ok(())
}

// Removed complex status indexing - simplified approach

/// Get a response by hash
#[hdk_extern]
pub fn get_exchange_response(response_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(response_hash, GetOptions::default())
}

/// Update response status (accept/reject)
#[hdk_extern]
pub fn update_response_status(input: UpdateExchangeResponseStatusInput) -> ExternResult<ActionHash> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Get the current response
  let current_record = get(input.response_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("Response not found".to_string()))?;

  let mut response: ExchangeResponse = current_record
    .entry()
    .to_app_option()
    .map_err(|err| CommonError::Serialize(err))?
    .ok_or(CommonError::EntryNotFound(
      "Invalid response entry".to_string(),
    ))?;

  // Check permissions - only original poster can accept/reject
  let response_links = get_links(
    GetLinksInputBuilder::try_new(
      input.response_hash.clone(),
      LinkTypes::ResponseToOriginalPoster,
    )?
    .build(),
  )?;

  let original_poster = response_links
    .first()
    .and_then(|link| link.target.clone().into_agent_pub_key())
    .ok_or(CommonError::InvalidData(
      "Original poster not found".to_string(),
    ))?;

  if agent_pubkey != original_poster {
    // Also allow administrators to update status
    let is_admin = check_if_agent_is_administrator(agent_pubkey)?;
    if !is_admin {
      return Err(AdministrationError::Unauthorized.into());
    }
  }

  // Get current timestamp
  let now = sys_time()?;

  // Update the response status
  response.update_status(input.new_status.clone(), now);

  // Create updated entry
  let updated_hash = update_entry(
    input.response_hash.clone(),
    EntryTypes::ExchangeResponse(response.clone()),
  )?;

  // Simplified - no status indexing needed

  Ok(updated_hash)
}

/// Get all responses for a request or offer
#[hdk_extern]
pub fn get_responses_for_entity(entity_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links =
    get_links(GetLinksInputBuilder::try_new(entity_hash, LinkTypes::RequestToResponse)?.build())?;

  let mut responses = Vec::new();
  for link in links {
    if let Some(response_hash) = link.target.into_action_hash() {
      if let Some(record) = get(response_hash, GetOptions::default())? {
        responses.push(record);
      }
    }
  }

  Ok(responses)
}

/// Get responses by status - simplified to filter all responses
#[hdk_extern]
pub fn get_responses_by_status(status: ExchangeResponseStatus) -> ExternResult<Vec<Record>> {
  let all_responses = get_all_responses(())?;

  let mut filtered_responses = Vec::new();
  for record in all_responses {
    if let Some(entry) = record
      .entry()
      .to_app_option::<ExchangeResponse>()
      .map_err(|err| CommonError::Serialize(err))?
    {
      if entry.status == status {
        filtered_responses.push(record);
      }
    }
  }

  Ok(filtered_responses)
}

/// Get all responses
#[hdk_extern]
pub fn get_all_responses() -> ExternResult<Vec<Record>> {
  let path_hash = get_path_hash(ALL_RESPONSES_PATH)?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllResponses)?.build())?;

  let mut responses = Vec::new();
  for link in links {
    if let Some(response_hash) = link.target.into_action_hash() {
      if let Some(record) = get(response_hash, GetOptions::default())? {
        responses.push(record);
      }
    }
  }

  Ok(responses)
}

/// Get responses created by a specific agent
#[hdk_extern]
pub fn get_responses_by_agent(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Record>> {
  // First get all responses
  let all_responses = get_all_responses(())?;
  
  let mut agent_responses = Vec::new();
  
  // Filter responses by checking ResponseToResponder links
  for record in all_responses {
    let response_hash = record.action_address().clone();
    
    // Check if this response was created by the specified agent
    let responder_links = get_links(
      GetLinksInputBuilder::try_new(response_hash, LinkTypes::ResponseToResponder)?.build(),
    )?;
    
    for link in responder_links {
      if let Some(responder) = link.target.into_agent_pub_key() {
        if responder == agent_pubkey {
          agent_responses.push(record.clone());
          break;
        }
      }
    }
  }
  
  Ok(agent_responses)
}

/// Get responses created by the current agent
#[hdk_extern]
pub fn get_my_responses() -> ExternResult<Vec<Record>> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;
  get_responses_by_agent(agent_pubkey)
}

/// Get responses received by the current agent (where they are the original poster)
#[hdk_extern]
pub fn get_responses_received_by_me() -> ExternResult<Vec<Record>> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;
  
  // First get all responses
  let all_responses = get_all_responses(())?;
  
  let mut received_responses = Vec::new();
  
  // Filter responses by checking ResponseToOriginalPoster links
  for record in all_responses {
    let response_hash = record.action_address().clone();
    
    // Check if the current agent is the original poster for this response
    let original_poster_links = get_links(
      GetLinksInputBuilder::try_new(response_hash, LinkTypes::ResponseToOriginalPoster)?.build(),
    )?;
    
    for link in original_poster_links {
      if let Some(original_poster) = link.target.into_agent_pub_key() {
        if original_poster == agent_pubkey {
          received_responses.push(record.clone());
          break;
        }
      }
    }
  }
  
  Ok(received_responses)
}

/// Delete a response (soft delete by marking as rejected)
#[hdk_extern]
pub fn delete_exchange_response(response_hash: ActionHash) -> ExternResult<ActionHash> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check permissions - only response creator or admin can delete
  let responder_links = get_links(
    GetLinksInputBuilder::try_new(response_hash.clone(), LinkTypes::ResponseToResponder)?.build(),
  )?;

  let response_creator = responder_links
    .first()
    .and_then(|link| link.target.clone().into_agent_pub_key())
    .ok_or(CommonError::InvalidData(
      "Response creator not found".to_string(),
    ))?;

  if agent_pubkey != response_creator {
    let is_admin = check_if_agent_is_administrator(agent_pubkey)?;
    if !is_admin {
      return Err(AdministrationError::Unauthorized.into());
    }
  }

  // Update status to rejected instead of hard delete
  let input = UpdateExchangeResponseStatusInput {
    response_hash,
    new_status: ExchangeResponseStatus::Rejected,
    reason: Some("Deleted by creator".to_string()),
  };

  update_response_status(input)
}

/// Get the target entity hash for a given response
#[hdk_extern]
pub fn get_target_entity_for_response(response_hash: ActionHash) -> ExternResult<Option<ActionHash>> {
  use utils::external_local_call;
  
  // Get all entities from their respective zomes
  let all_requests: Vec<Record> = match external_local_call("get_all_requests", "requests", ()) {
    Ok(requests) => requests,
    Err(_) => Vec::new(),
  };
  
  let all_offers: Vec<Record> = match external_local_call("get_all_offers", "offers", ()) {
    Ok(offers) => offers,
    Err(_) => Vec::new(),
  };
  
  // Check requests first
  for request_record in all_requests {
    let request_hash = request_record.action_address();
    let links = match get_links(
      GetLinksInputBuilder::try_new(request_hash.clone(), LinkTypes::RequestToResponse)?.build(),
    ) {
      Ok(links) => links,
      Err(_) => continue,
    };
    
    for link in links {
      if let Some(linked_response_hash) = link.target.into_action_hash() {
        if linked_response_hash == response_hash {
          return Ok(Some(request_hash.clone()));
        }
      }
    }
  }
  
  // Check offers if not found in requests
  for offer_record in all_offers {
    let offer_hash = offer_record.action_address();
    let links = match get_links(
      GetLinksInputBuilder::try_new(offer_hash.clone(), LinkTypes::RequestToResponse)?.build(),
    ) {
      Ok(links) => links,
      Err(_) => continue,
    };
    
    for link in links {
      if let Some(linked_response_hash) = link.target.into_action_hash() {
        if linked_response_hash == response_hash {
          return Ok(Some(offer_hash.clone()));
        }
      }
    }
  }
  
  Ok(None)
}
