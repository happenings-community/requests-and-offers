/// Integrity Zome Template — HDI 0.7
/// Aligned with dnas/requests_and_offers/zomes/integrity/service_types/src/lib.rs
/// Replace {{DomainName}} (PascalCase) and {{domain_name}} (snake_case).

use hdi::prelude::*;

// --- Entry Types ---

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    {{DomainName}}({{DomainName}}),
}

// --- Entry Definition ---

#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct {{DomainName}} {
    pub name: String,
    pub description: String,
    // Add domain-specific fields here
}

// --- Link Types ---

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    {{DomainName}}Updates,
    All{{DomainName}}s,
    // Add relationship links here, e.g.:
    // {{DomainName}}ToUser,
    // UserTo{{DomainName}},
}

// --- Genesis ---

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
    Ok(ValidateCallbackResult::Valid)
}

// --- Validation ---

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
    match op.flattened::<EntryTypes, LinkTypes>()? {
        FlatOp::StoreEntry(store_entry) => match store_entry {
            OpEntry::CreateEntry { app_entry, .. }
            | OpEntry::UpdateEntry { app_entry, .. } => match app_entry {
                EntryTypes::{{DomainName}}(entry) => validate_{{domain_name}}(entry),
            },
            _ => Ok(ValidateCallbackResult::Valid),
        },
        FlatOp::StoreRecord(store_record) => match store_record {
            OpRecord::DeleteEntry { original_action_hash, .. } => {
                let original_record = must_get_valid_record(original_action_hash)?;
                let original_action = original_record.action().clone();
                let original_action = match original_action {
                    Action::Create(create) => EntryCreationAction::Create(create),
                    Action::Update(update) => EntryCreationAction::Update(update),
                    _ => return Ok(ValidateCallbackResult::Invalid(
                        "Original action for delete must be Create or Update".to_string(),
                    )),
                };
                let app_entry_type = match original_action.entry_type() {
                    EntryType::App(app_entry_type) => app_entry_type,
                    _ => return Ok(ValidateCallbackResult::Valid),
                };
                let entry = match original_record.entry().as_option() {
                    Some(entry) => entry,
                    None => return Ok(ValidateCallbackResult::Valid),
                };
                match EntryTypes::deserialize_from_type(
                    app_entry_type.zome_index,
                    app_entry_type.entry_index,
                    entry,
                )? {
                    Some(EntryTypes::{{DomainName}}(_)) => {
                        // Add delete validation if needed
                        Ok(ValidateCallbackResult::Valid)
                    }
                    None => Ok(ValidateCallbackResult::Invalid(
                        "Original entry must be a defined entry type".to_string(),
                    )),
                }
            }
            _ => Ok(ValidateCallbackResult::Valid),
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}

pub fn validate_{{domain_name}}(entry: {{DomainName}}) -> ExternResult<ValidateCallbackResult> {
    if entry.name.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "{{DomainName}} name cannot be empty".to_string(),
        ));
    }
    if entry.description.is_empty() {
        return Ok(ValidateCallbackResult::Invalid(
            "{{DomainName}} description cannot be empty".to_string(),
        ));
    }
    Ok(ValidateCallbackResult::Valid)
}
