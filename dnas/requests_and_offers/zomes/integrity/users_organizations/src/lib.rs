pub mod organization;
mod tests;
pub mod user;

pub use organization::*;
pub use user::*;

use hdi::prelude::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  User(User),
  Organization(Organization),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  // Users Links
  UserUpdates,
  AllUsers,
  MyUser,
  UserAgents,
  UserStatus,
  UserOrganizations,

  // Organizations Links
  OrganizationUpdates,
  AllOrganizations,
  OrganizationCoordinators,
  OrganizationMembers,
  OrganizationStatus,
  OrganizationContacts,
}

#[hdk_extern]
pub fn genesis_self_check(_data: GenesisSelfCheckData) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

pub fn validate_agent_joining(
  _agent_pub_key: AgentPubKey,
  _membrane_proof: &Option<MembraneProof>,
) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}

/// Validates the provided `Op` to ensure the entry and link types adhere to the defined constraints.
#[allow(clippy::collapsible_match, clippy::single_match)]
#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  if let FlatOp::StoreEntry(store_entry) = op.flattened::<EntryTypes, LinkTypes>()? {
    match store_entry {
      OpEntry::CreateEntry { app_entry, .. } | OpEntry::UpdateEntry { app_entry, .. } => {
        match app_entry {
          EntryTypes::User(user) => {
            return validate_user(user);
          }
          EntryTypes::Organization(organization) => {
            return validate_organization(organization);
          }
        }
      }

      _ => (),
    }
  }
  if let FlatOp::StoreRecord(store_record) = op.flattened::<EntryTypes, LinkTypes>()? {
    match store_record {
      OpRecord::DeleteEntry {
        original_action_hash,
        ..
      } => {
        let original_record = must_get_valid_record(original_action_hash)?;
        let original_action = original_record.action().clone();
        let original_action = match original_action {
          Action::Create(create) => EntryCreationAction::Create(create),
          Action::Update(update) => EntryCreationAction::Update(update),
          _ => {
            return Ok(ValidateCallbackResult::Invalid(
              "Original action for a delete must be a Create or Update action".to_string(),
            ));
          }
        };
        let app_entry_type = match original_action.entry_type() {
          EntryType::App(app_entry_type) => app_entry_type,
          _ => {
            return Ok(ValidateCallbackResult::Valid);
          }
        };
        let entry = match original_record.entry().as_option() {
          Some(entry) => entry,
          None => {
            if original_action.entry_type().visibility().is_public() {
              return Ok(ValidateCallbackResult::Invalid(
                "Original record for a delete of a public entry must contain an entry".to_string(),
              ));
            } else {
              return Ok(ValidateCallbackResult::Valid);
            }
          }
        };
        let original_app_entry = match EntryTypes::deserialize_from_type(
          *app_entry_type.zome_index,
          app_entry_type.entry_index,
          entry,
        )? {
          Some(app_entry) => app_entry,
          None => {
            return Ok(ValidateCallbackResult::Invalid(
              "Original app entry must be one of the defined entry types for this zome".to_string(),
            ));
          }
        };
        match original_app_entry {
          EntryTypes::User(_original_user) => {
            return Ok(ValidateCallbackResult::Invalid(String::from(
              "User profile cannot be deleted",
            )))
          }
          EntryTypes::Organization(_original_organization) => {
            return Ok(ValidateCallbackResult::Valid)
          }
        }
      }
      _ => (),
    }
  }
  Ok(ValidateCallbackResult::Valid)
}
