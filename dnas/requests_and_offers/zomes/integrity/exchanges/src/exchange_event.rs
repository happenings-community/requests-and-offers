use hdi::prelude::*;


/// Exchange event type enum
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangeEventType {
    AgreementStarted,    // Service delivery began
    ProgressUpdate,      // General progress update
    MilestoneReached,    // Specific milestone completed
    IssueReported,       // Problem or issue encountered
    DeliveryCompleted,   // Service delivery finished
    PaymentProcessed,    // Payment/exchange completed
    Other(String),       // Custom event type
}

/// Exchange event priority level
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum EventPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// Exchange event entity - tracks progress and milestones
/// Pure entry with no embedded references
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ExchangeEvent {
    /// Type of event
    pub event_type: ExchangeEventType,
    
    /// Priority level of the event
    pub priority: EventPriority,
    
    /// Event title/summary
    pub title: String,
    
    /// Detailed description of the event
    pub description: String,
    
    /// Progress percentage (0-100)
    pub progress_percentage: Option<u8>,
    
    /// Files or evidence attached to this event
    pub attachments: Vec<String>, // URLs or file hashes
    
    /// When the event occurred
    pub occurred_at: Timestamp,
    
    /// When the event was recorded
    pub recorded_at: Timestamp,
    
    /// Whether this event is visible to both parties
    pub is_public: bool,
    
    /// Additional metadata as key-value pairs
    pub metadata: std::collections::HashMap<String, String>,
}

impl ExchangeEvent {
    /// Create a new exchange event
    pub fn new(
        event_type: ExchangeEventType,
        priority: EventPriority,
        title: String,
        description: String,
        progress_percentage: Option<u8>,
        attachments: Vec<String>,
        occurred_at: Option<Timestamp>,
        is_public: bool,
        metadata: std::collections::HashMap<String, String>,
    ) -> Self {
        let now = Timestamp::now();
        Self {
            event_type,
            priority,
            title,
            description,
            progress_percentage,
            attachments,
            occurred_at: occurred_at.unwrap_or(now),
            recorded_at: now,
            is_public,
            metadata,
        }
    }
    
    /// Create an agreement started event
    pub fn agreement_started(description: String) -> Self {
        Self::new(
            ExchangeEventType::AgreementStarted,
            EventPriority::Normal,
            "Agreement Started".to_string(),
            description,
            Some(0),
            vec![],
            None,
            true,
            std::collections::HashMap::new(),
        )
    }
    
    /// Create a progress update event
    pub fn progress_update(
        title: String,
        description: String,
        progress_percentage: u8,
        is_public: bool,
    ) -> Self {
        Self::new(
            ExchangeEventType::ProgressUpdate,
            EventPriority::Normal,
            title,
            description,
            Some(progress_percentage),
            vec![],
            None,
            is_public,
            std::collections::HashMap::new(),
        )
    }
    
    /// Create a milestone reached event
    pub fn milestone_reached(
        milestone_name: String,
        description: String,
        progress_percentage: u8,
    ) -> Self {
        Self::new(
            ExchangeEventType::MilestoneReached,
            EventPriority::Normal,
            format!("Milestone: {}", milestone_name),
            description,
            Some(progress_percentage),
            vec![],
            None,
            true,
            std::collections::HashMap::new(),
        )
    }
    
    /// Create an issue reported event
    pub fn issue_reported(
        issue_title: String,
        description: String,
        priority: EventPriority,
    ) -> Self {
        Self::new(
            ExchangeEventType::IssueReported,
            priority,
            format!("Issue: {}", issue_title),
            description,
            None,
            vec![],
            None,
            true,
            std::collections::HashMap::new(),
        )
    }
    
    /// Create a delivery completed event
    pub fn delivery_completed(description: String, attachments: Vec<String>) -> Self {
        Self::new(
            ExchangeEventType::DeliveryCompleted,
            EventPriority::High,
            "Delivery Completed".to_string(),
            description,
            Some(100),
            attachments,
            None,
            true,
            std::collections::HashMap::new(),
        )
    }
    
    /// Validate progress percentage is within valid range
    pub fn validate_progress(&self) -> bool {
        if let Some(progress) = self.progress_percentage {
            progress <= 100
        } else {
            true
        }
    }
}

/// Input for creating an exchange event
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateExchangeEventInput {
    pub agreement_hash: ActionHash,
    pub event_type: ExchangeEventType,
    pub priority: EventPriority,
    pub title: String,
    pub description: String,
    pub progress_percentage: Option<u8>,
    pub attachments: Vec<String>,
    pub occurred_at: Option<Timestamp>,
    pub is_public: bool,
    pub metadata: std::collections::HashMap<String, String>,
}