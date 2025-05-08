# Dynamic ServiceType DHT Entry Implementation Plan

## Overview

This plan outlines the implementation of a new `ServiceType` DHT entry to replace the current string-based service/skill representation in Requests and Offers. This will provide better categorization, searchability, and management of service types across the application.

## Current State Analysis

Currently, the application uses simple string arrays for service types:

- Requests have a `requirements` field (Vec<String>)
- Offers have a `capabilities` field (Vec<String>)

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

- [x] Initial issue analysis and planning

## In Progress Tasks

- [ ] Define the ServiceType entry structure and validation rules

## Future Tasks

### Backend Implementation

- [ ] Create `service_types_integrity` zome with `ServiceTypeEntry` and validation
- [ ] Create `service_types_coordinator` zome with basic CRUD functions
- [ ] Add necessary `LinkTypes` to `service_types_integrity`, `requests_integrity`, and `offers_integrity`
- [ ] Implement link validation functions in integrity zomes
- [ ] Refactor Request struct in `requests_integrity` (remove `services` field)
- [ ] Refactor Offer struct in `offers_integrity` (remove `services` field)
- [ ] Update input structs (`RequestInput`, `OfferInput`, `UpdateRequestInput`, `UpdateOfferInput`) in coordinator zomes
- [ ] Update `create_request` function to manage links
- [ ] Update `update_request` function to manage links
- [ ] Update `delete_request` function to manage links
- [ ] Update `create_offer` function to manage links
- [ ] Update `update_offer` function to manage links
- [ ] Update `delete_offer` function to manage links
- [ ] Update/Create getter functions (`get_request_details`, `get_offer_details`) to return linked `service_type_hashes`
- [ ] Implement `get_requests_for_service_type` query function
- [ ] Implement `get_offers_for_service_type` query function
- [ ] Implement `get_all_service_types` function (potentially using path/links)
- [ ] Add Tryorama tests for `service_types` zome CRUD and query functions
- [ ] Update Tryorama tests for `requests` and `offers` zomes to verify link creation/deletion logic

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
  /// Additional metadata for the service type
  pub metadata: Option<BTreeMap<String, String>>,
  /// Whether this is a system-defined service type
  pub is_system: bool,
}
```

### Link Types to Implement

```rust
// In service_types_integrity
#[hdk_link_types]
pub enum ServiceTypeLink {
  AllServiceTypes,
  ServiceTypeUpdates,
  CategoryServiceTypes,
}

// In requests_integrity
#[hdk_link_types]
pub enum RequestServiceTypeLink {
  RequestToServiceType,
  ServiceTypeToRequest,
}

// In offers_integrity
#[hdk_link_types]
pub enum OfferServiceTypeLink {
  OfferToServiceType,
  ServiceTypeToOffer,
}
```

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
  
  getAllServiceTypes: () => Effect<never, ServiceTypeStoreError, UIServiceType[]>;
  getServiceTypesByCategory: (category: string) => Effect<never, ServiceTypeStoreError, UIServiceType[]>;
  createServiceType: (serviceType: ServiceTypeInput) => Effect<never, ServiceTypeStoreError, Record>;
  updateServiceType: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedServiceType: ServiceTypeInput
  ) => Effect<never, ServiceTypeStoreError, Record>;
  deleteServiceType: (serviceTypeHash: ActionHash) => Effect<never, ServiceTypeStoreError, void>;
  invalidateCache: () => void;
};
```

### Svelte 5 Integration

The ServiceTypeSelector component will use Svelte 5 runes:

```typescript
function ServiceTypeSelector() {
  let { 
    selectedTypes = [], 
    onChange = () => {}, 
    multiple = true,
    allowCreate = false
  } = $props();
  
  let searchTerm = $state('');
  let filteredTypes = $derived(filterServiceTypes(searchTerm));
  
  // Component logic
}
```

## Relevant Files

### Backend (Rust)

- `dnas/requests_and_offers/zomes/integrity/service_types/src/lib.rs` - New file
- `dnas/requests_and_offers/zomes/coordinator/service_types/src/lib.rs` - New file
- `dnas/requests_and_offers/zomes/integrity/requests/src/lib.rs` - Update
- `dnas/requests_and_offers/zomes/coordinator/requests/src/lib.rs` - Update
- `dnas/requests_and_offers/zomes/integrity/offers/src/lib.rs` - Update
- `dnas/requests_and_offers/zomes/coordinator/offers/src/lib.rs` - Update

### Frontend (TypeScript/Svelte)

- `ui/src/lib/types/holochain.ts` - Add ServiceType types
- `ui/src/lib/types/ui.ts` - Add UIServiceType types
- `ui/src/lib/services/serviceTypes.service.ts` - New file
- `ui/src/lib/stores/serviceTypes.store.svelte.ts` - New file
- `ui/src/lib/components/shared/ServiceTypeSelector.svelte` - New file
- `ui/src/lib/components/requests/RequestForm.svelte` - Update
- `ui/src/lib/components/offers/OfferForm.svelte` - Update

### Documentation

- `documentation/technical-specs/zomes/service_types.md` - New file
- `documentation/technical-specs/zomes/requests.md` - Update
- `documentation/technical-specs/zomes/offers.md` - Update
- `documentation/work-in-progress.md` - Update
- `documentation/status.md` - Update
