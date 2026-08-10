# Messaging System — Architecture Design Note

**Status:** Design of record.
**Holochain stack:** hdk 0.6.1 / hdi 0.7.1 / conductor 0.6.1, confirmed against `Cargo.lock`.
**R&O application version:** to be confirmed against the root `package.json` before publication.
**Implementation status:** the cross-agent signal substrate (§7) is built and tested. The
conversation DNA is partly built and in review as #183: the integrity membrane gate, the
coordinator, the base-cell write refusal, the third role and membrane test coverage. The
message entry and the context properties are not built. Nothing else in this note is
built.
**Relates to:** #91 (Chat System), #51 (Global Notifications), #12 (Real-time Signals),
#144 (Breaking-version Migration), #163 / #162 (Flagging / Moderation)
**Supersedes:** the *Security and Privacy* section of
`documentation/requirements/post-mvp/messaging-system.md`
**Canonical location:** `documentation/architecture/chat-system.md` on
`feat/messaging-substrate`. Any copy held outside the repository is a snapshot and may state
the opposite of the current decision; verify it with
`git show feat/messaging-substrate:documentation/architecture/chat-system.md` before relying
on it.

---

## Decisions at a glance

- Conversations are **membrane-isolated clones**, one cloned DNA per conversation, not
  entries on the shared `requests_and_offers` DNA.
- Isolation is the **default for every conversation**, not an escalation for a sensitive
  subset.
- **No content encryption inside a clone.** Isolation is the confidentiality mechanism.
- A conversation is created by **responding to a listing**. The response carries a random
  network seed, the conversation id and the participant pair, encrypted to the recipient.
  Both participants are admitted to the clone by identity, so no membrane proof is
  transmitted (§5).
- Seeds are **random and transmitted**, never derived from public values (§6).
- Deletion is **leave-and-remove**, which genuinely removes local data, plus archive for
  tidiness. Crypto-shredding is not available on this platform (§8).
- Administrators have **no standing access**. A participant may invite one, and that
  invitation is announced in the conversation as a committed system message (§10).
- The isolation guarantee has an **operational dependency**: R&O must run its own
  bootstrap server with authentication enabled (§6).

---

## 1. What this note decides

#91 specifies the chat system in depth but leaves its central privacy question open,
offering "Option A (single DNA, link-based participant checks) for MVP, Option B
(Volla-style DNA per conversation) for production privacy". This note resolves that
question in favour of isolation, and sets out the conversation lifecycle, the deletion
model, the administrator access model and the member-facing guarantee that follow from it.

The argument turns on a distinction #91 does not draw: the difference between protecting
what was said and protecting who said it to whom. §3 sets out why that distinction
decides the design.

This note is the design of record. #91 remains the implementation task list.

## 2. Signing is not encryption

`messaging-system.md` states messages are secured by "encryption via Holochain's
agent-centric security model". That conflates two separate properties.

The agent-centric model gives every action a signature by its author's agent key. That
yields authenticity, integrity and non-repudiation for free: any agent can verify who
wrote a message and that it has not been altered. It does not give confidentiality. A
public DHT entry is plaintext to any agent who can fetch and validate it. Signing proves
authorship; it does not hide content.

Confidentiality is therefore a deliberate, separate choice. This note makes it
structurally rather than cryptographically.

## 3. What a shared DNA cannot protect

There is no single private-messaging primitive in Holochain. There are three mechanisms.

**Ephemeral, no persistence.** The message travels as a remote signal and is never
written to any DHT. Private because nothing is stored. Cost: no history, and both parties
must be online. This is the pattern the built substrate uses (§7), and it remains useful
for liveness and for invitation delivery (§5).

**Content-encrypted on a shared DNA.** Message content is encrypted so only participants
can read it, and the ciphertext lives as an ordinary entry in the shared DHT. This is
genuine end-to-end encryption of content, and it works in a zome on this stack (§6).

**Membrane-isolated per conversation.** Each conversation is a separate cloned DNA gated
by a membrane proof. Non-participants are not in that network and never receive the
entries. Privacy is structural.

The choice between the second and third is decided by what content encryption leaves
exposed.

**The author field.** Every Holochain action carries a public `author: AgentPubKey`.
Ten action variants in `holochain_integrity_types` 0.6.1 each declare it, and it cannot be
otherwise, because validation is signature verification against the author's key. An
action whose author cannot be read cannot be validated, so the DHT cannot function
without it.

On a shared DNA, any member can therefore fetch a message entry and read its action,
which names the sender and the time, with no decryption, no link traversal and no
privileged position. Correlated against the public request and offer entries a
conversation is linked to, that reconstructs who is negotiating with whom about what. A
hundred messages leave a hundred such records.

A shared-DNA entry model leaks in several further places, and only one is fixable:

- a `participants` field on a public conversation entry (fixable by encrypting it);
- an agent-to-conversations inbox link, whose base is a public agent key;
- a listing-to-conversation context link, revealing who is negotiating over what;
- creation timestamps and time-bucketed message links, giving timing and volume.

Link bases are public by construction and pagination requires the buckets, so the last
three are not fixable. None of them matters beside the author field, which sits in the
action wrapper rather than the entry body and so cannot be encrypted at all.

**Why this decides it.** R&O's threat model includes an adversary who joins the membrane
specifically to harvest. Against that adversary, content encryption on a shared DNA
protects what was said and exposes the social graph in full. For a mutual aid network the
graph is frequently the sensitive part: knowing a member is in sustained contact with a
particular coordinator conveys most of what the content would, and unlike content it
requires no cryptographic work to obtain.

## 4. Decision: membrane-isolated conversation clones

Every conversation is a cloned DNA with its own network seed, its own DHT and its own
membrane, containing exactly its participants.

A harvester who is not in the clone cannot fetch its actions at all, so the author field
stops being a leak: it still exists inside the clone, where both parties already know who
said what. Exposure reduces from one permanent record per message, with full structure, to
at most one record per conversation at initiation (§5).

**Why the default rather than an escalation.** A tiered model asks members to predict
sensitivity before the conversation happens. People predict that badly, and the wrong
guess is not recoverable once the messages are written. Uniform isolation removes the
prediction.

**Cross-domain references survive.** The objection to isolation is that it breaks R&O's
links from conversations to requests, offers and organisations. In practice R&O already
resolves a cross-DNA reference frontend-side: hREA proposals live in the separate `hrea`
DNA, and `ui/src/lib/services/hrea.service.ts` resolves them over GraphQL rather than by
any DHT link. A conversation clone holds the listing hash it concerns and resolves it the
same way. The reference becomes one-directional: a participant can enumerate their own
conversations and see which listing each concerns, and nobody can go the other way from a
listing to its conversations. That is a small feature loss and a privacy gain.

**What it costs.** This is not a configuration change. `workdir/happ.yaml` now declares
three roles: the original two at `clone_limit: 0`, and a conversation role backed by a new
DNA built in this repository, with its own integrity and coordinator zomes and a non-zero
clone limit.

**And it costs an idle cell on every conductor.** The conversation role cannot be provisioned
lazily. A role with no provisioned cell reaches an unimplemented arm in
`holochain_conductor_api-0.6.1/src/app_interface.rs` at line 491 while app info is assembled,
so the panic surfaces whenever app info is requested rather than at install. Both
`strategy: clone_only` and `deferred: true` reach it. Every member therefore carries an empty
base conversation cell, and that base cell must refuse writes at the integrity layer, because
it is a real cell a client could otherwise write to.

**Precedent.** Volla Messages runs this model in production on Android and desktop. Their
`happ.yaml` declares a single role with `clone_limit: 100` and `deferred: false`. Their
integrity zome defines a `MembraneProofData` struct carrying a `conversation_id`, a
target agent and a role, wrapped in a signed envelope, with DNA properties carrying a
progenitor: a conversation clone is admitted by a progenitor-signed proof naming that
specific conversation. Their entry types are all public with no visibility attribute, and
their zomes contain no content encryption at all.

R&O departs on one point. Volla's properties name a single progenitor and admission is by
proof, where ours name the participant pair and admission is by identity. That is what lets
either participant invite an administrator (§10) without being the other's gatekeeper.

Volla's profiles and file storage live inside the conversation clone, so they have no
global member directory, and their invitation mechanism is an out-of-band QR exchange.
R&O's shared DNA is exactly what they lack, and it is what makes isolation practical here
without QR swapping (§5).

**Unmeasured.** What a conductor costs at high cell count on R&O's stack. Volla runs 100
clones as a pure messenger; R&O carries the shared DNA and the hREA cell alongside. This is
measurable directly and should be measured before the clone limit is raised. The manifest
therefore sets `clone_limit: 100`, matching the only figure known to run in production rather
than a larger number that would read as a decision this note has not made. Raising it is a
one-line manifest change once the measurement exists.

## 5. Conversation lifecycle

**Creation.** A conversation begins when one member responds to another's listing. The
response is the invitation. This reuses an interaction R&O wants anyway rather than
introducing a separate invitation artefact with its own metadata cost.

**Invitation contents.** A random network seed, the conversation id, and the participant
pair, encrypted to the recipient's agent key. The clone's properties name both participants,
who are admitted by identity, so no membrane proof is transmitted and neither participant is
the other's gatekeeper. The recipient decrypts, creates a clone with the same seed and the
same properties, and the two are in a network nobody else can locate or enter.

**How this differs from joining.** R&O's joining membrane admits members by proof, verified
against a dedicated `membrane_signer_pubkey` distinct from the DNA progenitor. Admission is
decided pre-key in R&O's own application; the approval issues a single-use invite redeemed
through the joining service, and the proof is signed at join (`MEMBRANE_MANAGEMENT.md` and
its off-DHT companion). Conversation proofs
reuse the mechanism and invert the custody model: where a proof is needed at all, either
participant may sign it, and there is no ledger, no central key and no service in the loop. A
proof is needed only to admit an agent not named in the clone's properties, which in practice
means an invited administrator (§10); the signed data names its own signer, so the signature
covers the claim of who issued it. `genesis_self_check` validates the signature rather than
the issuing method, so both kinds of proof are the same shape. Nothing about conversation
creation should route through the joining service.

**Delivery, signal first.** If the recipient is online, the invitation travels as a remote
signal and nothing is persisted anywhere, so the conversation leaves no trace on any DHT.
Only if no acknowledgement arrives does the sender fall back to a persisted entry on the
shared DNA. Signals are fire-and-forget with no delivery confirmation, so this requires
the recipient's client to acknowledge by signal, and there is a race if the recipient
appears just after the sender gives up. That race resolves to a persisted invitation,
which is the safe direction.

**The residual exposure.** A persisted invitation is an action authored by the responder,
and that is unavoidable. What is avoidable is whether it names the recipient. Linking it
from the listing draws the edge explicitly. Placing it under a global anchor, with each
member scanning and keeping what decrypts, hides the recipient and leaves only the fact
that someone responded at a given time. The anchor approach costs a scan proportional to
total invitations, which is acceptable at community scale and should be time-bucketed.

**Message delivery within a clone.** Persist plus signal. A message is committed as an
entry in the clone, which is durability and reaches an offline participant when they
return, and sent as a remote signal, which is liveness. `post_commit` runs only on the
committing agent, so the remote signal is the only cross-agent path.

**What becomes public when a conversation succeeds.** An hREA Agreement names its
provider and receiver and is public by design, because fulfilment tracking and reputation
depend on it (#90). So the moment a conversation produces an agreement, that edge is
visible. Isolation protects the content of every conversation and protects entirely those
that never reach agreement, which is most of them: browsing, asking, negotiating,
declining. It does not conceal a completed deal, and it should not, since an agreement is
a deliberate mutual public act.

Two consequences for the exchange layer. A conversation holds the agreement id as a
committed system message (§9) and resolves it frontend-side, but the reverse lookup from a
public agreement to a private conversation cannot exist, and is not needed: only
participants would want it and they are already inside the clone. And any conversation
identifier stored on the agreement must be an opaque random value, never derived from the
conversation's network seed, which stays secret (§6).

**Dependency.** Where the response-to-a-listing event lives is not messaging's decision.
The `exchanges` name is reserved in the frontend's `ZomeName` union but nothing implements
it, and no domain store or composable exists for it. R&O runs hREA as a second DNA, and
ValueFlows models proposals, intents, commitments and agreements, so the agreement itself
may properly belong there. This note specifies what the conversation layer needs from that
event, not where it is built.

## 6. Encryption inside a clone

**Not required.** A conversation clone contains exactly its participants, and both hold
the plaintext by definition. Encrypting content that only its intended readers can fetch
adds key management, key recovery and a device-loss failure mode in exchange for very
little. Volla, a dedicated privacy messenger, reaches the same conclusion.

**Data at rest.** Clone contents sit unencrypted in the conductor's local databases.
Device-level protection is the member's own full-disk encryption, and member-facing copy
should say so.

**What is available, should encryption ever be wanted.** Two routes work in a zome on this
stack, both proven by passing Sweettests on `spike/crypto-feasibility`:

- *Direct box to an agent key.* `ed_25519_x_salsa20_poly1305_encrypt(sender, recipient,
  data)` and `ed_25519_x_salsa20_poly1305_decrypt(recipient, sender, encrypted)`. Note the
  opposed argument orders: both parameters are `AgentPubKey`, so a swap compiles cleanly
  and fails at runtime. The recipient decrypts asynchronously using only their own keystore
  and the sender's public key, with no handshake and no requirement that the sender be
  online. Lair performs the Ed25519 to X25519 conversion internally, so an agent's existing
  key is already a valid encryption address and no key publication layer is needed.
- *Shared secret with re-wrap.* `x_salsa20_poly1305_shared_secret_create_random` mints a
  content key that never leaves lair; `_export` wraps it to another agent's X25519 key and
  `_ingest` admits it to their keystore. Content is encrypted once and only the key is
  wrapped per member, and a member admitted after the fact can be granted access by
  re-wrapping. This is the route for group conversations if they are ever built. It
  requires each agent to mint an X25519 keypair via `create_x25519_keypair` and publish the
  public half, which the direct-box route does not need.

**Two constraints on record.** Every zome crypto primitive routes through lair over IPC
and rejects a single call above 8192 bytes, so neither route is proven for attachments;
chunking would be required and is not yet tested. And using an agent's signing key for
encryption invokes a documented caveat, which libsodium raises and Thormarker's 2021
analysis addresses: joint security of an Ed25519 signature scheme and an X25519 KEM
sharing a key pair is proven in the random oracle model, including in the presence of a
signing oracle. The residual is forward secrecy, since a long-lived key used for key
exchange means compromise exposes past exchanges. That is not achievable on this platform
in any case (§8), and it is not part of R&O's threat model (§3).

**The bootstrap dependency.** Isolation's guarantee is not complete at the DHT layer
alone. Peer discovery runs through a bootstrap server, and in kitsune2 0.4.1 the space read
route (`GET /bootstrap/{space}`) returns the agent list for whatever space identifier the
caller supplies. It reads an `Authorization: Bearer` header, but with no authentication
hook server configured the server issues tokens freely and treats every request as
successful. On a public unauthenticated bootstrap, anyone who knows a space identifier can
enumerate its members, which for a two-agent clone is a social graph edge.

Two consequences follow. R&O should **run its own bootstrap with an authentication hook**.
The joining service is the natural candidate: it already holds a signing key, issues signed
single-use artefacts against a ledger, and knows which agents are members, which is exactly
what an authentication hook needs to decide. This is an integration point rather than new
infrastructure.

Independently of that, **network seeds must be random and transmitted, never derived from
public values**. A seed
derived from a listing hash and an agent key would be computable by every member, handing
the conversation graph to anyone willing to enumerate. The membrane still prevents them
entering the clone, but membership enumeration alone is the leak this design exists to
prevent.

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
The stack pin is in the front matter and is not restated here.

**The grant is `Listed`, naming exactly one function.** Nothing else in the zome is
remotely callable, which matters for anything added to it later.

**Security consequence of Unrestricted.** Any agent can call `recv_remote_signal` and push
a signal. That is expected for messaging, and filtering unsolicited or abusive signals is
an application-layer concern tied to the flagging primitive (#163).

**Lazy init.** A cell's `init` runs on its first zome call, not at install. A recipient
must have been called at least once before a remote signal is authorised. In the
application this is a non-issue; the test primes both cells with `ping`.

**Where it sits under this design.** The substrate carries invitations (§5) and provides
liveness within a clone. Whether the zome belongs in the conversation DNA, the shared DNA,
or both, is open (§13).

## 8. Deletion and archiving

**What the platform allows.** Destroying a key requires a store that can forget, and
nothing in this stack can. The `lair_keystore_api` crate contains no deletion, removal or
destruction operation for stored key material anywhere in its source, and Holochain's only
purge operates on whole databases when a cell is uninstalled. The source chain is
append-only by design; this is the architecture working as intended. Crypto-shredding is
therefore not available, and nothing in the design should assume it as a future option.

**What isolation gives instead.** Removing a conversation clone removes its local
databases. That is real removal of local data, not a soft-delete flag. The primitive is
**leave and remove**: a participant may leave a conversation and delete their copy.

**What it cannot do.** Remove the other participant's copy. No distributed system can
compel that, and member-facing copy must not imply otherwise.

**Archive.** A lighter action for tidiness: disable the clone so it stops running and drops
out of the inbox, with data preserved and the clone re-enabled on demand. Holochain
supports disabling and re-enabling clone cells directly.

## 9. Entry and link model

Two models, because two DNAs are involved.

**In the conversation clone:**

- `Message { content, message_type, reply_to? }`. Content is plaintext (§6). The action
  carries the authoritative timestamp, so the entry does not repeat it as a forgeable client
  copy. `message_type` distinguishes member messages from system messages, of which the
  administrator-invitation notice (§10) and the agreement announcement below are two.
- Creation-time context as DNA properties, not an entry. The clone's properties carry the
  listing hash this conversation concerns and its type (Request, Offer, Direct), alongside
  the conversation id and participant pair they already carry (§5). Every participant's
  clone is then self-describing from `dna_info()` with no DHT read, and the invitation
  transmits nothing extra, since properties already travel with it. Volla carries
  per-conversation context in properties in production. Properties being immutable means a
  conversation cannot be re-pointed at a different listing; it never should be, so the
  wrong state is unrepresentable rather than guarded against.
- The hREA proposal id is not creation-time context: a conversation produces its agreement
  mid-life (§5). When it does, the id is committed as a system message in the stream at the
  moment the deal was struck, reusing the mechanism §10 already requires. It reaches every
  participant through the same reads that render the messages, so retrieval costs nothing
  the client is not already paying. An earlier revision put all three fields on a
  configuration entry; the mid-life id would have forced an update chain onto it, where
  this shape keeps the conversation's context append-only: properties fixed at creation,
  the agreement announced by appended message.
- The listing hash and the proposal id are resolved frontend-side against the other cells;
  neither is a DHT link, and neither can be.
- Links: conversation to messages, time-bucketed for pagination. The message update chain.
  No other entry exists to need one.

Participants are the clone's membrane, not a field on an entry.

**On the shared `requests_and_offers` DNA:**

- The invitation entry, only when signal delivery fails (§5): a random seed, the
  conversation id and the participant pair, encrypted to the recipient, under a
  time-bucketed global anchor.

## 10. Administrator access

**No standing access.** Administrators are not members of any conversation clone by default
and have no mechanism to enter one uninvited. Any design granting standing access would
make the member-facing guarantee (§11) false.

**Participant invitation only.** A participant may invite an administrator into a
conversation, for support or dispute resolution.

**Announced, structurally.** The invitation commits a system message to the conversation,
so every participant sees that it happened. This must be a committed entry rather than a
client-side rendering, so a modified client cannot suppress it.

**What the administrator sees.** Gossip carries the clone's full history. An administrator
invited today reads everything said before they arrived, from both participants. This is
retrospective access to the entire conversation, not observation from the moment of
joining, and the consent wording must say so plainly rather than implying an administrator
is joining an ongoing room.

**Not a substitute for flagging.** Screenshot-based reporting into the flagging primitive
(#163) remains available and discloses far less. Administrator invitation is the heavier
instrument and should be presented as such.

**Unilateral, with notice.** One participant may invite an administrator without the
other's agreement. Requiring mutual consent would defeat the instrument in the case that most
needs it, since a participant behaving badly will not consent to being observed. The notice is
the safeguard, and it is structural rather than social: the system message is committed, so a
modified client cannot suppress it.

**Open for governance.** The exact consent wording remains a governance and copy decision
rather than an architectural one, including how plainly it conveys that an invited
administrator reads the whole history.

## 11. What members are told

The guarantee, in plain terms:

- Conversations are visible only to their participants. Other members of the network
  cannot see that a conversation exists, who is in it, or anything said in it.
- Responding to a listing may leave a record that you responded, if the other party is
  offline at the time. Nothing after that point is visible to anyone else.
- No administrator has access to any conversation unless a participant invites them, and
  that invitation is announced in the conversation. An invited administrator can read the
  conversation's whole history.
- If a conversation leads to an agreement, the agreement itself is public, including
  who it is between. Conversations that do not lead to an agreement leave no such record.
- Leaving a conversation removes your copy. It cannot remove the other participant's copy.
- Conversation data is stored unencrypted on your own device. Device-level protection is
  your own disk encryption.

## 12. Build sequence

1. **Substrate.** Cap grant and remote signal path. (DONE, §7.)
2. **Prove it.** Two-conductor Sweettest. (DONE.)
3. **Conversation DNA.** A new DNA in this repository with integrity and coordinator zomes,
   the message entry, the creation-time context in the clone's properties, the agreement
   system message, and membrane validation against the participant pair those properties
   name. Registered as a third role in `workdir/happ.yaml` with a non-zero clone limit and
   `deferred: false`, which the platform forces rather than Volla merely suggesting (§4).
   (PARTLY DONE, #183: the DNA, the membrane gate, the coordinator, the base-cell write
   refusal, the role and membrane test coverage. The message entry and the context
   properties remain.)
4. **Clone lifecycle.** Create, join, disable, remove, and the frontend's conversation list
   assembled by enumerating clones. This needs its own harness: #183 provisions the role
   directly and does not exercise cloning. A freshly created or joined clone has no cap grant
   until something calls it, and signals into it are dropped silently, so every clone needs
   priming on both sides (§7).
5. **Invitation.** Signal-first delivery with the persisted anchor fallback. Depends on the
   listing-response design (§5).
6. **UI.** Conversation list, thread, inbox, and the listing entry points.

Steps 3 and 4 can proceed independently of step 5.

## 13. Open questions and dependencies

**Ours to resolve:**

- Conductor cost at high cell count on R&O's stack, which sets the clone limit. Measurable.
- Attachment handling. Chunking within a clone is straightforward since content is
  unencrypted, and the community `holochain-open-dev/file-storage` zome chunks client-side
  and performs no encryption, which suits an isolated clone directly. Chunk size against
  the current conductor payload ceiling is unverified; the 256KB figure in circulation
  dates from a much older Holochain version.
- Whether the `messaging` zome belongs in the conversation DNA, the shared DNA, or both.
  This blocks the signal half of message delivery (§5), so the message entries land
  persist-only until it is answered.

**Dependencies on others:**

- The listing-response design, and whether it belongs in R&O or hREA (§5).
- Administrator invitation consent wording and whether it requires mutual agreement (§10).
- Bootstrap operation with an authentication hook (§6).

**Settled, with evidence:**

- Encryption can run in a zome, proven by passing Sweettests (§6).
- Crypto-shredding is not available on this platform (§8).
- Forward secrecy is not achievable here and is not required by the threat model (§6).
- Sender identity cannot be hidden on a shared DNA (§3).
- A clone limit is a resource guard set in the manifest, not an architectural ceiling.
  Holochain's own documentation shows `u32::MAX` as a valid value.
- A base conversation cell on every conductor is unavoidable; lazy provisioning of the role
  is not available on this stack (§4).
- Sweettest cannot pass a membrane proof through any public API on 0.6.1, 0.6.3 or 0.7.0.
  `ConductorHandle::install_app_bundle` with `RoleSettings::Provisioned` is the working
  route (§14).

## 14. Evidence base

Claims in this note were established by reading source directly. The principal sources:

- `spike/crypto-feasibility` (this repository):
  `tests/sweettest/tests/administration/spike_crypto.rs` proves cross-agent direct-box
  encryption in a zome; `spike_sharedsecret.rs` proves shared-secret content keys with
  re-wrap to a later-admitted third agent. Both pass on this stack.
- `holochain_integrity_types` 0.6.1, `action.rs`: the public `author` field on every action
  variant.
- `hdk` 0.6.1 and `hdi` 0.7.1, `x_salsa20_poly1305.rs`: the encryption and decryption
  signatures and their opposed argument orders.
- `lair_keystore_api` 0.6.3: absence of any deletion operation.
- `holochain_conductor_api` 0.6.1, `app_interface.rs` line 491: the unimplemented arm for a
  role with no provisioned cell.
- `holochain` 0.6.1, `conductor.rs` line 1295, with `holochain_types` 0.6.1, `app.rs` lines
  154 to 176: `install_app_bundle` and per-role `RoleSettings::Provisioned`, the only public
  route that carries a membrane proof. Sweettest's own installers map every DNA to no proof
  on 0.6.1, 0.6.3 and 0.7.0 alike.
- `kitsune2_bootstrap_srv` 0.4.1, `space.rs`, `auth.rs`, `http.rs`: space read scoping and
  the optional authentication hook.
- `HelloVolla/volla-messages`: `workdir/happ.yaml`, and the relay integrity zome's
  `MembraneProofData`, `Properties` and entry type declarations.
- `holochain-open-dev/file-storage` and its predecessor: client-side chunking, manifest of
  chunk hashes, no encryption.
- E. Thormarker, *On using the same key pair for Ed25519 and an X25519 based KEM*, IACR
  ePrint 2021/509, cited by libsodium and by IETF EDHOC.

**Correction owed elsewhere:** `CellCloning.md` states that `deferred: true` is required
for clonable roles. Two production manifests set `deferred: false` with a non-zero clone
limit, and on this stack `deferred: true` reaches the unimplemented arm named above. Filed as
`Soushi888/holochain-agent-skill#2`.
