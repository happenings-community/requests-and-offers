use hdk::prelude::*;
use offers_integrity::*;
use utils::errors::{CommonError, RequestsError};

use crate::external_calls::{check_if_agent_is_administrator, get_agent_user};

#[derive(Debug, Serialize, Deserialize)]
pub struct OfferInput {
  offer: Offer,
  organization: Option<ActionHash>,
}

#[hdk_extern]
pub fn create_offer(input: OfferInput) -> ExternResult<Record> {
  let user_exists = get_agent_user(agent_info()?.agent_initial_pubkey)?;
  if user_exists.is_empty() {
    return Err(
      RequestsError::UserProfileRequired("User profile must be created first".to_string()).into(),
    );
  }

  let offer_hash = create_entry(&EntryTypes::Offer(input.offer))?;

  let record = get(offer_hash.clone(), GetOptions::default())?.ok_or(
    RequestsError::RequestNotFound("Could not find the newly created offer".to_string()),
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
      .ok_or(CommonError::ActionHashNotFound("offer".into()))?,
    None => original_action_hash.clone(),
  };
  get(latest_action_hash, GetOptions::default())
}

#[hdk_extern]
pub fn get_latest_offer(original_action_hash: ActionHash) -> ExternResult<Offer> {
  let record = get_latest_offer_record(original_action_hash.clone())?.ok_or(
    RequestsError::RequestNotFound(format!(
      "Offer not found for action hash: {}",
      original_action_hash
    )),
  )?;

  record
    .entry()
    .to_app_option()
    .map_err(CommonError::Serialize)?
    .ok_or(RequestsError::RequestNotFound("Could not deserialize offer entry".to_string()).into())
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
      CommonError::ActionHashNotFound("offer creator".into()),
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
      CommonError::ActionHashNotFound("offer organization".into()),
    )?))
  }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateOfferInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
  pub updated_offer: Offer,
}

#[hdk_extern]
pub fn update_offer(input: UpdateOfferInput) -> ExternResult<Record> {
  let original_record = get(input.original_action_hash.clone(), GetOptions::default())?.ok_or(
    RequestsError::RequestNotFound("Could not find the original offer".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator
  let author = original_record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(
      RequestsError::NotAuthor(
        "Only the author or an administrator can update an Offer".to_string(),
      )
      .into(),
    );
  }

  let updated_offer_hash = update_entry(input.previous_action_hash.clone(), &input.updated_offer)?;

  create_link(
    input.original_action_hash.clone(),
    updated_offer_hash.clone(),
    LinkTypes::OfferUpdates,
    (),
  )?;

  let record = get(updated_offer_hash, GetOptions::default())?.ok_or(
    RequestsError::RequestNotFound("Could not find the updated offer".to_string()),
  )?;

  Ok(record)
}

#[hdk_extern]
pub fn delete_offer(original_action_hash: ActionHash) -> ExternResult<bool> {
  let record = get(original_action_hash.clone(), GetOptions::default())?.ok_or(
    RequestsError::RequestNotFound("Could not find the original offer".to_string()),
  )?;
  let agent_pubkey = agent_info()?.agent_initial_pubkey;

  // Check if the agent is the author or an administrator
  let author = record.action().author().clone();
  let is_author = author == agent_pubkey;
  let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

  if !is_author && !is_admin {
    return Err(
      RequestsError::NotAuthor(
        "Only the author or an administrator can delete an Offer".to_string(),
      )
      .into(),
    );
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

  // Delete the entry
  delete_entry(original_action_hash.clone())?;

  Ok(true)
}
