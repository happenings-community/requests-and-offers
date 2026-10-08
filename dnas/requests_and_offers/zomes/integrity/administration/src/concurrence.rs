use std::str::FromStr;

use hdi::prelude::*;

/// Canonical set of motion kinds used to validate `Motion.kind` strings.
///
/// Stored as a plain `String` on the entry for schema stability, following the same
/// convention as `StatusType`; this enum is used only for parsing and validation.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum MotionKind {
  Suspension,
  Closure,
}

impl FromStr for MotionKind {
  type Err = String;

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    match s {
      "suspension" => Ok(Self::Suspension),
      "closure" => Ok(Self::Closure),
      _ => Err(format!("Invalid motion kind: {}", s)),
    }
  }
}

/// The two shapes a suspension can take. Temporary carries a length; indefinite does not,
/// because re-admission is a separate process rather than a countdown.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub enum SuspensionFlavour {
  Temporary,
  Indefinite,
}

impl FromStr for SuspensionFlavour {
  type Err = String;

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    match s {
      "temporary" => Ok(Self::Temporary),
      "indefinite" => Ok(Self::Indefinite),
      _ => Err(format!("Invalid suspension flavour: {}", s)),
    }
  }
}

/// An HDK entry representing an act put forward for a second signatory to concur with
/// before it takes effect.
///
/// Named `Motion` rather than `Proposal` because that word is taken three times over in
/// this codebase: the exchange record, hREA's ValueFlows types, and the design system's
/// member-facing labels. The stewarding design calls it a proposal in prose; the same
/// deconfliction the membrane design applied to capability and warrant applies here.
///
/// A motion is inert. Committing one changes nobody's status; it holds the intent
/// awaiting a concurrence, and that holding is the mechanism.
///
/// It carries the intent rather than a built `Status`, because the concurring signatory
/// is agreeing to a specific length, and the clock starts at concurrence rather than when
/// the motion was made.
///
/// The subject is carried as **both** identities, following the same convention the
/// stewarding design sets for flags. `subject_agent` is the peer identity: stewarding
/// keys on `AgentPubKey` because names are editable and not unique, and the rule that a
/// steward may not act on a case they are party to is a comparison against it.
/// `subject_entity_hash` is the entity reference the status functions take. They serve
/// two different layers rather than storing one fact twice.
///
/// ## Fields
/// - `kind` - one of the canonical strings defined in [`MotionKind`].
/// - `entity` - the entity scope the subject belongs to, e.g. `"users"`.
/// - `subject_agent` - the peer the act bears on.
/// - `subject_entity_hash` - the original action hash of that peer's entity.
/// - `flavour` - required for `"suspension"`; `None` for `"closure"`.
/// - `duration_days` - required for a temporary suspension; `None` otherwise.
/// - `reason` - required, and carried onto the resulting `Status`.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Motion {
  pub kind: String,
  pub entity: String,
  pub subject_agent: AgentPubKey,
  pub subject_entity_hash: ActionHash,
  pub flavour: Option<String>,
  pub duration_days: Option<i64>,
  pub reason: String,
}

/// An HDK entry recording that a second signatory agreed to a motion.
///
/// The signatory is the entry's author, taken from the action header rather than stored
/// in the entry. The rule that the moving signatory may not concur cannot be enforced
/// here, because reading the motion's author is a DHT read and validation callbacks
/// cannot perform one; the coordinator holds that guard.
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Concurrence {
  pub motion: ActionHash,
}

/// Validates that a `Motion` entry conforms to the zome's business rules.
///
/// Enforces seven rules:
/// 1. `kind` must match a known [`MotionKind`] discriminant string.
/// 2. `entity` and `reason` must not be empty.
/// 3. A suspension must carry a `flavour`; a closure must not.
/// 4. Any `flavour` must match a known [`SuspensionFlavour`] discriminant string.
/// 5. A temporary suspension must carry a positive `duration_days`.
/// 6. An indefinite suspension must not carry `duration_days`.
/// 7. A closure must carry neither.
///
/// The preset lengths named in the stewarding design are deliberately not enforced here.
/// They are a fairness norm the community may revise, and baking them into the integrity
/// zome would make changing them a DNA change.
pub fn validate_motion(motion: Motion) -> ExternResult<ValidateCallbackResult> {
  let kind = match MotionKind::from_str(&motion.kind) {
    Ok(kind) => kind,
    Err(_) => {
      return Ok(ValidateCallbackResult::Invalid(format!(
        "Invalid motion kind: {}",
        motion.kind
      )))
    }
  };

  if motion.entity.trim().is_empty() {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Motion must name an entity scope",
    )));
  }

  if motion.reason.trim().is_empty() {
    return Ok(ValidateCallbackResult::Invalid(String::from(
      "Motion must have a reason",
    )));
  }

  match kind {
    MotionKind::Closure => {
      if motion.flavour.is_some() {
        return Ok(ValidateCallbackResult::Invalid(String::from(
          "Closure motion must not have a suspension flavour",
        )));
      }
      if motion.duration_days.is_some() {
        return Ok(ValidateCallbackResult::Invalid(String::from(
          "Closure motion must not have a duration",
        )));
      }
    }
    MotionKind::Suspension => {
      let flavour = match &motion.flavour {
        None => {
          return Ok(ValidateCallbackResult::Invalid(String::from(
            "Suspension motion must have a flavour",
          )))
        }
        Some(flavour) => match SuspensionFlavour::from_str(flavour) {
          Ok(flavour) => flavour,
          Err(_) => {
            return Ok(ValidateCallbackResult::Invalid(format!(
              "Invalid suspension flavour: {}",
              flavour
            )))
          }
        },
      };

      match flavour {
        SuspensionFlavour::Temporary => match motion.duration_days {
          None => {
            return Ok(ValidateCallbackResult::Invalid(String::from(
              "Temporary suspension motion must have a duration",
            )))
          }
          Some(days) if days < 1 => {
            return Ok(ValidateCallbackResult::Invalid(String::from(
              "Temporary suspension duration must be at least one day",
            )))
          }
          Some(_) => (),
        },
        SuspensionFlavour::Indefinite => {
          if motion.duration_days.is_some() {
            return Ok(ValidateCallbackResult::Invalid(String::from(
              "Indefinite suspension motion must not have a duration",
            )));
          }
        }
      }
    }
  }

  Ok(ValidateCallbackResult::Valid)
}

/// Validates a `Concurrence` entry.
///
/// The entry carries only a pointer, so there is nothing checkable from it alone. The
/// substantive rules - that the author is not the mover, that the motion exists, and that
/// it has not already been concurred with - all require DHT reads and are enforced by the
/// coordinator.
pub fn validate_concurrence(_concurrence: Concurrence) -> ExternResult<ValidateCallbackResult> {
  Ok(ValidateCallbackResult::Valid)
}
