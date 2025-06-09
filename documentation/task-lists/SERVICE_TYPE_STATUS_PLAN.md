# Service Type Status System Implementation Plan

This document outlines the detailed plan for implementing the status management system for `ServiceType` entries in the Requests & Offers project. This system will allow user suggestions for service types and admin moderation (approval/rejection), ensuring only approved service types are used in requests and offers. This plan is a sub-task and detailed breakdown for the "Service Type Validation Workflow" section within `documentation/task-lists/TASKS_ISSUE_39.md`.

## Overall Goal

To implement a robust status system for `ServiceType` entries using Holochain path anchors, enabling a workflow where users can suggest service types, and administrators can moderate these suggestions by approving or rejecting them. Only approved service types will be available for linking to `Request` and `Offer` entries.

## Completed Tasks

### Phase 1: Backend Implementation (Holochain Zomes)

- [x] Step 1.1: Define Path Anchor Strings & Helper Functions (`service_types_coordinator`)
- [x] Step 1.2: Implement `suggest_service_type` (`service_types_coordinator`)
- [x] Step 1.3: Modify `create_service_type` (`service_types_coordinator`)
- [x] Step 1.4: Implement Moderation Functions (`service_types_coordinator`)
- [x] Step 1.5: Implement Getter Functions (`service_types_coordinator`)
- [x] Step 1.6: Enforce Approved Status in `requests_` & `offers_coordinator` Zomes
- [x] Step 1.7: Implement Link Cleanup Logic (`service_types_coordinator`)

## In Progress Tasks (Phase 2: Backend Testing)

### Phase 2: Backend Testing (Tryorama)

- **[ ] Write Tryorama tests for User Suggestion flow.**
- **[ ] Write Tryorama tests for Admin Creation flow.**
- **[ ] Write Tryorama tests for Admin Moderation (approve, reject pending, reject approved).**
- **[ ] Write Tryorama tests for Getter Access Controls.**
- **[ ] Write Tryorama tests for Linking Enforcement in Requests/Offers.**
- **[ ] Write Tryorama tests for Link Cleanup logic.**
- **[ ] Write Tryorama tests for Idempotency/Edge Cases.**
- **[ ] Run all backend tests in Nix environment: `nix develop --command [test_cmd]`**

## Future Tasks

### Phase 3: UI Implementation (Svelte/TypeScript/Effect-TS)

- **[ ] Step 3.1: Update `serviceTypes.service.ts`** (Add methods for new zome calls).
- **[ ] Step 3.2: Update `serviceTypes.store.svelte.ts`** (Manage state, role-based data fetching).
- **[ ] Step 3.3: Create UI for User Service Type Suggestions**.
- **[ ] Step 3.4: Enhance Admin Panel for Service Type Moderation**.
- **[ ] Step 3.5: Update `ServiceTypeSelector.svelte` & Forms** (Use approved types only for users).

### Phase 4: UI Testing (Vitest)

- **[ ] Write/Update Vitest tests for `tests/unit/services/serviceTypes.service.ts`**.
- **[ ] Write/Update Vitest tests for `tests/unit/stores/serviceTypes.store.svelte.ts`**.
- **[ ] Write/Update Vitest tests for `tests/integration/serviceTypes.test.ts`**
- **[ ] Write Vitest tests for User Suggestion Form component**.
- **[ ] Write Vitest tests for Admin Moderation UI components**.
- **[ ] Write Vitest tests for `ServiceTypeSelector.svelte` behavior**.
- **[ ] Run all UI unit tests: `bun test:unit` in `ui/` directory.**
- **[ ] Run all UI integration tests: `bun test:integration` in `ui/` directory.**

## Implementation Plan

The Service Type Status System will be implemented using Holochain path anchors to categorize `ServiceType` entries into "pending", "approved", and "rejected" states.

1.  **Backend (Holochain Zomes)**:

    - The `service_types_coordinator` zome will manage the creation of `ServiceType` entries and their linkage to the appropriate status path anchors.
    - Functions will be exposed for:
      - Users to suggest new service types (defaulting to "pending").
      - Admins to create service types directly as "approved".
      - Admins to moderate suggestions (approve/reject).
      - Fetching service types based on their status, with access controls:
        - Public access to "approved" service types.
        - Admin-only access to "pending" and "rejected" service types.
    - The `requests_coordinator` and `offers_coordinator` zomes will be updated to validate that only "approved" service types can be linked to `Request` and `Offer` entries.
    - Logic for cleaning up links from `Requests`/`Offers` if an approved `ServiceType` is later rejected or deleted will be implemented.
    - All backend functionality will be thoroughly tested using Tryorama within the Nix development environment.

2.  **Frontend (SvelteKit, TypeScript, Effect-TS)**:
    - The `serviceTypes.service.ts` and `serviceTypes.store.svelte.ts` will be updated to interact with the new zome functions and manage UI state related to service type statuses.
    - A new UI component will be created for users to submit service type suggestions.
    - The admin panel for service types will be enhanced to allow moderation of pending suggestions and viewing of all statuses.
    - Existing components like `ServiceTypeSelector.svelte` will be updated to ensure regular users only see and can select from "approved" service types.
    - UI changes will be tested using Vitest.

## Relevant Files

### Backend (Holochain - Rust)

- `dnas/requests_and_offers/zomes/coordinator/service_types/src/lib.rs` (or `status.rs` module): Core logic for status management, new zome functions.
- `dnas/requests_and_offers/zomes/integrity/service_types/src/lib.rs`: Potential minor changes if new link tags or specific validation rules for status links are needed.
- `dnas/requests_and_offers/zomes/coordinator/requests/src/lib.rs`: Validation logic for `ServiceType` linking.
- `dnas/requests_and_offers/zomes/coordinator/offers/src/lib.rs`: Validation logic for `ServiceType` linking.
- `tests/src/requests_and_offers/service_types_tests.rs` (or similar): Tryorama tests for the new status system.

### Frontend (Svelte, TypeScript)

- `ui/src/services/zomes/serviceTypes.service.ts`: New/updated methods to call zome functions.
- `ui/src/lib/stores/serviceTypes.store.svelte.ts`: State management for different status lists, role-based access.
- `ui/src/routes/admin/service-types/+page.svelte` (or similar): Admin UI for moderation.
- `ui/src/lib/components/service-types/ServiceTypeSuggestionForm.svelte` (new): User suggestion form.
- `ui/src/lib/components/service-types/ServiceTypeSelector.svelte`: Ensure it uses approved types.
