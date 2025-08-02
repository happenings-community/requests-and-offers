use hdi::prelude::*;


/// Reviewer type - who is providing the review
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ReviewerType {
    Provider,  // Service provider
    Receiver,  // Service receiver
}

/// Exchange review entity - structured feedback collection
/// Pure entry with no embedded references, relationships via links
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ExchangeReview {
    /// Mutual validation - provider confirms completion
    pub provider_validation: bool,
    
    /// Mutual validation - receiver confirms satisfaction
    pub receiver_validation: bool,
    
    /// Optional public review data
    pub public_review: Option<PublicReview>,
    
    /// When the review was created
    pub created_at: Timestamp,
    
    /// Whether this review is made public to the community
    pub is_public: bool,
}

/// Public review component - optional detailed feedback
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct PublicReview {
    /// "Completed on time" assessment
    pub completed_on_time: bool,
    
    /// "Completed as agreed" assessment
    pub completed_as_agreed: bool,
    
    /// Overall rating (0-5 scale, 5 being highest)
    pub rating: u8,
    
    /// Optional review comments
    pub comments: Option<String>,
    
    /// Who provided this review
    pub reviewer_type: ReviewerType,
    
    /// When the public review was created
    pub reviewed_at: Timestamp,
}

impl ExchangeReview {
    /// Create a new review with mutual validation only
    pub fn new_validation_only(
        provider_validation: bool,
        receiver_validation: bool,
    ) -> Self {
        Self {
            provider_validation,
            receiver_validation,
            public_review: None,
            created_at: Timestamp::now(),
            is_public: false,
        }
    }
    
    /// Create a new review with public feedback
    pub fn new_with_public_review(
        provider_validation: bool,
        receiver_validation: bool,
        completed_on_time: bool,
        completed_as_agreed: bool,
        rating: u8,
        comments: Option<String>,
        reviewer_type: ReviewerType,
    ) -> Result<Self, String> {
        // Validate rating is in valid range
        if rating > 5 {
            return Err("Rating must be between 0 and 5".to_string());
        }
        
        let now = Timestamp::now();
        let public_review = PublicReview {
            completed_on_time,
            completed_as_agreed,
            rating,
            comments,
            reviewer_type,
            reviewed_at: now,
        };
        
        Ok(Self {
            provider_validation,
            receiver_validation,
            public_review: Some(public_review),
            created_at: now,
            is_public: true,
        })
    }
    
    /// Check if both parties have validated
    pub fn is_mutually_validated(&self) -> bool {
        self.provider_validation && self.receiver_validation
    }
    
    /// Get the overall rating if available
    pub fn get_rating(&self) -> Option<u8> {
        self.public_review.as_ref().map(|r| r.rating)
    }
    
    /// Get the reviewer type if public review exists
    pub fn get_reviewer_type(&self) -> Option<&ReviewerType> {
        self.public_review.as_ref().map(|r| &r.reviewer_type)
    }
    
    /// Check if service was completed on time according to review
    pub fn was_completed_on_time(&self) -> Option<bool> {
        self.public_review.as_ref().map(|r| r.completed_on_time)
    }
    
    /// Check if service was completed as agreed according to review
    pub fn was_completed_as_agreed(&self) -> Option<bool> {
        self.public_review.as_ref().map(|r| r.completed_as_agreed)
    }
    
    /// Get review comments if available
    pub fn get_comments(&self) -> Option<&String> {
        self.public_review.as_ref().and_then(|r| r.comments.as_ref())
    }
}

/// Input for creating a mutual validation review
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateMutualValidationInput {
    pub agreement_hash: ActionHash,
    pub provider_validation: bool,
    pub receiver_validation: bool,
}

/// Input for creating a public review
#[derive(Serialize, Deserialize, Debug)]
pub struct CreatePublicReviewInput {
    pub agreement_hash: ActionHash,
    pub provider_validation: bool,
    pub receiver_validation: bool,
    pub completed_on_time: bool,
    pub completed_as_agreed: bool,
    pub rating: u8,
    pub comments: Option<String>,
    pub reviewer_type: ReviewerType,
}

/// Aggregated review statistics for reputation calculation
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReviewStatistics {
    pub total_reviews: u32,
    pub average_rating: f64,
    pub on_time_percentage: f64,
    pub as_agreed_percentage: f64,
    pub total_completed_exchanges: u32,
}