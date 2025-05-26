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

- [x] 6. Update DNA manifest (`dna.yaml`)
    - [x] 6.1. Add `service_types_integrity` zome to the integrity zomes list.
    - [x] 6.2. Add `service_types_coordinator` zome with proper dependencies.
    - [x] 6.3. Define cross-zome call capabilities between coordinator zomes and `service_types_coordinator`.

- [x] 7. Implement `service_types_coordinator` zome
    - [x] 7.1. Create complete CRUD operations for ServiceType management
    - [x] 7.2. Implement admin-only access control for ServiceType operations
    - [x] 7.3. Create bidirectional linking functions between ServiceTypes and Requests/Offers
    - [x] 7.4. Implement link management functions (create, update, delete service type links)
    - [x] 7.5. Add utility functions for querying service types and their relationships

- [x] 8. Refactor input types for better polymorphism
    - [x] 8.1. Merge `LinkToServiceTypeInput` and `UnlinkFromServiceTypeInput` into unified `ServiceTypeLinkInput`
    - [x] 8.2. Update all coordinator zomes to use the new unified type
    - [x] 8.3. Ensure clear separation of concerns between service_types zome and requests/offers zomes

- [x] 9. Update `requests_coordinator` zome for ServiceType integration
    - [x] 9.1. Update `RequestInput` to use `service_type_hashes: Vec<ActionHash>` instead of single hash
    - [x] 9.2. Refactor request creation to use service_types zome functions for link management
    - [x] 9.3. Update request update logic to delegate service type link management to service_types zome
    - [x] 9.4. Update request deletion to properly clean up service type links via service_types zome
    - [x] 9.5. Remove manual link management code and use external calls for separation of concerns

- [x] 10. Update `offers_coordinator` zome for ServiceType integration
    - [x] 10.1. Update `OfferInput` to use `service_type_hashes: Vec<ActionHash>` instead of single hash
    - [x] 10.2. Refactor offer creation to use service_types zome functions for link management
    - [x] 10.3. Update offer update logic to delegate service type link management to service_types zome
    - [x] 10.4. Update offer deletion to properly clean up service type links via service_types zome
    - [x] 10.5. Remove manual link management code and use external calls for separation of concerns

## In Progress Tasks

- [ ] 11. Complete test implementation
    - [x] 11.1. Create test directory structure (`tests/src/requests_and_offers/service-types-tests/`)
    - [x] 11.2. Create common test utilities (`common.ts`)
    - [x] 11.3. Start basic test file structure (`service-types.test.ts`)
    - [ ] 11.4. Fix remaining test linter errors (TypeScript API issues)
    - [ ] 11.5. Complete comprehensive test coverage for all ServiceType operations

## Future Tasks

### Backend Implementation

- [ ] 12. Implement Link Validation in `service_types_integrity` (use the other zomes as reference)
  - [ ] 12.1. Validate `CreateLink` for `ServiceTypeToRequest` and `RequestToServiceType`.
  - [ ] 12.2. Validate `CreateLink` for `ServiceTypeToOffer` and `OfferToServiceType`.
  - [ ] 12.3. Ensure base and target entries are of expected types for each link.
  - [ ] 12.4. Implement `DeleteLink` validation.

- [ ] 13. Complete comprehensive test coverage
  - [ ] 13.1. Write unit tests for `ServiceType` CRUD operations:
    - [ ] Test `create_service_type` with valid and invalid inputs
    - [ ] Test `get_service_type` for existing and non-existing service types
    - [ ] Test `update_service_type` with valid and invalid updates
    - [ ] Test `delete_service_type` and verify cleanup
    - [ ] Test `get_all_service_types` returns expected results
  - [ ] 13.2. Test admin access control:
    - [ ] Verify only admins can create/update/delete service types
    - [ ] Test error handling for unauthorized operations
  - [ ] 13.3. Write integration tests for cross-zome interactions:
    - [ ] Test linking service types to requests
    - [ ] Test linking service types to offers
    - [ ] Test retrieving requests/offers by service type
  - [ ] 13.4. Add test data setup and teardown utilities
  - [ ] 13.5. Test error conditions and edge cases

- [ ] 14. Update existing request and offer tests to work with service types
  - [ ] 14.1. Modify test setup to create necessary service types
  - [ ] 14.2. Update test assertions to verify service type links
  - [ ] 14.3. Add new test cases for service type related functionality
  - [ ] 14.4. Test request/offer filtering by service type

- [ ] 15. Implement ServiceType Verification Mechanism (within `service_types_integrity`)
  - [ ] 15.1. Define `VerificationRecord` entry struct (e.g., `verified_service_type_ah: ActionHash`, `timestamp: Timestamp`, `verifier_pub_key: AgentPubKey`, `reason: Option<String>`).
  - [ ] 15.2. Add `VerificationRecord` to `EntryTypes` enum in `service_types_integrity/lib.rs`.
  - [ ] 15.3. Define new `LinkTypes` for verification in `service_types_integrity/lib.rs`:
    - `ServiceTypeToVerificationRecord` (links a `ServiceType` to its `VerificationRecord`).
    - `VerificationRecordToServiceType` (reverse link for querying, possibly points to the specific `ServiceType` ActionHash).
    - `VerifiedIndexAnchorToRecord` (links a conceptual "verified services index" anchor to individual `VerificationRecord` entries for discoverability).
  - [ ] 15.4. Update `validate` function in `service_types_integrity/lib.rs` to handle `VerificationRecord` creation/updates and the new verification-related link types. Ensure only authorized agents can create/manage verifications if applicable.

### Frontend Implementation

- [ ] 16. Implement ServiceType UI system
  - [ ] 16.1. Create TypeScript types for ServiceType in `ui/src/lib/types/holochain.ts`
  - [ ] 16.2. Create UI types for ServiceType in `ui/src/lib/types/ui.ts`
  - [ ] 16.3. Implement ServiceType service layer in `ui/src/lib/services/serviceTypes.service.ts`
  - [ ] 16.4. Implement ServiceType store in `ui/src/lib/stores/serviceTypes.store.svelte.ts`
  - [ ] 16.5. Create ServiceType selector component in `ui/src/lib/components/shared/ServiceTypeSelector.svelte`

- [ ] 17. Update existing UI components to use ServiceTypes
  - [ ] 17.1. Update RequestForm to use ServiceTypeSelector
  - [ ] 17.2. Update OfferForm to use ServiceTypeSelector
  - [ ] 17.3. Update RequestCard/RequestDetails to display ServiceTypes
  - [ ] 17.4. Update OfferCard/OfferDetails to display ServiceTypes
  - [ ] 17.5. Implement search/filter by ServiceType functionality

- [ ] 18. Create ServiceType management UI
  - [ ] 18.1. Add ServiceType management UI for administrators
  - [ ] 18.2. Create ServiceType creation/editing forms
  - [ ] 18.3. Implement ServiceType verification workflow UI

### Documentation Updates

- [ ] 19. Update technical documentation
  - [ ] 19.1. Update `documentation/technical-specs/zomes/requests.md`
  - [ ] 19.2. Update `documentation/technical-specs/zomes/offers.md`
  - [ ] 19.3. Create `documentation/technical-specs/zomes/service_types.md`
  - [ ] 19.4. Update relevant architecture documentation
  - [ ] 19.5. Update `work-in-progress.md` and `status.md`

## Key Architectural Patterns Established

### Separation of Concerns
- **Service Types Zome**: Manages all ServiceType-related operations and links
- **Requests/Offers Zomes**: Delegate service type link management to service_types zome via external calls
- **Clear API Boundaries**: Each zome has well-defined responsibilities and interfaces

### Polymorphic Input Types
- **Unified `ServiceTypeLinkInput`**: Single type for both linking and unlinking operations
- **Entity-agnostic Design**: Same functions work for both requests and offers using entity parameter
- **Reduced Code Duplication**: Eliminates redundant type definitions

### External Call Pattern
- **Cross-zome Communication**: Requests and offers coordinators use external calls to service_types functions
- **Centralized Link Management**: All service type links managed in one place
- **Consistent API**: Same function signatures across all coordinator zomes

### Admin Access Control
- **Centralized Authorization**: ServiceType CRUD operations require admin privileges
- **Consistent Security Model**: Same admin check pattern used across all operations

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
// CRUD Operations
pub fn create_service_type(input: ServiceTypeInput) -> ExternResult<Record>;
pub fn get_service_type(service_type_hash: ActionHash) -> ExternResult<Option<Record>>;
pub fn update_service_type(input: UpdateServiceTypeInput) -> ExternResult<ActionHash>;
pub fn delete_service_type(service_type_hash: ActionHash) -> ExternResult<ActionHash>;
pub fn get_all_service_types() -> ExternResult<Vec<Record>>;

// Link Management Functions
pub fn link_to_service_type(input: ServiceTypeLinkInput) -> ExternResult<()>;
pub fn unlink_from_service_type(input: ServiceTypeLinkInput) -> ExternResult<()>;
pub fn update_service_type_links(input: UpdateServiceTypeLinksInput) -> ExternResult<()>;
pub fn delete_all_service_type_links_for_entity(input: GetServiceTypeForEntityInput) -> ExternResult<()>;

// Query Functions
pub fn get_service_types_for_entity(input: GetServiceTypeForEntityInput) -> ExternResult<Vec<ActionHash>>;
pub fn get_requests_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>>;
pub fn get_offers_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>>;
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

The ServiceType system will follow the project's Effect TS patterns with a service layer and store implementation:

#### ServiceType Effect Service

```typescript
// Service interface for ServiceType operations
export interface ServiceTypeService {
  readonly createServiceType: (
    input: ServiceTypeInput
  ) => Effect<Record, ServiceTypeServiceError, HolochainService>;
  
  readonly getServiceType: (
    serviceTypeHash: ActionHash
  ) => Effect<Record | null, ServiceTypeServiceError, HolochainService>;
  
  readonly updateServiceType: (
    input: UpdateServiceTypeInput
  ) => Effect<ActionHash, ServiceTypeServiceError, HolochainService>;
  
  readonly deleteServiceType: (
    serviceTypeHash: ActionHash
  ) => Effect<ActionHash, ServiceTypeServiceError, HolochainService>;
  
  readonly getAllServiceTypes: () => Effect<
    Record[],
    ServiceTypeServiceError,
    HolochainService
  >;
  
  readonly getServiceTypesForEntity: (
    input: GetServiceTypeForEntityInput
  ) => Effect<ActionHash[], ServiceTypeServiceError, HolochainService>;
  
  readonly linkToServiceType: (
    input: ServiceTypeLinkInput
  ) => Effect<void, ServiceTypeServiceError, HolochainService>;
  
  readonly updateServiceTypeLinks: (
    input: UpdateServiceTypeLinksInput
  ) => Effect<void, ServiceTypeServiceError, HolochainService>;
}

// Service tag
export const ServiceTypeServiceTag = Context.Tag<ServiceTypeService>('ServiceTypeService');

// Live layer implementation
export const ServiceTypeServiceLive: Layer.Layer<ServiceTypeService, never, HolochainService> = 
  Layer.effect(
    ServiceTypeServiceTag,
    Effect.gen(function* ($) {
      const holochainService = yield* $(HolochainServiceTag);
      
      return ServiceTypeServiceTag.of({
        createServiceType: (input) => 
          holochainService.callZome('service_types', 'create_service_type', input),
        
        getServiceType: (serviceTypeHash) =>
          holochainService.callZome('service_types', 'get_service_type', serviceTypeHash),
        
        // ... other methods
      });
    })
  );
```

#### ServiceType Store Implementation

```typescript
// Store state type
export type ServiceTypesStoreState = {
  readonly serviceTypes: UIServiceType[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIServiceType>;
};

// Store Effect that requires ServiceTypeService
const createServiceTypesStore = Effect.gen(function* ($) {
  const serviceTypeService = yield* $(ServiceTypeServiceTag);
  const eventBus = yield* $(StoreEventBusTag);
  
  // Internal state management with Svelte runes
  let state = $state<ServiceTypesStoreState>({
    serviceTypes: [],
    loading: false,
    error: null,
    cache: new EntityCache()
  });
  
  const getAllServiceTypes = () =>
    Effect.gen(function* ($) {
      state.loading = true;
      state.error = null;
      
      const records = yield* $(serviceTypeService.getAllServiceTypes());
      const serviceTypes = records.map(mapRecordToUIServiceType);
      
      state.serviceTypes = serviceTypes;
      state.cache.setMany(serviceTypes);
      state.loading = false;
      
      // Emit event for cross-store communication
      yield* $(eventBus.emit('serviceTypesUpdated', serviceTypes));
      
      return serviceTypes;
    }).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          state.error = error.message;
          state.loading = false;
          return [];
        })
      )
    );
  
  const createServiceType = (input: ServiceTypeInput) =>
    Effect.gen(function* ($) {
      const record = yield* $(serviceTypeService.createServiceType(input));
      const serviceType = mapRecordToUIServiceType(record);
      
      state.serviceTypes = [...state.serviceTypes, serviceType];
      state.cache.set(serviceType);
      
      yield* $(eventBus.emit('serviceTypeCreated', serviceType));
      
      return record;
    });
  
  // ... other methods
  
  return {
    // Reactive state getters
    get serviceTypes() { return state.serviceTypes; },
    get loading() { return state.loading; },
    get error() { return state.error; },
    get cache() { return state.cache; },
    
    // Effect methods
    getAllServiceTypes,
    createServiceType,
    updateServiceType,
    deleteServiceType,
    invalidateCache: () => Effect.sync(() => state.cache.clear())
  };
});

// Singleton store instance with live layer
export const serviceTypesStore = await Effect.runPromise(
  createServiceTypesStore.pipe(
    Effect.provide(ServiceTypeServiceLive),
    Effect.provide(HolochainServiceLive),
    Effect.provide(StoreEventBusLive)
  )
);
```

#### Component Usage Pattern

```typescript
// In Svelte components
import { serviceTypesStore } from '$lib/stores/serviceTypes.store.svelte';
import { Effect } from 'effect';

// Reactive access to state
$: serviceTypes = serviceTypesStore.serviceTypes;
$: loading = serviceTypesStore.loading;

// Effect operations
const loadServiceTypes = () => {
  Effect.runPromise(serviceTypesStore.getAllServiceTypes())
    .catch(console.error);
};

const createNewServiceType = (input: ServiceTypeInput) => {
  Effect.runPromise(serviceTypesStore.createServiceType(input))
    .then(() => console.log('Service type created'))
    .catch(console.error);
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
