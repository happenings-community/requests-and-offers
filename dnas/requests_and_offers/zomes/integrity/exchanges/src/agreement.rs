use hdi::prelude::*;


/// Agreement status enum with enhanced cancellation support
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum AgreementStatus {
    Active,              // Agreement formed, not yet started
    InProgress,          // Service delivery in progress
    Completed,           // Both parties validated completion
    CancelledMutual,     // Both parties agreed to cancel
    CancelledProvider,   // Provider cancelled (can't deliver)
    CancelledReceiver,   // Receiver cancelled (no longer needs)
    Failed,              // Technical/external failure
    Disputed,            // Conflicting cancellation claims
}

/// Agreement entity - pure entry with no embedded references
/// All relationships managed via DHT links
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Agreement {
    /// Final agreed service details
    pub service_details: String,
    
    /// Final agreed terms and conditions
    pub agreed_terms: String,
    
    /// Final agreed exchange medium
    pub exchange_medium: String,
    
    /// Final agreed value/amount
    pub exchange_value: Option<String>,
    
    /// Final agreed delivery timeframe
    pub delivery_timeframe: Option<String>,
    
    /// Any additional agreed conditions
    pub additional_conditions: Option<String>,
    
    /// Current status of the agreement
    pub status: AgreementStatus,
    
    /// When the agreement was formed
    pub created_at: Timestamp,
    
    /// When service delivery is expected to start
    pub start_date: Option<Timestamp>,
    
    /// When service delivery is expected to be completed
    pub completion_date: Option<Timestamp>,
    
    /// When the agreement was last updated
    pub updated_at: Timestamp,
    
    /// Provider validation of completion
    pub provider_validated: bool,
    
    /// Receiver validation of completion
    pub receiver_validated: bool,
    
    /// Validation timestamp for provider
    pub provider_validated_at: Option<Timestamp>,
    
    /// Validation timestamp for receiver
    pub receiver_validated_at: Option<Timestamp>,
}

impl Agreement {
    /// Create a new agreement from accepted proposal
    pub fn from_proposal(
        service_details: String,
        agreed_terms: String,
        exchange_medium: String,
        exchange_value: Option<String>,
        delivery_timeframe: Option<String>,
        additional_conditions: Option<String>,
        start_date: Option<Timestamp>,
        completion_date: Option<Timestamp>,
    ) -> Self {
        let now = Timestamp::now();
        Self {
            service_details,
            agreed_terms,
            exchange_medium,
            exchange_value,
            delivery_timeframe,
            additional_conditions,
            status: AgreementStatus::Active,
            created_at: now,
            start_date,
            completion_date,
            updated_at: now,
            provider_validated: false,
            receiver_validated: false,
            provider_validated_at: None,
            receiver_validated_at: None,
        }
    }
    
    /// Update agreement status
    pub fn update_status(&mut self, new_status: AgreementStatus) {
        self.status = new_status;
        self.updated_at = Timestamp::now();
    }
    
    /// Mark provider as validated
    pub fn validate_by_provider(&mut self) {
        self.provider_validated = true;
        self.provider_validated_at = Some(Timestamp::now());
        self.updated_at = Timestamp::now();
        
        // If both parties validated, mark as completed
        if self.receiver_validated {
            self.status = AgreementStatus::Completed;
        }
    }
    
    /// Mark receiver as validated
    pub fn validate_by_receiver(&mut self) {
        self.receiver_validated = true;
        self.receiver_validated_at = Some(Timestamp::now());
        self.updated_at = Timestamp::now();
        
        // If both parties validated, mark as completed
        if self.provider_validated {
            self.status = AgreementStatus::Completed;
        }
    }
    
    /// Check if both parties have validated completion
    pub fn is_mutually_validated(&self) -> bool {
        self.provider_validated && self.receiver_validated
    }
    
    /// Check if agreement is in a cancelled state
    pub fn is_cancelled(&self) -> bool {
        matches!(
            self.status,
            AgreementStatus::CancelledMutual
                | AgreementStatus::CancelledProvider
                | AgreementStatus::CancelledReceiver
                | AgreementStatus::Failed
        )
    }
    
    /// Check if agreement is in dispute
    pub fn is_disputed(&self) -> bool {
        self.status == AgreementStatus::Disputed
    }
    
    /// Check if agreement is active and can be worked on
    pub fn is_active(&self) -> bool {
        matches!(
            self.status,
            AgreementStatus::Active | AgreementStatus::InProgress
        )
    }
}

/// Input for creating an agreement from an accepted proposal
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateAgreementInput {
    pub proposal_hash: ActionHash,
    pub service_details: String,
    pub agreed_terms: String,
    pub exchange_medium: String,
    pub exchange_value: Option<String>,
    pub delivery_timeframe: Option<String>,
    pub additional_conditions: Option<String>,
    pub start_date: Option<Timestamp>,
    pub completion_date: Option<Timestamp>,
}

/// Input for updating agreement status
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateAgreementStatusInput {
    pub agreement_hash: ActionHash,
    pub new_status: AgreementStatus,
}

/// Input for validating agreement completion
#[derive(Serialize, Deserialize, Debug)]
pub struct ValidateCompletionInput {
    pub agreement_hash: ActionHash,
    pub validator_role: ValidatorRole,
}

/// Role of the validator (provider or receiver)
#[derive(Serialize, Deserialize, Debug)]
pub enum ValidatorRole {
    Provider,
    Receiver,
}