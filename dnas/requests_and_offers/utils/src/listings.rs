//! One listing names one service type, enforced by validation (#257).
//!
//! The service type is a listing's identity: set when it is created, never
//! changed. Change it by publishing a new listing. Requests and offers carry it
//! on the entry as `service_type_hash`, so the rule is a comparison of
//! content-addressed values, the same on every peer, rather than a count of
//! links, which differs by who validates and when.
//!
//! Three checks, all deterministic:
//!
//! - a new listing names a service type, and the hash names a `ServiceType`
//!   created in `service_types_integrity`;
//! - an update carries the same hash as the revision it updates, so every
//!   revision of a listing names the type its first one did;
//! - a link between a listing and a service type, in either direction, joins a
//!   listing to the type its own entry names ([`check_listing_link`]).
//!
//! What this does not check: whether the service type is approved. Approval is
//! a status that changes over time, so a validator cannot read it the same way
//! on every peer. The coordinator refuses an unapproved type at creation.

use hdk::prelude::*;

/// The integrity zome that registers `ServiceType`, as named in
/// `dnas/requests_and_offers/workdir/dna.yaml`.
pub const SERVICE_TYPES_INTEGRITY_ZOME: &str = "service_types_integrity";
/// The integrity zome that registers `Request`.
pub const REQUESTS_INTEGRITY_ZOME: &str = "requests_integrity";
/// The integrity zome that registers `Offer`.
pub const OFFERS_INTEGRITY_ZOME: &str = "offers_integrity";

/// `ServiceType`, `Request` and `Offer` are each entry 0 of their zome's
/// `EntryTypes`.
pub const LISTING_ENTRY_INDEX: u8 = 0;

/// The one field of a request or offer these checks read. Decoding a listing
/// into this, rather than into `Request` or `Offer`, keeps
/// `service_types_integrity` free of dependencies on the listing zomes: serde
/// ignores the other fields.
#[derive(Serialize, Deserialize, Debug, Clone, SerializedBytes)]
pub struct ListingServiceType {
  #[serde(default)]
  pub service_type_hash: Option<ActionHash>,
}

/// The index of a named integrity zome in this DNA.
pub fn integrity_zome_index(name: &str) -> ExternResult<ZomeIndex> {
  let position = dna_info()?
    .zome_names
    .iter()
    .position(|zome| zome.0.as_ref() == name)
    .ok_or_else(|| {
      wasm_error!(WasmErrorInner::Guest(format!(
        "{} is not an integrity zome of this DNA",
        name
      )))
    })?;
  Ok(ZomeIndex(position as u8))
}

/// Whether an action created or updated an entry of the given type in the
/// named integrity zome.
pub fn writes_entry_of(action: &Action, zome: &str, entry_index: u8) -> ExternResult<bool> {
  let Some(EntryType::App(def)) = action.entry_type() else {
    return Ok(false);
  };
  Ok(def.zome_index == integrity_zome_index(zome)? && def.entry_index == EntryDefIndex(entry_index))
}

fn invalid(reason: impl Into<String>) -> ValidateCallbackResult {
  ValidateCallbackResult::Invalid(reason.into())
}

/// The service type rule for a request or offer. `update` is the action an
/// update updates, `None` for a create; `noun` is "request" or "offer", for
/// the reason.
pub fn check_listing_service_type(
  service_type_hash: &Option<ActionHash>,
  update: Option<&ActionHash>,
  noun: &str,
) -> ExternResult<ValidateCallbackResult> {
  let Some(service_type_hash) = service_type_hash else {
    return Ok(invalid(format!("A {} must name its service type", noun)));
  };

  match update {
    None => {
      let record = must_get_valid_record(service_type_hash.clone())?;
      let is_create = matches!(record.action().data, ActionData::Create(_));
      if !is_create
        || !writes_entry_of(
          record.action(),
          SERVICE_TYPES_INTEGRITY_ZOME,
          LISTING_ENTRY_INDEX,
        )?
      {
        return Ok(invalid(format!(
          "A {}'s service type must be the original record of a service type",
          noun
        )));
      }
      Ok(ValidateCallbackResult::Valid)
    }
    Some(previous) => {
      let record = must_get_valid_record(previous.clone())?;
      let before: ListingServiceType = match record.entry().to_app_option() {
        Ok(Some(listing)) => listing,
        _ => {
          return Ok(invalid(format!(
            "The {} this updates could not be read",
            noun
          )))
        }
      };
      Ok(
        match check_unchanged(&before.service_type_hash, service_type_hash) {
          Ok(()) => ValidateCallbackResult::Valid,
          Err(reason) => invalid(format!("A {}'s {}", noun, reason)),
        },
      )
    }
  }
}

/// The update rule as a pure function: the service type is the one the
/// previous revision named.
pub fn check_unchanged(before: &Option<ActionHash>, after: &ActionHash) -> Result<(), String> {
  match before {
    Some(before) if before == after => Ok(()),
    Some(_) => {
      Err("service type cannot change; publish a new listing for a different one".to_string())
    }
    None => Err("previous revision names no service type".to_string()),
  }
}

/// The link rule for a listing and its service type, in either direction:
/// the listing's own entry names the service type at the other end.
///
/// `listing` is whichever end is the listing; `service_type` the other.
/// `listing_zome` is the integrity zome the listing must belong to.
pub fn check_listing_link(
  listing: AnyLinkableHash,
  service_type: AnyLinkableHash,
  listing_zome: &str,
) -> ExternResult<ValidateCallbackResult> {
  let Some(listing) = listing.into_action_hash() else {
    return Ok(invalid(
      "A listing's service type link must name the listing by action hash",
    ));
  };
  let Some(service_type) = service_type.into_action_hash() else {
    return Ok(invalid(
      "A listing's service type link must name the service type by action hash",
    ));
  };

  let record = must_get_valid_record(listing)?;
  if !writes_entry_of(record.action(), listing_zome, LISTING_ENTRY_INDEX)? {
    return Ok(invalid(
      "A listing's service type link must join a listing of that kind",
    ));
  }
  let named: ListingServiceType = match record.entry().to_app_option() {
    Ok(Some(listing)) => listing,
    _ => return Ok(invalid("The listing this link names could not be read")),
  };
  Ok(
    match check_link_target(&named.service_type_hash, &service_type) {
      Ok(()) => ValidateCallbackResult::Valid,
      Err(reason) => invalid(reason),
    },
  )
}

/// The link rule as a pure function.
pub fn check_link_target(named: &Option<ActionHash>, linked: &ActionHash) -> Result<(), String> {
  match named {
    Some(named) if named == linked => Ok(()),
    Some(_) => Err("A listing may be linked only to the service type its entry names".to_string()),
    None => Err("A listing that names no service type cannot be linked to one".to_string()),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn hash(byte: u8) -> ActionHash {
    ActionHash::from_raw_36(vec![byte; 36])
  }

  #[test]
  fn an_update_keeps_the_service_type() {
    assert_eq!(check_unchanged(&Some(hash(1)), &hash(1)), Ok(()));
    assert!(check_unchanged(&Some(hash(1)), &hash(2))
      .unwrap_err()
      .contains("cannot change"));
    assert!(check_unchanged(&None, &hash(2)).is_err());
  }

  #[test]
  fn a_link_joins_a_listing_to_its_own_service_type() {
    assert_eq!(check_link_target(&Some(hash(1)), &hash(1)), Ok(()));
    assert!(check_link_target(&Some(hash(1)), &hash(2))
      .unwrap_err()
      .contains("its entry names"));
    assert!(check_link_target(&None, &hash(1)).is_err());
  }

  #[test]
  fn the_partial_struct_reads_a_listing_and_tolerates_one_without_the_field() {
    #[derive(Serialize, Deserialize, Debug)]
    struct Fuller {
      title: String,
      service_type_hash: Option<ActionHash>,
      grant: Option<ActionHash>,
    }
    holochain_serialized_bytes::holochain_serial!(Fuller);
    let bytes: SerializedBytes = Fuller {
      title: "A lift".into(),
      service_type_hash: Some(hash(7)),
      grant: None,
    }
    .try_into()
    .unwrap();
    let read: ListingServiceType = bytes.try_into().unwrap();
    assert_eq!(read.service_type_hash, Some(hash(7)));

    #[derive(Serialize, Deserialize, Debug)]
    struct Older {
      title: String,
    }
    holochain_serialized_bytes::holochain_serial!(Older);
    let bytes: SerializedBytes = Older { title: "x".into() }.try_into().unwrap();
    let read: ListingServiceType = bytes.try_into().unwrap();
    assert_eq!(read.service_type_hash, None);
  }
}
