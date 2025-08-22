use hdi::prelude::*;

// Simplified exchange entities for basic workflow
mod exchange_response;
mod agreement;
mod exchange_review;
mod response_status;

pub use exchange_response::*;
pub use agreement::*;
pub use exchange_review::*;
pub use response_status::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    ExchangeResponse(ExchangeResponse),
    Agreement(Agreement),
    ExchangeReview(ExchangeReview),
    ResponseStatus(ResponseStatus),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    // Entry updates for simplified entities
    ExchangeResponseUpdates,
    AgreementUpdates,
    ExchangeReviewUpdates,
    ResponseStatusUpdates,
    
    // Core response relationships (simplified workflow)
    RequestToResponse,
    OfferToResponse,
    ResponseToResponder,
    ResponseToOriginalPoster,
    
    // Response status relationships
    ResponseToStatus,
    
    // Agreement relationships (basic completion tracking)
    ResponseToAgreement,
    AgreementToProvider,
    AgreementToReceiver,
    
    // Review relationships (simple feedback)
    AgreementToReview,
    ReviewToReviewer,
    
    // Path-based indexing (simplified)
    AllResponses,
    AllAgreements,
    AllReviews,
    
    // Status-based indexing (basic workflow)
    ResponsesByStatus,
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
                    EntryTypes::ExchangeResponse(response) => {
                        return validate_exchange_response(response);
                    }
                    EntryTypes::Agreement(agreement) => {
                        return validate_agreement(agreement);
                    }
                    EntryTypes::ExchangeReview(review) => {
                        return validate_exchange_review(review);
                    }
                    EntryTypes::ResponseStatus(status) => {
                        return validate_response_status(status);
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
                    EntryTypes::ExchangeResponse(_) => {
                        // Exchange responses can be deleted by their creator
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
                    EntryTypes::ResponseStatus(_) => {
                        // Response status entries should not be deleted to maintain history
                        return Ok(ValidateCallbackResult::Invalid(
                            "Response status entries cannot be deleted to maintain history".to_string(),
                        ));
                    }
                }
            }
            _ => (),
        }
    }
    
    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_exchange_response(response: ExchangeResponse) -> ExternResult<ValidateCallbackResult> {
    if response.service_details.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange response service details cannot be empty".to_string(),
        ));
    }
    if response.terms.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange response terms cannot be empty".to_string(),
        ));
    }
    if response.exchange_medium.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Exchange response exchange medium cannot be empty".to_string(),
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

pub fn validate_response_status(status: ResponseStatus) -> ExternResult<ValidateCallbackResult> {
    // Validate reason length if provided
    if let Some(reason) = &status.reason {
        if reason.trim().is_empty() {
            return Ok(ValidateCallbackResult::Invalid(
                "Response status reason cannot be empty if provided".to_string(),
            ));
        }
        if reason.len() > 500 {
            return Ok(ValidateCallbackResult::Invalid(
                "Response status reason cannot exceed 500 characters".to_string(),
            ));
        }
    }
    
    // Validate that rejected status should have a reason (recommended practice)
    if status.status == ExchangeResponseStatus::Rejected && status.reason.is_none() {
        // Allow rejection without reason but it's not recommended
        // This is a soft validation that could be made stricter in the future
    }
    
    Ok(ValidateCallbackResult::Valid)
}