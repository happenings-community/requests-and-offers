use crate::external_calls::{
  check_entity_permissions, check_if_agent_is_administrator, check_if_entity_is_accepted,
  get_agent_user, get_request_or_offer_record,
};
use exchanges_integrity::{
  CreateExchangeProposalInput, EntryTypes, ExchangeProposal, LinkTypes, ProposalStatus,
  ProposalType, UpdateProposalStatusInput,
};
use hdk::prelude::*;
use utils::errors::{AdministrationError, CommonError};

// Path anchor constants
const ALL_PROPOSALS_PATH: &str = "exchanges.proposals.all";
const PENDING_PROPOSALS_PATH: &str = "exchanges.proposals.pending";
const ACCEPTED_PROPOSALS_PATH: &str = "exchanges.proposals.accepted";
const REJECTED_PROPOSALS_PATH: &str = "exchanges.proposals.rejected";

/// Helper function to get path entry hash
fn get_path_hash(path: &str) -> ExternResult<EntryHash> {
  Path::from(path).path_entry_hash()
}

/// Create a new exchange proposal
#[hdk_extern]
pub fn create_exchange_proposal(input: CreateExchangeProposalInput) -> ExternResult<Record> {
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
  let target_record = get_request_or_offer_record(input.target_entity_hash.clone())?.ok_or(
    CommonError::EntryNotFound("Target request or offer not found".to_string()),
  )?;

  // For cross-link proposals, validate responder entity exists
  if input.proposal_type == ProposalType::CrossLink {
    if let Some(responder_hash) = &input.responder_entity_hash {
      get_request_or_offer_record(responder_hash.clone())?.ok_or(CommonError::EntryNotFound(
        "Responder request or offer not found".to_string(),
      ))?;
    } else {
      return Err(
        CommonError::InvalidData("Cross-link proposals require responder entity hash".to_string())
          .into(),
      );
    }
  }

  // Get current timestamp from host
  let now = sys_time()?;

  // Create the proposal entry
  let proposal = match input.proposal_type {
    ProposalType::DirectResponse => ExchangeProposal::new_direct_response(
      input.service_details.clone(),
      input.terms.clone(),
      input.exchange_medium.clone(),
      input.exchange_value.clone(),
      input.delivery_timeframe.clone(),
      input.notes.clone(),
      input.expires_at,
      now,
    ),
    ProposalType::CrossLink => ExchangeProposal::new_cross_link(
      input.service_details.clone(),
      input.terms.clone(),
      input.exchange_medium.clone(),
      input.exchange_value.clone(),
      input.delivery_timeframe.clone(),
      input.notes.clone(),
      input.expires_at,
      now,
    ),
  };

  let proposal_hash = create_entry(EntryTypes::ExchangeProposal(proposal.clone()))?;

  // Get the created record
  let record = get(proposal_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find newly created proposal".to_string()),
  )?;

  // Create links
  create_proposal_links(&proposal_hash, &input, &agent_pubkey)?;

  // Index in status paths
  index_proposal_by_status(&proposal_hash, &proposal.status)?;

  Ok(record)
}

/// Create all necessary links for a proposal
fn create_proposal_links(
  proposal_hash: &ActionHash,
  input: &CreateExchangeProposalInput,
  agent_pubkey: &AgentPubKey,
) -> ExternResult<()> {
  // Link from target entity to proposal
  create_link(
    input.target_entity_hash.clone(),
    proposal_hash.clone(),
    LinkTypes::RequestToProposal, // Will work for both requests and offers
    (),
  )?;

  // Link from proposal to responder (agent who created the proposal)
  create_link(
    proposal_hash.clone(),
    agent_pubkey.clone(),
    LinkTypes::ProposalToResponder,
    (),
  )?;

  // Link from proposal to original poster (target entity author)
  let target_record = get_request_or_offer_record(input.target_entity_hash.clone())?.ok_or(
    CommonError::EntryNotFound("Target entity not found".to_string()),
  )?;
  let original_poster = target_record.action().author().clone();

  create_link(
    proposal_hash.clone(),
    original_poster,
    LinkTypes::ProposalToOriginalPoster,
    (),
  )?;

  // For cross-link proposals, link to responder entity
  if let Some(responder_entity_hash) = &input.responder_entity_hash {
    create_link(
      proposal_hash.clone(),
      responder_entity_hash.clone(),
      LinkTypes::OfferToProposal, // Generic link type for responder entity
      (),
    )?;
  }

  // Link from all proposals path
  let all_proposals_path_hash = get_path_hash(ALL_PROPOSALS_PATH)?;
  create_link(
    all_proposals_path_hash,
    proposal_hash.clone(),
    LinkTypes::AllProposals,
    (),
  )?;

  Ok(())
}

/// Index proposal by status
fn index_proposal_by_status(
  proposal_hash: &ActionHash,
  status: &ProposalStatus,
) -> ExternResult<()> {
  let status_path = match status {
    ProposalStatus::Pending => PENDING_PROPOSALS_PATH,
    ProposalStatus::Accepted => ACCEPTED_PROPOSALS_PATH,
    ProposalStatus::Rejected => REJECTED_PROPOSALS_PATH,
    ProposalStatus::Expired => REJECTED_PROPOSALS_PATH, // Treat expired as rejected
  };

  let status_path_hash = get_path_hash(status_path)?;
  create_link(
    status_path_hash,
    proposal_hash.clone(),
    LinkTypes::ProposalsByStatus,
    (),
  )?;

  Ok(())
}

/// Remove proposal from all status paths
fn remove_proposal_from_status_paths(proposal_hash: &ActionHash) -> ExternResult<()> {
  let status_paths = [
    PENDING_PROPOSALS_PATH,
    ACCEPTED_PROPOSALS_PATH,
    REJECTED_PROPOSALS_PATH,
  ];

  for path in &status_paths {
    let path_hash = get_path_hash(path)?;
    let links =
      get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::ProposalsByStatus)?.build())?;

    for link in links {
      if let Some(target_hash) = link.target.into_action_hash() {
        if target_hash == *proposal_hash {
          delete_link(link.create_link_hash)?;
        }
      }
    }
  }

  Ok(())
}

/// Get a proposal by hash
#[hdk_extern]
pub fn get_exchange_proposal(proposal_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(proposal_hash, GetOptions::default())
}

/// Update proposal status (accept/reject)
#[hdk_extern]
pub fn update_proposal_status(input: UpdateProposalStatusInput) -> ExternResult<ActionHash> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Get the current proposal
  let current_record = get(input.proposal_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("Proposal not found".to_string()))?;

  let mut proposal: ExchangeProposal = current_record
    .entry()
    .to_app_option()
    .map_err(|err| CommonError::Serialize(err))?
    .ok_or(CommonError::EntryNotFound(
      "Invalid proposal entry".to_string(),
    ))?;

  // Check permissions - only original poster can accept/reject
  let proposal_links = get_links(
    GetLinksInputBuilder::try_new(
      input.proposal_hash.clone(),
      LinkTypes::ProposalToOriginalPoster,
    )?
    .build(),
  )?;

  let original_poster = proposal_links
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
  
  // Update the proposal status
  proposal.update_status(input.new_status.clone(), now);

  // Create updated entry
  let updated_hash = update_entry(
    input.proposal_hash.clone(),
    EntryTypes::ExchangeProposal(proposal.clone()),
  )?;

  // Update status indexing
  remove_proposal_from_status_paths(&input.proposal_hash)?;
  index_proposal_by_status(&input.proposal_hash, &proposal.status)?;

  Ok(updated_hash)
}

/// Get all proposals for a request or offer
#[hdk_extern]
pub fn get_proposals_for_entity(entity_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links =
    get_links(GetLinksInputBuilder::try_new(entity_hash, LinkTypes::RequestToProposal)?.build())?;

  let mut proposals = Vec::new();
  for link in links {
    if let Some(proposal_hash) = link.target.into_action_hash() {
      if let Some(record) = get(proposal_hash, GetOptions::default())? {
        proposals.push(record);
      }
    }
  }

  Ok(proposals)
}

/// Get proposals by status
#[hdk_extern]
pub fn get_proposals_by_status(status: ProposalStatus) -> ExternResult<Vec<Record>> {
  let status_path = match status {
    ProposalStatus::Pending => PENDING_PROPOSALS_PATH,
    ProposalStatus::Accepted => ACCEPTED_PROPOSALS_PATH,
    ProposalStatus::Rejected => REJECTED_PROPOSALS_PATH,
    ProposalStatus::Expired => REJECTED_PROPOSALS_PATH,
  };

  let path_hash = get_path_hash(status_path)?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::ProposalsByStatus)?.build())?;

  let mut proposals = Vec::new();
  for link in links {
    if let Some(proposal_hash) = link.target.into_action_hash() {
      if let Some(record) = get(proposal_hash, GetOptions::default())? {
        proposals.push(record);
      }
    }
  }

  Ok(proposals)
}

/// Get all proposals
#[hdk_extern]
pub fn get_all_proposals() -> ExternResult<Vec<Record>> {
  let path_hash = get_path_hash(ALL_PROPOSALS_PATH)?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash, LinkTypes::AllProposals)?.build())?;

  let mut proposals = Vec::new();
  for link in links {
    if let Some(proposal_hash) = link.target.into_action_hash() {
      if let Some(record) = get(proposal_hash, GetOptions::default())? {
        proposals.push(record);
      }
    }
  }

  Ok(proposals)
}

/// Delete a proposal (soft delete by marking as rejected)
#[hdk_extern]
pub fn delete_exchange_proposal(proposal_hash: ActionHash) -> ExternResult<ActionHash> {
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check permissions - only proposal creator or admin can delete
  let responder_links = get_links(
    GetLinksInputBuilder::try_new(proposal_hash.clone(), LinkTypes::ProposalToResponder)?.build(),
  )?;

  let proposal_creator = responder_links
    .first()
    .and_then(|link| link.target.clone().into_agent_pub_key())
    .ok_or(CommonError::InvalidData(
      "Proposal creator not found".to_string(),
    ))?;

  if agent_pubkey != proposal_creator {
    let is_admin = check_if_agent_is_administrator(agent_pubkey)?;
    if !is_admin {
      return Err(AdministrationError::Unauthorized.into());
    }
  }

  // Update status to rejected instead of hard delete
  let input = UpdateProposalStatusInput {
    proposal_hash,
    new_status: ProposalStatus::Rejected,
    reason: Some("Deleted by creator".to_string()),
  };

  update_proposal_status(input)
}
