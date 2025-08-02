use hdi::prelude::*;

mod exchange_proposal;
mod agreement;
mod exchange_event;
mod exchange_review;
mod exchange_cancellation;

pub use exchange_proposal::*;
pub use agreement::*;
pub use exchange_event::*;
pub use exchange_review::*;
pub use exchange_cancellation::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    ExchangeProposal(ExchangeProposal),
    Agreement(Agreement),
    ExchangeEvent(ExchangeEvent),
    ExchangeReview(ExchangeReview),
    ExchangeCancellation(ExchangeCancellation),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    // Entry updates
    ExchangeProposalUpdates,
    AgreementUpdates,
    ExchangeEventUpdates,
    ExchangeReviewUpdates,
    ExchangeCancellationUpdates,
    
    // Proposal relationships
    RequestToProposal,
    OfferToProposal,
    ProposalToResponder,
    ProposalToOriginalPoster,
    
    // Agreement relationships
    ProposalToAgreement,
    AgreementToProvider,
    AgreementToReceiver,
    
    // Event relationships
    AgreementToEvent,
    EventToParticipant,
    
    // Review relationships
    AgreementToReview,
    ReviewToReviewer,
    
    // Cancellation relationships
    AgreementToCancellation,
    CancellationToInitiator,
    AgreementToDispute,
    DisputeToParties,
    
    // Path-based indexing
    AllProposals,
    AllAgreements,
    AllEvents,
    AllReviews,
    AllCancellations,
    
    // Status-based indexing
    ProposalsByStatus,
    AgreementsByStatus,
    CancellationsByReason,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

#[allow(clippy::collapsible_match, clippy::single_match)]
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    if let FlatOp::StoreEntry(store_entry) = op.flattened::<EntryTypes, LinkTypes>()? {
        match store_entry {
            OpEntry::CreateEntry { app_entry, .. } | OpEntry::UpdateEntry { app_entry, .. } => {
                match app_entry {
                    EntryTypes::ExchangeProposal(proposal) => {
                        return validate_exchange_proposal(proposal);
                    }
                    EntryTypes::Agreement(agreement) => {
                        return validate_agreement(agreement);
                    }
                    EntryTypes::ExchangeEvent(event) => {
                        return validate_exchange_event(event);
                    }
                    EntryTypes::ExchangeReview(review) => {
                        return validate_exchange_review(review);
                    }
                    EntryTypes::ExchangeCancellation(cancellation) => {
                        return validate_exchange_cancellation(cancellation);
                    }
                }
            }
            _ => (),
        }
    }
    
    if let FlatOp::StoreRecord(store_record) = op.flattened::<EntryTypes, LinkTypes>()? {
        match store_record {
            OpRecord::DeleteEntry {
                original_action_hash,
                ..
            } => {
                let original_record = must_get_valid_record(original_action_hash)?;
                let original_action = original_record.action().clone();
                let original_action = match original_action {
                    Action::Create(create) => EntryCreationAction::Create(create),
                    Action::Update(update) => EntryCreationAction::Update(update),
                    _ => {
                        return Ok(ValidateCallbackResult::Invalid(
                            "Original action for a delete must be a Create or Update action".to_string(),
                        ));
                    }
                };
                let app_entry_type = match original_action.entry_type() {
                    EntryType::App(app_entry_type) => app_entry_type,
                    _ => {
                        return Ok(ValidateCallbackResult::Valid);
                    }
                };
                let entry = match original_record.entry().as_option() {
                    Some(entry) => entry,
                    None => {
                        if original_action.entry_type().visibility().is_public() {
                            return Ok(ValidateCallbackResult::Invalid(
                                "Original record for a delete of a public entry must contain an entry".to_string(),
                            ));
                        } else {
                            return Ok(ValidateCallbackResult::Valid);
                        }
                    }
                };
                let original_app_entry = match EntryTypes::deserialize_from_type(
                    app_entry_type.zome_index,
                    app_entry_type.entry_index,
                    entry,
                )? {
                    Some(app_entry) => app_entry,
                    None => {
                        return Ok(ValidateCallbackResult::Invalid(
                            "Original app entry must be one of the defined entry types for this zome".to_string(),
                        ));
                    }
                };
                match original_app_entry {
                    EntryTypes::ExchangeProposal(_) => {
                        // Exchange proposals can be deleted by their creator
                    }
                    EntryTypes::Agreement(_) => {
                        // Agreements should not be deleted, only cancelled
                        return Ok(ValidateCallbackResult::Invalid(
                            "Agreements cannot be deleted, use cancellation instead".to_string(),
                        ));
                    }
                    EntryTypes::ExchangeEvent(_) => {
                        // Events can be deleted by their creator
                    }
                    EntryTypes::ExchangeReview(_) => {
                        // Reviews should not be deleted to maintain integrity
                        return Ok(ValidateCallbackResult::Invalid(
                            "Reviews cannot be deleted to maintain integrity".to_string(),
                        ));
                    }
                    EntryTypes::ExchangeCancellation(_) => {
                        // Cancellations should not be deleted to maintain audit trail
                        return Ok(ValidateCallbackResult::Invalid(
                            "Cancellations cannot be deleted to maintain audit trail".to_string(),
                        ));
                    }
                }
            }
            _ => (),
        }
    }
    
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_exchange_proposal(proposal: ExchangeProposal) -> ExternResult<ValidateCallbackResult> {
    if proposal.service_details.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange proposal service details cannot be empty".to_string(),
        ));
    }
    if proposal.terms.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange proposal terms cannot be empty".to_string(),
        ));
    }
    if proposal.exchange_medium.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange proposal exchange medium cannot be empty".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_agreement(agreement: Agreement) -> ExternResult<ValidateCallbackResult> {
    if agreement.service_details.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Agreement service details cannot be empty".to_string(),
        ));
    }
    if agreement.agreed_terms.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Agreement terms cannot be empty".to_string(),
        ));
    }
    if agreement.exchange_medium.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Agreement exchange medium cannot be empty".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_exchange_event(event: ExchangeEvent) -> ExternResult<ValidateCallbackResult> {
    if event.title.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange event title cannot be empty".to_string(),
        ));
    }
    if event.description.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange event description cannot be empty".to_string(),
        ));
    }
    if !event.validate_progress() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange event progress percentage must be between 0 and 100".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_exchange_review(review: ExchangeReview) -> ExternResult<ValidateCallbackResult> {
    if let Some(public_review) = &review.public_review {
        if public_review.rating > 5 {
            return Ok(ValidateCallbackResult::Invalid(
                "Review rating must be between 0 and 5".to_string(),
            ));
        }
    }
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_exchange_cancellation(cancellation: ExchangeCancellation) -> ExternResult<ValidateCallbackResult> {
    if cancellation.explanation.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Cancellation explanation cannot be empty".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}