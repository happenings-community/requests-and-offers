use hdk::prelude::*;
use offers_integrity::*;
use utils::{
  errors::{CommonError, UsersError},
  GetServiceTypeForEntityInput, ServiceTypeLinkInput, UpdateServiceTypeLinksInput,
};

use crate::external_calls::{
  check_if_agent_is_administrator, delete_all_service_type_links_for_entity, get_agent_user,
  link_to_service_type, update_service_type_links,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct OfferInput {
  offer: Offer,
  organization: Option<ActionHash>,
  service_type_hashes: Vec<ActionHash>,
}

#[hdk_extern]
pub fn create_offer(input: OfferInput) -> ExternResult<Record> {
  let user_exists = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if user_exists.is_empty() {
    return Err(UsersError::UserProfileRequired.into());
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

  Ok(record)
}

#[hdk_extern]
pub fn get_latest_offer_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::OfferUpdates)?.build(),
  )?;
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
  let links =
    get_links(GetLinksInputBuilder::try_new(path_hash.clone(), LinkTypes::AllOffers)?.build())?;
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
  let links =
    get_links(GetLinksInputBuilder::try_new(user_hash.clone(), LinkTypes::UserOffers)?.build())?;
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
  let links = get_links(
    GetLinksInputBuilder::try_new(organization_hash.clone(), LinkTypes::OrganizationOffers)?
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

#[hdk_extern]
pub fn get_offer_creator(offer_hash: ActionHash) -> ExternResult<Option<ActionHash>> {
  let links =
    get_links(GetLinksInputBuilder::try_new(offer_hash.clone(), LinkTypes::OfferCreator)?.build())?;

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
  let links = get_links(
    GetLinksInputBuilder::try_new(offer_hash.clone(), LinkTypes::OfferOrganization)?.build(),
  )?;

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

  let record = get(updated_offer_hash, GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the updated offer".to_string()),
  )?;

  Ok(record)
}

#[hdk_extern]
pub fn delete_offer(original_action_hash: ActionHash) -> ExternResult<bool> {
  let record = get(original_action_hash.clone(), GetOptions::default())?.ok_or(
    CommonError::EntryNotFound("Could not find the original offer".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator
  let author = record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
  }

  // Delete links from all_offers
  let path = Path::from("offers");
  let path_hash = path.path_entry_hash()?;
  let all_offers_links =
    get_links(GetLinksInputBuilder::try_new(path_hash.clone(), LinkTypes::AllOffers)?.build())?;

  for link in all_offers_links {
    if let Some(hash) = link.target.clone().into_action_hash() {
      if hash == original_action_hash {
        delete_link(link.create_link_hash)?;
        break;
      }
    }
  }

  // Delete links from user offers
  let user_profile_links = get_agent_user(author)?;
  if !user_profile_links.is_empty() {
    let user_offers_links = get_links(
      GetLinksInputBuilder::try_new(user_profile_links[0].target.clone(), LinkTypes::UserOffers)?
        .build(),
    )?;

    for link in user_offers_links {
      if let Some(hash) = link.target.clone().into_action_hash() {
        if hash == original_action_hash {
          delete_link(link.create_link_hash)?;
          break;
        }
      }
    }
  }

  // Delete OfferCreator links
  let creator_links = get_links(
    GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::OfferCreator)?.build(),
  )?;

  for link in creator_links {
    delete_link(link.create_link_hash)?;
  }

  // Delete links from organization offers if any
  // First, get the organization hash from the offer
  let org_links = get_links(
    GetLinksInputBuilder::try_new(original_action_hash.clone(), LinkTypes::OfferOrganization)?
      .build(),
  )?;

  // Delete OfferOrganization links
  for link in org_links {
    // Get the organization hash
    if let Some(org_hash) = link.target.clone().into_action_hash() {
      // Find and delete the OrganizationOffers link
      let org_offers_links = get_links(
        GetLinksInputBuilder::try_new(org_hash.clone(), LinkTypes::OrganizationOffers)?.build(),
      )?;

      for org_link in org_offers_links {
        if let Some(hash) = org_link.target.clone().into_action_hash() {
          if hash == original_action_hash {
            delete_link(org_link.create_link_hash)?;
            break;
          }
        }
      }

      // Delete the OfferOrganization link
      delete_link(link.create_link_hash)?;
    }
  }

  // Delete service type links using the service_types zome
  delete_all_service_type_links_for_entity(GetServiceTypeForEntityInput {
    original_action_hash: original_action_hash.clone(),
    entity: "offer".to_string(),
  })?;

  // Delete the entry
  delete_entry(original_action_hash.clone())?;

  Ok(true)
}
