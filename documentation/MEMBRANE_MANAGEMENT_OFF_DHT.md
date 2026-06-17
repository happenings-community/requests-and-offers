# Membrane Management — The Off-DHT Half

**Status:** frame-check draft (v0.1) — for endorse-or-redirect, not a build spec
**Companion:** `documentation/MEMBRANE_MANAGEMENT.md` (the in-DHT half, PR #170)
**Related issues:** #144 (breaking-version migration), #143 (version-drift detection), #95 (joining UX)

---

## 0. Scope and boundary

The in-DHT half (`MEMBRANE_MANAGEMENT.md`) specifies everything the DNA itself enforces: the membrane-proof shape, the `genesis_self_check` validation, the `JoiningDecision` and `AccessAudit` entries, the graduated `PermissionHolder` permissions, the in-DHT side of the two-key trust-root split, acceptance-via-attestation plus the welcome queue, and the enforcement boundary.

This document specifies everything *off* the DHT — the parts that live in R&O's own backend and the joining service it runs:

1. The custom invite plugin and its ledger (how an agent is admitted).
2. The membrane-signer key custody (the operational side of the two-key split).
3. The application and email path (how someone becomes admissible in the first place).
4. The off-DHT correlation store, its gated reads, and the audit-resolution and disclosure read-model.
5. Re-admission across a breaking upgrade (how existing members rejoin a new network).

Three settled foundations carry through the whole document and are stated once here:

- **`auth_methods = [invite_code]`** with a *custom*, ledger-backed invite plugin. The stock invite plugin is an in-memory `Set`, single-use only within a process, and ignores the agent key — inadequate, and ours to build.
- **Admission is always per-agent admin approval (Path B).** There is no path into R&O that bypasses an admin decision.
- **Email** runs through Lettermint (EU-incorporated, GDPR DPA by default) fed via Listmonk in external mode, so R&O owns consent and holds no subscriber store. **Persistence** for the invite ledger, the correlation store, and the access audit is SQLite on the self-hosted joining-service host — the same store the service already uses for sessions on that deployment target.

---

## 1. Admission model — one token, two triggers

Every admission resolves to the same artefact: an **invite**, email-bound and single-use, recorded in a ledger. What differs is only how the invite comes to be issued.

- **Proactive (the invited path).** An admin issues an invite to a known email. Issuing *is* the act of admission — admit-on-arrival, not a second confirmation at the door.
- **Reactive (the open application path).** A prospective member applies; after a double-opt-in email confirmation and Path B review, an admin approves, which issues the invite.

Both produce a **pre-approved applicant record plus an issued invite**. The difference between them is whether the review step is a deliberate gate (open path) or collapsed into the act of inviting (invited path). The joining service itself only ever sees invite redemptions; the openness lives in *who may apply*, not in *how anyone joins*.

### Why there is no `email_code` (OTP) auth method

Satisfying an auth method produces a `ready` status, which mints the membrane proof — so any standalone auth method is, by definition, *sufficient for admission*. An `email_code` method admits on email-ownership alone, which would drive a hole straight through Path B: verify any mailbox, get a proof, join, no admin in the loop. So OTP is excluded not as redundant-but-harmless but as *wrong* for this admission model. Email control is established by R&O's own backend, upstream of the membrane (see §3), never as a joining-service challenge — which also keeps every email R&O sends inside the one consent-owning infrastructure.

### Reserved: `delegated_verification` for external verification

A second auth method is kept available but deliberately inactive. `delegated_verification` — an external party vouching to the service for an agent — was the wrong fit for R&O vouching to its *own* service: a cross-org trust-delegation protocol with no cross-org boundary, which is precisely what generated the partner-key, trust-root, and vouch-sequencing questions raised against the earlier Option B* design. It is the right fit for the case R&O will reach later — a professional third-party identity verifier — where the external boundary is real and the partner credential and accepted attestation are the point, not overhead.

So the two methods divide cleanly by role: **`invite_code`** for R&O's own admission (active now), **`delegated_verification`** reserved for genuine external trust delegation (future KYC / partner-org vouching). Reserving it costs almost nothing: the plugin already exists in the service; it is simply absent from the active `auth_methods` (`[invite_code]`).

Activating it later requires no in-DHT change. The service signs every membrane proof with the same `membrane_signer` key (§5) whichever method was satisfied, and `genesis_self_check` validates the *signature*, not the method — so a delegated_verification path mints a proof of the same shape, leaving the two-key split untouched. The one slot to reserve now is a `verification_method` / verification-level field in the correlation store (§4), and eventually an on-DHT verification attestation, so trust tiers (basic vs professionally verified) can be recorded without reshaping the model; the vouch primitive already carries `verification_method` + `attested_claims` for exactly this.

The design question is deferred to when that path is built, not resolved here: does an external vouch *admit directly*, or *compose with* R&O's decision? #166's fixed floor is that a human makes every admission decision, so the reserved stance is that **identity verification is an input to the membrane decision, not a replacement for it** — a professionally-verified vouch attaches verified attributes the admin weighs, or acts as an additional gate, never an alternative path that admits an agent without R&O's signed decision.

---

## 2. The custom invite plugin and ledger

### The ledger

A single SQLite table, owned by R&O's backend. The backend inserts at approval and reads for admin views and reconciliation; the joining-service plugin is granted only read plus a conditional update on this table. A row is **born at approval** and carries:

| Field | Notes |
|---|---|
| `token_hash` | `sha256:<hex>` of the token — never the raw token. The raw token exists only in the invite email. A ledger compromise leaks no usable invites. (Mirrors the existing `hashApiKey` pattern in the codebase.) |
| `email` | The address the invite was issued to. Recorded for audit/correlation; **not** the redeem-time secret. |
| `applicant_ref` | Opaque reference to the applicant record (feeds §4). |
| `status` | `issued` → `redeemed`, with `revoked` / `expired` as the other terminals. |
| `agent_key` | `null` until redeem; set at redeem. **This is the key-binding moment.** |
| `issued_by`, `issued_at`, `expires_at`, `redeemed_at` | Provenance and lifecycle. |

### Plugin placement

The plugin interface only hands `agentKey` to `createChallenges`, not to `verifyChallengeResponse`. So:

- **`createChallenges`** does a cheap existence/`issued` pre-check (fail fast on garbage) and stashes `{ token_hash, bound_agent_key }` in the challenge metadata. (Carrying server-side state — including the agent key — across to verify via stripped metadata is the established pattern: `email_code` stashes `expected_code`; `hc_auth_approval` and `agent_allow_list` both stash `agent_key`.)
- **`verifyChallengeResponse`** performs the **atomic compare-and-set** (`issued → redeemed`, set `agent_key`, set `redeemed_at`) and the expiry check, returning a clean `{ passed, reason }`. The atomic CAS is what replaces the stock plugin's non-durable `Set.delete` and closes the double-redeem race across restarts and instances.

The consume happens at `verify`; the proof is minted at `provision`, signed by the membrane-signer key (§5), embedding agent key + DNA hash + `issued_at` and deliberately *omitting* `applicant_ref` (that binding lives gated in §4).

> *Engine note:* a non-empty challenge array routes the session to `pending` and is resolved by a client `POST …/verify` — confirmed against the sibling plugins (the stock invite, `email_code`, and `agent_allow_list` all place their substantive logic in `verifyChallengeResponse`, reachable only via that call) and the `verify` error table's `verification_failed` case. A direct read of the join handler is the optional belt-and-braces check.

### Reconciliation to Path B

The plugin never calls back to R&O to check approval. Admin approval is the event that *writes* the `issued` row and fires the invite email; by the time a token can be redeemed, the approval is already a row. The plugin is therefore a pure ledger consumer with no live coupling to the admin interface.

---

## 3. The application and email path

### One record type, two creation paths

Both paths write the same applicant record; the invited one is simply born pre-approved.

- **Open path:** apply → R&O emails a confirm-your-address magic link → the application enters the review queue only once confirmed → Path B review → on approval, the invite is issued. The confirm step is double-opt-in: it serves both as the live-email test and as consented entry into a correspondence relationship the applicant initiated.
- **Invited path:** an admin issues an invite (email + optional note) → a pre-approved applicant record and an `issued` invite are written → the invite email is sent. There is **no pre-confirm step** here: the admin is extending a one-time transactional invite to someone they know, not enrolling a subscriber. The live-email test still holds, at redemption, because the token lives only in the email. Issuance is an audited admin act (`issued_by`), rate-limited and revocable — the accountability check against invite-spam. Non-redemption purges the record on the same 30-day clock as an abandoned application.

### The live-email gate

The property to enforce is precise: **not status visibility, but redeemability without the email.** A reopened app may say "you've applied, check your email"; it must never surface the redeemable token. Two reinforcing reasons keep the whole pre-key applicant world email-only: the token is the structural enforcement of email control, and before the agent key exists there is no authenticated identity to scope in-app status to anyway (only a browser-local token an impersonator would also hold). The membrane is the clean boundary — pre-key is the email-channel world, post-key is the in-app DHT world.

### Correspondence, purge, and graduation

The needs_info magic-loop handles two-way follow-ups; the 30-day purge clock resets on every update, so an active relationship persists and only genuine silence purges. On accept, PII **graduates** to the member's profile / source chain (email is a required, persistent profile field) and the off-DHT *application* copy purges. Email is therefore not destroyed — it lives on the member's profile — which matters for §6.

---

## 4. Off-DHT correlation store and gated reads

### A store distinct from the invite ledger

Kept separate for three reasons: different lifecycles (a redeemed invite row can archive after a window; the correlation binding is retained long-term), least privilege (the joining-service plugin touches only the invite table, never this), and concern separation (this is the home of the off-DHT audit resolution and disclosure read-model). It holds the **non-PII admission binding** — `agent_key ↔ applicant_ref ↔ decision` plus provenance — written at the §1 verify-consume moment. Because `applicant_ref` is an opaque identifier and the PII has graduated or purged, the entire store is non-PII: it answers "this agent was admitted via which decision" without re-exposing personal data, and so carries no GDPR retention clock.

### Authorising a read — authority on-DHT, data off-DHT

1. The admin's client sends a signed request reusing the `/v1/reconnect` shape: `{ agent_key, timestamp, signature }` (ed25519 over timestamp + query params, ±5-minute window), plus the query and — for investigative reads — a coded `cause`.
2. The backend verifies the signature against `agent_key`. This proves key control; it authorises nothing on its own.
3. The backend runs a **scoped on-DHT `get_links`** to confirm the requester holds the relevant `PermissionHolder` grant — an ordinary client read, not bound by `validate()` limits.

Revoking an admin's read access is thus an on-DHT governance action (drop the link); the off-DHT store keeps no second access list to drift out of sync.

### Read tiers — model in the in-DHT doc, mechanics here

The permission *model* — the two tiers (`read_applicant_pii` for the operational front-door flow, `investigate_member` for retrospective reach-back), the controlled-vocabulary `cause`, the aggregate-vs-targeted logging split, and the no-exemption-at-the-root principle — is specified in the in-DHT doc and not restated here. What this document owns is the off-DHT mechanic: an operational read is logged in aggregate (counts and rates, no per-record cause); an investigative read must carry the coded `cause` (rejected if absent), and the backend writes the on-DHT `AccessAudit` before it serves.

### AccessAudit — on-DHT, with resolution and disclosure off-DHT

`AccessAudit` is an **on-DHT** entry (`JoiningDecision` grammar, create-only, immutable), per the in-DHT doc — *not* off-DHT, as an earlier draft of this section had it. The reason is the membership-condition reciprocity: because admins' standing visibility is a condition of membership (the lifecycle layer), the per-use audit is the member's primary safeguard, and a safeguard the operator could quietly erase is no safeguard. On-DHT immutability is what makes it un-erasable, the root included.

Non-walkability does **not** come from restricting reads — the DHT has no per-entry read ACL, and cap grants gate zome-function *calls*, not entry reads. It comes from content. The entry is authored by the querying agent — so per-actor volume stays visible to *the mirror* — and carries an **opaque `subject_ref`**, never the member's key, so "agent X queried member Y" is not publicly resolvable. This is the doc's own `JoiningDecision.applicant_ref` pattern, applied to the audit.

What this document owns off-DHT is the resolution and the disclosure read-model:

- The gated `subject_ref → member` mapping lives in the correlation store. Resolving "who queried me" for a member, or an admin's targeted audit, goes through it — and because the on-DHT entry is opaque, a member cannot bypass the backend to read it raw. That opacity is precisely what keeps disclosure *timing* a backend policy knob (immediate, delayed-until-closed, or a narrow audited break-glass) without the record itself being mutable or off-DHT.
- **Transparency persists across membership state.** A withdrawn member's admission record stays reachable retrospectively (R&O-side, see §6), and the `subject_ref → member` binding is the retained non-PII kind — so the audit a withdrawn member most needs keeps accruing. "Who queried me" must therefore resolve regardless of active membership, never gated behind a re-grant.

Enforcement is **commit-then-serve**: the backend withholds the investigative data until the querying agent's immutable `AccessAudit` is on-chain — unskippable *and* un-erasable, stronger than an off-DHT log on both counts.

---

## 5. Membrane-signer key custody

### The conflation to undo

The current tooling conflates two roles into one seed. `gen-signing-key.ts` mints a single seed and instructs that its public key be embedded as the DNA **progenitor**; `DEPLOYMENT.md` carries the same in prose ("`genesis_self_check` checks the proof's `signer` matches the progenitor"). Because that seed must live on the joining-service host to sign every proof, host compromise today equals governance seizure. The two-key split exists to break exactly that coupling.

### Two keys, two custody regimes, two DNA properties

| Key | Custody | Role | DNA property |
|---|---|---|---|
| **membrane_signer** (hot) | Resident on the joining-service host as a tight-perms secret (600 file / OS keyring / injected credential); never in the repo, ledger, or any client-reachable path. | Signs every membrane proof. | `membrane_signer_pubkey` (validated by `genesis_self_check`). |
| **progenitor / admin** (cold) | Generated offline on a machine that is never the host; stored cold (hardware token / offline medium / paper). | Governance root; used only for root operations (and, e.g., signing a migration announcement — see §6). | `progenitor_pubkey`. |

### Rotation is migration

Changing a DNA property changes the DNA hash, and `genesis_self_check` cannot call out, so the accepted signer key is fixed at DNA creation. There is no in-place rotation: the hot key's lifetime is "until the next migration," and a breaking upgrade is a clean rotation point. Between migrations, the response to compromise is detection and containment, not rotation.

### Blast radius (the point of the split)

- **Signer compromise** → an attacker can forge proofs that pass `genesis_self_check` and self-admit arbitrary agent keys, bypassing the joining service. But it grants **no** governance authority (that is the cold key); forged-proof intruders have **no redeemed-invite row**, so reconciling live DHT membership against the invite ledger flags exactly the keys that never came through a real invite; and it is recoverable by regenerating the signer at the next migration. Bounded, detectable, recoverable.
- **Progenitor compromise** → governance seizure: catastrophic, not recoverable without a coordinated migration. Hence cold, hence never on a server.

The durable invite ledger (§1) is therefore not just admission bookkeeping — it is the reconciliation anchor that makes hot-key compromise detectable.

> **To revise alongside this:** `gen-signing-key.ts` (split into two key-generation paths, decoupled from the progenitor labelling) and the `DEPLOYMENT.md` membrane-proof section.

---

## 6. Re-admission across a breaking upgrade

This section is the admission-layer companion to #144. **#144 moves the data; this section admits the agent** — and neither works at a breaking upgrade without the other. Two populations need distinguishing: *new* members (admitted by invite redemption, §§1–5) and *existing* members at a breaking boundary (re-admitted here).

### The Holochain and Kangaroo reality

A breaking version is a new DNA and a new DHT. Kangaroo isolates data per breaking version (`breakingVersion()` yields `0.5.x` vs `0.6.x`, and the keystore sits under that per-version root in `filesystem.ts`). More decisively, the install flow forks identity by default: `holochainManager.ts` `installHappIfNecessary` calls `generateAgentPubKey()` unconditionally on a fresh conductor (line ~188) and installs under that brand-new key — even if the old keystore is present. Kangaroo's lair usage is only `init` and `server` (`lairKeystore.ts`); it has no native seed import/export. So **on stock Kangaroo, every breaking upgrade hands the user a new identity**, and #144's recommended Option B (source-chain replay with `CloseChain`/`OpenChain` lineage) cannot meet its own "verifiable agent identity lineage" acceptance criterion without a build change.

### Achieving key continuity (the prerequisite for the clean path)

Three coordinated steps, only one of which is load-bearing:

1. **Patch `installHappIfNecessary`** so a migration installs with a recorded *old* pubkey instead of calling `generateAgentPubKey()`. *Without this the other two are inert.*
2. **Stage the old keypair into the new lair.** Lowest-effort: copy `data/{keystore,.pw}` forward (the random password is plaintext in `.pw`, so it travels; `keystoreInitialized()` means a pre-seeded store is used as-is; the launch rewrites the socket `connectionUrl` itself). This works only if the lair on-disk format is compatible across the jump (main-0.5 pins lair 0.6.2; the 0.6-branch version needs an empirical check). If the copy will not load, fall back to a custom `lair-keystore import-seed` of the old seed — format-independent.
3. **Record the old agent pubkey during the prep step** (the old app already knows its own pubkey) so the patched install knows which key to request.

This expands the **prep button** (your idea; #144's Track D wizard) into the migration linchpin: it exports the user's own data (profile + listings), records the agent pubkey, and stages the keystore carry.

### The two pathways

- **With key continuity** (the patch is made): existing members re-admit via **`agent_allow_list` of surviving keys** — seed the new network's joining config with the known member keys, admit-by-signing-a-nonce, no email, no token. And `CloseChain`/`OpenChain` lineage works because the same key signs both chains.
- **Without key continuity** (no build change): re-admit via **bulk-issued invites**, delivered primarily **in-app on the old version** (the member is authenticated there, so this is not the §3 pre-key bypass and needs no retained email) and secondarily by **email** (email persists to the profile, §3). `applicant_ref` threads the old and new identities. No cryptographic lineage.

### Data continuity is #144's, not this document's

Source-chain replay, link reconstruction, and versioned-enum schema evolution belong to #144. This document specifies only the admission handshake the migration depends on, and contributes one evidence-backed finding to that conversation: *the lineage criterion requires patching `installHappIfNecessary` to reuse a carried key; the carry is a keystore-dir copy (verify 0.5↔0.6 lair format) or a custom `import-seed`; the prep flow must capture the old pubkey.*

---

## 7. Build-time follow-ups

These are implementation steps, not open design questions — the architecture above is settled, including the Kangaroo re-admission recipe (§6), the AccessAudit placement (§4), and email persistence to the profile (§3).

- **Lair on-disk format across 0.5 → 0.6** — an empirical check that selects between the two *already-specified* key-carry mechanisms in §6: a keystore-directory copy if the format is compatible, a custom `import-seed` if not. Either way the mechanism is known; this only picks which.
- **Join-handler `verify` routing** — settled by the plugin evidence in §2; a direct read of the handler is an optional confirmation, not a blocker.
- **Prototype wiring** (`useJoiningGuard`, `handleInvitedJoin`) — read against the real endpoints at build time rather than reconstructed from memory.

The §6 install-flow finding is a *contribution to #144*, not a question we are waiting on: it should be raised on that issue as the admission-layer prerequisite for its lineage acceptance criterion.

---

## 8. References

- In-DHT companion: `documentation/MEMBRANE_MANAGEMENT.md` (PR #170)
- Joining service: `JOINING_SERVICE_API.md`; the auth-method plugins (`plugin.ts`, `invite-code.ts`, `email-code.ts`, `agent-allow-list.ts`, `hc-auth-approval.ts`); `gen-signing-key.ts`; `DEPLOYMENT.md`
- Migration: #144 (breaking-version migration system), #143 (version-drift detection), #95 (joining UX / QR invite)
- Kangaroo source consulted for §6: `kangaroo-electron` `src/main/{filesystem.ts, holochainManager.ts, lairKeystore.ts}` (branch `main-0.6`)
