# Issue #39: Dynamic ServiceType DHT Entry - Implementation Plan

This document outlines the implementation plan, progress, and future tasks for Issue #39, focusing on the `ServiceType` DHT entry. The initial phase involved replacing string-based service type arrays with this dynamic entry. The current phase focuses on implementing a robust validation/approval workflow for these service types and ensuring all associated tests are passing.

## Overview and Goals

- **Initial Goal (Achieved)**: Implement `ServiceType` as a dedicated, manageable DHT entry to improve data structure, queryability, and administration.
- **Current Primary Goal**: Implement a validation workflow for `ServiceType` entries, allowing user suggestions, admin approval/rejection using path anchors, and restricting usage to approved types.
- **Supporting Goal**: Remediate and enhance all backend (Tryorama) and frontend (Vitest) tests to ensure full coverage and passing status.
- **Benefits**:
    - Standardized and structured service type definitions.
    - Enhanced query capabilities.
    - Clear admin-governed process for introducing new service types.
    - Improved data integrity by restricting links to approved service types.

## System Status: Core Features Largely Complete

The foundational `ServiceType` system, including its DHT structure, coordinator zome functions for CRUD operations, TypeScript services, Svelte stores, and a comprehensive admin interface, is largely implemented and functional. The UI allows for creation, listing, editing, and selection of service types in Request/Offer forms, guarded by availability checks.

## Detailed Completed Tasks

### Backend (Holochain DNA & Zomes)
- **[x] `service_types_integrity` Zome**:
    - Defined `ServiceType` entry struct (`name`, `description`, `category`, `tags`).
    - Implemented entry validation (non-empty fields, author validation for update/delete).
    - Defined `EntryTypes` and `LinkTypes` (initial set).
    - Refactored into `service_type.rs` with streamlined HDI validation.
- **[x] `service_types_coordinator` Zome**:
    - Implemented full CRUD operations for `ServiceType` management.
    - Implemented admin-only access control for core CRUD.
    - Implemented bidirectional linking functions between ServiceTypes and Requests/Offers.
    - Refactored input types (e.g., `ServiceTypeLinkInput`).
- **[x] `requests_coordinator` & `offers_coordinator` Zomes**:
    - Updated `RequestInput`/`OfferInput` to use `service_type_action_hashes: Vec<ActionHash>`.
    - Refactored creation, update, and deletion logic to delegate `ServiceType` link management to `service_types_coordinator` zome.
- **[x] DNA Manifest (`dna.yaml`)**:
    - Added `service_types_integrity` and `service_types_coordinator` zomes.
    - Defined cross-zome call capabilities.

### Frontend (UI - TypeScript, Svelte, Effect-TS)
- **[x] TypeScript Types**:
    - Defined `ServiceType` types in `ui/src/lib/types/holochain.ts` and `ui/src/lib/types/ui.ts`.
- **[x] Service Layer (`ui/src/lib/services/zomes/serviceTypes.service.ts`)**:
    - Implemented Effect-TS based service for `ServiceType` zome calls with error handling.
    - Refactored service initialization for connection state awareness (`HolochainServiceLive`).
- **[x] Store (`ui/src/lib/stores/serviceTypes.store.svelte.ts`)**:
    - Implemented Svelte 5 Runes-based store for `ServiceType` state management.
    - Integrated with `StoreEventBusLive`.
    - Implemented caching (`EntityCache`), loading states, and error handling.
- **[x] Core UI Components**:
    - `ServiceTypeSelector.svelte`: Component for selecting service types, with fixes for reactivity loops (`untrack()`).
    - `ServiceTypeTag.svelte`: Shared component for displaying service type tags.
- **[x] Request/Offer Form Integration**:
    - Updated `RequestForm` and `OfferForm` to use `ServiceTypeSelector`.
    - Updated `RequestCard`/`RequestDetails`/`RequestsTable` and `OfferCard`/`OfferDetails`/`OffersTable` to display `ServiceType` information.
- **[x] Admin Interface for Service Types (`/admin/service-types`)**:
    - Reorganized page structure following (app) route patterns (`+page.svelte`, `create/+page.svelte`, `[id]/+page.svelte`, `[id]/edit/+page.svelte`).
    - List view with search, filtering, and category selection.
    - Dedicated creation page with form handling and validation.
    - Dedicated detail view and edit pages with hash encoding/decoding.
    - `ServiceTypeCard.svelte` enhanced with `onClick` for navigation.
    - "Create Mock Service Types" functionality for testing/demo.
    - Consistent styling and UX patterns with other admin sections.
- **[x] UI Guards & UX Improvements**:
    - `ServiceTypesGuard.svelte`: Prevents access to creation pages if no service types exist, with user-friendly messaging and admin guidance.
    - Utility functions (`checkServiceTypesAvailable`, `getNoServiceTypesMessage`).
    - Improved error handling and loading states in UI components.

### Testing
- **[x] Backend Tests (Tryorama - `tests/src/requests_and_offers/service-types-tests/`)**:
    - Comprehensive test coverage for `ServiceType` CRUD, validation, admin access, linking, and error handling.
    - Integration tests for Request-ServiceType and Offer-ServiceType interactions.
    - Updated test helpers for service type hashes.
- **[x] Frontend Unit Tests (Vitest)**:
    - `serviceTypes.service.test.ts`: Unit tests for the service layer. (Reported 24/24 passing previously)
    - `serviceTypes.store.test.ts`: Unit tests for the store. (Reported 15/22 passing previously - needs review)
    - `ServiceTypeSelector.test.ts`: Unit tests for the selector component. (Reported 24/24 passing previously)
- **[x] Frontend Integration Tests (Vitest - `ui/tests/integration/serviceTypes.test.ts`)**:
    - Basic structure established for store-service interaction. (Needs review and Effect layer fixes)

## Current Focus: Service Type Validation Workflow & Test Remediation

### 1. Service Type Validation Workflow Implementation

This workflow introduces a status system for `ServiceType` entries, managed via path anchors, to allow user suggestions and admin moderation.

- **[ ] Detailed sub-plan for this workflow: [Service Type Status System Implementation Plan](../../SERVICE_TYPE_STATUS_PLAN.md)**

#### Backend (Rust/Holochain - `service_types_integrity` & `service_types_coordinator`) ✅
- **[x] Define Path Anchors for Status**:
    - `pending_service_types` (e.g., "service_types/status/pending")
    - `approved_service_types` (e.g., "service_types/status/approved")
    - `rejected_service_types` (e.g., "service_types/status/rejected")
- **[x] Define Path Anchors for Tag Indexing**:
    - Individual Tag Anchors: `service_types.tags.{url_encoded_tag_string}` (e.g., `service_types.tags.programming`)
    - "All Tags" Anchor: `service_types.all_tags`
- **[x] Define Link Types for Tag Indexing (Integrity Zome)**:
    - `TagAnchorToServiceType`: Links from individual tag anchor to `ServiceType` ActionHash.
    - `AllTagsAnchorToTag`: Links from `service_types.all_tags` anchor to unique tag string/path.
- **[x] Update ServiceType CRUD for Tag Indexing (Coordinator Zome)**:
    - On `ServiceType` create/update:
        - For each tag, link `ServiceType` AH from `service_types.tags.{tag}`.
        - For each new unique tag, link tag string/path from `service_types.all_tags`.
    - On `ServiceType` delete/tag removal:
        - Clean up corresponding links from tag anchors.
- **[x] Implement Getter Functions for Tag Indexing (Coordinator Zome)**:
    - `get_service_types_by_tag(tag: String) -> ExternResult<Vec<Record>>`: Retrieves `ServiceTypes` linked to a specific tag anchor.
    - `get_all_service_type_tags() -> ExternResult<Vec<String>>`: Retrieves all unique tags from the `service_types.all_tags` anchor.
- **[x] User-Suggested Service Types**:
    - Implement `suggest_service_type(name: String, description: String, category: String, tags: Vec<String>) -> ExternResult<Record>`:
        - Creates a new `ServiceType` entry.
        - Links the new `ServiceType` entry's `ActionHash` to the `pending_service_types` anchor.
        - This function will be callable by any authenticated user.
- **[x] Admin-Created Service Types**:
    - Modify `create_service_type` (admin-only function):
        - Creates a new `ServiceType` entry.
        - By default, links the new `ServiceType` entry's `ActionHash` to the `approved_service_types` anchor.
- **[x] Admin Moderation Functions**:
    - Implement `approve_service_type(service_type_ah: ActionHash) -> ExternResult<ActionHash>`:
        - Removes link from `pending_service_types` anchor to `service_type_ah`.
        - Creates link from `approved_service_types` anchor to `service_type_ah`.
        - (Optional: remove link from `rejected_service_types` if re-approving).
    - Implement `reject_service_type(service_type_ah: ActionHash, reason: Option<String>) -> ExternResult<ActionHash>`:
        - Removes link from `pending_service_types` (or `approved_service_types`) anchor to `service_type_ah`.
        - Creates link from `rejected_service_types` anchor to `service_type_ah`.
        - If rejecting an already approved and linked type, trigger link cleanup (see below).
        - Store `reason` if applicable (e.g., as metadata on the link to rejected anchor, or a separate small entry).
- **[x] Access-Controlled Getter Functions**:
    - Implement `get_pending_service_types() -> ExternResult<Vec<Record>>` (Admin only): Retrieves all `ServiceType` records linked to `pending_service_types` anchor.
    - Implement `get_approved_service_types() -> ExternResult<Vec<Record>>` (Public): Retrieves all `ServiceType` records linked to `approved_service_types` anchor.
    - `get_all_service_types()` (Admin only): Continues to retrieve all `ServiceType` entries, potentially augmented with their status based on anchor links.
    - `get_rejected_service_types() -> ExternResult<Vec<Record>>` (Admin only): Retrieves `ServiceType` records linked to `rejected_service_types` anchor.
- **[x] Enforce Approved Status for Linking**:
    - Modify `service_types_coordinator` zome:
        - When linking `ServiceType` entries to `Request` or `Offer`, validate that each `ServiceType` ActionHash is linked to the `approved_service_types` anchor. Reject if not.
- **[x] Link Cleanup on Rejection/Deletion**:
    - If an `approved` `ServiceType` is subsequently rejected or hard-deleted:
        - Find all `Request` and `Offer` entries linked to this `ServiceType`.
        - Delete those specific links (e.g., `RequestToServiceType`, `OfferToServiceType`). This is crucial for data integrity.

#### Frontend (Svelte/TypeScript/Effect-TS)
- **[ ] UI for User Service Type Suggestions**:
    - Create a simple form for users to suggest new service types (name, description, category, tags).
    - This form will call the `suggest_service_type` zome function.
    - Provide feedback to the user (e.g., "Your suggestion is pending approval").
- **[ ] Admin Panel Enhancements for Moderation**:
    - New section/tab in `/admin/service-types` to list "Pending Service Types".
    - UI elements (buttons) for admins to "Approve" or "Reject" pending types.
    - Modal/form for providing a reason when rejecting.
    - Display "Rejected Service Types" with reasons.
    - Clearly indicate the status of each service type in all admin list views.
- **[ ] Update `ServiceTypeSelector` & Forms**:
    - Ensure `ServiceTypeSelector` (and consequently Request/Offer forms) only fetches and displays `approved` service types by calling `get_approved_service_types`.
- **[ ] Update `serviceTypes.store.svelte.ts` & `serviceTypes.service.ts`**:
    - Add new methods to call `suggest_service_type`, `approve_service_type`, `reject_service_type`, `get_pending_service_types`, `get_approved_service_types`.
    - Manage state for pending, approved, and rejected types if needed for UI.

### 2. Test Remediation & Enhancement

- **[ ] Backend Tests (Tryorama)**:
    - **Review & Fix**: Go through all existing `service-types.test.ts` and `service-types-integration.test.ts`. Identify and fix any failing tests or tests that are not aligned with current implementation (e.g., due to changes in input types, function signatures, or access controls).
    - **New Tests for Validation Workflow**:
        - Test user suggestion of service types (creates pending).
        - Test admin creation of service types (creates approved).
        - Test admin approval of pending types (moves to approved anchor).
        - Test admin rejection of pending/approved types (moves to rejected anchor, triggers link cleanup if applicable).
        - Test access control for all new and existing getter functions (`get_pending_service_types`, `get_approved_service_types`, `get_all_service_types`).
        - Test that Requests/Offers can only be linked to `approved` service types.
        - Test link cleanup logic thoroughly.
- **[ ] Frontend Tests (Vitest)**:
    - **Review & Fix `serviceTypes.store.test.ts`**: Address the previously noted 7 failing tests. Ensure full coverage for store logic, including caching and event bus interactions related to new validation states.
    - **Review & Fix `serviceTypes.test.ts` (Integration)**: Complete and fix tests for store-service interaction, especially with the Effect-TS layer.
    - **New Tests for Validation UI**:
        - Test user suggestion form component.
        - Test admin moderation UI components (listing pending, approve/reject actions).
        - Test that `ServiceTypeSelector` correctly filters for approved types.
        - Test state updates in the store related to new validation actions.

## Future Tasks (Post-Validation & Test Fixes)

- **[ ] Advanced Validation Rules**: Implement any further complex validation rules for `ServiceType` entry fields if identified (e.g., uniqueness constraints based on specific fields beyond basic integrity).
- **[ ] Migration Strategy (Optional)**: Define a strategy for migrating existing string-based service types in old `Request`/`Offer` entries if deemed necessary.
- **[ ] Performance Optimization**: Monitor and optimize performance of `ServiceType` queries (especially those involving anchor traversals) and UI rendering, particularly if the number of service types grows very large.
- **[ ] Documentation Updates**:
    - Update `documentation/technical-specs/zomes/service_type.md` with details of the validation workflow, anchor usage, and new zome functions.
    - Update user guides to explain the service type suggestion and approval process.

## Key Technical Decisions & Implementation Plan

- **Dedicated DHT Entry**: `ServiceType` is its own DHT entry for structured data and independent management.
- **Path Anchor-Based Status**: Service type status (`pending`, `approved`, `rejected`) is managed by linking `ServiceType` entries to predefined path anchors, not by a status field within the entry itself. This simplifies entry updates and leverages Holochain's linking mechanism for status queries.
- **Coordinator/Integrity Pattern**: Standard Holochain zome development pattern.
- **Effect-TS**: Used for all Holochain client interactions in `ui/src/services/` for type safety, composable async operations, and robust error handling.
- **Svelte 5 Runes**: Leveraged for reactive state management within `ui/src/lib/stores/`.
- **Admin-Governed Approval**: While users can suggest service types, only administrators can approve them for general use, ensuring quality and consistency.

## Relevant Files (May be expanded with validation feature)

- **Holochain DNA & Zomes**:
    - `dnas/servicetypes/zomes/integrity/service_type/src/lib.rs`
    - `dnas/servicetypes/zomes/coordinator/service_type/src/lib.rs`
    - `dnas/requests/zomes/coordinator/request/src/lib.rs`
    - `dnas/offers/zomes/coordinator/offer/src/lib.rs`
- **UI - Services**:
    - `ui/src/services/zomes/serviceTypes.service.ts`
- **UI - Stores**:
    - `ui/src/lib/stores/serviceTypes.store.svelte.ts`
- **UI - Components**:
    - `ui/src/lib/components/admin/service-types/` (various admin components)
    - `ui/src/lib/components/shared/ServiceTypeSelector.svelte`
    - (New components for user suggestion and admin moderation UI)
- **Tests**:
    - `tests/src/requests_and_offers/service-types-tests/service-types.test.ts`
    - `tests/src/requests_and_offers/service-types-tests/service-types-integration.test.ts`
    - `ui/src/tests/unit/services/serviceTypes.service.test.ts`
    - `ui/src/tests/unit/stores/serviceTypes.store.test.ts`
    - `ui/src/tests/integration/serviceTypes.test.ts`
    - (New test files for validation workflow UI components)
