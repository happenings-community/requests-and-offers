## Store Layer (Layer 2) in 7-Layer Effect-TS Architecture

This project uses sophisticated store patterns that serve as Layer 2 of the 7-layer Effect-TS architecture. Stores provide reactive state management using Svelte 5 Runes and integrate with services (Layer 1) through Effect-TS patterns.

### Architecture Position

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: Testing (Vitest + Playwright)                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Components (Svelte 5 + WCAG Compliance)           │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Composables (Business Logic Abstraction)           │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Error Handling (Domain-Specific Tagged Errors)     │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Schema Validation (Effect Schema at Boundaries)    │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Store Layer (Svelte 5 Runes + Effect Integration)  ← YOU ARE HERE
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Service Layer (Effect-Native Services)             │
└─────────────────────────────────────────────────────────────┘
```

### Store Layer Responsibilities

The Store Layer (Layer 2) is responsible for:
- **State Management**: Reactive state using Svelte 5 Runes
- **Service Integration**: Connecting to Layer 1 services through Effect-TS
- **Caching**: EntityCache with configurable expiry
- **Event System**: Type-safe event emission for state changes
- **Loading States**: Consistent loading/error state management
- **Data Transformation**: Converting between Holochain records and UI entities

### The 9 Standardized Helper Functions

All domain stores implement these 9 helper functions for consistency across the 7-layer architecture:

#### 1. createUIEntityFromRecord
**Purpose**: Converts Holochain records (Layer 1 output) to UI entities (Layer 2 consumption)

```typescript
// Standard entity creation helper - bridges Layer 1 → Layer 2
const createUIServiceType = createUIEntityFromRecord<ServiceTypeInDHT, UIServiceType>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: actionHash, // TODO: Extract creator from record
    created_at: timestamp,
    updated_at: timestamp,
    status: (additionalData?.status as 'pending' | 'approved' | 'rejected') || 'approved'
  })
);
```

#### 2. mapRecordsToUIEntities
**Purpose**: Maps collections of records to UI entities with null safety

```typescript
// Transform service layer responses to store entities
const mapServiceTypesToUIEntities = (records: Record[]): UIServiceType[] =>
  pipe(
    records,
    Array.map((record) => createUIServiceType(record)),
    Array.filter(Boolean) as Array<(_: unknown) => _ is UIServiceType>
  );
```

#### 3. createCacheSyncHelper
**Purpose**: Synchronizes cache operations with reactive state arrays

```typescript
// Cache synchronization helper - maintains state consistency
const { syncCacheToState } = createGenericCacheSyncHelper({
  all: serviceTypes,
  pending: pendingServiceTypes,
  approved: approvedServiceTypes,
  rejected: rejectedServiceTypes
});

// Usage in operations
syncCacheToState(entity, 'add');    // Add entity to appropriate array
syncCacheToState(entity, 'update'); // Update existing entity
syncCacheToState(entity, 'remove'); // Remove entity from arrays
```

#### 4. createStatusAwareEventEmitters
**Purpose**: Provides type-safe event emission for CRUD operations with status support

```typescript
// Event emitters with status support - connects to Layer 5 composables
const serviceTypeEventEmitters = createStatusAwareEventEmitters<UIServiceType>('serviceType');

// Usage
eventEmitters.emitCreated(entity);
eventEmitters.emitUpdated(entity);
eventEmitters.emitDeleted(entityId);
eventEmitters.emitStatusChanged?.(entity); // Optional status change events
```

#### 5. withLoadingState
**Purpose**: Manages consistent loading and error state across operations

```typescript
// Loading state management - standardizes async operation handling
const setters: LoadingStateSetter = {
  setLoading: (value) => { loading = value; },
  setError: (value) => { error = value; }
};

const createServiceType = (input: CreateServiceTypeInput): E.Effect<Record, ServiceTypeError> =>
  withLoadingState(() =>
    pipe(
      serviceTypesService.createServiceType(input), // Layer 1 service call
      E.tap((record) => {
        // Handle success - update Layer 2 state
        const entity = createUIServiceType(record);
        syncCacheToState(entity, 'add');
        eventEmitters.emitCreated(entity);
      }),
      E.catchAll((error) =>
        E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE))
      )
    )
  )(setters);
```

#### 6. createRecordCreationHelper
**Purpose**: Standardizes entity creation with validation and caching

```typescript
// Record creation helper - bridges Layer 1 → Layer 2 with caching
const createEntityWithValidation = <T, R>(
  input: T,
  service: { create: (input: T) => E.Effect<R, Error> }, // Layer 1 service
  mapper: (record: R) => UIServiceType // Layer 2 entity mapper
): E.Effect<R, ServiceTypeError> =>
  pipe(
    service.create(input),
    E.map((record) => {
      const entity = mapper(record);
      if (entity) {
        E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
        syncCacheToState(entity, 'add');
        eventEmitters.emitCreated(entity);
      }
      return record;
    })
  );
```

#### 7. createStatusTransitionHelper
**Purpose**: Handles moving entities between status arrays (pending/approved/rejected)

```typescript
// Status transition management - maintains reactive state consistency
const { transitionEntityStatus } = createStatusTransitionHelper(
  {
    pending: pendingServiceTypes,
    approved: approvedServiceTypes,
    rejected: rejectedServiceTypes
  },
  cache
);

// Usage in status operations
const approveServiceType = (hash: ActionHash): E.Effect<void, ServiceTypeError> =>
  pipe(
    serviceTypesService.approveServiceType(hash), // Layer 1 service call
    E.tap(() => {
      transitionEntityStatus(hash, 'approved'); // Layer 2 state update
      // Find and emit the approved entity
      const approvedEntity = approvedServiceTypes.find(st =>
        encodeHashToBase64(st.original_action_hash) === encodeHashToBase64(hash)
      );
      if (approvedEntity) {
        eventEmitters.emitStatusChanged?.(approvedEntity);
      }
    })
  );
```

#### 8. processMultipleRecordCollections
**Purpose**: Handles complex API responses with multiple collections

```typescript
// Process multiple collections from Layer 1 service responses
const getAllServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeError> =>
  pipe(
    serviceTypesService.getAllServiceTypes(), // Layer 1 service call
    E.flatMap((result: { pending: Record[]; approved: Record[]; rejected: Record[] }) =>
      E.try({
        try: () =>
          processMultipleRecordCollections(
            {
              converter: createUIServiceType, // Layer 2 transformation
              cache,
              targetArrays: {
                all: serviceTypes,
                pending: pendingServiceTypes,
                approved: approvedServiceTypes,
                rejected: rejectedServiceTypes
              }
            },
            result
          ),
        catch: (unknownError) =>
          ServiceTypeError.fromError(unknownError, SERVICE_TYPE_CONTEXTS.DECODE_SERVICE_TYPES)
      })
    )
  );
```

#### 9. createEntitiesFetcher
**Purpose**: Provides standardized data fetching with loading states

```typescript
// Data fetching helper - standardizes Layer 1 → Layer 2 data flow
const fetchAllServiceTypes = (): E.Effect<void, ServiceTypeError> =>
  withLoadingState(() =>
    pipe(
      getAllServiceTypes(),
      E.map(() => {
        // Data is already processed and synced by getAllServiceTypes
      }),
      E.catchAll((error) => {
        // Handle connection errors gracefully
        const errorMessage = String(error);
        if (errorMessage.includes('Client not connected')) {
          console.warn('Holochain client not connected, returning empty service types array');
          return E.void;
        }
        return E.fail(
          ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES)
        );
      })
    )
  )(setters);
```

### Complete Store Implementation Example

```typescript
// ServiceTypesStore - Layer 2 Reference Implementation
export const createServiceTypesStore = (): E.Effect<
  ServiceTypesStore,
  never,
  HolochainClientServiceTag | ServiceTypesServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    // ========================================================================
    // LAYER 1 SERVICE INTEGRATION
    // ========================================================================
    const serviceTypesService = yield* ServiceTypesServiceTag; // Layer 1 service
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // LAYER 2 STATE INITIALIZATION
    // ========================================================================
    const serviceTypes: UIServiceType[] = $state([]);
    const pendingServiceTypes: UIServiceType[] = $state([]);
    const approvedServiceTypes: UIServiceType[] = $state([]);
    const rejectedServiceTypes: UIServiceType[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // ========================================================================
    // HELPER INITIALIZATION WITH STANDARDIZED UTILITIES
    // ========================================================================

    // 1. Loading state management
    const setters: LoadingStateSetter = {
      setLoading: (value) => { loading = value; },
      setError: (value) => { error = value; }
    };

    // 2. Cache synchronization
    const { syncCacheToState } = createGenericCacheSyncHelper({
      all: serviceTypes,
      pending: pendingServiceTypes,
      approved: approvedServiceTypes,
      rejected: rejectedServiceTypes
    });

    // 3. Event emitters - connects to Layer 5 composables
    const eventEmitters = createStatusAwareEventEmitters<UIServiceType>('serviceType');

    // 4. Cache management
    const cacheLookup = createServiceTypeCacheLookup(serviceTypesService);
    const cache = yield* cacheService.createEntityCache<UIServiceType>(
      { expiryMs: CACHE_EXPIRY_MS, debug: false },
      cacheLookup
    );

    // 5. Status transitions
    const { transitionEntityStatus } = createStatusTransitionHelper(
      { pending: pendingServiceTypes, approved: approvedServiceTypes, rejected: rejectedServiceTypes },
      cache
    );

    // ========================================================================
    // CORE CRUD OPERATIONS - LAYER 1 → LAYER 2 BRIDGE
    // ========================================================================

    const createServiceType = (serviceType: ServiceTypeInDHT): E.Effect<Record, ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.createServiceType(serviceType), // Layer 1 call
          E.tap((record) => {
            const entity = createUIServiceType(record, { status: 'approved' });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              syncCacheToState(entity, 'add'); // Layer 2 state update
              eventEmitters.emitCreated(entity); // Layer 5 notification
            }
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE))
          )
        )
      )(setters);

    const getAllServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getAllServiceTypes(), // Layer 1 call
          E.flatMap((result) =>
            E.try({
              try: () =>
                processMultipleRecordCollections(
                  {
                    converter: createUIServiceType, // Layer 2 transformation
                    cache,
                    targetArrays: {
                      all: serviceTypes,
                      pending: pendingServiceTypes,
                      approved: approvedServiceTypes,
                      rejected: rejectedServiceTypes
                    }
                  },
                  result
                ),
              catch: (unknownError) =>
                ServiceTypeError.fromError(unknownError, SERVICE_TYPE_CONTEXTS.DECODE_SERVICE_TYPES)
            })
          ),
          E.map(() => serviceTypes),
          E.catchAll((error) => {
            // Graceful error handling
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty service types array');
              return E.succeed([]);
            }
            return E.fail(
              ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES)
            );
          })
        )
      )(setters);

    // ========================================================================
    // STORE INTERFACE RETURN - LAYER 2 API
    // ========================================================================

    return {
      // Reactive getters for Layer 5 composables
      get serviceTypes() { return serviceTypes; },
      get pendingServiceTypes() { return pendingServiceTypes; },
      get approvedServiceTypes() { return approvedServiceTypes; },
      get rejectedServiceTypes() { return rejectedServiceTypes; },
      get loading() { return loading; },
      get error() { return error; },
      get cache() { return cache; },

      // Core operations - bridge to Layer 1 services
      createServiceType,
      getAllServiceTypes,
      // ... other methods
    };
  });
```

### Reactive State Management with Svelte 5 Runes

#### State Declaration (Layer 2 Core)
```typescript
// Reactive state with $state - core Layer 2 functionality
const serviceTypes: UIServiceType[] = $state([]);
const loading: boolean = $state(false);
const error: string | null = $state(null);

// Derived state with $derived - computed values for Layer 5
const approvedCount = $derived(() => approvedServiceTypes.length);
const hasServiceTypes = $derived(() => serviceTypes.length > 0);
const isLoading = $derived(() => loading);
```

#### Effect Integration
```typescript
// Run effects in components - Layer 2 → Layer 5 integration
$: Effect.runPromise(getAllServiceTypes());

// Effect cleanup on unmount
$effect(() => {
  const cleanup = Effect.runPromise(
    pipe(
      store.getAllServiceTypes(),
      Effect.tap(() => console.log('Service types loaded'))
    )
  );

  return () => {
    // Cleanup logic
  };
});
```

### Cache Management Patterns

#### EntityCache Integration
```typescript
// Cache configuration - Layer 2 performance optimization
const CACHE_EXPIRY_MS = CACHE_EXPIRY.SERVICE_TYPES;

// Cache creation with lookup function
const cache = yield* cacheService.createEntityCache<UIServiceType>(
  { expiryMs: CACHE_EXPIRY_MS, debug: false },
  cacheLookup
);

// Cache operations
const invalidateCache = (): void => {
  E.runSync(cache.clear());
};

const cacheLookup = (key: string): E.Effect<UIServiceType, CacheNotFoundError> =>
  pipe(
    serviceTypesService.getServiceType(decodeHashFromBase64(key)), // Layer 1 call
    E.map((record) => createUIServiceType(record)), // Layer 2 transformation
    E.catchAll(() => E.fail(new CacheNotFoundError({ key })))
  );
```

### Event System Patterns

#### Type-Safe Events (Layer 2 → Layer 5 Communication)
```typescript
// Event emitter creation - notifies Layer 5 composables
const eventEmitters = createStatusAwareEventEmitters<UIServiceType>('serviceType');

// Event subscription in components - Layer 5 → Layer 2 listening
$: eventEmitters.onCreated((entity) => {
  console.log('Service type created:', entity.name);
});

$: eventEmitters.onStatusChanged?.((entity) => {
  console.log('Service type status changed:', entity.status);
});
```

#### Custom Events
```typescript
// Domain-specific events - Layer 2 business logic
const emitServiceTypeApproved = (entity: UIServiceType) => {
  eventEmitters.emitStatusChanged?.(entity);
  // Additional domain logic
  notificationsService.showSuccess(`Service type "${entity.name}" approved`);
};
```

### Layer Integration Patterns

#### Layer 1 Service Integration
```typescript
// Standard pattern for Layer 1 → Layer 2 integration
const createEntity = (input: CreateInput): E.Effect<Record, DomainError> =>
  pipe(
    // 1. Schema validation (Layer 3)
    Schema.decodeUnknown(CreateInputSchema)(input),
    E.flatMap((validatedInput) =>
      // 2. Service call (Layer 1)
      service.createEntity(validatedInput)
    ),
    E.map((record) => {
      // 3. Entity transformation (Layer 2)
      const entity = createUIEntity(record);

      // 4. Cache update (Layer 2)
      cache.set(entity.id, entity);

      // 5. State update (Layer 2)
      syncCacheToState(entity, 'add');

      // 6. Event emission (Layer 2 → Layer 5)
      eventEmitters.emitCreated(entity);

      return record;
    }),
    // 7. Error handling (Layer 4)
    E.catchAll((error) =>
      E.fail(DomainError.fromServiceError(error, context))
    )
  );
```

#### Layer 5 Composable Support
```typescript
// Store methods designed for Layer 5 consumption
export const useServiceTypesStore = () => {
  const store = useContext(ServiceTypesStoreContext);

  return {
    // Reactive state
    serviceTypes: store.serviceTypes,
    loading: store.loading,
    error: store.error,

    // Computed values
    approvedCount: $derived(store.approvedServiceTypes.length),
    hasData: $derived(store.serviceTypes.length > 0),

    // Actions
    create: store.createServiceType,
    refresh: store.getAllServiceTypes,

    // Event subscriptions
    onCreated: store.eventEmitters.onCreated,
    onUpdated: store.eventEmitters.onUpdated,
  };
};
```

### Testing Store Patterns

#### Unit Testing (Layer 2 Isolation)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createServiceTypesStore } from '$lib/stores/serviceTypes.store.svelte';

describe('ServiceTypesStore (Layer 2)', () => {
  let store: ServiceTypesStore;

  beforeEach(() => {
    store = createMockServiceTypesStore();
  });

  it('should create service type successfully', async () => {
    const input: ServiceTypeInDHT = {
      name: 'Test Service',
      description: 'A test service'
    };

    await Effect.runPromise(store.createServiceType(input));

    expect(store.serviceTypes).toHaveLength(1);
    expect(store.serviceTypes[0].name).toBe('Test Service');
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
  });

  it('should handle errors gracefully', async () => {
    const invalidInput: ServiceTypeInDHT = { name: '' };

    await Effect.runPromise(store.createServiceType(invalidInput));

    expect(store.error).toBeTruthy();
    expect(store.loading).toBe(false);
    expect(store.serviceTypes).toHaveLength(0);
  });
});
```

#### Integration Testing (Layer 1 ↔ Layer 2)
```typescript
describe('Layer Integration (1 ↔ 2)', () => {
  it('should integrate with Holochain service', async () => {
    const store = pipe(
      createServiceTypesStore(),
      E.provide(ServiceTypesServiceLive), // Layer 1
      E.provide(HolochainClientServiceLive), // Layer 1
      E.runSync
    );

    const input: ServiceTypeInDHT = {
      name: 'Integration Test Service',
      description: 'Testing integration'
    };

    const result = await Effect.runPromise(store.createServiceType(input));

    expect(result).toBeDefined();
    expect(store.serviceTypes[0].name).toBe('Integration Test Service');
  });
});
```

#### Cross-Layer Testing (2 ↔ 5)
```typescript
describe('Store → Composable Integration (2 ↔ 5)', () => {
  it('should provide reactive state to composables', async () => {
    const store = createMockServiceTypesStore();
    const composable = serviceTypeComposable(store);

    // Test reactive state flow
    expect(composable.serviceTypes).toEqual([]);

    await store.createServiceType({ name: 'Test' });

    expect(composable.serviceTypes).toHaveLength(1);
    expect(composable.serviceTypes[0].name).toBe('Test');
  });
});
```

### Best Practices

#### Store Design Principles
1. **Layer Separation**: Stores should only handle Layer 2 concerns
2. **Service Integration**: Use Effect-TS patterns for Layer 1 communication
3. **Reactivity**: Leverage Svelte 5 Runes for reactive state
4. **Error Handling**: Implement graceful error handling with loading states
5. **Caching**: Use EntityCache for performance optimization
6. **Type Safety**: Maintain full TypeScript coverage
7. **Event-Driven**: Use events to communicate with Layer 5

#### Performance Considerations
1. **Cache Expiry**: Set appropriate cache expiry times per domain
2. **Batching**: Batch operations where possible
3. **Lazy Loading**: Load data on demand
4. **Memory Management**: Clean up cache and subscriptions
5. **Derived State**: Use $derived for computed values

#### Error Handling Guidelines
1. **Graceful Degradation**: Provide fallbacks for connection issues
2. **User Feedback**: Show appropriate error messages and loading states
3. **Recovery**: Implement retry logic where appropriate
4. **Logging**: Log errors for debugging without exposing sensitive data

These patterns ensure consistent, maintainable, and performant store development across all domains in the 7-layer Effect-TS architecture.