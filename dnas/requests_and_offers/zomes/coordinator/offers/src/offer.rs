use hdk::prelude::*;
use offers_integrity::*;
use utils::{
  errors::{AdministrationError, CommonError, UsersError},
  EntityActionHash, GetMediumOfExchangeForEntityInput, GetServiceTypeForEntityInput, MediumOfExchangeLinkInput,
  ServiceTypeLinkInput, UpdateMediumOfExchangeLinksInput, UpdateServiceTypeLinksInput,
};

use crate::external_calls::{
  check_if_agent_is_administrator, check_if_entity_is_accepted, delete_all_medium_of_exchange_links_for_entity,
  delete_all_service_type_links_for_entity, get_agent_user, link_to_medium_of_exchange,
  link_to_service_type, update_medium_of_exchange_links, update_service_type_links,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct OfferInput {
  offer: Offer,
  organization: Option<ActionHash>,
  service_type_hashes: Vec<ActionHash>,
  medium_of_exchange_hashes: Vec<ActionHash>,
}

#[hdk_extern]
pub fn create_offer(input: OfferInput) -> ExternResult<Record> {
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

  let offer_hash = create_entry(&EntryTypes::Offer(input.offer))?;

  let record = get(offer_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the newly created offer".to_string()),
  )?;

  // Create link from all_offers
  let path = Path::from("offers");
  let path_hash = path.path_entry_hash()?;
  create_link(
    path_hash.clone(),
    offer_hash.clone(),
    LinkTypes::AllOffers,
    (),
  )?;

  // Get user profile links to link the offer
  let user_profile_links = get_agent_user(agent_info()?.agent_initial_pubkey)?;

  // Bidirectional link to the creator's user profile
  if !user_profile_links.is_empty() {
    create_link(
      user_profile_links[0].target.clone(),
      offer_hash.clone(),
      LinkTypes::UserOffers,
      (),
    )?;
    create_link(
      offer_hash.clone(),
      user_profile_links[0].target.clone(),
      LinkTypes::OfferCreator,
      (),
    )?;
  }

  // Bidirectional link to the organization if their is one
  if input.organization.is_some() {
    create_link(
      input.organization.clone().unwrap(),
      offer_hash.clone(),
      LinkTypes::OrganizationOffers,
      (),
    )?;
    create_link(
      offer_hash.clone(),
      input.organization.clone().unwrap(),
      LinkTypes::OfferOrganization,
      (),
    )?;
  }

  // Create bidirectional links to service types
  for service_type_hash in input.service_type_hashes {
    link_to_service_type(ServiceTypeLinkInput {
      service_type_hash,
      action_hash: offer_hash.clone(),
      entity: "offer".to_string(),
    })?;
  }

  // Create bidirectional links to mediums of exchange
  for medium_of_exchange_hash in input.medium_of_exchange_hashes {
    link_to_medium_of_exchange(MediumOfExchangeLinkInput {
      medium_of_exchange_hash,
      action_hash: offer_hash.clone(),
      entity: "offer".to_string(),
    })?;
  }

  Ok(record)
}

#[hdk_extern]
pub fn get_offer(action_hash: ActionHash) -> ExternResult<Option<Record>> {
  get(action_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_offer_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  let link_type_filter = LinkTypes::OfferUpdates.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(
    original_action_hash.clone(),
    link_type_filter
  ), GetStrategy::Network)?;
  let latest_link = links
    .into_iter()
    .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
  let latest_action_hash = match latest_link {
    Some(link) => link
      .target
      .clone()
      .into_action_hash()
      .ok_or(CommonError::ActionHashNotFound("offer".to_string()))?,
    None => original_action_hash.clone(),
  };
  get(latest_action_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_offer(original_action_hash: ActionHash) -> ExternResult<Offer> {
  let record =
    get_latest_offer_record(original_action_hash.clone())?.ok_or(CommonError::EntryNotFound(
      format!("Offer not found for action hash: {}", original_action_hash),
    ))?;

  record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound("Could not deserialize offer entry".to_string()).into())
}

#[hdk_extern]
pub fn get_all_offers(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("offers");
  let path_hash = path.path_entry_hash()?;
  let link_type_filter = LinkTypes::AllOffers.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links =
    get_links(LinkQuery::new(path_hash.clone(), link_type_filter), GetStrategy::Network)?;
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
pub fn get_user_offers(user_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::UserOffers.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  // NOTE: Using GetStrategy::Local here since this is called by get_my_listings
  // which should only return the user's own offers from their local source chain
  let links =
    get_links(LinkQuery::new(user_hash.clone(), link_type_filter), GetStrategy::Local)?;
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
pub fn get_organization_offers(organization_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let link_type_filter = LinkTypes::OrganizationOffers.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(
    organization_hash.clone(),
    link_type_filter
  ), GetStrategy::Network)?;

  let get_input: Vec<GetInput> = links
    .into_iter()
    .map(|link| {
      link
        .target
        .into_any_dht_hash()
        .ok_or(CommonError::ActionHashNotFound("offer".to_string()))
        .map(|hash| GetInput::new(hash, GetOptions::default()))
    })
    .collect::<Result<Vec<GetInput>, CommonError>>()?;

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
  let records: Vec<Record> = records.into_iter().flatten().collect();
  Ok(records)
}

#[hdk_extern]
pub fn get_offer_creator(offer_hash: ActionHash) -> ExternResult<Option<ActionHash>> {
  let link_type_filter = LinkTypes::OfferCreator.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links =
    get_links(LinkQuery::new(offer_hash.clone(), link_type_filter), GetStrategy::Network)?;

  if links.is_empty() {
    Ok(None)
  } else {
    Ok(Some(links[0].target.clone().into_action_hash().ok_or(
      CommonError::ActionHashNotFound("offer creator".to_string()),
    )?))
  }
}

#[hdk_extern]
pub fn get_offer_organization(offer_hash: ActionHash) -> ExternResult<Option<ActionHash>> {
  let link_type_filter = LinkTypes::OfferOrganization.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(
    offer_hash.clone(),
    link_type_filter
  ), GetStrategy::Network)?;

  if links.is_empty() {
    Ok(None)
  } else {
    Ok(Some(links[0].target.clone().into_action_hash().ok_or(
      CommonError::ActionHashNotFound("offer organization".to_string()),
    )?))
  }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateOfferInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
  pub updated_offer: Offer,
  pub service_type_hashes: Vec<ActionHash>,
  pub medium_of_exchange_hashes: Vec<ActionHash>,
}

#[hdk_extern]
pub fn update_offer(input: UpdateOfferInput) -> ExternResult<Record> {
  let original_record = get(input.original_action_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the original offer".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator
  let author = original_record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
  }

  let updated_offer_hash = update_entry(input.previous_action_hash.clone(), &input.updated_offer)?;

  create_link(
    input.original_action_hash.clone(),
    updated_offer_hash.clone(),
    LinkTypes::OfferUpdates,
    (),
  )?;

  // Update service type links using the service_types zome
  update_service_type_links(UpdateServiceTypeLinksInput {
    action_hash: input.original_action_hash.clone(),
    entity: "offer".to_string(),
    new_service_type_hashes: input.service_type_hashes,
  })?;

  // Update medium of exchange links using the mediums_of_exchange zome
  update_medium_of_exchange_links(UpdateMediumOfExchangeLinksInput {
    action_hash: input.original_action_hash.clone(),
    entity: "offer".to_string(),
    new_medium_of_exchange_hashes: input.medium_of_exchange_hashes,
  })?;

  let record = get(updated_offer_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the newly updated Offer".to_string()),
  )?;

  Ok(record)
}

#[hdk_extern]
pub fn delete_offer(original_action_hash: ActionHash) -> ExternResult<bool> {
  let original_record = get(original_action_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the original offer".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator
  let author = original_record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
  }

  // Delete all offers links
  let path = Path::from("offers");
  let path_hash = path.path_entry_hash()?;
  let link_type_filter = LinkTypes::AllOffers.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let offers_links =
    get_links(LinkQuery::new(path_hash.clone(), link_type_filter), GetStrategy::Network)?;

  for link in offers_links {
    if let Some(hash) = link.target.clone().into_action_hash() {
      if hash == original_action_hash {
        delete_link(link.create_link_hash, GetOptions::default())?;
        break;
      }
    }
  }

  // Delete user links
  let link_type_filter = LinkTypes::OfferCreator.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let user_links = get_links(LinkQuery::new(
    original_action_hash.clone(),
    link_type_filter
  ), GetStrategy::Network)?;

  for link in user_links {
    // Get the user hash
    if let Some(user_hash) = link.target.clone().into_action_hash() {
      // Find and delete the UserOffers link
      let link_type_filter = LinkTypes::UserOffers.try_into_filter()
            .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
      let user_offers_links = get_links(LinkQuery::new(
        user_hash.clone(),
        link_type_filter
      ), GetStrategy::Network)?;

      for user_link in user_offers_links {
        if let Some(hash) = user_link.target.clone().into_action_hash() {
          if hash == original_action_hash {
            delete_link(user_link.create_link_hash, GetOptions::default())?;
            break;
          }
        }
      }

      // Delete the OfferCreator link
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  let link_type_filter = LinkTypes::OfferOrganization.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let org_links = get_links(LinkQuery::new(
    original_action_hash.clone(),
    link_type_filter
  ), GetStrategy::Network)?;

  // Delete OfferOrganization links
  for link in org_links {
    // Get the organization hash
    if let Some(org_hash) = link.target.clone().into_action_hash() {
      // Find and delete the OrganizationOffers link
      let link_type_filter = LinkTypes::OrganizationOffers.try_into_filter()
            .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
      let org_offers_links = get_links(LinkQuery::new(
        org_hash.clone(),
        link_type_filter
      ), GetStrategy::Network)?;

      for org_link in org_offers_links {
        if let Some(hash) = org_link.target.clone().into_action_hash() {
          if hash == original_action_hash {
            delete_link(org_link.create_link_hash, GetOptions::default())?;
            break;
          }
        }
      }

      // Delete the OfferOrganization link
      delete_link(link.create_link_hash, GetOptions::default())?;
    }
  }

  // Delete service type links using the service_types zome
  delete_all_service_type_links_for_entity(GetServiceTypeForEntityInput {
    original_action_hash: original_action_hash.clone(),
    entity: "offer".to_string(),
  })?;

  // Delete medium of exchange links using the mediums_of_exchange zome
  delete_all_medium_of_exchange_links_for_entity(GetMediumOfExchangeForEntityInput {
    original_action_hash: original_action_hash.clone(),
    entity: "offer".to_string(),
  })?;

  // Delete any update links
  let link_type_filter = LinkTypes::OfferUpdates.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let update_links = get_links(LinkQuery::new(
    original_action_hash.clone(),
    link_type_filter
  ), GetStrategy::Network)?;

  for link in update_links {
    delete_link(link.create_link_hash, GetOptions::default())?;
  }

  // Finally delete the offer entry
  delete_entry(original_action_hash.clone())?;

  Ok(true)
}

#[hdk_extern]
pub fn archive_offer(original_action_hash: ActionHash) -> ExternResult<bool> {
  let original_record = get(original_action_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the original offer".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator
  let author = original_record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
  }

  // Get the current offer
  let current_offer: Offer = original_record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(CommonError::EntryNotFound(
      "Could not deserialize offer entry".to_string(),
    ))?;

  // Update the offer with archived status
  let mut updated_offer = current_offer.clone();
  updated_offer.status = ListingStatus::Archived;

  // Create update entry
  let previous_action_hash = original_record.signed_action.hashed.hash.clone();
  update_entry(previous_action_hash.clone(), &updated_offer)?;

  // Create link to track the update
  create_link(
    original_action_hash.clone(),
    previous_action_hash,
    LinkTypes::OfferUpdates,
    (),
  )?;

  Ok(true)
}

#[hdk_extern]
pub fn get_my_listings(user_hash: ActionHash) -> ExternResult<Vec<Record>> {
  get_user_offers(user_hash)
}

#[hdk_extern]
pub fn get_offers_by_tag(tag: String) -> ExternResult<Vec<Record>> {
  use utils::external_local_call;

  // Call service_types zome to get service types with this tag
  let service_type_records: Vec<Record> =
    external_local_call("get_service_types_by_tag", "service_types", tag)?;

  // For each service type, get all offers that use it
  let mut all_offers = Vec::new();
  let mut seen_hashes = std::collections::HashSet::new();

  for service_type_record in service_type_records {
    let service_type_hash = service_type_record.signed_action.hashed.hash;

    // Call service_types zome to get offers for this service type
    let offers: Vec<Record> = external_local_call(
      "get_offers_for_service_type",
      "service_types",
      service_type_hash,
    )
    .unwrap_or_else(|_| Vec::new()); // Skip errors gracefully

    // Add to our collection, avoiding duplicates
    for offer in offers {
      let offer_hash = offer.signed_action.hashed.hash.clone();
      if !seen_hashes.contains(&offer_hash) {
        seen_hashes.insert(offer_hash);
        all_offers.push(offer);
      }
    }
  }

  Ok(all_offers)
}
