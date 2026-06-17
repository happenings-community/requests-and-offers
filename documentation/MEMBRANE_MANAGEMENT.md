# Joining Membrane Management — Design & Scope

**Version:** 0.2.0 · **Status:** design, not built — proposed for community discussion and agreement before implementation.
**Companion:** `community-guidelines.md` — the Agreement clauses the membrane reads against, and that a hard refusal cites by clause.
**Relates to:** the R&O joining-service architecture (#125) and the agreed joining flow (#165) — Sacha's Path B with the joining service's `auth_methods` = `[invite_code]`. Admission is decided **pre-key** in R&O's own app; an approval issues an email-bound, single-use invite the applicant joins on, and the membrane proof is signed at join.

> This document is written in two layers — **scaffold** (invariant structural guarantees) and **content** (plastic, community-owned norms) — so it can be revised often without being redesigned. Section headings carry their layer tag; see *Maintaining this document* at the end for what that means for versioning and where each layer lives.

---

## Purpose

This describes how the joining membrane handles an application to Requests & Offers: how it reads it, what the admin sees, how a decision is made and recorded, and how someone who isn't admitted is invited to come back. The R&O admin dashboard is the single surface where humans make the call.

Optional **admin support tooling** may assemble and enrich the packet an admin reviews, and draft suggested messages for a human to edit and send. It never decides, and the membrane works completely without it. That additive layer is deliberately scoped separately (see the *admin support tools* issue) so the core joining membrane stands and ships on its own.

## Philosophy: the soft membrane *[content]*

The membrane is relational. The default posture is a presumption of trust and welcome — connection over credentials. Where there is no connection yet, the answer is "we don't know each other yet — here's how we could." The membrane's job is to make warm welcome easy and exclusion deliberate, specific, and rare.

Culture is dynamic; the guarantees that keep it safe are not. A community is not a fixed thing — who it is, what it values, who it recognises as its own all shift as it grows and learns about itself. The membrane is built to move with that, not to act as a monolithic idea of belonging. Its norms — the guidelines, the reasons we decline, the language we watch for — are meant to be revised by the people inside it; the membrane gets to evolve toward who the community is becoming. What does not move is the structural floor underneath: signals only ever enquire, never refuse; humans make decisions and only as a signed, reasoned act; the record and the message stay separate; and a hard refusal must cite a specific clause it cannot quietly stretch. That fixed floor is what makes the membrane plasticity safe: norms can soften, sharpen, and change shape without the door's hinges ever loosening.

A hard refusal, turning someone away rather than inviting them closer, is a nuclear option behind a spring-loaded guard. It exists, but it is used only when a human has read the application and judged that the person's presence would genuinely disrupt the peace of the network.

## Guiding principles *[scaffold]*

Everything below follows from seven principles. If a future edge case isn't covered here, these answer it.

1. **Signals enquire, never refuse.** Deterministic and semantic checks produce flags that mean "a human should look here," never "reject." Only a person closes a door, and only as a signed, reasoned act.
2. **Friction matches consequence.** The warmer and more reversible the action, the lower the ceremony; the more final and consequential, the more deliberate engagement it requires. Welcoming is one tap; hard refusal is guarded.
3. **Describe the application against the criterion, never characterize the person.** "Commercial framing, no connection signal" is honest, auditable, and fine for the applicant to read. "Reads like a spammer" is none of those. This single rule produces honest, kind, and disclosable records at once.
4. **A real path where there is one; clear closure where there isn't.** Reengagement is offered only when it would genuinely change the outcome. False hope is its own quiet unkindness.
5. **Deterministic and human-curated, never model self-reinforcement.** The versioned community reference docs the membrane checks against are grown by people and remain human-readable. The system improves without silently learning the community's blind spots.
6. **Agent-centric.** The applicant owns their record; the community owns its record of its own decisions. There is no custody of someone else's data.
7. **Decisions are accountable to the membership.** The *shape* of decisions — the pattern, never the personal data — is reviewable by the community the membrane serves, not only by those who make the calls. The community can audit *how* its boundary is held without exposing *who* was turned away. This is Ostrom's monitoring principle: those who maintain the boundary are accountable to the commons.

## How the membrane reads an application *[scaffold + content]*

Two layers, in order.

**Deterministic checks** run first: presence and length of answers, keyword matches, email verification status. They are fast, exact, and fully auditable — anyone can read why a flag fired. This is the only layer required for the Stage 1 mock.

**Local semantic enrichment** (Stage N) layers meaning on top, to catch what literal keyword matching misses — paraphrase ("buyers" where the keyword list has "sell"), and answers written in a second language. It runs on a local model so that no member data ever leaves for an external or cloud LLM. This is a hard privacy constraint, not a preference.

The membrane reads against three dimensions, drawn from the joining guidelines: a **genuine reason** to join, **mutual-aid orientation** (rather than commerce or self-promotion), and **connection** (relationship and shared context). These are kept as independent signals — never fused into a single score, and never shown as a radar polygon where area is a single score in disguise. The admin sees evidence-linked readings, not a number. We look to identify reasons to welcome and identify connection for a safe network environment, while actively avoiding bias loops, blind spots and arbitrary exclusion.

## What the admin sees *[scaffold]*

A single queue, ordered by arrival. Two greetings within it:

- **Green** marks an application with a *corroborated* connection — something the community side confirms (a valid invite, a member vouch, a verifiable shared context), not an applicant's claim to know people. Green says "oh hi, we know you — welcome," and the admin may move a little faster here. A green admit is still a signed decision like any other (see *Fairness by construction*): committing it records *what* corroborated the connection — the specific invite, vouch, or shared context — never a general impression. "Move a little faster" is not "wave through on a feeling."
- **Everything else** carries no badge at all. The absence of green is not a mark against anyone; it is the warm, default-attention state — "we might not know you yet, so let's get to know each other before we assume to say yes." These applications are read in full.

Keeping both in one queue is deliberate: separating them into two would quietly turn the unhighlighted set into a reject pile, which would land hardest on sincere applicants who phrase themselves unusually — exactly the people the membrane should protect.

One narrow exception to positive-only marking: a **red flag** for content that violates the guidelines on its face — a slur, a threat, doxxing. Red is reserved for safety, not scope. Spam-indicative or commercial language does not get red's moral weight; it sits in the ordinary "read this fully" state. Red still means *enquire, urgently* — never auto-reject — which is what protects the false-positive case (someone describing harm done to them, e.g. "people kept calling me [slur]," trips a filter but a human reads the context and sees a victim, not an abuser).

Where deterministic or semantic checks pinged, the badge layer stays silent, but the **evidence resurfaces inside the full read** — the phrase that pinged, framed as something to ask about, never as a verdict stamped on top.

An **activity mask** enforces engagement before action, in two stages. First, the answers must be *opened* — the coded reasons aren't even selectable from a closed card, which stops the reflex of pattern-matching a verdict off the queue preview. Second, committing a decision requires both a coded reason *and* a linked piece of evidence — a specific phrase or answer the reason points at. Only then does the commit button unlock. This holds for admits and declines alike: a green admit links its corroboration; a decline links the answer it read against. You can't link evidence for a gut feeling, which is what enforces "describe the application against the criterion, never the person" at the *moment of action* rather than only as a writing rule. Friction stays proportional — lighter on the green fast-track, full on everything else, and at its strongest before a hard refusal.

## Deciding: the two tiers of "no" *[scaffold]*

There are two genuinely different kinds of "no," and they should feel different.

**The reengagement decline** is warm and low-ceremony. It is for people who we would welcome as members but the organisation is not ready yet — we're paused, we're not open, we haven't met you. It always points to a real path back.

**The hard refusal** is the guarded option. It is for content that breaches the safety guidelines. It is final, carries no reengagement path, and is the highest-friction act in the flow — and, at any volume, it requires a **second admin's co-sign** before it commits. The most final, least reversible act should not be unilateral, and one skewed read does the most harm here. Reengagement declines stay single-admin and low-ceremony.

In both cases, refusal is an **active, signed human act** on the admin's chain, never a default or a one-click dismissal. The admin selects at least one coded reason (with an "other → write why" option, so a rising "other" count signals that the codes are missing a real category), links it to the specific answer or phrase it bears on (the activity-mask requirement above), and may add a note. That selection is what triggers the outbound message — which a human always edits and sends; any drafting help is a suggestion, never an auto-send. The act records, on the admin's chain, that a human read the application and judged it against a specific criterion.

The record and the message are two different things for two different audiences, and both are kind. The **internal record** carries the code, evidence, and any note — written against the criterion, never about the person, on the assumption it may one day be read by the applicant. The **outbound message** carries the relationship and the path forward. For accountability the act is signed; for the individual admin's protection it may be displayed as "an admin declined," following the established anonymous-display pattern.

## Reengagement: the door that stays open *[scaffold + content]*

Reengagement is not a consolation prize — it is the mechanism. Someone declined as "we don't know you yet" who comes to an event, joins the Moss group, introduces themselves, gets vouched for, now holds exactly the corroborated connection that was missing. The decline is a redirect into the relationship funnel, and the funnel produces the very signal that turns the next application green. The soft membrane, made literal: go build a relationship and come back.

Two constraints keep this honest:

- **Match the path to the reason.** Offer connection-building paths (event, intro, Moss group) when the barrier is "we don't know you." When the barrier is timing (we're paused, or closed alpha), the path is "stay close, we'll let you know" and direction to community spaces in the meantime.
- **Only offer channels you can honor, and scaffold the entry.** An unread DM or an empty events page is false hope wearing a friendly face. And "introduce yourself" is easy for some people and an off-putting wall for others; a pinned welcome thread, a prompt ("tell us what drew you here"), or a named greeter lowers it for exactly those people.

## Decline catalogue *[content]*

*Working content for community / governance agreement.* The codes determine which message and which path are surfaced. The picker offers only the codes valid for the **current community phase** — an admin should never be able to tell someone "we're not accepting" while intake is open. Phase is config, not a code (see below).

| Code | When | Tier | Reengagement | Message intent (draft) |
|---|---|---|---|---|
| `not_currently_accepting` | Intake is paused for everyone | Reengagement | Waitlist + soft connection | Make clear *this isn't about them* — intake is paused, not a judgement. Offer the waitlist as a choice ("want us to let you know when we reopen?"), and meanwhile point to the Moss group and newsletter. |
| `not_yet_connected` | No corroborated connection yet — the default barrier while membership is relationship-gated (e.g. during closed alpha) | Reengagement | Connection paths (event, intro, Moss group) | Mutual framing — "we don't think we've met yet, come say hi in these channels and we can get to know each other." Honest about the messy early phase; that humility is what makes it feel protective, not gatekeeping. |
| `out_of_scope` | Genuinely not what this is for (e.g. commercial), not hateful | Reengagement (gracious close) | **None** (misread recourse only) | "We're concentrating on mutual aid, and this doesn't seem the right fit." Gracious and clear; no false path. Includes a quiet recourse line — *if you think we've misread this, email admin@happenings.community* — a private channel the team engages with or not as needed. Recourse against a fallible read, not a door back in. |
| `safety_violation` | Hateful or abusive content, judged by a human | Hard refusal (second-admin co-sign) | **None** | Brief, final, references the standard without quoting their words back: "Your application doesn't meet our community guidelines on respectful communication, and we won't be moving forward." Cites the specific Harassment clause in the internal record. |
| `other` | A real reason the codes don't yet cover | Reengagement | Admin-specified | Mandatory written reason — there is no message without it. A rising "other" count is the signal that the catalogue is missing a real category. |

**Phase, not code.** The community phase — `closed_alpha`, `capacity_paused`, `beta`, `open` — is configuration, not a decline reason. It frames the *wording* of the timing-related messages and gates which codes the picker offers. This is why "closed alpha" is not itself a code: the *mechanism* of the decline is "no connection yet" (`not_yet_connected`) or "paused" (`not_currently_accepting`); the phase only shapes how warmly the timing is explained. Codes are mechanism-named and durable so they survive every phase change.

**Why `out_of_scope` alone carries recourse.** It is the one decline made on the noisiest signal available — framing — with no self-correcting loop attached (the others have a path back, and safety must not invite re-litigation). Someone with a business background or writing in a second language may wrap a genuine mutual-aid need in commercial language. The recourse line is the quiet escape hatch for a misread; it is deliberately low-commitment ("engaged with or not, as needed") so it stays a pressure-release valve, not an appeals court.

## Fairness by construction *[scaffold]*

The instinct to make the membrane "smarter" via a self-learning loop was examined and set aside, because the obvious version carries three compounding traps: a model that learns from admin decisions also learns the admins' blind spots and amplifies them, laundered as "the AI learned from us"; "got it right / wrong" is not clean ground truth when the model influenced the admin's choice; and at alpha scale there isn't enough data to tune a model anyway.

The design avoids bias structurally rather than by vigilance:

- Because signals only ever enquire, no automated rejection can exist.
- Because every *decision* — admit as well as decline — is a signed act carrying a coded reason and linked evidence, the decision record *is* the bias-audit instrument. You can ask "are we disproportionately turning away a phrasing or background?" *and* "are we fast-tracking an in-group?" — the latter only because admits are logged too, not just refusals. (A bias instrument that logged only the noes would be blind to who gets waved through.) Reviewing that pattern is accountable to the membership, not a private role — see *The mirror* and principle 7.
- Because the spam and safety lists are human-curated and deterministic, the model never eats its own output.
- Because the hard refusal must cite a specific guideline clause, "disruptive to the peace" cannot quietly stretch from "made threats" to "is annoying" or "communicates oddly." The guard protects the button; the cited clause protects the meaning.

### The mirror

The decision record is read forward, periodically, as a **mirror** — a reflection of the shape of recent decisions, not a verdict on any one of them. It surfaces the distribution of codes, the sources of green corroboration, and where "other" is being used. It is read by people, for people; it never feeds the model. What it *can* change is the **human-readable reference set** — keywords, anchors, decline codes — which is principle 5 holding: the membrane gets smarter about itself without the model eating its own output. (This is the same curation loop described under *Stage boundaries*, raised from a single override to the pattern across many.)

It works at two levels, each with a guard:

- **Org level — the membrane evolves toward who the community is becoming.** A rising "other" on a cluster the codes don't cover means add a code; a keyword that keeps catching the wrong people means soften or retire it. The living-membrane part: the org updates its own norms, in human-readable form anyone can audit.
- **Individual level — an admin sees their own lean.** "You decline commercial framing more than the others do." The guard here is *see your lean, don't converge to the mean.* If every admin calibrates toward the average, the panel ends up with one shared blind spot instead of several overlapping ones that catch each other's misses. Variance between admins is the redundancy, not noise to iron out; the mirror should help someone notice an *unexamined* lean, never pressure them to match colleagues.

**Who sees the mirror.** The org-level pattern is **membership-facing** — the community can review *how* its boundary is held, which is the accountability principle 7 names. It shows the *shape* of decisions — the distribution of codes, the sources of green, where "other" is rising — never the personal data behind them. That layer must be genuinely aggregate, not a redacted case list, because in a small community three details can re-identify a declined applicant; and a hard refusal is never individually surfaced. The individual-level lean stays **private to each admin** — self-reflection, never exposure.

One limit the mirror cannot fix, and a governance reviewer must hold: it is a **rear-view mirror**. It shows who applied and what was decided — never who never applied because the framing didn't speak to them, nor the declined who silently never returned. The reengagement funnel surfaces some of the latter; the truly silent stay invisible. So learning purely from the mirror gently optimises the membrane around the population that already self-selects toward it. The standing question that keeps this honest: *who isn't in this picture at all?*

## Data & ownership *[scaffold]*

Agent-centric by design. The applicant holds their own record; the community holds only its record of its own decisions — its own memory of its own actions, not custody of the applicant's personal data. That community record is readable by the membership at the pattern level (principle 7); the personal data behind any individual decision is not.

**Two gates, kept distinct.** The membrane described here is *gate one* — admission into the DHT. Whether someone is an accepted member once inside is *gate two*: the existing in-network acceptance status (the administration zome's per-user `Status`), which already carries the pending → accepted → suspended lifecycle, an immutable revision trail, and admin authority. An invite-admission *feeds* gate two rather than creating a parallel record — an invited applicant arrives already accepted (admit-on-arrival). This document governs gate one; gate two is reused, not reinvented.

**Pre-key, by construction.** Pending applicants have no agent pubkey at triage — the decision is made on an in-app application form, shown when someone opens R&O without an invite, before they generate a key or join. Admission is an approval in R&O's own app that issues an email-bound, single-use invite; the applicant joins on it, the membrane proof is signed at join, and at redemption the new member **binds their own pubkey** to the waiting record — self-binding: they are joining, not being co-opted. No shared auth state is flipped.

**Where the raw application lives.** Because it precedes any agent key, the raw application — email and form answers — begins **off-DHT**, in R&O's own store, the only place it can be at triage. From there:

- A **declined** applicant's raw data stays off-DHT for **30 days**, then is purged. The clock resets if the application is updated, and it is erased sooner on request. (UK GDPR sets no minimum retention; this is a purpose-justified period, stated in the privacy notice.)
- An **accepted** applicant's raw data **graduates onto the member's own source chain** as a private entry, authored by the member at join; the off-DHT copy is then purged. The member holds their own joining record. Admins read it only through a read-only function the member **grants** them under the Community Agreement — a capability that returns data, commits nothing, and never authors under the member's identity. Access is online and revocable: the member stays in control. This keeps "no custody of someone else's data" literal — the member holds the data; admins are let in by the member's grant.

**The durable audit is non-PII.** What persists in the DHT for accountability is the decision record — the acceptance status, who approved, when, the coded reason, and an opaque reference — never the email or the answers. The bias-audit *mirror* runs off these records, never the raw applications.

## Corrections to the earlier joining proposals

This design has moved through two earlier mechanisms before settling on the current one. Both are recorded here so the trail is visible and neither is re-proposed without its context:

- The joining mechanism is `auth_methods` = `[invite_code]`, **pre-key** — Sacha's Path B unchanged at the membrane gate. An earlier proposal used `hc_auth_approval` (a post-key admin gate, where the applicant installs and waits `pending`); a later one used `delegated_verification` (R&O administering its own OTP and vouching per-agent). Both were set aside: `delegated_verification` had R&O build an OTP, hold a partner credential, and sit in the join path for no gain over the built-in primitives; `hc_auth_approval` is post-key, which contradicts this membrane's pre-key model — the decision is made on an in-app application form, before any agent key exists. With `invite_code`, an approval issues an email-bound, single-use invite the applicant joins on: post-review for open applications, admit-on-arrival for warm invites. The membrane proof is signed at join; pending applicants have no pubkey at triage.
- The raw application starts off-DHT (pre-key); on acceptance it graduates to a private entry on the member's own source chain — admins read it by the member's grant — and the off-DHT copy is purged. A declined application is purged from off-DHT after 30 days (clock resets on update, erased sooner on request). See *Data & ownership*.
- Matching is out of scope for this membrane (a later integration stage); the membrane is about welcome, not pairing.

## Stage boundaries & open dependencies

**Stage 1 (the design-review mock)** is honest and concrete: deterministic checks, the admin surfaces (single queue, green highlighting, evidence on read, the two-stage activity mask with evidence-linking), the signed decision record for *every* action, the two-tier decision flow, and the decline catalogue. The semantic layer is described here as design, not implemented — and the mock should say so plainly rather than pretend the keyword list is clever.

**Stage N (real deployment)** adds the local semantic enrichment and the human-curated reference-set ("curation loop"), where an admin override prompts the question "should we add this to our aligned exemplars, or refine an anchor?" — improving the human-readable reference set, never the model weights. The *mirror* (above) is the periodic, pattern-level face of this same loop.

**Scaling note.** The single-queue, read-everything-in-full posture is suited to alpha volume; at higher volume "read everything" breaks, and the temptation is to skim the non-green — the worst place to cut, since that is where the unusually-phrased people sit. Invert it instead: because a green admit now carries *cited* corroboration, green can take the lighter review (the work is already named and logged), which frees full human reads for the non-green — protection preserved where it is most fragile, not relaxed there. Two further measures hold under load: a hard refusal requires a second admin's co-sign (above), and the governance-review role rotates so the audit itself isn't captured by one lens.

Open dependencies, in priority order:

1. **Connection corroboration source.** Green-as-connection is the keystone, and it depends on R&O exposing a vouch or invite signal — now doubly load-bearing, since a green admit must *cite* that corroboration to commit (see *What the admin sees*). If that signal isn't wired yet, green ships as "aligned" first and earns "connected" once it exists. *Confirm before this feature becomes load-bearing.*
2. **Local model choice.** Load-bearing for accuracy, multilingual coverage, fairness across phrasings, and portability — similarity scores are not comparable across models, so anchors and any thresholds are coupled to the specific model. Treat thresholds as model-specific config; re-validate if the model changes; name the model as an explicit dependency.
3. **Where the raw application and the decision record live** — resolved in *Data & ownership*: the non-PII decision record on the append-only chain for audit; the raw application off-DHT at triage, then graduating to the member's own chain on acceptance. One mechanism to confirm with Sacha at the frame-check — the same constraint as flagger-identity confidentiality: that member-granted read access is the right way to hold restricted member data, rather than any other in-DHT scheme.
4. **A codified scope / mutual-aid clause.** `out_of_scope` rests on a "this is for mutual aid, not commerce or self-promotion" expectation that the current guidelines don't yet state as an explicit clause. Add one when the Community Agreement is next versioned, so `out_of_scope` can cite a clause the way `safety_violation` cites Harassment.

---

## Maintaining this document

### Scaffold and content

The document is two layers, and the split decides what gets versioned, where each part lives, and who edits it.

**Scaffold (invariant).** The structural guarantees — they change rarely and deliberately; a change here is a MAJOR version event everyone should notice. Developer-and-design territory; lives with the code.

- Signals enquire, never refuse.
- A human decides, as a signed act on their own chain; every decision (admit and decline) is logged.
- The record (full, internal) and the message (redacted, applicant-visible) stay strictly separate.
- A hard refusal cites a specific clause it cannot stretch, and requires a second admin's co-sign.
- Decisions describe the application against the criterion, never the person.
- The pattern of decisions is reviewable by the membership; individual applications stay agent-owned and private.

**Content (plastic).** The cultural material — meant to move; a change here is a MINOR version event, the everyday living-membrane churn. Community-and-governance territory; admin-edited.

- The guidelines / Agreement clauses the membrane reads against.
- The decline catalogue, its message intents, and the community phase.
- The keyword and semantic anchor sets.
- The soft-membrane wording itself — values content, revised deliberately.

Section map (where a section mixes both, the mechanism is scaffold and the specific norms inside it are content):

| Section | Layer |
|---|---|
| Philosophy: the soft membrane | content |
| Guiding principles | scaffold |
| How the membrane reads an application | scaffold + content |
| What the admin sees | scaffold |
| Deciding: the two tiers of "no" | scaffold |
| Reengagement | scaffold + content |
| Decline catalogue | content |
| Fairness by construction / The mirror | scaffold |
| Data & ownership | scaffold |

### Versioning

`MAJOR.MINOR.PATCH` — **MAJOR** = a scaffold change (a structural guarantee added, removed, or altered); **MINOR** = a content change (a guideline, decline code, anchor, phase, or the soft-membrane wording); **PATCH** = wording with no normative effect. The number itself tells a reader which kind of change happened.

**Co-versioned with the Community Agreement.** The guidelines the membrane reads against — and that a hard refusal cites — are the Agreement's clauses seen from the admin side; they share the Agreement's version line. This is the same versioned-content primitive R&O already plans for agreements: a member's acceptance lands as a signed `UserProfile` entry carrying the agreements hash + version, and a new version triggers re-attestation (the rules-stale flow). Each decision then cites the Agreement version it was judged against — a `guidelinesVersion` on the decision record — so the audit is anchored in time: a decision made under v1.2 is judged against v1.2, never retroactively against a later version.

### Where this lives

Today the content sits in this doc, in git — fine for review. But the content layer is community-owned and admin-edited, and git is the wrong long-term home for it: a single external dependency, off the sovereign substrate, and demanding git literacy of non-developer admins. The target is **Holochain-native** — the guidelines and catalogue as versioned DHT entries, edited in the admin dashboard, with no external dependency. That closes a loop: a decision record can then cite the actual entry version (its ActionHash) it was decided against, collapsing versioning, sovereign storage, and the audit trail into one mechanism on the same substrate the decisions already live on. The scaffold layer stays with the code.

### Content authoring convention

Each content item is written as a discrete, addressable entry, so it can become a DHT entry unchanged:

- a **stable id** — never reused, never renamed; the id is what a decision cites;
- the **version** it was introduced or last changed;
- plain prose an admin can edit;
- for a guideline, the Agreement **clause** it expresses.

Worked example — a guideline as a content entry:

    id:        gl_respectful_communication
    clause:    Community Guidelines › Our Safety Standards › Harassment
    version:   1.0
    text:      Members communicate gently and respectfully; harassing or abusive content has no place here.
    watch-for: [human-curated slur list], explicit threats, doxxing

The decline codes follow the same rule — `not_currently_accepting`, `not_yet_connected`, `out_of_scope`, `safety_violation`, `other` are permanent ids; the wording and the paths behind each are plastic and minor-versioned. (These are the same ids the admin support tooling and its decision records use, so the membrane content, the record, and any tooling speak one vocabulary.)
