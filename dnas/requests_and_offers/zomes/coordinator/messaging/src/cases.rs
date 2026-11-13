use hdk::prelude::*;

use crate::external_calls::get_agent_user;
use crate::inbox::{read_inbox_entries, AuthorFacts, InboxEntry, Message};
use crate::roles::{require_holder, RoleRef};

/// Largest case identifier this zome will accept. A UUID is 36 bytes.
///
/// The sender chooses the ID, which is exactly why a case is keyed by the opener's
/// `User` *and* the ID rather than the ID alone.
pub const MAX_CASE_ID_BYTES: usize = 64;

/// What a case is about.
///
/// Kept on the case from the start so that service type and medium of exchange
/// suggestions can be added later without reshaping anything.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CaseKind {
  /// An app fault or bug, the admin role's technical work. What #301 called an
  /// `AdminReport`.
  TechnicalReport,
}

/// How a case ended. No findings and no concurrence: admin work is technical, not
/// arbitration. Stewarding adds findings and concurrence later.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CaseOutcome {
  Resolved,
  Dismissed,
}

/// Something a holder did to a case.
///
/// Every one of these may only be sent by a current holder of the role, checked when it
/// is sent and again by each reader. An ordinary message on a case carries no event.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CaseEvent {
  /// I am dealing with this. Claims inform and never block, so several may stand at
  /// once.
  Claim,
  /// I am no longer dealing with this.
  Release,
  /// Offer the case to another holder, by their `User`.
  HandOverOffer { to: ActionHash },
  /// Take a case offered to me. Only the holder the offer named can do this.
  HandOverAccept,
  /// A note on the case. The note itself is the message's `content`.
  CaseNote,
  /// Close the case, with an outcome. The note is the message's `content`.
  Complete { outcome: CaseOutcome },
  /// Open a closed case again. The reason is the message's `content`.
  Reopen,
}

/// Which case a role message belongs to, carried inside the ciphertext.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaseRef {
  /// Chosen by the sender, which is why it is never the whole key.
  pub case_id: String,
  /// The `User` of whoever opened the case. **A case is keyed by this and `case_id`
  /// together**, so two members who pick the same ID have two separate cases.
  pub opener: ActionHash,
  pub kind: CaseKind,
  /// `None` for an ordinary message on the case: the opening message, a member's
  /// follow-up, or a holder's reply. `Some` for one of the seven events, every one of
  /// which is holder-only.
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub event: Option<CaseEvent>,
}

/// An offer of a case that nobody has accepted yet.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HandOver {
  pub offered_by: AgentPubKey,
  pub to: ActionHash,
  pub at: Timestamp,
}

/// How and when a case was closed.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CaseClosure {
  pub outcome: CaseOutcome,
  pub at: Timestamp,
}

/// One case, with its state worked out from its events rather than stored anywhere.
///
/// Nothing holds a case's state: it is a fold over the events, so there is no stored
/// state to keep in sync and no second writer to disagree with. Readers order the events
/// by their own copies' timestamps, so they do not always agree on that order
/// (`assemble_cases`, and messaging.md 6.6). That is what replaces #301's private
/// `ReportResolution`.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Case {
  pub case_id: String,
  pub opener: ActionHash,
  pub kind: CaseKind,
  pub opened_at: Timestamp,
  /// Every message and event on the case, oldest first.
  pub messages: Vec<Message>,
  /// Every holder with a claim standing, by agent key. Several may stand at once.
  ///
  /// Agent keys rather than `User`s because that is what an action carries, for free and
  /// unforgeably. A hand-over's target is a `User` instead, because the sender picks it
  /// from a list of holders. The interface resolves either.
  pub claimed_by: Vec<AgentPubKey>,
  /// `None` while the case is open.
  pub closed: Option<CaseClosure>,
  pub pending_hand_over: Option<HandOver>,
}

/// Group role messages into cases and fold each one's events into state.
///
/// The fold is **idempotent for repeated copies of the same event**, which matters
/// because a send fans out one entry per recipient agent: `Claim` adds an agent that is
/// not already claiming, `Release` removes one, `Complete` and `Reopen` set and clear a
/// single field, and a second `HandOverAccept` finds no offer pending. So a reader that
/// somehow sees two copies of one event computes the same state as one that sees one.
pub(crate) fn assemble_cases(messages: Vec<(Message, CaseRef)>) -> ExternResult<Vec<Case>> {
  // Oldest first, by the action timestamp of this reader's own copy. `deliver` writes one
  // entry per recipient agent, so every reader holds a different copy of each event, with
  // its own timestamp and hash: two holders acting within moments of each other can be
  // folded in a different order by different readers. Nothing every copy shares can order
  // them yet; messaging.md 6.6 states the limit, and #483 tracks the fix (one send time
  // carried inside the ciphertext).
  let mut messages = messages;
  messages.sort_by_key(|(m, _)| m.at);

  let mut cases: Vec<Case> = Vec::new();
  let mut users = AuthorFacts::new();

  for (message, case_ref) in messages {
    let at = message.at;
    let author = message.from.clone();
    let event = case_ref.event.clone();

    let index = match cases
      .iter()
      .position(|c| c.case_id == case_ref.case_id && c.opener == case_ref.opener)
    {
      Some(i) => i,
      None => {
        cases.push(Case {
          case_id: case_ref.case_id.clone(),
          opener: case_ref.opener.clone(),
          kind: case_ref.kind,
          opened_at: at,
          messages: Vec::new(),
          claimed_by: Vec::new(),
          closed: None,
          pending_hand_over: None,
        });
        cases.len() - 1
      }
    };

    let case = &mut cases[index];
    case.messages.push(message);

    match event {
      None | Some(CaseEvent::CaseNote) => (),
      Some(CaseEvent::Claim) => {
        if !case.claimed_by.contains(&author) {
          case.claimed_by.push(author);
        }
      }
      Some(CaseEvent::Release) => case.claimed_by.retain(|a| a != &author),
      Some(CaseEvent::HandOverOffer { to }) => {
        case.pending_hand_over = Some(HandOver {
          offered_by: author,
          to,
          at,
        })
      }
      Some(CaseEvent::HandOverAccept) => {
        // Only the holder the offer named may take it. An offer that names a person and
        // that anybody may accept would not be a hand-over.
        let accepter = users.user(&author)?;
        let matches = match (&case.pending_hand_over, &accepter) {
          (Some(offer), Some(user)) => &offer.to == user,
          _ => false,
        };
        if matches {
          if let Some(offer) = case.pending_hand_over.take() {
            case.claimed_by.retain(|a| a != &offer.offered_by);
            if !case.claimed_by.contains(&author) {
              case.claimed_by.push(author);
            }
          }
        }
      }
      Some(CaseEvent::Complete { outcome }) => {
        case.closed = Some(CaseClosure { outcome, at })
      }
      Some(CaseEvent::Reopen) => case.closed = None,
    }
  }

  cases.sort_by_key(|c| c.opened_at);
  Ok(cases)
}

/// Every role message in this agent's inbox, with its case reference.
///
/// Only messages that carry both a role and a case: a role message without a case is not
/// possible from any send path here, and one that somehow existed belongs to no case.
fn role_messages(role: &RoleRef) -> ExternResult<Vec<(Message, CaseRef)>> {
  let me = agent_info()?.agent_initial_pubkey;
  let mut out = Vec::new();
  for entry in read_inbox_entries(&me)? {
    let InboxEntry::Read(message) = entry else {
      continue;
    };
    if message.role.as_ref() != Some(role) {
      continue;
    }
    if let Some(case_ref) = message.case.clone() {
      out.push((message, case_ref));
    }
  }
  Ok(out)
}

/// The cases addressed to this agent as a holder of `role`, oldest first.
///
/// Refused unless the caller holds the role now. The read-side role check that
/// `read_inbox_entries` applies has already withheld any message whose author was
/// claiming a role they do not hold.
#[hdk_extern]
pub fn get_role_inbox(role: RoleRef) -> ExternResult<Vec<Case>> {
  let me = agent_info()?.agent_initial_pubkey;
  require_holder(&me, &role, "read that role's inbox")?;
  assemble_cases(role_messages(&role)?)
}

/// One role's worth of a member's own correspondence.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RoleCorrespondence {
  pub role: RoleRef,
  pub cases: Vec<Case>,
}

/// A member's own role conversations, grouped by role.
///
/// What they sent to a role and what holders sent back, for the member's "Admin and
/// steward messages" area. No role check: these are this member's own
/// cases, and a member is not a holder of anything.
///
/// Every copy this reads is in the caller's own inbox, including the ones they wrote
/// themselves, because a role message is encrypted to its sender's agents as well as to
/// the holders. That is what keeps this a single inbox read with no chain walk and no
/// duplicate collapsing.
#[hdk_extern]
pub fn get_my_role_correspondence(_: ()) -> ExternResult<Vec<RoleCorrespondence>> {
  let me = agent_info()?.agent_initial_pubkey;

  // Cases this member opened, not every case they can see. An administrator calling this
  // gets the ones they raised themselves, and reaches the rest through
  // `get_role_inbox`; without the filter the two would return overlapping lists and the
  // member's own area would show other people's cases.
  let Some(my_user) = get_agent_user(me.clone())?
    .first()
    .and_then(|link| link.target.clone().into_action_hash())
  else {
    return Ok(Vec::new());
  };

  let mut by_role: Vec<(RoleRef, Vec<(Message, CaseRef)>)> = Vec::new();

  for entry in read_inbox_entries(&me)? {
    let InboxEntry::Read(message) = entry else {
      continue;
    };
    let (Some(role), Some(case_ref)) = (message.role.clone(), message.case.clone()) else {
      continue;
    };
    if case_ref.opener != my_user {
      continue;
    }
    match by_role.iter_mut().find(|(r, _)| r == &role) {
      Some((_, messages)) => messages.push((message, case_ref)),
      None => by_role.push((role, vec![(message, case_ref)])),
    }
  }

  let mut out = Vec::new();
  for (role, messages) in by_role {
    out.push(RoleCorrespondence {
      role,
      cases: assemble_cases(messages)?,
    });
  }
  Ok(out)
}

#[cfg(test)]
mod tests {
  use super::*;

  fn agent(byte: u8) -> AgentPubKey {
    AgentPubKey::from_raw_36(vec![byte; 36])
  }

  fn hash(byte: u8) -> ActionHash {
    ActionHash::from_raw_36(vec![byte; 36])
  }

  /// One role message on a case: who wrote it, when, and what it did.
  fn on_case(
    case_id: &str,
    opener: u8,
    from: u8,
    at: i64,
    event: Option<CaseEvent>,
  ) -> (Message, CaseRef) {
    let case = CaseRef {
      case_id: case_id.to_string(),
      opener: hash(opener),
      kind: CaseKind::TechnicalReport,
      event,
    };
    let message = Message {
      // Each copy of a message is its own entry, so the hash varies with the time too.
      hash: hash(from.wrapping_add(at as u8)),
      from: agent(from),
      to: agent(200),
      at: Timestamp::from_micros(at),
      content: String::new(),
      role: Some(RoleRef::Admin),
      direction: None,
      case: Some(case.clone()),
    };
    (message, case)
  }

  fn only_case(messages: Vec<(Message, CaseRef)>) -> Case {
    let mut cases = assemble_cases(messages).expect("no event here needs the host");
    assert_eq!(cases.len(), 1, "one case expected, got {cases:?}");
    cases.remove(0)
  }

  const OPENER: u8 = 1;
  const ALICE: u8 = 10;
  const BOB: u8 = 11;

  /// The fold, as a table of event sequences. `assemble_cases` is pure apart from
  /// `HandOverAccept`, which looks up the accepter's `User` and so is left to the
  /// Sweettest (`messaging_roles.rs`).
  ///
  /// **To make this go red:** in `assemble_cases`, make the `Reopen` arm do nothing: the
  /// reopened row stays closed (seen).
  #[test]
  fn events_fold_into_state() {
    // The opening message alone: open, unclaimed.
    let case = only_case(vec![on_case("c", OPENER, OPENER, 1, None)]);
    assert!(case.claimed_by.is_empty() && case.closed.is_none());
    assert_eq!(case.opened_at, Timestamp::from_micros(1));
    assert_eq!(case.messages.len(), 1);

    // Two holders may claim at once; a claim never blocks.
    let case = only_case(vec![
      on_case("c", OPENER, OPENER, 1, None),
      on_case("c", OPENER, ALICE, 2, Some(CaseEvent::Claim)),
      on_case("c", OPENER, BOB, 3, Some(CaseEvent::Claim)),
    ]);
    assert_eq!(case.claimed_by, vec![agent(ALICE), agent(BOB)]);

    // A release removes only the releaser.
    let case = only_case(vec![
      on_case("c", OPENER, OPENER, 1, None),
      on_case("c", OPENER, ALICE, 2, Some(CaseEvent::Claim)),
      on_case("c", OPENER, BOB, 3, Some(CaseEvent::Claim)),
      on_case("c", OPENER, ALICE, 4, Some(CaseEvent::Release)),
    ]);
    assert_eq!(case.claimed_by, vec![agent(BOB)]);

    // Complete closes with its outcome; reopen clears it; a note changes nothing.
    let closed = vec![
      on_case("c", OPENER, OPENER, 1, None),
      on_case(
        "c",
        OPENER,
        ALICE,
        2,
        Some(CaseEvent::Complete {
          outcome: CaseOutcome::Resolved,
        }),
      ),
      on_case("c", OPENER, ALICE, 3, Some(CaseEvent::CaseNote)),
    ];
    let case = only_case(closed.clone());
    assert_eq!(
      case.closed.as_ref().map(|c| c.outcome),
      Some(CaseOutcome::Resolved)
    );
    let mut reopened = closed;
    reopened.push(on_case("c", OPENER, BOB, 4, Some(CaseEvent::Reopen)));
    assert!(only_case(reopened).closed.is_none());

    // An offer is recorded as pending, with who made it and to whom.
    let case = only_case(vec![
      on_case("c", OPENER, OPENER, 1, None),
      on_case(
        "c",
        OPENER,
        ALICE,
        2,
        Some(CaseEvent::HandOverOffer { to: hash(BOB) }),
      ),
    ]);
    let offer = case.pending_hand_over.expect("an offer is pending");
    assert_eq!((offer.offered_by, offer.to), (agent(ALICE), hash(BOB)));
  }

  /// A send fans out one entry per recipient agent, so a reader can meet the same event
  /// more than once. Two copies fold to the same state as one, which is what the doc
  /// comment on `assemble_cases` claims.
  ///
  /// **To make this go red:** in `assemble_cases`, push the author on `Claim` without
  /// the `contains` check: Alice is then counted twice (seen).
  #[test]
  fn repeated_copies_of_an_event_change_nothing() {
    let once = only_case(vec![
      on_case("c", OPENER, OPENER, 1, None),
      on_case("c", OPENER, ALICE, 2, Some(CaseEvent::Claim)),
      on_case(
        "c",
        OPENER,
        ALICE,
        4,
        Some(CaseEvent::Complete {
          outcome: CaseOutcome::Dismissed,
        }),
      ),
    ]);
    let twice = only_case(vec![
      on_case("c", OPENER, OPENER, 1, None),
      on_case("c", OPENER, ALICE, 2, Some(CaseEvent::Claim)),
      on_case("c", OPENER, ALICE, 3, Some(CaseEvent::Claim)),
      on_case(
        "c",
        OPENER,
        ALICE,
        4,
        Some(CaseEvent::Complete {
          outcome: CaseOutcome::Dismissed,
        }),
      ),
      on_case(
        "c",
        OPENER,
        ALICE,
        5,
        Some(CaseEvent::Complete {
          outcome: CaseOutcome::Dismissed,
        }),
      ),
    ]);
    assert_eq!(twice.claimed_by, once.claimed_by);
    assert_eq!(
      twice.closed.map(|c| c.outcome),
      once.closed.map(|c| c.outcome)
    );
  }

  /// A case is keyed by its opener and its ID together, and events are folded oldest
  /// first whatever order they arrive in.
  #[test]
  fn cases_are_keyed_by_opener_and_id_and_folded_oldest_first() {
    // The same ID from two openers is two cases.
    let cases = assemble_cases(vec![
      on_case("c", OPENER, OPENER, 1, None),
      on_case("c", 2, 2, 2, None),
    ])
    .unwrap();
    assert_eq!(cases.len(), 2);

    // Reopen then complete, handed over newest first: still closed, because the
    // complete is the later event.
    let case = only_case(vec![
      on_case(
        "c",
        OPENER,
        ALICE,
        3,
        Some(CaseEvent::Complete {
          outcome: CaseOutcome::Resolved,
        }),
      ),
      on_case("c", OPENER, BOB, 2, Some(CaseEvent::Reopen)),
      on_case("c", OPENER, OPENER, 1, None),
    ]);
    assert!(case.closed.is_some());
    assert_eq!(case.opened_at, Timestamp::from_micros(1));
  }
}
