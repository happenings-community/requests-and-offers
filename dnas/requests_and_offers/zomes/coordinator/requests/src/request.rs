use hdk::prelude::*;
use requests_integrity::*;
use utils::{
  errors::{AdministrationError, CommonError, UsersError},
  grants::{can_i, require_grant, Ability},
  resolve_chain_root, EntityActionHash, GetMediumOfExchangeForEntityInput,
  GetServiceTypeForEntityInput, MediumOfExchangeLinkInput, OriginalActionHash, PreviousActionHash,
  ServiceTypeLinkInput, UpdateMediumOfExchangeLinksInput, UpdateServiceTypeLinksInput,
};

use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, get_organization_members_links,
  delete_all_medium_of_exchange_links_for_entity, delete_all_service_type_links_for_entity,
  get_agent_user, get_service_type_approval, link_to_medium_of_exchange, link_to_service_type,
  update_medium_of_exchange_links, update_service_type_links,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestInput {
  request: Request,
  organization: Option<ActionHash>,
  /// A listing names one service. The plural lives on the agreement, as
  /// several Commitments, not on the listing.
  service_type_hash: ActionHash,
  medium_of_exchange_hashes: Vec<ActionHash>,
}

#[hdk_extern]
pub fn create_request(input: RequestInput) -> ExternResult<Record> {
  let user_links = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if user_links.is_empty() {
    return Err(UsersError::UserProfileRequired.into());
  }

  // Ensure the user's profile is accepted
  let user_hash = user_links[0]
    .target
    .clone()
    .into_action_hash()
    .ok_or(CommonError::ActionHashNotFound("user".to_string()))?;
  let is_accepted = check_if_entity_is_accepted(EntityActionHash {
    entity_original_action_hash: OriginalActionHash(user_hash),
    entity: "users".to_string(),
  })?;
  if !is_accepted {
    return Err(AdministrationError::EntityNotAccepted("users".to_string()).into());
  }

  // The validator checks a member grant; the profile checks above give the
  // clearer error first.
  let grant = require_grant(Ability::Participate, None)?;
  let mut request = input.request;
  request.grant = Some(grant);
  // Posted on an organisation's behalf: the author must be one of its members, and
  // the request carries the membership link that admits them, which validation
  // reads. Set here, never from the client.
  request.organization = input.organization.clone();
  request.membership = match &input.organization {
    None => None,
    Some(organization) => {
      let my_user = user_links[0].target.clone();
      let admitted = get_organization_members_links(organization.clone())?
        .into_iter()
        .find(|link| link.target == my_user)
        .ok_or_else(|| {
          AdministrationError::EntityNotAccepted("organization member".to_string())
        })?;
      Some(admitted.create_link_hash)
    }
  };
  request.removal_reason = None;
  // The listing's one service type goes on the entry, where validation holds
  // it fixed (#257); the link below is an index of it. Validation accepts only
  // the type's original record, and a client may hold a revision (the list of
  // approved types returns the latest), so resolve it as every link site does.
  let service_type_hash = resolve_chain_root(input.service_type_hash.clone());
  // Validation also requires the decision that approved it (#257). Only the
  // type's current decision is named, so a retired or rejected type is refused
  // here, before writing.
  request.service_type_approval = Some(
    get_service_type_approval(service_type_hash.clone())?.ok_or(CommonError::InvalidData(
      "That service type is not approved".to_string(),
    ))?,
  );
  request.service_type_hash = Some(service_type_hash);
  let request_hash = create_entry(&EntryTypes::Request(request))?;

  let record = get(request_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the newly created request".to_string()),
  )?;

  // Create link from requests.active path
  let path = Path::from("requests.active");
  let path_hash = path.path_entry_hash()?;
  create_link(
    path_hash.clone(),
    request_hash.clone(),
    LinkTypes::ActiveRequests,
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
    create_link(
      request_hash.clone(),
      user_profile_links[0].target.clone(),
      LinkTypes::RequestCreator,
      (),
    )?;
  }

  if input.organization.is_some() {
    create_link(
      input.organization.clone().unwrap(),
      request_hash.clone(),
      LinkTypes::OrganizationRequests,
      (),
    )?;
    create_link(
      request_hash.clone(),
      input.organization.clone().unwrap(),
      LinkTypes::RequestOrganization,
      (),
    )?;
  }

  // Create the bidirectional link to this listing's service type
  link_to_service_type(ServiceTypeLinkInput {
    service_type_hash: OriginalActionHash(input.service_type_hash),
    action_hash: OriginalActionHash(request_hash.clone()),
    entity: "request".to_string(),
  })?;

  // Create bidirectional links to mediums of exchange
  for medium_of_exchange_hash in input.medium_of_exchange_hashes {
    link_to_medium_of_exchange(MediumOfExchangeLinkInput {
      medium_of_exchange_hash: OriginalActionHash(medium_of_exchange_hash),
      action_hash: OriginalActionHash(request_hash.clone()),
      entity: "request".to_string(),
    })?;
  }

  Ok(record)
}

#[hdk_extern]
pub fn get_request(action_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(action_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_request_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  // A request its creator has tombstoned is gone, whatever revision a link
  // points at. Its update chain's links stay (#234), so read the tombstone on
  // the original record rather than relying on those links having gone.
  let root = resolve_chain_root(original_action_hash.clone());
  if let Some(Details::Record(details)) = get_details(root, GetOptions::default())? {
    if !details.deletes.is_empty() {
      return Ok(None);
    }
  }
  let link_type_filter = LinkTypes::RequestUpdates
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(original_action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_action_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("request".to_string()))?,
    None => original_action_hash.clone(),
  };
  get(latest_action_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_request(original_action_hash: ActionHash) -> ExternResult<Request> {
  let record = get_latest_request_record(original_action_hash.clone())?.ok_or(
    CommonError::EntryNotFound(format!(
      "Request not found for action hash: {}",
      original_action_hash
    )),
  )?;

  record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("Could not deserialize request entry".to_string()).into())
}

#[hdk_extern]
pub fn get_active_requests(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("requests.active");
  let path_hash = path.path_entry_hash()?;
  let link_type_filter = LinkTypes::ActiveRequests
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  // Resolve the LATEST record per link target so edits are visible on list
  // surfaces (Bug 4 fix).
  let mut records = Vec::new();
  for link in links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if let Some(record) = get_latest_request_record(target_hash)? {
        // Archived and removed requests keep their link; their status leaves them out.
        let request: Option<Request> = record.entry().to_app_option().ok().flatten();
        if request.map(|l| l.status == ListingStatus::Active).unwrap_or(false) {
          records.push(record);
        }
      }
    }
  }
  Ok(records)
}

#[hdk_extern]
pub fn get_archived_requests(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("requests.archived");
  let path_hash = path.path_entry_hash()?;
  let link_type_filter = LinkTypes::ArchivedRequests
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(path_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;
  let mut records = Vec::new();
  for link in links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if let Some(record) = get_latest_request_record(target_hash)? {
        records.push(record);
      }
    }
  }
  Ok(records)
}

#[hdk_extern]
pub fn get_user_requests(user_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::UserRequests
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  // NOTE: Using GetStrategy::Local here since this is called by get_my_listings
  // which should only return the user's own requests from their local source chain
  let links = get_links(
    LinkQuery::new(user_hash.clone(), link_type_filter),
    GetStrategy::Local,
  )?;
  let mut records = Vec::new();
  for link in links {
    if let Some(target_hash) = link.target.clone().into_action_hash() {
      if let Some(record) = get_latest_request_record(target_hash)? {
        records.push(record);
      }
    }
  }
  Ok(records)
}

#[hdk_extern]
pub fn get_organization_requests(organization_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::OrganizationRequests
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(organization_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  let get_input: Vec<GetInput> = links
    .into_iter()
    .map(|link| {
      link
        .target
        .into_any_dht_hash()
        .ok_or(CommonError::ActionHashNotFound("request".to_string()))
        .map(|hash| GetInput::new(hash, GetOptions::default()))
    })
    .collect::<Result<Vec<GetInput>, CommonError>>()?;

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
  let records: Vec<Record> = records.into_iter().flatten().collect();
  Ok(records)
}

#[hdk_extern]
pub fn get_request_creator(request_hash: ActionHash) -> ExternResult<Option<ActionHash>> {
  let link_type_filter = LinkTypes::RequestCreator
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(request_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  if links.is_empty() {
    Ok(None)
  } else {
    Ok(Some(links[0].target.clone().into_action_hash().ok_or(
      CommonError::ActionHashNotFound("request creator".to_string()),
    )?))
  }
}

#[hdk_extern]
pub fn get_request_organization(request_hash: ActionHash) -> ExternResult<Option<ActionHash>> {
  let link_type_filter = LinkTypes::RequestOrganization
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(
    LinkQuery::new(request_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  if links.is_empty() {
    Ok(None)
  } else {
    Ok(Some(links[0].target.clone().into_action_hash().ok_or(
      CommonError::ActionHashNotFound("request organization".to_string()),
    )?))
  }
}

#[hdk_extern]
pub fn get_user_active_requests(user_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let all_requests = get_user_requests(user_hash)?;
  let filtered = all_requests
    .into_iter()
    .filter(|record| {
      // Get the latest request entry
      if let Ok(Some(latest)) = get_latest_request_record(record.signed_action.hashed.hash.clone())
      {
        if let Ok(request) = latest.try_into() {
          let request: Request = request;
          return request.status == ListingStatus::Active;
        }
      }
      false
    })
    .collect();
  Ok(filtered)
}

#[hdk_extern]
pub fn get_user_archived_requests(user_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let all_requests = get_user_requests(user_hash)?;
  let filtered = all_requests
    .into_iter()
    .filter(|record| {
      // Get the latest request entry
      if let Ok(Some(latest)) = get_latest_request_record(record.signed_action.hashed.hash.clone())
      {
        if let Ok(request) = latest.try_into() {
          let request: Request = request;
          return request.status == ListingStatus::Archived;
        }
      }
      false
    })
    .collect();
  Ok(filtered)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateRequestInput {
  pub original_action_hash: OriginalActionHash,
  pub previous_action_hash: PreviousActionHash,
  pub updated_request: Request,
  pub service_type_hash: ActionHash,
  pub medium_of_exchange_hashes: Vec<ActionHash>,
}

#[hdk_extern]
pub fn update_request(input: UpdateRequestInput) -> ExternResult<Record> {
  let original_record = get(input.original_action_hash.0.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the original request".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator. The author is the
  // request's creator, as the validator reads it: the client's "original" may be
  // a revision an admin wrote, so read the chain's root.
  let creator_record = get(
    resolve_chain_root(input.original_action_hash.0.clone()),
    GetOptions::default(),
  )?
  .ok_or(CommonError::EntryNotFound(
    "Could not find the original request".to_string(),
  ))?;
  let author = creator_record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
  }

  // Check if request is archived (archived requests cannot be edited)
  let current_request: Request = original_record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound(
      "Could not deserialize request entry".to_string(),
    ))?;

  // A listing's service type is its identity: an update keeps it, and
  // validation refuses one that does not (#257). Say so here, before writing.
  let service_type_hash =
    current_request
      .service_type_hash
      .clone()
      .ok_or(CommonError::InvalidData(
        "This request names no service type".to_string(),
      ))?;
  if resolve_chain_root(input.service_type_hash.clone()) != service_type_hash {
    return Err(
      CommonError::InvalidData(
        "A request's service type cannot change; publish a new listing for a different one"
          .to_string(),
      )
      .into(),
    );
  }

  if current_request.status == ListingStatus::Archived {
    return Err(CommonError::CannotUpdateArchived("request".to_string()).into());
  }

  // The creator needs no grant; an admin carries theirs. Never the client's.
  let mut updated_request = input.updated_request;
  updated_request.service_type_hash = Some(service_type_hash.clone());
  updated_request.service_type_approval = current_request.service_type_approval.clone();
  updated_request.grant = if is_author {
    None
  } else {
    Some(require_grant(Ability::Administer, None)?)
  };
  // The organisation and the membership are the original's, never the client's;
  // an edit is not a removal.
  let creator_request: Request = creator_record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("request".to_string()))?;
  updated_request.organization = creator_request.organization;
  updated_request.membership = creator_request.membership;
  updated_request.removal_reason = None;
  let updated_request_hash = update_entry(input.previous_action_hash.into(), &updated_request)?;

  // The active list links each request's original record once, at creation, and
  // is never rewritten: readers take the latest revision and its status. So an
  // edit by an administrator never tombstones a link the creator wrote (#234).

  // Create the update tracking link (root -> updated, for get_latest_request_record).
  // Anchored at the chain root, not at the caller\'s "original", which may
  // itself be a revision, so every surface finds every edit.
  create_link(
    resolve_chain_root(input.original_action_hash.0),
    updated_request_hash.clone(),
    LinkTypes::RequestUpdates,
    (),
  )?;

  // Update service type links using the service_types zome
  update_service_type_links(UpdateServiceTypeLinksInput {
    action_hash: OriginalActionHash(updated_request_hash.clone()),
    entity: "request".to_string(),
    // The shared link machinery stays plural: users carry several skills.
    new_service_type_hashes: vec![service_type_hash],
  })?;

  // Update medium of exchange links using the mediums_of_exchange zome
  update_medium_of_exchange_links(UpdateMediumOfExchangeLinksInput {
    action_hash: OriginalActionHash(updated_request_hash.clone()),
    entity: "request".to_string(),
    new_medium_of_exchange_hashes: input.medium_of_exchange_hashes,
  })?;

  let record = get(updated_request_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the newly updated Request".to_string()),
  )?;

  Ok(record)
}

#[hdk_extern]
pub fn delete_request(original_action_hash: ActionHash) -> ExternResult<bool> {
  let original_record = get(original_action_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the original request".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Only the creator tombstones their request, and validation holds that too
  // (#234). A role holder removes it instead, with `remove_request`, which records
  // who and why.
  let author = original_record.action().author().clone();
  if author != agent_pubkey {
    return Err(UsersError::NotAuthor.into());
  }

  // Delete all requests links
  let path = Path::from("requests");
  let path_hash = path.path_entry_hash()?;
  let link_type_filter = LinkTypes::AllRequests
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let requests_links = get_links(
    LinkQuery::new(path_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  for link in requests_links {
    if let Some(hash) = link.target.clone().into_action_hash() {
      if hash == original_action_hash {
        delete_link(link.create_link_hash, GetOptions::default())?;
        break;
      }
    }
  }

  // Delete user links
  let link_type_filter = LinkTypes::RequestCreator
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let user_links = get_links(
    LinkQuery::new(original_action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  for link in user_links {
    // Get the user hash
    if let Some(user_hash) = link.target.clone().into_action_hash() {
      // Find and delete the UserRequests link
      let link_type_filter = LinkTypes::UserRequests
        .try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
      let user_requests_links = get_links(
        LinkQuery::new(user_hash.clone(), link_type_filter),
        GetStrategy::Network,
      )?;

      for user_link in user_requests_links {
        if let Some(hash) = user_link.target.clone().into_action_hash() {
          if hash == original_action_hash {
            delete_link(user_link.create_link_hash, GetOptions::default())?;
            break;
          }
        }
      }

      // Delete the RequestCreator link
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  let link_type_filter = LinkTypes::RequestOrganization
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let org_links = get_links(
    LinkQuery::new(original_action_hash.clone(), link_type_filter),
    GetStrategy::Network,
  )?;

  // Delete RequestOrganization links
  for link in org_links {
    // Get the organization hash
    if let Some(org_hash) = link.target.clone().into_action_hash() {
      // Find and delete the OrganizationRequests link
      let link_type_filter = LinkTypes::OrganizationRequests
        .try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
      let org_requests_links = get_links(
        LinkQuery::new(org_hash.clone(), link_type_filter),
        GetStrategy::Network,
      )?;

      for org_link in org_requests_links {
        if let Some(hash) = org_link.target.clone().into_action_hash() {
          if hash == original_action_hash {
            delete_link(org_link.create_link_hash, GetOptions::default())?;
            break;
          }
        }
      }

      // Delete the RequestOrganization link
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  // Delete service type links using the service_types zome
  delete_all_service_type_links_for_entity(GetServiceTypeForEntityInput {
    original_action_hash: OriginalActionHash(original_action_hash.clone()),
    entity: "request".to_string(),
  })?;

  // Delete medium of exchange links using the mediums_of_exchange zome
  delete_all_medium_of_exchange_links_for_entity(GetMediumOfExchangeForEntityInput {
    original_action_hash: OriginalActionHash(original_action_hash.clone()),
    entity: "request".to_string(),
  })?;

  // The update chain's links stay: the records they join stay on the DHT, and
  // an administrator's edit wrote some of them. Only the creator's own active
  // list link goes.
  let active_path_hash = Path::from("requests.active").path_entry_hash()?;
  let active_filter = LinkTypes::ActiveRequests
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  for link in get_links(LinkQuery::new(active_path_hash, active_filter), GetStrategy::Network)? {
    if link.target.clone().into_action_hash() == Some(original_action_hash.clone()) {
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  // Finally delete the request entry
  delete_entry(original_action_hash.clone())?;

  Ok(true)
}

#[hdk_extern]
pub fn archive_request(original_action_hash: ActionHash) -> ExternResult<bool> {
  // Get the latest request record (follows update chain)
  let latest_record = get_latest_request_record(original_action_hash.clone())?.ok_or(
    CommonError::EntryNotFound("Could not find the request".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator. The author is the
  // request's creator, as the validator reads it, not the latest revision's.
  let creator_record = get(
    resolve_chain_root(original_action_hash.clone()),
    GetOptions::default(),
  )?
  .ok_or(CommonError::EntryNotFound(
    "Could not find the original request".to_string(),
  ))?;
  let author = creator_record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
  }

  // Get the current request
  let current_request: Request = latest_record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound(
      "Could not deserialize request entry".to_string(),
    ))?;

  // Update the request with archived status
  let mut updated_request = current_request.clone();
  updated_request.status = ListingStatus::Archived;
  // The creator needs no grant; an admin carries theirs, not the last writer's.
  updated_request.grant = if is_author {
    None
  } else {
    Some(require_grant(Ability::Administer, None)?)
  };
  updated_request.removal_reason = None;

  // Create update entry - use the LATEST action hash as previous
  let latest_action_hash = latest_record.signed_action.hashed.hash.clone();
  let updated_request_hash = update_entry(latest_action_hash.clone(), &updated_request)?;

  // The active list keeps its link; readers see the archived status and leave
  // the request out (#234).

  // Create new link in the archived path
  let archived_path = Path::from("requests.archived");
  let archived_path_hash = archived_path.path_entry_hash()?;
  create_link(
    archived_path_hash.clone(),
    updated_request_hash.clone(),
    LinkTypes::ArchivedRequests,
    (),
  )?;

  // Create link to track the update, anchored at the chain root like every
  // other revision.
  create_link(
    resolve_chain_root(original_action_hash.clone()),
    updated_request_hash.clone(),
    LinkTypes::RequestUpdates,
    (),
  )?;

  Ok(true)
}

#[hdk_extern]
pub fn get_my_listings(user_hash: ActionHash) -> ExternResult<Vec<Record>> {
  get_user_requests(user_hash)
}

#[hdk_extern]
pub fn get_requests_by_tag(tag: String) -> ExternResult<Vec<Record>> {
  use utils::external_local_call;

  // Call service_types zome to get service types with this tag
  let service_type_records: Vec<Record> =
    external_local_call("get_service_types_by_tag", "service_types", tag)?;

  // For each service type, get all requests that use it
  let mut all_requests = Vec::new();
  let mut seen_hashes = std::collections::HashSet::new();

  for service_type_record in service_type_records {
    let service_type_hash = service_type_record.signed_action.hashed.hash;

    // Call service_types zome to get requests for this service type
    let requests: Vec<Record> = external_local_call(
      "get_requests_for_service_type",
      "service_types",
      service_type_hash,
    )
    .unwrap_or_else(|_| Vec::new()); // Skip errors gracefully

    // Add to our collection, avoiding duplicates
    for request in requests {
      let request_hash = request.signed_action.hashed.hash.clone();
      if !seen_hashes.contains(&request_hash) {
        seen_hashes.insert(request_hash);
        all_requests.push(request);
      }
    }
  }

  Ok(all_requests)
}

/// Input for `remove_request`.
#[derive(Serialize, Deserialize, Debug)]
pub struct RemoveRequestInput {
  pub original_action_hash: ActionHash,
  pub reason: String,
}

/// Removes a request as a role holder: an administrator, or a coordinator of
/// the organisation it was posted for. The request is updated to `Deleted` carrying
/// the remover's grant and the reason, so who and why are on the record, and it
/// leaves the active list. Its creator deletes it with `delete_request` instead.
#[hdk_extern]
pub fn remove_request(input: RemoveRequestInput) -> ExternResult<Record> {
  if input.reason.trim().is_empty() {
    return Err(CommonError::InvalidData("a removal says why".to_string()).into());
  }
  let root = resolve_chain_root(input.original_action_hash.clone());
  let latest = get_latest_request_record(root.clone())?.ok_or(CommonError::EntryNotFound(
    "Could not find the request".to_string(),
  ))?;
  let current: Request = latest
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("request".to_string()))?;
  if current.status == ListingStatus::Deleted {
    return Err(CommonError::InvalidData("that request is already removed".to_string()).into());
  }
  let grant = match can_i(Ability::Administer, None)? {
    Some(grant) => grant,
    None => match &current.organization {
      Some(organization) => require_grant(Ability::Coordinate, Some(organization.clone()))?,
      None => return Err(AdministrationError::Unauthorized.into()),
    },
  };

  let mut removed = current;
  removed.status = ListingStatus::Deleted;
  removed.grant = Some(grant);
  removed.removal_reason = Some(input.reason.trim().to_string());
  let latest_hash = latest.action_address().clone();
  let removed_hash = update_entry(latest_hash.clone(), &removed)?;
  create_link(root, removed_hash.clone(), LinkTypes::RequestUpdates, ())?;

  // Every link stays, the active list's included: readers see the `Deleted`
  // status and leave the request out of the active list, and the creator and the
  // organisation still find it and read why (#234).

  get(removed_hash, GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("Could not find the removed request".to_string()).into())
}
