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
//! A new listing also names the decision that approved its service type:
//! `service_type_approval`, the hash of a `ServiceTypeStatus` entry. Approval
//! is a status that moves over time, so no validator can ask whether a type
//! is approved *now* and get the same answer as every other peer. A decision
//! entry, though, never changes: validation reads it with
//! `must_get_valid_record` and checks that it decides this very service type
//! and that its decision is `Approved` ([`check_approval`]). An update carries
//! the same approval as the revision it updates. So a modified client cannot
//! post a listing under a suggestion nobody approved, or one that was
//! rejected, which would let it use the network without the role's say.
//!
//! The limit that remains: a service type approved and later retired can
//! still be named by its old approval, since that decision stays a valid
//! record. Honest clients refuse a retired type at the coordinator, which
//! names only the type's current approval. Closing this needs validation to
//! know which decision is the latest, which ordering by time cannot settle
//! the same way on every peer (see `utils::links::latest_catalogue_state`).

use hdk::prelude::*;

use crate::links::{writes, CatalogueState, EntryKind, MEDIUM_OF_EXCHANGE, MEDIUM_OF_EXCHANGE_STATUS, SERVICE_TYPE_STATUS};

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
  #[serde(default)]
  pub service_type_approval: Option<ActionHash>,
}

/// A shared catalogue whose items a listing names: what its decisions are
/// called, and which field of a decision names the item.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Catalogue {
  ServiceType,
  MediumOfExchange,
}

impl Catalogue {
  pub fn name(&self) -> &'static str {
    match self {
      Catalogue::ServiceType => "service type",
      Catalogue::MediumOfExchange => "medium of exchange",
    }
  }

  fn decision_kind(&self) -> &'static EntryKind {
    match self {
      Catalogue::ServiceType => &SERVICE_TYPE_STATUS,
      Catalogue::MediumOfExchange => &MEDIUM_OF_EXCHANGE_STATUS,
    }
  }
}

/// The fields of a `ServiceTypeStatus` or `MediumOfExchangeStatus` entry these
/// checks read. As with [`ListingServiceType`], decoding into this keeps the
/// listing zomes free of dependencies on the catalogue zomes: serde ignores
/// the grant, and the field the other catalogue uses is simply absent.
#[derive(Serialize, Deserialize, Debug, Clone, SerializedBytes)]
pub struct CatalogueDecision {
  #[serde(default)]
  pub service_type: Option<ActionHash>,
  #[serde(default)]
  pub medium_of_exchange: Option<ActionHash>,
  pub state: CatalogueState,
}

impl CatalogueDecision {
  fn item(&self, catalogue: Catalogue) -> Option<&ActionHash> {
    match catalogue {
      Catalogue::ServiceType => self.service_type.as_ref(),
      Catalogue::MediumOfExchange => self.medium_of_exchange.as_ref(),
    }
  }
}

/// The approval rule as a pure function: the decision is about this item, and
/// it approved it.
pub fn check_decision(decision: &CatalogueDecision, catalogue: Catalogue, item: &ActionHash) -> Result<(), String> {
  if decision.item(catalogue) != Some(item) {
    return Err(format!("names the approval of another {}", catalogue.name()));
  }
  match decision.state {
    CatalogueState::Approved => Ok(()),
    ref state => Err(format!(
      "names a decision that {} its {}, not an approval",
      match state {
        CatalogueState::Rejected => "rejected",
        CatalogueState::Retired => "retired",
        _ => "left pending",
      },
      catalogue.name()
    )),
  }
}

/// The approval a listing names for one catalogue item: a valid decision
/// record of that catalogue, about that item, that approved it.
/// `Ok(Err(reason))` is a refusal; the reason reads after "A request ".
pub fn check_approval(
  approval: &Option<ActionHash>,
  catalogue: Catalogue,
  item: &ActionHash,
) -> ExternResult<Result<(), String>> {
  let Some(approval) = approval else {
    return Ok(Err(format!("must name the approval of its {}", catalogue.name())));
  };
  let record = must_get_valid_record(approval.clone())?;
  if !matches!(record.action().data, ActionData::Create(_)) || !writes(record.action(), catalogue.decision_kind())? {
    return Ok(Err(format!(
      "names as its {} approval a record that is not a decision on a {}",
      catalogue.name(),
      catalogue.name()
    )));
  }
  let decision: CatalogueDecision = match record.entry().to_app_option() {
    Ok(Some(decision)) => decision,
    _ => return Ok(Err(format!("names a {} decision that could not be read", catalogue.name()))),
  };
  Ok(check_decision(&decision, catalogue, item))
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
  service_type_approval: &Option<ActionHash>,
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
      Ok(
        match check_approval(service_type_approval, Catalogue::ServiceType, service_type_hash)? {
          Ok(()) => ValidateCallbackResult::Valid,
          Err(reason) => invalid(format!("A {} {}", noun, reason)),
        },
      )
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
      if let Err(reason) = check_unchanged(&before.service_type_hash, service_type_hash) {
        return Ok(invalid(format!("A {}'s {}", noun, reason)));
      }
      Ok(
        match check_same_approval(&before.service_type_approval, service_type_approval) {
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

/// An update carries the approval the previous revision named, so an edit
/// never needs a fresh decision and never swaps one in.
pub fn check_same_approval(before: &Option<ActionHash>, after: &Option<ActionHash>) -> Result<(), String> {
  match (before, after) {
    (Some(before), Some(after)) if before == after => Ok(()),
    (None, _) => Err("previous revision names no service type approval".to_string()),
    _ => Err("service type approval cannot change on an update".to_string()),
  }
}

// ── Mediums of exchange ──────────────────────────────────────────────────────
//
// A listing's mediums of exchange are part of its terms, like its service type:
// set when it is created, never changed (a new listing for new terms). A
// listing names none (a gift), or up to `MAX_MEDIUMS_OF_EXCHANGE`, each with
// the decision that approved it, in the same order. The same limit applies as
// for the service type: a medium approved and later retired can still be named
// by its old approval; honest clients refuse it at the coordinator.

/// The most mediums of exchange one listing names. Each costs validation two
/// reads, so the bound keeps a listing's validation cheap; it is well above
/// what anyone picks.
pub const MAX_MEDIUMS_OF_EXCHANGE: usize = 8;

/// The two fields of a request or offer the medium checks read, as
/// [`ListingServiceType`] does for the service type, so
/// `mediums_of_exchange_integrity` takes no dependency on the listing zomes.
#[derive(Serialize, Deserialize, Debug, Clone, Default, SerializedBytes)]
pub struct ListingMediums {
  #[serde(default)]
  pub medium_of_exchange_hashes: Vec<ActionHash>,
  #[serde(default)]
  pub medium_of_exchange_approvals: Vec<ActionHash>,
}

/// The shape of a listing's mediums as a pure function: at most
/// [`MAX_MEDIUMS_OF_EXCHANGE`], each once, each with one approval.
pub fn check_medium_list(hashes: &[ActionHash], approvals: &[ActionHash]) -> Result<(), String> {
  if hashes.len() > MAX_MEDIUMS_OF_EXCHANGE {
    return Err(format!("names at most {} mediums of exchange", MAX_MEDIUMS_OF_EXCHANGE));
  }
  if approvals.len() != hashes.len() {
    return Err("must name one approval for each medium of exchange, in the same order".to_string());
  }
  for (i, hash) in hashes.iter().enumerate() {
    if hashes[..i].contains(hash) {
      return Err("names each medium of exchange once".to_string());
    }
  }
  Ok(())
}

/// An update keeps both lists exactly, as a pure function.
pub fn check_mediums_unchanged(before: &ListingMediums, after: &ListingMediums) -> Result<(), String> {
  if before.medium_of_exchange_hashes != after.medium_of_exchange_hashes {
    return Err("mediums of exchange cannot change; publish a new listing for different ones".to_string());
  }
  if before.medium_of_exchange_approvals != after.medium_of_exchange_approvals {
    return Err("medium of exchange approvals cannot change on an update".to_string());
  }
  Ok(())
}

/// The medium of exchange rule for a request or offer. `update` is the action
/// an update updates, `None` for a create; `noun` is "request" or "offer".
pub fn check_listing_mediums(
  mediums: &ListingMediums,
  update: Option<&ActionHash>,
  noun: &str,
) -> ExternResult<ValidateCallbackResult> {
  if let Some(previous) = update {
    let record = must_get_valid_record(previous.clone())?;
    let before: ListingMediums = match record.entry().to_app_option() {
      Ok(Some(listing)) => listing,
      _ => return Ok(invalid(format!("The {} this updates could not be read", noun))),
    };
    return Ok(match check_mediums_unchanged(&before, mediums) {
      Ok(()) => ValidateCallbackResult::Valid,
      Err(reason) => invalid(format!("A {}'s {}", noun, reason)),
    });
  }
  let (hashes, approvals) = (&mediums.medium_of_exchange_hashes, &mediums.medium_of_exchange_approvals);
  if let Err(reason) = check_medium_list(hashes, approvals) {
    return Ok(invalid(format!("A {} {}", noun, reason)));
  }
  for (hash, approval) in hashes.iter().zip(approvals) {
    let record = must_get_valid_record(hash.clone())?;
    if !matches!(record.action().data, ActionData::Create(_)) || !writes(record.action(), &MEDIUM_OF_EXCHANGE)? {
      return Ok(invalid(format!(
        "A {}'s medium of exchange must be the original record of a medium of exchange",
        noun
      )));
    }
    if let Err(reason) = check_approval(&Some(approval.clone()), Catalogue::MediumOfExchange, hash)? {
      return Ok(invalid(format!("A {} {}", noun, reason)));
    }
  }
  Ok(ValidateCallbackResult::Valid)
}

/// The link rule for a listing and a medium of exchange, in either direction:
/// the listing's own entry names that medium. `listing` is whichever end is
/// the listing; `listing_zome` the integrity zome it must belong to.
pub fn check_listing_medium_link(
  listing: AnyLinkableHash,
  medium: AnyLinkableHash,
  listing_zome: &str,
) -> ExternResult<ValidateCallbackResult> {
  let Some(listing) = listing.into_action_hash() else {
    return Ok(invalid("A listing's medium of exchange link must name the listing by action hash"));
  };
  let Some(medium) = medium.into_action_hash() else {
    return Ok(invalid("A listing's medium of exchange link must name the medium by action hash"));
  };
  let record = must_get_valid_record(listing)?;
  if !writes_entry_of(record.action(), listing_zome, LISTING_ENTRY_INDEX)? {
    return Ok(invalid("A listing's medium of exchange link must join a listing of that kind"));
  }
  let named: ListingMediums = match record.entry().to_app_option() {
    Ok(Some(listing)) => listing,
    _ => return Ok(invalid("The listing this link names could not be read")),
  };
  Ok(if named.medium_of_exchange_hashes.contains(&medium) {
    ValidateCallbackResult::Valid
  } else {
    invalid("A listing may be linked only to a medium of exchange its entry names")
  })
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

  fn decision(service_type: Option<u8>, medium: Option<u8>, state: CatalogueState) -> CatalogueDecision {
    CatalogueDecision {
      service_type: service_type.map(hash),
      medium_of_exchange: medium.map(hash),
      state,
    }
  }

  #[test]
  fn an_approval_is_an_approved_decision_on_this_item() {
    let st = Catalogue::ServiceType;
    assert_eq!(check_decision(&decision(Some(1), None, CatalogueState::Approved), st, &hash(1)), Ok(()));
    assert!(check_decision(&decision(Some(2), None, CatalogueState::Approved), st, &hash(1))
      .unwrap_err()
      .contains("another service type"));
    assert!(check_decision(&decision(Some(1), None, CatalogueState::Rejected), st, &hash(1))
      .unwrap_err()
      .contains("rejected"));
    assert!(check_decision(&decision(Some(1), None, CatalogueState::Retired), st, &hash(1))
      .unwrap_err()
      .contains("retired"));
    // A medium's decision never stands for a service type, even with the same hash.
    assert!(check_decision(&decision(None, Some(1), CatalogueState::Approved), st, &hash(1)).is_err());
    assert_eq!(
      check_decision(&decision(None, Some(1), CatalogueState::Approved), Catalogue::MediumOfExchange, &hash(1)),
      Ok(())
    );
  }

  #[test]
  fn a_listing_names_up_to_eight_mediums_each_once_each_approved() {
    let hashes: Vec<ActionHash> = (1..=8).map(hash).collect();
    let approvals: Vec<ActionHash> = (11..=18).map(hash).collect();
    assert_eq!(check_medium_list(&[], &[]), Ok(()), "a gift names none");
    assert_eq!(check_medium_list(&hashes, &approvals), Ok(()));
    let nine: Vec<ActionHash> = (1..=9).map(hash).collect();
    let nine_approvals: Vec<ActionHash> = (11..=19).map(hash).collect();
    assert!(check_medium_list(&nine, &nine_approvals).unwrap_err().contains("at most 8"));
    assert!(check_medium_list(&hashes, &approvals[..7]).unwrap_err().contains("one approval for each"));
    assert!(check_medium_list(&[hash(1), hash(1)], &[hash(11), hash(12)])
      .unwrap_err()
      .contains("each medium of exchange once"));
  }

  #[test]
  fn an_update_keeps_the_mediums_and_their_approvals() {
    let listed = ListingMediums {
      medium_of_exchange_hashes: vec![hash(1), hash(2)],
      medium_of_exchange_approvals: vec![hash(11), hash(12)],
    };
    assert_eq!(check_mediums_unchanged(&listed, &listed.clone()), Ok(()));
    let mut moved = listed.clone();
    moved.medium_of_exchange_hashes = vec![hash(1)];
    moved.medium_of_exchange_approvals = vec![hash(11)];
    assert!(check_mediums_unchanged(&listed, &moved).unwrap_err().contains("cannot change"));
    let mut swapped = listed.clone();
    swapped.medium_of_exchange_approvals = vec![hash(11), hash(13)];
    assert!(check_mediums_unchanged(&listed, &swapped).unwrap_err().contains("approvals cannot change"));
    // Reordering is a change too: the coordinator copies the lists, so an
    // honest update never reorders.
    let mut reordered = listed.clone();
    reordered.medium_of_exchange_hashes.reverse();
    reordered.medium_of_exchange_approvals.reverse();
    assert!(check_mediums_unchanged(&listed, &reordered).is_err());
  }

  #[test]
  fn an_update_keeps_the_approval() {
    assert_eq!(check_same_approval(&Some(hash(3)), &Some(hash(3))), Ok(()));
    assert!(check_same_approval(&Some(hash(3)), &Some(hash(4))).unwrap_err().contains("cannot change"));
    assert!(check_same_approval(&Some(hash(3)), &None).is_err());
    assert!(check_same_approval(&None, &Some(hash(3))).is_err());
  }

  #[test]
  fn a_decision_reads_through_the_partial_struct() {
    #[derive(Serialize, Deserialize, Debug)]
    struct ServiceTypeStatus {
      service_type: ActionHash,
      state: CatalogueState,
      grant: Option<ActionHash>,
    }
    holochain_serialized_bytes::holochain_serial!(ServiceTypeStatus);
    let bytes: SerializedBytes = ServiceTypeStatus {
      service_type: hash(5),
      state: CatalogueState::Approved,
      grant: Some(hash(6)),
    }
    .try_into()
    .unwrap();
    let read: CatalogueDecision = bytes.try_into().unwrap();
    assert_eq!(read.service_type, Some(hash(5)));
    assert_eq!(read.medium_of_exchange, None);
    assert_eq!(read.state, CatalogueState::Approved);
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
