use hdk::prelude::*;
use requests_integrity::*;
use utils::{
    errors::{AdministrationError, CommonError, UsersError},
    EntityActionHash, GetMediumOfExchangeForEntityInput, GetServiceTypeForEntityInput,
    MediumOfExchangeLinkInput, ServiceTypeLinkInput, UpdateMediumOfExchangeLinksInput,
    UpdateServiceTypeLinksInput,
};

use crate::external_calls::{
    check_if_agent_is_administrator, check_if_entity_is_accepted,
    delete_all_medium_of_exchange_links_for_entity, delete_all_service_type_links_for_entity,
    get_agent_user, link_to_medium_of_exchange, link_to_service_type, update_medium_of_exchange_links,
    update_service_type_links,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct RequestInput {
    request: Request,
    organization: Option<ActionHash>,
    service_type_hashes: Vec<ActionHash>,
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
        entity_original_action_hash: user_hash,
        entity: "users".to_string(),
    })?;
    if !is_accepted {
        return Err(AdministrationError::EntityNotAccepted("users".to_string()).into());
    }

    let request_hash = create_entry(&EntryTypes::Request(input.request))?;

    let record = get(request_hash.clone(), GetOptions::default())?.ok_or(
        CommonError::EntryNotFound("Could not find the newly created request".to_string()),
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

    // Create bidirectional links to service types
    for service_type_hash in input.service_type_hashes {
        link_to_service_type(ServiceTypeLinkInput {
            service_type_hash,
            action_hash: request_hash.clone(),
            entity: "request".to_string(),
        })?;
    }

    // Create bidirectional links to mediums of exchange
    for medium_of_exchange_hash in input.medium_of_exchange_hashes {
        link_to_medium_of_exchange(MediumOfExchangeLinkInput {
            medium_of_exchange_hash,
            action_hash: request_hash.clone(),
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
    let links = get_links(
        GetLinksInputBuilder::try_new(request_hash.clone(), LinkTypes::RequestCreator)?.build(),
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
    let links = get_links(
        GetLinksInputBuilder::try_new(request_hash.clone(), LinkTypes::RequestOrganization)?.build(),
    )?;

    if links.is_empty() {
        Ok(None)
    } else {
        Ok(Some(links[0].target.clone().into_action_hash().ok_or(
            CommonError::ActionHashNotFound("request organization".to_string()),
        )?))
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateRequestInput {
    pub original_action_hash: ActionHash,
    pub previous_action_hash: ActionHash,
    pub updated_request: Request,
    pub service_type_hashes: Vec<ActionHash>,
    pub medium_of_exchange_hashes: Vec<ActionHash>,
}

#[hdk_extern]
pub fn update_request(input: UpdateRequestInput) -> ExternResult<Record> {
    let original_record = get(input.original_action_hash.clone(), GetOptions::default())?.ok_or(
        CommonError::EntryNotFound("Could not find the original request".to_string()),
    )?;
    let agent_pubkey = agent_info()?.agent_initial_pubkey;

    // Check if the agent is the author or an administrator
    let author = original_record.action().author().clone();
    let is_author = author == agent_pubkey;
    let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

    if !is_author && !is_admin {
        return Err(UsersError::NotAuthor.into());
    }

    let updated_request_hash =
        update_entry(input.previous_action_hash.clone(), &input.updated_request)?;

    create_link(
        input.original_action_hash.clone(),
        updated_request_hash.clone(),
        LinkTypes::RequestUpdates,
        (),
    )?;

    // Update service type links using the service_types zome
    update_service_type_links(UpdateServiceTypeLinksInput {
        action_hash: input.original_action_hash.clone(),
        entity: "request".to_string(),
        new_service_type_hashes: input.service_type_hashes,
    })?;

    // Update medium of exchange links using the mediums_of_exchange zome
    update_medium_of_exchange_links(UpdateMediumOfExchangeLinksInput {
        action_hash: input.original_action_hash.clone(),
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

    // Check if the agent is the author or an administrator
    let author = original_record.action().author().clone();
    let is_author = author == agent_pubkey;
    let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

    if !is_author && !is_admin {
        return Err(UsersError::NotAuthor.into());
    }

    // Delete all requests links
    let path = Path::from("requests");
    let path_hash = path.path_entry_hash()?;
    let requests_links =
        get_links(GetLinksInputBuilder::try_new(path_hash.clone(), LinkTypes::AllRequests)?.build())?;

    for link in requests_links {
        if let Some(hash) = link.target.clone().into_action_hash() {
            if hash == original_action_hash {
                delete_link(link.create_link_hash)?;
                break;
            }
        }
    }

    // Delete user links
    let user_links = get_links(
        GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::RequestCreator)?.build(),
    )?;

    for link in user_links {
        // Get the user hash
        if let Some(user_hash) = link.target.clone().into_action_hash() {
            // Find and delete the UserRequests link
            let user_requests_links = get_links(
                GetLinksInputBuilder::try_new(user_hash.clone(), LinkTypes::UserRequests)?.build(),
            )?;

            for user_link in user_requests_links {
                if let Some(hash) = user_link.target.clone().into_action_hash() {
                    if hash == original_action_hash {
                        delete_link(user_link.create_link_hash)?;
                        break;
                    }
                }
            }

            // Delete the RequestCreator link
            delete_link(link.create_link_hash)?;
        }
    }

    let org_links = get_links(
        GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::RequestOrganization)?
            .build(),
    )?;

    // Delete RequestOrganization links
    for link in org_links {
        // Get the organization hash
        if let Some(org_hash) = link.target.clone().into_action_hash() {
            // Find and delete the OrganizationRequests link
            let org_requests_links = get_links(
                GetLinksInputBuilder::try_new(org_hash.clone(), LinkTypes::OrganizationRequests)?.build(),
            )?;

            for org_link in org_requests_links {
                if let Some(hash) = org_link.target.clone().into_action_hash() {
                    if hash == original_action_hash {
                        delete_link(org_link.create_link_hash)?;
                        break;
                    }
                }
            }

            // Delete the RequestOrganization link
            delete_link(link.create_link_hash)?;
        }
    }

    // Delete service type links using the service_types zome
    delete_all_service_type_links_for_entity(GetServiceTypeForEntityInput {
        original_action_hash: original_action_hash.clone(),
        entity: "request".to_string(),
    })?;

    // Delete medium of exchange links using the mediums_of_exchange zome
    delete_all_medium_of_exchange_links_for_entity(GetMediumOfExchangeForEntityInput {
        original_action_hash: original_action_hash.clone(),
        entity: "request".to_string(),
    })?;

    // Delete any update links
    let update_links = get_links(
        GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::RequestUpdates)?.build(),
    )?;

    for link in update_links {
        delete_link(link.create_link_hash)?;
    }

    // Finally delete the request entry
    delete_entry(original_action_hash.clone())?;

    Ok(true)
}

#[hdk_extern]
pub fn archive_request(original_action_hash: ActionHash) -> ExternResult<bool> {
    let original_record = get(original_action_hash.clone(), GetOptions::default())?.ok_or(
        CommonError::EntryNotFound("Could not find the original request".to_string()),
    )?;
    let agent_pubkey = agent_info()?.agent_initial_pubkey;

    // Check if the agent is the author or an administrator
    let author = original_record.action().author().clone();
    let is_author = author == agent_pubkey;
    let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

    if !is_author && !is_admin {
        return Err(UsersError::NotAuthor.into());
    }

    // Get the current request
    let current_request: Request = original_record
        .entry()
        .to_app_option()
        .map_err(CommonError::Serialize)?
        .ok_or(CommonError::EntryNotFound("Could not deserialize request entry".to_string()))?;

    // Update the request with archived status
    let mut updated_request = current_request.clone();
    updated_request.status = ListingStatus::Archived;

    // Create update entry
    let previous_action_hash = original_record.signed_action.hashed.hash.clone();
    update_entry(previous_action_hash.clone(), &updated_request)?;

    // Create link to track the update
    create_link(
        original_action_hash.clone(),
        previous_action_hash,
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