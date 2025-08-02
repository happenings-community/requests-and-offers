use hdk::prelude::*;
use exchanges_integrity::{
    EntryTypes, LinkTypes, ExchangeCancellation, CancellationReason, CancellationInitiator,
    CreateMutualCancellationInput, CreateUnilateralCancellationInput, 
    RespondToCancellationInput, AdminReviewCancellationInput
};
use utils::errors::{CommonError, AdministrationError};
use crate::external_calls::{check_if_agent_is_administrator, get_agent_user, check_if_entity_is_accepted};

const ALL_CANCELLATIONS_PATH: &str = "exchanges.cancellations.all";

fn get_path_hash(path: &str) -> ExternResult<EntryHash> {
    Path::from(path).path_entry_hash()
}

/// Create a mutual cancellation
#[hdk_extern]
pub fn create_mutual_cancellation(input: CreateMutualCancellationInput) -> ExternResult<Record> {
    let agent_pubkey = agent_info()?.agent_initial_pubkey;
    
    // Check authorization
    let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;
    if !is_admin {
        let user_links = get_agent_user(agent_pubkey.clone())?;
        if let Some(user_link) = user_links.first() {
            let user_hash = user_link.target.clone().into_action_hash()
                .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
            let is_accepted = check_if_entity_is_accepted("users".to_string(), user_hash)?;
            if !is_accepted {
                return Err(AdministrationError::Unauthorized.into());
            }
        } else {
            return Err(AdministrationError::Unauthorized.into());
        }
    }
    
    // Create the cancellation entry
    let cancellation = ExchangeCancellation::new_mutual(
        input.reason,
        input.explanation,
        input.resolution_terms,
    );
    
    let cancellation_hash = create_entry(EntryTypes::ExchangeCancellation(cancellation))?;
    
    let record = get(cancellation_hash.clone(), GetOptions::default())?
        .ok_or(CommonError::EntryNotFound("Could not find newly created cancellation".to_string()))?;
    
    // Create links
    create_link(
        input.agreement_hash,
        cancellation_hash.clone(),
        LinkTypes::AgreementToCancellation,
        (),
    )?;
    
    create_link(
        cancellation_hash.clone(),
        agent_pubkey,
        LinkTypes::CancellationToInitiator,
        (),
    )?;
    
    let all_cancellations_path_hash = get_path_hash(ALL_CANCELLATIONS_PATH)?;
    create_link(
        all_cancellations_path_hash,
        cancellation_hash,
        LinkTypes::AllCancellations,
        (),
    )?;
    
    Ok(record)
}

/// Create a unilateral cancellation request
#[hdk_extern]
pub fn create_unilateral_cancellation(input: CreateUnilateralCancellationInput) -> ExternResult<Record> {
    let agent_pubkey = agent_info()?.agent_initial_pubkey;
    
    // Check authorization
    let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;
    if !is_admin {
        let user_links = get_agent_user(agent_pubkey.clone())?;
        if let Some(user_link) = user_links.first() {
            let user_hash = user_link.target.clone().into_action_hash()
                .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
            let is_accepted = check_if_entity_is_accepted("users".to_string(), user_hash)?;
            if !is_accepted {
                return Err(AdministrationError::Unauthorized.into());
            }
        } else {
            return Err(AdministrationError::Unauthorized.into());
        }
    }
    
    // Create the cancellation entry
    let cancellation = ExchangeCancellation::new_unilateral(
        input.reason,
        input.initiated_by,
        input.explanation,
    );
    
    let cancellation_hash = create_entry(EntryTypes::ExchangeCancellation(cancellation))?;
    
    let record = get(cancellation_hash.clone(), GetOptions::default())?
        .ok_or(CommonError::EntryNotFound("Could not find newly created cancellation".to_string()))?;
    
    // Create links
    create_link(
        input.agreement_hash,
        cancellation_hash.clone(),
        LinkTypes::AgreementToCancellation,
        (),
    )?;
    
    create_link(
        cancellation_hash.clone(),
        agent_pubkey,
        LinkTypes::CancellationToInitiator,
        (),
    )?;
    
    let all_cancellations_path_hash = get_path_hash(ALL_CANCELLATIONS_PATH)?;
    create_link(
        all_cancellations_path_hash,
        cancellation_hash,
        LinkTypes::AllCancellations,
        (),
    )?;
    
    Ok(record)
}

/// Respond to a cancellation request
#[hdk_extern]
pub fn respond_to_cancellation(input: RespondToCancellationInput) -> ExternResult<ActionHash> {
    let _agent_pubkey = agent_info()?.agent_initial_pubkey;
    
    // Get the current cancellation
    let current_record = get(input.cancellation_hash.clone(), GetOptions::default())?
        .ok_or(CommonError::EntryNotFound("Cancellation not found".to_string()))?;
    
    let mut cancellation: ExchangeCancellation = current_record.entry().to_app_option()
        .map_err(|err| CommonError::Serialize(err))?
        .ok_or(CommonError::EntryNotFound("Invalid cancellation entry".to_string()))?;
    
    // TODO: Check if agent is authorized to respond (other party in the agreement)
    
    // Record the response
    cancellation.record_other_party_response(input.consent, input.notes);
    
    // Create updated entry
    let updated_hash = update_entry(input.cancellation_hash, EntryTypes::ExchangeCancellation(cancellation))?;
    
    Ok(updated_hash)
}

/// Admin review of cancellation
#[hdk_extern]
pub fn admin_review_cancellation(input: AdminReviewCancellationInput) -> ExternResult<ActionHash> {
    let agent_pubkey = agent_info()?.agent_initial_pubkey;
    
    // Check if agent is administrator
    let is_admin = check_if_agent_is_administrator(agent_pubkey)?;
    if !is_admin {
        return Err(AdministrationError::Unauthorized.into());
    }
    
    // Get the current cancellation
    let current_record = get(input.cancellation_hash.clone(), GetOptions::default())?
        .ok_or(CommonError::EntryNotFound("Cancellation not found".to_string()))?;
    
    let mut cancellation: ExchangeCancellation = current_record.entry().to_app_option()
        .map_err(|err| CommonError::Serialize(err))?
        .ok_or(CommonError::EntryNotFound("Invalid cancellation entry".to_string()))?;
    
    // Record admin review
    cancellation.record_admin_review(input.admin_notes, input.resolution_terms);
    
    // Create updated entry
    let updated_hash = update_entry(input.cancellation_hash, EntryTypes::ExchangeCancellation(cancellation))?;
    
    Ok(updated_hash)
}

/// Get cancellations for an agreement
#[hdk_extern]
pub fn get_cancellations_for_agreement(agreement_hash: ActionHash) -> ExternResult<Vec<Record>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(agreement_hash, LinkTypes::AgreementToCancellation)?
            .build()
    )?;
    
    let mut cancellations = Vec::new();
    for link in links {
        if let Some(cancellation_hash) = link.target.into_action_hash() {
            if let Some(record) = get(cancellation_hash, GetOptions::default())? {
                cancellations.push(record);
            }
        }
    }
    
    Ok(cancellations)
}

/// Get all cancellations
#[hdk_extern]
pub fn get_all_exchange_cancellations() -> ExternResult<Vec<Record>> {
    let path_hash = get_path_hash(ALL_CANCELLATIONS_PATH)?;
    let links = get_links(
        GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllCancellations)?
            .build()
    )?;
    
    let mut cancellations = Vec::new();
    for link in links {
        if let Some(cancellation_hash) = link.target.into_action_hash() {
            if let Some(record) = get(cancellation_hash, GetOptions::default())? {
                cancellations.push(record);
            }
        }
    }
    
    Ok(cancellations)
}