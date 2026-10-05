use hdk::prelude::*;
use std::collections::HashSet;

mod cases;
pub use cases::*;
mod external_calls;
mod inbox;
pub use inbox::*;
mod message;
pub use message::*;
mod roles;
pub use roles::*;

/// Input from this agent's own UI: tell `agents` that `hash` is waiting for them.
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SendNudgeInput {
    pub hash: ActionHash,
    pub agents: Vec<AgentPubKey>,
}

/// What one agent sends another directly, outside the DHT.
///
/// **Tagged, because there are now two kinds.** A remote signal leaves no record
/// anywhere: `send_remote_signal` does not ask for `write_workspace`, commits nothing
/// and produces no op. That is exactly why a read receipt is one rather than an entry —
/// an entry would publish its action, and the action's timestamp and type would say who
/// read whose message and when, to anyone watching.
///
/// Added on top of the signal zome rather than into it, since that is in review.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum RemotePayload {
    /// Something addressed to you exists at this hash. Carries no content, ever.
    Nudge { hash: ActionHash },
    /// I have read our conversation up to this time.
    ///
    /// A high-water mark, not an event, so it is safe to send again and arrives in any
    /// order. Sent only when the mark advances: re-sending an unchanged one would tell
    /// the other person this agent is online without having read anything.
    ///
    /// **The time is a claim and is clamped by the receiver** to the last message they
    /// actually sent this agent. Clamping is the receiver's own app's job, since it is
    /// the one holding what it sent; doing it here would mean a chain read on every
    /// signal.
    Receipt { read_up_to: Timestamp },
}

/// Input from this agent's own UI: tell this member's agents how far we have read.
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SendReceiptInput {
    /// The counterparty's `User`. Every one of their agents is told.
    pub to_user: ActionHash,
    pub read_up_to: Timestamp,
}

/// Signals emitted to this agent's own UI.
///
/// A received remote signal becomes a `Signal::Nudge`; `from` is the sender, read
/// from call provenance rather than from the payload, so it cannot be forged by
/// the sender.
#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum Signal {
    Nudge {
        hash: ActionHash,
        from: AgentPubKey,
    },
    /// Somebody says they have read up to here. `from` is call provenance, so who sent
    /// it cannot be forged; `read_up_to` is their claim and the app clamps it.
    Receipt {
        read_up_to: Timestamp,
        from: AgentPubKey,
    },
}

/// Grant any agent the right to call `recv_remote_signal` on this zome, which
/// is what makes cross-agent delivery possible. `create_cap_grant` commits it
/// as a Private entry on this agent's own source chain (verified in hdk 0.6.0
/// capability.rs), so it is never gossiped.
///
/// The grant is Unrestricted by necessity: you cannot know your correspondents
/// in advance. Filtering unsolicited or abusive signals is an application-layer
/// concern, not a substrate one.
///
/// `init` does run lazily, on a cell's first zome call, but a recipient does
/// not need priming for that reason. An inbound remote signal is itself a zome
/// call, and the conductor runs `init` before it checks authorisation
/// (holochain 0.6.1: `conductor/cell.rs:721` calls `check_or_run_zome_init`,
/// and `is_authorized` is reached later, at
/// `core/workflow/call_zome_workflow.rs:250`). The grant is therefore committed
/// by the very call that needs it.
///
/// The hazard is on the sending side instead: `send_remote_signal` looks each
/// recipient up in the *sender's* local peer store and skips anyone it cannot
/// find there, with a bare `continue` and no error returned to the caller
/// (holochain_p2p 0.6.1: `spawn/actor.rs:1575-1583`). A correspondent the
/// sender has not yet discovered is silently not sent to.
#[hdk_extern]
pub fn init(_: ()) -> ExternResult<InitCallbackResult> {
    // GrantedFunctions::Listed takes a HashSet<(ZomeName, FunctionName)> in
    // 0.6.0 (not the BTreeSet older references use). Type is inferred from the
    // Listed(..) use below, so no explicit annotation is needed.
    let mut fns = HashSet::new();
    fns.insert((zome_info()?.name, "recv_remote_signal".into()));
    let functions = GrantedFunctions::Listed(fns);
    create_cap_grant(ZomeCallCapGrant {
        tag: "".into(),
        access: CapAccess::Unrestricted,
        functions,
    })?;
    Ok(InitCallbackResult::Pass)
}

/// Tell each of `agents` that something addressed to them exists at `hash`.
///
/// **A nudge carries one `ActionHash` and never content.** The hash names data the
/// recipient fetches for itself, under whatever rules that data's own zome
/// applies. That keeps three properties the substrate would otherwise lose:
/// message bodies are not duplicated into an unvalidated channel, a nudge cannot
/// be used to push arbitrary bytes at another agent's UI, and no size bound is
/// needed here because an `ActionHash` is fixed-length.
///
/// The stored data is the delivery guarantee, so a lost nudge costs a recipient
/// timeliness and nothing else. That matters, because:
///
/// `Ok(())` means only that the signal was handed to the network for signing and
/// sending. It is not a delivery receipt, and there is no error path for a send
/// that fails: the host function spawns a detached task and returns `Ok(())`
/// immediately (holochain 0.6.1:
/// `core/ribosome/host_fn/send_remote_signal.rs:46` spawns, `:118` returns),
/// logging any failure at `tracing::info!`. Below it, the p2p layer logs send
/// failures at `tracing::debug!` and skips recipients missing from the sender's
/// peer store (`holochain_p2p` `spawn/actor.rs:1575-1583`).
///
/// So a nudge reaches a recipient only if they are online *and* already
/// discovered by this agent, and neither condition is reported back.
#[hdk_extern]
pub fn send_nudge(input: SendNudgeInput) -> ExternResult<()> {
    send_remote_signal(RemotePayload::Nudge { hash: input.hash }, input.agents)
}

/// Tell every agent of `to_user` how far this agent has read.
///
/// **Nothing is stored and nothing is published.** If the recipient is not reachable the
/// signal is dropped without an error, which is the documented behaviour of
/// `send_remote_signal` and the reason a receipt is never re-sent unchanged: the same
/// mark rides in the body of the next message instead.
#[hdk_extern]
pub fn send_receipt(input: SendReceiptInput) -> ExternResult<()> {
    let agents = crate::external_calls::get_user_agents(input.to_user)?;
    if agents.is_empty() {
        return Ok(());
    }
    send_remote_signal(
        RemotePayload::Receipt {
            read_up_to: input.read_up_to,
        },
        agents,
    )
}

/// Called remotely by a sending agent, permitted by the init cap grant.
/// Re-emits the nudge to this agent's own UI, tagged with the sender.
///
/// **The payload is untrusted, both kinds.** A nudge's hash is whatever the sender chose
/// and may name data that does not exist, that this agent is not the recipient of, or
/// nothing at all. A receipt's time is equally a claim, and the app clamps it to what it
/// actually sent that person. Only `from` is trustworthy, being call provenance. Nothing here fetches it. Whatever acts on a nudge is
/// responsible for deciding whether the thing at that hash is really addressed to
/// this agent, which for messaging is what the `Inbox` links and their validation
/// settle.
///
/// **Blocking is not here any more.** It was applied in this function and on every read,
/// from private `Block` entries on the recipient's own chain. Those entries are gone: a
/// private entry hides its content but not its timing, and a `Block` committed moments
/// after a message arrived named who had been blocked to anyone watching the chain, since
/// there was usually only one candidate.
///
/// Blocking now lives in the recipient's own app, in local storage, and is applied to
/// every read and to this signal there. A block only ever acted at the recipient's end
/// anyway, and a chain copy never followed a member to another device or through a
/// reinstall with a new key, so it bought the timing leak and little else.
#[hdk_extern]
pub fn recv_remote_signal(payload: RemotePayload) -> ExternResult<()> {
    let info = call_info()?;
    let from = info.provenance;

    match payload {
        RemotePayload::Nudge { hash } => emit_signal(Signal::Nudge { hash, from }),
        RemotePayload::Receipt { read_up_to } => {
            emit_signal(Signal::Receipt { read_up_to, from })
        }
    }
}
