use hdk::prelude::*;
use std::collections::HashSet;

/// Input from this agent's own UI: send `content` on `stream_id` to `agents`.
#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageInput {
    pub stream_id: String,
    pub content: String,
    pub agents: Vec<AgentPubKey>,
}

/// The payload that crosses the wire to another agent via a remote signal.
/// For the substrate proof `content` is plaintext. Under the messaging design
/// it will carry ciphertext (see the messaging architecture note, persist-and-
/// signal lifecycle). Serde derives are sufficient for the extern and signal
/// boundaries on hdk 0.6; SerializedBytes is not required (cf. the misc zome).
#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    /// Caller-defined and opaque to this zome: it is never parsed, matched or
    /// validated here, only carried through to the recipient's UI. On the
    /// receiving side it is also untrusted, since it is whatever the sending
    /// agent chose to put there. Any meaning it carries, and any check that it
    /// names a stream this agent actually belongs to, is the UI's to enforce.
    /// Its length is bounded on receipt by `MAX_STREAM_ID_BYTES`, since it
    /// reaches the UI just as `content` does.
    pub stream_id: String,
    pub content: String,
}

/// Signals emitted to this agent's own UI. A received remote signal becomes a
/// `Signal::Message`; `from` is the sender, read from call provenance.
#[derive(Serialize, Deserialize, Debug)]
#[serde(tag = "type")]
pub enum Signal {
    Message {
        stream_id: String,
        content: String,
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

/// Called by this agent's own UI. Pushes `content` to each recipient's node via
/// a remote signal.
///
/// `Ok(())` means only that the signal was handed to the network for signing
/// and sending. It is not a delivery receipt, and there is no error path for a
/// send that fails: the host function spawns a detached task and returns
/// `Ok(())` immediately (holochain 0.6.1:
/// `core/ribosome/host_fn/send_remote_signal.rs:46` spawns, `:118` returns),
/// logging any failure at `tracing::info!`. Below it, the p2p layer logs send
/// failures at `tracing::debug!` and skips recipients missing from the sender's
/// peer store (`holochain_p2p` `spawn/actor.rs:1575-1583`).
///
/// So delivery requires the recipient to be online *and* already discovered by
/// this agent, and neither condition is reported back. Durability is added
/// later, when messages are persisted as entries.
#[hdk_extern]
pub fn send_message(input: SendMessageInput) -> ExternResult<()> {
    send_remote_signal(
        Message {
            stream_id: input.stream_id,
            content: input.content,
        },
        input.agents,
    )
}

/// Largest `content` this agent will re-emit to its own UI. Anything larger is
/// dropped in `recv_remote_signal`.
///
/// The bound exists because nothing below the zome applies one: a sender can
/// call `send_remote_signal` as often and with as large a payload as it likes,
/// and the receiving side runs `recv_remote_signal` for each. Dropping is silent
/// and deliberate: there is no error channel back to the sender anyway.
pub const MAX_CONTENT_BYTES: usize = 16 * 1024;

/// Largest `stream_id` this agent will re-emit, bounded for the same reason and
/// dropped the same way.
///
/// Kept separate from `MAX_CONTENT_BYTES` rather than folded into one combined
/// limit, so that neither field's ceiling moves when the other is retuned. It is
/// generous for an identifier: a UUID is 36 bytes.
pub const MAX_STREAM_ID_BYTES: usize = 256;

/// Called remotely by a sending agent, permitted by the init cap grant.
/// Re-emits the message to this agent's own UI, tagged with the sender.
///
/// Both fields of `message` come from a remote agent and are untrusted; see
/// `Message` for what that means for `stream_id`.
#[hdk_extern]
pub fn recv_remote_signal(message: Message) -> ExternResult<()> {
    if message.content.len() > MAX_CONTENT_BYTES
        || message.stream_id.len() > MAX_STREAM_ID_BYTES
    {
        return Ok(());
    }

    let info = call_info()?;
    let signal = Signal::Message {
        stream_id: message.stream_id,
        content: message.content,
        from: info.provenance,
    };
    emit_signal(signal)
}
