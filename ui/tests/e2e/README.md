# E2E Test Suite

Full-coverage Playwright suite driving the real UI against a live sandbox conductor. No mocks anywhere: `global-setup` boots one Holochain conductor per run (`tests/setup/conductor-manager.ts`), installs the built hApp via `AdminWebsocket`, and the Vite dev server serves the UI on `:8880`.

```bash
bun build:happ        # once, from the repo root (needs nix)
cd ui && bun test:e2e
```

## Architecture: one ordered journey

The infrastructure shares **one conductor and one agent identity across the whole run** (`workers: 1`, spec files execute in filename order). `users_organizations::create_user` succeeds once per agent, and the first user auto-registers as network administrator. The suite embraces this instead of fighting it: spec files are number-prefixed chapters of a single story.

| File | Chapter |
|---|---|
| `00-onboarding` | visitor → profile via the real form → pending gate → self-approval from the admin dashboard → edit |
| `01-administration` | dashboard stats, users management, suspend→unsuspend round-trip, administrators, status history |
| `02-service-types` | admin create/edit, public suggestion, moderation approve + reject, visibility rules, tags redirect |
| `03-mediums-of-exchange` | admin create→approve→edit, user suggestion from the offer form |
| `04-offers` | create → detail → edit → my-listings → admin list → archive → delete (Skeleton modal path) |
| `05-requests` | create → detail → edit → lists → delete from detail (native `window.confirm` path) |
| `06-organizations` | create via form, pending-visibility rule, dashboard approval, coordinator edit, status history |
| `07-users-directory` | public directory and profile page |
| `08-hrea` | hREA test interface smoke (the hApp bundles the hREA role) |

**Every spec is also standalone-runnable** (`playwright test tests/e2e/specs/04-offers.spec.ts`): `beforeAll` uses the idempotent `ensure*` helpers (`utils/e2e-helpers.ts`) — `ensureAcceptedUser`, `ensureServiceType`, `ensureMediumOfExchange` — which create state only if it doesn't exist yet. Filename order and single-spec runs are the two supported modes; reverse/random order is not (the files are chapters, and DHT state accumulates within one run — `global-setup` wipes the sandbox at the start of every run).

Multi-agent scenarios live in the Sweettest layer — see `tests/sweettest/tests/` (`users`, `organizations`, `administration/`, `offers`, `requests`, `service_types`, `mediums_of_exchange`).

There is currently **no CI workflow running this suite** (`.github/workflows/` has docs + issue automation only); it runs locally in ~5.5 minutes wall-clock, conductor boot included.

## Rules

- Navigate with `gotoApp()` (never bare `page.goto()`) — it injects the `hcPort`/`hcToken`/`hcAdminPort` params the Holochain client needs.
- Any spec that mutates the primary user's status **must restore `accepted` before it ends** (see `01`'s `afterAll` safety net); every later chapter depends on it.
- Destructive moderation paths (reject) are exercised on service types and organizations, never on the primary user.
- Multi-agent flows (second member joining an org, cross-agent exchanges) are **out of scope here** — they belong to Sweettest.

## Selector gotchas (hard-won)

- **Skeleton `TabGroup` tabs are `role="tab"`, not buttons.** My Listings' tab switcher, by contrast, uses real buttons.
- **Three confirm mechanisms coexist**: native `window.confirm` (detail-page deletes — use `page.once('dialog', …)`), the custom `ConfirmModal` component (ActionBar moderation, cards), and Skeleton's built-in `type: 'confirm'` (MoE delete).
- **`ServiceTypeSelector` now uses a keyed `{#each}`** (Bug 2 fix) — the list re-sorts after async loads, but the key (`original_action_hash`) keeps DOM-to-item mapping stable across re-renders. Filtering via the search box before checking is still good practice for determinism with many options, but the re-sort race is gone.
- **`TimeZoneSelect` is a Skeleton popup combobox** on every form (user, offer, request) — drive it with the keyboard-based `selectTimezone()` helper.
- **Original vs latest records**: detail pages and `get_active_*` zome calls resolve the LATEST record; list surfaces (my-listings, admin lists, MoE list/edit page) ALSO resolve the latest record after the Bug 4 fix. After an edit, all surfaces show the edited content.
- **Toasts auto-dismiss (~5s)** — assert durable state changes (section counts, URL changes, list membership), not toast text.
- Wait for a page `h1`/`nav` before asserting: the root layout shows a full-screen connection gate for 5–15s.

## Resolved app gaps (previously known, now fixed + tested)

1. **Editing a service type breaks its use in offers/requests** — FIXED: `is_service_type_approved` and `get_service_type_status` now resolve the original action hash via `find_original_action_hash` before checking approval-path links. Regression test: `02-service-types.spec.ts` "edited service type remains usable in a new offer".
2. **Status-history pages render their empty state** — FIXED: `get_all_revisions_for_entry` uses `GetStrategy::Network` instead of `Local`, so revision links authored by other agents (admin status updates) are found. Tests: `01-administration` and `06-organizations` "status history page renders" now require rows, no empty-state fallback.
3. **Medium-of-exchange updates are invisible in the UI** — FIXED: `get_mediums_of_exchange_by_status` resolves the latest record per link; the MoE store's `fixEntityOriginalHash` corrects `original_action_hash` on Update records; the edit page loads via `getLatestMediumOfExchangeRecord`. Test: `03-mediums-of-exchange` "admin edits the medium" now asserts the edited name appears in the admin list.
4. **List surfaces don't reflect offer/request edits** — FIXED: `get_active_offers`, `get_archived_offers`, `get_user_offers` (and the request equivalents) now resolve the latest record per link via `get_latest_offer_record` / `get_latest_request_record`. Tests: `04-offers` and `05-requests` list assertions now use the EDITED title.
5. **ServiceTypeSelector toggled the wrong item on re-sort** — FIXED: the `{#each}` block is now keyed by `original_action_hash`. The Bug 1 regression test selects a service type through the keyed selector without the filter-first workaround.
