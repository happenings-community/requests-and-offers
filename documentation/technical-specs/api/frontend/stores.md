# Frontend Stores API

Complete API reference for Svelte 5 Runes + Effect-TS store implementations with the 9 standardized helper functions.

## Store Architecture

All stores follow the factory pattern with reactive state management using Svelte 5 Runes and standardized helper functions for consistency.

### Store Factory Pattern

```typescript
export const createDomainStore = () => {
  // Reactive state with Svelte 5 Runes
  let entities = $state<UIDomainEntity[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Cache management
  const cache = createModuleCache<ActionHash, UIDomainEntity>('domain', 5 * 60 * 1000);

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

## The 9 Standardized Helper Functions

Every store must implement these 9 helper functions for consistency and functionality:

### 1. Entity Creation Helper

Converts Holochain Records to UI entities with error recovery.

```typescript
const createUIEntity = (record: Record): UIDomainEntity | null => {
  try {
    const decoded = decode(record.entry);
    return {
      hash: record.signed_action.hashed.hash,
      ...decoded,
      createdAt: new Date(record.signed_action.hashed.content.timestamp / 1000)
    };
  } catch (error) {
    console.error('Failed to create UI entity:', error);
    return null;
  }
};
```

### 2. Record Mapping Helper

Maps arrays of Records to UI entities with null safety.

```typescript
const mapRecordsToUIEntities = (records: Record[]): UIDomainEntity[] => {
  return records
    .map(createUIEntity)
    .filter((entity): entity is UIDomainEntity => entity !== null);
};
```

### 3. Cache Sync Helper

Synchronizes cache with state arrays for CRUD operations.

```typescript
const createCacheSyncHelper = () => {
  const syncCacheWithEntities = () => {
    entities.forEach(entity => cache.set(entity.hash, entity));
  };
  
  const syncEntityWithCache = (entity: UIDomainEntity) => {
    cache.set(entity.hash, entity);
    const index = entities.findIndex(e => e.hash === entity.hash);
    if (index !== -1) {
      entities[index] = entity;
    } else {
      entities = [...entities, entity];
    }
  };
  
  return { syncCacheWithEntities, syncEntityWithCache };
};
```

### 4. Event Emission Helpers

Standardized event broadcasting for domain operations.

```typescript
const createEventEmitters = <T>(domain: string) => {
  const entityCreated = (entity: T) => {
    eventBus.emit(`${domain}:entity:created`, entity);
  };
  
  const entityUpdated = (entity: T) => {
    eventBus.emit(`${domain}:entity:updated`, entity);
  };
  
  const entityDeleted = (hash: ActionHash) => {
    eventBus.emit(`${domain}:entity:deleted`, hash);
  };
  
  const entitiesLoaded = (entities: T[]) => {
    eventBus.emit(`${domain}:entities:loaded`, entities);
  };
  
  return { entityCreated, entityUpdated, entityDeleted, entitiesLoaded };
};
```

### 5. Data Fetching Helper

Higher-order fetching function with loading/error state management.

```typescript
const createEntityFetcher = <T, E>(
  fetchOperation: Effect.Effect<T[], E>,
  processingFn: (records: any[]) => T[]
) => {
  const fetchWithState = Effect.gen(function* () {
    isLoading = true;
    error = null;
    
    const result = yield* fetchOperation;
    const processed = processingFn(result);
    entities = processed;
    syncCacheWithEntities();
    eventEmitters.entitiesLoaded(processed);
    
    isLoading = false;
    return processed;
  }).pipe(
    Effect.catchAll((err) => Effect.sync(() => {
      error = err.message;
      isLoading = false;
      return [];
    }))
  );
  
  return fetchWithState;
};
```

### 6. Loading State Helper

Wraps operations with consistent loading/error patterns.

```typescript
const withLoadingState = <T, E>(
  operation: Effect.Effect<T, E>
) => Effect.gen(function* () {
  isLoading = true;
  error = null;
  
  const result = yield* operation;
  
  isLoading = false;
  return result;
}).pipe(
  Effect.catchAll((err) => Effect.sync(() => {
    error = err.message;
    isLoading = false;
    throw err;
  }))
);
```

### 7. Record Creation Helper

Processes newly created records and updates cache/state.

```typescript
const createRecordCreationHelper = () => {
  const handleNewRecord = (newEntity: UIDomainEntity) => {
    entities = [...entities, newEntity];
    cache.set(newEntity.hash, newEntity);
    eventEmitters.entityCreated(newEntity);
  };
  
  const handleUpdatedRecord = (updatedEntity: UIDomainEntity) => {
    const index = entities.findIndex(e => e.hash === updatedEntity.hash);
    if (index !== -1) {
      entities[index] = updatedEntity;
      cache.set(updatedEntity.hash, updatedEntity);
      eventEmitters.entityUpdated(updatedEntity);
    }
  };
  
  return { handleNewRecord, handleUpdatedRecord };
};
```

### 8. Status Transition Helper

Manages status changes with atomic updates.

```typescript
const createStatusTransitionHelper = () => {
  const updateEntityStatus = (hash: ActionHash, newStatus: EntityStatus) => {
    const index = entities.findIndex(e => e.hash === hash);
    if (index !== -1) {
      const updatedEntity = { ...entities[index], status: newStatus };
      entities[index] = updatedEntity;
      cache.set(hash, updatedEntity);
      eventEmitters.entityUpdated(updatedEntity);
    }
  };
  
  const batchUpdateStatus = (updates: { hash: ActionHash; status: EntityStatus }[]) => {
    const updatedEntities = entities.map(entity => {
      const update = updates.find(u => u.hash === entity.hash);
      return update ? { ...entity, status: update.status } : entity;
    });
    
    entities = updatedEntities;
    updatedEntities.forEach(entity => cache.set(entity.hash, entity));
    eventEmitters.entitiesLoaded(updatedEntities);
  };
  
  return { updateEntityStatus, batchUpdateStatus };
};
```

### 9. Collection Processor

Handles complex responses with multiple collections.

```typescript
const processMultipleRecordCollections = (response: ComplexResponse) => {
  const processCollections = (collections: Record<string, Record[]>) => {
    const processed: Record<string, UIDomainEntity[]> = {};
    
    for (const [key, records] of Object.entries(collections)) {
      processed[key] = mapRecordsToUIEntities(records);
    }
    
    return processed;
  };
  
  const mergeCollections = (
    primary: UIDomainEntity[],
    related: Record<string, UIDomainEntity[]>
  ) => {
    // Merge related entities into primary entities
    return primary.map(entity => ({
      ...entity,
      ...Object.keys(related).reduce((acc, key) => ({
        ...acc,
        [key]: related[key].filter(relatedEntity => 
          /* relationship logic based on domain */
        )
      }), {})
    }));
  };
  
  return { processCollections, mergeCollections };
};
```

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
  createEntity: (input: CreateServiceTypeInput) => Effect.Effect<UIServiceType, ServiceTypeError>;
  updateEntity: (hash: ActionHash, input: UpdateServiceTypeInput) => Effect.Effect<UIServiceType, ServiceTypeError>;
  deleteEntity: (hash: ActionHash) => Effect.Effect<void, ServiceTypeError>;
  approveEntity: (hash: ActionHash) => Effect.Effect<UIServiceType, ServiceTypeError>;
  rejectEntity: (hash: ActionHash) => Effect.Effect<UIServiceType, ServiceTypeError>;
  searchEntities: (query: string) => Effect.Effect<UIServiceType[], ServiceTypeError>;
  
  // Status transitions
  updateEntityStatus: (hash: ActionHash, status: ServiceTypeStatus) => void;
  batchUpdateStatus: (updates: { hash: ActionHash; status: ServiceTypeStatus }[]) => void;
  
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
  serviceTypesStore.fetchEntities.pipe(
    Effect.provide(ServiceTypeServiceLive)
  )
);

// Create new entity
await Effect.runPromise(
  serviceTypesStore.createEntity({
    name: 'Web Development',
    description: 'Frontend and backend web development services'
  }).pipe(
    Effect.provide(ServiceTypeServiceLive)
  )
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
  createEntity: (input: CreateRequestInput) => Effect.Effect<UIRequest, RequestError>;
  updateEntity: (hash: ActionHash, input: UpdateRequestInput) => Effect.Effect<UIRequest, RequestError>;
  deleteEntity: (hash: ActionHash) => Effect.Effect<void, RequestError>;
  fulfillRequest: (hash: ActionHash) => Effect.Effect<UIRequest, RequestError>;
  closeRequest: (hash: ActionHash) => Effect.Effect<void, RequestError>;
  
  // Specialized operations
  getRequestsByServiceType: (serviceTypeHash: ActionHash) => Effect.Effect<UIRequest[], RequestError>;
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
  'domainName',           // Cache namespace
  5 * 60 * 1000          // TTL: 5 minutes
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
const loadEntity = (hash: ActionHash) => Effect.gen(function* () {
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
const eventEmitters = createEventEmitters<UIServiceType>('serviceTypes');

// Usage in store operations
const createEntity = (input: CreateServiceTypeInput) =>
  withLoadingState(
    Effect.gen(function* () {
      const service = yield* ServiceTypeService;
      const newEntity = yield* service.createServiceType(input);
      handleNewRecord(newEntity);
      eventEmitters.entityCreated(newEntity); // Event emission
      return newEntity;
    })
  );
```

### Event Listening

```typescript
// Stores can listen to events from other domains
$effect(() => {
  const unsubscribe = eventBus.on('requests:entity:created', (request: UIRequest) => {
    // Handle request creation in this store
    if (request.serviceTypeHash) {
      // Update related service type usage count
      updateServiceTypeUsage(request.serviceTypeHash);
    }
  });

  return unsubscribe;
});
```

## Testing Stores

### Helper Function Testing

```typescript
describe('ServiceTypes Store - Helper Functions', () => {
  let store: ReturnType<typeof createServiceTypesStore>;
  
  beforeEach(() => {
    store = createServiceTypesStore();
  });

  it('should implement all 9 helper functions', () => {
    expect(typeof store.createUIEntity).toBe('function');
    expect(typeof store.mapRecordsToUIEntities).toBe('function');
    expect(typeof store.syncEntityWithCache).toBe('function');
    expect(typeof store.eventEmitters).toBe('object');
    expect(typeof store.fetchEntities).toBe('object'); // Effect object
    expect(typeof store.createEntity).toBe('function');
    expect(typeof store.updateEntity).toBe('function');
    expect(typeof store.updateEntityStatus).toBe('function');
    expect(typeof store.processMultipleRecordCollections).toBe('function');
  });

  it('should create UI entity correctly', () => {
    const mockRecord = createMockRecord();
    const entity = store.createUIEntity(mockRecord);
    
    expect(entity).toBeDefined();
    expect(entity?.hash).toBe(mockRecord.signed_action.hashed.hash);
    expect(entity?.name).toBe('Test Service Type');
  });
});
```

### Effect Operations Testing

```typescript
describe('ServiceTypes Store - Effect Operations', () => {
  it('should fetch entities successfully', async () => {
    const MockServiceTypeService = Layer.succeed(ServiceTypeService, {
      getAllServiceTypes: () => Effect.succeed([createMockUIServiceType()])
    });

    const store = createServiceTypesStore();
    const result = await Effect.runPromise(
      store.fetchEntities.pipe(
        Effect.provide(MockServiceTypeService)
      )
    );

    expect(result).toHaveLength(1);
    expect(store.entities()).toHaveLength(1);
  });
});
```

## Best Practices

### Do's ✅
- **Implement all 9 helper functions**: Never skip any helper function
- **Use cache synchronization**: Always sync cache with state changes
- **Emit events**: Broadcast relevant events for cross-domain communication
- **Handle errors gracefully**: Use Effect-TS error handling patterns
- **Expose helpers for composables**: Make helper functions available to composables

### Don'ts ❌
- **Skip helper functions**: Never implement partial helper functions
- **Direct state mutation**: Always use reactive state patterns
- **Cache inconsistency**: Never allow cache and state to become inconsistent
- **Silent error handling**: Always handle and report errors appropriately
- **Mixed reactive patterns**: Use only Svelte 5 Runes for reactivity

This store layer provides reactive state management with consistent patterns across all domains, ensuring maintainability and scalability of the application.