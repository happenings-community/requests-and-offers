use std::str::FromStr;

use administration_integrity::*;
use chrono::Duration;
use concurrence::*;
use hdk::prelude::*;
use status::*;
use utils::{
  errors::{AdministrationError, CommonError},
  find_original_action_hash, EntityActionHash, EntityAgent, OriginalActionHash,
  PreviousActionHash,
};

use crate::administration::{check_if_agent_is_administrator, check_if_entity_is_administrator};
use crate::permissions::{check_if_agent_has_permission, AgentPermission, PERMISSION_STEWARD};
use crate::status::{get_latest_status_record_for_entity, UpdateEntityActionHash};

/// Input for putting a motion.
///
/// Both subject identities are supplied by the caller, following the convention the
/// stewarding design sets for flags: whatever renders the control already knows whose
/// content it is showing, so it passes the identity along with the reference.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MoveInput {
  pub kind: String,
  pub entity: String,
  pub subject_agent: AgentPubKey,
  pub subject_entity_hash: ActionHash,
  pub flavour: Option<String>,
  pub duration_days: Option<i64>,
  pub reason: String,
}

/// The single administrative domain. Every caller in this zome passes it.
const ENTITY_NETWORK: &str = "network";

fn my_pubkey() -> ExternResult<AgentPubKey> {
  Ok(agent_info()?.agent_initial_pubkey)
}

/// Refuses any caller who does not hold the steward permission.
///
/// Deliberately does not accept an administrator instead. An administrator who stewards
/// holds the permission explicitly and appears in the public roster.
fn require_steward() -> ExternResult<()> {
  if !check_if_agent_has_permission(AgentPermission {
    permission: PERMISSION_STEWARD.to_string(),
    agent_pubkey: my_pubkey()?,
  })? {
    return Err(AdministrationError::Unauthorized.into());
  }
  Ok(())
}

fn is_admin(agent_pubkey: AgentPubKey) -> ExternResult<bool> {
  check_if_agent_is_administrator(EntityAgent {
    entity: ENTITY_NETWORK.to_string(),
    agent_pubkey,
  })
}

/// Refuses a pairing that would let one role act alone against an administrator.
///
/// An administrator holds authority over the network itself, so an act against one
/// requires at least one administrator among the two signatories. Two stewards alone
/// cannot unseat the people who appointed them; an administrator with a steward can, and
/// so can two administrators, which is what keeps an administrator answerable to their
/// peers rather than unassailable.
///
/// A network with a single administrator cannot reach them at all, because there is
/// nobody to pair with. That is a real limit rather than an oversight, and the answer is
/// a new network rather than a weaker rule.
///
/// Neither signatory may be the subject. That rule is unconditional and enforced above,
/// for motions about members and administrators alike.
///
/// The progenitor is out of reach of this or any other in-network act: that key is a DNA
/// property, so replacing it means a new DNA.
fn require_pairing_for_subject(
  motion: &Motion,
  mover: &AgentPubKey,
  concurrer: &AgentPubKey,
) -> ExternResult<()> {
  // Administrator membership is scoped to the network, not to the entity type whose
  // status the motion changes. Passing `motion.entity` here would look in
  // `"users.administrators"`, which is always empty, and the rule would never fire.
  let subject_is_admin = check_if_entity_is_administrator(EntityActionHash {
    entity: ENTITY_NETWORK.to_string(),
    entity_original_action_hash: OriginalActionHash(motion.subject_entity_hash.clone()),
  })?;

  if !subject_is_admin {
    return Ok(());
  }

  let mover_is_admin = is_admin(mover.clone())?;
  let concurrer_is_admin = is_admin(concurrer.clone())?;

  if !mover_is_admin && !concurrer_is_admin {
    return Err(CommonError::InvalidData(
      "a motion about an administrator needs an administrator among its signatories"
        .to_string(),
    )
    .into());
  }

  Ok(())
}

fn record_at(hash: ActionHash, what: &str) -> ExternResult<Record> {
  get(hash, GetOptions::default())?.ok_or_else(|| CommonError::RecordNotFound(what.to_string()).into())
}

fn motion_at(hash: &ActionHash) -> ExternResult<(Record, Motion)> {
  let record = record_at(hash.clone(), "motion")?;
  let motion = record
    .entry()
    .to_app_option::<Motion>()
    .map_err(|_| CommonError::InvalidData("motion".to_string()))?
    .ok_or_else(|| CommonError::EntryNotFound("motion".to_string()))?;
  Ok((record, motion))
}

fn links_from(base: ActionHash, link_type: LinkTypes) -> ExternResult<Vec<Link>> {
  let filter = link_type
    .try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  get_links(LinkQuery::new(base, filter), GetStrategy::Network)
}

/// Puts a motion. The caller must hold the steward permission.
///
/// Committing a motion changes nobody's status. It is inert until a second steward
/// concurs, and that holding is the mechanism.
#[hdk_extern]
pub fn put_motion(input: MoveInput) -> ExternResult<Record> {
  require_steward()?;

  if input.subject_agent == my_pubkey()? {
    return Err(
      CommonError::InvalidData("you cannot put a motion about yourself".to_string()).into(),
    );
  }

  let subject = find_original_action_hash(input.subject_entity_hash)?;

  let motion = Motion {
    kind: input.kind,
    entity: input.entity,
    subject_agent: input.subject_agent,
    subject_entity_hash: subject.0.clone(),
    flavour: input.flavour,
    duration_days: input.duration_days,
    reason: input.reason,
  };

  let hash = create_entry(&EntryTypes::Motion(motion))?;
  create_link(subject.0, hash.clone(), LinkTypes::SubjectMotions, ())?;
  record_at(hash, "motion")
}

/// Concurs with a motion, which is what makes it take effect.
///
/// The caller must hold the steward permission, must not be the motion's author, and the
/// motion must not already carry a concurrence.
///
/// All writes in a zome call commit to the source chain together, so if the status
/// transition fails the concurrence is not recorded either. That is what keeps the two
/// halves of the act from separating.
#[hdk_extern]
pub fn concur(motion_hash: ActionHash) -> ExternResult<Record> {
  require_steward()?;

  let motion_hash = find_original_action_hash(motion_hash)?.0;
  let (motion_record, motion) = motion_at(&motion_hash)?;

  let me = my_pubkey()?;

  if motion_record.action().author() == &me {
    return Err(
      CommonError::InvalidData("you cannot concur with your own motion".to_string()).into(),
    );
  }

  // A steward who is a party to the act may neither move it nor carry it. Plural
  // authority means two people, and neither of them the person it bears on.
  if motion.subject_agent == me {
    return Err(
      CommonError::InvalidData("you cannot concur with a motion about yourself".to_string())
        .into(),
    );
  }

  require_pairing_for_subject(&motion, motion_record.action().author(), &me)?;

  if !links_from(motion_hash.clone(), LinkTypes::MotionConcurrences)?.is_empty() {
    return Err(
      CommonError::InvalidData("this motion already has a concurrence".to_string()).into(),
    );
  }

  let hash = create_entry(&EntryTypes::Concurrence(Concurrence {
    motion: motion_hash.clone(),
  }))?;
  create_link(
    motion_hash,
    hash.clone(),
    LinkTypes::MotionConcurrences,
    (),
  )?;

  apply(&motion)?;

  record_at(hash, "concurrence")
}

/// Applies a concurred motion.
///
/// Calls `update_entity_status` directly rather than the `suspend_entity_*` wrappers,
/// because those end in `Ok(update_entity_status(...).is_ok())` and collapse an
/// authorisation failure, a missing status and a transient network read into the same
/// `false`. A steward needs to know which of those happened.
///
/// A closure motion has no effect yet: the case entry it would close is not built.
fn apply(motion: &Motion) -> ExternResult<()> {
  let kind = MotionKind::from_str(&motion.kind)
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e)))?;

  if kind == MotionKind::Closure {
    return Ok(());
  }

  let entity_input = EntityActionHash {
    entity: motion.entity.clone(),
    entity_original_action_hash: OriginalActionHash(motion.subject_entity_hash.clone()),
  };

  let latest = get_latest_status_record_for_entity(entity_input)?
    .ok_or_else(|| CommonError::RecordNotFound("status".to_string()))?;
  let previous = latest.action_address().clone();
  let original = find_original_action_hash(previous.clone())?;

  let flavour = motion
    .flavour
    .as_deref()
    .ok_or_else(|| CommonError::InvalidData("suspension flavour".to_string()))
    .and_then(|f| {
      SuspensionFlavour::from_str(f).map_err(|_| CommonError::InvalidData("suspension flavour".to_string()))
    })?;

  let new_status = match flavour {
    SuspensionFlavour::Indefinite => Status::suspend(motion.reason.as_str(), None),
    SuspensionFlavour::Temporary => {
      let days = motion
        .duration_days
        .ok_or_else(|| CommonError::InvalidData("suspension duration".to_string()))?;
      let now = &sys_time()?;
      Status::suspend(motion.reason.as_str(), Some((Duration::days(days), now)))
    }
  };

  crate::status::update_entity_status(UpdateEntityActionHash {
    entity: motion.entity.clone(),
    entity_original_action_hash: OriginalActionHash(motion.subject_entity_hash.clone()),
    status_original_action_hash: original,
    status_previous_action_hash: PreviousActionHash(previous),
    new_status,
  })?;

  Ok(())
}

/// Returns every motion put against the given subject.
#[hdk_extern]
pub fn get_motions_for_subject(subject: ActionHash) -> ExternResult<Vec<Record>> {
  let subject = find_original_action_hash(subject)?;
  let links = links_from(subject.0, LinkTypes::SubjectMotions)?;

  links
    .into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| record_at(hash, "motion"))
    .collect()
}

/// Returns the concurrence for a motion, if it has one.
///
/// A motion carrying no concurrence is still pending. The state is derived from the
/// records rather than stored on the motion, so nothing has to be kept in step.
#[hdk_extern]
pub fn get_concurrence_for_motion(motion_hash: ActionHash) -> ExternResult<Option<Record>> {
  let motion_hash = find_original_action_hash(motion_hash)?.0;
  let links = links_from(motion_hash, LinkTypes::MotionConcurrences)?;

  match links.first() {
    None => Ok(None),
    Some(link) => {
      let hash = link
        .target
        .clone()
        .into_action_hash()
        .ok_or_else(|| CommonError::ActionHashNotFound("concurrence".to_string()))?;
      Ok(Some(record_at(hash, "concurrence")?))
    }
  }
}
