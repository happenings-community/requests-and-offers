use hdi::prelude::*;


/// Cancellation reason enum
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CancellationReason {
    MutualAgreement,        // Both parties agreed to cancel
    ProviderUnavailable,    // Provider cannot deliver service
    ReceiverNoLongerNeeds,  // Receiver no longer needs the service
    ExternalCircumstances,  // External factors beyond control
    TechnicalFailure,       // Technical issues preventing completion
    Other(String),          // Custom reason
}

/// Who initiated the cancellation
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum CancellationInitiator {
    Provider,  // Service provider initiated
    Receiver,  // Service receiver initiated
    Both,      // Mutual decision
    System,    // System-initiated (e.g., expired agreement)
}

/// Exchange cancellation entity - tracks cancellation process
/// Pure entry with no embedded references
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ExchangeCancellation {
    /// Reason for cancellation
    pub reason: CancellationReason,
    
    /// Who initiated the cancellation
    pub initiated_by: CancellationInitiator,
    
    /// Whether the other party has consented to cancellation
    pub other_party_consent: Option<bool>,
    
    /// Whether an administrator has reviewed this cancellation
    pub admin_reviewed: bool,
    
    /// When the cancellation was initiated
    pub initiated_at: Timestamp,
    
    /// When the other party responded (if applicable)
    pub response_at: Option<Timestamp>,
    
    /// When admin review was completed (if applicable)
    pub admin_reviewed_at: Option<Timestamp>,
    
    /// Detailed explanation or notes about the cancellation
    pub explanation: String,
    
    /// Additional notes from the other party
    pub other_party_notes: Option<String>,
    
    /// Admin notes (if reviewed)
    pub admin_notes: Option<String>,
    
    /// Any compensation or resolution agreed upon
    pub resolution_terms: Option<String>,
}

impl ExchangeCancellation {
    /// Create a new mutual cancellation
    pub fn new_mutual(
        reason: CancellationReason,
        explanation: String,
        resolution_terms: Option<String>,
    ) -> Self {
        Self {
            reason,
            initiated_by: CancellationInitiator::Both,
            other_party_consent: Some(true),
            admin_reviewed: false,
            initiated_at: Timestamp::now(),
            response_at: Some(Timestamp::now()),
            admin_reviewed_at: None,
            explanation,
            other_party_notes: None,
            admin_notes: None,
            resolution_terms,
        }
    }
    
    /// Create a new unilateral cancellation request
    pub fn new_unilateral(
        reason: CancellationReason,
        initiated_by: CancellationInitiator,
        explanation: String,
    ) -> Self {
        Self {
            reason,
            initiated_by,
            other_party_consent: None,
            admin_reviewed: false,
            initiated_at: Timestamp::now(),
            response_at: None,
            admin_reviewed_at: None,
            explanation,
            other_party_notes: None,
            admin_notes: None,
            resolution_terms: None,
        }
    }
    
    /// Record other party's response to cancellation
    pub fn record_other_party_response(
        &mut self,
        consent: bool,
        notes: Option<String>,
    ) {
        self.other_party_consent = Some(consent);
        self.other_party_notes = notes;
        self.response_at = Some(Timestamp::now());
    }
    
    /// Record admin review
    pub fn record_admin_review(
        &mut self,
        admin_notes: String,
        resolution_terms: Option<String>,
    ) {
        self.admin_reviewed = true;
        self.admin_notes = Some(admin_notes);
        self.admin_reviewed_at = Some(Timestamp::now());
        if resolution_terms.is_some() {
            self.resolution_terms = resolution_terms;
        }
    }
    
    /// Check if cancellation is mutually agreed
    pub fn is_mutually_agreed(&self) -> bool {
        match &self.initiated_by {
            CancellationInitiator::Both => true,
            _ => self.other_party_consent == Some(true),
        }
    }
    
    /// Check if cancellation is disputed
    pub fn is_disputed(&self) -> bool {
        self.other_party_consent == Some(false)
    }
    
    /// Check if cancellation is pending response
    pub fn is_pending_response(&self) -> bool {
        !matches!(self.initiated_by, CancellationInitiator::Both)
            && self.other_party_consent.is_none()
    }
    
    /// Check if admin review is needed
    pub fn needs_admin_review(&self) -> bool {
        !self.admin_reviewed && (self.is_disputed() || matches!(
            self.reason,
            CancellationReason::ExternalCircumstances | CancellationReason::TechnicalFailure
        ))
    }
    
    /// Get status description
    pub fn get_status_description(&self) -> String {
        if self.is_mutually_agreed() {
            "Mutually Agreed".to_string()
        } else if self.is_disputed() {
            "Disputed".to_string()
        } else if self.is_pending_response() {
            "Pending Response".to_string()
        } else if self.needs_admin_review() {
            "Pending Admin Review".to_string()
        } else {
            "Resolved".to_string()
        }
    }
}

/// Input for creating a mutual cancellation
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateMutualCancellationInput {
    pub agreement_hash: ActionHash,
    pub reason: CancellationReason,
    pub explanation: String,
    pub resolution_terms: Option<String>,
}

/// Input for creating a unilateral cancellation request
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateUnilateralCancellationInput {
    pub agreement_hash: ActionHash,
    pub reason: CancellationReason,
    pub initiated_by: CancellationInitiator,
    pub explanation: String,
}

/// Input for responding to a cancellation request
#[derive(Serialize, Deserialize, Debug)]
pub struct RespondToCancellationInput {
    pub cancellation_hash: ActionHash,
    pub consent: bool,
    pub notes: Option<String>,
}

/// Input for admin review of cancellation
#[derive(Serialize, Deserialize, Debug)]
pub struct AdminReviewCancellationInput {
    pub cancellation_hash: ActionHash,
    pub admin_notes: String,
    pub resolution_terms: Option<String>,
}