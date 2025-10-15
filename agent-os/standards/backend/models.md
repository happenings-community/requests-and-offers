# Holochain Entry Models & Data Structures

This document defines the standards and patterns for Holochain entry models, data structures, and type definitions in the requests-and-offers project.

## Core Principles

### Holochain-Specific Modeling
- **No Foreign Keys**: Use Holochain's link system instead of storing relationship IDs in entry data
- **Action Timestamps**: Rely on Holochain Action headers for timestamps, not entry fields
- **Entry Immutability**: Entries are immutable - all updates create new Action records
- **Link-Based Relationships**: Use `create_link()` for all entity relationships
- **Validation at Integrity Zomes**: Enforce data rules in integrity zomes, not just coordinators

### Data Structure Standards
- **Clear Type Definitions**: Use strongly-typed Rust structs with proper validation
- **Branded Types**: Create branded types for domain entities to prevent type confusion
- **Optional Fields**: Use Option<T> for truly optional data, not empty strings
- **Enumerations**: Use enums for status fields and other discrete value sets
- **Versioning**: Consider entry versioning for schema evolution

## Entry Type Patterns

### Standard Entry Definition Structure
```rust
// Coordinator zome - business logic and API
use hdk::prelude::*;
use crate::integrity::entries::*;
use crate::integrity::errors::*;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceType {
    pub name: String,
    pub description: Option<String>,
    pub status: ServiceTypeStatus,
    pub category: ServiceTypeCategory,
    pub technical: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ServiceTypeStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ServiceTypeCategory {
    Technical,
    Creative,
    Professional,
    General,
}

// Entry type definition
entry_def!(ServiceType EntryDef {
    required_validations: 3,
    required_permissions: [],
    fields: [
        name::<String>(Required),
        description::<String>(Optional),
        status::<ServiceTypeStatus>(Required),
        category::<ServiceTypeCategory>(Required),
        technical::<bool>(Required)
    ]
});
```

### Timestamp Handling Pattern
```rust
// ❌ WRONG: Don't store timestamps in entry data
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BadServiceType {
    pub name: String,
    pub created_at: u64,  // WRONG: Don't do this
    pub updated_at: u64,  // WRONG: Don't do this
}

// ✅ CORRECT: Use Action headers for timestamps
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceType {
    pub name: String,
    pub description: Option<String>,
    pub status: ServiceTypeStatus,
    // No timestamp fields here
}

// Helper function to extract timestamps from Action headers
pub fn extract_service_type_timestamps(record: &Record) -> Result<(u64, u64), ZomeError> {
    let created_at = record.action().timestamp();

    let updated_at = match record.action() {
        Action::Update(update_action) => update_action.timestamp,
        Action::Create(_) => created_at, // For creates, updated_at = created_at
        Action::Delete(delete_action) => delete_action.timestamp,
    };

    Ok((created_at, updated_at))
}

// UI helper structure that includes timestamps
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeWithTimestamps {
    pub service_type: ServiceType,
    pub created_at: u64,
    pub updated_at: u64,
    pub action_hash: ActionHash,
}
```

### Relationship Modeling Pattern
```rust
// ❌ WRONG: Don't store foreign keys in entry data
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BadRequest {
    pub title: String,
    pub service_type_hash: ActionHash,  // WRONG: Don't store relationships
    pub owner_hash: ActionHash,        // WRONG: Don't store relationships
}

// ✅ CORRECT: Use links for relationships
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Request {
    pub title: String,
    pub description: String,
    pub contact_preference: ContactPreference,
    pub time_preference: TimePreference,
    pub time_zone: String,
    pub interaction_type: InteractionType,
    // No relationship fields here
}

// Link types for relationships
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum LinkTypes {
    // User relationships
    UserToRequest,
    UserToOffer,
    UserToOrganization,
    OrganizationToUser,

    // Service type relationships
    ServiceTypeToRequest,
    RequestToServiceType,
    ServiceTypeToOffer,
    OfferToServiceType,

    // Organization relationships
    OrganizationToRequest,
    RequestToOrganization,
    OrganizationToOffer,
    OfferToOrganization,

    // Status relationships
    UserStatus,
    OrganizationStatus,
    ServiceTypeStatus,
    RequestStatus,
    OfferStatus,
}

// Link creation function
pub fn create_request_service_type_link(
    request_hash: ActionHash,
    service_type_hash: ActionHash,
) -> ExternResult<()> {
    create_link(
        request_hash,
        service_type_hash,
        &LinkTypes::RequestToServiceType,
        LinkTag::new(())
    )?;

    // Optional: Create reverse link for bidirectional queries
    create_link(
        service_type_hash,
        request_hash,
        &LinkTypes::ServiceTypeToRequest,
        LinkTag::new(())
    )?;

    Ok(())
}
```

## Type Safety and Validation

### Branded Types Pattern
```rust
use hdk::prelude::*;
use serde::{Deserialize, Serialize};

// Branded type for ActionHash to prevent confusion
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RequestActionHash(ActionHash);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ServiceTypeActionHash(ActionHash);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UserActionHash(ActionHash);

// Conversion functions with validation
impl TryFrom<&[Hash> for RequestActionHash {
    type Error = ZomeError;

    fn try_from(hash: &Hash) -> Result<Self, Self::Error> {
        Ok(Self(hash.clone()))
    }
}

// Use in zome functions
#[hdk_extern]
pub fn create_request(
    request: Request,
    owner_hash: UserActionHash,
) -> ExternResult<ActionHash> {
    // Convert branded type back to ActionHash for Holochain
    let owner_action_hash: ActionHash = owner_hash.0;

    let action_hash = create_entry(&EntryTypesApp::Request(request))?;
    let record = create_record(&Postulate {
        entry_type: EntryTypesApp::Request,
        entry: request,
    })?;

    // Create link to owner
    create_link(
        owner_action_hash,
        record.signed_action.hashed.hash,
        &LinkTypes::UserToRequest,
        LinkTag::new(())
    )?;

    Ok(record.signed_action.hashed.hash)
}
```

### Validation Helper Functions
```rust
use crate::integrity::errors::*;

pub struct ServiceTypeValidator;

impl ServiceTypeValidator {
    pub fn validate_name(name: &str) -> Result<(), ServiceTypeError> {
        if name.trim().is_empty() {
            return Err(ServiceTypeError::ValidationError(
                "Service type name cannot be empty".to_string()
            ));
        }

        if name.len() > 100 {
            return Err(ServiceTypeError::ValidationError(
                "Service type name cannot exceed 100 characters".to_string()
            ));
        }

        if name.contains(|c: char| c.is_control()) {
            return Err(ServiceTypeError::ValidationError(
                "Service type name contains invalid characters".to_string()
            ));
        }

        Ok(())
    }

    pub fn validate_description(description: &Option<String>) -> Result<(), ServiceTypeError> {
        if let Some(desc) = description {
            if desc.len() > 1000 {
                return Err(ServiceTypeError::ValidationError(
                    "Description cannot exceed 1000 characters".to_string()
                ));
            }
        }
        Ok(())
    }

    pub fn validate_category_specific_rules(
        service_type: &ServiceType
    ) -> Result<(), ServiceTypeError> {
        match service_type.category {
            ServiceTypeCategory::Technical => {
                if !service_type.name.to_lowercase().contains("service") {
                    return Err(ServiceTypeError::ValidationError(
                        "Technical service types must include 'service' in the name".to_string()
                    ));
                }
            },
            ServiceTypeCategory::Creative => {
                // Creative category-specific validation
            },
            ServiceTypeCategory::Professional => {
                // Professional category-specific validation
            },
            ServiceTypeCategory::General => {
                // General category validation
            }
        }
        Ok(())
    }
}

// Comprehensive validation function
impl ServiceType {
    pub fn validate(&self) -> Result<(), ServiceTypeError> {
        // Validate name
        Self::Validator::validate_name(&self.name)?;

        // Validate description
        Self::Validator::validate_description(&self.description)?;

        // Validate category-specific rules
        Self::Validator::validate_category_specific_rules(self)?;

        Ok(())
    }
}
```

## Schema Evolution

### Entry Versioning Pattern
```rust
// Version 1 entry type
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeV1 {
    pub name: String,
    pub description: Option<String>,
    pub status: ServiceTypeStatus,
    pub technical: bool,
}

// Version 2 entry type with new field
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeV2 {
    pub name: String,
    pub description: Option<String>,
    pub status: ServiceTypeStatus,
    pub technical: bool,
    pub category: ServiceTypeCategory, // New field
    pub tags: Vec<String>,            // New field
}

// Entry type that handles both versions
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum ServiceTypeEntry {
    V1(ServiceTypeV1),
    V2(ServiceTypeV2),
}

// Migration helper
impl ServiceTypeV1 {
    pub fn migrate_to_v2(self) -> ServiceTypeV2 {
        ServiceTypeV2 {
            name: self.name,
            description: self.description,
            status: self.status,
            technical: self.technical,
            category: if self.technical {
                ServiceTypeCategory::Technical
            } else {
                ServiceTypeCategory::General
            },
            tags: Vec::new(),
        }
    }
}

// Entry type definition supporting both versions
entry_def!(ServiceTypeEntry EntryDef {
    required_validations: 3,
    required_permissions: [],
    fields: [
        name::<String>(Required),
        description::<String>(Optional),
        status::<ServiceTypeStatus>(Required),
        technical::<bool>(Required),
        category::<ServiceTypeCategory>(Optional),
        tags::<Vec<String>>(Optional)
    ]
});
```

## Complex Data Structures

### Hierarchical Data Pattern
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Organization {
    pub name: String,
    pub description: String,
    pub parent_organization: Option<ActionHash>, // Hierarchical link
    pub members: Vec<String>,                   // For quick lookup
}

// Helper functions for hierarchical operations
pub struct OrganizationHierarchy;

impl OrganizationHierarchy {
    pub fn get_children(
        organization_hash: &ActionHash
    ) -> ExternResult<Vec<Record>> {
        let links = get_links(
            GetLinksInputBuilder::try_new(
                organization_hash.clone(),
                LinkTypes::OrganizationToOrganization
            )?
                .get_link_type(LinkTypes::OrganizationToOrganization)
                .build(),
        )?;

        let children: Result<Vec<_>, _> = links
            .into_iter()
            .map(|link| get_latest_record(link.target))
            .collect();

        children
    }

    pub fn get_parent(
        organization_hash: &ActionHash
    ) -> ExternResult<Option<Record>> {
        let links = get_links(
            GetLinksInputBuilder::try_new(
                organization_hash.clone(),
                LinkTypes::OrganizationToOrganization
            )?
                .get_link_type(LinkTypes::OrganizationToOrganization)
                .build(),
        )?;

        if let Some(link) = links.first() {
            // Reverse link - this is a child, find parent
            let reverse_links = get_links(
                GetLinksInputBuilder::try_new(
                    link.target.clone(),
                    LinkTypes::OrganizationToOrganization
                )?
                .get_link_type(LinkTypes::OrganizationToOrganization)
                .build(),
            );

            for reverse_link in reverse_links {
                if reverse_link.target == *organization_hash {
                    return get_latest_record(reverse_link.target);
                }
            }
        }

        Ok(None)
    }

    pub fn is_root_organization(
        organization_hash: &ActionHash
    ) -> ExternResult<bool> {
        Ok(Self::get_parent(organization_hash)?.is_none())
    }
}
```

### Status Workflow Pattern
```rust
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum WorkflowStatus {
    Draft,
    PendingReview,
    Approved,
    Active,
    Suspended,
    Closed,
    Rejected,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StatusTransition {
    pub from_status: WorkflowStatus,
    pub to_status: WorkflowStatus,
    pub reason: Option<String>,
    pub timestamp: u64,
    pub actor: ActionHash,
}

// Status transition validation
pub struct StatusTransitionRules;

impl StatusTransitionRules {
    pub fn is_valid_transition(
        from: WorkflowStatus,
        to: WorkflowStatus,
        actor_role: Option<&str>
    ) -> bool {
        match (from, to) {
            // Draft can transition to any status
            (WorkflowStatus::Draft, _) => true,

            // PendingReview can only transition to Approved or Rejected
            (WorkflowStatus::PendingReview, WorkflowStatus::Approved) => true,
            (WorkflowStatus::PendingReview, WorkflowStatus::Rejected) => true,

            // Approved can transition to Active or Rejected
            (WorkflowStatus::Approved, WorkflowStatus::Active) => true,
            (WorkflowStatus::Approved, WorkflowStatus::Rejected) => true,

            // Active can transition to Suspended or Closed
            (WorkflowStatus::Active, WorkflowStatus::Suspended) => true,
            (WorkflowStatus::Active, WorkflowStatus::Closed) => true,

            // Suspended can transition back to Active
            (WorkflowStatus::Suspended, WorkflowStatus::Active) => true,

            // Closed and Rejected are terminal states
            (WorkflowStatus::Closed, _) => false,
            (WorkflowStatus::Rejected, _) => false,

            // All other transitions are invalid
            _ => false,
        }
    }

    pub fn get_valid_transitions(
        current_status: WorkflowStatus
    ) -> Vec<WorkflowStatus> {
        match current_status {
            WorkflowStatus::Draft => vec![
                WorkflowStatus::PendingReview,
                WorkflowStatus::Approved,
                WorkflowStatus::Rejected,
            ],
            WorkflowStatus::PendingReview => vec![
                WorkflowStatus::Approved,
                WorkflowStatus::Rejected,
            ],
            WorkflowStatus::Approved => vec![
                WorkflowStatus::Active,
                WorkflowStatus::Rejected,
            ],
            WorkflowStatus::Active => vec![
                WorkflowStatus::Suspended,
                WorkflowStatus::Closed,
            ],
            WorkflowStatus::Suspended => vec![
                WorkflowStatus::Active,
            ],
            WorkflowStatus::Closed => vec![],
            WorkflowStatus::Rejected => vec![],
        }
    }
}
```

## Best Practices Summary

### ✅ **DO:**
- Use Action headers for timestamps, not entry fields
- Implement relationships with Holochain links
- Create strongly-typed Rust structs with validation
- Use Option<T> for truly optional fields
- Implement comprehensive validation in integrity zomes
- Use branded types for domain entities
- Plan for schema evolution with versioning
- Create helper functions for complex queries
- Define clear status transition rules

### ❌ **DON'T:**
- Store timestamps in entry data
- Store relationship IDs (foreign keys) in entries
- Use empty strings instead of Option<T>
- Put validation logic only in coordinator zomes
- Use raw ActionHash for domain logic
- Ignore schema evolution planning
- Create overly complex nested structures
- Allow arbitrary status transitions

### **Holochain-Specific Patterns:**
- Link creation for all relationships
- Action header timestamp extraction
- Entry immutability handling
- Integrity zome validation enforcement
- DHT-optimized query strategies
- Status management through links
- Hierarchical data with bidirectional links

These modeling patterns ensure robust, maintainable Holochain applications that leverage the unique strengths of distributed hash table technology while maintaining data integrity and type safety.