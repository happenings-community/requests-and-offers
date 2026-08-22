# Foldkit-derived design proposals for the Requests and Offers frontend

Ten documents: one unified design, seven proposal designs (with proposal 4 split in two), and one implementation plan. Derived from the Foldkit comparison note and revised against research verified on 2026-08-22.

## Framing

Foldkit is not a migration target, and the reason is harder than a judgment call. Its `peerDependencies` carry an exact pin, `effect: 4.0.0-rc.109`. `effect@latest` on npm is 3.22.1 and `ui/package.json` declares `effect: ^3.14.18`. Adoption is impossible on the current stack at any effort level. What follows borrows ideas, never code.

## The set

| # | Document | Status | Depends on |
|---|---|---|---|
| 0 | [Unified refactoring design](00-unified-refactoring-design.md) | Proposed | keystone, read first |
| 1 | [Application runtime](01-application-runtime.md) | Proposed | none |
| 2 | [Store coordination module](02-store-coordination.md) | Proposed | none |
| 3 | [Store import boundary](03-store-import-boundary.md) | Proposed | 2 |
| 4a | [Entity lifecycle states](04a-entity-lifecycle-states.md) | Proposed | none |
| 4b | [DHT validation status](04b-dht-validation-status.md) | Speculative | 4a, 5 |
| 5 | [Conductor signals](05-conductor-signals.md) | Proposed | 2 |
| 6 | [Pure state modules](06-pure-state-modules.md) | Proposed | 4a |
| 7 | [Development message log](07-development-message-log.md) | Proposed | 2 |
| 8 | [Implementation plan](08-implementation-plan.md) | Proposed | 0 |

Proposal 4 from the original note is split. Its lifecycle half is ordinary work with a clear payoff. Its `DhtStatus` half rests on an assumption the network does not support, and is filed separately as speculative.

Proposal 1 is likewise split by its own history. Its task-runner half is scheduled. Its application-runtime half is deferred, because this repository built that abstraction in 2025 and removed it deliberately in `e31c0324`, and the research found no fresh reason to bring it back.

## Where to start reading

[00-unified-refactoring-design.md](00-unified-refactoring-design.md) states the single thesis the seven share, the target architecture, the eight invariants, and what deliberately does not change. [08-implementation-plan.md](08-implementation-plan.md) sequences the work into five phases with gates and pull-request titles. The numbered documents are the detail behind each landing point.

## Order

Phase 0 (7, then 1's task runner), Phase 1 (2, then 3), Phase 2 (4a per domain, Service Types first), Phase 3 (5), Phase 4 (6, then 1's runtime). 4b is deferred rather than scheduled.

This inverts the original note's ordering in one place: the development message log moves from last and opportunistic to first, because it costs half a week, carries no production risk, and instruments every phase after it. Roughly 14.5 weeks in total at ten hours a week, of which the first 4.5 deliver six of the eight invariants.

## Verified baseline (2026-08-22, `origin/main` and `dev` agree)

| Fact | Value |
|---|---|
| `runPromise` / `runSync` / `runFork` call sites in `ui/src` | 148 |
| of which inside `.svelte` files | 21 |
| `ManagedRuntime` occurrences | 0 |
| `storeEventBus.on` sites | 42 total: 15 in `hrea.store`, 7 factory sites in `event-helpers.ts`, 12 in `components/hrea/test-page/`, 8 in production components and routes |
| Store-to-store imports | 8, forming two cycles |
| Signal handling (`AppSignal`, `client.on`) | none |
| Stores | 9 (`administration`, `hrea`, `mediums_of_exchange`, `offers`, `organizations`, `requests`, `serviceTypes`, `users`, `weave`) |
| `effect` | `^3.14.18` |
| `@holochain/client` | `0.20.5` |
| SvelteKit adapter | `adapter-static` |

## Evidence sources

Repository facts are counted from the working tree and from `git grep` against `origin/main`. External facts carry their source inline in each document. Foldkit's own published TodoMVC benchmark, its `runtime.ts` `resources` doctrine, Effect's layer-memoization docs, and the `holochain-open-dev/common` signals implementation are the four recurring citations.
