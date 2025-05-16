use hdk::prelude::*;
use service_types_integrity::*;
use utils::errors::{CommonError, ServiceTypesError};

#[derive(Serialize, Deserialize, Debug)]
pub struct ServiceTypeInput {
  pub name: String,
  pub description: Option<String>,
  pub category: Option<String>,
  pub tags: Vec<String>,
}

#[hdk_extern]
pub fn create_service_type(service_type_input: ServiceTypeInput) -> ExternResult<Record> {
  let service_type = ServiceType {
    name: service_type_input.name,
    description: service_type_input.description,
    category: service_type_input.category.clone(),
    tags: service_type_input.tags,
    verified: false, // New service types are unverified by default
  };

  let service_type_hash = create_entry(&EntryTypes::ServiceType(service_type.clone()))?;
  let record = get(service_type_hash.clone(), GetOptions::default())?.ok_or(
    ServiceTypesError::ServiceTypeNotFound(
      "Could not find the newly created service type".to_string(),
    ),
  )?;

  // Create a link to the "all service types" anchor
  let path = Path::from("service_types");
  let anchor_hash = path.path_entry_hash()?;
  create_link(
    anchor_hash,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    (),
  )?;

  // Create a link to the category if provided
  if let Some(category) = &service_type.category {
    let category_path = Path::from(format!("service_types_by_category.{}", category));
    let category_hash = category_path.path_entry_hash()?;
    create_link(
      category_hash,
      service_type_hash.clone(),
      LinkTypes::ServiceTypesByCategory,
      (),
    )?;
  }

  Ok(record)
}

#[hdk_extern]
pub fn get_service_type(service_type_hash: ActionHash) -> ExternResult<Option<ServiceType>> {
  let record = get(service_type_hash, GetOptions::default())?;

  match record {
    Some(record) => {
      let service_type = record
        .entry()
        .to_app_option::<ServiceType>()
        .map_err(|err| wasm_error!(WasmErrorInner::Guest(format!("{:?}", err))))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
          "Could not deserialize ServiceType"
        ))))?;

      Ok(Some(service_type))
    }
    None => Ok(None),
  }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateServiceTypeInput {
  pub original_action_hash: ActionHash,
  pub previous_action_hash: ActionHash,
  pub updated_service_type: ServiceTypeInput,
}

#[hdk_extern]
pub fn update_service_type(input: UpdateServiceTypeInput) -> ExternResult<Record> {
  let original_record =
    get(input.original_action_hash.clone(), GetOptions::default())?.ok_or(wasm_error!(
      WasmErrorInner::Guest(String::from("Original ServiceType not found"))
    ))?;

  let original_service_type = original_record
    .entry()
    .to_app_option::<ServiceType>()
    .map_err(|err| wasm_error!(WasmErrorInner::Guest(format!("{:?}", err))))?
    .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
      "Could not deserialize original ServiceType"
    ))))?;

  // Prepare the updated service type
  let updated_service_type = ServiceType {
    name: input.updated_service_type.name,
    description: input.updated_service_type.description,
    category: input.updated_service_type.category.clone(),
    tags: input.updated_service_type.tags,
    verified: original_service_type.verified, // Preserve verification status
  };

  // Update the entry
  let update_hash = update_entry(
    input.previous_action_hash,
    &EntryTypes::ServiceType(updated_service_type.clone()),
  )?;

  // Get the updated record
  let updated_record = get(update_hash.clone(), GetOptions::default())?.ok_or(wasm_error!(
    WasmErrorInner::Guest(String::from("Could not find the updated ServiceType"))
  ))?;

  // Update category links if category has changed
  if original_service_type.category != updated_service_type.category {
    // Remove old category link if it existed
    if let Some(old_category) = original_service_type.category {
      let old_category_path = Path::from(format!("service_types_by_category.{}", old_category));
      let old_category_hash = old_category_path.path_entry_hash()?;

      let links = get_links(
        GetLinksInputBuilder::try_new(old_category_hash, LinkTypes::ServiceTypesByCategory)?
          .build(),
      )?;
      for link in links {
        if let Some(target) = link.target.into_action_hash() {
          if target == input.original_action_hash {
            delete_link(link.create_link_hash)?;
            break;
          }
        }
      }
    }

    // Add new category link if provided
    if let Some(new_category) = updated_service_type.category {
      let new_category_path = Path::from(format!("service_types_by_category.{}", new_category));
      let new_category_hash = new_category_path.path_entry_hash()?;
      create_link(
        new_category_hash,
        update_hash,
        LinkTypes::ServiceTypesByCategory,
        (),
      )?;
    }
  }

  Ok(updated_record)
}

#[hdk_extern]
pub fn delete_service_type(service_type_hash: ActionHash) -> ExternResult<ActionHash> {
  // Get the service type to be deleted
  let maybe_service_type = get_service_type(service_type_hash.clone())?;

  if let Some(service_type) = maybe_service_type {
    // Delete the entry
    let delete_hash = delete_entry(service_type_hash.clone())?;

    // Delete the link from the "all service types" anchor
    let path = Path::from("service_types");
    let anchor_hash = path.path_entry_hash()?;
    let links =
      get_links(GetLinksInputBuilder::try_new(anchor_hash, LinkTypes::AllServiceTypes)?.build())?;

    for link in links {
      if let Some(target) = link.target.into_action_hash() {
        if target == service_type_hash {
          delete_link(link.create_link_hash)?;
          break;
        }
      }
    }

    // Delete the category link if it exists
    if let Some(category) = service_type.category {
      let category_path = Path::from(format!("service_types_by_category.{}", category));
      let category_hash = category_path.path_entry_hash()?;
      let links = get_links(
        GetLinksInputBuilder::try_new(category_hash, LinkTypes::ServiceTypesByCategory)?.build(),
      )?;

      for link in links {
        if let Some(target) = link.target.into_action_hash() {
          if target == service_type_hash {
            delete_link(link.create_link_hash)?;
            break;
          }
        }
      }
    }

    Ok(delete_hash)
  } else {
    Err(wasm_error!(WasmErrorInner::Guest(String::from(
      "ServiceType not found"
    ))))
  }
}

#[hdk_extern]
pub fn get_all_service_types(_: ()) -> ExternResult<Vec<Record>> {
  let path = Path::from("service_types");
  let anchor_hash = path.path_entry_hash()?;

  let links =
    get_links(GetLinksInputBuilder::try_new(anchor_hash, LinkTypes::AllServiceTypes)?.build())?;

  let get_input = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
    .collect::<Vec<GetInput>>();

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;

  let records = records.into_iter().flatten().collect();

  Ok(records)
}

#[hdk_extern]
pub fn get_service_types_by_category(category: String) -> ExternResult<Vec<Record>> {
  let category_path = Path::from(format!("service_types_by_category.{}", category));
  let category_hash = category_path.path_entry_hash()?;

  let links = get_links(
    GetLinksInputBuilder::try_new(category_hash, LinkTypes::ServiceTypesByCategory)?.build(),
  )?;

  let get_input = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
    .collect::<Vec<GetInput>>();

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;

  let records = records.into_iter().flatten().collect();

  Ok(records)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VerifyServiceTypeInput {
  pub service_type_hash: ActionHash,
  pub verified: bool,
}

#[hdk_extern]
pub fn verify_service_type(input: VerifyServiceTypeInput) -> ExternResult<Record> {
  // Get the original service type
  let original_record = get(input.service_type_hash.clone(), GetOptions::default())?.ok_or(
    wasm_error!(WasmErrorInner::Guest(String::from("ServiceType not found"))),
  )?;

  let original_service_type = original_record
    .entry()
    .to_app_option::<ServiceType>()
    .map_err(|err| wasm_error!(WasmErrorInner::Guest(format!("{:?}", err))))?
    .ok_or(wasm_error!(WasmErrorInner::Guest(String::from(
      "Could not deserialize ServiceType"
    ))))?;

  // Only change the verification status
  let updated_service_type = ServiceType {
    verified: input.verified,
    ..original_service_type
  };

  // Update the entry
  let update_hash = update_entry(
    input.service_type_hash,
    &EntryTypes::ServiceType(updated_service_type),
  )?;

  // Get the updated record
  let updated_record = get(update_hash, GetOptions::default())?.ok_or(wasm_error!(
    WasmErrorInner::Guest(String::from("Could not find the updated ServiceType"))
  ))?;

  Ok(updated_record)
}

// Functions for linking ServiceTypes to Requests and Offers

#[derive(Serialize, Deserialize, Debug)]
pub struct LinkServiceTypeInput {
  pub service_type_hash: ActionHash,
  pub target_hash: ActionHash,
}

#[hdk_extern]
pub fn link_service_type_to_request(input: LinkServiceTypeInput) -> ExternResult<()> {
  create_link(
    input.service_type_hash.clone(),
    input.target_hash.clone(),
    LinkTypes::ServiceTypeToRequest,
    (),
  )?;

  create_link(
    input.target_hash,
    input.service_type_hash,
    LinkTypes::RequestToServiceType,
    (),
  )?;

  Ok(())
}

#[hdk_extern]
pub fn link_service_type_to_offer(input: LinkServiceTypeInput) -> ExternResult<()> {
  create_link(
    input.service_type_hash.clone(),
    input.target_hash.clone(),
    LinkTypes::ServiceTypeToOffer,
    (),
  )?;

  create_link(
    input.target_hash,
    input.service_type_hash,
    LinkTypes::OfferToServiceType,
    (),
  )?;

  Ok(())
}

#[hdk_extern]
pub fn get_service_types_for_request(request_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(request_hash, LinkTypes::RequestToServiceType)?.build(),
  )?;

  let get_input = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
    .collect::<Vec<GetInput>>();

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;

  let records = records.into_iter().flatten().collect();

  Ok(records)
}

#[hdk_extern]
pub fn get_service_types_for_offer(offer_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links =
    get_links(GetLinksInputBuilder::try_new(offer_hash, LinkTypes::OfferToServiceType)?.build())?;

  let get_input = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
    .collect::<Vec<GetInput>>();

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;

  let records = records.into_iter().flatten().collect();

  Ok(records)
}

#[hdk_extern]
pub fn get_requests_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToRequest)?.build(),
  )?;

  let get_input = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
    .collect::<Vec<GetInput>>();

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;

  let records = records.into_iter().flatten().collect();

  Ok(records)
}

#[hdk_extern]
pub fn get_offers_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
  let links = get_links(
    GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToOffer)?.build(),
  )?;

  let get_input = links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
    .collect::<Vec<GetInput>>();

  let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;

  let records = records.into_iter().flatten().collect();

  Ok(records)
}
