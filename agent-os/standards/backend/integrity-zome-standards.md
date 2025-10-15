# Integrity Zome Validation Standards

This document defines the standards and patterns for integrity zome development in the requests-and-offers project. Integrity zomes are responsible for validation rules, entry definitions, and maintaining data consistency across the Holochain DHT.

## Core Principles

### Validation Authority
- **Single Source of Truth**: Integrity zomes define the canonical validation rules
- **Deterministic Validation**: All validation functions must produce consistent results
- **Referential Integrity**: Ensure all relationships are valid and maintainable
- **Business Rule Enforcement**: Implement domain-specific validation logic

### Validation Categories
1. **Structural Validation**: Entry type definitions and field constraints
2. **Business Logic Validation**: Domain-specific rules and constraints
3. **Link Validation**: Relationship constraints and referential integrity
4. **Authorization Validation**: Permission checks and access control

## Zome Structure Standards

### Directory Organization
```
dnas/requests_and_offers/zomes/integrity/
├── requests_integrity/
│   ├── src/
│   │   ├── lib.rs          # Module declarations and exports
│   │   ├── entries.rs      # Entry type definitions
│   │   ├── validation.rs   # Validation functions
│   │   ├── links.rs        # Link type definitions
│   │   └── errors.rs       # Validation error types
│   └── Cargo.toml
├── service_types_integrity/
│   └── ...
└── common_integrity/       # Shared validation logic
    ├── src/
    │   ├── lib.rs
    │   ├── validators.rs   # Common validation utilities
    │   └── constraints.rs  # Shared constraint definitions
    └── Cargo.toml
```

### Module Declaration Pattern
```rust
// requests_integrity/src/lib.rs
use hdk::prelude::*;
use hdk_hash_helper::*;

pub mod entries;
pub mod validation;
pub mod links;
pub mod errors;

// Re-export for external use
pub use entries::*;
pub use validation::*;
pub use links::*;
pub use errors::*;
```

## Entry Type Standards

### Entry Definition Structure
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceType {
    pub name: String,
    pub description: Option<String>,
    pub status: ServiceTypeStatus,
    pub category: ServiceTypeCategory,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ServiceTypeStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ServiceTypeCategory {
    Technical,
    Creative,
    Professional,
    General,
}

// Entry type definition with validation constraints
entry_def!(ServiceType EntryDef {
    required_validations: 5,
    required_permissions: [],
    fields: [
        name::<String>(Required),
        description::<String>(Optional),
        status::<ServiceTypeStatus>(Required),
        category::<ServiceTypeCategory>(Required)
    ]
});
```

### Entry Validation Constraints
```rust
impl ServiceType {
    pub fn validate(&self) -> Result<(), ServiceTypeError> {
        // Name validation
        if self.name.is_empty() {
            return Err(ServiceTypeError::ValidationError(
                "Service type name cannot be empty".to_string()
            ));
        }

        if self.name.len() > 100 {
            return Err(ServiceTypeError::ValidationError(
                "Service type name cannot exceed 100 characters".to_string()
            ));
        }

        // Description validation
        if let Some(ref description) = self.description {
            if description.len() > 1000 {
                return Err(ServiceTypeError::ValidationError(
                    "Description cannot exceed 1000 characters".to_string()
                ));
            }
        }

        // Category-specific validation
        match self.category {
            ServiceTypeCategory::Technical => {
                // Additional technical category constraints
                if !self.name.to_lowercase().contains("service") {
                    return Err(ServiceTypeError::ValidationError(
                        "Technical service types must include 'service' in name".to_string()
                    ));
                }
            },
            _ => {} // No additional constraints for other categories
        }

        Ok(())
    }
}
```

## Validation Function Patterns

### Create Validation Standard
```rust
#[hdk_extern]
pub fn validate_create_entry_service_type(validate_data: ValidateCreateEntryData) -> ExternResult<ValidateCallbackResult> {
    let entry = match ServiceType::try_from(&validate_data.app_entry) {
        Ok(entry) => entry,
        Err(e) => return Ok(ValidateCallbackResult::Invalid(e.to_string())),
    };

    // Run structured validation
    match entry.validate() {
        Ok(_) => Ok(ValidateCallbackResult::Valid),
        Err(e) => Ok(ValidateCallbackResult::Invalid(e.to_string())),
    }
}
```

### Update Validation Standard
```rust
#[hdk_extern]
pub fn validate_update_entry_service_type(validate_data: ValidateUpdateEntryData) -> ExternResult<ValidateCallbackResult> {
    let original_entry: ServiceType = match ServiceType::try_from(&validate_data.original_app_entry) {
        Ok(entry) => entry,
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to deserialize original entry: {}", e))),
    };

    let updated_entry: ServiceType = match ServiceType::try_from(&validate_data.updated_app_entry) {
        Ok(entry) => entry,
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to deserialize updated entry: {}", e))),
    };

    // Validate updated entry structure
    match updated_entry.validate() {
        Ok(_) => {},
        Err(e) => return Ok(ValidateCallbackResult::Invalid(e.to_string())),
    }

    // Business rule validation for updates
    if original_entry.status == ServiceTypeStatus::Approved {
        // Approved service types cannot have name changed
        if original_entry.name != updated_entry.name {
            return Ok(ValidateCallbackResult::Invalid(
                "Cannot change name of approved service type".to_string()
            ));
        }
    }

    // Status transition validation
    if !is_valid_status_transition(&original_entry.status, &updated_entry.status) {
        return Ok(ValidateCallbackResult::Invalid(
            format!("Invalid status transition from {:?} to {:?}", original_entry.status, updated_entry.status)
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}

fn is_valid_status_transition(from: &ServiceTypeStatus, to: &ServiceTypeStatus) -> bool {
    match (from, to) {
        // Pending can transition to any state
        (ServiceTypeStatus::Pending, _) => true,
        // Approved can only transition to rejected
        (ServiceTypeStatus::Approved, ServiceTypeStatus::Rejected) => true,
        // Rejected can only transition to approved
        (ServiceTypeStatus::Rejected, ServiceTypeStatus::Approved) => true,
        // Same status is always valid
        (a, b) if a == b => true,
        // All other transitions are invalid
        _ => false,
    }
}
```

### Delete Validation Standard
```rust
#[hdk_extern]
pub fn validate_delete_entry_service_type(validate_data: ValidateDeleteEntryData) -> ExternResult<ValidateCallbackResult> {
    // Get the entry to check business rules
    let record = match get_latest_record(validate_data.original_action_hash.clone()) {
        Ok(Some(record)) => record,
        Ok(None) => return Ok(ValidateCallbackResult::Invalid("Record not found".to_string())),
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to get record: {}", e))),
    };

    let service_type: ServiceType = match ServiceType::try_from(record.entry().as_option()
        .ok_or("Entry not found")?) {
        Ok(service_type) => service_type,
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to deserialize entry: {}", e))),
    };

    // Business rule: Approved service types cannot be deleted
    if service_type.status == ServiceTypeStatus::Approved {
        return Ok(ValidateCallbackResult::Invalid(
            "Cannot delete approved service type".to_string()
        ));
    }

    // Check for existing relationships
    let links = get_links(
        GetLinksInputBuilder::try_new(
            validate_data.original_action_hash.clone(),
            LinkTypes::ServiceTypeToRequest
        )?.build()
    )?;

    if !links.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "Cannot delete service type with existing requests".to_string()
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
```

## Link Validation Standards

### Link Type Definitions
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum LinkTypes {
    // Service Type relationships
    ServiceTypeToRequest,
    RequestToServiceType,

    // User relationships
    UserToRequest,
    UserToOffer,
    OrganizationToUser,

    // Hierarchical relationships
    ParentCategoryToChild,
    ChildToParentCategory,
}
```

### Link Validation Pattern
```rust
#[hdk_extern]
pub fn validate_create_link_service_type_to_request(validate_data: ValidateCreateLinkData) -> ExternResult<ValidateCallbackResult> {
    // Validate link tag structure
    let _link_tag = match LinkTag::try_from(validate_data.tag.clone()) {
        Ok(tag) => tag,
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Invalid link tag: {}", e))),
    };

    // Validate source entry exists and is a service type
    let source_record = match get_latest_record(validate_data.base_address.clone()) {
        Ok(Some(record)) => record,
        Ok(None) => return Ok(ValidateCallbackResult::Invalid("Source record not found".to_string())),
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to get source record: {}", e))),
    };

    // Verify source is service type
    if let Err(_) = ServiceType::try_from(source_record.entry().as_option()
        .ok_or("Entry not found")?) {
        return Ok(ValidateCallbackResult::Invalid(
            "Source must be a service type".to_string()
        ));
    }

    // Validate target entry exists and is a request
    let target_record = match get_latest_record(validate_data.target_address.clone()) {
        Ok(Some(record)) => record,
        Ok(None) => return Ok(ValidateCallbackResult::Invalid("Target record not found".to_string())),
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to get target record: {}", e))),
    };

    // Verify target is request
    if let Err(_) = Request::try_from(target_record.entry().as_option()
        .ok_or("Entry not found")?) {
        return Ok(ValidateCallbackResult::Invalid(
            "Target must be a request".to_string()
        ));
    }

    // Business rule: Only approved service types can be linked to requests
    let service_type: ServiceType = ServiceType::try_from(source_record.entry().as_option()
        .ok_or("Entry not found")?)?;

    if service_type.status != ServiceTypeStatus::Approved {
        return Ok(ValidateCallbackResult::Invalid(
            "Only approved service types can be linked to requests".to_string()
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
```

### Link Delete Validation
```rust
#[hdk_extern]
pub fn validate_delete_link_service_type_to_request(validate_data: ValidateDeleteLinkData) -> ExternResult<ValidateCallbackResult> {
    // Get the original link to validate business rules
    let link = match get_link(validate_data.link_add_address.clone()) {
        Ok(Some(link)) => link,
        Ok(None) => return Ok(ValidateCallbackResult::Invalid("Link not found".to_string())),
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to get link: {}", e))),
    };

    // Get the target request to check business rules
    let target_record = match get_latest_record(link.target) {
        Ok(Some(record)) => record,
        Ok(None) => return Ok(ValidateCallbackResult::Invalid("Target record not found".to_string())),
        Err(e) => return Ok(ValidateCallbackResult::Invalid(format!("Failed to get target record: {}", e))),
    };

    let request: Request = Request::try_from(target_record.entry().as_option()
        .ok_or("Entry not found")?)?;

    // Business rule: Cannot unlink service type from active requests
    if request.status != RequestStatus::Completed {
        return Ok(ValidateCallbackResult::Invalid(
            "Cannot unlink service type from active request".to_string()
        ));
    }

    Ok(ValidateCallbackResult::Valid)
}
```

## Error Handling Standards

### Domain-Specific Error Types
```rust
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ServiceTypeError {
    ValidationError(String),
    BusinessRuleViolation(String),
    ReferenceConstraintViolation(String),
    AuthorizationError(String),
    SerializationError(String),
}

impl std::fmt::Display for ServiceTypeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServiceTypeError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            ServiceTypeError::BusinessRuleViolation(msg) => write!(f, "Business rule violation: {}", msg),
            ServiceTypeError::ReferenceConstraintViolation(msg) => write!(f, "Reference constraint violation: {}", msg),
            ServiceTypeError::AuthorizationError(msg) => write!(f, "Authorization error: {}", msg),
            ServiceTypeError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}

impl std::error::Error for ServiceTypeError {}
```

### Common Validation Utilities
```rust
// common_integrity/src/validators.rs
pub struct StringValidator;

impl StringValidator {
    pub fn validate_non_empty(value: &str, field_name: &str) -> Result<(), String> {
        if value.trim().is_empty() {
            return Err(format!("{} cannot be empty", field_name));
        }
        Ok(())
    }

    pub fn validate_length(value: &str, min: usize, max: usize, field_name: &str) -> Result<(), String> {
        if value.len() < min {
            return Err(format!("{} must be at least {} characters", field_name, min));
        }
        if value.len() > max {
            return Err(format!("{} cannot exceed {} characters", field_name, max));
        }
        Ok(())
    }

    pub fn validate_pattern(value: &str, pattern: &str, field_name: &str) -> Result<(), String> {
        let regex = regex::Regex::new(pattern).map_err(|e| format!("Invalid regex pattern: {}", e))?;
        if !regex.is_match(value) {
            return Err(format!("{} does not match required pattern", field_name));
        }
        Ok(())
    }
}

pub struct BusinessRuleValidator;

impl BusinessRuleValidator {
    pub fn validate_unique_field<T>(
        value: &T,
        entry_type: EntryType,
        hash_converter: impl Fn(&T) -> Result<EntryHash, WasmError>,
    ) -> Result<(), String>
    where
        T: Serialize + PartialEq,
    {
        let entry_hash = hash_converter(value).map_err(|e| format!("Failed to create entry hash: {}", e))?;

        // Check if entry already exists (this would require chain query capability)
        // For now, this is a placeholder for the validation pattern
        Ok(())
    }
}
```

## Testing Standards

### Validation Test Structure
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::errors::ServiceTypeError;

    #[test]
    fn test_service_type_validation_success() {
        let service_type = ServiceType {
            name: "Web Development Service".to_string(),
            description: Some("Professional web development services".to_string()),
            status: ServiceTypeStatus::Pending,
            category: ServiceTypeCategory::Technical,
        };

        assert!(service_type.validate().is_ok());
    }

    #[test]
    fn test_service_type_validation_empty_name() {
        let service_type = ServiceType {
            name: "".to_string(),
            description: Some("Test description".to_string()),
            status: ServiceTypeStatus::Pending,
            category: ServiceTypeCategory::General,
        };

        match service_type.validate() {
            Err(ServiceTypeError::ValidationError(msg)) => {
                assert!(msg.contains("name cannot be empty"));
            },
            _ => panic!("Expected validation error for empty name"),
        }
    }

    #[test]
    fn test_service_type_validation_name_too_long() {
        let service_type = ServiceType {
            name: "A".repeat(101),
            description: None,
            status: ServiceTypeStatus::Pending,
            category: ServiceTypeCategory::General,
        };

        match service_type.validate() {
            Err(ServiceTypeError::ValidationError(msg)) => {
                assert!(msg.contains("cannot exceed 100 characters"));
            },
            _ => panic!("Expected validation error for name too long"),
        }
    }

    #[test]
    fn test_valid_status_transitions() {
        assert!(is_valid_status_transition(&ServiceTypeStatus::Pending, &ServiceTypeStatus::Approved));
        assert!(is_valid_status_transition(&ServiceTypeStatus::Pending, &ServiceTypeStatus::Rejected));
        assert!(is_valid_status_transition(&ServiceTypeStatus::Approved, &ServiceTypeStatus::Rejected));
        assert!(is_valid_status_transition(&ServiceTypeStatus::Rejected, &ServiceTypeStatus::Approved));
        assert!(is_valid_status_transition(&ServiceTypeStatus::Approved, &ServiceTypeStatus::Approved));
    }

    #[test]
    fn test_invalid_status_transitions() {
        assert!(!is_valid_status_transition(&ServiceTypeStatus::Approved, &ServiceTypeStatus::Pending));
        assert!(!is_valid_status_transition(&ServiceTypeStatus::Rejected, &ServiceTypeStatus::Pending));
        assert!(!is_valid_status_transition(&ServiceTypeStatus::Rejected, &ServiceTypeStatus::Rejected));
    }
}
```

## Performance Considerations

### Efficient Validation Patterns
1. **Early Returns**: Fail fast on obvious validation errors
2. **Minimal Queries**: Avoid unnecessary DHT queries in validation
3. **Caching**: Cache frequently accessed validation data
4. **Batch Validation**: Validate multiple constraints in single pass

### Resource Management
```rust
// Efficient validation with minimal queries
impl ServiceType {
    pub fn validate_efficiently(&self, existing_links: Option<Vec<Link>>) -> Result<(), ServiceTypeError> {
        // Structural validation first (no DHT queries)
        self.validate()?;

        // Business validation with provided data (avoid additional queries)
        if let Some(links) = existing_links {
            if self.status == ServiceTypeStatus::Approved && !links.is_empty() {
                return Err(ServiceTypeError::BusinessRuleViolation(
                    "Cannot approve service type with existing relationships".to_string()
                ));
            }
        }

        Ok(())
    }
}
```

## Best Practices Summary

### ✅ **DO:**
- Implement comprehensive validation for all entry types
- Use structured error types with clear messages
- Validate business rules in addition to data structure
- Check referential integrity for all relationships
- Write thorough tests for all validation scenarios
- Use early returns for efficient validation
- Document all business rules clearly

### ❌ **DON'T:**
- Skip validation for "simple" fields
- Return generic validation errors without context
- Assume coordinator zome will handle validation
- Allow circular references in link validation
- Use string-based validation without clear rules
- Perform expensive DHT queries unnecessarily
- Mix validation logic with business logic

### **Validation Hierarchy:**
1. **Structural**: Data types and field constraints
2. **Semantic**: Business rules and domain constraints
3. **Referential**: Relationship integrity
4. **Authorization**: Permission validation

These standards ensure consistent, reliable validation across all integrity zomes in the requests-and-offers project.