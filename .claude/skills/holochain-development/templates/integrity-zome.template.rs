/**
 * Template for Holochain integrity zomes
 * Copy this template and replace {{DOMAIN_NAME}} with your domain name
 */

use hdk::prelude::*;
use serde::{Deserialize, Serialize};

// Entry definitions for the DHT
#[hdk_entry_defs]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    {{DOMAIN_NAME}}({{DOMAIN_NAME}}),
}

// Link types for relationships
#[hdk_link_types]
pub enum LinkTypes {
    {{DOMAIN_NAME}}Update,
    {{DOMAIN_NAME}}ToRelatedEntity,
    All{{DOMAIN_NAME}}s,
}

// Main entry type
#[hdk_entry_helper]
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct {{DOMAIN_NAME}} {
    pub name: String,
    pub description: Option<String>,
    pub metadata: BTreeMap<String, String>,
    pub status: {{DOMAIN_NAME}}Status,
    pub created_by: ActionHash,
    pub created_at: i64,
}

// Status enumeration
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize, SerializedBytes)]
pub enum {{DOMAIN_NAME}}Status {
    Pending,
    Approved,
    Rejected { reason: Option<String> },
    Archived,
}

impl {{DOMAIN_NAME}} {
    pub fn new(name: String, description: Option<String>, created_by: ActionHash) -> Self {
        Self {
            name,
            description,
            metadata: BTreeMap::new(),
            status: {{DOMAIN_NAME}}Status::Pending,
            created_by,
            created_at: sys_time()?,
        }
    }

    pub fn approve(mut self) -> Self {
        self.status = {{DOMAIN_NAME}}Status::Approved;
        self
    }

    pub fn reject(mut self, reason: Option<String>) -> Self {
        self.status = {{DOMAIN_NAME}}Status::Rejected { reason };
        self
    }

    pub fn archive(mut self) -> Self {
        self.status = {{DOMAIN_NAME}}Status::Archived;
        self
    }

    pub fn is_active(&self) -> bool {
        !matches!(self.status, {{DOMAIN_NAME}}Status::Archived)
    }

    pub fn is_approved(&self) -> bool {
        matches!(self.status, {{DOMAIN_NAME}}Status::Approved)
    }

    pub fn is_rejected(&self) -> bool {
        matches!(self.status, {{DOMAIN_NAME}}Status::Rejected { .. })
    }

    pub fn is_pending(&self) -> bool {
        matches!(self.status, {{DOMAIN_NAME}}Status::Pending)
    }

    pub fn add_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
    }

    pub fn get_metadata(&self, key: &str) -> Option<&String> {
        self.metadata.get(key)
    }
}

// Validation functions
pub fn validate_create_{{domain_name}}(data: EntryValidationData<{{DOMAIN_NAME}}>) -> ExternResult<ValidateCallbackResult> {
    let entry = data.entry;

    // Validate name
    if entry.name.trim().is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Name cannot be empty".into()));
    }

    if entry.name.len() > 200 {
        return Ok(ValidateCallbackResult::Invalid("Name too long (max 200 characters)".into()));
    }

    // Validate description
    if let Some(description) = &entry.description {
        if description.trim().is_empty() {
            return Ok(ValidateCallbackResult::Invalid("Description cannot be empty string".into()));
        }

        if description.len() > 2000 {
            return Ok(ValidateCallbackResult::Invalid("Description too long (max 2000 characters)".into()));
        }
    }

    // Validate metadata size
    if entry.metadata.len() > 50 {
        return Ok(ValidateCallbackResult::Invalid("Too many metadata entries (max 50)".into()));
    }

    for (key, value) in &entry.metadata {
        if key.len() > 100 || value.len() > 500 {
            return Ok(ValidateCallbackResult::Invalid("Metadata key or value too long".into()));
        }
    }

    // Validate created_by is valid agent
    if entry.created_by != data.action.author {
        return Ok(ValidateCallbackResult::Invalid("Created by field must match author".into()));
    }

    // Validate timestamp
    if entry.created_at > sys_time()? {
        return Ok(ValidateCallbackResult::Invalid("Creation timestamp cannot be in the future".into()));
    }

    Ok(ValidateCallbackResult::Valid)
}

pub fn validate_update_{{domain_name}}(data: EntryValidationData<Update<{{DOMAIN_NAME}}>>) -> ExternResult<ValidateCallbackResult> {
    let updated_entry = data.entry.entry;
    let original_action = data.original_action;

    // Only the original author can update
    if updated_entry.created_by != original_action.author {
        return Ok(ValidateCallbackResult::Invalid("Only original author can update".into()));
    }

    // Don't allow changing creation timestamp
    if updated_entry.created_at != original_action.timestamp {
        return Ok(ValidateCallbackResult::Invalid("Cannot change creation timestamp".into()));
    }

    // Re-run create validation on updated content
    validate_create_{{domain_name}}(EntryValidationData::Create {
        action: original_action.clone(),
        app_entry: updated_entry,
    })
}

pub fn validate_delete_{{domain_name}}(data: EntryValidationData<ActionHash>) -> ExternResult<ValidateCallbackResult> {
    // Only the original author can delete
    if data.action.author != data.action.author {
        return Ok(ValidateCallbackResult::Invalid("Only original author can delete".into()));
    }

    Ok(ValidateCallbackResult::Valid)
}

// Link validation functions
#[hdk_extern]
pub fn validate_create_link_{{domain_name}}_update(
    data: ValidationPackageCallbackData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

#[hdk_extern]
pub fn validate_delete_link_{{domain_name}}_update(
    data: ValidationPackageCallbackData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

#[hdk_extern]
pub fn validate_create_link_{{domain_name}}_to_related_entity(
    data: ValidationPackageCallbackData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

#[hdk_extern]
pub fn validate_delete_link_{{domain_name}}_to_related_entity(
    data: ValidationPackageCallbackData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

#[hdk_extern]
pub fn validate_create_link_all_{{domain_name}}s(
    data: ValidationPackageCallbackData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

#[hdk_extern]
pub fn validate_delete_link_all_{{domain_name}}s(
    data: ValidationPackageCallbackData,
) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

// Helper function to get the current system time
fn sys_time() -> ExternResult<i64> {
    let duration = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Time error: {:?}", e))))?;

    Ok(duration.as_secs() as i64)
}

// Utility functions for external access
pub fn {{domain_name}}_hash(entry: &{{DOMAIN_NAME}}) -> ExternResult<EntryHash> {
    hash_entry(entry)
}

// Unit tests
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_{{domain_name}}_creation() {
        let author = AgentPubKey::from_raw_36(vec![0; 36]);
        let {{domain_name}} = {{DOMAIN_NAME}}::new(
            "Test {{DOMAIN_NAME}}".to_string(),
            Some("Test description".to_string()),
            author.clone(),
        );

        assert_eq!({{domain_name}}.name, "Test {{DOMAIN_NAME}}");
        assert_eq!({{domain_name}}.description, Some("Test description".to_string()));
        assert_eq!({{domain_name}}.status, {{DOMAIN_NAME}}Status::Pending);
        assert_eq!({{domain_name}}.created_by, author);
        assert!({{domain_name}}.is_active());
        assert!({{domain_name}}.is_pending());
        assert!(!{{domain_name}}.is_approved());
        assert!(!{{domain_name}}.is_rejected());
    }

    #[test]
    fn test_{{domain_name}}_status_transitions() {
        let author = AgentPubKey::from_raw_36(vec![0; 36]);
        let mut {{domain_name}} = {{DOMAIN_NAME}}::new(
            "Test {{DOMAIN_NAME}}".to_string(),
            None,
            author,
        );

        // Test approval
        {{domain_name}} = {{domain_name}}.approve();
        assert!({{domain_name}}.is_approved());
        assert!(!{{domain_name}}.is_pending());
        assert!(!{{domain_name}}.is_rejected());

        // Test rejection
        {{domain_name}} = {{DOMAIN_NAME}}::new(
            "Test {{DOMAIN_NAME}} 2".to_string(),
            None,
            author,
        );
        {{domain_name}} = {{domain_name}}.reject(Some("Test reason".to_string()));
        assert!({{domain_name}}.is_rejected());
        assert!(!{{domain_name}}.is_pending());
        assert!(!{{domain_name}}.is_approved());

        if let {{DOMAIN_NAME}}Status::Rejected { reason } = {{domain_name}}.status {
            assert_eq!(reason, Some("Test reason".to_string()));
        } else {
            panic!("Status should be Rejected");
        }
    }

    #[test]
    fn test_metadata_operations() {
        let author = AgentPubKey::from_raw_36(vec![0; 36]);
        let mut {{domain_name}} = {{DOMAIN_NAME}}::new(
            "Test {{DOMAIN_NAME}}".to_string(),
            None,
            author,
        );

        {{domain_name}}.add_metadata("key1".to_string(), "value1".to_string());
        {{domain_name}}.add_metadata("key2".to_string(), "value2".to_string());

        assert_eq!({{domain_name}}.get_metadata("key1"), Some(&"value1".to_string()));
        assert_eq!({{domain_name}}.get_metadata("key2"), Some(&"value2".to_string()));
        assert_eq!({{domain_name}}.get_metadata("nonexistent"), None);

        assert_eq!({{domain_name}}.metadata.len(), 2);
    }
}