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

**Blocking is not in this zome.** From #364 nothing here blocks: it is the interface's job, in the member's own app, in local storage, applied there to what the read calls return and to incoming signals (#308, section 7). It was first built as private `Block` entries on the blocker's chain; a private entry hides its content but not its timing, and a block committed moments after a message arrived told anyone watching the chain who had been blocked.

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

The inbox's externs, beside the signal layer's in 2.1:

| Extern | What it does |
|---|---|
| `send_message(SendMessageInput)` | sends a personal message to every agent of a member (section 6.3) |
| `send_role_message(SendRoleMessageInput)` | writes to the holders of a role, or as one, inside a case (section 6.5) |
| `get_inbox` | every personal message addressed to this agent that passes the reading filters, decrypted; one that will not decrypt comes back as `Unreadable` (section 6.4) |
| `get_inbox_delta(GetInboxDeltaInput)` | the same, for a caller that already holds some: only what it does not hold |
| `get_message(ActionHash)` | one message by its action hash, which is what a nudge carries, with the same filters |
| `get_sent` | everything this agent has sent, read from its own chain |
| `find_sent(FindSentInput)` | whether a send with a given send id is on this agent's chain, after a send got no answer |
| `get_role_inbox(RoleRef)` | the cases addressed to this agent as a holder of the role, refused unless it holds it now |
| `get_my_role_correspondence` | this member's own role conversations, grouped by role |

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

Refused: a message that does not carry a member grant held by its author, the same rule a listing has, so an agent who was never accepted cannot use the network to carry messages; a ciphertext over `MAX_CIPHERTEXT_BYTES` (3,840 bytes, what Lair can open; see 6.3); any update to a messaging entry; a delete by anyone but the author; an `Inbox` link whose base is not an agent key, whose target is not an `EncryptedMessage`, whose author is not the message's author, or whose tag is not empty; and a link delete by anyone but the link's author, so a recipient cannot destroy the sender's record of what they sent.

Agent-activity ops skip validation, as in every other integrity zome since #280: no rule here applies to them.

What validation cannot prove is that a grant has not been revoked since, so a suspended member's message is caught on read, where `get_inbox` drops authors who are not accepted now. Until then their node can still store and gossip what a modified client writes.

**The grant rule holds on a network with a progenitor key, which alpha 2 is not.** With no key in the DNA properties, validation accepts any root (`administration.md`, *The root*), so a modified client can write itself a root admin grant, a member grant resting on it, and then messages that pass this rule: two extra writes. The read side still drops them, because `read_inbox_entries` filters on accepted status, not on grants, until the forger also writes itself into the accepted index with the same forged grant: one more write, which a network with no key cannot refuse.

Nor can validation prove who a ciphertext was sealed to. It proves the link's author wrote the message, not that the message was encrypted to the link's base.

**An author's delete is a withdrawal from later reads, not an unsend.** No extern deletes a message, so today only a modified client can. `get` on a deleted action returns nothing ("Deleted actions are a tombstone set", `holochain_cascade` 0.7.0, `src/lib.rs:328-334`), so once a delete reaches the authorities the message drops out of `get_inbox` and `get_message` returns `NotFound`. A reader who has already decrypted it keeps it, and nothing is erased: the op stays held, as ciphertext. A real "withdraw a message" is #482.

### 6.3. Sending

`send_message { to_user, content, send_id, read_up_to, listing }` (the last two optional):

- **You must be accepted to send, but not to receive.** The sender must be an accepted member. The recipient need not be, but **only a network administrator may write to a member who is not accepted**, so an administrator can ask an applicant what their application is missing and other members cannot reach pending or rejected members. The applicant cannot write back; they answer by editing their application. Stewards join administrators here when that role exists. The rule is checked in `deliver` (`require_may_write_to`), so it covers the member a personal message goes to and the member whose case a holder replies on, and not the holders a role message reaches through their role.
- **One copy per recipient agent**, because the HDK encrypts to an agent key, not to a person. A sender reads their own sent copy only from the agent that sent it, and an agent added to a `User` later cannot read anything sent before it existed.
- **Size is bounded twice**: the coordinator refuses content over 3 KiB before encrypting, so the caller gets a clear error, and validation refuses a ciphertext over 3,840 bytes because it cannot assume the coordinator ran. **Both are set by Lair, the keystore**, not by taste: it refuses IPC frames over 8 KiB and carries the bytes to encrypt or open as a msgpack array of integers, two bytes for each byte of 0x80 or more, so the largest ciphertext a recipient can always open is 3,959 bytes. A larger one cannot be read, and the refused frame breaks the recipient's Lair connection. The derivations are on `MAX_CONTENT_BYTES` (coordinator) and `MAX_CIPHERTEXT_BYTES` (integrity). The limit was 16 KiB until the walk of 15 November 2026 found a 12 KB message stuck on "Waiting to send"; the test keystore goes through the same channel, but no test had sent more than a few hundred bytes.
- **When no agent of any recipient can be found from this device**, the send fails with `DEVICES_NOT_FOUND` and writes nothing. It never means a member has no agents: `get_user_agents` reads with `GetStrategy::Network`, which falls back to locally cached metadata, so a device with no network and a cold cache finds nobody.
- **A nudge failure never undoes a stored message.** The stored entry is the delivery guarantee; the nudge is timeliness.
- **Each copy carries the sender's member grant**, which `deliver` reads with `can` and attaches. A sender who is accepted and holds no grant this node can see is refused with `NoMemberGrantYet` before anything is encrypted or written. Just after acceptance that is propagation, and the send works when tried again. A grant revoked while the status stays accepted gives the same refusal, and no retry helps until a new grant is issued. Nothing in the interface revokes a grant on its own, so a direct `revoke_role` or `revoke_roles_of` call reaches that state on purpose. A re-acceptance can also leave it behind: `issue_member_grants` skips an agent it still sees holding a member grant, so an administrator whose node has not yet seen the suspension's revocation issues nothing.
- **A personal message carries text or a listing, never both, and never neither.** This is `send_message`'s rule, in the coordinator: a role message is not checked for emptiness, and no read path refuses a body from a modified client that carries both. `listing` names a listing published from the conversation and is valid only with empty `content`. Whether the listing exists and is the sender's is checked where it is shown, with the interface (#308), not here.
- **`send_id` is the caller's own name for this send**, up to 64 bytes, carried inside the ciphertext. It is required: a send with none, or an empty one, is refused before anything is written, because a send that got no answer can only be checked by its id, and without one an honest retry could write it twice. The check is in the coordinator, because the id is inside the encryption and validation cannot see it. `send_role_message` has the same rule. After a send that got no answer the interface (#308) does not guess and does not retry: it calls `find_sent { send_id, since }`, which looks on this agent's own chain from `since` onwards and returns the message's hash if it was written. An empty `send_id` finds nothing. `since` is compared with the conductor's action timestamps, so a caller whose clock runs ahead of its conductor's could be told a real send was not sent.
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
- **Who holds the role is read from the grants, the same source `holds_role` reads.** For `Admin`, `role_holders` asks `administration` for the agents with a live admin grant (`get_live_administrator_agents`) and resolves each to its `User`. It does not read the `AllAdministrators` roster links: `revoke_role` leaves a revoked administrator on them, and a tombstone on one needs no grant, so reading them sent cases to former administrators and let any member empty the list.
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

`messaging_inbox` proves the encryption before anything rests on it (the recipient reads, the sender reads their own copy, a third member holds the ciphertext and cannot read it, either party can be offline), then the access rules (an unaccepted sender is refused, only an administrator may write to a member who is not accepted, a reader who is not accepted hears only from administrators on both read paths, a since-rejected author is hidden), then what #364 adds: a reader that keeps what it read is sent only what is new, a send id rides along and `find_sent` locates it, a message carries text or a listing and never both or neither, a receipt arrives as a signal from its sender, and the chain functions for blocks and read markers no longer exist. Then the size limit: a message at the limit in two-byte characters, the heaviest Lair has to carry, is sent and read (`a_message_at_the_size_limit_in_two_byte_characters_is_sent_and_read`), and one byte over is refused by the zome (`a_message_one_byte_over_the_size_limit_is_refused`).

`messaging_roles` proves that a case reaches every holder and the reply comes back, that a holder may reply to an opener who is no longer accepted, claiming, completing, reopening and handing over, that a removed administrator's role messages are withheld (from the role inbox, the member's own area and `get_message`), that a reused case ID from another member opens a separate case, that the role calls refuse a non-holder and the roles not yet built, and that a polling reader is told which messages are role messages and is never sent one as chat; that a case message at the size limit reaches every holder and the reply comes back (`a_case_message_at_the_size_limit_reaches_every_holder_and_back`); and that who receives a case is read from the grants, not the roster: an administrator revoked by `revoke_role` is sent no case though the roster still lists them (`a_revoked_administrator_is_sent_no_case`), and a roster emptied by a member's tombstones still lets a case reach the administrators (`a_roster_emptied_by_a_member_still_reaches_the_administrators`).

The pure validation rules are unit-tested in `messaging_integrity`.

## 7. The interface (#308)

The zome stores, delivers and reads. Everything a member would call "my messages" beyond that is the interface's, in `ui/src/lib/stores/messaging.store.svelte.ts` and the pages under `/messages`.

### 7.1. Screens

- **`/messages`**: one row per person, built from messages, interests and exchanges with them. Filters by kind; archived conversations; a row for each message that arrived and could not be read, naming its sender.
- **`/messages/[user]`**: the conversation with one member. Messages, shared listings, interests and proposals in time order, and a composer for an accepted member. Opening it marks it read, and it stays read as messages arrive while it is open, but only while the page is visible: a conversation left open in a hidden tab or a minimised window marks nothing, and sends no receipt, until the member comes back to it. The desktop app leaves Electron's background throttling on, so a minimised window reports hidden; a window only covered by another may still count as visible, depending on the platform.
- **`/messages/blocked`**: who is blocked now, and the history of blocks and unblocks.

### 7.2. Reading

The root layout reads the conversations every 15 seconds while a member is signed in, and on every nudge; the poll, the outbox retry and the signal listener are started by `useMessagingWhileSignedIn` (`ui/src/lib/composables/domain/messaging/`), which tracks whether someone is signed in rather than the user record, so reading the member again does not restart them. Each read calls `get_inbox_delta` with the hashes it already holds and the role messages it was told to skip, so only what is new is fetched and decrypted. The reads overlap (the poll, a nudge, the read after a send) and finish in any order. A read writes what the screen shows unless one started after it has already written, so a slow older read cannot take away what a newer one found, and reads that keep overlapping still reach the screen. On the list, a failure is reported until a read writes the screen, including while the next read is under way; it is never shown as an empty list. A conversation reports its own read: if that fails, the conversation shows the reason and Try again even when a later background read has worked. A conversation, and the list when it has nothing to show, offer Try again beside the reason; a list that already shows conversations keeps them under the reason and the next poll tries again. Trying a conversation again keeps anything already typed in its composer, and a message still on its way stays on its way: Send is not freed under it.

### 7.3. Sending, and the outbox

A send that the zome accepts is done. Otherwise:

| What happened | What the interface does |
|---|---|
| The zome could not find the recipient's devices (nothing was written) | holds the message in the outbox as **waiting** |
| No answer at all: a timeout, or the connection going | holds it as **waiting**, with its send id |
| The zome refused | shows the zome's reason; the draft stays in the composer. If the member has left that conversation by the time the refusal comes, for another one or for anywhere else in the app, the message is kept in its outbox as **refused**, with the reason |

**How a refusal is recognised.** Under Holochain 0.7 a refusal from the zome does not arrive as `ribosome_error`, as it did under 0.6: the app interface answers every failed call with `internal_error`, rendered as `Wasm runtime error while working with Ribosome: …` with the zome's own `Guest("…")` sentence inside. That error is raised inside the call, before its result is checked and before its writes are flushed, so nothing is stored (true of `send_message` and `send_role_message`, which call no other cell). When it carries the zome's own `Guest("…")` sentence the interface treats it as a refusal and shows the sentence (`isZomeFailure`, `ui/src/lib/utils/messaging-threads.ts`). Lair's size refusal (`FrameOverflow`) is a refusal too: on a retry from the outbox it is shown in plain words, and a send from the composer shows the conductor's raw error text, `FrameOverflow` and all. The zome refuses anything that long first (`ContentTooLong`), so it is met only against zomes with the old limit. Any other host function failing inside the call (Lair reconnecting, a network timeout) wrote nothing but is usually passing, so it is treated as no answer and retried, as is any `internal_error` without the prefix, which may follow a write. A validation refusal carries no prefix and also reads as no answer; the coordinator checks everything validation does before writing, so an honest client does not meet one. Until 15 November 2026 the interface knew only the 0.6 name, so from the move to 0.7 every refusal read as no answer and waited in the outbox for ever, holding back every later message to that person.

The outbox is read from the device by whichever comes first: a read of the conversations, a message being held, discarded or sent again, or the next 30 second tick. It does not wait for the conversations to be read successfully. It is retried every 30 seconds and when the browser reports it is online again, oldest first, one run at a time. A run is skipped when the conductor reports no reachable peer (if that question fails, the run goes ahead). Within a run, a message that cannot go holds back the later held ones to the same person, and nobody else's. That is as far as ordering goes: a new message typed while an older one is held goes straight to the zome, ahead of it, and the next run starts afresh. Before anything is sent a second time the chain is asked for its send id (`find_sent`), looking from five seconds before Send was first pressed, so an attempt that committed and lost its answer is seen: found means it went, and it is dropped. If that question cannot be answered the item becomes **may not have sent** and waits for the member to say send again. A refusal on a retry makes it **refused**, with the reason. A member can discard an item in any of the three states, and send a refused one again. A message discarded while a run is under way is not sent by that run, unless its own send had already begun. "Send again" sends at once, after any run already under way. A card (a shared listing, an accept, a decline, a withdrawal) is one at a time, and "going" lasts until the conversation has been read again after it: every control in the conversation that would press a new card is disabled until then (Send again on a held card is the outbox's and follows its rules above), so a second click cannot send a second card and nothing typed into a decline is lost to one. A card that is refused shows the zome's reason and leaves what the member had open as it was: the picker stays open, and a decline keeps its form and its reason. The reason for an accept, decline or withdrawal is shown only while the proposal or interest it was about is still in the conversation and waiting: when it comes, if the member is looking at that person, and otherwise the next time that conversation is on screen, whichever way they come back to it. A reason that was on screen when the member left the conversation has been seen and is not shown again; one that was not (it came while they were elsewhere, or a failed read had put its fault in the conversation's place) is kept. A refused shared listing is shown the same way if the member is looking at that person when it comes; if they are not, it is kept in that person's outbox as **refused**, as a message is. A card still going when the member leaves a conversation, for another one or for anywhere else, is still going when they come back to it. Both are kept in memory only: reloading the app forgets a card still going and a reason not yet seen. A message and a card are answered separately, so pressing one while the other is going changes nothing about either.

Two limits. **A held message shows only in that person's conversation**: the list of conversations has no marker for it, so a refused message to someone with no conversation yet is found only by opening theirs. **One tab at a time**: the outbox is one list per member on the device, and each open tab writes its own view of it, so two tabs open on the same member can each bring back what the other discarded, or drop what the other held. `find_sent` still stops a message that went from going twice.

### 7.4. What is kept on the device

In the browser's local storage, under the member's agent key, and nowhere else: archived conversations, the outbox, how far the member has read each conversation, how far each other person says they have read, the receipt settings (overall, and per conversation: inherit, on or off), the block list and its history, and whether the member has seen the first-contact notice. None of it is on the chain and none of it syncs between a member's devices.

### 7.5. Blocking

A block is by person, not by agent. It is applied in three places:

- **What is read.** A blocked person's messages are left out of every thread, and a message of theirs that could not be read is not shown as a fault.
- **What arrives by signal.** The sender is resolved to a person first. A nudge from someone blocked starts no read, and their receipt is not recorded. A sender who cannot be resolved is not known to be blocked, so their nudge still starts a read; what that read returns goes through the block list.

- **What goes out.** No read receipt is sent to a blocked person when their conversation is opened, and no read mark rides in the body of a message to them. A member can still write to someone they have blocked: the block hides what comes in, it does not stop what the member chooses to send.

Their interests and proposals still show as cards, because those are the exchange's records and the exchange pages show them anyway, but they never count towards the unopened badge.

The blocked person is not told, and their messages are still stored: the zome knows nothing of the block. A block that storage refused to keep (private browsing, a full quota) holds until the page is reloaded, and the member is not told that it will not last.

### 7.6. Receipts

The read mark advances only while the conversation is on screen (the page is visible), so a hidden tab or a minimised window neither marks a message read nor tells its sender this device is awake. When a conversation's read mark advances and that conversation sends receipts, the interface calls `send_receipt` and carries the same mark in the body of the member's next message there. A message that was held and goes later from the outbox carries no mark. A receipt that arrives is clamped to the last message this member actually sent that person. "Read" is shown only where a receipt arrived.

### 7.7. A network without messaging

Whether a network has messaging is read from the DNA: it does when `messaging_integrity` is among its integrity zomes (`ui/src/lib/services/messagingPresence.svelte.ts`). Without it the interface shows no Messages entry, no "message this person" action and no unread count, and the `/messages` pages render nothing but a notice if opened by address, so no messaging call is made. Nothing in the exchange route leads there: a proposal started on a listing returns to the exchange, and My Exchanges carries a count of the exchanges waiting on the member, since there is no unopened-conversation count on My Messages to carry a proposal. `VITE_MESSAGING_DISABLED=true` forces that mode for testing.

**How the other pages reach messaging without depending on it.** The exchange, listing and publish pages never import messaging. They ask for what messaging would add through five small extension points in `ui/src/lib/extensions/`, each a type and the functions to set and get it over a Svelte context, which import nothing from either side. The nav bar and the menu drawer import only `messagingPresence`, which says whether the network has messaging and is neutral ground too.

| Extension point | What messaging plugs in | Who asks for it | When nothing is plugged in |
|---|---|---|---|
| `reach-person.ts` | `GoToChat`: a link to the conversation, with its unread count where the asker passes `count`, and the first-contact notice before a first message | `ReachPerson`, used on the listing pages (`ListingInterest`), My Exchanges (`InterestedIn`, `ExchangeChainCard`), the exchange page and the propose page | `ReachPerson`'s own fallback: a Contact button, a note that the person left no contact details, or Try again when they could not be read |
| `unread-count.ts` | the number of conversations with something unopened (and `unreadCountLabel`, what a screen reader is told it counts) | the nav bar and the menu drawer | no badge |
| `share-listing.ts` | `ShareListing`: send the listing just published into the conversation, and go back to it | `AfterPublish` on the publish pages | only the page's own links |
| `back-to-chat.ts` | "Back to your conversation with …" and its address | an exchange page reached from a conversation | the page's own Back |
| `first-contact.ts` | the notice before a member's first proposal | `ListingInterest`, before Make a proposal | a plain link |

The root layout is the one place that sees both sides, so it plugs each one in, except where the DNA has been read and has no messaging (until then they are plugged in, so a page that renders early still offers them). A page that asks gets nothing back otherwise, and shows what it owns itself. The rule this keeps: the import walk from any page that is not messaging stops at `extensions/`, a folder that belongs to no feature.

### 7.8. Tests

`ui/tests/unit/stores/messaging.store.test.ts` (the outbox and its three states, the send that is not repeated, a stored outbox surviving a failed read, blocks on reads and on signals, receipts in and out, the delta read), `ui/tests/unit/services/messaging.service.test.ts` (each call's function name and payload), `ui/tests/unit/routes/messages-pages.test.ts` (the pages mounted on the real store: the address followed and nothing carried from one person to the next, the open conversation kept read, names, discard, a refused send keeping its draft, a failed read not reported as a failed send, the cards: sharing, accepting, declining and withdrawing, one at a time and with nothing typed lost, the share picker before and after its listings are read and when they cannot be, the focus through the Block confirmation, the limit told to a screen reader only as it changes, a network without messaging), `ui/tests/unit/components/messaging/` (each card on its own: what it offers, what it sends, and what it says when a read or a send fails, and a fault row's details). Also `ui/tests/unit/routes/conversation-page.test.ts` and `blocking.test.ts` (the blocked page, its history and names), `ui/tests/unit/services/HolochainClientService.signals.test.ts` (signals through the real client: routing by zome, app signals only, including a system signal shaped like one, a reconnect), `ui/tests/unit/components/shared/NavBar.test.ts` and `MenuDrawer.test.ts` (the menu's counts with and without messaging, and what a screen reader is told they count), `ui/tests/unit/composables/messaging/useMessagingWhileSignedIn.svelte.test.ts` (the background work started once, kept through the member being read again and through what it reads changing, stopped on sign-out), `ui/tests/unit/routes/my-exchanges-tabs.test.ts` (My Exchanges' two views as keyboard tabs, and its groups as toggle buttons), `ui/tests/unit/components/exchanges/InterestedIn.test.ts`, and `ui/tests/unit/routing.test.ts` with `routes/propose-page.test.ts` (where a proposal returns to). The composer is exercised against a stood-in zome only. The e2e chapter `ui/tests/e2e/specs/10-messaging.spec.ts` runs the pages against a conductor with the suite's one agent (My Messages in the Profile menu, Messages with no conversations, Blocked members with nobody on it), so nothing yet sends a message through the pages to a conductor; that needs a second member (#461).

