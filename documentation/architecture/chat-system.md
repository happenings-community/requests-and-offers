# Messaging System — Architecture Design Note

**Status:** Design of record.
**Version:** 2.0.0
**Holochain stack:** hdk 0.6.1 / hdi 0.7.1 / conductor 0.6.1, confirmed against `Cargo.lock`.
**Implementation status:** the cross-agent signal substrate (§7) is built and tested (#181).
The sealed-mailbox primitive (§4) is built and tested in `happenings-community/sealed-mailbox-spike`:
fourteen Sweettests across ten files, including four-node asynchronous delivery. Nothing else
in this note is built.
**Relates to:** #91 (Chat System), #51 (Global Notifications), #12 (Real-time Signals),
#144 (Breaking-version Migration), #163 / #162 (Flagging / Moderation)
**Supersedes:** the *Security and Privacy* section of
`documentation/requirements/post-mvp/messaging-system.md`; and, within this note, the
conversation-clone decision carried by version 1 (§4.1).
**Companion:** `SCHEMA.md` in the sealed-mailbox spike is the design record for the
primitive itself — address derivation, key exchange, the cap, the threat model, and what is
proven versus designed. This note decides how R&O *uses* it. Where the two overlap, SCHEMA.md
governs the mechanism and this note governs the application.

---

## Decisions at a glance

- Conversations are **entries on the shared `requests_and_offers` DNA, addressed into
  derived mailboxes** that nobody can locate without the correspondence's address salt.
  Version 1 of this note decided membrane-isolated clones instead; §4.1 records why that
  changed.
- Isolation is the **default for every conversation**, not an escalation for a sensitive
  subset. Unchanged from version 1, and the reasoning is unchanged with it.
- **Content is encrypted**, and the address is unguessable. Two secrets, two blast radii
  (SCHEMA.md §4).
- A conversation is created by **responding to a listing**. The response carries the address
  salt and an exported shared secret, sealed to the recipient's X25519 key (§5).
- Address salts are **per correspondence**, never global. One disclosed salt exposes one
  correspondence and never a social graph (§4).
- **Per-agent write volume and timing are deliberately public.** The rate cap, spam
  reporting and stewarding all count by author; closing that leak would behead them
  (§3, SCHEMA.md §3).
- Deletion is **not available on this platform** and never was. What exists is local removal,
  archive as a UI state, and epoch rotation as a forward boundary (§8).
- Administrators have **no standing access**. A participant may invite one, and that
  invitation is announced as a committed system message (§10).
- The **first-contact cap ships disabled** as the bootstrap posture, with a suggested 30 when
  enabled by migration (§4).
- **An interest marker is the MVP first-contact path** and is public by design: it is linked
  from the recipient's key, so who responded to whose listing is visible. The knock described
  here supersedes it for private contact; the two coexist post-MVP with different intents.
  See `NOTIFICATION_ARCHITECTURE.md` §11 and §12.

---

## 1. What this note decides

#91 specifies the chat system in depth but leaves its central privacy question open,
offering "Option A (single DNA, link-based participant checks) for MVP, Option B
(Volla-style DNA per conversation) for production privacy". This note resolves that question
in favour of isolation, and sets out the conversation lifecycle, the deletion model, the
administrator access model and the member-facing guarantee that follow from it.

It resolves it with a **third option** neither #91 nor version 1 of this note considered:
content-encrypted entries on the shared DNA, at addresses that cannot be found without a
per-correspondence secret. §3 sets out why the choice turns on protecting who said something
to whom rather than only what was said; §4 sets out why derived addressing answers that
better here than a cloned DNA per conversation.

This note is the design of record. #91 remains the implementation task list.

## 2. Signing is not encryption

`messaging-system.md` states messages are secured by "encryption via Holochain's
agent-centric security model". That conflates two separate properties.

The agent-centric model gives every action a signature by its author's agent key. That
yields authenticity, integrity and non-repudiation for free: any agent can verify who wrote a
message and that it has not been altered. It does not give confidentiality. A public DHT
entry is plaintext to any agent who can fetch and validate it. Signing proves authorship; it
does not hide content.

Confidentiality is therefore a deliberate, separate choice. This note makes it both
cryptographically, by encrypting content, and structurally, by making the address
underivable.

## 3. What a shared DNA cannot protect

There is no single private-messaging primitive in Holochain. The mechanisms available:

**Ephemeral, no persistence.** The message travels as a remote signal and is never written
to any DHT. Private because nothing is stored. Cost: no history, and both parties must be
online. This is the pattern the built substrate uses (§7), and it remains useful for liveness
and for invitation delivery (§5).

**Content-encrypted at a public address on a shared DNA.** Message content is encrypted so
only participants can read it, and the ciphertext lives as an ordinary entry the whole
network can locate. Genuine end-to-end encryption of content, and it works in a zome on this
stack.

**Membrane-isolated per conversation.** Each conversation is a separate cloned DNA gated by a
membrane proof. Non-participants are not in that network and never receive the entries.
Privacy is structural. This is what version 1 of this note chose.

**Content-encrypted at a derived address on a shared DNA.** The ciphertext is an ordinary
entry, but it is reachable only through a link whose base is computed from a secret the
correspondents share. An observer holding the entire DHT cannot link a parked item to its
recipient, cannot link two items to the same correspondence, and cannot test whether a given
pair is talking. This is what this note now chooses, and it is the option the earlier framing
missed.

### 3.1 The author field, and why it decides the shape

Every Holochain action carries a public `author: AgentPubKey`. Ten action variants in
`holochain_integrity_types` 0.6.1 each declare it, and it cannot be otherwise, because
validation is signature verification against the author's key. An action whose author cannot
be read cannot be validated, so the DHT cannot function without it.

Content encryption at a public address therefore protects what was said and exposes the
social graph in full: any member fetches the entry, reads the action, and learns sender and
timing with no decryption and no privileged position. Correlated against the public request
and offer entries a conversation concerns, that reconstructs who is negotiating with whom
about what. A hundred messages leave a hundred such records.

A public-address entry model leaks in several further places, and only one is fixable:

- a `participants` field on a public conversation entry (fixable by encrypting it);
- an agent-to-conversations inbox link, whose base is a public agent key;
- a listing-to-conversation context link, revealing who is negotiating over what;
- creation timestamps and time-bucketed message links, giving timing and volume.

Link bases are public by construction and pagination requires the buckets, so the last three
are not fixable *at a public address*. They are all fixable at a derived one: the base is
opaque, so an inbox link, a context link and a bucket link reveal nothing about who or what.

R&O's threat model includes an adversary who joins the membrane specifically to harvest.
Against that adversary, the question is whether the correspondence graph is legible. Derived
addressing makes it illegible without joining the correspondence.

### 3.2 What stays exposed, deliberately

Per-agent write volume and timing remain public. An observer walking an agent's chain with
`must_get_agent_activity` sees `CreateLink` actions carrying opaque bases: how many distinct
mailboxes that agent writes to, how often, and when. Not who is at any address, not what was
said, and not which mailboxes belong to the same correspondence.

**This is deliberate and load-bearing, not a residual.** The first-contact rate cap counts by
author, spam reporting names authors, and stewarding acts on identities. Closing this leak
would behead every defence built on it. SCHEMA.md §3 states the trade directly, and §15
records anonymous credentials as the known upgrade path with its cost: initiator privacy
against accountable stewarding.

One consequence worth stating rather than leaving to be noticed: because addresses rotate
each epoch (§4), a single long correspondence produces many distinct bases over time, so the
count of distinct addresses an agent writes to measures elapsed time as much as it measures
how many people they talk to. That makes the count a poor proxy for correspondent count. It
is a property of epoch rotation rather than its purpose — rotation exists so that an observer
who learns one address sees at most one epoch of one direction.

## 4. Decision: derived mailboxes on the shared DNA

A correspondence has an **address salt**, established at first contact and known only to its
participants. Messages are ordinary encrypted entries, linked from a base computed as
`hash_entry` of an uncommitted struct carrying that salt, the recipient's index in the
participant ordering, and the current epoch. The struct is deliberately not a registered
entry type, so it cannot be committed through the zome; the address is pure computation with
no host call. Mechanism, derivation and proofs: SCHEMA.md §5.

**Salts are per correspondence, never global.** A peer who holds your salt with them can find
your mailboxes with them and nothing else. There is no master secret whose disclosure
rebuilds a social graph.

**Two secrets, two blast radii.** Addressing and confidentiality use different secrets,
forced by the platform: lair never releases key material into wasm, and an address needs
bytes. A compromised salt reveals traffic timing for one correspondence and never content; a
compromised content key requires compromising lair. SCHEMA.md §4.

**First contact.** A public PO Box anchor carries sealed envelopes; anyone can fetch them and
only the addressed recipient's lair opens one, by trial decryption at ~26ms per unseen item.
The envelope carries the address salt and an exported shared secret. From then on the pair
writes to derived mailboxes: two `get_links` per correspondent per poll, 130ms steady state
measured. A single undifferentiated anchor is deliberate — bucketing is attacker-computable
and enables flood-and-observe (SCHEMA.md §15).

**The first-contact cap** is enforced in integrity validation via `must_get_agent_activity`,
bounded by `take(n)` rather than a timestamp. It ships **disabled** as the bootstrap posture,
with 30 suggested when enabled by migration. Tiered caps and admin elevation are designed and
deferred pending real abuse data.

**Why the default rather than an escalation.** A tiered model asks members to predict
sensitivity before the conversation happens. People predict that badly, and the wrong guess is
not recoverable once the messages are written. Uniform isolation removes the prediction.
*(Unchanged from version 1; the argument is independent of mechanism.)*

**Cross-domain references survive.** R&O already resolves cross-DNA references frontend-side:
hREA proposals live in the separate `hrea` DNA and `ui/src/lib/services/hrea.service.ts`
resolves them over GraphQL rather than by any DHT link. A conversation holds the listing hash
it concerns and resolves it the same way. The reference is one-directional: a participant can
enumerate their own conversations and see which listing each concerns, and nobody can go the
other way from a listing to its conversations. *(Unchanged from version 1.)*

**What it costs.** No third role, no new DNA, no clone limit, no idle base cell. The zome
lives on the shared DNA alongside the others, which also resolves an open question version 1
recorded as blocking (§13). The costs are elsewhere: content must be encrypted rather than
merely isolated, every zome crypto call routes through lair over IPC with a hard 8KB ceiling,
and attachment chunking is unbuilt and untested (§13).

### 4.1 Why this replaced conversation clones

Version 1 of this note decided membrane-isolated clones: one cloned DNA per conversation, its
participants named in properties that feed the DNA hash, admitted by identity. That design
was built as far as #183 — the DNA, the membrane gate, the coordinator, the base-cell write
refusal, five Sweettests — before the mailbox primitive was spiked and proved.

**It is not a failed design.** Volla Messages runs clone-per-conversation in production on
Android and desktop, and it is a sound answer for a dedicated messenger. It is the wrong fit
*here*, and the reasons are specific to R&O rather than general:

- **A conductor cost that lands on top of two other cells.** Volla runs 100 clones as a pure
  messenger. R&O carries the shared DNA and the hREA cell alongside, so per-conversation cell
  cost is additive to an application that already has a footprint. What that costs at high
  cell count on R&O's stack was never measured, and the clone limit was set to 100 because
  that was the only figure known to run in production — a placeholder for a measurement, not
  a decision.
- **An unavoidable idle cell on every conductor.** The conversation role cannot be
  provisioned lazily: both `strategy: clone_only` and `deferred: true` reach an unimplemented
  arm in `holochain_conductor_api-0.6.1/src/app_interface.rs:491` while app info is assembled,
  so the panic surfaces whenever app info is requested. Every member therefore carries an
  empty base conversation cell that must refuse writes at the integrity layer, because it is a
  real cell a client could otherwise write to. Pure overhead, paid by everyone, forever.
- **It does not compose with the rest of the design.** Stewarding case channels
  (`STEWARDING_MANAGEMENT.md` §3) use derived addressing on a case salt. Two isolation models
  in one product is a permanent maintenance tax, and the mailbox generalises to both.
- **The blocking open question dissolves.** Version 1 recorded "whether the `messaging` zome
  belongs in the conversation DNA, the shared DNA, or both" as blocking the signal half of
  delivery. With no conversation DNA there is one answer.

What survives from the clone work: the privacy argument that motivated it (§3), the signal
substrate (§7), the participant-ordering invariant, and the membrane-proof mechanics, which
the joining membrane uses independently. #183 is closed and its branch preserved as a
documented path not taken.

## 5. Conversation lifecycle

**Creation.** A conversation begins when one member responds to another's listing. The
response is the invitation. This reuses an interaction R&O wants anyway rather than
introducing a separate invitation artefact with its own metadata cost.

In MVP the response is an interest marker (`NOTIFICATION_ARCHITECTURE.md` §11): a durable
entry carrying a sealed contact route, addressed to the listing author and visible as an
edge. The invitation contents below ride the knock, which arrives with the mailbox. A member
who wants both may have the marker carry the invitation in its sealed payload.

**Invitation contents.** The address salt, the participant ordering, and an exported shared
secret, sealed to the recipient's X25519 key. The recipient's lair ingests the secret under
its own tag; neither party ever holds it in wasm. Nothing further is transmitted, and no
membrane proof is involved: there is no membrane.

**Delivery, signal first.** If the recipient is online, the invitation travels as a remote
signal and nothing is persisted, so the conversation leaves no trace on any DHT. Only if no
acknowledgement arrives does the sender fall back to the PO Box: a sealed first-contact
envelope under the public anchor. Signals are fire-and-forget with no delivery confirmation,
so this requires the recipient's client to acknowledge by signal, and there is a race if the
recipient appears just after the sender gives up. That race resolves to a parked envelope,
which is the safe direction.

**The residual exposure.** A parked first-contact envelope is an action authored by the
responder, so the fact that they initiated *something* at a given time is public — as is
every other author's write volume (§3.2). What it does not reveal is the recipient: the
envelope sits under a single undifferentiated anchor and only the addressed recipient's lair
opens it. A first-contact item additionally exposes the sender's X25519 key alongside their
agent key, linking the two; established-mailbox items expose no key material at all.

**Message delivery.** Persist plus signal. A message is committed as an encrypted entry and
linked into the derived mailbox, which is durability and reaches an offline participant when
they return, and sent as a remote signal, which is liveness. `post_commit` runs only on the
committing agent, so the remote signal is the only cross-agent path. Asynchronous delivery is
proven four-node: recipient offline at parking, sender's conductor shut down at collection.

**Collection.** Two `get_links` per correspondent per poll, reading the current and previous
epoch to cover boundary skew.

**What becomes public when a conversation succeeds.** An hREA Agreement names its provider and
receiver and is public by design, because fulfilment tracking and reputation depend on it
(#90). So the moment a conversation produces an agreement, that edge is visible. Isolation
protects the content of every conversation and protects entirely those that never reach
agreement, which is most of them: browsing, asking, negotiating, declining. It does not
conceal a completed deal, and it should not, since an agreement is a deliberate mutual public
act. *(Unchanged from version 1.)*

Two consequences for the exchange layer. A conversation holds the agreement id as a committed
system message (§9) and resolves it frontend-side, but the reverse lookup from a public
agreement to a private conversation cannot exist, and is not needed: only participants would
want it, and they hold the salt. And any conversation identifier stored on the agreement must
be an opaque random value, never derived from the address salt.

**What the conversation layer needs from the exchange layer.** A response-to-a-listing event
carrying the listing hash and its type, and an agreement id when one is reached. R&O runs hREA
as a second DNA where ValueFlows models proposals, intents, commitments and agreements, and the
exchange process is built there. Wiring is a matter of reading those events rather than
designing them.

## 6. Encryption

**Required, and built.** Unlike a clone, a derived mailbox is on the shared DHT: the address
is unfindable, but an entry that is fetched is readable. Content encryption is therefore not
optional, and the primitive already does it — this is not a cost the change introduces.

The mechanism is lair's shared-secret pair: `x_salsa20_poly1305_shared_secret_create_random`
mints a content key that never leaves lair, `_export` wraps it to the recipient's X25519 key,
`_ingest` admits it to their keystore. Both sides then seal and open by tag. Round trip,
persistence across the flow, and refusal of a third agent under a colliding tag are executed
tests.

First contact uses the direct box instead: `x_25519_x_salsa20_poly1305_encrypt` to the
recipient's published X25519 key, opened by trial decryption. Note that
`x_25519_x_salsa20_poly1305_decrypt` returns `Err` on failure rather than `Ok(None)` — the
`Option` in its signature is vestigial — so a failed trial is a routine negative and must
never propagate as an error.

**Data at rest.** Ciphertext sits in the conductor's local databases; the content key sits in
lair. Device-level protection is the member's own full-disk encryption, and member-facing copy
should say so.

**Two constraints on record.** Every zome crypto primitive routes through lair over IPC and
rejects a single call above 8192 bytes, so attachments require chunking, which is **unbuilt
and untested** (§13). And using an agent's signing key for encryption invokes a documented
caveat, which libsodium raises and Thormarker's 2021 analysis addresses: joint security of an
Ed25519 signature scheme and an X25519 KEM sharing a key pair is proven in the random oracle
model, including in the presence of a signing oracle. The residual is forward secrecy, which is
not achievable on this platform in any case (§8), and is not part of R&O's threat model (§3).

**The bootstrap dependency is reduced but not gone.** Version 1 noted that in kitsune2 0.4.1
the space read route returns the agent list for whatever space identifier the caller supplies,
so on a public unauthenticated bootstrap anyone knowing a space id can enumerate its members —
which for a two-agent clone is a social graph edge. With no per-conversation spaces there is
no per-conversation membership to enumerate: the only space is R&O's own, whose membership is
the membrane's business rather than a secret. R&O should still run its own bootstrap with an
authentication hook, and the joining service remains the natural candidate, but it is no
longer load-bearing for conversation privacy.

## 7. The substrate: cross-agent signalling (BUILT)

R&O had no cross-agent signalling: `init` was a bare `Ok(Pass)` and no cap grants existed.
Every coordinator zome emitted only local signals to its own client via `post_commit`.

The substrate lives in a coordinator-only `messaging` zome:

- an `init` creating an Unrestricted cap grant for `recv_remote_signal`, committed as a
  Private entry on the agent's own chain;
- a `recv_remote_signal` handler reading the sender from `call_info()?.provenance` and
  re-emitting to the UI;
- `send_remote_signal` in the send path;
- a `Signal::Message` variant;
- a `ping` health-check whose secondary job is to trigger lazy `init`.

Verified against current HDK canon, which caught two drifts from older reference code:
`GrantedFunctions::Listed` takes a `HashSet` rather than a `BTreeSet`, and the
`SerializedBytes` derive is unnecessary on the 0.6 line. Proven by a two-conductor Sweettest.

**The grant is `Listed`, naming exactly one function.** Nothing else in the zome is remotely
callable, which matters for anything added to it later.

**Security consequence of Unrestricted.** Any agent can call `recv_remote_signal` and push a
signal. That is expected for messaging, and filtering unsolicited or abusive signals is an
application-layer concern tied to the flagging primitive (#163).

**Lazy init.** A cell's `init` runs on its first zome call, not at install. A recipient must
have been called at least once before a remote signal is authorised. In the application this
is a non-issue; the test primes both cells with `ping`.

**Where it sits.** The shared DNA, with the mailbox zome. Version 1 left this open because a
conversation DNA might have wanted its own copy; there is no conversation DNA.

## 8. Deletion, archiving, and what rotation gives instead

**Deletion is not available on this platform, and never was.** Destroying a key requires a
store that can forget, and nothing in this stack can: `lair_keystore_api` contains no
deletion, removal or destruction operation for stored key material anywhere in its source, and
Holochain's only purge operates on whole databases when a cell is uninstalled. The source
chain is append-only by design; this is the architecture working as intended.
Crypto-shredding is therefore unavailable and nothing in the design should assume it.

Version 1 offered **leave-and-remove**: deleting a conversation clone removed its local
databases. That was real removal of *local* data — device hygiene rather than deletion — and
the same act remains available: a participant drops their correspondence state, forgets the
salt, and stops polling. What neither model could ever do is remove the other participant's
copy, and member-facing copy must not imply otherwise.

**What rotation gives.** Addresses derive from the salt and the epoch index, so each epoch
produces a fresh base. An observer who learns one address sees at most one epoch of one
direction. And a party who is dropped from a correspondence cannot follow it forward: past
material stays where it is and stays readable to whoever holds the old salt and key, but
future material is at an address they cannot compute. That is a forward boundary rather than
revocation, and the difference should be stated plainly rather than sold as deletion.

**Archive** is a UI state, not a DHT operation: mute the correspondence in the inbox and stop
surfacing it. Never stop polling — a muted correspondence that stops collecting silently loses
messages.

**Block** drops correspondence state entirely. A blocked peer's fresh PO Box knock is then a
legitimate first contact rather than a suppressed one, which is the correct behaviour: block
ends a correspondence, it does not impose a permanent one-way ban that the design cannot
enforce anyway.

## 9. Entry and link model

All on the shared `requests_and_offers` DNA.

- `SealedItem { ciphertext }`. Exactly one field: everything else — sender, sequence, reply
  target, message type — is inside the ciphertext. The action carries the authoritative
  timestamp, so the entry does not repeat it as a forgeable client copy.
- `MailboxItem` link: derived `EntryHash` → `SealedItem`, tag empty. The base is computed, not
  committed; `create_link` performs no base-existence check.
- `FirstContact` link: anchor path hash `first_contact.{epoch_index}` → `SealedItem`, tag
  empty. One undifferentiated anchor per epoch.
- Creation-time context — the listing hash and its type (Request, Offer, Direct) — travels
  inside the first-contact envelope and is held in the participants' own correspondence state,
  not as a public entry. Version 1 put it in clone properties, which is unavailable without a
  clone; the requirement it served, that a conversation be self-describing without a DHT read,
  is met by holding it locally alongside the salt.
- The hREA proposal id is not creation-time context: a conversation produces its agreement
  mid-life (§5). When it does, the id is committed as an encrypted system message in the
  stream at the moment the deal was struck.
- System events are **structured, not prose** — `AdminInvited { admin }` and
  `AgreementReached { proposal_id }` — so member-facing wording stays a UI string, revisable
  without touching committed data. This carries over from the clone design unchanged.
- Message ordering and pagination live inside the correspondence rather than in public
  time-bucketed links, because bucket links at a derived base are already opaque.

The salt never appears in a public entry, link base or link tag. That is designed; the
hardening is deferred (SCHEMA.md §6).

## 10. Administrator access

**No standing access.** Administrators cannot locate a correspondence they are not part of:
the address depends on a salt they do not hold. Any design granting standing access would make
the member-facing guarantee (§11) false.

**Participant invitation only.** A participant may invite an administrator into a
conversation, for support or dispute resolution. Mechanically this is sharing the salt and
re-wrapping the content key, which the shared-secret export/ingest pair does directly.

**Announced, structurally.** The invitation commits a system message, so every participant
sees it happened. A committed entry rather than a client-side rendering, so a modified client
cannot suppress it.

**What the administrator sees.** Everything at that address, from both participants, including
everything said before they arrived. Retrospective access to the whole correspondence, not
observation from the moment of joining, and the consent wording must say so plainly rather
than implying an administrator is joining an ongoing room.

**Unilateral, with notice.** One participant may invite an administrator without the other's
agreement. Requiring mutual consent would defeat the instrument in the case that most needs
it, since a participant behaving badly will not consent to being observed. The notice is the
safeguard, and it is structural rather than social.

**Not a substitute for flagging.** Reporting into the flagging primitive (#163) remains
available and discloses far less. Administrator invitation is the heavier instrument and
should be presented as such.

**Forward boundary on removal.** An administrator whose access is withdrawn keeps what they
already read — no distributed system can undo that — but epoch rotation on a fresh salt cuts
them out of everything after (§8).

**Open for governance.** The exact consent wording remains a governance and copy decision
rather than an architectural one, including how plainly it conveys that an invited
administrator reads the whole history.

## 11. What members are told

The guarantee, in plain terms:

- Conversations are visible only to their participants. Other members cannot find that a
  conversation exists, who is in it, or anything said in it.
- What is visible to the network is that you are active: how often you write, and when. Not to
  whom, and not what. This is deliberate — it is what lets the community limit spam and act on
  abuse.
- Responding to a listing may leave a record that you contacted *someone*, if the other party
  is offline at the time. It does not say who.
- No administrator has access to any conversation unless a participant invites them, and that
  invitation is announced in the conversation. An invited administrator can read the
  conversation's whole history.
- If a conversation leads to an agreement, the agreement itself is public, including who it is
  between. Conversations that do not lead to an agreement leave no such record.
- Leaving a conversation removes your copy and stops you receiving anything further. It cannot
  remove the other participant's copy, and nothing on this platform can.
- Conversation content is encrypted. The keys are held by your own device's keystore.

## 12. Build sequence

1. **Substrate.** Cap grant and remote signal path. (DONE, §7, #181.)
2. **Prove it.** Two-conductor Sweettest. (DONE.)
3. **Mailbox primitive.** Address derivation, key exchange, first contact, trial decryption,
   the cap, epoch rollover, asynchronous delivery. (DONE, in the spike: fourteen Sweettests
   across ten files.)
4. **Port the primitive into R&O.** Onto the shared `requests_and_offers` DNA (§4): mapping
   X25519 key publication onto the existing profile and listing surfaces, epoch length, and
   salt custody in R&O's own correspondence state.
5. **Invitation.** Signal-first delivery with the PO Box fallback. Depends on the
   listing-response design (§5), which is the interest marker in
   `NOTIFICATION_ARCHITECTURE.md`: the response-to-a-listing event this note asks the
   exchange layer for is that marker.
6. **UI.** Conversation list, thread, inbox, and the listing entry points.

Steps 4 and 5 can proceed independently of each other.

## 13. Open questions and dependencies

**Ours to resolve:**

- **Attachment chunking. Unbuilt and untested.** Every zome crypto call has a hard 8KB lair
  ceiling, so attachments need chunking, and the `holochain-open-dev/file-storage` zome chunks
  client-side with no encryption, which does not suit an encrypted mailbox directly. Chunk size
  against the current conductor payload ceiling is unverified; the 256KB figure in circulation
  dates from a much older Holochain version. This is a real gap on either design.
- **X25519 key publication maps onto the existing surfaces.** A recipient's key rides with the
  contact details their profile and listings already carry; peer discovery works and does not
  need rebuilding for this. Needed at first contact only — established mailboxes expose no key
  material at all. What remains is the mapping, not a new directory.
- **Epoch length and the first-contact cap are stewarding parameters, not static config.**
  The measurements give safe boundaries: established mailboxes are indifferent to epoch length
  (two fetches regardless), the PO Box prefers shorter epochs for faster junk expiry, and the
  cap's ceiling arithmetic is members × cap with one flooder costing 0.78s. Within those
  boundaries the system can infer a recommendation from observed load and abuse, and surface it
  for a steward to accept or refuse — the same posture as everywhere else in the governance
  model: the tool proposes, a person decides.

  The cap ships **disabled**, which is the bootstrap posture rather than a permanent setting;
  30 is the suggested figure when it is enabled by migration. Tiered caps are designed and
  deferred pending real abuse data. The steward-facing side of this — what is surfaced, what
  the opt-in looks like, and who may accept a recommendation — is specified in
  `STEWARDING_MANAGEMENT.md`, not here. This note names the parameters and their safe ranges.

**Dependencies on others:**

- The listing-response design, and whether it belongs in R&O or hREA (§5).
- Administrator invitation consent wording and whether it requires mutual agreement (§10).
- Bootstrap authentication hook (§6) — no longer load-bearing for conversation privacy, still
  wanted.

**Settled, with evidence:**

- Sender identity cannot be hidden on any Holochain DNA (§3.1).
- Per-agent write volume is deliberately public, and the defences depend on it (§3.2).
- Address derivation is deterministic, salt-dependent, and a wrong salt collects nothing.
- Encryption runs in a zome, both direct-box and shared-secret routes.
- Crypto-shredding is not available on this platform (§8).
- Forward secrecy is not achievable here and is not required by the threat model.
- Asynchronous delivery works with neither party co-online.
- `x_25519_x_salsa20_poly1305_decrypt` returns `Err` on failure; the `Option` is vestigial.
- `must_get_agent_activity` must be bounded by `take(n)`, never `until_timestamp`: a window
  predating genesis raises `DepMissingFromDht`.

## 14. Evidence base

Claims in this note were established by reading source directly, or by executed tests. The
principal sources:

- `happenings-community/sealed-mailbox-spike`: fourteen Sweettests across ten files. Address
  derivation, key exchange, first contact and trial decryption, the cap and its epoch reset,
  four-node asynchronous delivery. `SCHEMA.md` records which claims are proven and which
  designed.
- `spike/crypto-feasibility` (this repository): cross-agent direct-box encryption in a zome,
  and shared-secret content keys with re-wrap to a later-admitted third agent.
- `holochain_integrity_types` 0.6.1, `action.rs`: the public `author` field on every action
  variant.
- `hdk` 0.6.1 and `hdi` 0.7.1, `x_salsa20_poly1305.rs`: encryption and decryption signatures
  and their opposed argument orders.
- `lair_keystore_api` 0.6.3: absence of any deletion operation; shared secrets exportable by
  construction (`meta_lair_client.rs:216`).
- `holochain_conductor_api` 0.6.1, `app_interface.rs` line 491: the unimplemented arm for a
  role with no provisioned cell — the clone model's unavoidable idle cell (§4.1).
- `kitsune2_bootstrap_srv` 0.4.1, `space.rs`, `auth.rs`, `http.rs`: space read scoping and the
  optional authentication hook.
- `HelloVolla/volla-messages` (`develop`): the clone-per-conversation model in production,
  researched for version 1 and retained here as the precedent for the road not taken.
- `holochain-open-dev/file-storage`: client-side chunking, manifest of chunk hashes, no
  encryption.
- E. Thormarker, *On using the same key pair for Ed25519 and an X25519 based KEM*, IACR ePrint
  2021/509, cited by libsodium and by IETF EDHOC.

**Correction owed elsewhere:** `CellCloning.md` states that `deferred: true` is required for
clonable roles. Two production manifests set `deferred: false` with a non-zero clone limit, and
on this stack `deferred: true` reaches the unimplemented arm named above. Filed as
`Soushi888/holochain-agent-skill#2`. This remains true and worth correcting even though R&O no
longer clones.
