use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, get_agent_user,
};
use exchanges_integrity::{
  Agreement, AgreementStatus, CreateAgreementInput, EntryTypes, LinkTypes,
  UpdateAgreementStatusInput, MarkCompleteInput, ValidatorRole,
};
use hdk::prelude::*;
use utils::errors::{AdministrationError, CommonError};

// Path anchor constants - simplified
const ALL_AGREEMENTS_PATH: &str = "exchanges.agreements.all";

/// Helper function to get path entry hash
fn get_path_hash(path: &str) -> ExternResult<EntryHash> {
  Path::from(path).path_entry_hash()
}

/// Create a new agreement from an accepted proposal
#[hdk_extern]
pub fn create_agreement(input: CreateAgreementInput) -> ExternResult<Record> {
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

  // Verify the proposal exists and is accepted
  let _proposal_record = get(input.proposal_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("Proposal not found".to_string()))?;

  // TODO: Verify proposal status is Accepted

  // Create the agreement entry - simplified
  let agreement = Agreement::from_proposal(
    input.service_details,
    input.exchange_medium,
    input.exchange_value,
    input.delivery_timeframe,
  );

  let agreement_hash = create_entry(EntryTypes::Agreement(agreement.clone()))?;

  // Get the created record
  let record = get(agreement_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find newly created agreement".to_string()),
  )?;

  // Create links
  create_agreement_links(&agreement_hash, &input.proposal_hash, &agent_pubkey)?;

  // Simplified - no status indexing needed

  Ok(record)
}

/// Create all necessary links for an agreement
fn create_agreement_links(
  agreement_hash: &ActionHash,
  proposal_hash: &ActionHash,
  _agent_pubkey: &AgentPubKey,
) -> ExternResult<()> {
  // Link from proposal to agreement
  create_link(
    proposal_hash.clone(),
    agreement_hash.clone(),
    LinkTypes::ProposalToAgreement,
    (),
  )?;

  // Get proposal participants to create provider/receiver links
  let proposal_links = get_links(
    GetLinksInputBuilder::try_new(proposal_hash.clone(), LinkTypes::ProposalToResponder)?
      .build(),
  )?;

  let responder = proposal_links
    .first()
    .and_then(|link| link.target.clone().into_agent_pub_key())
    .ok_or(CommonError::InvalidData(
      "Proposal responder not found".to_string(),
    ))?;

  let original_poster_links = get_links(
    GetLinksInputBuilder::try_new(
      proposal_hash.clone(),
      LinkTypes::ProposalToOriginalPoster,
    )?
    .build(),
  )?;

  let original_poster = original_poster_links
    .first()
    .and_then(|link| link.target.clone().into_agent_pub_key())
    .ok_or(CommonError::InvalidData(
      "Original poster not found".to_string(),
    ))?;

  // Link agreement to provider (responder) and receiver (original poster)
  create_link(
    agreement_hash.clone(),
    responder,
    LinkTypes::AgreementToProvider,
    (),
  )?;

  create_link(
    agreement_hash.clone(),
    original_poster,
    LinkTypes::AgreementToReceiver,
    (),
  )?;

  // Link from all agreements path
  let all_agreements_path_hash = get_path_hash(ALL_AGREEMENTS_PATH)?;
  create_link(
    all_agreements_path_hash,
    agreement_hash.clone(),
    LinkTypes::AllAgreements,
    (),
  )?;

  Ok(())
}

// Removed complex status indexing - simplified approach

/// Get an agreement by hash
#[hdk_extern]
pub fn get_agreement(agreement_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(agreement_hash, GetOptions::default())
}

/// Update agreement status
#[hdk_extern]
pub fn update_agreement_status(input: UpdateAgreementStatusInput) -> ExternResult<ActionHash> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Get the current agreement
  let current_record = get(input.agreement_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Agreement not found".to_string()),
  )?;

  let mut agreement: Agreement =
    current_record
      .entry()
      .to_app_option()
      .map_err(|err| CommonError::Serialize(err))?
      .ok_or(CommonError::EntryNotFound(
        "Invalid agreement entry".to_string(),
      ))?;

  // Check permissions - participants or admin can update status
  let is_participant = check_if_agreement_participant(&input.agreement_hash, &agent_pubkey)?;
  if !is_participant {
    let is_admin = check_if_agent_is_administrator(agent_pubkey)?;
    if !is_admin {
      return Err(AdministrationError::Unauthorized.into());
    }
  }

  // Update the agreement status
  agreement.update_status(input.new_status.clone());

  // Create updated entry
  let updated_hash = update_entry(
    input.agreement_hash.clone(),
    EntryTypes::Agreement(agreement.clone()),
  )?;

  // Simplified - no status indexing needed

  Ok(updated_hash)
}

/// Mark completion by provider or receiver
#[hdk_extern]
pub fn mark_completion(input: MarkCompleteInput) -> ExternResult<ActionHash> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Get the current agreement
  let current_record = get(input.agreement_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Agreement not found".to_string()),
  )?;

  let mut agreement: Agreement =
    current_record
      .entry()
      .to_app_option()
      .map_err(|err| CommonError::Serialize(err))?
      .ok_or(CommonError::EntryNotFound(
        "Invalid agreement entry".to_string(),
      ))?;

  // Check if agent is the correct participant
  match input.validator_role {
    ValidatorRole::Provider => {
      if !check_if_agreement_provider(&input.agreement_hash, &agent_pubkey)? {
        return Err(AdministrationError::Unauthorized.into());
      }
      agreement.mark_provider_complete();
    }
    ValidatorRole::Receiver => {
      if !check_if_agreement_receiver(&input.agreement_hash, &agent_pubkey)? {
        return Err(AdministrationError::Unauthorized.into());
      }
      agreement.mark_receiver_complete();
    }
  }

  // Create updated entry
  let updated_hash = update_entry(
    input.agreement_hash.clone(),
    EntryTypes::Agreement(agreement.clone()),
  )?;

  // Simplified - no status indexing needed

  Ok(updated_hash)
}

/// Check if agent is a participant in the agreement
fn check_if_agreement_participant(
  agreement_hash: &ActionHash,
  agent_pubkey: &AgentPubKey,
) -> ExternResult<bool> {
  // Check if agent is provider
  let provider_links = get_links(
    GetLinksInputBuilder::try_new(agreement_hash.clone(), LinkTypes::AgreementToProvider)?.build(),
  )?;

  for link in provider_links {
    if let Some(provider_pubkey) = link.target.into_agent_pub_key() {
      if provider_pubkey == *agent_pubkey {
        return Ok(true);
      }
    }
  }

  // Check if agent is receiver
  let receiver_links = get_links(
    GetLinksInputBuilder::try_new(agreement_hash.clone(), LinkTypes::AgreementToReceiver)?.build(),
  )?;

  for link in receiver_links {
    if let Some(receiver_pubkey) = link.target.into_agent_pub_key() {
      if receiver_pubkey == *agent_pubkey {
        return Ok(true);
      }
    }
  }

  Ok(false)
}

/// Check if agent is the provider in the agreement
fn check_if_agreement_provider(
  agreement_hash: &ActionHash,
  agent_pubkey: &AgentPubKey,
) -> ExternResult<bool> {
  let provider_links = get_links(
    GetLinksInputBuilder::try_new(agreement_hash.clone(), LinkTypes::AgreementToProvider)?.build(),
  )?;

  for link in provider_links {
    if let Some(provider_pubkey) = link.target.into_agent_pub_key() {
      if provider_pubkey == *agent_pubkey {
        return Ok(true);
      }
    }
  }

  Ok(false)
}

/// Check if agent is the receiver in the agreement
fn check_if_agreement_receiver(
  agreement_hash: &ActionHash,
  agent_pubkey: &AgentPubKey,
) -> ExternResult<bool> {
  let receiver_links = get_links(
    GetLinksInputBuilder::try_new(agreement_hash.clone(), LinkTypes::AgreementToReceiver)?.build(),
  )?;

  for link in receiver_links {
    if let Some(receiver_pubkey) = link.target.into_agent_pub_key() {
      if receiver_pubkey == *agent_pubkey {
        return Ok(true);
      }
    }
  }

  Ok(false)
}

/// Get agreements by status
#[hdk_extern]
pub fn get_agreements_by_status(status: AgreementStatus) -> ExternResult<Vec<Record>> {
  let all_agreements = get_all_agreements(())?;
  
  let mut filtered_agreements = Vec::new();
  for record in all_agreements {
    if let Some(entry) = record.entry().to_app_option::<Agreement>().map_err(|err| CommonError::Serialize(err))? {
      if entry.status == status {
        filtered_agreements.push(record);
      }
    }
  }
  
  Ok(filtered_agreements)
}

/// Get all agreements
#[hdk_extern]
pub fn get_all_agreements() -> ExternResult<Vec<Record>> {
  let path_hash = get_path_hash(ALL_AGREEMENTS_PATH)?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllAgreements)?.build())?;

  let mut agreements = Vec::new();
  for link in links {
    if let Some(agreement_hash) = link.target.into_action_hash() {
      if let Some(record) = get(agreement_hash, GetOptions::default())? {
        agreements.push(record);
      }
    }
  }

  Ok(agreements)
}

/// Get agreements for an agent (as provider or receiver)
#[hdk_extern]
pub fn get_agreements_for_agent(agent_pubkey: AgentPubKey) -> ExternResult<Vec<Record>> {
  let mut agreements = Vec::new();

  // Get all agreements
  let all_agreements = get_all_agreements(())?;

  // Filter for agreements where agent is participant
  for agreement_record in all_agreements {
    let agreement_hash = agreement_record.action_address().clone();
    if check_if_agreement_participant(&agreement_hash, &agent_pubkey)? {
      agreements.push(agreement_record);
    }
  }

  Ok(agreements)
}
