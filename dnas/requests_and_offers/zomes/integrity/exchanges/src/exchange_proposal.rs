use hdi::prelude::*;

/// Exchange proposal status enum
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Accepted,
    Rejected,
    Expired,
}

/// Exchange proposal type - supports two patterns
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ProposalType {
    DirectResponse,  // Quick response to a request/offer
    CrossLink,       // Formal linking of existing entities
}

/// Exchange proposal entity - pure entry with no embedded references
/// All relationships managed via DHT links
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ExchangeProposal {
    /// Type of proposal (DirectResponse or CrossLink)
    pub proposal_type: ProposalType,
    
    /// Service details being proposed
    pub service_details: String,
    
    /// Proposed terms and conditions
    pub terms: String,
    
    /// Proposed exchange medium (e.g., "USD", "CAD", "Hours", "Favor")
    pub exchange_medium: String,
    
    /// Proposed value/amount
    pub exchange_value: Option<String>,
    
    /// Expected delivery timeframe
    pub delivery_timeframe: Option<String>,
    
    /// Additional notes or context
    pub notes: Option<String>,
    
    /// Current status of the proposal
    pub status: ProposalStatus,
    
    /// When the proposal was created
    pub created_at: Timestamp,
    
    /// When the proposal expires (for pending proposals)
    pub expires_at: Option<Timestamp>,
    
    /// When the proposal was last updated
    pub updated_at: Timestamp,
}

impl ExchangeProposal {
    /// Create a new direct response proposal
    pub fn new_direct_response(
        service_details: String,
        terms: String,
        exchange_medium: String,
        exchange_value: Option<String>,
        delivery_timeframe: Option<String>,
        notes: Option<String>,
        expires_at: Option<Timestamp>,
    ) -> Self {
        let now = Timestamp::now();
        Self {
            proposal_type: ProposalType::DirectResponse,
            service_details,
            terms,
            exchange_medium,
            exchange_value,
            delivery_timeframe,
            notes,
            status: ProposalStatus::Pending,
            created_at: now,
            expires_at,
            updated_at: now,
        }
    }
    
    /// Create a new cross-link proposal
    pub fn new_cross_link(
        service_details: String,
        terms: String,
        exchange_medium: String,
        exchange_value: Option<String>,
        delivery_timeframe: Option<String>,
        notes: Option<String>,
        expires_at: Option<Timestamp>,
    ) -> Self {
        let now = Timestamp::now();
        Self {
            proposal_type: ProposalType::CrossLink,
            service_details,
            terms,
            exchange_medium,
            exchange_value,
            delivery_timeframe,
            notes,
            status: ProposalStatus::Pending,
            created_at: now,
            expires_at,
            updated_at: now,
        }
    }
    
    /// Update proposal status
    pub fn update_status(&mut self, new_status: ProposalStatus) {
        self.status = new_status;
        self.updated_at = Timestamp::now();
    }
    
    /// Check if proposal has expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = &self.expires_at {
            expires_at < &Timestamp::now()
        } else {
            false
        }
    }
    
    /// Check if proposal is still pending
    pub fn is_pending(&self) -> bool {
        self.status == ProposalStatus::Pending && !self.is_expired()
    }
}

/// Input for creating an exchange proposal
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateExchangeProposalInput {
    pub proposal_type: ProposalType,
    pub target_entity_hash: ActionHash, // The request or offer being responded to
    pub responder_entity_hash: Option<ActionHash>, // For cross-link, the counter request/offer
    pub service_details: String,
    pub terms: String,
    pub exchange_medium: String,
    pub exchange_value: Option<String>,
    pub delivery_timeframe: Option<String>,
    pub notes: Option<String>,
    pub expires_at: Option<Timestamp>,
}

/// Input for updating proposal status
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateProposalStatusInput {
    pub proposal_hash: ActionHash,
    pub new_status: ProposalStatus,
    pub reason: Option<String>,
}