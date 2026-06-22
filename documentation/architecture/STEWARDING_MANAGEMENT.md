# Stewarding Management

**Status:** Working draft — stash. Decisions from design discussion; both encryption encodings empirically verified (see §8 and the verification record, §12); runnable proof preserved at git tag `crypto-feasibility-proven`; not yet frame-checked with Sacha or Holo contact.
**Version:** 0.4.0
**Scope:** How the steward/admin role manages member moderation — disclosure, lapse, suspension, case handling, evidence storage, and admin departure — within R&O's sovereign, in-DHT, non-extractive constraints.

---

## Section map

| Section | Covers | Settled? |
|---|---|---|
| 1. Framing | Domain name, reuse of administration `Status` | Yes |
| 2. Investigation data model | Public backbone + per-case disclosure; no standing reads | Yes |
| 3. `disclosure_request` | Mechanism, consent scope, audit shape | Yes |
| 4. State machine | normal → lapsed → suspended → permanent | Yes (lapsed unbuilt) |
| 5. Authority gradient | Single-admin vs two-admin co-sign | Design settled; two-admin unbuilt |
| 6. Trigger and containment | Flag precondition, whistle-blower pattern | Yes |
| 7. Visibility | Member / counterparty / cohort / public layers | Yes |
| 8. Evidence storage | In-DHT, encrypted, per-case cohort keys, min-two-wrap | Foundation verified (Spike 1); A-vs-B encoding open |
| 9. Case details screen | Findings record, handover, counter | Yes |
| 10. Revocation, departure, re-admission | Fork-and-walk, re-wrap, residual, sanction backstop | Yes |
| 11. Open items | Build targets and decisions deferred | Tracked |
| 12. Verification record | Spike 1 and 2 results, environment, tag | Done |

---

## 1. Framing

The domain is **stewarding management** — stewardship, not policing. The naming is deliberate: it carries the contained-power posture into the vocabulary.

The state layer reuses the existing `administration` zome `Status` mechanism rather than inventing a parallel one. `Status` is already an append-only entry with an immutable `StatusUpdates` link chain, which gives the forensic trail this work needs for free.

## 2. Investigation data model

A steward never reads another agent's source chain. There is no standing admin read of any source chain, and no blanket access to member PII as a condition of membership.

Investigation works on two sources only:

- the **public DHT backbone** — requests, offers, agreements and their links, already shared by design and readable without consent; and
- **per-case member-pushed scoped disclosure** — the member assembles and pushes a scoped bundle in response to a request.

The member's graduated PII stays a sovereign private entry on their own chain; steward access to it is always per-case, never standing. The off-DHT correlation store is narrowed to **admission-audit only** (who was admitted, on what verification, by whom — a GDPR controller record), never an unmasking or anti-evasion tool. An offline bad actor is self-solving: not participating is not a threat, and lapse handles the rest.

## 3. The `disclosure_request`

A steward issues a `disclosure_request`; the member assembles and pushes a scoped **disclosure** in response. The term encodes member agency — the member discloses, the steward does not retrieve.

The request itself is a durable, create-only audit entry, shaped like `JoiningDecision`, so issuing one always leaves a forensic record (who, when, against whom, on what flag).

Consent is scoped to the **stewarding process and its acting cohort**, not to an individual steward. This is what allows handover and co-signing without re-disclosure (see §8–9). What keeps process-scoped consent sovereign rather than open-ended is the member-visible access log: the member sees which stewards opened their disclosure and when.

## 4. State machine

States ride on the `administration` `Status` entry:

- **accepted** (normal participation)
- **lapsed** — *new variant, to build*
- **suspended temporarily** — exists; time-gated auto-clear (time-served)
- **suspended indefinitely** — exists; permanent ban

**Lapsed** is a protective hold, not a punishment and not a finding. It gates the member from making new arrangements while an integrity question is open, protecting prospective counterparties from entering exchanges with someone under question. It is reversible by the member's **compliance**, not by a clock — a member who is simply absent meets the lapse only when they next try to participate, then complies and passes through. No deadline.

Un-lapse is **admin-confirmed adequacy**, not automatic. Auto-restore on submission would be gameable (push an empty packet, bounce back), so the steward's review of the disclosure — the case-details work in §9 — is what lifts the lapse.

The two existing suspension flavours are distinct tools sharing the same `Status` mechanism: temporary auto-clears on its clock (or is permanent if indefinite, which corresponds to a ban). The compliance-reversible behaviour belongs to **lapsed** and is the piece to wire up. The relationship between time-based temporary suspension and compliance-based lapse needs a deliberate coexistence model (see §11).

## 5. Authority gradient

Authority required scales with severity and irreversibility:

- **Single steward** may issue a `disclosure_request` and impose a **lapse** — low-stakes, fully reversible, audited.
- **Two-steward co-sign** to escalate **lapsed → suspended**. This is the public-exposure boundary, where reputational harm begins, so plural authority belongs here.
- **Two-steward concurrence** for **permanent (indefinite) suspension**.

Live source currently gates all status mutation behind a single `check_if_agent_is_administrator`; two-steward concurrence does not yet exist anywhere and is a build target.

## 6. Trigger and containment

A `disclosure_request` is **grounded by a prior community flag** — necessary but not sufficient. The steward retains discretion to assess the flag rather than auto-acting on it.

The flag precondition is not, by itself, the containment. The real containment is the **durable audit trail + plural authorisation at escalation + reversibility + cohort visibility**. The flag also relocates a power question (who contains the flagger?), answered by treating the flag under whistle-blower protection patterns: reporter identity is protected, with a **good-faith requirement** so a knowingly false flag carries consequences. Protection for honest reporters; accountability for malicious ones.

**Flagger identity** is confidential from the flagged party, visible to the steward layer. (Settled with Anita.)

## 7. Visibility

Distinct layers, deliberately separated:

- **Lapse** is *not* broadcast to the whole membership. It is visible to affected counterparties (parties to an open or in-flight exchange), the target, and the steward cohort.
- **Suspension** is membership-visible. (Currently an inherited assumption — confirm it is actually decided; see §11.)
- At the **data layer**, `Status` is a public entry with ungated read functions, so any agent can already query any entity's status. Whole-membership visibility of suspension therefore already exists at the data layer; the build target is the **UI surfacing** (a badge, filtering from discovery), not the data access.
- **Case metadata** (existence, state, issuer, target, flag) is visible to the whole steward cohort via the shared `admin_review` anchor.
- **Case content** (disclosure + findings) is confidential and cohort-keyed (see §8).
- **Resolved suspensions** live in a graded register, separate from the active unified decision queue (the unified-queue rule applies to pending decisions, not resolved ones).

## 8. Evidence storage

The case file — disclosure content and steward findings — stays **in-DHT**. It is not extracted into a centralised database; doing so would rebuild the extractive pattern the project exists to refuse.

Confidentiality comes from **encryption**, not visibility-gating (a public DHT entry is in the clear, and a coordinator read-gate is polite, not cryptographic). The content is encrypted and the **ciphertext** is published as a normal DHT entry — sovereign, replicated, opaque without the key.

**Foundation verified.** A spike on `hdk 0.6.0` (R&O's pinned version) confirmed the load-bearing operation end to end in a real conductor: agent A encrypts to agent B's existing key, and B decrypts in their own cell with A never consulted — cross-agent, asynchronous, at-rest. The encryption is no longer an assumption.

Access means holding the key. A **per-case** key is issued to each steward on that case — the acting cohort (handler + co-signers + reviewers), never a single global admin group key. Per-case keying minimises blast radius: a steward only ever holds keys to cases they actually worked. Each grant is a logged DHT action, visible to the cohort and the member.

**Minimum-two rule.** Every case is keyed to at least two stewards. This is load-bearing twice over: a co-signer must be able to read the evidence to co-sign meaningfully (so peer review and escalation depend on it), and the evidence must survive key loss — a case keyed to a single now-lost keystore would be permanently undecryptable by anyone. Two-plus holders means there is always someone who can re-issue access.

**Encoding — open fork.** Two implementations satisfy the access model; the choice is deferred to the frame-check:

- **Model A (verified, Spike 1):** encrypt to each steward's existing `ed25519` agent key. No separate keypair lifecycle. Granting or re-issuing = encrypting to the new steward's agent key. Simplest; costs one ciphertext copy per steward, so best for small findings.
- **Model B (verified, Spike 2):** one per-case content key, content encrypted once, the key wrapped to each steward — and re-wrapped to a returning/replacement admin who then decrypts it (the re-issue flow, proven end to end). One ciphertext plus N small key-wraps — more efficient for large or attachment-bearing evidence — but requires each steward to mint and publish a separate `x25519` keypair.

Either way the access model — per-case, cohort, re-issuable, logged — is identical; only the storage shape differs. Both encodings are empirically proven on `hdk 0.6.0` (Spikes 1 and 2), so the choice is a storage-efficiency tradeoff — A simpler, B better for large evidence — not a feasibility question.

Findings are **append-only, attributed, and versioned** — never edited in place — for forensic integrity. Tamper-evidence comes from the DHT action history; if a stronger commitment is wanted, publish a hash of the findings rather than exposing content.

## 9. Case details screen

Each case has a details screen that:

- lets the handling steward record **findings** in a textarea, forming the append-only investigatory record;
- surfaces the disclosed content to the acting cohort (access logged);
- supports **handover** between stewards: re-wrap the content key to the new handler, notify the member, log it. Handover does **not** trigger a new `disclosure_request` — consent is process-scoped, so a reshuffle does not force re-disclosure. A new request fires only if the new handler needs data outside the original scope. Decoupling also closes a harassment path (repeated "handover" to force repeated disclosure);
- shows a **counter** of days since the `disclosure_request` was sent, with +30 days flagged red — strictly as a **prompt** for stewards to consider a co-signed escalation, never an auto-trigger;
- surfaces whether the member has been **active since the request landed**, distinguishing "ignoring us" (won't) from "hasn't been here" (can't).

## 10. Revocation, departure, and re-admission

There is no true revocation: the DHT is immutable, so what a steward already decrypted, they keep. The mechanisms below manage this honestly without pretending otherwise.

**Rescinded / most-recent state** is an *accountability* record — it documents, via the update chain, that a steward's authorisation was withdrawn and when. It marks the boundary; it does not enforce it against already-held data.

**Fork-and-walk** rotates the per-case keys and re-issues to the current cohort when a steward leaves. This buys **forward secrecy** — the departed steward is cut out of all future material — scoped to that steward's *active* cases. Resolved history is not re-encrypted: the old ciphertext persists regardless, so re-keying it gains nothing and only bloats the DHT. Rotation is wired to the admin-removal action so it is automatic and atomic, and it targets the current cohort composition (cleanly handling a replacement onboarding at the same moment).

**Key loss and re-admission.** Losing a lair keystore (reinstall, device change) means becoming a new agent — recovery *is* re-admission under a fresh key plus a re-issued role; there is no central account to restore, and that is correct, not a gap. The evidence is not lost with the steward: because every case is keyed to at least two stewards (§8), a surviving holder can re-issue access to the returning steward's new identity, or to a replacement, with a single logged re-issue. Handover, return-after-key-loss, and replacement-after-departure are one operation pointed at a different recipient. Granting the role does **not** by itself confer historical access — the role authorises, key-possession decrypts, and they are deliberately separate layers; re-acquiring a past case is a per-case, logged act, not a side-effect of a role flag. A new steward therefore gets going-forward material automatically and historical cases only by deliberate, logged re-issue.

The residual — what a departed steward retains — is the same kind of risk as any member (you cannot stop screenshots or memory; perfect revocation was never achievable by any means), but higher stakes because stewards handle case evidence. It is backstopped at the human layer: a former steward who misuses retained material is sanctionable through the same flag → lapse → suspension machinery — but only while still within the community's reach, and only for *detectable* misuse. The real protection is upstream: per-case minimisation and care at the steward-selection gate.

## 11. Open items

**Verified:** both encodings proven in-environment on `hdk 0.6.0` — Model A (encrypt-to-agent-key, cross-agent and asynchronous) by Spike 1, and Model B (per-case content key, multi-wrap, and re-wrap to a returning/replacement admin) by Spike 2.

Build targets and deferred decisions:

- **Encoding decision — Model A vs Model B** (§8). Both verified; the choice is a storage-efficiency tradeoff — A simplest (one ciphertext per steward, no extra keypairs), B more efficient for large evidence (one ciphertext plus key-wraps, needs x25519 keypairs). Decide at the frame-check.
- **Key custody / portability** — the backup and recovery posture protecting a steward's decryption ability across reinstall or device change. The operational question the spike deliberately does *not* answer; one for the frame-check with the Holo contact.
- **Minimum-two-wrap** — adopt as a build invariant: never key a case to a single steward (durability, co-sign, and re-issue all depend on it).
- **Two-steward concurrence** primitive — unbuilt; needed for escalation co-sign and permanent suspension.
- **Lapsed `StatusType` variant** — unbuilt; the near-term buildable slice, feeds the lapsed-state admin screen.
- **UI surfacing of suspension** to the membership — build target (data-layer visibility already exists).
- **Confirm membership-visibility of suspension** is a decided policy, not inherited behaviour.
- **Coexistence model** for time-based temporary suspension vs compliance-based lapse.
- **Member-facing access log** surface — the thing that keeps process-scoped consent sovereign.
- **Issue #163** (community flagging primitive) is the trigger's design parent; the flag's good-faith requirement lives there.
- **Member activity signal** ("active since request") — data source and surfacing on the case screen.

## 12. Verification record

The encryption foundation was proven empirically, not assumed. Both spikes ran in R&O's own sweettest harness against the pinned `hdk 0.6.0` / `hdi 0.7.0`, in a real conductor with the real lair keystore. The code is throwaway and does not ship; it is preserved as a runnable reference at git tag `crypto-feasibility-proven` (branch `spike/crypto-feasibility`). To re-run: check out the tag, then `bun run build:happ` and the corresponding `cargo test ... --test administration_spike_*` target.

**Spike 1 — Model A (encrypt-to-agent-key).** Agent A encrypted a payload to agent B's existing `ed25519` agent key via `ed_25519_x_salsa20_poly1305_encrypt`; agent B decrypted it in their own cell via `ed_25519_x_salsa20_poly1305_decrypt`, with A never consulted. Proves cross-agent, asynchronous, at-rest encryption to an existing identity key, with no separate keypair. Result: `ok` (~118s, almost entirely two-conductor setup).

**Spike 2 — Model B (shared-secret content key + re-wrap).** A handler minted a per-case content key (`x_salsa20_poly1305_shared_secret_create_random`), encrypted the content once (`x_salsa20_poly1305_encrypt`), and wrapped the key to a co-signer (`x_salsa20_poly1305_shared_secret_export`); the co-signer ingested it (`x_salsa20_poly1305_shared_secret_ingest`) and decrypted the content. The same content key was then re-wrapped to a third agent — standing in for a returning or replacement admin — who also decrypted it. Proves cohort access and the re-issue flow to a fresh identity, end to end. Result: `ok` (~180s, three-conductor setup).

Both spikes used throwaway `spike_*` functions added to the `administration` zome and a `setup_three_agents` harness helper. None of it is production-shaped; the durable outputs are this document and the tag. When the real evidence layer is built, a round-trip test of the chosen encoding should re-enter the suite as a version-drift guard (the encryption host functions carry deprecation notices, so a Holochain bump past 0.6 could break them) — at that point attached to the feature and following the repo's conventions, not as a standalone spike.
