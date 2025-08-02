use hdk::prelude::*;
use exchanges_integrity::{
    EntryTypes, LinkTypes, ExchangeEvent, ExchangeEventType, EventPriority,
    CreateExchangeEventInput
};
use utils::errors::{CommonError, AdministrationError};
use crate::external_calls::{check_if_agent_is_administrator, get_agent_user, check_if_entity_is_accepted};

const ALL_EVENTS_PATH: &str = "exchanges.events.all";

fn get_path_hash(path: &str) -> ExternResult<EntryHash> {
    Path::from(path).path_entry_hash()
}

/// Create a new exchange event
#[hdk_extern]
pub fn create_exchange_event(input: CreateExchangeEventInput) -> ExternResult<Record> {
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
    
    // Create the event entry
    let event = ExchangeEvent::new(
        input.event_type,
        input.priority,
        input.title,
        input.description,
        input.progress_percentage,
        input.attachments,
        input.occurred_at,
        input.is_public,
        input.metadata,
    );
    
    let event_hash = create_entry(EntryTypes::ExchangeEvent(event))?;
    
    let record = get(event_hash.clone(), GetOptions::default())?
        .ok_or(CommonError::EntryNotFound("Could not find newly created event".to_string()))?;
    
    // Create links
    create_link(
        input.agreement_hash,
        event_hash.clone(),
        LinkTypes::AgreementToEvent,
        (),
    )?;
    
    create_link(
        event_hash.clone(),
        agent_pubkey,
        LinkTypes::EventToParticipant,
        (),
    )?;
    
    let all_events_path_hash = get_path_hash(ALL_EVENTS_PATH)?;
    create_link(
        all_events_path_hash,
        event_hash,
        LinkTypes::AllEvents,
        (),
    )?;
    
    Ok(record)
}

/// Get events for an agreement
#[hdk_extern]
pub fn get_events_for_agreement(agreement_hash: ActionHash) -> ExternResult<Vec<Record>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(agreement_hash, LinkTypes::AgreementToEvent)?
            .build()
    )?;
    
    let mut events = Vec::new();
    for link in links {
        if let Some(event_hash) = link.target.into_action_hash() {
            if let Some(record) = get(event_hash, GetOptions::default())? {
                events.push(record);
            }
        }
    }
    
    Ok(events)
}

/// Get all events
#[hdk_extern]
pub fn get_all_exchange_events() -> ExternResult<Vec<Record>> {
    let path_hash = get_path_hash(ALL_EVENTS_PATH)?;
    let links = get_links(
        GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllEvents)?
            .build()
    )?;
    
    let mut events = Vec::new();
    for link in links {
        if let Some(event_hash) = link.target.into_action_hash() {
            if let Some(record) = get(event_hash, GetOptions::default())? {
                events.push(record);
            }
        }
    }
    
    Ok(events)
}