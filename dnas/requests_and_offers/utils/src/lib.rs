pub mod dna_properties;
pub mod errors;
pub mod types;

pub use dna_properties::DnaProperties;
use errors::CommonError;
pub use types::*;

use std::io::Cursor;

use hdk::prelude::*;
use image::io::Reader as ImageReader;
use serde::{de::DeserializeOwned, Serialize};
use std::fmt::Debug;

pub fn check_if_progenitor() -> ExternResult<bool> {
  let progenitor_pubkey = DnaProperties::get_progenitor_pubkey()?;

  Ok(progenitor_pubkey == agent_info()?.agent_initial_pubkey)
}

pub fn get_original_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  let Some(details) = get_details(original_action_hash, GetOptions::default())? else {
    return Ok(None);
  };

  match details {
    Details::Record(details) => Ok(Some(details.record)),
    _ => Err(CommonError::NotRecord.into()),
  }
}

/// Helper function to find the original action hash by traversing update chains
/// This ensures we always use the original entity action hash for operations that depend on it
/// 
/// Takes any action hash in an update chain and returns the original creation action hash
pub fn find_original_action_hash(action_hash: ActionHash) -> ExternResult<ActionHash> {
  let mut current_hash = action_hash.clone();
  
  // Traverse backwards through the update chain
  loop {
    let record = get(current_hash.clone(), GetOptions::default())?
      .ok_or(CommonError::RecordNotFound("entity".to_string()))?;
    
    match record.action().clone() {
      Action::Create(_) => {
        // This is the original creation action
        return Ok(current_hash);
      }
      Action::Update(update_action) => {
        // This is an update, continue traversing backwards
        current_hash = update_action.original_action_address;
      }
      _ => {
        // Unexpected action type
        return Err(CommonError::InvalidData("Unexpected action type".to_string()).into());
      }
    }
  }
}

pub fn get_all_revisions_for_entry(
  original_action_hash: ActionHash,
  link_types: impl LinkTypeFilterExt,
) -> ExternResult<Vec<Record>> {
  let Some(original_record) = get_original_record(original_action_hash.clone())? else {
    return Ok(vec![]);
  };

  let link_type_filter = link_types.try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(
    original_action_hash.clone(),
    link_type_filter
  ), GetStrategy::Local)?;

  let records: Vec<Option<Record>> = links
    .into_iter()
    .map(|link| {
      get(
        link
          .target
          .into_action_hash()
          .ok_or(CommonError::ActionHashNotFound("record".to_string()))?,
        GetOptions::default(),
      )
    })
    .collect::<ExternResult<Vec<Option<Record>>>>()?;
  let mut records: Vec<Record> = records.into_iter().flatten().collect();
  records.insert(0, original_record);

  Ok(records)
}

pub fn external_local_call<I, T>(fn_name: &str, zome_name: &str, payload: I) -> ExternResult<T>
where
  I: Clone + Serialize + Debug,
  T: Debug + DeserializeOwned,
{
  let zome_call_response = call(
    CallTargetCell::Local,
    ZomeName(zome_name.to_owned().into()),
    FunctionName(fn_name.into()),
    None,
    payload.clone(),
  )?;

  match zome_call_response {
    ZomeCallResponse::Ok(response) => Ok(response.decode().map_err(CommonError::Serialize)?),
    _ => Err(
      CommonError::External(format!(
        "Error while calling the {} function of the {} zome",
        fn_name, zome_name
      ))
      .into(),
    ),
  }
}

pub fn timetamp_now() -> Timestamp {
  Timestamp::from_micros(chrono::UTC::now().timestamp_subsec_micros() as i64)
}

pub fn is_image(bytes: SerializedBytes) -> bool {
  let data = bytes.bytes().to_vec();
  let reader = match ImageReader::new(Cursor::new(data)).with_guessed_format() {
    Ok(reader) => reader,
    Err(_) => return false,
  };

  reader.decode().is_ok()
}

pub fn delete_links(
  base_address: impl Into<AnyLinkableHash>,
  link_type: impl LinkTypeFilterExt,
) -> ExternResult<bool> {
  let link_type_filter = link_type.try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let organization_updates_links = get_links(LinkQuery::new(
    base_address,
    link_type_filter
  ), GetStrategy::Local)?;

  for link in organization_updates_links {
    delete_link(link.create_link_hash, GetOptions::default())?;
  }

  Ok(true)
}
