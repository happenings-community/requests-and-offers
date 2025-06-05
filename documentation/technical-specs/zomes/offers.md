# Offers Zome

## Overview

The Offers zome provides core functionality for creating, managing, and finding support offers in the Requests and Offers application. Offers represent capabilities, skills, or resources that users, projects, or organizations can provide to other members of the community.

## Technical Implementation

The Offers zome is implemented in two parts:

- **Integrity:** `dnas/requests_and_offers/zomes/integrity/offers`
- **Coordinator:** `dnas/requests_and_offers/zomes/coordinator/offers`

### Entry Types

#### Offer

The `Offer` entry represents an offer of support or resources with the following structure:

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct Offer {
  /// The title of the offer
  pub title: String,
  /// A detailed description of the offer (max 500 characters)
  pub description: String,
  /// ActionHashes of approved ServiceType entries that define the nature of the offer.
  /// These are validated against the `service_types` zome.
  pub service_type_action_hashes: Vec<ActionHash>,
  /// Preferred time of day for the work/interaction
  pub time_preference: TimePreference,
  /// The offerer's time zone
  pub time_zone: Option<TimeZone>,
  /// Preferred method of exchange (Exchange, Arranged, PayItForward, Open)
  pub exchange_preference: ExchangePreference,
  /// Type of interaction offered (Virtual, InPerson)
  pub interaction_type: InteractionType,
  /// Additional links or resources related to the offer
  pub links: Vec<String>,
}
```

Where the supporting types are defined as:

```rust
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

// TimeZone is implemented as a String
pub type TimeZone = String;
```

### Link Types

The following link types are used to create relationships between offers and other entries:

- **AllOffers**: Links from an "offers" path to all offer entries.
- **UserOffers**: Links from a user profile (Agent PubKey) to the offers created by that user.
- **OrganizationOffers**: Links from an organization's ActionHash to offers associated with it.
- **OfferCreator**: Links from an offer's ActionHash to its creator's user profile (Agent PubKey).
- **OfferOrganization**: Links from an offer's ActionHash to its associated organization's ActionHash (if any).
- **OfferToServiceType**: Links from an offer's ActionHash to an approved `ServiceType` ActionHash. This defines the type of service being offered.
  - Base: `Offer` ActionHash
  - Target: `ServiceType` ActionHash (must be an approved `ServiceType`)
  - Link Tag: e.g., `"defines_service_type"` or the `ServiceType` ActionHash itself.
- **OfferUpdates**: Links from the original offer action to update actions.

## Core Functions

### Create Offer

```rust
pub fn create_offer(input: OfferInput) -> ExternResult<Record>
```

Creates a new offer entry with the provided information.

During creation, the `offers_coordinator` zome must:
- Validate that each `ActionHash` in `input.offer.service_type_action_hashes` corresponds to an existing and *approved* `ServiceType` by calling the `service_types_coordinator` zome.
- Create `OfferToServiceType` links for each valid and approved `ServiceType` ActionHash.

**Parameters:**

- `input`: An `OfferInput` struct containing:
  - `offer`: The offer data
  - `organization`: Optional organization hash to associate with the offer

**Returns:**

- `Record`: The created offer record
- `Error`: If creation fails

**Access Control:**

- Requires a valid user profile for the agent

### Get Latest Offer Record

```rust
pub fn get_latest_offer_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

Retrieves the latest record for an offer, following any update links.

**Parameters:**

- `original_action_hash`: The original action hash of the offer

**Returns:**

- `Option<Record>`: The latest offer record if found, None otherwise

### Get Latest Offer

```rust
pub fn get_latest_offer(original_action_hash: ActionHash) -> ExternResult<Offer>
```

Retrieves the latest offer entry data.

**Parameters:**

- `original_action_hash`: The original action hash of the offer

**Returns:**

- `Offer`: The latest offer data
- `Error`: If offer is not found or cannot be deserialized

### Update Offer

```rust
pub fn update_offer(input: UpdateOfferInput) -> ExternResult<Record>
```

Updates an existing offer with new data.

During an update, if `service_type_action_hashes` are modified, the `offers_coordinator` zome must:
- Validate new `ServiceType` ActionHashes against approved types in the `service_types_coordinator` zome.
- Remove old `OfferToServiceType` links and create new ones as necessary.

**Parameters:**

- `input`: An `UpdateOfferInput` struct containing:
  - `original_action_hash`: The original action hash
  - `previous_action_hash`: The most recent action hash
  - `updated_offer`: The updated offer data

**Returns:**

- `Record`: The updated offer record
- `Error`: If update fails

**Access Control:**

- Only the original author or an administrator can update an offer

### Delete Offer

```rust
pub fn delete_offer(original_action_hash: ActionHash) -> ExternResult<Record>
```

Deletes an offer and all associated links, including `OfferToServiceType` links.

**Parameters:**

- `original_action_hash`: The action hash of the offer to delete

**Returns:**

- `Record`: The deleted offer record
- `Error`: If deletion fails

**Access Control:**

- Only the original author or an administrator can delete an offer

### Get All Offers

```rust
pub fn get_all_offers(_: ()) -> ExternResult<Vec<Record>>
```

Retrieves all offers in the system.

**Parameters:**

- None (empty tuple)

**Returns:**

- `Vec<Record>`: Array of all offer records
- `Error`: If retrieval fails

### Get User Offers

```rust
pub fn get_user_offers(user_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all offers created by a specific user.

**Parameters:**

- `user_hash`: The action hash of the user profile

**Returns:**

- `Vec<Record>`: Array of offer records created by the user
- `Error`: If retrieval fails

### Get Organization Offers

```rust
pub fn get_organization_offers(organization_hash: ActionHash) -> ExternResult<Vec<Record>>
```

Retrieves all offers associated with a specific organization.

**Parameters:**

- `organization_hash`: The action hash of the organization

**Returns:**

- `Vec<Record>`: Array of offer records associated with the organization
- `Error`: If retrieval fails

### Get Offer Creator

```rust
pub fn get_offer_creator(offer_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the creator of an offer.

**Parameters:**

- `offer_hash`: The action hash of the offer

**Returns:**

- `Option<ActionHash>`: The action hash of the creator user profile, if found
- `Error`: If retrieval fails

### Get Offer Organization

```rust
pub fn get_offer_organization(offer_hash: ActionHash) -> ExternResult<Option<ActionHash>>
```

Retrieves the organization associated with an offer, if any.

**Parameters:**

- `offer_hash`: The action hash of the offer

**Returns:**

- `Option<ActionHash>`: The action hash of the associated organization, if any
- `Error`: If retrieval fails

## Validation Rules

### Offer Validation

- Title must be between 3 and 50 characters.
- Description must be between 10 and 500 characters.
- `service_type_action_hashes` array must not be empty.
- Each `ActionHash` in `service_type_action_hashes` must point to a valid and *approved* `ServiceType` entry, validated by calling the `service_types_coordinator` zome.
- Time preference must be specified.
- Exchange preference must be specified.
- Interaction type must be specified.
- Links array must be present (can be empty).

## Client Integration

The UI integrates with the Offers zome through a layered architecture designed for clarity, testability, and robust asynchronous operations using Effect TS:

1.  **UI Components (`.svelte` files):** Users interact with Svelte components. These components subscribe to reactive state from an `OffersStore` and trigger actions by calling methods on this store.
2.  **Offers Store (`offers.store.svelte.ts`):** This Svelte 5 store, built with runes (`$state`, `$derived`, `$effect`), manages the reactive state related to offers (e.g., lists of offers, loading states, errors). It orchestrates user actions by creating and running Effect pipelines. These pipelines typically involve:
    *   Calling methods on the `OffersService`.
    *   Handling success and error outcomes.
    *   Updating the store's reactive state.
    *   Managing caching (`EntityCache`) and cross-store communication (`storeEventBus`).
    The store is instantiated as a singleton using a factory pattern, as detailed in `effect-patterns.md`.
3.  **Offers Service (`offers.service.ts`):** This service encapsulates all direct communication with the Holochain "offers" zome. It wraps zome calls within Effect computations, providing typed errors (`OfferError`) and abstracting the raw Holochain client interactions. It depends on the `HolochainClientServiceTag` for actual zome calls.
4.  **Holochain Zome (`offers_coordinator`):** The backend Rust zome executes the core business logic.

This pattern ensures a clean separation of concerns and leverages Effect TS for managing all side effects, asynchronous flows, and dependencies.

### Offers Service

The `OffersService` acts as a crucial bridge between the UI's state management layer (stores) and the Holochain backend. It encapsulates all direct calls to the "offers" zome functions. Key characteristics include:

-   **Effect-based Operations:** All methods return `Effect` types, allowing for composable, lazy, and robust asynchronous operations. This aligns with the patterns in `effect-patterns.md`.
-   **Typed Errors:** Zome call failures or business logic errors are mapped to a specific `OfferError` type, providing clear and typed error handling.
-   **Abstraction of Holochain Client:** It hides the complexities of `AppWebsocket.callZome`, offering a cleaner API to the rest of the frontend.
-   **Dependency Injection:** The service itself is typically provided as an Effect `Layer` and depends on the `HolochainClientServiceTag` (which provides the actual Holochain client instance) for its operations.

The service interface is defined as follows:

```typescript
export type OffersService = {
  createOffer: (offer: OfferInDHT, organizationHash?: ActionHash) => Effect<never, OfferError, Record>;
  getLatestOfferRecord: (originalActionHash: ActionHash) => Effect<never, OfferError, Record | null>;
  getLatestOffer: (originalActionHash: ActionHash) => Effect<never, OfferError, OfferInDHT | null>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => Effect<never, OfferError, Record>;
  getAllOffersRecords: () => Effect<never, OfferError, Record[]>;
  getUserOffersRecords: (userHash: ActionHash) => Effect<never, OfferError, Record[]>;
  getOrganizationOffersRecords: (organizationHash: ActionHash) => Effect<never, OfferError, Record[]>;
  deleteOffer: (offerHash: ActionHash) => Effect<never, OfferError, void>;
};
```

### Offers Store

The `OffersStore` is the primary interface for UI components to interact with offer-related data and operations. It follows the Effect-driven Svelte store pattern detailed in `effect-patterns.md`:

-   **Factory Pattern & Singleton Instantiation:** The store is created by a factory function that returns an Effect. This Effect, when run once with necessary dependencies (like `OffersServiceTag`, `EntityCacheTag`, `StoreEventBusTag`), produces a singleton store instance.
-   **Reactive State with Svelte 5 Runes:** Internal state (e.g., `offers: $state([])`, `loading: $state(false)`, `error: $state(null)`) is managed using Svelte 5 runes for fine-grained reactivity.
-   **Effect-returning Methods:** Public methods (e.g., `createOffer`, `getAllOffers`) return `Effect` types. UI components call these methods and then run the returned Effect (e.g., using `E.runPromise(store.createOffer(...))`).
-   **Orchestration:** The store methods orchestrate calls to the `OffersService`, handle caching logic using `EntityCache`, manage loading/error states, and emit/listen to events via `storeEventBus` for cross-store synchronization.
-   **`ServiceType` Handling:**
    -   When creating or updating offers, the `OfferInDHT` object passed to store methods will include `service_type_action_hashes`. These hashes are typically sourced from UI components like a `ServiceTypeSelector` which might interact with a `ServiceTypesStore`.
    -   For displaying offers, the store might fetch `ServiceType` details (names, descriptions) based on the stored `service_type_action_hashes`, potentially by coordinating with a `ServiceTypesStore` or by including resolved data in its `UIOffer` type.

The store interface is defined as:

```typescript
// Assuming UIOffer is a type that might include resolved ServiceType names for display
// and OfferInDHT is the TypeScript equivalent of the Rust Offer struct.
import type { ActionHash, Record } from '@holochain/client';
import type { Effect } from '@effect/io/Effect';
import type { EntityCache, EntityCacheTag } from '$lib/utils/entityCache.effect'; // Example path
import type { StoreEventBusTag } from '$lib/utils/eventBus.effect'; // Example path
import type { OffersServiceTag, OfferError } from '$lib/services/zomes/offers.service'; // Example path
import type { ServiceType } from '$lib/types/holochain/service_types'; // Example path
import type { OfferInDHT, TimePreference, ExchangePreference, InteractionType } from '$lib/types/holochain/offers'; // Example path

export type OfferStoreError = OfferError | /* other store-specific errors */ Error;

export type UIOffer = OfferInDHT & { 
  original_action_hash: ActionHash; // Ensure original_action_hash is part of UIOffer
  resolvedServiceTypes?: ServiceType[]; 
  // Potentially other UI-specific fields like creator profile, organization details
};

export type OffersStore = {
  // Reactive State (actual implementation uses $state internally, accessed via store.offers() etc.)
  readonly offers: UIOffer[]; 
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIOffer>;

  // Methods returning Effects
  getLatestOffer: (originalActionHash: ActionHash) => Effect<OffersServiceTag | EntityCacheTag, OfferStoreError, UIOffer | null>;
  getAllOffers: () => Effect<OffersServiceTag | EntityCacheTag | StoreEventBusTag, OfferStoreError, UIOffer[]>;
  getUserOffers: (userHash: ActionHash) => Effect<OffersServiceTag | EntityCacheTag, OfferStoreError, UIOffer[]>;
  getOrganizationOffers: (organizationHash: ActionHash) => Effect<OffersServiceTag | EntityCacheTag, OfferStoreError, UIOffer[]>;
  createOffer: (offer: OfferInDHT, organizationHash?: ActionHash) => Effect<OffersServiceTag | StoreEventBusTag, OfferStoreError, Record>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => Effect<OffersServiceTag | StoreEventBusTag, OfferStoreError, Record>;
  deleteOffer: (offerHash: ActionHash) => Effect<OffersServiceTag | StoreEventBusTag, OfferStoreError, void>;
  invalidateCache: () => Effect<never, never, void>; // Example: might be an Effect if it involves async ops
};
```

Key implementation aspects include:

- **Svelte 5 runes (`$state`, `$derived`, `$effect`)** for reactive state management.
- **`EntityCache`** for caching fetched data to reduce backend calls and manage data consistency.
- **`storeEventBus`** for cross-store communication (e.g., invalidating related caches in other stores upon creation/update/deletion of an offer) and state synchronization.
- **`Effect`** for robust error handling, composable asynchronous operations, and managing dependencies via `Context.Tag` and `Layer`.

## hREA Integration

Offers are designed to integrate with the hREA economic model as follows:

- Offers are mapped to hREA `Proposals` (or `Intents` depending on the specific hREA mapping interpretation, typically `Proposals`).
- The `ServiceType` entries linked to an Offer (via `service_type_action_hashes`) are mapped to hREA `ResourceSpecifications`. These `ServiceTypes` define the skills or services being offered.
- Offer process states align with hREA economic process states

## Usage Examples

### Creating an Offer

```typescript
// Using the offers store
// Assume serviceTypeActionHash1, serviceTypeActionHash2 are ActionHashes of approved ServiceTypes
// obtained from a ServiceTypeSelector component or ServiceTypesStore.
// OfferInDHT should match the Rust struct definition, excluding fields auto-set by the zome (like creator, timestamp).
const newOfferData: OfferInDHT = {
  title: "Svelte & Effect TS Expertise Available",
  description: "Offering development services for Holochain frontends using Svelte 5, Effect TS, and TailwindCSS. Can help build reactive UIs and integrate with Holochain zomes.",
  service_type_action_hashes: [serviceTypeActionHash1, serviceTypeActionHash2],
  time_preference: TimePreference.Afternoon, // Ensure TimePreference enum/type is imported/available
  exchange_preference: ExchangePreference.Exchange, // Ensure ExchangePreference enum/type is imported/available
  interaction_type: InteractionType.Virtual, // Ensure InteractionType enum/type is imported/available
  // time_zone, links are optional or can be set as needed
  time_zone: "America/New_York",
  links: ["https://linkedin.com/in/myprofile"]
};

// For a personal offer
const result = await pipe(
  offersStore.createOffer(newOffer),
  E.runPromise
);

// For an organization offer
const result = await pipe(
  offersStore.createOffer(newOffer, organizationHash),
  E.runPromise
);
```

### Getting All Offers

```typescript
// Using the offers store
const allOffers = await pipe(
  offersStore.getAllOffers(),
  E.runPromise
);
```

### Updating an Offer

```typescript
// Using the offers store
const updatedOffer: OfferInDHT = {
  ...existingOffer,
  title: "Updated title",
  description: "Updated description"
};

const result = await pipe(
  offersStore.updateOffer(
    existingOffer.original_action_hash,
    existingOffer.previous_action_hash,
    updatedOffer
  ),
  E.runPromise
);
```

### Deleting an Offer

```typescript
// Using the offers store
await pipe(
  offersStore.deleteOffer(offerHash),
  E.runPromise
);
```
