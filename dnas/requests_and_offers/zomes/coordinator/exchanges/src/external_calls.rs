use hdk::prelude::*;
use utils::{external_local_call, EntityActionHash, EntityAgent};

/// Check if an agent is an administrator
pub fn check_if_agent_is_administrator(agent_pubkey: AgentPubKey) -> ExternResult<bool> {
    let input = EntityAgent {
        entity: "network".to_string(),
        agent_pubkey,
    };

    external_local_call("check_if_agent_is_administrator", "administration", input)
}

/// Get the user record for an agent
pub fn get_agent_user(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Link>> {
    external_local_call("get_agent_user", "users_organizations", agent_pubkey)
}

/// Check if an entity is accepted
pub fn check_if_entity_is_accepted(
    entity_type: String,
    entity_hash: ActionHash,
) -> ExternResult<bool> {
    let input = EntityActionHash {
        entity: entity_type,
        entity_original_action_hash: entity_hash,
    };

    external_local_call("check_if_entity_is_accepted", "administration", input)
}

/// Get request or offer record to validate existence and permissions
pub fn get_request_or_offer_record(entity_hash: ActionHash) -> ExternResult<Option<Record>> {
    // Try to get from requests first
    let requests_result: Result<Option<Record>, _> = external_local_call("get_request", "requests", entity_hash.clone());
    
    if let Ok(Some(record)) = requests_result {
        return Ok(Some(record));
    }
    
    // If not found in requests, try offers
    let offers_result: Result<Option<Record>, _> = external_local_call("get_offer", "offers", entity_hash);
    
    match offers_result {
        Ok(record) => Ok(record),
        Err(_) => Ok(None), // If both fail, return None
    }
}

/// Check if agent has permission to access/modify a request or offer
pub fn check_entity_permissions(
    entity_hash: ActionHash,
    agent_pubkey: AgentPubKey,
) -> ExternResult<bool> {
    let record = get_request_or_offer_record(entity_hash)?;
    
    match record {
        Some(record) => {
            // Check if the agent is the author or an administrator
            let is_author = record.action().author() == &agent_pubkey;
            let is_admin = check_if_agent_is_administrator(agent_pubkey)?;
            
            Ok(is_author || is_admin)
        }
        None => Ok(false), // Entity doesn't exist
    }
}