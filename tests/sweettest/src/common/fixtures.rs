//! Sample data constructors for Sweettest.
//!
//! These mirror the TypeScript `sampleUser`, `sampleOrganization`, etc.
//! helpers from the Tryorama common.ts files.

use holochain::prelude::*;
use serde::{Deserialize, Serialize};

// ── User fixtures ─────────────────────────────────────────────

/// Input for `create_user` / `update_user` zome calls.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInput {
    pub name: String,
    pub nickname: String,
    pub bio: String,
    pub picture: Option<SerializedBytes>,
    pub user_type: String,
    pub email: String,
    pub phone: Option<String>,
    pub time_zone: String,
    pub location: String,
}

/// Create a sample user input with sensible defaults.
pub fn sample_user(name: impl Into<String>) -> UserInput {
    UserInput {
        name: name.into(),
        nickname: "NickName".to_string(),
        bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.".to_string(),
        picture: None,
        user_type: "creator".to_string(),
        email: "abc@abc.com".to_string(),
        phone: None,
        time_zone: "EST".to_string(),
        location: "here".to_string(),
    }
}

/// Input for `update_user` zome call (wraps UserInput with action hashes).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUserInput {
    pub original_action_hash: ActionHash,
    pub previous_action_hash: ActionHash,
    pub updated_user: UserInput,
}

// ── Organization fixtures ─────────────────────────────────────

/// Input for `create_organization` / `update_organization` zome calls.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizationInput {
    pub name: String,
    pub description: String,
    pub full_legal_name: String,
    pub logo: Option<SerializedBytes>,
    pub email: String,
    pub urls: Vec<String>,
    pub location: String,
}

/// Create a sample organization input with sensible defaults.
pub fn sample_organization(name: impl Into<String>) -> OrganizationInput {
    OrganizationInput {
        name: name.into(),
        description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.".to_string(),
        full_legal_name: "Organization Inc.".to_string(),
        logo: None,
        email: "abc@abc.com".to_string(),
        urls: vec!["https://example.com".to_string()],
        location: "here".to_string(),
    }
}

// ── Administration fixtures ───────────────────────────────────

/// Input for `register_administrator` zome call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityActionHashAgents {
    pub entity: String,
    pub entity_original_action_hash: ActionHash,
    pub agent_pubkeys: Vec<AgentPubKey>,
}

/// Input for status update zome calls.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateEntityStatusInput {
    pub entity: String,
    pub entity_original_action_hash: ActionHash,
    pub status_original_action_hash: ActionHash,
    pub status_previous_action_hash: ActionHash,
    pub new_status: StatusInput,
}

/// Input for `suspend_entity_temporarily` zome call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuspendEntityTemporarilyInput {
    pub entity: String,
    pub entity_original_action_hash: ActionHash,
    pub status_original_action_hash: ActionHash,
    pub status_previous_action_hash: ActionHash,
    pub reason: String,
    pub duration_in_days: u32,
}

/// Input for `suspend_entity_indefinitely` / `unsuspend_entity` etc.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuspendEntityIndefinitelyInput {
    pub entity: String,
    pub entity_original_action_hash: ActionHash,
    pub status_original_action_hash: ActionHash,
    pub status_previous_action_hash: ActionHash,
    pub reason: String,
}

/// Input for `unsuspend_entity` / `unsuspend_entity_if_time_passed`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsuspendEntityInput {
    pub entity: String,
    pub entity_original_action_hash: ActionHash,
    pub status_original_action_hash: ActionHash,
    pub status_previous_action_hash: ActionHash,
}

/// Status input for `update_entity_status`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusInput {
    pub status_type: String,
    pub reason: Option<String>,
    pub suspended_until: Option<String>,
}

/// Build an "accepted" status input.
pub fn accepted_status() -> StatusInput {
    StatusInput {
        status_type: "accepted".to_string(),
        reason: None,
        suspended_until: None,
    }
}

/// Build a "rejected" status input.
pub fn rejected_status(reason: impl Into<String>) -> StatusInput {
    StatusInput {
        status_type: "rejected".to_string(),
        reason: Some(reason.into()),
        suspended_until: None,
    }
}

/// Administration entity string constants.
pub const ENTITY_USERS: &str = "users";
pub const ENTITY_ORGANIZATIONS: &str = "organizations";
pub const ENTITY_NETWORK: &str = "network";

// ── Service Type fixtures ─────────────────────────────────────

/// Mirrors `ServiceType` from `service_types_integrity` for use as coordinator input.
///
/// Fields: name (String), description (String), technical (bool).
/// This is used both as create/update input and as the inner type for `ServiceTypeInput`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceTypeEntry {
    pub name: String,
    pub description: String,
    pub technical: bool,
}

/// Input for `create_service_type` zome call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceTypeInput {
    pub service_type: ServiceTypeEntry,
}

/// Create a sample service type input.
pub fn sample_service_type(name: impl Into<String>) -> ServiceTypeInput {
    ServiceTypeInput {
        service_type: ServiceTypeEntry {
            name: name.into(),
            description: "A sample service type for testing.".to_string(),
            technical: false,
        },
    }
}

/// Input for `update_service_type` zome call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateServiceTypeInput {
    pub original_action_hash: ActionHash,
    pub previous_action_hash: ActionHash,
    pub updated_service_type: ServiceTypeEntry,
}

// ── Request fixtures ──────────────────────────────────────────

/// Input for `create_request` zome call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRequestInput {
    pub request: RequestData,
    pub organization: Option<ActionHash>,
    pub service_type_hashes: Vec<ActionHash>,
    pub medium_of_exchange_hashes: Vec<ActionHash>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestData {
    pub title: String,
    pub description: String,
    pub contact_preference: String,
    pub date_range: Option<()>,
    pub time_estimate_hours: Option<f64>,
    pub time_preference: String,
    pub time_zone: Option<String>,
    pub interaction_type: String,
    pub links: Vec<String>,
    pub status: String,
}

/// Create a sample request input.
pub fn sample_request(title: impl Into<String>) -> CreateRequestInput {
    CreateRequestInput {
        request: RequestData {
            title: title.into(),
            description: "This is a sample request description".to_string(),
            contact_preference: "Email".to_string(),
            date_range: None,
            time_estimate_hours: Some(5.0),
            time_preference: "Morning".to_string(),
            time_zone: Some("UTC-5".to_string()),
            interaction_type: "Virtual".to_string(),
            links: vec!["https://example.com/resource".to_string()],
            status: "Active".to_string(),
        },
        organization: None,
        service_type_hashes: vec![],
        medium_of_exchange_hashes: vec![],
    }
}

// ── Offer fixtures ────────────────────────────────────────────

/// Input for `create_offer` zome call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateOfferInput {
    pub offer: OfferData,
    pub organization: Option<ActionHash>,
    pub service_type_hashes: Vec<ActionHash>,
    pub medium_of_exchange_hashes: Vec<ActionHash>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfferData {
    pub title: String,
    pub description: String,
    pub time_preference: String,
    pub time_zone: Option<String>,
    pub interaction_type: String,
    pub links: Vec<String>,
    pub status: String,
}

/// Create a sample offer input.
pub fn sample_offer(title: impl Into<String>) -> CreateOfferInput {
    CreateOfferInput {
        offer: OfferData {
            title: title.into(),
            description: "This is a sample offer description".to_string(),
            time_preference: "Afternoon".to_string(),
            time_zone: Some("UTC-5".to_string()),
            interaction_type: "Virtual".to_string(),
            links: vec!["https://example.com/resource".to_string()],
            status: "Active".to_string(),
        },
        organization: None,
        service_type_hashes: vec![],
        medium_of_exchange_hashes: vec![],
    }
}

// ── Medium of Exchange fixtures ───────────────────────────────

/// Input for `suggest_medium_of_exchange` zome call.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediumOfExchangeInputWrapper {
    pub medium_of_exchange: MediumOfExchangeData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediumOfExchangeData {
    pub code: String,
    pub name: String,
    pub exchange_type: String,
    pub resource_spec_hrea_id: Option<String>,
}

/// Create a sample medium of exchange input.
pub fn sample_medium_of_exchange(
    code: impl Into<String>,
    name: impl Into<String>,
) -> MediumOfExchangeInputWrapper {
    MediumOfExchangeInputWrapper {
        medium_of_exchange: MediumOfExchangeData {
            code: code.into(),
            name: name.into(),
            exchange_type: "currency".to_string(),
            resource_spec_hrea_id: None,
        },
    }
}
