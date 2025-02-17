use hdk::prelude::*;
use requests_integrity::*;
use utils::errors::{CommonError, RequestsError};

use crate::external_calls::get_agent_user;

#[hdk_extern]
pub fn create_request(request: Request) -> ExternResult<Record> {
  let user_exists = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if user_exists.is_empty() {
    return Err(
      RequestsError::UserProfileRequired("User profile must be created first".to_string()).into(),
    );
  }

  let request_hash = create_entry(&EntryTypes::Request(request.clone()))?;

  let record = get(request_hash.clone(), GetOptions::default())?.ok_or(
    RequestsError::RequestNotFound("Could not find the newly created request".to_string()),
  )?;

  // Create link from all_requests
  let path = Path::from("requests");
  let path_hash = path.path_entry_hash()?;
  create_link(
    path_hash.clone(),
    request_hash.clone(),
    LinkTypes::AllRequests,
    (),
  )?;

  // Get user profile links to link the request
  let user_profile_links = get_agent_user(agent_info()?.agent_initial_pubkey)?;

  // Link to the creator's user profile
  if !user_profile_links.is_empty() {
    create_link(
      user_profile_links[0].target.clone(),
      request_hash.clone(),
      LinkTypes::UserRequests,
      (),
    )?;
  }

  Ok(record)
}

#[hdk_extern]
pub fn get_latest_request_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::RequestUpdates)?.build(),
  )?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_action_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("request".into()))?,
    None => original_action_hash.clone(),
  };
  get(latest_action_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_request(original_action_hash: ActionHash) -> ExternResult<Request> {
  let record = get_latest_request_record(original_action_hash.clone())?.ok_or(
    RequestsError::RequestNotFound(format!(
      "Request not found for action hash: {}",
      original_action_hash
    )),
  )?;

  record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(RequestsError::RequestNotFound("Could not deserialize request entry".to_string()).into())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateRequestInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
  pub updated_request: Request,
}

#[hdk_extern]
pub fn update_request(input: UpdateRequestInput) -> ExternResult<Record> {
  let original_record = must_get_valid_record(input.original_action_hash.clone())?;

  let author = original_record.action().author().clone();
  if author != agent_info()?.agent_initial_pubkey {
    return Err(
      RequestsError::NotAuthor("Only the author of a Request can update it".to_string()).into(),
    );
  }

  let updated_request_hash =
    update_entry(input.previous_action_hash.clone(), &input.updated_request)?;

  create_link(
    input.original_action_hash.clone(),
    updated_request_hash.clone(),
    LinkTypes::RequestUpdates,
    (),
  )?;

  let record = get(updated_request_hash.clone(), GetOptions::default())?.ok_or(
    RequestsError::RequestNotFound("Could not find the newly updated Request".to_string()),
  )?;

  Ok(record)
}

#[hdk_extern]
pub fn get_all_requests(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("requests");
  let path_hash = path.path_entry_hash()?;
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash.clone(), LinkTypes::AllRequests)?.build())?;
  let get_input: Vec<GetInput> = links
    .into_iter()
    .map(|link| {
      GetInput::new(
        link
          .target
          .clone()
          .into_any_dht_hash()
          .expect("Failed to convert link target"),
        GetOptions::default(),
      )
    })
    .collect();
  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
  let records: Vec<Record> = records.into_iter().flatten().collect();
  Ok(records)
}

#[hdk_extern]
pub fn get_user_requests(user_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links =
    get_links(GetLinksInputBuilder::try_new(user_hash.clone(), LinkTypes::UserRequests)?.build())?;
  let get_input: Vec<GetInput> = links
    .into_iter()
    .map(|link| {
      GetInput::new(
        link
          .target
          .clone()
          .into_any_dht_hash()
          .expect("Failed to convert link target"),
        GetOptions::default(),
      )
    })
    .collect();
  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
  let records: Vec<Record> = records.into_iter().flatten().collect();
  Ok(records)
}

#[hdk_extern]
pub fn get_organization_requests(organization_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(organization_hash.clone(), LinkTypes::OrganizationRequests)?
      .build(),
  )?;
  let get_input: Vec<GetInput> = links
    .into_iter()
    .map(|link| {
      GetInput::new(
        link
          .target
          .clone()
          .into_any_dht_hash()
          .expect("Failed to convert link target"),
        GetOptions::default(),
      )
    })
    .collect();
  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
  let records: Vec<Record> = records.into_iter().flatten().collect();
  Ok(records)
}
