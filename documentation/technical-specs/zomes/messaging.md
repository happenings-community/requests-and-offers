# Messaging Zomes (`messaging`, `messaging_integrity`)

This page covers the signal layer (sections 1 to 5, #213) and the encrypted inbox built on it (section 6, #301).

## 1. Overview

- **Purpose**: The signal layer. One agent tells others that something addressed to them exists at an `ActionHash`, so their app can fetch it now rather than on its next poll. From #364 a second signal, the receipt, says how far somebody has read (section 2.2; the same mark also rides in a message's body, section 6). It is the doorbell described in the [exchange record note](../../architecture/EXCHANGE_RECORD.md) (section 11): the stored data is the record, and the signal only says where to look.
- **Status**: Added in #213, alpha 2. The encrypted inbox that stores messages (#301, section 6) is the first consumer.
- **A nudge carries one `ActionHash` and never content.** What it points at is stored data that validation has seen, a nudge cannot push arbitrary bytes at another agent's UI, and no size bound is needed because the hash is fixed-length. A receipt is the exception: it carries a time that no validation sees, which is the sender's claim and nothing more.
- **Zome structure**: the signal layer described in sections 2 to 5 needs no entry or link types. The inbox (section 6) adds an integrity zome, `messaging_integrity`, with one entry type and one link type, and so is part of the DNA hash. #364 removes three private entry types from it and changes what `recv_remote_signal` takes, so it changes both the DNA hash and the remote-signal wire format.

## 2. Coordinator Zome (`messaging`)

### 2.1. Externs

| Extern | Called by | What it does |
|---|---|---|
| `init` | the conductor, once per cell | commits the capability grant below |
| `send_nudge(SendNudgeInput)` | this agent's own UI | sends `hash` to each agent in `agents` as a remote signal |
| `send_receipt(SendReceiptInput)` | this agent's own UI | tells every agent of `to_user` how far this agent has read, as a remote signal. Nothing is stored and nothing is published |
| `recv_remote_signal(RemotePayload)` | a sending agent, through the grant | re-emits the nudge or the receipt to this agent's own UI, tagged with the sender |

```rust
pub struct SendNudgeInput {
  pub hash: ActionHash,
  pub agents: Vec<AgentPubKey>,
}

pub struct SendReceiptInput {   // camelCase on the wire
  pub to_user: ActionHash,
  pub read_up_to: Timestamp,
}

#[serde(tag = "type", rename_all = "camelCase")]
pub enum RemotePayload {
  Nudge { hash: ActionHash },
  Receipt { read_up_to: Timestamp },
}
```

### 2.2. Signal

```rust
#[serde(tag = "type")]
pub enum Signal {
  Nudge { hash: ActionHash, from: AgentPubKey },
  Receipt { read_up_to: Timestamp, from: AgentPubKey },   // `readUpTo` on the wire
}
```

`from` is read from `call_info()?.provenance`, never from the payload, which has no sender field. A nudge cannot claim to come from someone else.

`hash` is untrusted, and so is a receipt's `read_up_to`: a receipt is a claim, and the receiving app must clamp it to the last message it actually sent that person (the interface does, #308); nothing in this zome clamps. A read receipt is a signal and never an entry, because an entry would publish its action, and the action's time and type would tell anyone watching who read whose message and when. `send_receipt` sends on every call; a caller should call it only when the mark advances, since an unchanged one tells the other person this agent is online without having read anything. The same mark rides in the body of the next message, so a dropped signal costs nothing.

**What a receipt still shows, and to whom.** It tells the other person's agents this agent's key, that it is online now, and a claimed time. It is not on any chain, but the transport and any relay see that two agents exchanged something at that moment, so a receipt sent just after a message arrives is a timing signal visible to the relay where a chain entry would have been visible to the whole DHT. And `send_receipt` has no caller check: any agent with a cell, accepted or not, can send a receipt to any member's agents, including someone they never wrote to. The app must treat one as a claim from `from` and nothing more.

A nudge's `hash` is whatever the sender chose, and it may name data that does not exist, that is not addressed to this agent, or nothing at all. Nothing in this zome fetches it. Whatever acts on a nudge decides whether the data at that hash is really for this agent; for messaging, the inbox's links and their validation settle that.

## 3. Access Control

`init` grants any agent the right to call exactly one function, `recv_remote_signal` on this zome. The grant is `Unrestricted` by necessity, because correspondents cannot be known in advance, and it opens nothing else. `create_cap_grant` commits it as a private entry on the agent's own chain, so it is never gossiped.

A recipient does not need priming. An inbound remote signal is itself a zome call, and the conductor runs `init` before it checks authorisation, so the grant is committed by the call that needs it.

`init` runs once per cell. A cell that existed before this zome was added never runs it and never gets the grant, so adding `messaging` to a running deployment in place with `UpdateCoordinators` would leave those cells unable to receive nudges, silently. A fresh install does not hit this.

**Blocking is not in this zome.** From #364 nothing here blocks: it is the interface's job, in the member's own app, in local storage, applied there to what the read calls return and to incoming signals (#308). It was first built as private `Block` entries on the blocker's chain; a private entry hides its content but not its timing, and a block committed moments after a message arrived told anyone watching the chain who had been blocked.

## 4. Delivery

A nudge is best-effort, and two caveats follow from the host functions.

- **`Ok(())` means queued, not delivered.** `send_remote_signal` spawns a detached task and returns at once; a failure is only logged. There is no delivery receipt and no error path for a send that fails.
- **Undiscovered recipients are skipped.** The p2p layer looks each recipient up in the sender's own peer store and skips anyone it cannot find, without reporting it.

So a nudge reaches a recipient only if they are online and already discovered by the sender, and neither condition is reported back. That is acceptable because the nudge is never the record: a lost one costs the recipient timeliness, and the stored data is still there to be read.

Rate is not bounded. The transport does not rate-limit remote signals, so a peer can send nudges as fast as it can sign them. Each nudge is one fixed-length hash, each receipt one timestamp, and neither fetches anything, so the cost to a recipient is small. The zome does not block anybody (#364 took that out); ignoring a sender is the interface's job (#308).

## 5. Tests

`tests/sweettest/tests/messaging.rs`, run as `messaging` in the Heavy tests (manual) workflow, on a `run:sweettest` or `run:heavy` label:

- `send_nudge_reaches_recipient`: one agent nudges another, who receives it tagged with the sender.
- `send_nudge_reaches_every_recipient_in_one_call`: one call nudges two agents, both awaited together against the same deadline.

Every recipient is unprimed. The deadline is 240s, set from the hosted runner's measured arrival times (quoted beside `SIGNAL_DEADLINE`), and each arrival time is logged on success so the next change to it is made from CI figures.

## 6. The Encrypted Inbox (#301, #304)

Messages are stored encrypted on the shared DNA and linked from the recipient's agent key; a nudge carrying only the action hash tells the recipient to look. **Sender, recipient and timing are public for the life of the network; content, role and case are private.** A sealed mailbox that also hides who wrote to whom is a later module.

There are two kinds of message: **personal**, from one member to another (`send_message`), and **role messages**, to or from the holders of a role and grouped into cases (`send_role_message`, section 6.5). Both travel the same way, as `EncryptedMessage` entries with an `Inbox` link, and both pass through `deliver`, the one path every send takes.

### 6.1. What is public and what is private

| Data | Where it lives | Who can read it |
|---|---|---|
| `EncryptedMessage` (nonce, ciphertext and the sender's member grant) | public entry on the DHT | anyone holds it; only the recipient agent can decrypt it. The grant says no more than the author's key on the action already does |
| `Inbox` link, recipient's agent key to the message's action hash, empty tag | public link | anyone can see that A wrote to B, and when |
| content, role, direction and case (ID, kind, opener, event) | inside the ciphertext | the recipient agent, and the sending agent |
| the send id, the read mark and a listing reference | inside the ciphertext | the recipient agent, and the sending agent |
| who a member has blocked | not on any chain: the member's own app holds it | that member's device only |
| how far a member has read | not on any chain: sent as a signal and in the body of their next message | the other person's agents; the transport sees that something was exchanged, and when |

The role and the case are inside the encryption on purpose: on the entry or in a link tag they would tell the whole network that a member had written to the administrators, and about what.

### 6.2. Validation (`messaging_integrity`)

Refused: a message that does not carry a member grant held by its author, the same rule a listing has, so an agent who was never accepted cannot use the network to carry messages; a ciphertext over `MAX_CIPHERTEXT_BYTES` (17 KiB); any update to a messaging entry; a delete by anyone but the author; an `Inbox` link whose base is not an agent key, whose target is not an `EncryptedMessage`, whose author is not the message's author, or whose tag is not empty; and a link delete by anyone but the link's author, so a recipient cannot destroy the sender's record of what they sent.

Agent-activity ops skip validation, as in every other integrity zome since #280: no rule here applies to them.

What validation cannot prove is that a grant has not been revoked since, so a suspended member's message is caught on read, where `get_inbox` drops authors who are not accepted now. Until then their node can still store and gossip what a modified client writes.

**The grant rule holds on a network with a progenitor key, which alpha 2 is not.** With no key in the DNA properties, validation accepts any root (`administration.md`, *The root*), so a modified client can write itself a root admin grant, a member grant resting on it, and then messages that pass this rule: two extra writes. The read side still drops them, because `read_inbox_entries` filters on accepted status, not on grants, until the forger also writes itself into the accepted index with the same forged grant: one more write, which a network with no key cannot refuse.

Nor can validation prove who a ciphertext was sealed to. It proves the link's author wrote the message, not that the message was encrypted to the link's base.

**An author's delete is a withdrawal from later reads, not an unsend.** No extern deletes a message, so today only a modified client can. `get` on a deleted action returns nothing ("Deleted actions are a tombstone set", `holochain_cascade` 0.7.0, `src/lib.rs:328-334`), so once a delete reaches the authorities the message drops out of `get_inbox` and `get_message` returns `NotFound`. A reader who has already decrypted it keeps it, and nothing is erased: the op stays held, as ciphertext. A real "withdraw a message" is #482.

### 6.3. Sending

`send_message { to_user, content, send_id, read_up_to, listing }` (the last three optional):

- **You must be accepted to send, but not to receive.** The sender must be an accepted member. The recipient need not be, but **only a network administrator may write to a member who is not accepted**, so an administrator can ask an applicant what their application is missing and other members cannot reach pending or rejected members. The applicant cannot write back; they answer by editing their application. Stewards join administrators here when that role exists. The rule is checked in `deliver` (`require_may_write_to`), so it covers the member a personal message goes to and the member whose case a holder replies on, and not the holders a role message reaches through their role.
- **One copy per recipient agent**, because the HDK encrypts to an agent key, not to a person. A sender reads their own sent copy only from the agent that sent it, and an agent added to a `User` later cannot read anything sent before it existed.
- **Size is bounded twice**: the coordinator refuses content over 16 KiB before encrypting, so the caller gets a clear error, and validation bounds the ciphertext because it cannot assume the coordinator ran.
- **When no agent of any recipient can be found from this device**, the send fails with `DEVICES_NOT_FOUND` and writes nothing. It never means a member has no agents: `get_user_agents` reads with `GetStrategy::Network`, which falls back to locally cached metadata, so a device with no network and a cold cache finds nobody.
- **A nudge failure never undoes a stored message.** The stored entry is the delivery guarantee; the nudge is timeliness.
- **Each copy carries the sender's member grant**, which `deliver` reads with `can` and attaches. A sender who is accepted and holds no grant this node can see is refused with `NoMemberGrantYet` before anything is encrypted or written. Just after acceptance that is propagation, and the send works when tried again.
- **A personal message carries text or a listing, never both, and never neither.** This is `send_message`'s rule, in the coordinator: a role message is not checked for emptiness, and no read path refuses a body from a modified client that carries both. `listing` names a listing published from the conversation and is valid only with empty `content`. Whether the listing exists and is the sender's is checked where it is shown, with the interface (#308), not here.
- **`send_id` is the caller's own name for this send**, up to 64 bytes, carried inside the ciphertext. It is optional and an empty one is accepted. After a send that got no answer the interface (#308) does not guess and does not retry: it calls `find_sent { send_id, since }`, which looks on this agent's own chain from `since` onwards and returns the message's hash if it was written. An empty `send_id` finds nothing. `since` is compared with the conductor's action timestamps, so a caller whose clock runs ahead of its conductor's could be told a real send was not sent.
- **`read_up_to` lets a message carry how far its sender has read**, so a receipt that was dropped as a signal arrives with the next message.

Errors come from `MessagingError` in `utils/src/errors.rs`, as for every zome.

### 6.4. Reading

`get_inbox` and `get_message` apply the same filters to every message, on the reading side, because the recipient's own node decides what the recipient sees; `get_inbox` then also leaves out role messages, which `get_message` returns like any other. `get_sent` applies none, since it reads only this agent's own sent copies:

- **Blocked authors are not filtered here.** The reader's own app applies its block list to what these calls return (section 3).
- **Authors who are not accepted *now* are dropped**, since a status can change after sending and a modified client can skip the sender-side check.
- **A reader who is not accepted, and is not an administrator, sees only administrators' messages.** This mirrors `require_may_write_to` on the sending side, which a modified client can skip: a pending or rejected member hears only from the administrators. Both read paths call one function, `reader_is_restricted`, so the rule cannot hold on one and not the other.
- **A role message whose author claims a role they do not hold now is withheld** (section 6.5).
- **`get_inbox` returns personal messages only.** Role messages are read through `get_role_inbox` by a holder and `get_my_role_correspondence` by the member who opened the case.

A message in your own inbox that fails to decrypt comes back as `Unreadable` and is logged: **a fault, or a sender that sealed it wrongly.** An honest sender encrypts to the agent the link names, so the first case is a bug worth seeing; in the second, an accepted member with a modified client planted it, and the entry carries `from` so the reader's own app can leave it out once the member blocks that sender. `get_message` treats `Unreadable` as ordinary, because for a third party it is.

**Delivery to an offline recipient needs somebody holding the data to be online when they read.** That is what stored on a shared DHT means.

**A reader that keeps what it has read calls `get_inbox_delta`** with the hashes it holds. A message never changes, so a known hash is not fetched again: its author is the `Inbox` link's author (validation proves it), so the author filters run on the link, and the hash is returned in `visible` without a `get`. Only unknown hashes are fetched and decrypted, in `entries`. Role messages are not personal chat and are left out of both; their hashes come back in `skipped`, and the caller passes them back in `skipped` on the next call so they are not fetched and decrypted again on every poll (whether a message is a role message is inside the encryption, so the first read has to open it). A known hash missing from `visible` has stopped passing the filters, and the reader drops it. `get_inbox` remains for a reader with nothing held. Three things a caller must know. **`known` may hold only hashes this call returned in `entries`:** the zome takes the caller's word for which list a hash belongs in, and `get_message` and the role inbox return role messages too, so a role hash put in `known` comes back in `visible`. **Two kinds of hash are fetched again on every poll,** because they land in none of the three lists: a role message whose claim no longer stands (its author lost the role), and a linked message this node cannot fetch, whether not yet or because its author deleted the entry and left the link. A hash the reader already holds stays in `visible` after such a delete, where `get_inbox` would drop it: a reader who has already decrypted a message keeps it. **A message's length is public,** so a message that carries only a listing, which is short and nearly constant in size, can be guessed to be one.

### 6.5. Role messages and cases

A member writes to a role, not to a person, and every holder of the role receives it. Holders reply as the role, and the member reads the replies in one place. Messages about the same matter form a **case**.

**Roles.** `RoleRef` names `Admin`, a named `Permission` (#241, for stewards) or the coordinators of one organisation (`OrgCoordinator`). **Only `Admin` is switched on in alpha 2**; the other two are shaped so that later work adds them without changing the message body, and are refused with `RoleNotEnabled` until then. A named permission over `MAX_PERMISSION_BYTES` (64) is refused first, with `PermissionNameTooLong`.

`send_role_message { role, content, case_id, kind, opener, event }`:

- **Any accepted member may write to a role**, which is how a case is opened and followed up. Writing on your own case claims nothing.
- **Only a current holder may reply on another member's case, or send a case event.** Checked here, and again by every reader, because a status can change in between and a modified client can skip the send-side check.
- **The message reaches every holder, the sender's own agents, and on a reply the member who opened the case.** The sender's own copy is deliberate: every participant reads the whole case from one inbox read, with no chain walk.
- **The opener and the direction are worked out from the sender's own `User`**, never taken from the input, so a forged opener cannot write into somebody else's case. The direction (`ToHolders`, `FromHolder`) is a label for the interface and is never used for authorisation.
- **A case is keyed by its opener's `User` and its ID together**, because the sender chooses the ID (at most 64 bytes); a member reusing another member's ID opens a separate case.

**Who is claiming the role is decided from facts the author cannot choose** (`claims_the_role`): a message claims the role when it carries an event, or when its author is not the case's opener. Each reader then checks that the author holds the role **now** (`holds_role`), and withholds the message if not. Fail closed: an author whose `User` cannot be resolved has to prove the role.

**Case events**, folded into the case's state by `assemble_cases`, oldest first:

| Event | Effect |
|---|---|
| `Claim` | the author is dealing with it; several claims may stand at once, and a claim never blocks |
| `Release` | the author no longer is |
| `HandOverOffer { to }` | offers the case to another holder, by their `User` |
| `HandOverAccept` | the holder the offer named takes it, and the offerer's claim ends |
| `CaseNote` | a note; the note is the message's content |
| `Complete { outcome }` | closes the case as `Resolved` or `Dismissed` |
| `Reopen` | opens a closed case again |

The fold is idempotent for repeated copies of one event, since a send fans out one entry per agent. Events are ordered by the action timestamp of the reader's own copy, which is not the same for every reader (section 6.6).

`get_role_inbox(role)` returns the cases addressed to the caller as a holder, and is refused unless the caller holds the role now. `get_my_role_correspondence()` returns the cases the caller opened, grouped by role; it needs no role, because these are the member's own cases.

### 6.6. Known limits of cases in alpha 2

None of these lets anybody read or write what they should not. They are about how a case behaves, and are recorded here so that nobody relies on behaviour cases do not have. #483 tracks them for alpha 3.

- **Readers do not share an event order.** Each reader orders a case by the timestamps of its own copies, and a send writes a separate copy, with its own timestamp, for every recipient agent. So two holders acting within moments of each other can be folded in a different order by different readers, and reach different states; and a holder with a wrong clock can put a `Complete` before a `Reopen` that followed it.
- **The latest hand-over offer wins.** A second offer replaces the first, and an accept of the earlier one is then ignored without a trace.
- **Case history is re-read every time, against today's roles and statuses.** Withholding a removed administrator's messages also withholds their events, so a case they completed reads as open again and their claims disappear; rejecting a member withholds the message that opened their case.
- **A holder added later sees no earlier case.** Each copy is encrypted to the agents that held the role when it was sent.
- **A send that reaches only some holders still succeeds.** `deliver` fails only when no agent of any recipient can be found; a holder who cannot be resolved just now is skipped, and the sender gets fewer `SentMessage`s with no error. Because the sender's own agents are always recipients, a role message that reaches no holder at all succeeds too, with only the sender's copy written.

### 6.7. Tests

`tests/sweettest/tests/messaging_inbox.rs` and `messaging_roles.rs`, run as `messaging_inbox` and `messaging_roles` in the Heavy tests (manual) workflow on a `run:sweettest` or `run:heavy` label, not in the CI on every pull request.

The member-grant rule is tested with the other grant rules, in `tests/sweettest/tests/grants.rs` (target `grants`): `a_message_carries_the_member_grant_its_author_holds`, `an_inbox_link_is_its_authors_record_of_their_own_message` (the five `Inbox` link rules, each by a forged link) and `an_accepted_member_with_no_grant_is_told_so_and_sends_nothing`.

`messaging_inbox` proves the encryption before anything rests on it (the recipient reads, the sender reads their own copy, a third member holds the ciphertext and cannot read it, either party can be offline), then the access rules (an unaccepted sender is refused, only an administrator may write to a member who is not accepted, a reader who is not accepted hears only from administrators on both read paths, a since-rejected author is hidden), then what #364 adds: a reader that keeps what it read is sent only what is new, a send id rides along and `find_sent` locates it, a message carries text or a listing and never both or neither, a receipt arrives as a signal from its sender, and the chain functions for blocks and read markers no longer exist.

`messaging_roles` proves that a case reaches every holder and the reply comes back, that a holder may reply to an opener who is no longer accepted, claiming, completing, reopening and handing over, that a removed administrator's role messages are withheld (from the role inbox, the member's own area and `get_message`), that a reused case ID from another member opens a separate case, that the role calls refuse a non-holder and the roles not yet built, and that a polling reader is told which messages are role messages and is never sent one as chat.

The pure validation rules are unit-tested in `messaging_integrity`.
