# Messaging Zome (`messaging`)

## 1. Overview

- **Purpose**: The signal layer. One agent tells others that something addressed to them exists at an `ActionHash`, so their app can fetch it now rather than on its next poll. It is the doorbell described in the [exchange record note](../../architecture/EXCHANGE_RECORD.md) (section 11): the stored data is the record, and the signal only says where to look.
- **Status**: Added in #213, alpha 2. The encrypted inbox that stores messages arrives separately, in #301, and is the first consumer.
- **A nudge carries one `ActionHash` and never content.** Nothing travels in a signal that validation does not see, a nudge cannot push arbitrary bytes at another agent's UI, and no size bound is needed because the hash is fixed-length.
- **Zome structure**: a coordinator only, registered with `dependencies: []`. It defines no entry or link types, so it adds no integrity zome and does not change the DNA hash.

## 2. Coordinator Zome (`messaging`)

### 2.1. Externs

| Extern | Called by | What it does |
|---|---|---|
| `init` | the conductor, once per cell | commits the capability grant below |
| `send_nudge(SendNudgeInput)` | this agent's own UI | sends `hash` to each agent in `agents` as a remote signal |
| `recv_remote_signal(ActionHash)` | a sending agent, through the grant | re-emits the nudge to this agent's own UI, tagged with the sender |

```rust
pub struct SendNudgeInput {
  pub hash: ActionHash,
  pub agents: Vec<AgentPubKey>,
}
```

### 2.2. Signal

```rust
#[serde(tag = "type")]
pub enum Signal {
  Nudge { hash: ActionHash, from: AgentPubKey },
}
```

`from` is read from `call_info()?.provenance`, never from the payload, which has no sender field. A nudge cannot claim to come from someone else.

`hash` is untrusted. It is whatever the sender chose, and it may name data that does not exist, that is not addressed to this agent, or nothing at all. Nothing in this zome fetches it. Whatever acts on a nudge decides whether the data at that hash is really for this agent; for messaging, the inbox's links and their validation settle that.

## 3. Access Control

`init` grants any agent the right to call exactly one function, `recv_remote_signal` on this zome. The grant is `Unrestricted` by necessity, because correspondents cannot be known in advance, and it opens nothing else. `create_cap_grant` commits it as a private entry on the agent's own chain, so it is never gossiped.

A recipient does not need priming. An inbound remote signal is itself a zome call, and the conductor runs `init` before it checks authorisation, so the grant is committed by the call that needs it.

`init` runs once per cell. A cell that existed before this zome was added never runs it and never gets the grant, so adding `messaging` to a running deployment in place with `UpdateCoordinators` would leave those cells unable to receive nudges, silently. A fresh install does not hit this.

Dropping nudges from blocked senders belongs with the code that knows about blocking, and arrives with the inbox (#301).

## 4. Delivery

A nudge is best-effort, and two caveats follow from the host functions.

- **`Ok(())` means queued, not delivered.** `send_remote_signal` spawns a detached task and returns at once; a failure is only logged. There is no delivery receipt and no error path for a send that fails.
- **Undiscovered recipients are skipped.** The p2p layer looks each recipient up in the sender's own peer store and skips anyone it cannot find, without reporting it.

So a nudge reaches a recipient only if they are online and already discovered by the sender, and neither condition is reported back. That is acceptable because the nudge is never the record: a lost one costs the recipient timeliness, and the stored data is still there to be read.

Rate is not bounded. The transport does not rate-limit remote signals, so a peer can send nudges as fast as it can sign them. Each is one fixed-length hash and fetches nothing, so the cost to a recipient is small; blocking and the inbox's own rules (#240, #301) are where that is handled.

## 5. Tests

`tests/sweettest/tests/messaging.rs`, in the CI matrix as `Sweettest (messaging)`:

- `send_nudge_reaches_recipient`: one agent nudges another, who receives it tagged with the sender.
- `send_nudge_reaches_every_recipient_in_one_call`: one call nudges two agents, both awaited together against the same deadline.

Every recipient is unprimed. The deadline is 240s, set from the hosted runner's measured arrival times (quoted beside `SIGNAL_DEADLINE`), and each arrival time is logged on success so the next change to it is made from CI figures.
