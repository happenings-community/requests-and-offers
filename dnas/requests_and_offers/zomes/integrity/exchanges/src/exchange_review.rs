use hdi::prelude::*;


/// Reviewer type - who is providing the review
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ReviewerType {
    Provider,  // Service provider
    Receiver,  // Service receiver
}

/// Exchange review entity - simplified feedback system
/// Pure entry with no embedded references, relationships via links
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ExchangeReview {
    /// Public review data (always present in simplified system)
    pub public_review: PublicReview,
    
    /// When the review was created
    pub created_at: Timestamp,
}

/// Public review component - simplified feedback system
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct PublicReview {
    /// "Completed on time" assessment
    pub completed_on_time: bool,
    
    /// "Completed as agreed" assessment
    pub completed_as_agreed: bool,
    
    /// Overall rating (1-5 scale, 5 being highest)
    pub rating: u8,
    
    /// Optional review comments (max 200 characters)
    pub comments: Option<String>,
    
    /// Who provided this review
    pub reviewer_type: ReviewerType,
    
    /// When the public review was created
    pub reviewed_at: Timestamp,
}

impl ExchangeReview {
    /// Create a new review - simplified system
    pub fn new(
        completed_on_time: bool,
        completed_as_agreed: bool,
        rating: u8,
        comments: Option<String>,
        reviewer_type: ReviewerType,
    ) -> Result<Self, String> {
        // Validate rating is in valid range (1-5)
        if rating < 1 || rating > 5 {
            return Err("Rating must be between 1 and 5".to_string());
        }
        
        // Validate comment length
        if let Some(ref comment_text) = comments {
            if comment_text.len() > 200 {
                return Err("Comments cannot exceed 200 characters".to_string());
            }
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
            public_review,
            created_at: now,
        })
    }
    
    /// Get the overall rating
    pub fn get_rating(&self) -> u8 {
        self.public_review.rating
    }
    
    /// Get the reviewer type
    pub fn get_reviewer_type(&self) -> &ReviewerType {
        &self.public_review.reviewer_type
    }
    
    /// Check if service was completed on time
    pub fn was_completed_on_time(&self) -> bool {
        self.public_review.completed_on_time
    }
    
    /// Check if service was completed as agreed
    pub fn was_completed_as_agreed(&self) -> bool {
        self.public_review.completed_as_agreed
    }
    
    /// Get review comments
    pub fn get_comments(&self) -> Option<&String> {
        self.public_review.comments.as_ref()
    }
}

/// Input for creating a review - simplified system
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateReviewInput {
    pub agreement_hash: ActionHash,
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