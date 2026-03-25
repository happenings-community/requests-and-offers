//! Mirror structs for coordinator output types.
//!
//! Coordinator crates cannot be imported directly because they depend on `hdk`
//! which requires a WASM target.  Integrity crates cannot be linked together
//! because each emits C-level `__num_entry_types` / `__num_link_types` symbols
//! that conflict when multiple integrity crates are linked into one binary.
//!
//! These lightweight mirror structs replicate the serialisation shape so
//! Sweettest can deserialize zome call responses without importing any
//! integrity crate.

use holochain::prelude::*;
use serde::{Deserialize, Serialize};

// ── User mirrors ─────────────────────────────────────────────

/// Mirror of `User` from `users_organizations_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct User {
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
holochain_serialized_bytes::holochain_serial!(User);

// ── Organization mirrors ─────────────────────────────────────

/// Mirror of `Organization` from `users_organizations_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Organization {
    pub name: String,
    pub description: String,
    pub full_legal_name: String,
    pub logo: Option<SerializedBytes>,
    pub email: String,
    pub urls: Vec<String>,
    pub location: String,
}
holochain_serialized_bytes::holochain_serial!(Organization);

// ── Administration mirrors ───────────────────────────────────

/// Mirror of `Status` from `administration_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Status {
    pub status_type: String,
    pub reason: Option<String>,
    pub suspended_until: Option<String>,
}
holochain_serialized_bytes::holochain_serial!(Status);

// ── Service Type mirrors ──────────────────────────────────────

/// Mirror of `ServiceType` from `service_types_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ServiceType {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub verified: bool,
}
holochain_serialized_bytes::holochain_serial!(ServiceType);

// ── Request mirrors ───────────────────────────────────────────

/// Mirror of `Request` from `requests_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Request {
    pub title: String,
    pub description: String,
    pub contact_preference: String,
    pub date_range: Option<DateRange>,
    pub time_estimate_hours: Option<f64>,
    pub time_preference: String,
    pub time_zone: Option<String>,
    pub interaction_type: String,
    pub links: Vec<String>,
    pub status: String,
}
holochain_serialized_bytes::holochain_serial!(Request);

/// Mirror of `DateRange` from `requests_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DateRange {
    pub start: Option<i64>,
    pub end: Option<i64>,
}

// ── Offer mirrors ─────────────────────────────────────────────

/// Mirror of `Offer` from `offers_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Offer {
    pub title: String,
    pub description: String,
    pub time_preference: String,
    pub time_zone: Option<String>,
    pub interaction_type: String,
    pub links: Vec<String>,
    pub status: String,
}
holochain_serialized_bytes::holochain_serial!(Offer);

// ── Medium of Exchange mirrors ────────────────────────────────

/// Mirror of `MediumOfExchange` from `mediums_of_exchange_integrity`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediumOfExchange {
    pub code: String,
    pub name: String,
    pub resource_spec_hrea_id: Option<String>,
}
holochain_serialized_bytes::holochain_serial!(MediumOfExchange);
