use hdi::prelude::*;


/// Agreement status enum - simplified for basic workflow
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum AgreementStatus {
    Active,              // Agreement formed, working on it
    Completed,           // Both parties marked complete
}

/// Agreement entity - simplified for basic workflow
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
    
    /// Current status of the agreement
    pub status: AgreementStatus,
    
    /// When the agreement was formed
    pub created_at: Timestamp,
    
    /// When the agreement was last updated
    pub updated_at: Timestamp,
    
    /// Provider marked as completed
    pub provider_completed: bool,
    
    /// Receiver marked as completed
    pub receiver_completed: bool,
    
    /// Completion timestamp for provider
    pub provider_completed_at: Option<Timestamp>,
    
    /// Completion timestamp for receiver
    pub receiver_completed_at: Option<Timestamp>,
}

impl Agreement {
    /// Create a new agreement from approved proposal
    pub fn from_proposal(
        service_details: String,
        agreed_terms: String,
        exchange_medium: String,
        exchange_value: Option<String>,
        delivery_timeframe: Option<String>,
    ) -> Self {
        let now = Timestamp::now();
        Self {
            service_details,
            agreed_terms,
            exchange_medium,
            exchange_value,
            delivery_timeframe,
            status: AgreementStatus::Active,
            created_at: now,
            updated_at: now,
            provider_completed: false,
            receiver_completed: false,
            provider_completed_at: None,
            receiver_completed_at: None,
        }
    }
    
    /// Update agreement status
    pub fn update_status(&mut self, new_status: AgreementStatus) {
        self.status = new_status;
        self.updated_at = Timestamp::now();
    }
    
    /// Mark provider as completed
    pub fn mark_provider_complete(&mut self) {
        self.provider_completed = true;
        self.provider_completed_at = Some(Timestamp::now());
        self.updated_at = Timestamp::now();
        
        // If both parties completed, mark agreement as completed
        if self.receiver_completed {
            self.status = AgreementStatus::Completed;
        }
    }
    
    /// Mark receiver as completed
    pub fn mark_receiver_complete(&mut self) {
        self.receiver_completed = true;
        self.receiver_completed_at = Some(Timestamp::now());
        self.updated_at = Timestamp::now();
        
        // If both parties completed, mark agreement as completed
        if self.provider_completed {
            self.status = AgreementStatus::Completed;
        }
    }
    
    /// Check if both parties have marked completion
    pub fn is_mutually_completed(&self) -> bool {
        self.provider_completed && self.receiver_completed
    }
    
    /// Check if agreement is active and can be worked on
    pub fn is_active(&self) -> bool {
        self.status == AgreementStatus::Active
    }
}

/// Input for creating an agreement from an approved proposal - simplified
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateAgreementInput {
    pub proposal_hash: ActionHash,
    pub service_details: String,
    pub agreed_terms: String,
    pub exchange_medium: String,
    pub exchange_value: Option<String>,
    pub delivery_timeframe: Option<String>,
}

/// Input for updating agreement status
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateAgreementStatusInput {
    pub agreement_hash: ActionHash,
    pub new_status: AgreementStatus,
}

/// Input for marking exchange completion
#[derive(Serialize, Deserialize, Debug)]
pub struct MarkCompleteInput {
    pub agreement_hash: ActionHash,
    pub validator_role: ValidatorRole,
}

/// Role of the person marking completion (provider or receiver)
#[derive(Serialize, Deserialize, Debug)]
pub enum ValidatorRole {
    Provider,
    Receiver,
}