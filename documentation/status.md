# Project Status

This document reflects the current implementation state as of **v0.6.0-alpha.2 (2026-11-18)**.
For full change history, see [CHANGELOG.md](../CHANGELOG.md).

**Current Phase: Alpha Testing** — Core MVP features are live; active bug triage underway from alpha user feedback.

---

## What's Working

### Architecture — Unified Effect-TS (All 8 Domains)

All domains are fully standardized with the 7-layer Effect-TS architecture:
`Service Types`, `Requests`, `Offers`, `Users`, `Organizations`, `Administration`, `Exchanges`, `Mediums of Exchange`

Pattern established: `Context.Tag` services → Effect-native stores → `Schema.Class` validation → `Data.TaggedError` error handling → composables → Svelte 5 components.

### Core Infrastructure

**Holochain Backend (Rust):**
- Holochain 0.7 (HDK 0.7.0, HDI 0.8.0)
- 9 coordinator zomes and 7 integrity zomes: `messaging` and `misc` are coordinator-only
- Progenitor pattern — secure designated network creator for trusted bootstrapping
- Action hash type safety — compile-time distinct types preventing hash kind confusion
- Active/Archived/Deleted listing status management across requests and offers
- Sweettest integration tests (101 cases across 21 files, 5 of them under `administration/`; replaced Tryorama in v0.5.0)

**Frontend (SvelteKit + Effect-TS):**
- Svelte 5 Runes (`$state`, `$derived`, `$effect`) throughout
- All 8 domain stores fully Effect-TS based
- `EntityCache` pattern for in-memory caching
- Event Bus system (`storeEvents.ts`) for cross-store communication
- Weave/Moss integration — runs as a Weave Tool with hybrid profile display
- Markdown rendering for descriptions and bios
- Search and filtering across organizations, requests, and offers
- Active/Archived listing tabs with status management UI
- Contact information display components
- Organization contact person designation (coordinator with role/title)
- Navigation: Profile section with edit access
- Alt+A keybinding for contextual admin/public page navigation

**Documentation:**
- mdBook-based documentation site with GitHub Pages deployment
- Developer guide system: getting-started, development-workflow, effect-ts-primer, architectural-patterns, domain-implementation

### Testing Infrastructure

| Layer | Count | Status |
|-------|-------|--------|
| Backend (Sweettest / Rust) | 101 cases across 21 files | Off the pull-request path: run with the `run:sweettest` label or the Heavy tests workflow |
| Frontend unit tests (Vitest) | 934 tests across 68 files | All passing, on every pull request |
| Frontend integration tests (Vitest) | 43 tests across 4 files | All passing |
| E2E / Playwright | 11 specs, an ordered journey on one sandbox conductor ([#10](https://github.com/happenings-community/requests-and-offers/issues/10)) | Off the pull-request path: run with the `run:e2e` label or the Heavy tests workflow |

How these counts were taken, so they can be refreshed: `grep -rhE '#\[(tokio::test|test)' tests/sweettest/tests | wc -l`, `cd ui && bun run test:unit` and `cd ui && bun run test:integration` (with `VITE_MOCK_BUTTONS_ENABLED` unset), and `ls ui/tests/e2e/specs`.

---

## Active Bugs

Bugs from alpha testing, ordered by priority. See the [project board](https://github.com/orgs/happenings-community/projects/2) for live status.

### P1 — Critical

| Issue | Title | Status |
|-------|-------|--------|
| [#158](https://github.com/happenings-community/requests-and-offers/issues/158) | Profile creation fails with 60s call_zome timeout | Ready |
| [#127](https://github.com/happenings-community/requests-and-offers/issues/127) | Profile creation fails with CellDisabled conductor error | Backlog |
| [#147](https://github.com/happenings-community/requests-and-offers/issues/147) | Alpha Test Step 2.5 — Fail | Backlog |

### P2 — High

| Issue | Title | Status |
|-------|-------|--------|
| [#96](https://github.com/happenings-community/requests-and-offers/issues/96) | Profile — variable ability to see others' Request/Offer details | Ready |
| [#86](https://github.com/happenings-community/requests-and-offers/issues/86) | Request — Time Estimate field not included | Ready |

Fixed since this page last listed them: #56, #133, #134, #115, #120, #136, #138 and #157.

---

## In Progress

The alpha 2 work is tracked on its milestone, [v0.6.0-alpha.2](https://github.com/happenings-community/requests-and-offers/milestone/17). The two hREA items this table used to list are closed: entity mapping ([#1](https://github.com/happenings-community/requests-and-offers/issues/1)) is done, and the hREA integration epic ([#64](https://github.com/happenings-community/requests-and-offers/issues/64)) was closed as not planned.

---

## Ready for Development

Items prioritized and ready to implement:

| Issue | Title | Size | Priority |
|-------|-------|------|----------|
| [#95](https://github.com/happenings-community/requests-and-offers/issues/95) | Network Creation & Joining UX (Kangaroo splash + QR invite) | M | P2 |
| [#143](https://github.com/happenings-community/requests-and-offers/issues/143) | In-app version drift detection and non-breaking auto-update | L | P2 |
| [#27](https://github.com/happenings-community/requests-and-offers/issues/27) | Role Management Utility Functions for Anchor-Based System | — | P3 |

The markdown toolbar fix (#155), and the tests and documentation this page asked for on #139 and #55, are done and closed.

---

## Remaining MVP Features

Large features deferred to upcoming milestones.

| Issue | Title | Size | Priority |
|-------|-------|------|----------|
| [#12](https://github.com/happenings-community/requests-and-offers/issues/12) | Real-time Signals integration | — | P2 |
| [#91](https://github.com/happenings-community/requests-and-offers/issues/91) | Chat System: Conversation-First Messaging | XL | P1 |
| [#51](https://github.com/happenings-community/requests-and-offers/issues/51) | Global Notification System | — | P2 |
| [#90](https://github.com/happenings-community/requests-and-offers/issues/90) | hREA Exchange Process: Agreements & Economic Events | XL | P1 |
| [#52](https://github.com/happenings-community/requests-and-offers/issues/52) | Admin Inbox & Task Management | — | P2 |
| [#53](https://github.com/happenings-community/requests-and-offers/issues/53) | Admin Audit Trail | — | P2 |
| — | Review & Reputation System | — | — |

---

## Post-MVP (Deferred)

- Internationalization: Multi-language support
- Mobile App: Native mobile wrapper
- Advanced recommendation/matching algorithms
- Geographic Features ([#54](https://github.com/happenings-community/requests-and-offers/issues/54)): Offline experience and local connections
- Holo Hosting Deployment ([#14](https://github.com/happenings-community/requests-and-offers/issues/14))
- Skeleton UI v3 / Tailwind CSS v4 upgrade ([#35](https://github.com/happenings-community/requests-and-offers/issues/35))
- Breaking-version migration system ([#144](https://github.com/happenings-community/requests-and-offers/issues/144))
