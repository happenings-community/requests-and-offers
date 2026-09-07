# Exchange Publication and Consent

**Status:** Design note, open for frame-check. Not for merge.
**Version:** 0.2.0
**Scope:** What becomes public when an exchange happens, who decides, and where the record
lives across two DNAs.
**Relates to:** `documentation/requirements/post-mvp/exchange-process.md` (the design of record
for the exchange process itself), `documentation/architecture/chat-system.md` v2 (PR #188),
`documentation/architecture/hrea-integration.md`, issue #90.

This note does not restate the exchange process. It settles one question that process leaves
open, records what the bundled hREA build can and cannot do (§5), and flags one contradiction
between two existing documents (§7).

---

## 1. The conversation is the seam between two DNAs

R&O runs two cells: its own DNA, and hREA. Negotiation lives in the first — messages in derived
mailboxes, unfindable by anyone but the two correspondents (`chat-system.md` §4). The economic
record lives in the second, where ValueFlows models proposals, commitments and events in a form
other systems can read.

The conversation is where those meet. A pair talk privately, and at certain moments they may
choose to write something to the shared record. Every such moment is a crossing from one DNA to
the other, and from private to public.

That is why publication consent belongs here rather than inside either DNA's logic. Neither
cell knows about the other; the client stands between them, and the decision to cross is the
member's.

**In MVP there are no mailboxes.** A member responds to a listing with an interest marker
(`NOTIFICATION_ARCHITECTURE.md` §11), which carries a sealed contact route, and the pair then
talk off-app. Off-app negotiation is more unwritten than a mailbox: nothing reaches any DHT,
not even ciphertext. The two-state model in §3 holds for MVP unchanged; what differs is that
the marker itself is written and public, which §3 now records.

## 2. An exchange is two reciprocal flows

From the ValueFlows specification, Exchanges:

> from one Agent's viewpoint, the exchange may be a Purchase, from the other Agent's viewpoint,
> it might be a Sale. From the neutral viewpoint, it is an exchange of resources, with usually
> at least two flows of resources, from different directions.

> To be included in an exchange, a flow must have a different provider agent and receiver agent.

> an exchange implies at least two transfers with reciprocity.

So an exchange is not one event with two parties attached. It is **two flows in opposite
directions**, each with its own provider and receiver. In R&O's terms: Marco provides the design
work in one flow; Soushi provides the backend pairing in the other. Two `EconomicEvent`s.

Issue #90 already specifies the commitment pair on the same shape — a primary commitment with
`action='work'` from the offerer, and a reciprocal with `action='transfer'` from the requester.
This note is consistent with that rather than replacing it.

**Each party records what they gave.** That falls out of the model rather than being imposed on
it: the provider of a flow is its natural author.

### 2.1 Why not "I delivered" plus "I received"

An earlier version of this reasoning proposed two events about the *same* flow — provider
records delivery, receiver records receipt — as a route to corroboration. The specification
rules that out for the thing R&O mostly does. From Actions, `deliverService`:

> A new service is produced and delivered as output of a process. **A service implies that an
> agent actively receives the service at the same time as it is delivered.**

Receipt is simultaneous with delivery by definition, so there is no separate receipt event to
author. The `inputOutput` behaviour repeats it: "services imply delivery as they are created."

Recorded because it was tried, so nobody proposes it again.

### 2.2 What reciprocity does and does not establish

Careful wording, because it is easy to overclaim.

Two flows recorded, each authored by the party who provided it, establishes that **both parties
independently asserted their own half**. Neither could have written the other's, so neither
half is a claim about someone else.

It does **not** establish that either flow happened. Two people can record a reciprocal
exchange neither performed, and it is indistinguishable from a real one. Reciprocity
corroborates mutual assertion, not delivery.

And it holds **only when each half is self-authored**. Nothing in hREA prevents one agent
writing both (§5.2), so a complete-looking pair can have a single author. Completeness alone is
not sufficient; the authors must be checked.

An exchange with one flow recorded is visibly incomplete — but the *reason* is invisible.
Missing second flow could mean non-delivery, a privacy choice (§4), or forgetfulness. The data
cannot distinguish them, which constrains any reputation model (§6).

### 2.3 Gifts are the exception, by design

> We also support non-reciprocal one-way transfers, such as in a gift economy.

R&O's *Free/Pay it Forward* medium is exactly this: one flow, no reciprocal half, nothing to
corroborate. That is what a gift is, not a defect in the record.

## 3. Two levels of privacy

An exchange is either unwritten or public. There is no third state, and §4.3 records why a
middle level was considered and rejected.

**Private.** Nothing is written to any shared DHT. The agreement lives in the correspondence —
messages in derived mailboxes, signed by their authors, timestamped by their own chains,
unfindable without the address salt. Both parties hold a record; the network holds nothing.
Nothing to build and nothing to enforce, because there is no write to gate.

The structured record here is the **proposal card in the thread**, which comes from the
proposal builder and carries terms, medium, quantities and both parties' acceptances as
separate signed messages. A private agreement is not prose; it is a structured message.

**Public.** The R&O `Agreement` entry (§4.1), plus whatever hREA flows both parties consent to
(§4.2).

**The marker sits before both states.** An interest marker is written to the shared DNA and
linked from the recipient's key, so who responded to whose listing is visible to every member.
It precedes the exchange and is not part of its record, but it means the promise quoted from
`chat-system.md` §5, that isolation protects entirely those exchanges that never reach
agreement, does not hold in MVP: asking is visible even when nothing follows. The knock
restores it post-MVP for members who want private first contact. `chat-system.md` §11 must
say this to members.

## 4. Publication is a series of decisions, not one

Each write makes something public, and consent could reasonably differ at each:

| Stage | Where it lives | Public? |
|---|---|---|
| Listing | hREA `Proposal` + `Intent`s | **Always.** A listing is an advertisement. Already built. |
| Agreement | R&O `Agreement` entry | By consent |
| Obligations | hREA `Commitment` ×2 | By consent |
| Delivery | hREA `EconomicEvent` ×2 | By consent, per flow |
| Completion | R&O agreement completion fields | By consent |

**Both parties, at every stage.** Neither can publish for the other, and neither can override
the other's refusal.

**Refusal needs no reason.** Asking someone to justify not publishing is asking them to justify
a preference for privacy, which inverts the default this project holds.

**Disagreement resolves to private.** Publication is irreversible on this substrate and
non-publication is not: anyone can change their mind about a private exchange later, and nobody
can retract a public one. The asymmetry of harm decides it. It also removes a pressure surface
— a peer who is uneasy declines rather than argues, and the outcome is the same as silence.

**A member default, with a per-stage override.** A default alone gets set once, defensively,
and never revisited. A per-stage prompt with no default nags. Default plus override means the
common case is one click and the unusual case is still available. The other party's default is
not visible and need not be: publication requires both, so a member only answers for
themselves.

### 4.1 The R&O `Agreement` is the attested vehicle

**Mutual attestation already exists in R&O's own zome, and does not need countersigning.**

The `exchanges` zome removed in the MVP simplification (recoverable at `ab462063^`) works like
this:

- `Agreement` carries the agreed terms plus four completion fields: `provider_completed`,
  `receiver_completed`, and a timestamp for each.
- `create_agreement` links the agreement to a provider and a receiver, derived from the
  originating response's responder and original poster.
- `mark_completion` takes a role, then checks `check_if_agreement_provider` or
  `check_if_agreement_receiver` **against the calling agent**, and refuses if the caller is not
  that party. Completion sets the shared status only once both have marked.

So it is one shared record carrying two independent, identity-checked assertions, with mutual
completion derived rather than stored separately. That is the pattern to revive.

Two things to carry forward if it is, and one deliberate posture to keep:

- **Coordinator checks are polite, not cryptographic, and that is the design.** The identity
  check lives in the coordinator, so a swapped coordinator bypasses it. This is the posture
  adopted across R&O (`NOTIFICATION_ARCHITECTURE.md` §14): honest clients enforce, receivers
  filter, stewarding handles the persistent case. Integrity-level validation is a later
  hardening for the economic record, not a precondition for reviving the zome.
- **`update_agreement_status` accepts either participant or an admin** setting status
  unilaterally, which walks around the `mark_completion` discipline entirely.
- **`// TODO: Verify response status is Accepted`** is unclosed, so an agreement can be created
  from an unaccepted response. The originating response is now the interest marker, and its
  acceptance is a reciprocal marker: a mutual pair is a connection
  (`NOTIFICATION_ARCHITECTURE.md` §12). `create_agreement` should require `is_connected` in both
  directions between provider and receiver, which closes this with a primitive that exists.

### 4.2 hREA carries the economic flows

Commitments and economic events go to hREA, because that is what makes the record legible to
other ValueFlows systems and what a reputation model would eventually read. They are separately
consented (§4).

### 4.3 Why there is no private-but-attested middle level

Considered, and rejected. The idea was an entry binding both parties that a steward could see
in a dispute without it being public.

- R&O's `Agreement` has no visibility attribute and defaults to **public**. It is linked from a
  global `exchanges.agreements.all` anchor, which only makes sense for public discovery.
- A genuinely private entry is not gossiped, so the counterparty could not read it. Two private
  entries are two unlinked personal records, not a shared one.
- Making it work would need key wrapping or escrow **at creation time**, for a dispute that
  will probably never happen — which is exactly the standing-access surface
  `STEWARDING_MANAGEMENT.md` §2 refuses.

A separate private entry holding the agreed terms was also considered. It adds nothing
evidential over the correspondence, which is already signed, timestamped, immutable and
disclosable under §3 of the stewarding note. The structured record can be the proposal card.

And the dispute case is already handled: a steward asks, and the member discloses. Where one
party might disclose selectively, two independently disclosed copies of the same conversation
are comparable, because both hold the whole thread and every message is signed by its author.

## 5. What the bundled hREA can actually do

**Read this before planning any hREA work.** Established by unpacking `workdir/hrea.dna` and
reading the source at `h-REA/hREA`, and it is not what the GraphQL schema implies.

### 5.1 It is a persistence layer, not an economic engine

One coordinator zome, one integrity zome, 92 externs. All of them `create_rea_*`, `get_*`,
`update_rea_*`, `delete_rea_*`, plus anchor links and update chains. `helpers.rs` is 2770 bytes
containing `merge_fields`, `update_link` and `delete_links` — the entirety of the cross-cutting
logic.

`rea_recipe_exchange.rs` is CRUD plus an anchor link. It does **not** generate agreements and
reciprocal commitments the way the ValueFlows Recipe Exchange concept describes.

So hREA stores ValueFlows shapes. Every relationship between them, every sequencing rule and
every consent check belongs to R&O. **The bridge is orchestration, not wiring.**

### 5.2 No fulfilments, no satisfactions

There is no `rea_fulfillment.rs` and no `rea_satisfaction.rs`. Not omitted from the build —
absent from the source. So there is no native way to record that an event fulfilled a
commitment, or that a commitment satisfied an intent.

R&O must hold those relationships itself, which is the same frontend-side cross-DNA resolution
already in use for proposals. `agreedIn` on both sides ties them to a common agreement, which
is a weaker association than a fulfilment link but is what exists.

This was invisible from `@valueflows/vf-graphql`, which describes the full specification rather
than this implementation. **Always check the DNA, not the schema.**

### 5.3 It does not enforce mutual consent

`CommitmentCreateParams` and `EconomicEventCreateParams` both take `provider: ID!` and
`receiver: ID!` as plain agent references, with no signature and nothing binding either to the
calling agent. Any agent can create a commitment or event naming any two agents.

Whether hREA's zome validation refuses this is **unverified** (§8). It is the single
highest-value open question, and a small Sweettest would settle it.

What follows either way:

- **Nothing R&O publishes about you happens without your consent.** Enforced by the client for
  hREA writes, and by the coordinator for the R&O `Agreement` (§4.1).
- **Anything published about you by someone else is attributable to them.** Every action
  carries its author's signature. A claim is not a forgery, and a fabricated commitment names
  its fabricator.
- **A party's obligation is established only by a flow they authored themselves.** Read it as a
  rule for interpretation rather than a restriction on writing.

Same posture as the flagging model: accountability rather than prevention, on a substrate where
prevention is not available.

### 5.4 Countersigning would enforce it, at a price

Holochain has native countersigning: two agents lock their chains, reach consistency, and
commit one shared entry to both chains atomically, with validation run from both perspectives.
That is substrate-enforced mutual consent.

It is not available in practice today:

- **Unstable and disabled by default** in 0.4 and newer. `unstable-countersigning` is a feature
  flag in `crates/holochain/Cargo.toml` composing `hdk`, `holochain_zome_types` and
  `holochain_conductor_api`, not in `default`. Unchanged through 0.7.0.
- Enabling it means **compiling a custom Holochain binary** — no standard releases, no
  Launcher, and R&O owns the build.
- All counterparties must be online for the whole session, with their **source chains locked**.
- Only create-entry and update-entry can be countersigned; links cannot.
- No built-in retry after a timeout.
- hREA does not use it: no session, preflight or signer list anywhere in its GraphQL.

Recorded as the documented upgrade path if conventional consent proves insufficient. It would
have to be an **R&O-native** entry, since hREA's API has no countersigning surface.

## 6. Reputation is out of scope, and here is what constrains it

Not built, and not to be designed here. But the model above constrains it.

- **A single mean figure is neither representative nor compassionate.** It flattens
  circumstance and says nothing useful about diversity of contribution.
- **Self-authored flows prove consent, not performance** (§2.2). What makes a record meaningful
  is that the reciprocal flow exists, authored by someone with nothing to gain from writing it.
- **Complete reciprocal cycles are the meaningful unit**, not individual events.
- **Incompleteness is ambiguous.** A missing second flow could be non-delivery, a privacy
  choice, or forgetfulness, and the data cannot distinguish them. Counting incompleteness
  against people would punish privacy.
- **Private exchanges earn nothing**, and that is the honest cost. It must be visible at the
  moment of choosing, not discovered afterwards.
- **Gifts need separate treatment** (§2.3). Counting an absent reciprocal half against anyone
  would penalise generosity.

## 7. Contradiction to resolve

**`exchange-process.md` §Security, "Privacy Model (Critical)"** states that all exchange data —
agreements, commitments, economic events, fulfilments, reviews — is private to the two parties,
enforced at zome level via private entries and capability tokens, with administrators excluded
by design.

**`chat-system.md` §5** states that an hREA Agreement names its provider and receiver and is
public by design, because fulfilment tracking and reputation depend on it.

**This note** says both are partly right and the choice belongs to the members: private by
default, public by mutual consent, per stage.

**`NOTIFICATION_ARCHITECTURE.md` §11** adds a fourth voice: the response that begins an
exchange is public regardless. Consent per stage applies from the agreement onward; the
marker before it is a public act by design.

Two observations for whoever resolves it:

- The Privacy Model's enforcement mechanism may not be achievable. hREA is a third-party DNA
  and its entry visibility is not R&O's to set. If exchange data must be private, the only
  reliable way is not to write it there — which is what §3 proposes.
- The `conversations` zome named there as an enforcement mechanism **does not exist** and is not
  planned under `chat-system.md` v2. Correspondence privacy comes from derived addressing.

Related: `UIExchangeAgreement` in `ui/src/lib/types/ui.ts` survives from the removed zome. It is
**not** a stale artefact to delete — it is the shape of the mutual-completion mechanism
described in §4.1, and it should be reunited with that zome rather than tidied away.

## 8. Open questions

- **Does hREA validation bind `provider`/`receiver` to the calling agent?** (§5.3) Unverified.
  A Sweettest with two agents, where Alice creates a commitment naming Bob as provider, settles
  it. Highest value, smallest test. Call `create_rea_commitment` on the `hrea` coordinator zome
  directly.
- **Self-dealing.** `provider === receiver` has no legitimate use here and should be refused at
  the R&O layer, or flagged.
- **Both flows authored by one agent** (§2.2). Distinct from self-dealing and not caught by the
  same check: the parties differ but one wrote both halves. Detectable by comparing each flow's
  author to the side it asserts.
- **Which action each Medium of Exchange maps to.** Issue #90 proposes `work` for the primary
  and `transfer` for the reciprocal. `deliverService` may fit service exchange better, and
  `work` names only a provider by the specification's own definition. The specification expects
  its action set to be extended, and asks that extensions be defined in a formal vocabulary so
  the meaning is shared.
- **Where fulfilment and satisfaction relationships live** (§5.2), given hREA has neither.
- **Where the publication setting lives.** A member preference, but it is governance-adjacent
  and Anita may have a view on how it is presented.
- **The behaviours-by-action matrix is a PNG** on the ValueFlows Actions page. The
  machine-readable canon is the RDF turtle file, unread. Definitions quoted in this note are
  from source; behaviour details are not verified.

## 9. Evidence base

Read in full unless noted.

- ValueFlows specification, **Exchanges** (`valueflo.ws/concepts/exchanges/`): the independent
  viewpoint, reciprocity, one-way transfers in a gift economy.
- ValueFlows specification, **Actions** (`valueflo.ws/concepts/actions/`): `deliverService`,
  `work`, `transfer`, and the `inputOutput` behaviour. The behaviours table is an image and was
  not read.
- Holochain developer portal, **Countersigning** (`developer.holochain.org/concepts/10_countersigning/`),
  and `crates/holochain/Cargo.toml` on the default branch for the feature flags.
- **`workdir/hrea.dna`**, unpacked: one coordinator zome, one integrity zome, no properties.
  92 externs enumerated from the wasm.
- **`h-REA/hREA`** source at `dnas/hrea/zomes/coordinator/hrea/src/`: one file per entity, no
  fulfilment or satisfaction, `helpers.rs` at 2770 bytes, `rea_recipe_exchange.rs` CRUD-only.
  `happ-0.4.0-beta` is 20 days old and is a pre-release; `0.3.4-beta` is tagged Latest.
- **`@valueflows/vf-graphql`** schemas as installed: `agreement.gql` (Agreement carries name,
  created, note — no parties), `bridging/agent.commitment.gql` and
  `bridging/agent.observation.gql` (`provider: ID!`, `receiver: ID!`).
- **`ab462063^`** — the removed R&O `exchanges` zome: `agreement.rs` in both coordinator and
  integrity, read in full.
- **`ui/src/lib/services/hrea.service.ts`** and `ui/src/lib/graphql/`: proposals, intents,
  agents and resource specifications implemented; agreements, commitments and economic events
  not yet added.
- **`workdir/happ.yaml`**: two roles, both `clone_limit: 0`, hREA on network seed
  `hrea_requests_and_offers_alpha`, no properties, no membrane proof.
- **Issue #90** and `documentation/requirements/post-mvp/exchange-process.md`.
