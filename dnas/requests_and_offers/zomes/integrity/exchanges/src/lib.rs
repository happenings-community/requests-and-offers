use hdi::prelude::*;

// Simplified exchange entities for basic workflow
mod exchange_proposal;
mod agreement;
mod exchange_review;

pub use exchange_proposal::*;
pub use agreement::*;
pub use exchange_review::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    ExchangeProposal(ExchangeProposal),
    Agreement(Agreement),
    ExchangeReview(ExchangeReview),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    // Entry updates for simplified entities
    ExchangeProposalUpdates,
    AgreementUpdates,
    ExchangeReviewUpdates,
    
    // Core proposal relationships (simplified workflow)
    RequestToProposal,
    OfferToProposal,
    ProposalToResponder,
    ProposalToOriginalPoster,
    
    // Agreement relationships (basic completion tracking)
    ProposalToAgreement,
    AgreementToProvider,
    AgreementToReceiver,
    
    // Review relationships (simple feedback)
    AgreementToReview,
    ReviewToReviewer,
    
    // Path-based indexing (simplified)
    AllProposals,
    AllAgreements,
    AllReviews,
    
    // Status-based indexing (basic workflow)
    ProposalsByStatus,
    AgreementsByStatus,
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
                    EntryTypes::ExchangeReview(review) => {
                        return validate_exchange_review(review);
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
                        // Agreements should not be deleted, only marked complete
                        return Ok(ValidateCallbackResult::Invalid(
                            "Agreements cannot be deleted, only marked complete".to_string(),
                        ));
                    }
                    EntryTypes::ExchangeReview(_) => {
                        // Reviews should not be deleted to maintain integrity
                        return Ok(ValidateCallbackResult::Invalid(
                            "Reviews cannot be deleted to maintain integrity".to_string(),
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
    if agreement.exchange_medium.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Agreement exchange medium cannot be empty".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_exchange_review(review: ExchangeReview) -> ExternResult<ValidateCallbackResult> {
    if review.rating < 1 || review.rating > 5 {
        return Ok(ValidateCallbackResult::Invalid(
            "Review rating must be between 1 and 5".to_string(),
        ));
    }
    if let Some(comments) = &review.comments {
        if comments.len() > 200 {
            return Ok(ValidateCallbackResult::Invalid(
                "Review comments cannot exceed 200 characters".to_string(),
            ));
        }
    }
    Ok(ValidateCallbackResult::Valid)
}