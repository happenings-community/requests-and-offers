# Service Types Zome (`service_types_integrity`, `service_types_coordinator`)

## 1. Overview

-   **Purpose**: Manages the lifecycle of `ServiceType` entries. These entries define the categories or types of services, skills, or resources that can be requested or offered within the application. This zome is crucial for classifying and discovering requests and offers.
-   **Validation Workflow**: Implements a moderation process for `ServiceType` entries, involving user suggestions, admin review, and approval/rejection states (`pending`, `approved`, `rejected`). Only `approved` service types can be actively used in new requests and offers.
-   **Tagging and Discovery**: Supports tagging of service types for enhanced search and filtering capabilities.
-   **Zome Structure**:
    -   `service_types_integrity`: Handles data validation, entry definitions, and link type rules.
    -   `service_types_coordinator`: Provides externally callable functions for business logic, interacting with the integrity zome and managing data flows.

## 2. Integrity Zome (`service_types_integrity`)

### 2.1. Entry Types

#### `ServiceType`

The `ServiceType` entry defines a specific type of service or skill.

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
    pub name: String,        // E.g., "Web Development", "Graphic Design", "Childcare"
    pub description: String, // A brief explanation of the service type
    pub tags: Vec<String>,   // Associated keywords for searchability, e.g., ["svelte", "rust", "holochain"]
    // pub category: Option<String>, // Optional: A broader category, e.g., "Technology", "Creative Arts"
                                  // Decision: Currently not implemented, tags provide flexibility.
}
```

### 2.2. Validation Rules

-   **`ServiceType` Entry:**
    -   `name`: Must not be empty. Max length (e.g., 100 chars) can be enforced.
    -   `description`: Must not be empty. Max length (e.g., 500 chars) can be enforced.
    -   `tags`: Vector can be empty. Individual tags should not be empty strings and could be normalized (e.g., lowercase, trimmed). Duplicate tags within the vector might be disallowed or ignored during processing.
-   **Updates/Deletes**: Standard Holochain author validation (original author or agent with specific capabilities can update/delete).

### 2.3. Link Types

-   **`ServiceTypeStatusAnchorToServiceType`**
    -   **Base**: `Path` anchor (e.g., `service_types.status.pending`).
    -   **Target**: `ActionHash` of a `ServiceType` entry.
    -   **Link Tag**: `ActionHash` of the `ServiceType` (for easy retrieval/deduplication) or a `Timestamp` for ordering.
    -   **Purpose**: Connects `ServiceType` entries to their current validation status (`pending`, `approved`, `rejected`).

-   **`TagAnchorToServiceType`**
    -   **Base**: `Path` anchor for a specific tag (e.g., `service_types.tags.programming`).
    -   **Target**: `ActionHash` of an *approved* `ServiceType` entry.
    -   **Link Tag**: `ActionHash` of the `ServiceType`.
    -   **Purpose**: Enables finding approved service types by specific tags.

-   **`AllTagsAnchorToTagString`**
    -   **Base**: `Path` anchor (e.g., `service_types.all_tags`).
    -   **Target**: Can be a lightweight entry representing the tag string or the tag string itself encoded in the link tag if direct string targets are not preferred.
    -   **Link Tag**: The unique `Tag String` (e.g., `b"programming"`).
    -   **Purpose**: Maintains a list of all unique tags currently associated with *approved* service types.

-   **(Implicit) `ServiceTypeUpdates`**
    -   Holochain automatically links original entry actions to their updates.

(Note: `RequestToServiceType` and `OfferToServiceType` links are defined in their respective zomes but are crucial for understanding how `ServiceTypes` are consumed. These links should only target *approved* `ServiceType` entries.)

## 3. Coordinator Zome (`service_types_coordinator`)

### 3.1. Path Anchors Used

-   **Status Anchors (Static Paths):**
    -   `service_types.status.pending`: For `ServiceType` entries awaiting admin review.
    -   `service_types.status.approved`: For `ServiceType` entries approved by an admin and usable in requests/offers.
    -   `service_types.status.rejected`: For `ServiceType` entries rejected by an admin.
-   **Tag Anchors (Dynamic Paths based on tag content):**
    -   `service_types.tags.{url_encoded_tag_string}`: (e.g., `service_types.tags.programming`) For indexing approved service types by individual tags.
-   **All Tags Anchor (Static Path):**
    -   `service_types.all_tags`: For listing all unique tags associated with approved service types.

### 3.2. Key Functions

Input/Output structs (e.g., `SuggestServiceTypeInput`) are defined in Rust for clarity.

#### User-Facing Functions

-   **`suggest_service_type(input: ServiceType) -> ExternResult<Record>`**
    -   **Description**: Allows any authenticated user to suggest a new `ServiceType`.
    -   **Actions**:
        1.  Creates a new `ServiceType` entry with the provided `name`, `description`, and `tags`.
        2.  Links the new `ServiceType` entry's `ActionHash` from the `service_types.status.pending` anchor.
    -   **Access Control**: Any valid, authenticated agent.
    -   **Returns**: The `Record` of the newly created `ServiceType` entry.

#### Admin-Facing Functions

(Admin role is determined by a separate mechanism, e.g., membership in an admin group or a capability grant.)

-   **`admin_create_service_type(input: ServiceType) -> ExternResult<Record>`**
    -   **Description**: Allows an administrator to directly create and approve a `ServiceType`.
    -   **Actions**:
        1.  Creates a new `ServiceType` entry.
        2.  Links the `ServiceType`'s `ActionHash` from the `service_types.status.approved` anchor.
        3.  For each tag in `input.tags`:
            -   Links the `ServiceType`'s `ActionHash` from the corresponding `service_types.tags.{tag}` anchor.
            -   If the tag is new, links the tag string from the `service_types.all_tags` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: The `Record` of the newly created and approved `ServiceType` entry.

-   **`approve_service_type(service_type_ah: ActionHash) -> ExternResult<ActionHash>`**
    -   **Description**: Allows an administrator to approve a `ServiceType` that is currently `pending` (or `rejected`).
    -   **Actions**:
        1.  Validates that `service_type_ah` points to an existing `ServiceType` entry.
        2.  Removes any existing links from `service_types.status.pending` or `service_types.status.rejected` to `service_type_ah`.
        3.  Creates a link from `service_types.status.approved` to `service_type_ah`.
        4.  Fetches the `ServiceType` entry to get its tags.
        5.  For each tag:
            -   Links `service_type_ah` from the `service_types.tags.{tag}` anchor.
            -   If the tag is new (not yet in `all_tags`), links the tag string from the `service_types.all_tags` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: The `ActionHash` of the approved `ServiceType`.

-   **`reject_service_type(service_type_ah: ActionHash, reason: Option<String>) -> ExternResult<ActionHash>`**
    -   **Description**: Allows an administrator to reject a `ServiceType` (whether `pending` or `approved`).
    -   `reason` is optional and currently not stored directly on DHT, but could be logged or emitted as a signal.
    -   **Actions**:
        1.  Validates `service_type_ah`.
        2.  Removes links from `service_types.status.pending` or `service_types.status.approved` to `service_type_ah`.
        3.  Creates a link from `service_types.status.rejected` to `service_type_ah`.
        4.  If the `ServiceType` was previously approved:
            -   Fetches the `ServiceType` entry to get its tags.
            -   Removes links from `service_types.tags.{tag}` anchors to `service_type_ah` for all its tags.
            -   Checks if any tags are now orphaned; if so, removes them from `service_types.all_tags` anchor.
            -   **Crucially**: Triggers cross-zome calls or signals to `requests_coordinator` and `offers_coordinator` to handle cleanup of links from existing `Request` and `Offer` entries that referenced this `service_type_ah`. (Requires granted capabilities).
    -   **Access Control**: Admin only.
    -   **Returns**: The `ActionHash` of the rejected `ServiceType`.

-   **`admin_update_service_type(original_action_hash: ActionHash, updated_input: ServiceType) -> ExternResult<Record>`**
    -   **Description**: Allows an administrator to update an existing `ServiceType`.
    -   **Actions**:
        1.  Creates an update for the `ServiceType` entry pointed to by `original_action_hash`.
        2.  The status of the `ServiceType` (e.g., `approved`) is generally maintained unless explicitly changed by a separate call to `approve_service_type` or `reject_service_type`.
        3.  If the `ServiceType` is `approved`:
            -   Compares old and new tags.
            -   Removes links from tag anchors for any removed tags.
            -   Adds links to tag anchors for any new tags.
            -   Updates `all_tags` anchor if unique tags have changed.
    -   **Access Control**: Admin only.
    -   **Returns**: The `Record` of the updated `ServiceType` entry (new ActionHash, same EntryHash).

-   **`admin_delete_service_type(original_action_hash: ActionHash) -> ExternResult<ActionHash>`**
    -   **Description**: Allows an administrator to delete a `ServiceType` entry.
    -   **Actions**:
        1.  Creates a delete action for the entry identified by `original_action_hash`.
        2.  Removes all links from status anchors (`pending`, `approved`, `rejected`) to this `ServiceType`'s ActionHash(es).
        3.  If the `ServiceType` was `approved` or had tags associated while `pending`:
            -   Removes all links from `service_types.tags.{tag}` anchors.
            -   Updates `service_types.all_tags` anchor if unique tags have changed.
            -   Triggers cross-zome calls/signals for `Request`/`Offer` link cleanup if it was `approved`.
    -   **Access Control**: Admin only.
    -   **Returns**: The `ActionHash` of the delete action.

#### Getter Functions

-   **`get_service_type(service_type_ah: ActionHash) -> ExternResult<Option<Record>>`**
    -   **Description**: Retrieves a specific `ServiceType` entry by its `ActionHash`.
    -   **Access Control**: Public.
    -   **Returns**: `Some(Record)` if found, `None` otherwise.

-   **`get_pending_service_types() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.pending` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: A vector of `Record`s.

-   **`get_approved_service_types() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.approved` anchor.
    -   **Access Control**: Public (essential for UI selectors, general browsing).
    -   **Returns**: A vector of `Record`s.

-   **`get_rejected_service_types() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.rejected` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: A vector of `Record`s.

-   **`get_all_service_types_admin() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries regardless of status (combines pending, approved, rejected, or fetches all known entries).
    -   **Access Control**: Admin only.
    -   **Returns**: A vector of `Record`s.

-   **`get_service_types_by_tag(tag: String) -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all *approved* `ServiceType` entries linked to a specific tag anchor (`service_types.tags.{tag}`).
    -   **Access Control**: Public.
    -   **Returns**: A vector of `Record`s.

-   **`get_all_service_type_tags() -> ExternResult<Vec<String>>`**
    -   **Description**: Retrieves all unique tag strings linked from the `service_types.all_tags` anchor.
    -   **Access Control**: Public.
    -   **Returns**: A vector of `String` tags.

### 3.3. Cross-Zome Interactions

-   **Called by `requests_coordinator` and `offers_coordinator`:**
    -   To validate that `ServiceType` ActionHashes provided during `Request`/`Offer` creation/update correspond to *approved* `ServiceType`s. This is typically done by calling `get_service_type` and then checking its linkage to the `service_types.status.approved` anchor, or by ensuring the `ActionHash` is part of the list returned by `get_approved_service_types`.
-   **Link Cleanup Capabilities:**
    -   The `service_types_coordinator` zome must be granted capabilities by `requests` and `offers` zomes to delete `RequestToServiceType` and `OfferToServiceType` links respectively. This is invoked when an *approved* `ServiceType` is rejected or deleted, to maintain referential integrity.

## 4. Data Flow for Service Type Validation

1.  **Suggestion**: A standard user calls `suggest_service_type(input)`. The `ServiceType` entry is created and linked to `service_types.status.pending`.
2.  **Review**: An administrator client calls `get_pending_service_types()` to list suggestions.
3.  **Moderation (Approve)**: Admin calls `approve_service_type(service_type_ah)`. The link is moved from `pending` to `approved` anchor. Tag anchors (`service_types.tags.{tag}` and `service_types.all_tags`) are updated.
4.  **Moderation (Reject)**: Admin calls `reject_service_type(service_type_ah, reason)`. The link is moved from `pending` (or `approved`) to `rejected` anchor. If previously approved, tag anchors are cleaned up, and `Request`/`Offer` zomes are notified for link cleanup.
5.  **Usage**: Client applications (e.g., UI forms for creating Requests/Offers) call `get_approved_service_types()` and `get_service_types_by_tag()` to present selectable, valid service types to users.
6.  **Integrity during Request/Offer creation**: When a `Request` or `Offer` is created/updated, the respective coordinator zome (`requests_coordinator` / `offers_coordinator`) calls into `service_types_coordinator` (e.g., `get_service_type` and check status, or a dedicated `is_service_type_approved(ah)`) to ensure linked `ServiceType`s are valid and approved.

## 5. Client Integration

The UI integrates with the `service_types` zome through a layered architecture using Effect TS for robust asynchronous operations and state management with Svelte 5 runes.

1.  **Svelte Components**: UI elements for displaying, suggesting, and managing service types.
2.  **Svelte Store (`serviceTypes.store.svelte.ts`)**: Manages UI state, orchestrates calls to the service layer, handles caching (`EntityCache`), and emits/subscribes to events (`storeEventBus`).
3.  **Service Layer (`serviceTypes.service.ts`)**: Wraps Holochain zome calls using Effect TS, providing typed errors and a clean API.
4.  **Holochain Client Service (`HolochainClientService.svelte.ts`)**: Generic service for making `callZome` requests.
5.  **Holochain Zome (`service_types_coordinator`)**: The backend Rust zome.

### 5.1. UI Types

```typescript
// ui/src/types/holochain.ts (example)
import type { ActionHash, EntryHash, Record } from '@holochain/client';

export interface ServiceType {
  name: string;
  description: string;
  tags: string[];
}

export interface ServiceTypeInDHT extends ServiceType {
  // Potentially any fields that are added by the zome automatically if different from input
}

// ui/src/types/ui.ts (example)
export interface UIServiceType extends ServiceTypeInDHT {
  original_action_hash: ActionHash;
  entry_hash: EntryHash;
  // Other UI-specific resolved data, e.g., status derived from store context
  status?: 'pending' | 'approved' | 'rejected';
}
```

### 5.2. Service Layer (`serviceTypes.service.ts`)

Provides Effect-based functions to interact with the `service_types_coordinator` zome.

```typescript
import type { ActionHash, Record } from '@holochain/client';
import type { Effect } from '@effect/io/Effect';
import type { ServiceType } from '@/types/holochain'; // Adjust path as needed
import type { HolochainClientServiceTag } from '@/services/HolochainClientService.svelte'; // Adjust path

// Example Error Type
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{ 
  cause?: Error | unknown; 
  message: string; 
}> {}

export type ServiceTypesService = {
  suggestServiceType: (input: ServiceType) => Effect<HolochainClientServiceTag, ServiceTypeError, Record>;
  adminCreateServiceType: (input: ServiceType) => Effect<HolochainClientServiceTag, ServiceTypeError, Record>;
  approveServiceType: (serviceTypeAh: ActionHash) => Effect<HolochainClientServiceTag, ServiceTypeError, ActionHash>;
  rejectServiceType: (serviceTypeAh: ActionHash, reason?: string) => Effect<HolochainClientServiceTag, ServiceTypeError, ActionHash>;
  adminUpdateServiceType: (originalActionHash: ActionHash, updatedInput: ServiceType) => Effect<HolochainClientServiceTag, ServiceTypeError, Record>;
  adminDeleteServiceType: (originalActionHash: ActionHash) => Effect<HolochainClientServiceTag, ServiceTypeError, ActionHash>;

  getServiceType: (serviceTypeAh: ActionHash) => Effect<HolochainClientServiceTag, ServiceTypeError, Record | null>;
  getPendingServiceTypes: () => Effect<HolochainClientServiceTag, ServiceTypeError, Record[]>;
  getApprovedServiceTypes: () => Effect<HolochainClientServiceTag, ServiceTypeError, Record[]>;
  getRejectedServiceTypes: () => Effect<HolochainClientServiceTag, ServiceTypeError, Record[]>;
  getAllServiceTypesAdmin: () => Effect<HolochainClientServiceTag, ServiceTypeError, Record[]>;
  getServiceTypesByTag: (tag: string) => Effect<HolochainClientServiceTag, ServiceTypeError, Record[]>;
  getAllServiceTypeTags: () => Effect<HolochainClientServiceTag, ServiceTypeError, string[]>;
};

// Tag for dependency injection
export const ServiceTypesServiceTag = Context.Tag<ServiceTypesService>();
```
Key aspects: Uses `Effect.tryPromise` to wrap zome calls, maps errors to `ServiceTypeError`, depends on `HolochainClientServiceTag`.

### 5.3. Store Layer (`serviceTypes.store.svelte.ts`)

Manages reactive state for service types, using Svelte 5 runes and Effect for orchestration.

```typescript
import type { ActionHash, Record } from '@holochain/client';
import type { Effect } from '@effect/io/Effect';
import type { ServiceType, ServiceTypeInDHT } from '@/types/holochain'; // Adjust path
import type { UIServiceType } from '@/types/ui'; // Adjust path
import type { ServiceTypesService, ServiceTypesServiceTag } from '@/services/zomes/serviceTypes.service'; // Adjust path
import type { EntityCacheTag } from '@/stores/utils/entityCache.effect'; // Adjust path
import type { StoreEventBusTag } from '@/stores/eventBus'; // Adjust path

// Example Store Error Type
export class ServiceTypeStoreError extends Data.TaggedError('ServiceTypeStoreError')<{ 
  cause?: Error | unknown; 
  message: string; 
}> {}

export type ServiceTypesStore = {
  // Reactive State (internally uses $state, accessed via store.approvedServiceTypes() etc.)
  readonly pendingServiceTypes: UIServiceType[];
  readonly approvedServiceTypes: UIServiceType[];
  readonly rejectedServiceTypes: UIServiceType[];
  readonly allTags: string[];
  readonly loading: boolean;
  readonly error: ServiceTypeStoreError | null;

  // Methods
  suggestServiceType: (input: ServiceType) => Effect<ServiceTypesServiceTag | StoreEventBusTag | EntityCacheTag, ServiceTypeStoreError, UIServiceType>;
  adminCreateServiceType: (input: ServiceType) => Effect<ServiceTypesServiceTag | StoreEventBusTag | EntityCacheTag, ServiceTypeStoreError, UIServiceType>;
  approveServiceType: (serviceTypeAh: ActionHash) => Effect<ServiceTypesServiceTag | StoreEventBusTag | EntityCacheTag, ServiceTypeStoreError, void>;
  rejectServiceType: (serviceTypeAh: ActionHash, reason?: string) => Effect<ServiceTypesServiceTag | StoreEventBusTag | EntityCacheTag, ServiceTypeStoreError, void>;
  // ... other admin methods like update/delete if exposed directly or handled via admin UI specific flows

  // Fetch methods
  fetchPendingServiceTypes: () => Effect<ServiceTypesServiceTag | EntityCacheTag, ServiceTypeStoreError, void>;
  fetchApprovedServiceTypes: () => Effect<ServiceTypesServiceTag | EntityCacheTag, ServiceTypeStoreError, void>;
  fetchRejectedServiceTypes: () => Effect<ServiceTypesServiceTag | EntityCacheTag, ServiceTypeStoreError, void>;
  fetchAllTags: () => Effect<ServiceTypesServiceTag | EntityCacheTag, ServiceTypeStoreError, void>;
  getServiceTypeByAh: (serviceTypeAh: ActionHash) => Effect<ServiceTypesServiceTag | EntityCacheTag, ServiceTypeStoreError, UIServiceType | undefined>;

  invalidateCache: () => Effect<never, never, void>;
};
```
Key aspects: Uses Svelte 5 runes (`$state`, `$derived`, `$effect`), `EntityCache` for caching, `storeEventBus` for cross-store communication, and Effect for robust orchestration of service calls and state updates.

## 6. hREA Integration

-   `ServiceType` entries in this zome are intended to map to hREA `ResourceSpecification` records in an economic network context. They define *what* kind of resource or service is being transacted or accounted for.
-   When a `Request` (hREA `Intent`) or `Offer` (hREA `Proposal`) is created, it links to one or more *approved* `ServiceType` ActionHashes. These links establish the connection to the underlying `ResourceSpecification`.

## 7. Usage Examples (TypeScript with Effect Store)

```typescript
import { pipe } from '@effect/data/Function';
import * as E from '@effect/io/Effect';
import { serviceTypesStore } from '@/stores/serviceTypes.store.svelte'; // Assuming singleton export
import type { ServiceType } from '@/types/holochain';

// Suggest a new Service Type
const newServiceTypeData: ServiceType = {
  name: 'Holochain Consulting',
  description: 'Expert advice and development services for Holochain projects.',
  tags: ['holochain', 'rust', 'decentralization', 'consulting'],
};

const suggestionEffect = serviceTypesStore.suggestServiceType(newServiceTypeData);
pipe(suggestionEffect, E.runPromise).then(console.log).catch(console.error);

// Fetch approved service types for a UI selector
const fetchApprovedEffect = serviceTypesStore.fetchApprovedServiceTypes();
pipe(
  fetchApprovedEffect,
  E.flatMap(() => E.succeed(serviceTypesStore.approvedServiceTypes)), // Access reactive state after effect completes
  E.runPromise
).then(approvedList => {
  console.log('Approved Service Types:', approvedList);
  // Update UI selector with approvedList
});

// Admin: Approve a pending service type
const pendingServiceTypeToApproveAh: ActionHash = 'uhCAk...'; // Get from pending list
const approveEffect = serviceTypesStore.approveServiceType(pendingServiceTypeToApproveAh);
pipe(approveEffect, E.runPromise).then(() => {
  console.log('Service Type approved');
  // Refresh pending and approved lists in UI
}).catch(console.error);
```

## 8. Considerations & Open Questions

-   **Category Field**: Re-evaluate if a formal `category: String` field (enum or free text) on `ServiceType` is needed for broader classification, or if `tags` are sufficient. Current decision: tags offer more flexibility.
-   **Soft Deletes vs. Hard Deletes**: For `admin_delete_service_type`, current implementation implies hard delete. Consider implications for audit trails and referential integrity. A soft delete (marking as 'deleted' or moving to a specific 'deleted' anchor) might be preferable for some use cases but adds complexity.
-   **Performance of Tag Queries**: For `get_all_service_type_tags` and `get_service_types_by_tag`, if the number of unique tags or service types per tag becomes extremely large, performance of link queries needs monitoring. Path-based sharding or alternative indexing might be needed in extreme scenarios.
-   **Error Granularity**: Ensure `ServiceTypeError` and `ServiceTypeStoreError` provide sufficient detail for debugging and user feedback.
-   **Admin Identification**: The mechanism for identifying administrators is external to this zome (e.g., a separate admin/roles zome or pre-defined list of admin pubkeys).
-   **Signal for UI updates**: When an admin approves/rejects a service type, the zome could emit a signal that subscribed clients can listen to for real-time UI updates, in addition to store-driven cache invalidation.
