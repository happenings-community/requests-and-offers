use hdk::prelude::*;
use std::collections::HashSet;

/// Input from this agent's own UI: tell `agents` that `hash` is waiting for them.
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SendNudgeInput {
    pub hash: ActionHash,
    pub agents: Vec<AgentPubKey>,
}

/// Signals emitted to this agent's own UI.
///
/// A received remote signal becomes a `Signal::Nudge`; `from` is the sender, read
/// from call provenance rather than from the payload, so it cannot be forged by
/// the sender.
#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum Signal {
    Nudge { hash: ActionHash, from: AgentPubKey },
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
    send_remote_signal(input.hash, input.agents)
}

/// Called remotely by a sending agent, permitted by the init cap grant.
/// Re-emits the nudge to this agent's own UI, tagged with the sender.
///
/// `hash` is untrusted: it is whatever the sender chose to put there, and it may
/// name data that does not exist, that this agent is not the recipient of, or
/// nothing at all. Nothing here fetches it. Whatever acts on a nudge is
/// responsible for deciding whether the thing at that hash is really addressed to
/// this agent, which for messaging is what the `Inbox` links and their validation
/// settle.
///
/// A nudge from a blocked sender should never reach the UI. That check belongs
/// with the code that knows about blocking, and arrives with the inbox.
#[hdk_extern]
pub fn recv_remote_signal(hash: ActionHash) -> ExternResult<()> {
    let info = call_info()?;
    emit_signal(Signal::Nudge {
        hash,
        from: info.provenance,
    })
}
