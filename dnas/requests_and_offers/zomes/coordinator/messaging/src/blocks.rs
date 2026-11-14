use hdk::prelude::*;
use messaging_integrity::{Block, EntryTypes, Unblock};

/// One entry in a member's blocking history, newest last.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BlockEvent {
  pub agent: AgentPubKey,
  /// `true` for a block, `false` for an unblock.
  pub blocked: bool,
  pub at: Timestamp,
}

/// A member's blocking state: who is blocked now, and everything that led there.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Blocks {
  pub blocked: Vec<AgentPubKey>,
  pub history: Vec<BlockEvent>,
}

/// Block an agent. Private to this chain, and nothing is published.
#[hdk_extern]
pub fn block_agent(agent: AgentPubKey) -> ExternResult<()> {
  create_entry(&EntryTypes::Block(Block { agent }))?;
  Ok(())
}

/// Reverse a block. The `Block` entry is kept rather than deleted, so the history
/// survives and a member can see who they blocked before.
#[hdk_extern]
pub fn unblock_agent(agent: AgentPubKey) -> ExternResult<()> {
  create_entry(&EntryTypes::Unblock(Unblock { agent }))?;
  Ok(())
}

/// Read the blocking history off this agent's own chain and reduce it to current
/// state.
///
/// Current state is whichever of `Block` or `Unblock` came last for a given agent,
/// by action sequence rather than by timestamp: the chain's order is authoritative
/// and two entries committed in the same instant would otherwise be ambiguous.
#[hdk_extern]
pub fn get_blocks(_: ()) -> ExternResult<Blocks> {
  let records = query(
    ChainQueryFilter::new()
      .include_entries(true)
      .action_type(ActionType::Create),
  )?;

  let mut history: Vec<BlockEvent> = Vec::new();

  for record in records {
    let at = record.action().timestamp();

    // A `Block` and an `Unblock` are both a single agent key, so each deserialises
    // happily into the other. Only the entry type on the action tells them apart,
    // which is why this goes through `deserialize_from_type` rather than
    // `to_app_option`.
    let Some(EntryType::App(def)) = record.action().entry_type() else {
      continue;
    };
    let Some(entry) = record.entry().as_option() else {
      continue;
    };

    match EntryTypes::deserialize_from_type(*def.zome_index, def.entry_index, entry)? {
      Some(EntryTypes::Block(block)) => history.push(BlockEvent {
        agent: block.agent,
        blocked: true,
        at,
      }),
      Some(EntryTypes::Unblock(unblock)) => history.push(BlockEvent {
        agent: unblock.agent,
        blocked: false,
        at,
      }),
      _ => (),
    }
  }

  let mut blocked: Vec<AgentPubKey> = Vec::new();
  for event in &history {
    blocked.retain(|a| a != &event.agent);
    if event.blocked {
      blocked.push(event.agent.clone());
    }
  }

  Ok(Blocks { blocked, history })
}

/// True if `agent` is blocked by whoever is calling.
pub fn is_blocked(agent: &AgentPubKey) -> ExternResult<bool> {
  Ok(get_blocks(())?.blocked.contains(agent))
}
