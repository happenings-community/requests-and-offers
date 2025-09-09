# Frontend Stores API

Complete API reference for Svelte 5 Runes + Effect-TS store implementations with comprehensive store-helpers utilities.

## Store Architecture

All stores follow the factory pattern with reactive state management using Svelte 5 Runes and standardized helper functions from `$lib/utils/store-helpers` for consistency, performance, and maintainability.

## Store-Helpers Utilities

The project includes a comprehensive set of utilities organized into 5 modules to standardize store patterns:

### Module Structure

- **`core.ts`**: Loading state management, error handling, operation wrapping
- **`cache-helpers.ts`**: Cache synchronization, status transitions, batch operations
- **`event-helpers.ts`**: Event emission, domain-specific emitters, cross-domain communication
- **`record-helpers.ts`**: Entity creation, record processing, batch operations
- **`fetching-helpers.ts`**: Data fetching patterns, caching integration, pagination

### Store Factory Pattern

```typescript
export const createDomainStore = () => {
  // Reactive state with Svelte 5 Runes
  let entities = $state<UIDomainEntity[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Cache management
  const cache = createModuleCache<ActionHash, UIDomainEntity>(
    "domain",
    5 * 60 * 1000,
  );

  // Implement all 9 helper functions
  // ... helper function implementations

  // Main operations using Effect-TS
  const fetchEntities = Effect.gen(function* () {
    const domainService = yield* DomainService;
    const result = yield* domainService.getAllEntities();
    entities = mapRecordsToUIEntities(result);
    return entities;
  });

  return {
    // Reactive state accessors
    entities: () => entities,
    isLoading: () => isLoading,
    error: () => error,

    // Operations
    fetchEntities,
    // ... other operations

    // Helper functions (exposed for composables)
    createUIEntity,
    mapRecordsToUIEntities,
    // ... other helpers
  };
};
```

## Core Store-Helpers API

### Loading State Management

#### `withLoadingState`

Higher-order function to wrap operations with loading state management.

```typescript
// Definition
type OperationWrapper = <T, E>(
  operation: () => Effect<T, E>,
) => (setters: LoadingStateSetter) => Effect<T, E>;

// Usage
const fetchData = withLoadingState(() =>
  pipe(
    service.getData(),
    E.map((data) => {
      entities.splice(0, entities.length, ...data);
      return data;
    }),
  ),
);
```

#### `createLoadingStateSetter`

Creates standardized state setters for loading and error states.

```typescript
const setters = createLoadingStateSetter(loadingState, errorState);
// Returns: { setLoading: (value: boolean) => void, setError: (value: string | null) => void }
```

### Error Handling

#### `createErrorHandler`

Creates domain-specific error handlers with contextual information.

```typescript
const handleServiceError = createErrorHandler(
  ServiceError.fromError,
  "Failed to fetch entities",
);

// Usage in Effect chain
pipe(service.getData(), E.catchAll(handleServiceError));
```

#### `createGenericErrorHandler`

Simple error handler for generic string errors.

```typescript
const handleError = createGenericErrorHandler("Operation failed");
```

### Cache Management

#### `createGenericCacheSyncHelper`

Synchronizes cache with reactive state arrays for CRUD operations.

```typescript
interface CacheArrays<T> {
  all: T[];
  pending?: T[];
  approved?: T[];
  rejected?: T[];
}

const { syncCacheToState } = createGenericCacheSyncHelper({
  all: entities,
  pending: pendingEntities,
  approved: approvedEntities,
  rejected: rejectedEntities,
});

// Usage
syncCacheToState(newEntity, "add"); // Add entity to appropriate arrays
syncCacheToState(entity, "update"); // Update entity in arrays
syncCacheToState(entity, "remove"); // Remove entity from arrays
```

#### `createStatusTransitionHelper`

Manages status changes with atomic updates between pending/approved/rejected arrays.

```typescript
const { transitionEntityStatus } = createStatusTransitionHelper(
  {
    pending: pendingEntities,
    approved: approvedEntities,
    rejected: rejectedEntities,
  },
  cache,
);

// Usage
transitionEntityStatus(entityHash, "approved"); // Moves from pending to approved
```

#### `processMultipleRecordCollections`

Handles complex API responses with multiple collections efficiently.

```typescript
const processedData = processMultipleRecordCollections(
  {
    converter: createUIEntity,
    cache,
    targetArrays: {
      all: entities,
      pending: pendingEntities,
      approved: approvedEntities,
      rejected: rejectedEntities,
    },
  },
  apiResponse, // { pending: Record[], approved: Record[], rejected: Record[] }
);
```

### Event System

#### `createStandardEventEmitters`

Standard CRUD event emitters for basic entities.

```typescript
const eventEmitters = createStandardEventEmitters<UIEntity>("entityType");

// Available methods
eventEmitters.emitCreated(entity);
eventEmitters.emitUpdated(entity);
eventEmitters.emitDeleted(entityHash);
eventEmitters.emitLoaded(entities);
```

#### `createStatusAwareEventEmitters`

Enhanced event emitters with status change support for approval workflows.

```typescript
const eventEmitters = createStatusAwareEventEmitters<UIEntity>("entityType");

// Additional methods beyond standard emitters
eventEmitters.emitStatusChanged(entity);
eventEmitters.emitApproved(entity);
eventEmitters.emitRejected(entity);
eventEmitters.emitBatchStatusChanged(entities);
```

### Record Processing

#### `createUIEntityFromRecord`

Higher-order function to create UI entities from Holochain records with error recovery.

```typescript
const createUIEntity = createUIEntityFromRecord<RecordType, UIType>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    created_at: timestamp,
    status: additionalData?.status || "pending",
  }),
);

// Usage
const entity = createUIEntity(record, { status: "approved" });
```

#### `mapRecordsToUIEntities`

Maps arrays of Records to UI entities with null safety and error handling.

```typescript
const entities = mapRecordsToUIEntities(records, createUIEntity);
// Returns: UIEntity[] with null values filtered out
```

#### `createEntityCreationHelper`

Standardized entity creation with validation and error handling.

```tensorflow
const { createEntity } = createEntityCreationHelper(createUIEntity);

// Handles validation, error recovery, and consistency
const newEntity = createEntity(record, additionalData);
```

### Data Fetching

#### `createEntityFetcher`

Higher-order fetching function with loading/error state and caching integration.

```typescript
const entityFetcher = createEntityFetcher<UIEntity, EntityError>(
  handleEntityError,
);

// Returns fetcher with integrated loading state management
const fetchWithState = entityFetcher(
  fetchOperation,
  processingFunction,
  loadingStateSetter,
);
```

#### `createCacheIntegratedFetcher`

Advanced fetcher with cache-first strategy and service fallback.

```typescript
const cacheFetcher = createCacheIntegratedFetcher(
  cache,
  serviceOperation,
  createUIEntity,
);

// Automatically checks cache first, falls back to service
const entity = await Effect.runPromise(cacheFetcher(entityHash));
```

## The 9 Standardized Store Patterns

Every store implements these 9 patterns using the store-helpers utilities:

### 1. Entity Creation Pattern

Uses `createUIEntityFromRecord` helper to convert Holochain Records to UI entities with error recovery.

```typescript
// Implementation using store-helpers
const createUIEntity = createUIEntityFromRecord<RecordType, UIType>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    created_at: timestamp,
    status: additionalData?.status || "pending",
  }),
);
```

### 2. Record Mapping Pattern

Uses `mapRecordsToUIEntities` helper for safe array mapping with null filtering.

```typescript
// Implementation using store-helpers
const entities = mapRecordsToUIEntities(records, createUIEntity);
// Automatically handles null safety and error recovery
```

### 3. Cache Synchronization Pattern

Uses `createGenericCacheSyncHelper` for cache-to-state synchronization.

```typescript
// Implementation using store-helpers
const { syncCacheToState } = createGenericCacheSyncHelper({
  all: entities,
  pending: pendingEntities,
  approved: approvedEntities,
  rejected: rejectedEntities,
});

// Usage across CRUD operations
syncCacheToState(newEntity, "add");
syncCacheToState(updatedEntity, "update");
syncCacheToState(deletedEntity, "remove");
```

### 4. Event Emission Pattern

Uses domain-specific event emitters from store-helpers.

```typescript
// Choose appropriate emitter based on entity requirements
const eventEmitters = createStandardEventEmitters<UIEntity>("domain");
// OR for approval workflow entities
const eventEmitters = createStatusAwareEventEmitters<UIEntity>("domain");

// Automatic event broadcasting
eventEmitters.emitCreated(entity);
eventEmitters.emitStatusChanged(entity); // Status-aware only
```

### 5. Data Fetching Pattern

Uses `createEntityFetcher` and `withLoadingState` for consistent fetching.

```typescript
// Implementation using store-helpers
const entityFetcher = createEntityFetcher<UIEntity, EntityError>(
  handleEntityError,
);

const fetchEntities = withLoadingState(() =>
  pipe(
    service.getAllEntities(),
    E.map((records) => mapRecordsToUIEntities(records, createUIEntity)),
  ),
);
```

### 6. Loading State Pattern

Uses `withLoadingState` wrapper for consistent state management.

```typescript
// Implementation using store-helpers
const operation = withLoadingState(() =>
  pipe(
    serviceOperation(),
    E.tap((result) =>
      E.sync(() => {
        // Update reactive state
        entities.splice(0, entities.length, ...result);
      }),
    ),
  ),
);

// Usage
operation(setters); // Automatically manages loading/error state
```

### 7. Entity Creation Pattern

Uses `createEntityCreationHelper` for standardized creation workflows.

```typescript
// Implementation using store-helpers
const { createEntity } = createEntityCreationHelper(createUIEntity);

// Handles validation, error recovery, and state updates
const newEntity = createEntity(record, { status: "approved" });
```

### 8. Status Transition Pattern

Uses `createStatusTransitionHelper` for approval workflow management.

```typescript
// Implementation using store-helpers
const { transitionEntityStatus } = createStatusTransitionHelper(
  {
    pending: pendingEntities,
    approved: approvedEntities,
    rejected: rejectedEntities,
  },
  cache,
);

// Atomic status transitions
transitionEntityStatus(entityHash, "approved");
```

### 9. Collection Processing Pattern

Uses `processMultipleRecordCollections` for complex API responses.

```typescript
// Implementation using store-helpers
const processedData = processMultipleRecordCollections(
  {
    converter: createUIEntity,
    cache,
    targetArrays: {
      all: entities,
      pending: pendingEntities,
      approved: approvedEntities,
      rejected: rejectedEntities,
    },
  },
  complexApiResponse,
);
```

## Complete Store-Helpers Reference

For detailed documentation of all store-helpers utilities, including advanced usage patterns and comprehensive API reference, see **[Store-Helpers API Documentation](./store-helpers.md)**.

## Domain Stores

### Service Types Store

**File**: `ui/src/lib/stores/serviceTypes.store.svelte.ts`

#### API Reference

```typescript
interface ServiceTypesStore {
  // Reactive state accessors
  entities: () => UIServiceType[];
  isLoading: () => boolean;
  error: () => string | null;

  // Operations
  fetchEntities: Effect.Effect<UIServiceType[], ServiceTypeError>;
  createEntity: (
    input: CreateServiceTypeInput,
  ) => Effect.Effect<UIServiceType, ServiceTypeError>;
  updateEntity: (
    hash: ActionHash,
    input: UpdateServiceTypeInput,
  ) => Effect.Effect<UIServiceType, ServiceTypeError>;
  deleteEntity: (hash: ActionHash) => Effect.Effect<void, ServiceTypeError>;
  approveEntity: (
    hash: ActionHash,
  ) => Effect.Effect<UIServiceType, ServiceTypeError>;
  rejectEntity: (
    hash: ActionHash,
  ) => Effect.Effect<UIServiceType, ServiceTypeError>;
  searchEntities: (
    query: string,
  ) => Effect.Effect<UIServiceType[], ServiceTypeError>;

  // Status transitions
  updateEntityStatus: (hash: ActionHash, status: ServiceTypeStatus) => void;
  batchUpdateStatus: (
    updates: { hash: ActionHash; status: ServiceTypeStatus }[],
  ) => void;

  // Helper functions (exposed for composables)
  createUIEntity: (record: Record) => UIServiceType | null;
  mapRecordsToUIEntities: (records: Record[]) => UIServiceType[];
  syncEntityWithCache: (entity: UIServiceType) => void;
  processMultipleRecordCollections: (response: any) => any;
  eventEmitters: EventEmitters<UIServiceType>;

  // Cache access
  getCachedEntity: (hash: ActionHash) => UIServiceType | null;
  clearCache: () => void;
}
```

#### Usage

```typescript
// Create store instance
const serviceTypesStore = createServiceTypesStore();

// Access reactive state
const entities = serviceTypesStore.entities();
const isLoading = serviceTypesStore.isLoading();

// Execute operations
await Effect.runPromise(
  serviceTypesStore.fetchEntities.pipe(Effect.provide(ServiceTypeServiceLive)),
);

// Create new entity
await Effect.runPromise(
  serviceTypesStore
    .createEntity({
      name: "Web Development",
      description: "Frontend and backend web development services",
    })
    .pipe(Effect.provide(ServiceTypeServiceLive)),
);
```

### Requests Store

**File**: `ui/src/lib/stores/requests.store.svelte.ts`

#### API Reference

```typescript
interface RequestsStore {
  // Reactive state accessors
  entities: () => UIRequest[];
  isLoading: () => boolean;
  error: () => string | null;

  // Operations
  fetchEntities: Effect.Effect<UIRequest[], RequestError>;
  createEntity: (
    input: CreateRequestInput,
  ) => Effect.Effect<UIRequest, RequestError>;
  updateEntity: (
    hash: ActionHash,
    input: UpdateRequestInput,
  ) => Effect.Effect<UIRequest, RequestError>;
  deleteEntity: (hash: ActionHash) => Effect.Effect<void, RequestError>;
  fulfillRequest: (hash: ActionHash) => Effect.Effect<UIRequest, RequestError>;
  closeRequest: (hash: ActionHash) => Effect.Effect<void, RequestError>;

  // Specialized operations
  getRequestsByServiceType: (
    serviceTypeHash: ActionHash,
  ) => Effect.Effect<UIRequest[], RequestError>;
  searchRequests: (query: string) => Effect.Effect<UIRequest[], RequestError>;

  // All 9 helper functions implemented
  // ... (same pattern as Service Types)
}
```

### Offers Store

**File**: `ui/src/lib/stores/offers.store.svelte.ts`

Similar structure to Requests Store with offer-specific operations like `acceptOffer` and offer status management.

### Users Store

**File**: `ui/src/lib/stores/users.store.svelte.ts`

User profile management with authentication and profile update operations.

### Organizations Store

**File**: `ui/src/lib/stores/organizations.store.svelte.ts`

Organization management with member operations and organizational relationships.

### Administration Store

**File**: `ui/src/lib/stores/administration.store.svelte.ts`

Administrative operations for user role management and system moderation.

## Cache Management

### Module-Level Cache Pattern

```typescript
// Cache configuration
const cache = createModuleCache<ActionHash, UIEntity>(
  "domainName", // Cache namespace
  5 * 60 * 1000, // TTL: 5 minutes
);

// Cache operations
const getCachedEntity = (hash: ActionHash): UIEntity | null => {
  return cache.get(hash) || null;
};

const setCachedEntity = (entity: UIEntity): void => {
  cache.set(entity.hash, entity);
};

const invalidateCache = (hash?: ActionHash): void => {
  if (hash) {
    cache.delete(hash);
  } else {
    cache.clear();
  }
};
```

### Cache Integration with Reactive State

```typescript
// Cache-first loading pattern
const loadEntity = (hash: ActionHash) =>
  Effect.gen(function* () {
    // Check cache first
    const cached = getCachedEntity(hash);
    if (cached) {
      return cached;
    }

    // Fetch from service
    const service = yield* DomainService;
    const entity = yield* service.getEntity(hash);

    // Update cache and state
    setCachedEntity(entity);
    return entity;
  });
```

## Event System Integration

### Event Emission

```typescript
// Store emits events for cross-domain communication
const eventEmitters = createEventEmitters<UIServiceType>("serviceTypes");

// Usage in store operations
const createEntity = (input: CreateServiceTypeInput) =>
  withLoadingState(
    Effect.gen(function* () {
      const service = yield* ServiceTypeService;
      const newEntity = yield* service.createServiceType(input);
      handleNewRecord(newEntity);
      eventEmitters.entityCreated(newEntity); // Event emission
      return newEntity;
    }),
  );
```

### Event Listening

```typescript
// Stores can listen to events from other domains
$effect(() => {
  const unsubscribe = eventBus.on(
    "requests:entity:created",
    (request: UIRequest) => {
      // Handle request creation in this store
      if (request.serviceTypeHash) {
        // Update related service type usage count
        updateServiceTypeUsage(request.serviceTypeHash);
      }
    },
  );

  return unsubscribe;
});
```

## Testing Stores

### Helper Function Testing

```typescript
describe("ServiceTypes Store - Helper Functions", () => {
  let store: ReturnType<typeof createServiceTypesStore>;

  beforeEach(() => {
    store = createServiceTypesStore();
  });

  it("should implement all 9 helper functions", () => {
    expect(typeof store.createUIEntity).toBe("function");
    expect(typeof store.mapRecordsToUIEntities).toBe("function");
    expect(typeof store.syncEntityWithCache).toBe("function");
    expect(typeof store.eventEmitters).toBe("object");
    expect(typeof store.fetchEntities).toBe("object"); // Effect object
    expect(typeof store.createEntity).toBe("function");
    expect(typeof store.updateEntity).toBe("function");
    expect(typeof store.updateEntityStatus).toBe("function");
    expect(typeof store.processMultipleRecordCollections).toBe("function");
  });

  it("should create UI entity correctly", () => {
    const mockRecord = createMockRecord();
    const entity = store.createUIEntity(mockRecord);

    expect(entity).toBeDefined();
    expect(entity?.hash).toBe(mockRecord.signed_action.hashed.hash);
    expect(entity?.name).toBe("Test Service Type");
  });
});
```

### Effect Operations Testing

```typescript
describe("ServiceTypes Store - Effect Operations", () => {
  it("should fetch entities successfully", async () => {
    const MockServiceTypeService = Layer.succeed(ServiceTypeService, {
      getAllServiceTypes: () => Effect.succeed([createMockUIServiceType()]),
    });

    const store = createServiceTypesStore();
    const result = await Effect.runPromise(
      store.fetchEntities.pipe(Effect.provide(MockServiceTypeService)),
    );

    expect(result).toHaveLength(1);
    expect(store.entities()).toHaveLength(1);
  });
});
```

## Best Practices

### Do's ✅

- **Use store-helpers utilities**: Leverage the comprehensive store-helpers for consistency
- **Follow the 9 standardized patterns**: Implement all patterns using appropriate helpers
- **Use proper event emitters**: Choose between standard and status-aware emitters based on entity needs
- **Maintain cache synchronization**: Use `createGenericCacheSyncHelper` for cache-state sync
- **Handle errors gracefully**: Use `createErrorHandler` for domain-specific error handling
- **Wrap operations**: Use `withLoadingState` for consistent loading/error state management

### Don'ts ❌

- **Mix old and new patterns**: Consistently use store-helpers utilities throughout
- **Skip error handling**: Always use appropriate error handlers
- **Direct state mutation**: Use helper functions for all state updates
- **Inconsistent event patterns**: Use the same event emitter type throughout a store
- **Cache inconsistency**: Never allow cache and state to diverge

### Migration Path

1. **Start with Service Types**: Use as reference implementation for all patterns
2. **Implement store-helpers**: Replace manual implementations with utilities
3. **Standardize event emitters**: Use appropriate emitters for each domain
4. **Add status management**: Implement approval workflows where needed
5. **Complete testing**: Ensure all helper functions are properly tested

## Reference Implementation

The **Service Types Store** (`serviceTypes.store.svelte.ts`) serves as the complete reference implementation, demonstrating all store-helpers utilities and patterns in their fully realized form. Use this store as the architectural template for all other domain implementations.

This store layer provides reactive state management with consistent patterns across all domains, ensuring maintainability, performance, and scalability of the application.
