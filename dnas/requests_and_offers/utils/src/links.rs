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

#[cfg(test)]
mod tests {
  use super::*;

  fn agent(byte: u8) -> AgentPubKey {
    AgentPubKey::from_raw_36(vec![byte; 36])
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
