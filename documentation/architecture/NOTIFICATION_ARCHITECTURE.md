# R&O Notification Architecture

**Status:** v0.4, draft for frame-check (Sacha)
**Consolidates:** #51 (global notification system), #52 (admin inbox), #121 (notify admins of new members/orgs), #163 (community flagging). Interest markers are now the first worked consumer (see section 11); flagging is the second.
**Stack assumptions:** HDK `=0.6.1` / HDI `=0.7.1`, coordinator/integrity split per `Architecture.md`, progenitor plus `administration` zome per `Progenitor.md`.

**History.** v0.1 was drafted on 10 June 2026 and delivered as a download but never committed. This is that text, reconstructed from the session transcript, with section 11 recording decisions taken on 3 September 2026.

---

## 1. Why one primitive

Flagging, join/org alerts, the admin inbox, interest markers, and the global notification system all need the same underlying capability: get a signed record of "something happened" in front of the right recipient, durably, with no central server. If each feature builds its own queue, we get five divergent half-implementations of the same thing, which is the uncoordinated sprawl this spec exists to prevent.

The principle is **design the durable contract once, across every consumer; build it incrementally**. The first consumer to ship lands on the real primitive, not a feature-specific stub. The expensive-to-change part is the on-DHT data model and addressing (DHT structure is painful to migrate; see #144), so that is where the design effort goes. Each consumer's presentation stays deliberately light, because that is cheap to change later.

This is a spec to decide *on*, not a finished design. Section 9 lists the calls that are genuinely Sacha's.

---

## 2. The consumers, seen together

| Consumer | Role | Recipient | Stateful? | Producer or view |
|----------|------|-----------|-----------|------------------|
| Interest markers | mark interest in a listing | listing author (individual) | no (informational) | producer |
| Status change | "your account status changed" | affected member (individual) | no | producer (admin actions); see section 13 on suspension |
| Flagging (#163) | report content for review | admins | yes (open to resolved) | producer |
| Join / org requests (#121) | request admin decision | admins | yes (open to resolved) | producer |
| Joining-flow alerts | new applicant arrived | admins | yes | producer (overlaps #121) |
| Admin inbox (#52) | review queue | none | none | **view** over admin-addressed items |
| Global system (#51) | the primitive itself | any agent | both | none |

Two things fall out of looking at them together that are invisible from any single feature:

- **#52 is not a producer.** The admin inbox is a *read model* over every admin-addressed item. Once that is clear, #51/#52/#121/#163 stop being four notification systems and become one queue with producers and views.
- **There are two recipient shapes and two durability shapes**, and they cross. See sections 3 and 5.

---

## 3. Two shapes: notification vs work-item

Not everything in the queue is the same kind of thing:

- A **notification** is informational: "someone marked interest in your listing." It may be transient; nothing tracks it to resolution.
- A **work-item** needs action and carries state: a flag or a join request is *open* until an admin *resolves* it. The admin inbox is precisely the set of unresolved work-items addressed to the admin role.

These share addressing and delivery, and differ only in whether they carry a `state` and appear in a task view. The cleanest expression is therefore **one entry type with an optional state facet** rather than two parallel types, but this is a modelling call worth confirming (decision 1).

---

## 4. The durable contract (data model)

New domain following R&O conventions: `notifications_integrity` plus `notifications` (coordinator).

Illustrative entry shape; final field set is Sacha's:

```rust
// notifications_integrity
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Notification {
    pub kind: NotificationKind,        // InterestMarker | Flag | JoinRequest | ...
    pub recipient: Recipient,          // see section 5: individual agent or role
    pub subject: AnyLinkableHash,      // the thing this is about (listing, profile, agent, request)
    pub actor: AgentPubKey,            // who triggered it
    pub state: Option<WorkItemState>,  // every kind uses this in practice; see section 11
    pub payload: Option<Vec<u8>>,      // kind-specific detail; sealed to recipient where private (section 11)
    pub created_at: Timestamp,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Debug)]
pub enum WorkItemState {
    Open,
    Resolved,
    Retracted,   // withdrawn by the actor; the only transition interest markers use
    Dismissed,   // closed by an admin with no action
    Upheld,      // closed by an admin with action taken
}
```

**Updateable *and* forensic at the same time.** R&O's status-enum/soft-delete convention is the right fit: state changes are *updates that supersede*, never hard deletes. Holochain preserves the original action in history regardless, so "issuer can retract / admin can resolve" and "the trail is preserved for accountability" are not in tension; the substrate gives us both for free. A retracted flag changes state to `Retracted`; it does not vanish, because "flagged then retracted" is itself signal.

---

## 5. Addressing: the core fork

Two recipient shapes, both idiomatic:

**Individual recipient** (interest markers to listing author): a link based from the recipient's `AgentPubKey`. The recipient queries links to their own key. Simple.

**Role recipient** (flags, join requests to admins): two candidate mechanisms.

- **(A) Shared anchor.** One well-known `admin_review` anchor (path). Producers link new items from it; every current admin queries it. One write per item. New admins immediately see the full history. The one thing it needs is light coordination over "who is handling this" (a claim/assignment link), which the admin inbox view manages.
- **(B) Per-admin fan-out.** At creation time, resolve the current admin set via `administration`'s `get_all_administrators_links` and create a link to each admin. Each admin gets a private-feeling inbox, but the admin set is *dynamic*, so an admin added later misses everything created before they joined, and every item costs N writes.

**Recommendation: shared anchor for the admin role; individual links for peer recipients.** R&O's admin set changes over time (the `administration` zome exists precisely so progenitor/admins can add more admins), and the shared anchor is the option that stays correct across membership change. Fan-out's per-admin inboxes are not worth re-deriving the admin set on every write and silently dropping history for new admins. (Decision 2, but this is the strong default.)

---

## 6. Delivery: three separated layers

| Layer | Mechanism | Role | Build? |
|-------|-----------|------|--------|
| Durable queue | DHT links from recipient anchor/address | **source of truth** | yes; this *is* the primitive |
| Live signal | `post_commit` to `send_remote_signal` to `recv_remote_signal` | latency optimisation | landed as #213 (section 11) |
| External relay | existing Listmonk plus Lettermint (email) | reach offline recipients | reuse, not rebuild |

The durable DHT queue is the thing that must exist; everything reads from it. The live signal is a nicety: it makes the recipient's view update without a poll, but an offline recipient simply picks the item up from the queue on return. It requires an `Unrestricted` cap grant on `recv_remote_signal` in `init()` (per `AccessControl.md`).

External email is **not** a new zome. R&O already has Listmonk plus Lettermint for GDPR-compliant delivery; the notification primitive hands off to that path when out-of-band reach is wanted. (The holochain-open-dev `notifications` zome was evaluated and rejected: last updated Feb 2024 on hdk 0.2.6, two major lines behind, and it only does external push, which we already have.)

---

## 7. Flagging as a worked consumer

The worked example that validates the role-addressed, stateful path:

**Produce.** A member confirms a flag. The `notifications` coordinator creates a `Notification { kind: Flag, recipient: Role(Admins), subject: <flagged item hash>, actor: <flagger>, state: Some(Open), payload: <category plus reason> }`, links it from the `admin_review` anchor, **and** links it from the flagged party's address so the flag is discoverable against them.

On "recorded on both parties": the flag is authored by the flagger (it is on *their* source chain, signed by them) and made discoverable from the flagged agent's address via a link. We cannot write to another agent's chain, so "on both DNAs" means *authored by one, linked from both*. The flagged member, querying links to their own key, sees the flags standing against them; admins see them via the anchor.

**Resolve.** `Open` to `Retracted` (by the actor) or `Open` to `Dismissed | Upheld` (by an admin, gated by the existing `check_if_agent_is_administrator` guard). Status-update, never delete.

**Surfaces.** The admin inbox (#52) renders open admin work-items with a direct link to the subject. The flagged party can see a flag exists against them. Public, on-listing flag visibility is **not** in v1 (section 8).

**Adjacent but deliberately separate: the personal layer.** Personal *hide* (self-scoped link to content, deletable; the Vines pattern) and personal *block* (a receiver-side filter on an agent) are **not** notifications and must never route through this primitive or be gated by any flag threshold. A member can always hide or block instantly, regardless of admin process. They are listed here only to mark the boundary.

---

## 8. Out of scope for v1 (explicit)

- **Automatic graduated visibility reduction.** Dropped. In a trusted community with immediate admin notification, automatic silencing is the pile-on risk, not the remedy. Thresholds, if wanted later, drive *admin attention ordering*, not automatic public consequence.
- **Flagging private communication.** Deferred behind chat (#91). An admin cannot retrieve a private entry they are not party to, so flagging a message means submitting evidence, which is a weaker he-said-she-said construct. Out until messaging exists.
- **External push beyond existing email.**
- **Progenitor to community-tuned authority transition.** Separate, later question. (`hc-cooperative-content` is a reference for that day, not this one.)
- **Read receipts to the sender.** Out, per Anita, 3 September 2026 (section 11).

---

## 9. Open decisions

1. ~~One entry with a `state` facet, or two entry types?~~ **Settled in practice: one.** Retraction (section 11) means interest markers carry state too, so every kind uses the facet. Final field set remains Sacha's.
2. **Role addressing: shared anchor (A) or fan-out (B)?** *Lean: shared anchor, on the dynamic-admin-set reasoning in section 5.*
3. **Flagger-identity confidentiality.** Native private entries are *author-only*, not role-readable, so "only admins see who flagged" is not free. Options: encrypt the flagger identity to admin keys; deliver it admin-only via signal/cap-granted call; or accept attributable flags in v1. This is the most consequential decision for the harassment case and has no default; it needs a real choice. Still open.
4. ~~Do interest markers ride v1?~~ **Settled: yes, and first.** See section 11.
5. ~~Live-signal layer in v1, or durable-queue-only first?~~ **Settled by #213.** The substrate exists; the durable queue remains source of truth and the signal is the optimisation over it.

---

## 10. Build sequencing (revised)

1. `notifications` zome pair plus durable queue plus individual addressing, consumed by **interest markers** (section 11). Signal via #213 for immediacy.
2. Admin shared anchor, consumed by flagging (#163) and join/org alerts (#121). Needs decision 3 first.
3. Admin inbox view (#52) over the queue.
4. External-relay hand-off wiring. Later still: thresholds-as-attention, community-authority transition.

Each step lands on the same contract; nothing is a throwaway slice.

---

## 11. Addendum, 3 September 2026: interest markers as the first consumer

Decisions taken in conversation between Sam and Anita, with Sacha's frame-check pending.

**What an interest marker is.** A says "I am interested" on B's listing, or to B directly. What B receives is A's name, a link to A's profile, A's short message, a link to the subject, and **A's chosen off-app contact route**. It is a contact exchange, not a message-service entry point. Its purpose is to get two people talking; it does not insist that the conversation happen inside the app. Section 12 describes what it becomes when B responds in kind.

**Why first.** It is the individual-addressing test case (decision 4), it is the simplest consumer, it is what testers will actually feel, and the signal substrate it wants for immediacy (#213) now exists. The messaging service that follows (the knock, capability grants, the sealed mailbox in the messaging design note) supersedes much of what this does; this is the bridge until then, so v1 stays minimal.

**Persistence.** The marker is a DHT entry linked from B's agent key. B finds it whenever they are next online, however long ago it was sent. No mailbox is needed for this consumer, because the payload carries the means to continue off-app.

**Privacy: what is sealed, and what is not.** A's message and contact route are private, so the `payload` is **sealed to B's key** (ring-hybrid, per the messaging design note: ring for content, lair for key wrapping, on account of lair's 8KB per-call ceiling). The public fields (`kind`, `recipient`, `subject`, `actor`, `created_at`) are not sealed, and cannot be: every Holochain action carries a public author, and the link from B's key is enumerable. So **v1 leaks the response graph**: any node can see that A responded to B's listing, when, and how often. For responses to public listings this is the same exposure as replying to a forum post, and it is accepted for MVP. It is the reason the messaging design note uses derived addresses instead, and the reason this primitive is a bridge rather than a destination.

**Contact routes flow with each side's response.** A's marker carries A's route, sealed to B. If B responds (section 12), B's marker carries B's route, sealed to A. Neither party shares until they choose to respond, and each picks the route for this interaction: B's defaults from the listing's `contact_preference`, A's from A's profile. The profile holds `email` (required) and `phone` (optional), confirmed in both `users.schemas.ts` and the integrity zome. Note that these are public entry fields today: any node holding a profile can read them. Sealing the marker payload therefore protects A's route only from nodes that lack A's profile. Whether profile contact fields should themselves be sealed is a wider question for the membrane and messaging designs, not this one.

**Seen state.** B marks a marker as seen by committing a recipient-authored record; the UI hides markers so marked. This is B's own bookkeeping.

**No read receipt.** A is not told whether B has seen the marker. Per Anita: not needed now, and the messaging service replaces much of this later. B can see an interest, decide not to follow up, and A does not learn they were seen and passed over.

**Retraction.** A withdraws by updating the marker to `Retracted`. B's read walks links from B's key and follows each update chain to its latest revision (the pattern fixed in #212), so a retracted marker is hidden on the next load or signal. If B had already marked it seen, the UI may show it as withdrawn briefly or simply drop it; no second record is needed. This is why interest markers carry state.

**Eligibility.** Accepted members only. The zome checks the actor's status before writing.

**Rate cap: two tiers, two counters.** The cap exists to protect strangers from being flooded, not to limit peers who have both opted in.

- *Unconnected:* at most one `Open` marker per (actor, subject) pair, so a second attempt on the same listing or peer is a no-op; and at most ten new markers per rolling 24 hours across all recipients.
- *Connected (section 12):* a per-pair allowance of one hundred per 24 hours, and these do not draw on the unconnected budget. Pinging a friend should not cost the ability to respond to a listing.

Enforcement is in the coordinator, reading the actor's own chain with `query`, and on the receiving side, where the recipient's client ignores markers from an actor beyond the limit whatever that actor's client did. It is not validation-enforced, and need not be: a marker has a known recipient, so the receiver can filter. This is the same posture as suspension (section 14) and read filtering (#221). The mailbox first-contact cap in `chat-system.md` is different on purpose: a knock has no visible recipient, every envelope sits under one anchor, so receiver-side filtering is impossible there and validation via `must_get_agent_activity` is the only place that cap can live. Two caps, two postures, because the two mechanisms differ in addressing. Both limits are DNA properties; ten and one hundred are starting values, not findings.

**No hREA.** An interest marker is not an hREA Intent or Proposal. The exchange contract lives in R&O and wires in from there when it exists.

---

## 12. Connection: what a reciprocal marker means

**Mutual interest is derived, not stored.** If B responds to A's marker with a marker of their own on the same subject, that pair, one each way, is a connection. There is no connection entry. Each side's intent lives on their own chain; the relationship is what both chains say together. The zome tests for it with one link query: from A's own key, is there an `Open` marker whose actor is B? That is B's marker to A, already in A's inbox.

**Retraction dissolves it.** If either party retracts their marker, the pair no longer exists, the other drops back to the unconnected tier toward them, and the connection count loses one. That is the "unfriend," and it falls out of the model without a separate action. Abuse beyond that is the personal block layer's job, which is not this primitive (section 7).

**Connected peers can ping.** Between connected peers, an `Interest` marker with a sealed payload and no listing subject is a ping: a short line of text, encrypted to the recipient, durable on the DHT, delivered by signal (#213) when the recipient is present and picked up on load when not. Presence is #213's `ping` health-check, which is built and tested. Put together, this is a basic signalling channel: A sees B is present, sends a line, B gets it live.

It is described here as exactly that, so nobody mistakes it for the messaging service and nobody builds threading on it. Its limits are the messaging service's reasons to exist: every ping is permanent (append-only; retraction hides, it does not remove); the pattern of who pinged whom is public metadata even though the content is sealed; and there is no threading, ordering, or typing indication. Acceptable between peers who have both opted in, for alpha.

**Marker and knock coexist.** The messaging design (`chat-system.md` section 5) also begins a conversation by responding to a listing, but there the response carries an address salt and a sealed shared secret and opens a private channel. The two are different intents at the same moment. A marker is public interest: "I would like to talk, here is how to reach me." A knock is private first contact: "open a sealed channel." In MVP only the marker exists. Once the mailbox lands, a member may do either, and a marker may carry the invitation contents in its sealed payload for a member who wants both. `chat-system.md` section 12 step 5 asks the exchange layer for a response-to-a-listing event carrying the listing hash; the marker is that event.

**Follows and reactions.** A one-way marker on a peer, with no listing subject, is a follow; a mutual pair is the connection section 12 already describes. An emoji reaction is `kind: Reaction` with the listing as subject, the author as recipient, and the emoji as an unsealed payload, since reactions are public by nature. The `SubjectNotifications` link already makes everything about a listing readable by anyone walking it. Neither changes the entry shape; both are further kinds. The rate cap will want to be per kind before reactions ship, since ten a day is low for them.

**A future indicator.** The connection count is a meaningful N for a member in a way that "known agents" is not: "3 of your 12 connections are online" rather than "12 peers known." That is a separate question from the network-reachability indicator in #215, which answers "is my node on the network"; this would answer "can I reach the people I care about." It comes after the primitive exists and is noted here only so the two are not conflated.

---

## 13. Relationship to #51

#51 describes a comprehensive notification system across five categories and four phases. This spec deliberately narrows it to one primitive and one first consumer, so that the on-DHT contract is right before anything broad is built on it. What #51 asks for, and where it lands:

| #51 item | Here |
|----------|------|
| Notification entry and zome | section 4; v1 |
| Real-time delivery under 2s | #213 signal layer; v1 |
| Notification history | the durable queue is the history; v1 |
| Administrative notifications (status changes) | added to section 2 as a consumer; individual-addressed, admin as actor. All status changes can go by DHT: suspension is gate two in the membrane design (`MEMBRANE_MANAGEMENT.md` section on two gates), enforced by coordinator guards and the UI, not by revoking network admission, so a suspended member remains a reading node and sees the notice on next launch via the suspended-state screen. **Suspension and rejection should also go by the external relay**, because the member may never open the app again and the notice wants a durable off-app record carrying the appeal route. That makes the joining service's email integration (#165) important for notifications, though not load-bearing. Note for review: the integrity zomes do not check author status, so suspension is not enforced at validation. |
| Admin join-request notifications (#121) | section 2; second consumer, with flagging |
| Exchange notifications | future consumer once the exchange process exists; the entry shape accommodates it |
| Notification preferences and filtering | deferred; a recipient-authored mute per `kind` is cheap later and is not in v1 |
| System announcements to all members | a third addressing shape, and the shared-anchor pattern serves it: an `announcements` anchor admins write once and every member reads on load. One write, durable, reaches members who join later. Not fan-out by ping, for the reasons section 5 gives. Listmonk is for reaching members who are not opening the app, which is a different job. Deferred past v1. |
| Batching, summarisation, templates, scheduling, analytics | deferred; Phase 4 in #51 terms |
| Bell icon, dropdown, history view | presentation, kept deliberately light in v1 |

The time estimate in #51 (20 to 30 hours) is for its full scope. The first consumer here is smaller than that.

---

## 14. Suspension enforcement: what the substrate allows

This is adjacent to notifications rather than part of the primitive, but the suspension-notice question in section 13 depends on it, so it is stated here once.

**The platform fact.** Membrane proofs are checked at genesis, once. Holochain has no mechanism to revoke admission after an agent has joined, which is why the membrane design calls admission "gate one" and stops there. Validation-level status checks are not the answer either: validation must be deterministic, and "is this author suspended" changes over time, so an entry valid when written could be judged invalid by a later validator.

**What R&O does today.** Suspension is the administration zome's `Status`, enforced by coordinator guards (`check_if_entity_is_accepted` and kin) and by the UI. The integrity zomes do not check author status. A suspended member remains a node: they read, they gossip, and a modified client could write.

**Three measures, together, are the MVP posture:**

1. **State the limitation** in repository documentation, so the capability is understood as it is.
2. **hc-auth `blocked` on suspension.** The joining service (#165) integrates hc-auth-server with agent states `pending`, `authorized`, `blocked` and an `/api/transition` endpoint. If the admin suspend action also transitions the agent to `blocked`, the bootstrap and signal servers stop serving them: no new peer discovery, decaying connections, drying gossip. Not a clean cut, since local cache and lingering direct connections remain, but real degradation of gate one, and off-DHT so determinism is not an issue.
3. **Accepted-only filtering on reads.** Honest nodes do not show content from suspended agents. The `get_accepted_entities` index exists; read paths that consult it before returning a listing make a suspended member's writes invisible even if their client bypassed the coordinator guards. This is the same shape as the personal block layer in section 7, applied by the community rather than the individual.

The first is this section. The second is a line in #165's scope. The third is a coordinator change across read paths and warrants its own issue.
