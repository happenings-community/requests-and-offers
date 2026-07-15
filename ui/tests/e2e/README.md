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

**Every spec is also standalone-runnable**: `beforeAll` uses the idempotent `ensure*` helpers (`utils/e2e-helpers.ts`) — `ensureAcceptedUser`, `ensureServiceType`, `ensureMediumOfExchange` — which create state only if it doesn't exist yet.

## Rules

- Navigate with `gotoApp()` (never bare `page.goto()`) — it injects the `hcPort`/`hcToken`/`hcAdminPort` params the Holochain client needs.
- Any spec that mutates the primary user's status **must restore `accepted` before it ends** (see `01`'s `afterAll` safety net); every later chapter depends on it.
- Destructive moderation paths (reject) are exercised on service types and organizations, never on the primary user.
- Multi-agent flows (second member joining an org, cross-agent exchanges) are **out of scope here** — they belong to Sweettest.

## Selector gotchas (hard-won)

- **Skeleton `TabGroup` tabs are `role="tab"`, not buttons.** My Listings' tab switcher, by contrast, uses real buttons.
- **Three confirm mechanisms coexist**: native `window.confirm` (detail-page deletes — use `page.once('dialog', …)`), the custom `ConfirmModal` component (ActionBar moderation, cards), and Skeleton's built-in `type: 'confirm'` (MoE delete).
- **`ServiceTypeSelector` renders an unkeyed `{#each}` over a list that re-sorts after async loads** — a click can race the re-render and toggle the wrong item. Always filter via its search box down to one option first, then check, then assert the selection chip.
- **`TimeZoneSelect` is a Skeleton popup combobox** on every form (user, offer, request) — drive it with the keyboard-based `selectTimezone()` helper.
- **Original vs latest records**: detail pages and `get_active_*` zome calls resolve the LATEST record; my-listings, admin lists, MoE list/edit page load the ORIGINAL. After an edit, list surfaces keep the pre-edit content — several tests assert this documented behavior on purpose.
- **Toasts auto-dismiss (~5s)** — assert durable state changes (section counts, URL changes, list membership), not toast text.
- Wait for a page `h1`/`nav` before asserting: the root layout shows a full-screen connection gate for 5–15s.

## Known app gaps the suite documents (tests marked with "KNOWN APP GAP")

1. **Editing a service type breaks its use in offers/requests** — the UI maps `original_action_hash` from the latest record, whose hash the approval link doesn't cover; `create_offer` then rejects with "Cannot link to a service type that is not approved".
2. **Status-history pages render their empty state** although transitions are recorded on the DHT.
3. **Medium-of-exchange updates are invisible in the UI** — both the list and the edit page load the original record (the suite verifies persistence via `get_latest_medium_of_exchange_record`).
4. **List surfaces don't reflect offer/request edits** (my-listings, `/offers`, `/admin/offers`) — only detail pages do.

When a gap is fixed, the corresponding assertion starts failing — tighten it then.
