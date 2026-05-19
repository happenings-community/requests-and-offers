# Project Status

This document reflects the current implementation state as of **v0.5.2 (2026-04-30)**.
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
- All 7 coordinator + integrity zome pairs in place
- Progenitor pattern — secure designated network creator for trusted bootstrapping
- Action hash type safety — compile-time distinct types preventing hash kind confusion
- Active/Archived/Deleted listing status management across requests and offers
- Sweettest integration tests (37 tests, all passing — replaced Tryorama in v0.5.0)

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
| Backend (Sweettest / Rust) | 37 tests | All passing |
| Frontend unit tests (Vitest) | ~367 tests across 22 files | All passing |
| E2E / Playwright | Planned ([#10](https://github.com/happenings-community/requests-and-offers/issues/10)) | Not yet implemented |

---

## Active Bugs

Bugs from alpha testing, ordered by priority. See the [project board](https://github.com/orgs/happenings-community/projects/2) for live status.

### P1 — Critical

| Issue | Title | Status |
|-------|-------|--------|
| [#56](https://github.com/happenings-community/requests-and-offers/issues/56) | Status Table: only shows last 2 entries, requires page refresh | In progress |
| [#158](https://github.com/happenings-community/requests-and-offers/issues/158) | Profile creation fails with 60s call_zome timeout | Ready |
| [#133](https://github.com/happenings-community/requests-and-offers/issues/133) | Request form: Links and Organization optional fields don't persist on save | Ready |
| [#134](https://github.com/happenings-community/requests-and-offers/issues/134) | Request update→navigate race triggers Wasm deserialize error | Ready |
| [#115](https://github.com/happenings-community/requests-and-offers/issues/115) | Organisation not shown in Request or Offer listings | Backlog |
| [#120](https://github.com/happenings-community/requests-and-offers/issues/120) | Organization Page — needs Edit button | Backlog |
| [#127](https://github.com/happenings-community/requests-and-offers/issues/127) | Profile creation fails with CellDisabled conductor error | Backlog |
| [#147](https://github.com/happenings-community/requests-and-offers/issues/147) | Alpha Test Step 2.5 — Fail | Backlog |

### P2 — High

| Issue | Title | Status |
|-------|-------|--------|
| [#96](https://github.com/happenings-community/requests-and-offers/issues/96) | Profile — variable ability to see others' Request/Offer details | Ready |
| [#136](https://github.com/happenings-community/requests-and-offers/issues/136) | Archive functionality inconsistent across listing views | Ready |
| [#138](https://github.com/happenings-community/requests-and-offers/issues/138) | Connection status shows 'Connected' in airplane mode | Ready |
| [#157](https://github.com/happenings-community/requests-and-offers/issues/157) | Timezone dropdown in profile form does not commit selection | Ready |
| [#86](https://github.com/happenings-community/requests-and-offers/issues/86) | Request — Time Estimate field not included | Ready |

---

## In Progress

| Issue | Title | Priority |
|-------|-------|----------|
| [#1](https://github.com/happenings-community/requests-and-offers/issues/1) | hREA Entity Mapping: Proposals, Intents & Resource Specifications | P1 |
| [#56](https://github.com/happenings-community/requests-and-offers/issues/56) | Status Table bug fix | P1 |
| [#64](https://github.com/happenings-community/requests-and-offers/issues/64) | Epic: hREA Integration | P1 |

---

## Ready for Development

Items prioritized and ready to implement:

| Issue | Title | Size | Priority |
|-------|-------|------|----------|
| [#95](https://github.com/happenings-community/requests-and-offers/issues/95) | Network Creation & Joining UX (Kangaroo splash + QR invite) | M | P2 |
| [#143](https://github.com/happenings-community/requests-and-offers/issues/143) | In-app version drift detection and non-breaking auto-update | L | P2 |
| [#27](https://github.com/happenings-community/requests-and-offers/issues/27) | Role Management Utility Functions for Anchor-Based System | — | P3 |
| [#155](https://github.com/happenings-community/requests-and-offers/issues/155) | Markdown toolbar scrolls to top after wrap action | XS | P3 |

### Tests and Documentation Needed

Implemented but missing tests or documentation:

| Issue | Title |
|-------|-------|
| [#139](https://github.com/happenings-community/requests-and-offers/issues/139) | Profile — First Name and Last Name required fields |
| [#55](https://github.com/happenings-community/requests-and-offers/issues/55) | Navigation: Alt+A keybinding for contextual admin/public page navigation |

---

## Remaining MVP Features

Large features deferred to upcoming milestones.

| Issue | Title | Size | Priority |
|-------|-------|------|----------|
| [#1](https://github.com/happenings-community/requests-and-offers/issues/1) | hREA Entity Mapping completion | XL | P1 |
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
