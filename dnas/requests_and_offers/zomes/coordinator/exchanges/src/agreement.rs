use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, get_agent_user,
};
use exchanges_integrity::{
  Agreement, AgreementStatus, CreateAgreementInput, EntryTypes, LinkTypes,
  UpdateAgreementStatusInput, ValidateCompletionInput, ValidatorRole,
};
use hdk::prelude::*;
use utils::errors::{AdministrationError, CommonError};

// Path anchor constants
const ALL_AGREEMENTS_PATH: &str = "exchanges.agreements.all";
const ACTIVE_AGREEMENTS_PATH: &str = "exchanges.agreements.active";
const IN_PROGRESS_AGREEMENTS_PATH: &str = "exchanges.agreements.in_progress";
const COMPLETED_AGREEMENTS_PATH: &str = "exchanges.agreements.completed";
const CANCELLED_AGREEMENTS_PATH: &str = "exchanges.agreements.cancelled";
const DISPUTED_AGREEMENTS_PATH: &str = "exchanges.agreements.disputed";

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

  // Create the agreement entry
  let agreement = Agreement::from_proposal(
    input.service_details,
    input.agreed_terms,
    input.exchange_medium,
    input.exchange_value,
    input.delivery_timeframe,
    input.additional_conditions,
    input.start_date,
    input.completion_date,
  );

  let agreement_hash = create_entry(EntryTypes::Agreement(agreement.clone()))?;

  // Get the created record
  let record = get(agreement_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find newly created agreement".to_string()),
  )?;

  // Create links
  create_agreement_links(&agreement_hash, &input.proposal_hash, &agent_pubkey)?;

  // Index in status paths
  index_agreement_by_status(&agreement_hash, &agreement.status)?;

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

/// Index agreement by status
fn index_agreement_by_status(
  agreement_hash: &ActionHash,
  status: &AgreementStatus,
) -> ExternResult<()> {
  let status_path = match status {
    AgreementStatus::Active => ACTIVE_AGREEMENTS_PATH,
    AgreementStatus::InProgress => IN_PROGRESS_AGREEMENTS_PATH,
    AgreementStatus::Completed => COMPLETED_AGREEMENTS_PATH,
    AgreementStatus::CancelledMutual
    | AgreementStatus::CancelledProvider
    | AgreementStatus::CancelledReceiver
    | AgreementStatus::Failed => CANCELLED_AGREEMENTS_PATH,
    AgreementStatus::Disputed => DISPUTED_AGREEMENTS_PATH,
  };

  let status_path_hash = get_path_hash(status_path)?;
  create_link(
    status_path_hash,
    agreement_hash.clone(),
    LinkTypes::AgreementsByStatus,
    (),
  )?;

  Ok(())
}

/// Remove agreement from all status paths
fn remove_agreement_from_status_paths(agreement_hash: &ActionHash) -> ExternResult<()> {
  let status_paths = [
    ACTIVE_AGREEMENTS_PATH,
    IN_PROGRESS_AGREEMENTS_PATH,
    COMPLETED_AGREEMENTS_PATH,
    CANCELLED_AGREEMENTS_PATH,
    DISPUTED_AGREEMENTS_PATH,
  ];

  for path in &status_paths {
    let path_hash = get_path_hash(path)?;
    let links =
      get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AgreementsByStatus)?.build())?;

    for link in links {
      if let Some(target_hash) = link.target.into_action_hash() {
        if target_hash == *agreement_hash {
          delete_link(link.create_link_hash)?;
        }
      }
    }
  }

  Ok(())
}

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

  // Update status indexing
  remove_agreement_from_status_paths(&input.agreement_hash)?;
  index_agreement_by_status(&input.agreement_hash, &agreement.status)?;

  Ok(updated_hash)
}

/// Validate completion by provider or receiver
#[hdk_extern]
pub fn validate_completion(input: ValidateCompletionInput) -> ExternResult<ActionHash> {
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
      agreement.validate_by_provider();
    }
    ValidatorRole::Receiver => {
      if !check_if_agreement_receiver(&input.agreement_hash, &agent_pubkey)? {
        return Err(AdministrationError::Unauthorized.into());
      }
      agreement.validate_by_receiver();
    }
  }

  // Create updated entry
  let updated_hash = update_entry(
    input.agreement_hash.clone(),
    EntryTypes::Agreement(agreement.clone()),
  )?;

  // Update status indexing if both parties validated
  if agreement.is_mutually_validated() {
    remove_agreement_from_status_paths(&input.agreement_hash)?;
    index_agreement_by_status(&input.agreement_hash, &agreement.status)?;
  }

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
  let status_path = match status {
    AgreementStatus::Active => ACTIVE_AGREEMENTS_PATH,
    AgreementStatus::InProgress => IN_PROGRESS_AGREEMENTS_PATH,
    AgreementStatus::Completed => COMPLETED_AGREEMENTS_PATH,
    AgreementStatus::CancelledMutual
    | AgreementStatus::CancelledProvider
    | AgreementStatus::CancelledReceiver
    | AgreementStatus::Failed => CANCELLED_AGREEMENTS_PATH,
    AgreementStatus::Disputed => DISPUTED_AGREEMENTS_PATH,
  };

  let path_hash = get_path_hash(status_path)?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AgreementsByStatus)?.build())?;

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
