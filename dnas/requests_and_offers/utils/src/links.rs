//! The rule every link type follows (#234), in parts each zome composes.
//!
//! Holochain validates links like any other op, and a link's tag can carry up
//! to a kilobyte of anything. A link type with no rule can be written by any
//! agent, with any base, any target and any tag, and a modified client can
//! use it as a channel. So every link type here has a rule in three parts:
//!
//! - **Shape**: the base and the target are what the type declares (an agent
//!   key, one of the type's named paths, or a record that writes a named
//!   entry type), and the tag is empty unless the type declares a grant in it.
//! - **Writer**: the link's author is the author of the record it hangs from,
//!   or, where a role acts for someone else, holds the grant named in the tag.
//! - **Tombstone**: only the link's author tombstones it, a type that is never
//!   tombstoned refuses every tombstone, and the types still tombstoned by a
//!   role holder when a status moves are left open until status is held in
//!   entries (#234 phase 2), a limit stated where each type is routed.
//!
//! Nothing on a DHT is deleted: a `DeleteLink` writes a tombstone, which
//! readers treat as removing the link. It carries no tag, so it cannot carry a
//! grant either.
//!
//! Every read here is `must_get_action` or `dna_info`, so every peer reaches
//! the same verdict.

use hdk::prelude::*;

use crate::grants::{check_act, grant_from_tag, Ability};

pub const SERVICE_TYPES_INTEGRITY_ZOME: &str = "service_types_integrity";
pub const MEDIUMS_OF_EXCHANGE_INTEGRITY_ZOME: &str = "mediums_of_exchange_integrity";
pub const OFFERS_INTEGRITY_ZOME: &str = "offers_integrity";
pub const REQUESTS_INTEGRITY_ZOME: &str = "requests_integrity";
pub const USERS_ORGANIZATIONS_ZOME: &str = "users_organizations_integrity";
pub const ADMINISTRATION_ZOME: &str = "administration_integrity";

/// An entry type, by the integrity zome that registers it and its index in
/// that zome's `EntryTypes`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct EntryKind {
  pub zome: &'static str,
  pub index: u8,
  pub name: &'static str,
}

pub const SERVICE_TYPE: EntryKind = EntryKind { zome: SERVICE_TYPES_INTEGRITY_ZOME, index: 0, name: "service type" };
pub const MEDIUM_OF_EXCHANGE: EntryKind =
  EntryKind { zome: MEDIUMS_OF_EXCHANGE_INTEGRITY_ZOME, index: 0, name: "medium of exchange" };
pub const OFFER: EntryKind = EntryKind { zome: OFFERS_INTEGRITY_ZOME, index: 0, name: "offer" };
pub const REQUEST: EntryKind = EntryKind { zome: REQUESTS_INTEGRITY_ZOME, index: 0, name: "request" };
pub const USER: EntryKind = EntryKind { zome: USERS_ORGANIZATIONS_ZOME, index: 0, name: "user" };
pub const ORGANIZATION: EntryKind = EntryKind { zome: USERS_ORGANIZATIONS_ZOME, index: 1, name: "organisation" };
pub const STATUS: EntryKind = EntryKind { zome: ADMINISTRATION_ZOME, index: 0, name: "status" };
pub const ORGANIZATION_RETIREMENT: EntryKind =
  EntryKind { zome: USERS_ORGANIZATIONS_ZOME, index: 2, name: "organisation retirement" };
pub const MEMBERSHIP_END: EntryKind =
  EntryKind { zome: USERS_ORGANIZATIONS_ZOME, index: 3, name: "membership end" };
pub const SERVICE_TYPE_STATUS: EntryKind =
  EntryKind { zome: SERVICE_TYPES_INTEGRITY_ZOME, index: 1, name: "service type status" };
pub const MEDIUM_OF_EXCHANGE_STATUS: EntryKind =
  EntryKind { zome: MEDIUMS_OF_EXCHANGE_INTEGRITY_ZOME, index: 1, name: "medium of exchange status" };

/// Where a shared catalogue item (a service type or a medium of exchange)
/// stands. A suggestion is `Pending` until a role holder decides; each
/// decision is a status entry carrying the decider's grant, never an edit of
/// the item and never a tombstone (#234). The latest status entry stands.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum CatalogueState {
  Pending,
  Approved,
  Rejected,
  Retired,
}

impl CatalogueState {
  pub fn as_str(&self) -> &'static str {
    match self {
      CatalogueState::Pending => "pending",
      CatalogueState::Approved => "approved",
      CatalogueState::Rejected => "rejected",
      CatalogueState::Retired => "retired",
    }
  }
}

/// The rule for a catalogue status entry: written by a role holder, whose
/// grant it carries, about the original record of an item of `item` kind,
/// and never `Pending`, which is what an item is before any decision.
pub fn check_catalogue_status(
  subject: &ActionHash,
  state: &CatalogueState,
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
  item: &EntryKind,
) -> ExternResult<ValidateCallbackResult> {
  if *state == CatalogueState::Pending {
    return Ok(invalid("a status entry records a decision, so it is never Pending"));
  }
  let action = must_get_action(subject.clone())?;
  if !matches!(action.action().data, ActionData::Create(_)) || !writes(action.action(), item)? {
    return Ok(invalid(format!("a status names the original record of a {}", item.name)));
  }
  Ok(match check_act(grant, author, &Ability::Administer, &None)? {
    Ok(_) => ValidateCallbackResult::Valid,
    Err(reason) => invalid(format!("deciding a {}'s status is a role act: {}", item.name, reason)),
  })
}

/// The tag of a status-update link: one byte naming the decision. Readers take
/// a catalogue item's state from these tags, so they never fetch a status
/// entry and cannot miss one; validation checks the tag against the entry
/// (#234, from Aria's read of `current_state`). `Pending` maps to 0 for
/// completeness only: no call site writes it, and validation refuses it.
pub fn catalogue_state_tag(state: &CatalogueState) -> LinkTag {
  LinkTag::new(vec![match state {
    CatalogueState::Pending => 0,
    CatalogueState::Approved => 1,
    CatalogueState::Rejected => 2,
    CatalogueState::Retired => 3,
  }])
}

/// The decision a status-update link's tag names.
pub fn catalogue_state_from_tag(tag: &LinkTag) -> Result<CatalogueState, String> {
  match tag.0.as_slice() {
    [1] => Ok(CatalogueState::Approved),
    [2] => Ok(CatalogueState::Rejected),
    [3] => Ok(CatalogueState::Retired),
    _ => Err("a status link's tag names the decision: approved, rejected or retired".to_string()),
  }
}

/// The state a set of status-update links leaves an item in: the latest by
/// time, ties broken by the link's hash so every peer agrees, and pending if
/// there are none. Links whose tag does not read are skipped; validation
/// refuses them, so none should exist.
///
/// Ordering by time is not ordering by arrival, so the tag does not remove
/// the clock (Aria, 26 Oct). A reader that has not yet received the newest
/// decision reads the one before it, so two reads can show the state moving
/// back. A decision made later on a clock that runs behind loses to the one
/// before it. As with an entry's latest version, acceptable for alpha 2; what
/// the tag removes is the missed fetch and the tie.
pub fn latest_catalogue_state(links: &[Link]) -> CatalogueState {
  links
    .iter()
    .filter_map(|link| {
      catalogue_state_from_tag(&link.tag)
        .ok()
        .map(|state| ((link.timestamp, link.create_link_hash.clone()), state))
    })
    .max_by(|(a, _), (b, _)| a.cmp(b))
    .map(|(_, state)| state)
    .unwrap_or(CatalogueState::Pending)
}

/// The rule for retiring an organisation. An organisation is shared: members,
/// coordinators, listings and exchanges name it, so nobody tombstones it.
/// Its coordinators, or an administrator, retire it instead, with a grant
/// that covers `Coordinate` for that very organisation. The organisation named
/// is the original record, so a retirement cannot hang off a revision.
pub fn check_organization_retirement(
  organization: &ActionHash,
  grant: &ActionHash,
  author: &AgentPubKey,
) -> ExternResult<ValidateCallbackResult> {
  let action = must_get_action(organization.clone())?;
  if !matches!(action.action().data, ActionData::Create(_)) || !writes(action.action(), &ORGANIZATION)? {
    return Ok(invalid("a retirement names the original record of an organisation"));
  }
  Ok(match check_act(&Some(grant.clone()), author, &Ability::Coordinate, &Some(organization.clone()))? {
    Ok(_) => ValidateCallbackResult::Valid,
    Err(reason) => invalid(format!(
      "retiring an organisation needs a coordinator's or an administrator's grant for it: {}",
      reason
    )),
  })
}

/// Whether `author` may act on someone's place in an organisation: the member
/// themselves (the creator of the user record), or the holder of a grant that
/// covers `Coordinate` for that organisation (its coordinators, an
/// administrator) or `ChangeStatus` (an administrator or steward, as when an
/// approval makes the creator a member). The same rule the grants stack gives
/// the member and coordinator links.
pub fn check_membership_act(
  organization: &ActionHash,
  user: &ActionHash,
  grant: &Option<ActionHash>,
  author: &AgentPubKey,
) -> ExternResult<Result<(), String>> {
  match crate::grants::creator_of(user)? {
    Ok(creator) if &creator == author => return Ok(Ok(())),
    Ok(_) => {}
    Err(reason) => return Ok(Err(reason)),
  }
  let as_coordinator = check_act(grant, author, &Ability::Coordinate, &Some(organization.clone()))?;
  if as_coordinator.is_ok() {
    return Ok(Ok(()));
  }
  Ok(match check_act(grant, author, &Ability::ChangeStatus, &None)? {
    Ok(_) => Ok(()),
    Err(_) => Err(format!(
      "only the member, or a coordinator or administrator with a grant, acts on a membership: {}",
      as_coordinator.err().unwrap_or_default()
    )),
  })
}

/// The most links one membership end may name: a member link, a coordinator
/// link and the user's link to the organisation, with room for one more.
pub const MAX_ENDED_LINKS: usize = 4;

/// The tag of a `MembershipEnds` link: the hashes of the links the end closes,
/// one after another. Readers learn which links are closed without fetching
/// the entry; validation checks the tag against the entry (#234). An end names
/// links, not a time, so no clock decides whether a membership stands.
pub fn membership_end_tag(links: &[ActionHash]) -> LinkTag {
  LinkTag::new(links.iter().flat_map(|link| link.get_raw_39().to_vec()).collect::<Vec<u8>>())
}

/// The links a `MembershipEnds` tag names.
pub fn membership_end_from_tag(tag: &LinkTag) -> Result<Vec<ActionHash>, String> {
  let bytes = &tag.0;
  let count = bytes.len() / 39;
  if bytes.is_empty() || !bytes.len().is_multiple_of(39) || count > MAX_ENDED_LINKS {
    return Err(format!("a membership end's tag names 1 to {} link hashes", MAX_ENDED_LINKS));
  }
  bytes
    .chunks(39)
    .map(|chunk| {
      ActionHash::try_from_raw_39(chunk.to_vec()).map_err(|_| "a membership end's tag names link hashes".to_string())
    })
    .collect()
}

/// What one end of a link must be.
#[derive(Debug, Clone, Copy)]
pub enum End {
  /// An agent key.
  Agent,
  /// The hash of one of these paths.
  Path(&'static [&'static str]),
  /// A create or update action that writes one of these entry types.
  Record(&'static [EntryKind]),
}

fn invalid(reason: impl Into<String>) -> ValidateCallbackResult {
  ValidateCallbackResult::Invalid(reason.into())
}

/// The index of a named integrity zome in this DNA.
pub fn zome_index_of(name: &str) -> ExternResult<ZomeIndex> {
  let position = dna_info()?
    .zome_names
    .iter()
    .position(|zome| zome.0.as_ref() == name)
    .ok_or_else(|| wasm_error!(WasmErrorInner::Guest(format!("{} is not a zome of this DNA", name))))?;
  Ok(ZomeIndex(position as u8))
}

/// Whether an action writes an entry of the given kind.
pub fn writes(action: &Action, kind: &EntryKind) -> ExternResult<bool> {
  let Some(EntryType::App(def)) = action.entry_type() else {
    return Ok(false);
  };
  Ok(def.zome_index == zome_index_of(kind.zome)? && def.entry_index == EntryDefIndex(kind.index))
}

/// The hash of each named path.
pub fn path_hashes(paths: &[&str]) -> ExternResult<Vec<EntryHash>> {
  paths.iter().map(|p| Path::from(*p).path_entry_hash()).collect()
}

/// The checked end of a link: for a record, its author, so a writer rule can
/// compare it with the link's author.
#[derive(Debug, Clone, PartialEq)]
pub enum Checked {
  Agent(AgentPubKey),
  Path(String),
  Record(AgentPubKey),
}

/// Checks one end of a link against what its type declares. `Ok(Err(reason))`
/// is a refusal.
pub fn check_end(hash: &AnyLinkableHash, end: &End, which: &str) -> ExternResult<Result<Checked, String>> {
  match end {
    End::Agent => match hash.clone().into_agent_pub_key() {
      Some(agent) => Ok(Ok(Checked::Agent(agent))),
      None => Ok(Err(format!("the link's {} must be an agent key", which))),
    },
    End::Path(paths) => {
      let Some(entry_hash) = hash.clone().into_entry_hash() else {
        return Ok(Err(format!("the link's {} must be one of its named paths", which)));
      };
      for (path, path_hash) in paths.iter().zip(path_hashes(paths)?) {
        if path_hash == entry_hash {
          return Ok(Ok(Checked::Path((*path).to_string())));
        }
      }
      Ok(Err(format!("the link's {} must be one of: {}", which, paths.join(", "))))
    }
    End::Record(kinds) => {
      let Some(action_hash) = hash.clone().into_action_hash() else {
        return Ok(Err(format!("the link's {} must be a record", which)));
      };
      let action = must_get_action(action_hash)?;
      let action = action.action();
      if !matches!(action.data, ActionData::Create(_) | ActionData::Update(_)) {
        return Ok(Err(format!("the link's {} must be a create or an update", which)));
      }
      for kind in kinds.iter() {
        if writes(action, kind)? {
          return Ok(Ok(Checked::Record(action.author().clone())));
        }
      }
      let names: Vec<&str> = kinds.iter().map(|k| k.name).collect();
      Ok(Err(format!("the link's {} must be a {}", which, names.join(" or "))))
    }
  }
}

/// The tag rule for every link that carries no grant: empty.
pub fn check_empty_tag(tag: &LinkTag) -> Result<(), String> {
  if tag.0.is_empty() {
    Ok(())
  } else {
    Err("this link's tag must be empty".to_string())
  }
}

/// The writer is the author of that end: the record's author, or the agent
/// key itself.
pub fn check_author_of(end: &Checked, author: &AgentPubKey, which: &str) -> Result<(), String> {
  match end {
    Checked::Record(record_author) | Checked::Agent(record_author) if record_author == author => Ok(()),
    Checked::Record(_) => Err(format!("only the author of the link's {} may write this link", which)),
    Checked::Agent(_) => Err(format!("the link's {} must be its author's own key", which)),
    Checked::Path(_) => Err(format!("the link's {} is a path, which has no author", which)),
  }
}

/// A role acting for someone else: the tag names a grant its author holds,
/// for this ability.
pub fn check_grant_tag(
  tag: &LinkTag,
  author: &AgentPubKey,
  ability: &Ability,
) -> ExternResult<Result<(), String>> {
  let grant = match grant_from_tag(tag) {
    Ok(grant) => grant,
    Err(reason) => return Ok(Err(reason)),
  };
  Ok(check_act(&Some(grant), author, ability, &None)?.map(|_| ()))
}

/// Turns a refusal into the validation result, naming the link type.
pub fn verdict(result: Result<(), String>, link: &str) -> ValidateCallbackResult {
  match result {
    Ok(()) => ValidateCallbackResult::Valid,
    Err(reason) => invalid(format!("{}: {}", link, reason)),
  }
}

/// How a link type may be tombstoned.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Tombstone {
  /// By the link's own author only.
  Author,
  /// Never: the type is an index of something that stays.
  Never,
  /// By anyone, for now. A role holder tombstones another agent's link of this
  /// type when a status moves; a tombstone carries no grant, so validation
  /// cannot tell that role holder from anyone else until status is held in
  /// entries (#234 phase 2).
  Open,
}

/// The tombstone rule, given the original link's author and the tombstoner.
pub fn check_tombstone(rule: Tombstone, link_author: &AgentPubKey, author: &AgentPubKey) -> Result<(), String> {
  match rule {
    Tombstone::Open => Ok(()),
    Tombstone::Never => Err("this link is never tombstoned".to_string()),
    Tombstone::Author if link_author == author => Ok(()),
    Tombstone::Author => Err("only the link's author may tombstone it".to_string()),
  }
}

/// A link type nothing writes refuses every create.
pub fn unused(link: &str) -> ValidateCallbackResult {
  invalid(format!("{}: nothing writes this link type", link))
}

/// Who may write a link with an empty tag.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Writer {
  /// The author of the record (or the agent key) at the base.
  AuthorOfBase,
  /// The author of the record (or the agent key) at the target.
  AuthorOfTarget,
  /// The author of both ends.
  AuthorOfBoth,
  /// Anyone whose link has the declared shape, for now: written today both by
  /// an author and by a role holder acting for them, with no grant in the tag.
  /// Stated where each such type is routed.
  Open,
}

/// One link type's whole rule, for the types whose tag is always empty.
#[derive(Debug, Clone, Copy)]
pub struct Spec {
  pub name: &'static str,
  pub base: End,
  pub target: End,
  pub writer: Writer,
  pub tombstone: Tombstone,
}

/// The create rule for a type with an empty tag: shape, then writer.
pub fn check_create(
  spec: &Spec,
  author: &AgentPubKey,
  base: &AnyLinkableHash,
  target: &AnyLinkableHash,
  tag: &LinkTag,
) -> ExternResult<ValidateCallbackResult> {
  let base_end = match check_end(base, &spec.base, "base")? {
    Ok(end) => end,
    Err(reason) => return Ok(verdict(Err(reason), spec.name)),
  };
  let target_end = match check_end(target, &spec.target, "target")? {
    Ok(end) => end,
    Err(reason) => return Ok(verdict(Err(reason), spec.name)),
  };
  if let Err(reason) = check_empty_tag(tag) {
    return Ok(verdict(Err(reason), spec.name));
  }
  let writer = match spec.writer {
    Writer::AuthorOfBase => check_author_of(&base_end, author, "base"),
    Writer::AuthorOfTarget => check_author_of(&target_end, author, "target"),
    Writer::AuthorOfBoth => {
      check_author_of(&base_end, author, "base").and_then(|_| check_author_of(&target_end, author, "target"))
    }
    Writer::Open => Ok(()),
  };
  Ok(verdict(writer, spec.name))
}

/// The tombstone rule, for any type.
pub fn check_delete(
  name: &str,
  tombstone: Tombstone,
  link_author: &AgentPubKey,
  author: &AgentPubKey,
) -> ValidateCallbackResult {
  verdict(check_tombstone(tombstone, link_author, author), name)
}

/// The rule for tombstoning an entry of `kind` that only its creator may
/// tombstone. A role holder removes such an entry by an update that carries
/// their grant instead, since a tombstone carries no grant (#234). Run for
/// both ops a tombstone produces: the record op (`OpRecord::DeleteEntry`) and
/// the entry op (`FlatOp::Delete`).
pub fn check_creator_tombstone(
  deletes_address: &ActionHash,
  author: &AgentPubKey,
  kind: &EntryKind,
) -> ExternResult<ValidateCallbackResult> {
  let record = must_get_valid_record(deletes_address.clone())?;
  if !writes(record.action(), kind)? {
    return Ok(ValidateCallbackResult::Valid);
  }
  Ok(match crate::grants::creator_of(deletes_address)? {
    Ok(creator) if &creator == author => ValidateCallbackResult::Valid,
    Ok(_) => invalid(format!(
      "only a {}'s creator tombstones it; a role holder removes it with an update that says who and why",
      kind.name
    )),
    Err(reason) => invalid(reason),
  })
}

/// The rule for an entry of `kind` that is never tombstoned, by anyone: a
/// shared thing, retired or rejected by a role holder through its status.
pub fn refuse_tombstone(deletes_address: &ActionHash, kind: &EntryKind) -> ExternResult<ValidateCallbackResult> {
  let record = must_get_valid_record(deletes_address.clone())?;
  if !writes(record.action(), kind)? {
    return Ok(ValidateCallbackResult::Valid);
  }
  Ok(invalid(format!(
    "a {} is never tombstoned; a role holder retires it through its status",
    kind.name
  )))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn agent(byte: u8) -> AgentPubKey {
    AgentPubKey::from_raw_36(vec![byte; 36])
  }

  #[test]
  fn a_catalogue_state_tag_round_trips_and_pending_never_does() {
    for state in [CatalogueState::Approved, CatalogueState::Rejected, CatalogueState::Retired] {
      assert_eq!(catalogue_state_from_tag(&catalogue_state_tag(&state)), Ok(state));
    }
    assert!(catalogue_state_from_tag(&catalogue_state_tag(&CatalogueState::Pending)).is_err());
    assert!(catalogue_state_from_tag(&LinkTag::new(vec![])).is_err());
  }

  #[test]
  fn a_membership_end_tag_round_trips() {
    let links: Vec<ActionHash> = (1..=3).map(|b| ActionHash::from_raw_36(vec![b; 36])).collect();
    assert_eq!(membership_end_from_tag(&membership_end_tag(&links)), Ok(links.clone()));
    assert!(membership_end_from_tag(&LinkTag::new(vec![])).is_err());
    assert!(membership_end_from_tag(&LinkTag::new(vec![1; 40])).is_err());
    let five: Vec<ActionHash> = (1..=5).map(|b| ActionHash::from_raw_36(vec![b; 36])).collect();
    assert!(membership_end_from_tag(&membership_end_tag(&five)).is_err());
  }

  #[test]
  fn a_tag_must_be_empty() {
    assert_eq!(check_empty_tag(&LinkTag::new(vec![])), Ok(()));
    assert!(check_empty_tag(&LinkTag::new(b"anything".to_vec())).is_err());
  }

  #[test]
  fn the_writer_is_the_author_of_that_end() {
    let alice = agent(1);
    let bob = agent(2);
    assert_eq!(check_author_of(&Checked::Record(alice.clone()), &alice, "target"), Ok(()));
    assert!(check_author_of(&Checked::Record(alice.clone()), &bob, "target").is_err());
    assert_eq!(check_author_of(&Checked::Agent(alice.clone()), &alice, "base"), Ok(()));
    assert!(check_author_of(&Checked::Agent(alice.clone()), &bob, "base").is_err());
    assert!(check_author_of(&Checked::Path("users".into()), &alice, "base").is_err());
  }

  #[test]
  fn tombstones_follow_their_rule() {
    let alice = agent(1);
    let bob = agent(2);
    assert_eq!(check_tombstone(Tombstone::Author, &alice, &alice), Ok(()));
    assert!(check_tombstone(Tombstone::Author, &alice, &bob).is_err());
    assert!(check_tombstone(Tombstone::Never, &alice, &alice).is_err());
    assert_eq!(check_tombstone(Tombstone::Open, &alice, &bob), Ok(()));
  }
}
