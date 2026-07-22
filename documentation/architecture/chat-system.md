# Messaging System — Architecture Design Note

**Status:** Design of record.
**R&O version at time of writing:** v0.6.1 (application release)
**Implementation status:** The cross-agent signal substrate (see §7, build sequence steps 1–2) is **built and tested** on hdk 0.6.0, proven by a two-conductor Sweettest. The encryption and persistence layers below it (§5, §6, §8) are **designed but not yet built** — the substrate currently carries plaintext over an ephemeral signal. Read the sections below as the agreed plan, with only the substrate landed so far.
**Relates to:** #91 (Chat System), #51 (Global Notifications), #12 (Real-time Signals), #144 (Breaking-version Migration), #163 / #162 (Flagging / Moderation)
**Supersedes:** the *Security and Privacy* section of `documentation/requirements/post-mvp/messaging-system.md`

---

## Decisions at a glance

- Private messaging in R&O uses **content encryption on the single shared DNA** (keypair-locking). Not membrane-isolated per-conversation DNAs, and not link-based checks.
- Delivery is **persist plus signal**: every message is a committed encrypted entry (durability) *and* a remote signal (liveness). *(Substrate for the signal half is built; the persisted encrypted entry is next.)*
- Deletion is **soft-delete now, plus non-migration at the next network bump**. Crypto-shredding was considered and is **out of scope** (see §8).
- The cross-agent signal substrate is **step one, and is now done**: cap grant, `send_remote_signal`, `recv_remote_signal`, provenance, all verified end to end.

---

## 1. What this note decides

#91 specifies the chat system in depth but leaves its central privacy question open, offering "Option A (single DNA, link-based participant checks) for MVP, Option B (Volla-style DNA per conversation) for production privacy." Neither is right for R&O as written: Option A is not private, and Option B breaks the feature's own data model. This note resolves that question, corrects the security framing inherited from `messaging-system.md`, and pins the message lifecycle and deletion model so the build can proceed. It is the design of record; #91 remains the implementation task list.

## 2. Signing is not encryption

`messaging-system.md` states messages are secured by "encryption via Holochain's agent-centric security model." That conflates two separate properties.

The agent-centric model gives every action a signature by its author's agent key. That yields **authenticity, integrity, and non-repudiation** for free: any agent can verify who wrote a message and that it has not been altered. It does **not** give confidentiality. A public DHT entry is plaintext to any agent who can fetch and validate it. Signing proves authorship; it does not hide content.

Confidentiality is therefore a deliberate, separate choice. The proof is close to hand: Fieldnotes had to add its own encryption layer (`crypto.rs`) precisely because Holochain does not encrypt entry content for you.

## 3. Three ways to make messages private

There is no single "private messaging" primitive in Holochain. There are three mechanisms, and the reference apps each pick a different one. Their code was read directly rather than taken on description.

**Ephemeral, no persistence (ZipZap).** The message travels as a remote signal and is never written to the DHT. Private because nothing is stored. Cost: no history, and both parties must be online. Fit for typing indicators, presence, and read receipts, nothing heavier. *This is the exact pattern the current substrate is built on.*

**Membrane-isolated per conversation (Volla Messages).** Each conversation is a separate cloned DNA with membrane proofs; non-participants are not in that network and never receive the entries. Volla's zomes contain no content encryption at all (grepped: no x25519, crypto_box, or private entries). Privacy is structural. This is durable and is the canonical Holochain chat pattern, but it is operationally heavy (a cell per conversation) and, decisively for us, it isolates each conversation from the main DHT.

**Content-encrypted on the shared DNA (the Fieldnotes pattern).** Message content is encrypted so only participants can read it, and the ciphertext lives as an ordinary entry in the main DHT. This is the only one of the three that is genuinely end-to-end encryption. It keeps everything in one DHT. `crypto.rs` already implements it and is tested.

## 4. Decision: content encryption on the single R&O DNA

R&O keeps conversations and messages as entries in the existing `requests_and_offers` DNA and makes them private by encrypting content, using the keypair-locking pattern proven in Fieldnotes.

The reason is R&O's own data model. #91's conversations link to requests, offers, organisations, and hREA proposals: `RequestToConversation`, `OfferToConversation`, `AgentToConversations` (the inbox), `OrganizationToConversations` (channels), `ConversationToProposal` (the hREA hook). That cross-domain linking is the entire "conversation first, propose a deal second" premise of the feature, and it only works if conversations live in the same DHT as the things they link to.

Volla can afford membrane-per-conversation because a pure messenger has nothing to link to. R&O does. Adopting Volla's model would turn every one of those links into cross-cell plumbing and make propose-from-inside-a-chat genuinely hard. So Option B is out for the general case. Option A (link-based checks in a shared DNA) is also out, because it provides no confidentiality at all: any agent can read the entries regardless of the link structure.

Content encryption is the synthesis #91 did not consider, because it framed the choice as membrane-or-nothing: keep the single DNA and all its linking, and get privacy from encryption instead of isolation.

Membrane-per-conversation is retained as a **known escalation**, not a rejection. If a specific requirement ever demands network-level isolation for a class of conversation, Volla's pattern plus R&O's existing membrane-management work is the route, accepting the loss of linking for those conversations.

## 5. Message lifecycle: persist plus signal

ZipZap delivers liveness only; Volla persists. R&O needs both, so a message is written once and signalled once.

1. **Encrypt.** The sender encrypts the message content (see §6).
2. **Persist.** The sender commits it as a `Message` entry, linked into the conversation and into each participant's inbox. This is durability: the message survives, and reaches an offline recipient when they next come online and query their inbox.
3. **Signal.** The sender calls `send_remote_signal` to the participants. This is liveness: if a recipient is online, their `recv_remote_signal` fires and their UI updates immediately.

Step 3 is necessary because `post_commit` runs only on the committing agent. R&O's existing signal system emits `EntryCreated` locally to the sender's own client; nothing in it crosses to another agent. The remote signal is the only cross-agent path.

**Built so far:** step 3 (the cross-agent signal). Steps 1 and 2 (encryption and the persisted entry) are the next work.

## 6. Encryption detail

Two cases, both covered by the Fieldnotes pattern (to be ported into the conversations zome; not yet present in R&O).

**One to one.** A text message is small, comfortably under lair's 8 KB crypto_box ceiling, so it is locked directly to the recipient with `encrypt_to_agent` (lair's crypto_box, which converts the Ed25519 agent key to X25519 internally). No content key, no hybrid. Every participant's key is already known: it is their `AgentPubKey` (the 32-byte Ed25519 core).

**Group and attachments.** For organisation channels and any payload over the 8 KB ceiling, use the hybrid: encrypt the content once with a fresh single-use key via `bulk_encrypt` (ChaCha20-Poly1305, host-side, no IPC limit), then wrap only that 32-byte key to each participant through `encrypt_to_agent`. This is the re-wrappable cohort pattern (Model B). It is what lets a many-participant channel or a file attachment be readable by the whole set.

**Harden from the start.** Fieldnotes' `crypto.rs` uses an empty associated-data field, which means the ciphertext is not bound to its entry location. For messaging, bind the AEAD associated data to the conversation and sender, so a ciphertext cannot be lifted from one context and replayed in another. Cheap to do at the outset, awkward to retrofit.

## 7. The substrate: cross-agent signalling (BUILT)

R&O had no cross-agent signalling: its `init` was a bare `Ok(Pass)` and it held no cap grants. Its six zomes only ever emitted local signals to their own client via `post_commit`.

The substrate is the ZipZap pattern, verified line by line against hdk 0.6.0 canon (this caught two drifts from ZipZap's 0.4 code: `GrantedFunctions::Listed` takes a `HashSet` not a `BTreeSet`, and the `SerializedBytes` derive is unnecessary on 0.6). It lives in a new coordinator-only `messaging` zome, mirroring the existing `misc` zome:

- an `init` that creates an **Unrestricted** cap grant for `recv_remote_signal` (committed as a Private entry on the agent's own chain);
- a `recv_remote_signal` handler that reads the sender from `call_info()?.provenance` and re-emits to the UI;
- `send_remote_signal` in the `send_message` path;
- a `Signal::Message` variant;
- a `ping` health-check whose secondary job is to trigger lazy `init`, so a recipient's cap grant is committed before a signal arrives.

**Proven** by a two-conductor Sweettest: Alice's `send_message` reaches Bob as a `Signal::Message` with correct content and a `from` field carrying Alice's key via provenance.

**Security consequence of Unrestricted.** An unrestricted grant means any agent can call `recv_remote_signal` and push a signal to you. That is expected for messaging (you cannot know your correspondents in advance), but it means unsolicited or abusive signals are possible at the substrate level. Filtering (surface only messages from known contacts, rate-limit, tie into the flagging primitive #163) is an application-layer concern, not a substrate one.

**Lazy init, noted.** A cell's `init` runs on its first zome call, not at install. A recipient must have been called at least once before a remote signal is authorised, or the grant does not yet exist and the signal is dropped silently. In the app this is a non-issue (a user's cell is exercised on login); the test primes both cells with `ping` to reproduce that.

## 8. Deletion model

Deletion on an append-only DHT is not erasure. R&O's model is layered and honest.

**Now: soft-delete.** A deleted message is marked deleted and hidden from the UI, reusing the Active / Archived / Deleted status pattern already in the app.

**At the next network bump: non-migration.** #144 (breaking-version migration) is a curation boundary: when the DNA modifiers change and a new DHT stands up, something decides what data seeds the new network. Deleted messages are simply not carried forward. The framing is filter-before-seed, not migrate-then-delete: the deleted entry is never written into the new DHT and dies with the abandoned cell. Under this design the abandoned cell holds only ciphertext, and if the keys are not migrated either, that ciphertext is permanently unreadable.

**Out of scope: crypto-shredding.** Considered and deliberately deferred. Destroying a message's key would make its ciphertext unreadable immediately, without waiting for a migration. But it closes only a narrow window — between soft-delete and the next bump — and only against an adversary who has retained a copy of the old DHT *and* was one of the participants who could decrypt it. That is not R&O's threat model: this is commons infrastructure for cooperating members inside a membrane-gated network, not a tool built to resist a hostile party with a legal-grade erasure requirement. Worse, it forces a real downgrade: to shred a key you must be able to destroy it, which means keys cannot be durable DHT entries and must live device-locally, which makes message history device-bound — lose the device, lose the messages. Trading durable, recoverable history for an erasure guarantee most members will never need is the wrong default. Revisit only if a specific use case genuinely requires immediate cryptographic erasure (for example a dedicated channel for sensitive disclosures), and treat that as a scoped, opt-in decision, not the platform default.

**The ceiling, stated plainly.** Anyone who retained the old cell's databases still holds the ciphertext bytes. Un-migrated keys make them meaningless, but the bytes exist. This is the true limit on any Holochain app, and the layered answer above is about as close to erasure as the substrate allows. Member-facing copy should say what "delete" means honestly: hidden immediately, cleared from the network at the next update — not instant total erasure.

## 9. Entry and link model

Adapted from #91, with the content field now carrying ciphertext.

- `Message { conversation_hash, ciphertext, nonce, message_type, reply_to?, created_at }`. Content is the encrypted blob plus nonce, not plaintext. `message_type` distinguishes text from system messages (proposal actions, joins).
- `Conversation { participants, context_hash?, context_type?, title?, created_at }`. `context_type` is Request, Offer, Organization, or Direct.
- Links as #91 lists them: conversation to messages (time-bucketed for pagination, Volla's pattern), agent to conversations (inbox), request / offer / organization to conversation (context), conversation to hREA proposal (the exchange hook), message update chain.

One open modelling question: whether a one-to-one `Conversation` needs its own entry or can be addressed by a deterministic id derived from the participant pair. Deferred to implementation.

## 10. Build sequence

The order follows the dependencies, not #91's phase numbers.

1. **Substrate.** Add the init cap grant and the send / recv remote-signal path to one zome. *(DONE — the `messaging` zome, #12's unbuilt cross-agent half.)*
2. **Prove it.** An ephemeral round-trip between two agents. *(DONE — two-conductor Sweettest, passing.)*
3. **Persisted encrypted layer.** The `Message` and `Conversation` entries, the encryption, the persist-plus-signal send path. *(NEXT.)*
4. **UI.** Conversation list, thread, inbox, and the request / offer entry points.

## 11. Open questions carried forward

- Key location for the encrypted layer (which agent keys, extraction of the 32-byte Ed25519 core from an `AgentPubKey` for `encrypt_to_agent`).
- Organisation-channel membership churn and key re-wrap on join.
- One-to-one `Conversation` entry versus derived id (see §9).
- Escalation criteria for moving a conversation class to membrane isolation (§4).

*Resolved and closed:* the HDK pin (hdk 0.6.0 / hdi 0.7.0, confirmed against Cargo.lock) and the durability-versus-shreddability fork (settled in favour of durable history; crypto-shred out of scope, §8).

## 12. References

- Fieldnotes `crypto.rs`: the keypair-locking and hybrid encryption pattern, tested (round-trip, tamper, wrong-key).
- ZipZap (`github.com/lightningrodlabs/zipzap`): the ephemeral cross-agent signal substrate. The pattern the built substrate is based on.
- Volla Messages (`github.com/holochain-apps/volla-messages`): membrane-isolated persistent chat; the durability and time-bucketing patterns.
- #91: chat system implementation specification.
- #51, #12: notifications and the shared real-time signal substrate.
- #144: breaking-version migration, on which the deletion model depends.
- #163, #162: flagging and moderation, the application-layer filter for unsolicited messages.
