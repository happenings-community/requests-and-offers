# Backend Entry Types API

Complete reference for all Holochain entry types and data structures.

## Entry Type Architecture

All entry types follow consistent patterns for serialization, validation, and relationships.

### Base Entry Pattern

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct BaseEntity {
    pub name: String,
    pub description: String,
    pub status: EntityStatus,
    pub created_at: Timestamp,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum EntityStatus {
    Pending,
    Approved,
    Rejected,
}
```

## Service Types Entry

**File**: `dnas/requests_and_offers/zomes/integrity/service_types/src/lib.rs`

### ServiceType Entry

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
    pub status: ServiceTypeStatus,
    pub created_at: Timestamp,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ServiceTypeStatus {
    Pending,
    Approved,
    Rejected,
}
```

### Input Types

```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct CreateServiceTypeInput {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateServiceTypeInput {
    pub original_action_hash: OriginalActionHash,
    pub previous_action_hash: PreviousActionHash,
    pub updated_service_type: ServiceType,
}
```

## Request Entry

**File**: `dnas/requests_and_offers/zomes/integrity/requests/src/lib.rs`

### Request Entry

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Request {
    pub title: String,
    pub description: String,
    pub service_type_hash: ActionHash,
    pub urgency: UrgencyLevel,
    pub time_preference: TimePreference,
    pub interaction_type: InteractionType,
    pub status: RequestStatus,
    pub created_at: Timestamp,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum RequestStatus {
    Open,
    InProgress,
    Fulfilled,
    Closed,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum UrgencyLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TimePreference {
    ASAP,
    Flexible,
    Specific(Timestamp),
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InteractionType {
    InPerson,
    Remote,
    Hybrid,
}
```

## Offer Entry

**File**: `dnas/requests_and_offers/zomes/integrity/offers/src/lib.rs`

### Offer Entry

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Offer {
    pub title: String,
    pub description: String,
    pub service_type_hash: ActionHash,
    pub time_preference: TimePreference,
    pub interaction_type: InteractionType,
    pub availability: Availability,
    pub status: OfferStatus,
    pub created_at: Timestamp,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum OfferStatus {
    Available,
    Accepted,
    Completed,
    Closed,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Availability {
    pub start_date: Option<Timestamp>,
    pub end_date: Option<Timestamp>,
    pub hours_per_week: Option<u32>,
}
```

## User Profile Entry

**File**: `dnas/requests_and_offers/zomes/integrity/users/src/lib.rs`

### UserProfile Entry

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct UserProfile {
    pub username: String,
    pub display_name: String,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
    pub skills: Vec<String>,
    pub interests: Vec<String>,
    pub location: Option<String>,
    pub contact_info: ContactInfo,
    pub created_at: Timestamp,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct ContactInfo {
    pub email: Option<String>,
    pub website: Option<String>,
    pub social_links: Vec<SocialLink>,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct SocialLink {
    pub platform: String,
    pub url: String,
}
```

## Organization Entry

**File**: `dnas/requests_and_offers/zomes/integrity/organizations/src/lib.rs`

### Organization Entry

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Organization {
    /// Display name of the organization
    pub name: String,

    /// Organization's vision and mission statement (UI: "Vision/Mission")
    pub description: String,

    /// Full legal name for business registration compliance
    pub full_legal_name: String,

    /// Optional organization logo (serialized)
    pub logo: Option<SerializedBytes>,

    /// Contact email for the organization
    pub email: String,

    /// Related URLs (website, social media, etc.)
    pub urls: Vec<String>,

    /// Organization's location
    pub location: String,
}
```

**Note**: Organization contact person designation is handled through the `OrganizationContacts` link type (not an entry). See [link-types.md](link-types.md) for details.

## Administration Entries

**File**: `dnas/requests_and_offers/zomes/integrity/administration/src/lib.rs`

### AdminRole Entry

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct AdminRole {
    pub agent: AgentPubKey,
    pub role_type: RoleType,
    pub granted_by: AgentPubKey,
    pub granted_at: Timestamp,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum RoleType {
    Administrator,
    Moderator,
}
```

### UserSuspension Entry

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct UserSuspension {
    pub suspended_agent: AgentPubKey,
    pub reason: String,
    pub suspended_by: AgentPubKey,
    pub suspended_at: Timestamp,
    pub suspension_end: Option<Timestamp>,
    pub is_active: bool,
}
```

## Validation Rules

### Field Validation

```rust
// Example validation for ServiceType
pub fn validate_service_type(service_type: &ServiceType) -> ExternResult<ValidateCallbackResult> {
    // Name validation
    if service_type.name.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Name cannot be empty".to_string()));
    }

    if service_type.name.len() > 100 {
        return Ok(ValidateCallbackResult::Invalid("Name too long".to_string()));
    }

    // Description validation
    if service_type.description.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Description cannot be empty".to_string()));
    }

    // Tags validation
    if service_type.tags.is_empty() {
        return Ok(ValidateCallbackResult::Invalid("At least one tag required".to_string()));
    }

    Ok(ValidateCallbackResult::Valid)
}
```

### Status Transition Validation

```rust
pub fn validate_status_transition(
    old_status: &EntityStatus,
    new_status: &EntityStatus
) -> ExternResult<ValidateCallbackResult> {
    match (old_status, new_status) {
        (EntityStatus::Pending, EntityStatus::Approved) => Ok(ValidateCallbackResult::Valid),
        (EntityStatus::Pending, EntityStatus::Rejected) => Ok(ValidateCallbackResult::Valid),
        (EntityStatus::Approved, EntityStatus::Rejected) => Ok(ValidateCallbackResult::Valid),
        (EntityStatus::Rejected, EntityStatus::Approved) => Ok(ValidateCallbackResult::Valid),
        _ => Ok(ValidateCallbackResult::Invalid("Invalid status transition".to_string())),
    }
}
```

## Entry Relationships

### Service Type → Request/Offer

```rust
// Requests and offers reference service types
pub struct Request {
    pub service_type_hash: ActionHash, // References ServiceType entry
    // ... other fields
}
```

### User → Organization

```rust
// Organizations maintain member relationships through links
// Links created between Organization entry and UserProfile entries
```

### Cross-Domain References

Entry types maintain relationships through ActionHash references and link structures, enabling rich domain interactions while maintaining data integrity.

This entry type reference provides the complete data structure definitions for the Holochain application.
