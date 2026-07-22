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
/// a remote signal. Delivery is best-effort and requires the recipient to be
/// online; durability is added later, when messages are persisted as entries.
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

/// Called remotely by a sending agent, permitted by the init cap grant.
/// Re-emits the message to this agent's own UI, tagged with the sender.
#[hdk_extern]
pub fn recv_remote_signal(message: Message) -> ExternResult<()> {
    let info = call_info()?;
    let signal = Signal::Message {
        stream_id: message.stream_id,
        content: message.content,
        from: info.provenance,
    };
    emit_signal(signal)
}
