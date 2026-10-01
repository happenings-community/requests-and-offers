use hdk::prelude::*;
use messaging_integrity::{EntryTypes, ReportResolution};

use crate::external_calls::check_if_agent_is_administrator;
use crate::inbox::{read_inbox_entries, InboxEntry, Message};
use crate::message::MessageKind;

/// One technical report, as the administrator who received it sees it.
///
/// The message itself is an ordinary encrypted message; `resolved` is this
/// administrator's own private view of whether it has been dealt with, and no other
/// administrator's copy is affected by it.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdminReport {
  pub message: Message,
  pub resolved: bool,
  /// When this administrator last marked it resolved, and `None` once reopened.
  pub resolved_at: Option<Timestamp>,
}

/// The technical reports addressed to this administrator, oldest first.
///
/// Runs the same read-side filters as `get_inbox`, because it walks the same entries
/// through `read_inbox_entries`: a blocked author's report is not shown, nor is one from
/// an author who is no longer an accepted member.
///
/// `Unreadable` entries are not here. A report's kind lives inside the ciphertext, so an
/// entry that will not decrypt cannot be known to be a report; those stay in `get_inbox`,
/// where an undecryptable message is the fault signal it is meant to be.
#[hdk_extern]
pub fn get_admin_reports(_: ()) -> ExternResult<Vec<AdminReport>> {
  let me = agent_info()?.agent_initial_pubkey;
  require_network_administrator(&me, "read the technical reports")?;

  let resolutions = resolution_state()?;

  let out = read_inbox_entries(&me)?
    .into_iter()
    .filter_map(|entry| match entry {
      InboxEntry::Read(message) if message.kind == MessageKind::AdminReport => Some(message),
      _ => None,
    })
    .map(|message| {
      let latest = resolutions
        .iter()
        .find(|(report, _, _)| report == &message.hash);
      let (resolved, resolved_at) = match latest {
        Some((_, true, at)) => (true, Some(*at)),
        // Either reopened, or never touched. Both are unresolved, and neither carries a
        // time: a reopened report is open now, and when it was briefly closed is not
        // something the admin area shows.
        Some((_, false, _)) | None => (false, None),
      };
      AdminReport {
        message,
        resolved,
        resolved_at,
      }
    })
    .collect();

  Ok(out)
}

/// Mark a report as dealt with. Private to this administrator.
#[hdk_extern]
pub fn mark_report_resolved(report: ActionHash) -> ExternResult<()> {
  write_resolution(report, true)
}

/// Reopen a report this administrator had marked resolved. Also private.
///
/// The earlier `ReportResolution` is kept rather than deleted, the same way `Block` and
/// `Unblock` both stay, so the sequence survives and the latest entry wins.
#[hdk_extern]
pub fn reopen_report(report: ActionHash) -> ExternResult<()> {
  write_resolution(report, false)
}

/// Commit one resolution entry, once the caller has been shown to be an administrator.
///
/// `report` is not checked against anything. A resolution naming a hash this
/// administrator holds no report for is inert rather than wrong: `get_admin_reports`
/// starts from the reports actually in the inbox and joins the resolutions onto them, so
/// an unmatched resolution is never read. Validating it here would mean a network read
/// on every mark, to prevent something that has no effect.
fn write_resolution(report: ActionHash, resolved: bool) -> ExternResult<()> {
  let me = agent_info()?.agent_initial_pubkey;
  let what = if resolved {
    "mark a technical report resolved"
  } else {
    "reopen a technical report"
  };
  require_network_administrator(&me, what)?;

  create_entry(&EntryTypes::ReportResolution(ReportResolution {
    report,
    resolved,
  }))?;
  Ok(())
}

/// Refuse anyone who is not a network administrator, naming what they tried to do.
fn require_network_administrator(agent: &AgentPubKey, what: &str) -> ExternResult<()> {
  if !check_if_agent_is_administrator(agent.clone())? {
    return Err(wasm_error!(WasmErrorInner::Guest(format!(
      "Only a network administrator can {what}"
    ))));
  }
  Ok(())
}

/// The latest resolution per report, read off this administrator's own chain.
///
/// Latest by chain order rather than by timestamp, following `get_blocks`: the chain's
/// order is authoritative, and two entries committed in the same instant would otherwise
/// be ambiguous. The timestamp returned is the action's, which is what the admin area
/// shows as the time a report was resolved.
fn resolution_state() -> ExternResult<Vec<(ActionHash, bool, Timestamp)>> {
  let records = query(
    ChainQueryFilter::new()
      .include_entries(true)
      .action_type(ActionType::Create),
  )?;

  let mut latest: Vec<(ActionHash, bool, Timestamp)> = Vec::new();

  for record in records {
    let at = record.action().timestamp();

    // Through `deserialize_from_type` rather than `to_app_option`, for the reason
    // `get_blocks` gives: only the entry type on the action distinguishes this zome's
    // private entries from one another.
    let Some(EntryType::App(def)) = record.action().entry_type() else {
      continue;
    };
    let Some(entry) = record.entry().as_option() else {
      continue;
    };

    if let Some(EntryTypes::ReportResolution(resolution)) =
      EntryTypes::deserialize_from_type(*def.zome_index, def.entry_index, entry)?
    {
      match latest
        .iter_mut()
        .find(|(report, _, _)| report == &resolution.report)
      {
        // A later entry on the chain replaces an earlier one for the same report.
        Some(existing) => *existing = (resolution.report, resolution.resolved, at),
        None => latest.push((resolution.report, resolution.resolved, at)),
      }
    }
  }

  Ok(latest)
}
