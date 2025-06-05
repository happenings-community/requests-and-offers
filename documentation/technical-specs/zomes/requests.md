# Requests Zome

## Overview

The Requests zome provides core functionality for creating, managing, and finding support requests in the Requests and Offers application. Requests represent needs expressed by users, projects, or organizations seeking assistance, skills, or resources from other members of the community.

## Technical Implementation

The Requests zome is implemented in two parts:

- **Integrity:** `dnas/requests_and_offers/zomes/integrity/requests`
- **Coordinator:** `dnas/requests_and_offers/zomes/coordinator/requests`

### Entry Types

#### Request

The `Request` entry represents a request for support or resources with the following structure:

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Request {
  /// The title of the request
  pub title: String,
  /// A detailed description of the request (max 500 characters)
  pub description: String,
  /// ActionHashes of approved ServiceType entries that define the nature of the request.
  /// These are validated against the `service_types` zome.
  pub service_type_action_hashes: Vec<ActionHash>,
  /// How the requester prefers to be contacted (Email, Phone, Other)
  pub contact_preference: ContactPreference,
  /// The date range when the request is valid/needed
  pub date_range: Option<DateRange>,
  /// Estimated time needed in hours
  pub time_estimate_hours: Option<f32>,
  /// Preferred time of day for the work/interaction
  pub time_preference: TimePreference,
  /// The requester's time zone
  pub time_zone: Option<TimeZone>,
  /// Preferred method of exchange (Exchange, Arranged, PayItForward, Open)
  pub exchange_preference: ExchangePreference,
  /// Type of interaction preferred (Virtual, InPerson)
  pub interaction_type: InteractionType,
  /// Additional links or resources related to the request
  pub links: Vec<String>,
}
```

Where the supporting types are defined as:

```rust
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ContactPreference { 
  Email, 
  Phone, 
  Other 
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum TimePreference { 
  Morning, 
  Afternoon, 
  Evening, 
  NoPreference, 
  Other 
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ExchangePreference { 
  Exchange, 
  Arranged, 
  PayItForward, 
  Open 
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InteractionType { 
  Virtual, 
  InPerson 
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct DateRange {
  pub start: Option<Timestamp>,
  pub end: Option<Timestamp>,
}

// TimeZone is implemented as a String
pub type TimeZone = String;
```

### Link Types

The following link types are used to create relationships between requests and other entries:

- **AllRequests**: Links from a "requests" path to all request entries.
- **UserRequests**: Links from a user profile (Agent PubKey) to the requests created by that user.
- **OrganizationRequests**: Links from an organization's ActionHash to requests associated with it.
- **RequestCreator**: Links from a request's ActionHash to its creator's user profile (Agent PubKey).
- **RequestOrganization**: Links from a request's ActionHash to its associated organization's ActionHash (if any).
- **RequestToServiceType**: Links from a request's ActionHash to an approved `ServiceType` ActionHash. This defines the type of service being requested.
  - Base: `Request` ActionHash
  - Target: `ServiceType` ActionHash (must be an approved `ServiceType`)
  - Link Tag: e.g., `"defines_service_type"` or the `ServiceType` ActionHash itself.
- **RequestUpdates**: Links from the original request action to update actions.

## Core Functions

### Create Request

```rust
pub fn create_request(input: RequestInput) -> ExternResult<Record>
```

Creates a new request entry with the provided information. 

During creation, the `requests_coordinator` zome must:
- Validate that each `ActionHash` in `input.request.service_type_action_hashes` corresponds to an existing and *approved* `ServiceType` by calling the `service_types_coordinator` zome.
- Create `RequestToServiceType` links for each valid and approved `ServiceType` ActionHash.

**Parameters:**

- `input`: A `RequestInput` struct containing:
  - `request`: The request data
  - `organization`: Optional organization hash to associate with the request

**Returns:**

- `Record`: The created request record
- `Error`: If creation fails

**Access Control:**

- Requires a valid user profile for the agent

### Get Latest Request Record

```rust
pub fn get_latest_request_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

Retrieves the latest record for a request, following any update links.

**Parameters:**

- `original_action_hash`: The original action hash of the request

**Returns:**

- `Option<Record>`: The latest request record if found, None otherwise

### Get Latest Request

```rust
pub fn get_latest_request(original_action_hash: ActionHash) -> ExternResult<Request>
```

Retrieves the latest request entry data.

**Parameters:**

- `original_action_hash`: The original action hash of the request

**Returns:**

- `Request`: The latest request data
- `Error`: If request is not found or cannot be deserialized

### Update Request

```rust
pub fn update_request(input: UpdateRequestInput) -> ExternResult<Record>
```

Updates an existing request with new data.

During an update, if `service_type_action_hashes` are modified, the `requests_coordinator` zome must:
- Validate new `ServiceType` ActionHashes against approved types in the `service_types_coordinator` zome.
- Remove old `RequestToServiceType` links and create new ones as necessary.

**Parameters:**

- `input`: An `UpdateRequestInput` struct containing:
  - `original_action_hash`: The original action hash
  - `previous_action_hash`: The most recent action hash
  - `updated_request`: The updated request data

**Returns:**

- `Record`: The updated request record
- `Error`: If update fails

**Access Control:**

- Only the original author or an administrator can update a request

### Delete Request

```rust
pub fn delete_request(original_action_hash: ActionHash) -> ExternResult<Record>
```

Deletes a request and all associated links, including `RequestToServiceType` links.

**Parameters:**

- `original_action_hash`: The action hash of the request to delete

**Returns:**

- `Record`: The deleted request record
- `Error`: If deletion fails

**Access Control:**

- Only the original author or an administrator can delete a request

### Get All Requests

```rust
pub fn get_all_requests(_: ()) -> ExternResult<Vec<Record>>
```

Retrieves all requests in the system.

**Parameters:**

- None (empty tuple)

**Returns:**

- `Vec<Record>`: Array of all request records
- `Error`: If retrieval fails

### Get User Requests

```rust
pub fn get_user_requests(user_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all requests created by a specific user.

**Parameters:**

- `user_hash`: The action hash of the user profile

**Returns:**

- `Vec<Record>`: Array of request records created by the user
- `Error`: If retrieval fails

### Get Organization Requests

```rust
pub fn get_organization_requests(organization_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all requests associated with a specific organization.

**Parameters:**

- `organization_hash`: The action hash of the organization

**Returns:**

- `Vec<Record>`: Array of request records associated with the organization
- `Error`: If retrieval fails

### Get Request Creator

```rust
pub fn get_request_creator(request_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the creator of a request.

**Parameters:**

- `request_hash`: The action hash of the request

**Returns:**

- `Option<ActionHash>`: The action hash of the creator user profile, if found
- `Error`: If retrieval fails

### Get Request Organization

```rust
pub fn get_request_organization(request_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the organization associated with a request, if any.

**Parameters:**

- `request_hash`: The action hash of the request

**Returns:**

- `Option<ActionHash>`: The action hash of the associated organization, if any
- `Error`: If retrieval fails

## Validation Rules

### Request Validation

- Title must be between 3 and 50 characters.
- Description must be between 10 and 500 characters.
- `service_type_action_hashes` array must not be empty.
- Each `ActionHash` in `service_type_action_hashes` must point to a valid and *approved* `ServiceType` entry, validated by calling the `service_types_coordinator` zome.
- Links array must be present (can be empty).

## Client Integration

The UI integrates with the Requests zome through a layered architecture designed for clarity, testability, and robust asynchronous operations using Effect TS:

1.  **UI Components (`.svelte` files):** Users interact with Svelte components. These components subscribe to reactive state from a `RequestsStore` and trigger actions by calling methods on this store.
2.  **Requests Store (`requests.store.svelte.ts`):** This Svelte 5 store, built with runes (`$state`, `$derived`, `$effect`), manages the reactive state related to requests (e.g., lists of requests, loading states, errors). It orchestrates user actions by creating and running Effect pipelines. These pipelines typically involve:
    *   Calling methods on the `RequestsService`.
    *   Handling success and error outcomes.
    *   Updating the store's reactive state.
    *   Managing caching (`EntityCache`) and cross-store communication (`storeEventBus`).
    The store is instantiated as a singleton using a factory pattern, as detailed in `effect-patterns.md`.
3.  **Requests Service (`requests.service.ts`):** This service encapsulates all direct communication with the Holochain "requests" zome. It wraps zome calls within Effect computations, providing typed errors (`RequestError`) and abstracting the raw Holochain client interactions. It depends on the `HolochainClientServiceTag` for actual zome calls.
4.  **Holochain Zome (`requests_coordinator`):** The backend Rust zome executes the core business logic.

This pattern ensures a clean separation of concerns and leverages Effect TS for managing all side effects, asynchronous flows, and dependencies.

... (rest of the code remains the same)
### Requests Service

The `RequestsService` acts as a crucial bridge between the UI's state management layer (stores) and the Holochain backend. It encapsulates all direct calls to the "requests" zome functions. Key characteristics include:

-   **Effect-based Operations:** All methods return `Effect` types, allowing for composable, lazy, and robust asynchronous operations. This aligns with the patterns in `effect-patterns.md`.
-   **Typed Errors:** Zome call failures or business logic errors are mapped to a specific `RequestError` type, providing clear and typed error handling.
-   **Abstraction of Holochain Client:** It hides the complexities of `AppWebsocket.callZome`, offering a cleaner API to the rest of the frontend.
-   **Dependency Injection:** The service itself is typically provided as an Effect `Layer` and depends on the `HolochainClientServiceTag` (which provides the actual Holochain client instance) for its operations.

The service interface is defined as follows:

```typescript
export type RequestsService = {
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Effect<never, RequestError, Record>;
  getLatestRequestRecord: (originalActionHash: ActionHash) => Effect<never, RequestError, Record | null>;
  getLatestRequest: (originalActionHash: ActionHash) => Effect<never, RequestError, RequestInDHT | null>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Effect<never, RequestError, Record>;
  getAllRequestsRecords: () => Effect<never, RequestError, Record[]>;
  getUserRequestsRecords: (userHash: ActionHash) => Effect<never, RequestError, Record[]>;
  getOrganizationRequestsRecords: (organizationHash: ActionHash) => Effect<never, RequestError, Record[]>;
  deleteRequest: (requestHash: ActionHash) => Effect<never, RequestError, void>;
};
```

### Requests Store

The `RequestsStore` is the primary interface for UI components to interact with request-related data and operations. It follows the Effect-driven Svelte store pattern detailed in `effect-patterns.md`:

-   **Factory Pattern & Singleton Instantiation:** The store is created by a factory function that returns an Effect. This Effect, when run once with necessary dependencies (like `RequestsServiceTag`, `EntityCacheTag`, `StoreEventBusTag`), produces a singleton store instance.
-   **Reactive State with Svelte 5 Runes:** Internal state (e.g., `requests: $state([])`, `loading: $state(false)`, `error: $state(null)`) is managed using Svelte 5 runes for fine-grained reactivity.
-   **Effect-returning Methods:** Public methods (e.g., `createRequest`, `getAllRequests`) return `Effect` types. UI components call these methods and then run the returned Effect (e.g., using `E.runPromise(store.createRequest(...))`).
-   **Orchestration:** The store methods orchestrate calls to the `RequestsService`, handle caching logic using `EntityCache`, manage loading/error states, and emit/listen to events via `storeEventBus` for cross-store synchronization.
-   **`ServiceType` Handling:**
    -   When creating or updating requests, the `RequestInDHT` object passed to store methods will include `service_type_action_hashes`. These hashes are typically sourced from UI components like a `ServiceTypeSelector` which might interact with a `ServiceTypesStore`.
    -   For displaying requests, the store might fetch `ServiceType` details (names, descriptions) based on the stored `service_type_action_hashes`, potentially by coordinating with a `ServiceTypesStore` or by including resolved data in its `UIRequest` type.

The store interface is defined as:

```typescript
// Assuming UIRequest is a type that might include resolved ServiceType names for display
// and RequestInDHT is the TypeScript equivalent of the Rust Request struct.
// ServiceType would be imported from service_types zome's types.
import type { ActionHash, Record } from '@holochain/client';
import type { Effect } from '@effect/io/Effect';
import type { EntityCache, EntityCacheTag } from '$lib/utils/entityCache.effect'; // Example path
import type { StoreEventBusTag } from '$lib/utils/eventBus.effect'; // Example path
import type { RequestsServiceTag, RequestError } from '$lib/services/zomes/requests.service'; // Example path
import type { ServiceType } from '$lib/types/holochain/service_types'; // Example path
import type { RequestInDHT, ContactPreference, TimePreference, ExchangePreference, InteractionType } from '$lib/types/holochain/requests'; // Example path

export type RequestStoreError = RequestError | /* other store-specific errors */ Error;

export type UIRequest = RequestInDHT & { 
  original_action_hash: ActionHash; // Ensure original_action_hash is part of UIRequest
  resolvedServiceTypes?: ServiceType[];
  // Potentially other UI-specific fields like creator profile, organization details
};

export type RequestsStore = {
  // Reactive State (actual implementation uses $state internally, accessed via store.requests() etc.)
  readonly requests: UIRequest[]; 
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIRequest>;

  // Methods returning Effects
  getLatestRequest: (originalActionHash: ActionHash) => Effect<RequestsServiceTag | EntityCacheTag, RequestStoreError, UIRequest | null>;
  getAllRequests: () => Effect<RequestsServiceTag | EntityCacheTag | StoreEventBusTag, RequestStoreError, UIRequest[]>;
  getUserRequests: (userHash: ActionHash) => Effect<RequestsServiceTag | EntityCacheTag, RequestStoreError, UIRequest[]>;
  getOrganizationRequests: (organizationHash: ActionHash) => Effect<RequestsServiceTag | EntityCacheTag, RequestStoreError, UIRequest[]>;
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Effect<RequestsServiceTag | StoreEventBusTag, RequestStoreError, Record>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Effect<RequestsServiceTag | StoreEventBusTag, RequestStoreError, Record>;
  deleteRequest: (requestHash: ActionHash) => Effect<RequestsServiceTag | StoreEventBusTag, RequestStoreError, void>;
  invalidateCache: () => Effect<never, never, void>; // Example: might be an Effect if it involves async ops
};
```

Key implementation aspects include:

- **Svelte 5 runes (`$state`, `$derived`, `$effect`)** for reactive state management.
- **`EntityCache`** for caching fetched data to reduce backend calls and manage data consistency.
- **`storeEventBus`** for cross-store communication (e.g., invalidating related caches in other stores upon creation/update/deletion of a request) and state synchronization.
- **`Effect`** for robust error handling, composable asynchronous operations, and managing dependencies via `Context.Tag` and `Layer`.

## hREA Integration

Requests are designed to integrate with the hREA economic model as follows:

- Requests are mapped to hREA `Intents`.
- The `ServiceType` entries linked to a Request (via `service_type_action_hashes`) are mapped to hREA `ResourceSpecifications`. These `ServiceTypes` define the skills or services being requested.
- Request process states align with hREA economic process states

## Usage Examples

### Creating a Request

```typescript
// Using the requests store
// Assume serviceTypeActionHash1, serviceTypeActionHash2 are ActionHashes of approved ServiceTypes
// obtained from a ServiceTypeSelector component or ServiceTypesStore.
// RequestInDHT should match the Rust struct definition, excluding fields auto-set by the zome (like creator, timestamp).
const newRequestData: RequestInDHT = {
  title: "Development assistance needed for UI components",
  description: "Looking for a Svelte expert to help build reusable UI components for our Holochain app, focusing on accessibility and performance. Experience with Effect TS is a plus.",
  service_type_action_hashes: [serviceTypeActionHash1, serviceTypeActionHash2],
  contact_preference: ContactPreference.Email, // Ensure ContactPreference enum/type is imported/available
  time_preference: TimePreference.NoPreference, // Ensure TimePreference enum/type is imported/available
  exchange_preference: ExchangePreference.Arranged, // Ensure ExchangePreference enum/type is imported/available
  interaction_type: InteractionType.Virtual, // Ensure InteractionType enum/type is imported/available
  // date_range, time_estimate_hours, time_zone, links are optional or can be set as needed
  date_range: { start: new Date().toISOString(), end: null }, // Example: using ISOString for Timestamps
  time_estimate_hours: 20.5,
  links: ["https://github.com/project-repo/issues/123"]
};

// For a personal request
const result = await pipe(
  requestsStore.createRequest(newRequest),
  E.runPromise
);

// For an organization request
const result = await pipe(
  requestsStore.createRequest(newRequest, organizationHash),
  E.runPromise
);
```

### Getting All Requests

```typescript
// Using the requests store
const allRequests = await pipe(
  requestsStore.getAllRequests(),
  E.runPromise
);
```

### Updating a Request

```typescript
// Using the requests store
const updatedRequest: RequestInDHT = {
  ...existingRequest,
  title: "Updated title",
  description: "Updated description"
};

const result = await pipe(
  requestsStore.updateRequest(
    existingRequest.original_action_hash,
    existingRequest.previous_action_hash,
    updatedRequest
  ),
  E.runPromise
);
```

### Deleting a Request

```typescript
// Using the requests store
await pipe(
  requestsStore.deleteRequest(requestHash),
  E.runPromise
);
```
