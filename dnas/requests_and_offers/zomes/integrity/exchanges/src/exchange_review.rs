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
    /// Overall rating (1-5 scale, 5 being highest)
    pub rating: u8,
    
    /// Optional review comments (max 200 characters)
    pub comments: Option<String>,
    
    /// Who provided this review
    pub reviewer_type: ReviewerType,
    
    /// When the review was created
    pub created_at: Timestamp,
}

impl ExchangeReview {
    /// Create a new review - simplified system
    pub fn new(
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
        
        Ok(Self {
            rating,
            comments,
            reviewer_type,
            created_at: now,
        })
    }
    
    /// Get the overall rating
    pub fn get_rating(&self) -> u8 {
        self.rating
    }
    
    /// Get the reviewer type
    pub fn get_reviewer_type(&self) -> &ReviewerType {
        &self.reviewer_type
    }
    
    /// Get review comments
    pub fn get_comments(&self) -> Option<&String> {
        self.comments.as_ref()
    }
}

/// Input for creating a review - simplified system
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateReviewInput {
    pub agreement_hash: ActionHash,
    pub rating: u8,
    pub comments: Option<String>,
    pub reviewer_type: ReviewerType,
}

/// Aggregated review statistics for reputation calculation - simplified
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ReviewStatistics {
    pub total_reviews: u32,
    pub average_rating: f64,
    pub total_completed_exchanges: u32,
}