# Foldkit-derived design proposals for the Requests and Offers frontend

Eleven documents: one unified design, seven proposal designs (with proposal 4 split in two), an implementation plan, and a mapping onto the committed pipeline.
Derived from the Foldkit comparison note and revised against research verified on 2026-08-22.
Re-baselined on 2026-11-20 at `f5c799ad`, the head of `origin/dev` after #380.

## Framing

Foldkit is not a migration target today, and the reason has changed since the first revision.
The first revision found an exact pin: Foldkit's `peerDependencies` carried `effect: 4.0.0-rc.109`, while `effect@latest` on npm was 3.22.1 and `ui/package.json` declared `effect: ^3.14.18`.
That pin is gone.
`effect@latest` is now 4.1.4 and `foldkit` 0.171.0 peers `effect: ~4.1.0`, so the dependency stops blocking adoption once the app is on Effect 4 (see § Decisions of 20 November).
The two architectural refusals in [00](00-unified-refactoring-design.md) do not depend on the Effect version and still stand: a single Model does not code-split by route, and Foldkit's virtual DOM ran 2x behind optimised Svelte in Foldkit's own TodoMVC benchmark.
What follows still borrows ideas, never code, until the alpha 3 spike reports.

## The set

| # | Document | Status | Depends on |
|---|---|---|---|
| 0 | [Unified refactoring design](00-unified-refactoring-design.md) | Proposed | keystone, read first |
| 1 | [Application runtime](01-application-runtime.md) | Proposed | none |
| 2 | [Store coordination module](02-store-coordination.md) | Proposed | 7 (the event log lands first, per 00 and 08) |
| 3 | [Store import boundary](03-store-import-boundary.md) | Proposed | 2 |
| 4a | [Entity lifecycle states](04a-entity-lifecycle-states.md) | Proposed | none |
| 4b | [DHT validation status](04b-dht-validation-status.md) | Speculative, gated on a Sweettest experiment | 4a, 5 |
| 5 | [Conductor signals](05-conductor-signals.md) | Proposed | 2 |
| 6 | [Pure state modules](06-pure-state-modules.md) | Proposed | 4a |
| 7 | [Development message log](07-development-message-log.md) | Proposed | 2 |
| 8 | [Implementation plan](08-implementation-plan.md) | Proposed | 0 |
| 9 | [Pipeline alignment](09-pipeline-alignment.md) | Proposed | 0, 8 |

Proposal 4 from the original note is split.
Its lifecycle half is ordinary work with a clear payoff.
Its `DhtStatus` half rests on an assumption the network does not support, and is filed separately as speculative.

Proposal 1 is likewise split by its own history.
Its task-runner half is scheduled.
Its application-runtime half is deferred: this repository built that abstraction in 2025 and reverted it in `e31c0324`.
The maintainer's position is that the attempt failed and is worth retrying later on a more mature codebase, so [01](01-application-runtime.md) records three checkable conditions for reopening it rather than leaving it open indefinitely.
The question is re-decided at PR 3.1, when the signal subscription is built and a concrete need is in hand.

## Where to start reading

[00-unified-refactoring-design.md](00-unified-refactoring-design.md) states the single thesis the seven share, the target architecture, the eight invariants, and what deliberately does not change.
[08-implementation-plan.md](08-implementation-plan.md) sequences the work into five phases with gates and pull-request titles, and maps the phases onto the alpha releases.
The numbered documents are the detail behind each landing point.

## Order

Phase 0 (7, then 1's task runner), Phase 1 (2, then 3), Phase 2 (4a per domain, Service Types first), Phase 3 (5), Phase 4 (6, then 1's runtime).
4b is deferred rather than scheduled.

This inverts the original note's ordering in one place: the development message log moves from last and opportunistic to first, because it costs half a week, carries no production risk, and instruments every phase after it.
Roughly 13 weeks in total at ten hours a week, of which the first 4.7 deliver five of the eight invariants (1, 2, 3, 4 and 7, the five that [08](08-implementation-plan.md)'s Phase 1 stopping point lists and its gates check).
Earlier revisions said "six of the eight" and "4.5 weeks"; both disagreed with the plan's own rows.
Counting `runEffect` in invariant 2 makes Phase 0 larger than its 2.2 weeks, by an estimate not yet re-cut (see [08](08-implementation-plan.md) § Calibration).

## The claim, in one line

The step up is not in abstraction level.
It is that eight architectural rules become checkable by lint, grep or a test, so the architecture stops depending on whoever remembers it.
The checks arrive as a test, `ui/tests/unit/seam/invariants.test.ts`, which is a ratchet: each count may only go down, and the ceiling falls with each converted file.
It replaces the `ui/scripts/check-invariants.sh` that earlier revisions planned, because CI's lint step is non-blocking and its unit step blocks merges.
How many of the eight a machine enforces is the honest progress metric for the programme.

## Decisions of 20 November 2026

Soushi took these on 20 November 2026, before the alpha 2 freeze.
Each is recorded where the plan carries it; this section is the index.

| Decision | What it means for the plan | Where it lands |
|---|---|---|
| **Platform move.** Alpha 3 upgrades the app to Effect 4 and SvelteKit 3, Kit first | Three steps: U1 Vite 8 on SvelteKit 2, U2 SvelteKit 3, U3 Effect 4. Any slice that writes Effect code lands after U3 and is written once. Coordination (Phase 1) is plain TypeScript over the bus and runs alongside the upgrade. #303 and #228 are never in flight together | [08](08-implementation-plan.md) § Phase map |
| **Phase map.** Alpha 3 is the upgrade, Phases 0 and 1, and Phase 3's observation step (PR 3.2) | Phase 2, the rest of Phase 3 and any remote-signal work go in the final (0.6.0). Phase 4 comes after 0.6.0 | [08](08-implementation-plan.md) § Phase map and § Fit with the release train |
| **Invariant 2 counts `runEffect`, enforced as a ratchet test.** | `runEffect` is `E.runPromise` under another name. The check widens to it and lands now as a ceiling that may only fall, as a unit test, not as the bash script | [00](00-unified-refactoring-design.md) § Invariants, [08](08-implementation-plan.md) Phase 0 |
| **The application runtime stays deferred**, and is re-decided at PR 3.1 | `HolochainClientService.onZomeSignal` already owns the one signal listener, so the likeliest reason for a runtime is met by a narrow owner | [01](01-application-runtime.md), [08](08-implementation-plan.md) § Deferred |
| **4b is gated on a Sweettest experiment.** | Whether `get_details` can return a record still pending validation, and what it reports, is answered before any design work on 4b | [04b](04b-dht-validation-status.md), [08](08-implementation-plan.md) § Deferred |
| **A change on one agent reaches another agent's UI local first, then through nudges for the two flows that poll today, approval and exchange turn.** | Phase 3 first wires the zomes' own `post_commit` signals into the bus for the agent's own UI. Then a coordinator change in `administration` and in `exchanges` sends a `Nudge` carrying one `ActionHash` to the agent concerned (the accepted member, the counterparty), as `messaging` already does, and signal routing turns the hash into a fetch and a `StoreEvents` event. The two polls (`useApprovalWatch`, the exchanges poll) drop to a fallback for an offline receiver. No integrity zome changes, so the DNA hash does not change. The messaging store's handler moves onto the bus in the same phase | [05](05-conductor-signals.md), [08](08-implementation-plan.md) Phase 3 |
| **A Foldkit spike and a decision in alpha 3.** | Service types, the reference template, rebuilt on Foldkit beside the current stores after U3 and before Phase 2, measured against the same unit tests. The decision is re-opened with the spike's numbers before Phase 2 starts | [00](00-unified-refactoring-design.md) § What deliberately does not change, [08](08-implementation-plan.md) § Phase map |

## Verified baseline (2026-11-20, at `f5c799ad`)

Counted at `f5c799ad`, the head of `origin/dev` on 20 November 2026, after #380.
The commit is named so the numbers stay checkable rather than decaying: re-running the counts on a later `dev` will give different values without any of them being wrong.
Every row states the `git grep` that produces it, run from the repository root.
The first column keeps the 22 August baseline, taken at `bc0c0ac5`, so the drift is visible.

| Fact | At `bc0c0ac5` | At `f5c799ad` | Produced by |
|---|---|---|---|
| `runPromise` / `runSync` / `runFork` call sites in `ui/src` | 148 | 161 | `git grep -nE 'run(Promise\|Sync\|Fork)' -- ui/src \| wc -l` |
| of which inside `.svelte` files | 21 | 23, in 14 files | `git grep -nE 'run(Promise\|Sync\|Fork)' -- 'ui/src/**/*.svelte' \| wc -l`, and `-l` for the files |
| `runEffect(` calls inside `.svelte` files | not counted | 225, in 66 files | `git grep -nE 'runEffect\(' -- 'ui/src/**/*.svelte' \| wc -l`, and `-l` for the files |
| `.svelte` files that run an Effect as an uncancellable Promise, either way | not counted | 73 | the two `-l` lists above, merged: `(git grep -lE 'run(Promise\|Sync\|Fork)' -- 'ui/src/**/*.svelte'; git grep -lE 'runEffect\(' -- 'ui/src/**/*.svelte') \| sort -u \| wc -l` |
| `ManagedRuntime` files in `ui/src` | 0 | 0 | `git grep -l ManagedRuntime -- ui/src \| wc -l` |
| `storeEventBus.on` sites in `ui/src` | 42 | 47 | `git grep -n 'storeEventBus\.on' -- ui/src \| wc -l` |
| of which in `hrea.store` | 15 | 18 | the same, on `ui/src/lib/stores/hrea.store.svelte.ts` |
| of which factory sites in `event-helpers.ts` | 7 | 7 | the same, on `ui/src/lib/utils/store-helpers/event-helpers.ts` |
| of which in `components/hrea/test-page/` | 12 | 12 | the same, on `ui/src/lib/components/hrea/test-page` |
| of which in production components and routes | 8 | 10, in 7 files | `git grep -n 'storeEventBus\.on' -- ui/src/lib/components ui/src/routes ':!ui/src/lib/components/hrea/test-page' \| wc -l`, and `-l` for the files |
| Typed events in `StoreEvents` | 30 | 34 | `sed -n '/^export type StoreEvents/,/^};/p' ui/src/lib/stores/storeEvents.ts \| grep -c "^  '"` |
| Store-to-store imports, forming two cycles | 8 | 13 | `git grep -nE "from '[^']*\.store\.svelte'" -- ui/src/lib/stores \| wc -l` |
| Store files | 9 | 11 (`exchanges` and `messaging` are new) | `git ls-files 'ui/src/lib/stores/*.store.svelte.ts' \| wc -l` |
| Store files that declare `loading: boolean` | 8 | 10 | `git grep -l 'loading: boolean' -- ui/src/lib/stores \| wc -l` |
| Zome coordinators that emit a `Signal` from `post_commit` | 6 | 6 (plus `messaging`, which emits from `recv_remote_signal`) | `git grep -l 'fn post_commit' -- 'dnas/requests_and_offers/zomes/coordinator/*/src/lib.rs' \| wc -l` |
| Zome-signal handling in `ui/src` | none | one registry, `onZomeSignal`, used by `messaging` only | `git grep -n 'onZomeSignal' -- ui/src` |
| Unit test files | not counted | 132, with 1,720 tests | `git ls-files ui/tests/unit \| grep -c '\.test\.ts$'`; the test count comes from a full `cd ui && bun run test:unit` |
| `effect` | `^3.14.18` | `^3.14.18` declared, 3.17.11 resolved | `grep -n '"effect": \["effect@' bun.lock` |
| `@holochain/client` | `0.20.5` | `^0.21.0` | `grep -n '"@holochain/client"' ui/package.json` |
| SvelteKit, Svelte, Vite, TypeScript | not recorded | 2.37.0, 5.38.6, 5.4.19, 5.9.2 resolved | `grep -nE '^    "(@sveltejs/kit\|svelte\|vite\|typescript)": \["' bun.lock` |
| SvelteKit adapter | `adapter-static` | `adapter-static` | `grep -n 'adapter-static' ui/package.json` |
| `package.json` version | not recorded | `0.6.0-alpha.1` | `grep -n '"version"' ui/package.json` |

The programme has not landed yet: no `event-log.ts`, `useEffectTask`, `store-coordination.ts`, `entity-state.schemas.ts`, `SignalService` or `ui/scripts/check-invariants.sh` exists (`git ls-files ui | grep -E 'event-log|useEffectTask|store-coordination|entity-state|SignalService|check-invariants'` prints nothing).
The ratchet test `ui/tests/unit/seam/invariants.test.ts` is the first piece, and arrives in the pull request after this one.
`onZomeSignal` was built for messaging (#308), not as part of the programme.

## Drift since the 22 August baseline

Twenty-one places where the docs and the code disagree, D1 to D21, found by re-running the baseline on `f5c799ad`.
Each names where the docs now say it.

| # | The docs said | The code says now | Corrected in |
|---|---|---|---|
| D1 | 148 `run*` sites, 21 in `.svelte` | 161 sites, 23 in 14 `.svelte` files (163 at `7d746ad4`; #380 removed two) | this file, [00](00-unified-refactoring-design.md), [08](08-implementation-plan.md) PR 0.4 |
| D2 | no doc counts `runEffect` | `runEffect` (`ui/src/lib/utils/effect.ts:8`) is `E.runPromise`; 225 calls in 66 `.svelte` files; 73 files run Effects uncancellably, not 14 | [00](00-unified-refactoring-design.md) invariant 2, [08](08-implementation-plan.md) Phase 0 |
| D3 | 9 stores, 8 with `loading: boolean` | 11 stores, 10 with it; `exchanges` and `messaging` are new | [08](08-implementation-plan.md) Phase 2 |
| D4 | 42 `storeEventBus.on` sites | 47: 18 in `hrea.store`, 7, 12, and 10 in 7 production files | this file, [08](08-implementation-plan.md) PR 1.4 |
| D5 | 30 typed events | 34, three of them exchange events | this file |
| D6 | 8 store-to-store imports | 13, still two cycles | [00](00-unified-refactoring-design.md), [08](08-implementation-plan.md) PR 1.8 |
| D7 | PR 1.2 extracts `hreaStore.handle*` methods | They exist, 18 of them, all wired through `createEventSubscriptions` | [08](08-implementation-plan.md) PRs 1.2 and 1.3 |
| D8 | six zomes emit `Signal`, others do not | six emit from `post_commit`; `exchanges` emits nothing; `messaging` emits `Nudge` and `Receipt` from `recv_remote_signal` | [08](08-implementation-plan.md) Phase 3 |
| D9 | Phase 3's gate: agent A approves, agent B's UI reflects it | `post_commit` signals reach only the agent's own client; the gate cannot pass on them | [08](08-implementation-plan.md) Phase 3 |
| D10 | Phase 3 touches the DNA, so it wants its own minor version | its steps are frontend only, except optional 3.6, a coordinator edit, which does not change the DNA hash | [08](08-implementation-plan.md) § Fit with the release train |
| D11 | #134, #138 and #133 are unbuilt designs | all three are closed; #134's bug class is still in the code (`UserDetailsModal.svelte:34`) | [08](08-implementation-plan.md) Phase 0 |
| D12 | `@holochain/client` 0.20.5 | `^0.21.0`, #193 closed on 2026-10-22 | this file |
| D13 | `DOCUMENTATION_INDEX.md` links the deleted `app-runtime.md` | fixed; it points at [01](01-application-runtime.md) | nothing to do |
| D14 | "v0.5.2 in alpha testing, v0.6.0 in flight" | `0.6.0-alpha.1`; alpha 2 is due to be tagged on 23 November | [08](08-implementation-plan.md) § Fit with the release train |
| D15 | Phases 0 and 1 are "4.5 weeks" and deliver "six of the eight" | the plan's own rows sum to 4.7 weeks, and its stopping point lists five invariants | this file, [08](08-implementation-plan.md) |
| D16 | polling stays, signals replace nothing | three polls that name a signal as their replacement, and one store that waits for it: `useApprovalWatch` (15 s, #329), the NavBar exchanges poll, the messaging badge poll in the root layout, and the uncached `exchanges` store | [08](08-implementation-plan.md) Phase 3 |
| D17 | 268 passing tests | 132 unit test files and 1,720 tests on 20 November (a full `bun run test:unit` at `f5c799ad`); the project `CLAUDE.md` recorded 646 on 2026-09-14 | [08](08-implementation-plan.md) Phase 4 |
| D18 | README: 07 depends on 02 | [00](00-unified-refactoring-design.md) and [08](08-implementation-plan.md) put 07 first, before 02 | this file |
| D19 | `ui/src` has no signal handling | since #308, `HolochainClientService.onZomeSignal` keeps one listener and per-zome handlers across reconnects; only `messaging.store.svelte.ts` registers one, outside the bus | [08](08-implementation-plan.md) Phase 3 |
| D20 | Foldkit pins `effect: 4.0.0-rc.109`, so adoption is impossible | `effect@latest` is 4.1.4 and `foldkit` 0.171.0 peers `effect: ~4.1.0` | this file § Framing, [00](00-unified-refactoring-design.md) |
| D21 | `effect: ^3.14.18` | declared `^3.14.18`, resolved 3.17.11; Kit 2.37.0, Vite 5.4.19, TypeScript 5.9.2 | this file; the upgrade starts from these |

Docs 01 to 07 and 09 carry the same corrections where they restated a number above: 01 and 09 on the call sites, 02 on the bus, 03 on the imports, 04a on `loading: boolean`, 05 and 09 on signals, 06 on the test count, and 09 on the weeks and the closed issues.
Each edit corrects a figure or a claim and leaves the design alone.

## Evidence sources

Repository facts are counted from the working tree and from `git grep` against `origin/dev`, at the commit each table names.
External facts carry their source inline in each document.
Foldkit's own published TodoMVC benchmark, its `runtime.ts` `resources` doctrine, Effect's layer-memoization docs, and the `holochain-open-dev/common` signals implementation are the four recurring citations.
