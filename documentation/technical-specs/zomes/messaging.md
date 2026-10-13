# Messaging Zomes (`messaging`, `messaging_integrity`)

This page covers the signal layer (sections 1 to 5, #213) and the encrypted inbox built on it (section 6, #301).

## 1. Overview

- **Purpose**: The signal layer. One agent tells others that something addressed to them exists at an `ActionHash`, so their app can fetch it now rather than on its next poll. It is the doorbell described in the [exchange record note](../../architecture/EXCHANGE_RECORD.md) (section 11): the stored data is the record, and the signal only says where to look.
- **Status**: Added in #213, alpha 2. The encrypted inbox that stores messages (#301, section 6) is the first consumer.
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

## 6. The Encrypted Inbox (#301)

Messages are stored encrypted on the shared DNA and linked from the recipient's agent key; a nudge carrying only the action hash tells the recipient to look. **Sender, recipient and timing are public for the life of the network; content and conversation grouping are private.** A sealed mailbox that also hides who wrote to whom is a later module.

### 6.1. What is public and what is private

| Data | Where it lives | Who can read it |
|---|---|---|
| `EncryptedMessage` (nonce and ciphertext only) | public entry on the DHT | anyone holds it; only the recipient agent can decrypt it |
| `Inbox` link, recipient's agent key to the message's action hash, empty tag | public link | anyone can see that A wrote to B, and when |
| conversation ID, content, `MessageKind` | inside the ciphertext | the recipient agent, and the sending agent |
| `Block`, `Unblock`, `ReadMarker`, `ReportResolution` | private entries on the author's own chain | the author only |

The kind of a message, personal or a technical report, is inside the encryption on purpose: on the entry or in a link tag it would tell the whole network that a member had reported something.

### 6.2. Validation (`messaging_integrity`)

Refused: a ciphertext over `MAX_CIPHERTEXT_BYTES` (17 KiB); any update to a messaging entry; a delete by anyone but the author; an `Inbox` link whose base is not an agent key, whose target is not an `EncryptedMessage`, whose author is not the message's author, or whose tag is not empty; and a link delete by anyone but the link's author, so a recipient cannot destroy the sender's record of what they sent.

Agent-activity ops skip validation, as in every other integrity zome since #280: no rule here applies to them.

What validation cannot prove is who a ciphertext was sealed to. It proves the link's author wrote the message, not that the message was encrypted to the link's base.

### 6.3. Sending

`send_message { to_user, conversation_id, content, kind }`:

- **You must be accepted to send, but not to receive.** The sender must be an accepted member. The recipient need not be, but **only a network administrator may write to a member who is not accepted**, so an administrator can ask an applicant what their application is missing and other members cannot reach pending or rejected members. The applicant cannot write back; they answer by editing their application. Stewards join administrators here when that role exists.
- **One copy per recipient agent**, because the HDK encrypts to an agent key, not to a person. A sender reads their own sent copy only from the agent that sent it, and an agent added to a `User` later cannot read anything sent before it existed.
- **Size is bounded twice**: the coordinator refuses content over 16 KiB or a conversation ID over 256 bytes before encrypting, so the caller gets a clear error, and validation bounds the ciphertext because it cannot assume the coordinator ran.
- **A technical report** (`kind: AdminReport`) may only be addressed to a network administrator.
- **A nudge failure never undoes a stored message.** The stored entry is the delivery guarantee; the nudge is timeliness.

### 6.4. Reading

`get_inbox`, `get_sent` and `get_message` apply the same filters, on the reading side, because the recipient's own node decides what the recipient sees:

- **Blocked authors are dropped.** Blocking is private to the blocker's chain.
- **Authors who are not accepted *now* are dropped**, since a status can change after sending and a modified client can skip the sender-side check.
- **An administrator's technical reports are left out of their personal inbox** and returned by `get_admin_reports` instead, with that administrator's own resolved state.

A message in your own inbox that fails to decrypt comes back as `Unreadable` and is logged: **a fault, or a sender that sealed it wrongly.** An honest sender encrypts to the agent the link names, so the first case is a bug worth seeing; in the second, an accepted member with a modified client planted it, and blocking that sender removes it, because the block filter runs before decryption. `get_message` treats `Unreadable` as ordinary, because for a third party it is.

**Delivery to an offline recipient needs somebody holding the data to be online when they read.** That is what stored on a shared DHT means.

### 6.5. Tests

`tests/sweettest/tests/messaging_inbox.rs`, in the CI matrix as `messaging_inbox`. The first cases prove the encryption before anything rests on it (the recipient reads, the sender reads their own copy, a third member holds the ciphertext and cannot read it, either party can be offline), then the access rules (an unaccepted sender is refused, only an administrator may write to a member who is not accepted, a since-rejected author is hidden), blocking, and technical reports. The pure validation rules are unit-tested in `messaging_integrity`.
