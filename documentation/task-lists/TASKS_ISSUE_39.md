# Dynamic ServiceType DHT Entry Implementation Plan

## Overview

[GitHub Issue #39](https://github.com/happenings-community/requests-and-offers/issues/39) outlines the implementation of a new `ServiceType` DHT entry to replace the current string-based service/skill representation in Requests and Offers. This will provide better categorization, searchability, and management of service types across the application.

## Current State Analysis

Currently, the application uses simple string arrays for service types:

- Requests have a `requirements` field (`Vec<String>`)
- Offers have a `capabilities` field (`Vec<String>`)

This approach has limitations:

- No standardization of service types
- Limited search capabilities
- No metadata for service types (descriptions, categories, etc.)
- No way to manage or update service types system-wide

## Implementation Goals

1. Create a new `ServiceType` DHT entry with appropriate metadata
2. Implement integrity and coordinator zomes for ServiceType management
3. Establish links between Requests/Offers and ServiceTypes
4. Update UI to use the new ServiceType system
5. Maintain backward compatibility where possible

## Completed Tasks

- [x] 1. Create `service_types_integrity` zome structure
    - [x] Define `ServiceType` entry struct (`name`, `description`, `category`, `tags`)
    - [x] Define `EntryTypes` enum for `ServiceType`
    - [x] Define `LinkTypes` enum:
        - `ServiceTypeUpdates`
        - `AllServiceTypes`
        - `ServiceTypesByCategory`
        - `ServiceTypeToRequest`
        - `RequestToServiceType`
        - `ServiceTypeToOffer`
        - `OfferToServiceType`
    - [x] Implement basic `validate` function stubs for `ServiceType` entry and link operations.
- [x] 2. Implement `ServiceType` entry validation
    - [x] 2.1. Validate `ServiceType` name (non-empty)
    - [x] 2.2. Validate `ServiceType` description (non-empty)
    - [x] 2.3. Add any other necessary validation for `ServiceType` fields. (category non-empty, author validation for update/delete)
- [x] 4. Refactor `requests_integrity` zome (Integrity parts completed)
    - [x] 4.1. Remove `service_type_action_hashes: Vec<ActionHash>` field from `Request` struct in `request.rs`.
    - [x] 4.2. Remove `RequestSkills` from `LinkTypes` enum in `lib.rs`.
    - [x] 4.3. Update `validate` function to remove logic related to `RequestSkills` if any.
- [x] 5. Refactor `offers_integrity` zome (Integrity parts completed)
    - [x] 5.1. Remove `service_type_action_hashes: Vec<ActionHash>` field from `Offer` struct in `offer.rs`.
    - [x] 5.2. Remove `OfferCapabilities` from `LinkTypes` enum in `lib.rs`.
    - [x] 5.3. Update `validate` function to remove logic related to `OfferCapabilities` if any.

## Completed Tasks (continued)

- [x] 3. Refactor `service_types_integrity` zome
    - [x] 3.1. Create a new file `service_type.rs` for the `ServiceType` struct and its validation logic
    - [x] 3.2. Update `lib.rs` to use the proper HDI imports and follow the pattern of other integrity zomes
    - [x] 3.3. Implement a streamlined validation function that matches the pattern in other integrity zomes
    - [x] 3.4. Fix all compilation errors and ensure the zome builds successfully

## In Progress Tasks

- [ ] 6. Update DNA manifest (`dna.yaml`)
    - [x] 6.1. Add `service_types_integrity` zome to the integrity zomes list.
    - [ ] 6.2. (Coordinator zome task) Add `service_types_coordinator` zome.
    - [ ] 6.3. (Coordinator zome task) Define cross-zome call capabilities between coordinator zomes and `service_types_coordinator`.

## Future Tasks

### Backend Implementation

- [ ] Implement Link Validation in `service_types_integrity`
  - [ ] Validate `CreateLink` for `ServiceTypeToRequest` and `RequestToServiceType`.
  - [ ] Validate `CreateLink` for `ServiceTypeToOffer` and `OfferToServiceType`.
  - [ ] Ensure base and target entries are of expected types for each link.
  - [ ] Implement `DeleteLink` validation.
- [ ] Implement ServiceType Verification Mechanism (within `service_types_integrity`)
  - [ ] Define `VerificationRecord` entry struct (e.g., `verified_service_type_ah: ActionHash`, `timestamp: Timestamp`, `verifier_pub_key: AgentPubKey`, `reason: Option<String>`).
  - [ ] Add `VerificationRecord` to `EntryTypes` enum in `service_types_integrity/lib.rs`.
  - [ ] Define new `LinkTypes` for verification in `service_types_integrity/lib.rs`:
    - `ServiceTypeToVerificationRecord` (links a `ServiceType` to its `VerificationRecord`).
    - `VerificationRecordToServiceType` (reverse link for querying, possibly points to the specific `ServiceType` ActionHash).
    - `VerifiedIndexAnchorToRecord` (links a conceptual "verified services index" anchor to individual `VerificationRecord` entries for discoverability).
  - [ ] Update `validate` function in `service_types_integrity/lib.rs` to handle `VerificationRecord` creation/updates and the new verification-related link types. Ensure only authorized agents can create/manage verifications if applicable.
- [ ] Write tests for `service_types` zome functionality
  - [ ] Write unit tests for `ServiceType` entry creation and validation.
  - [ ] Write unit tests for link creation and validation (`ServiceTypeToRequest`, `RequestToServiceType`, `ServiceTypeToOffer`, `OfferToServiceType`).
  - [ ] Write Tryorama tests for cross-zome interactions.
- [ ] Update UI to use the new ServiceType system
  - [ ] Create TypeScript types for ServiceType in `ui/src/lib/types/holochain.ts`
  - [ ] Create UI types for ServiceType in `ui/src/lib/types/ui.ts`
  - [ ] Implement ServiceType service layer in `ui/src/lib/services/serviceTypes.service.ts`
  - [ ] Implement ServiceType store in `ui/src/lib/stores/serviceTypes.store.svelte.ts`
  - [ ] Create ServiceType selector component in `ui/src/lib/components/shared/ServiceTypeSelector.svelte`
  - [ ] Update RequestForm to use ServiceTypeSelector
  - [ ] Update OfferForm to use ServiceTypeSelector
  - [ ] Update RequestCard/RequestDetails to display ServiceTypes
  - [ ] Update OfferCard/OfferDetails to display ServiceTypes
  - [ ] Add ServiceType management UI for administrators
  - [ ] Implement search/filter by ServiceType functionality
- [ ] 4.4. (Coordinator zome task) Update `requests_coordinator` zome functions to call `service_types_coordinator` for linking requests to service types.
- [ ] 5.4. (Coordinator zome task) Update `offers_coordinator` zome functions to call `service_types_coordinator` for linking offers to service types.

### Frontend Implementation

- [ ] Create TypeScript types for ServiceType in `ui/src/lib/types/holochain.ts`
- [ ] Create UI types for ServiceType in `ui/src/lib/types/ui.ts`
- [ ] Implement ServiceType service layer in `ui/src/lib/services/serviceTypes.service.ts`
- [ ] Implement ServiceType store in `ui/src/lib/stores/serviceTypes.store.svelte.ts`
- [ ] Create ServiceType selector component in `ui/src/lib/components/shared/ServiceTypeSelector.svelte`
- [ ] Update RequestForm to use ServiceTypeSelector
- [ ] Update OfferForm to use ServiceTypeSelector
- [ ] Update RequestCard/RequestDetails to display ServiceTypes
- [ ] Update OfferCard/OfferDetails to display ServiceTypes
- [ ] Add ServiceType management UI for administrators
- [ ] Implement search/filter by ServiceType functionality

### Documentation Updates

- [ ] Update `documentation/technical-specs/zomes/requests.md`
- [ ] Update `documentation/technical-specs/zomes/offers.md`
- [ ] Create `documentation/technical-specs/zomes/service_types.md`
- [ ] Update relevant architecture documentation
- [ ] Update `work-in-progress.md` and `status.md`

## Implementation Details

### ServiceType Entry Structure

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
  /// The name of the service type
  pub name: String,
  /// A description of the service type
  pub description: Option<String>,
  /// The category this service type belongs to (optional)
  pub category: Option<String>,
  /// Tags for additional classification
  pub tags: Vec<String>,
  /// Whether this service type is verified by an administrator
  pub verified: bool,
}
```

> Note: Creator and timestamp information is retrieved from the Entry's Header metadata rather than storing it in the Entry itself.

### Link Types to Implement

```rust
// In service_types_integrity
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  ServiceTypeUpdates,
  AllServiceTypes,
  ServiceTypesByCategory,
  ServiceTypeToRequest,
  RequestToServiceType,
  ServiceTypeToOffer,
  OfferToServiceType,
  ServiceTypeToVerificationRecord,
  VerificationRecordToServiceType,
  VerifiedIndexAnchorToRecord,
}
```

> Note: All link types are defined in the service_types_integrity zome. The requests and offers zomes will use external calls to the service_types zome to manage links rather than implementing their own link types.

### Core Functions for ServiceType Zome

```rust
// Create a new service type
pub fn create_service_type(service_type: ServiceType) -> ExternResult<Record>;

// Get a service type by its hash
pub fn get_service_type(service_type_hash: ActionHash) -> ExternResult<ServiceType>;

// Update a service type
pub fn update_service_type(
  original_action_hash: ActionHash,
  previous_action_hash: ActionHash,
  updated_service_type: ServiceType
) -> ExternResult<Record>;

// Delete a service type
pub fn delete_service_type(service_type_hash: ActionHash) -> ExternResult<ActionHash>;

// Get all service types
pub fn get_all_service_types() -> ExternResult<Vec<Record>>;

// Get service types by category
pub fn get_service_types_by_category(category: String) -> ExternResult<Vec<Record>>;
```

### UI Component: ServiceTypeSelector

A reusable component for selecting service types with features:

- Search functionality
- Multiple selection
- Creation of new service types (with admin approval)
- Categorized display
- Autocomplete

### Migration Strategy

1. Create the new ServiceType system with initial data
2. When displaying existing Requests/Offers, convert string requirements/capabilities to ServiceType references
3. When editing existing Requests/Offers, migrate to the new system
4. Provide admin tools to standardize and categorize service types

## Technical Considerations

### Effect TS Integration

The ServiceType store will follow the project's Effect TS patterns:

```typescript
export type ServiceTypesStore = {
  readonly serviceTypes: UIServiceType[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIServiceType>;

  getAllServiceTypes: () => Effect<
    never,
    ServiceTypeStoreError,
    UIServiceType[]
  >;
  getServiceTypesByCategory: (
    category: string
  ) => Effect<never, ServiceTypeStoreError, UIServiceType[]>;
  createServiceType: (
    serviceType: ServiceTypeInput
  ) => Effect<never, ServiceTypeStoreError, Record>;
  updateServiceType: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedServiceType: ServiceTypeInput
  ) => Effect<never, ServiceTypeStoreError, Record>;
  deleteServiceType: (
    serviceTypeHash: ActionHash
  ) => Effect<never, ServiceTypeStoreError, void>;
  invalidateCache: () => void;
};
```

### Svelte 5 Integration

The ServiceTypeSelector component will use Svelte 5 runes:

```typescript
function ServiceTypeSelector() {
  let selectedTypes = $state<UIServiceType[]>([]);
  let searchTerm = $state("");
  let availableTypes = $derived(
    serviceTypesStore.serviceTypes.filter((type) =>
      type.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  // ... other Svelte 5 logic

  return {
    // ... component API
  };
}
