# Architectural Patterns Guide

This guide documents the established architectural patterns used throughout the Requests & Offers project. These patterns ensure consistency, maintainability, and scalability across all domains.

## Overview

Our architecture follows proven patterns that have been refined through implementing multiple domains. Every pattern documented here is used in production code and has been validated through the complete Service Types, Requests, and Offers domains.

## Core Architectural Principles

### 1. **7-Layer Architecture Pattern**

Each domain follows the same 7-layer structure:

```
7. Testing Layer     ← Comprehensive coverage across all layers
6. Component Layer   ← Svelte 5 components using composables  
5. Composable Layer  ← Business logic abstraction
4. Error Layer       ← Domain-specific error handling
3. Schema Layer      ← Effect Schema validation
2. Store Layer       ← Svelte 5 Runes + Effect-TS integration
1. Service Layer     ← Effect-native services with dependency injection
```

**Key Benefits**:
- **Consistency**: Same structure across all domains
- **Testability**: Each layer can be tested in isolation
- **Maintainability**: Clear separation of concerns
- **Scalability**: Easy to add new domains following the pattern

### 2. **Dependency Flow Pattern**

Dependencies always flow downward through the layers:

```
Components → Composables → Stores → Services → Holochain
     ↓           ↓          ↓         ↓          ↓
   UI Logic → Business → State → Network → Backend
            Logic     Mgmt    Calls
```

**Rules**:
- Components never directly access stores or services
- Composables orchestrate store and service interactions
- Stores manage reactive state and coordinate service calls
- Services handle all Holochain communication
- Each layer only depends on layers below it

## The 9 Standardized Store Helper Functions

Every domain store implements these 9 helper functions for consistency and functionality:

### 1. **Entity Creation Helper**
```typescript
const createUIEntity = (record: Record): UIEntity | null => {
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

**Purpose**: Converts Holochain Records to UI entities with error recovery
**Usage**: Primary conversion function for all incoming data

### 2. **Record Mapping Helper**
```typescript
const mapRecordsToUIEntities = (records: Record[]): UIEntity[] => {
  return records
    .map(createUIEntity)
    .filter((entity): entity is UIEntity => entity !== null);
};
```

**Purpose**: Maps arrays of Records to UI entities with null safety
**Usage**: Used in all list operations and bulk data processing

### 3. **Cache Sync Helper**
```typescript
const createCacheSyncHelper = () => {
  const syncCacheWithEntities = () => {
    entities.forEach(entity => cache.set(entity.hash, entity));
  };
  
  const syncEntityWithCache = (entity: UIEntity) => {
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

**Purpose**: Synchronizes cache with state arrays for CRUD operations
**Usage**: Maintains consistency between reactive state and cached data

### 4. **Event Emission Helpers**
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

**Purpose**: Standardized event broadcasting for domain operations
**Usage**: Cross-domain communication and UI synchronization

### 5. **Data Fetching Helper**
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

**Purpose**: Higher-order fetching function with loading/error state management
**Usage**: All data loading operations use this pattern

### 6. **Loading State Helper**
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

**Purpose**: Wraps operations with consistent loading/error patterns
**Usage**: Applied to all async operations that affect UI state

### 7. **Record Creation Helper**
```typescript
const createRecordCreationHelper = () => {
  const handleNewRecord = (newEntity: UIEntity) => {
    entities = [...entities, newEntity];
    cache.set(newEntity.hash, newEntity);
    eventEmitters.entityCreated(newEntity);
  };
  
  const handleUpdatedRecord = (updatedEntity: UIEntity) => {
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

**Purpose**: Processes newly created records and updates cache/state
**Usage**: All create and update operations use these helpers

### 8. **Status Transition Helper**
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

**Purpose**: Manages status changes with atomic updates
**Usage**: Status workflows and bulk status operations

### 9. **Collection Processor**
```typescript
const processMultipleRecordCollections = (response: ComplexResponse) => {
  const processCollections = (collections: Record<string, Record[]>) => {
    const processed: Record<string, UIEntity[]> = {};
    
    for (const [key, records] of Object.entries(collections)) {
      processed[key] = mapRecordsToUIEntities(records);
    }
    
    return processed;
  };
  
  const mergeCollections = (
    primary: UIEntity[],
    related: Record<string, UIEntity[]>
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

**Purpose**: Handles complex responses with multiple collections
**Usage**: Complex queries returning multiple related entity types

## Cache Management Patterns

### Module-Level Cache Pattern
```typescript
// Cache configuration
const cache = createModuleCache<ActionHash, UIEntity>(
  'domainName',           // Cache namespace
  5 * 60 * 1000          // TTL: 5 minutes
);

// Cache strategies
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

## Error Boundary Patterns

### Composable Error Boundaries
```typescript
export function useDomainManagement() {
  // Separate error boundaries for different operation types
  const loadingErrorBoundary = useErrorBoundary({
    context: DOMAIN_CONTEXTS.FETCH_ENTITIES,
    enableLogging: true,
    enableFallback: true,
    maxRetries: 2,
    retryDelay: 1000
  });

  const mutationErrorBoundary = useErrorBoundary({
    context: DOMAIN_CONTEXTS.CREATE_ENTITY,
    enableLogging: true,
    maxRetries: 1,
    retryDelay: 500
  });

  const criticalErrorBoundary = useErrorBoundary({
    context: DOMAIN_CONTEXTS.DELETE_ENTITY,
    enableLogging: true,
    maxRetries: 0,  // No auto-retry for destructive operations
    enableToast: true
  });

  return {
    loadingErrorBoundary,
    mutationErrorBoundary,
    criticalErrorBoundary
  };
}
```

### Error Context Patterns
```typescript
// Standardized error contexts per domain
export const DOMAIN_CONTEXTS = {
  // CRUD operations
  CREATE_ENTITY: 'Failed to create entity',
  GET_ENTITY: 'Failed to get entity',
  UPDATE_ENTITY: 'Failed to update entity',
  DELETE_ENTITY: 'Failed to delete entity',
  
  // List operations
  FETCH_ENTITIES: 'Failed to fetch entities',
  SEARCH_ENTITIES: 'Failed to search entities',
  FILTER_ENTITIES: 'Failed to filter entities',
  
  // Specialized operations
  APPROVE_ENTITY: 'Failed to approve entity',
  REJECT_ENTITY: 'Failed to reject entity',
  PUBLISH_ENTITY: 'Failed to publish entity'
} as const;
```

## Event Bus Patterns

### Domain Event System
```typescript
// Event type definitions
type DomainEvents = {
  'service-types:entity:created': UIServiceType;
  'service-types:entity:updated': UIServiceType;
  'service-types:entity:deleted': ActionHash;
  'service-types:entities:loaded': UIServiceType[];
  'service-types:status:changed': { hash: ActionHash; status: ServiceTypeStatus };
};

// Event emission in stores
const emitEntityCreated = (entity: UIServiceType) => {
  eventBus.emit('service-types:entity:created', entity);
};

// Event listening in composables
const setupEventListeners = () => {
  eventBus.on('service-types:entity:created', (entity) => {
    // Handle cross-domain updates
  });
  
  eventBus.on('service-types:status:changed', ({ hash, status }) => {
    // Update related entities
  });
};
```

### Cross-Domain Communication
```typescript
// Example: Requests listening to Service Type changes
export function useRequestsManagement() {
  const store = createRequestsStore();
  
  // Listen for service type updates that affect requests
  eventBus.on('service-types:entity:updated', (serviceType) => {
    // Update requests that reference this service type
    store.updateServiceTypeReferences(serviceType);
  });
  
  eventBus.on('service-types:entity:deleted', (serviceTypeHash) => {
    // Handle deletion of referenced service type
    store.handleServiceTypeDeletion(serviceTypeHash);
  });
  
  return store;
}
```

## Composable Abstraction Patterns

### Business Logic Separation
```typescript
export function useDomainManagement() {
  const store = createDomainStore();
  const { loadingErrorBoundary, mutationErrorBoundary } = useErrorBoundaries();
  
  // Reactive state (read-only for components)
  let state = $state({
    entities: store.entities,
    isLoading: store.isLoading,
    error: store.error,
    
    // Computed derived state
    approvedEntities: () => store.entities().filter(e => e.status === 'approved'),
    pendingEntities: () => store.entities().filter(e => e.status === 'pending'),
    
    // Error states from boundaries
    loadingError: () => loadingErrorBoundary.state.error,
    mutationError: () => mutationErrorBoundary.state.error
  });
  
  // Business operations (with error handling)
  const operations = {
    async loadEntities() {
      await loadingErrorBoundary.execute(store.fetchEntities, []);
    },
    
    async createEntity(input: CreateEntityInput) {
      await mutationErrorBoundary.execute(store.createEntity(input));
    },
    
    async updateEntityStatus(hash: ActionHash, status: EntityStatus) {
      await mutationErrorBoundary.execute(
        store.updateEntityStatus(hash, status)
      );
    }
  };
  
  // Lifecycle management
  onMount(() => {
    operations.loadEntities();
  });
  
  return {
    state,
    operations,
    
    // Expose error boundaries for component error handling
    loadingErrorBoundary,
    mutationErrorBoundary
  };
}
```

### Composable Composition Pattern
```typescript
// Specialized composables that compose domain management
export function useEntitySelection() {
  const { state } = useDomainManagement();
  
  let selectedEntities = $state<Set<ActionHash>>(new Set());
  
  const selection = {
    selectedEntities: () => selectedEntities,
    isSelected: (hash: ActionHash) => selectedEntities.has(hash),
    toggleSelection: (hash: ActionHash) => {
      if (selectedEntities.has(hash)) {
        selectedEntities.delete(hash);
      } else {
        selectedEntities.add(hash);
      }
      selectedEntities = new Set(selectedEntities);
    },
    selectAll: () => {
      selectedEntities = new Set(state.entities().map(e => e.hash));
    },
    clearSelection: () => {
      selectedEntities = new Set();
    }
  };
  
  return { selection };
}
```

## Component Integration Patterns

### Component-Composable Integration
```svelte
<!-- DomainManagementPage.svelte -->
<script>
  import { useDomainManagement, useEntitySelection } from '$lib/composables';
  import ErrorDisplay from '$lib/components/shared/ErrorDisplay.svelte';
  import EntityCard from './EntityCard.svelte';
  
  const { state, operations, loadingErrorBoundary, mutationErrorBoundary } = useDomainManagement();
  const { selection } = useEntitySelection();
</script>

<!-- Error displays for different operations -->
{#if state.loadingError()}
  <ErrorDisplay
    error={state.loadingError()}
    context="Loading entities"
    variant="inline"
    showRetry={true}
    onretry={() => operations.loadEntities()}
    ondismiss={() => loadingErrorBoundary.clearError()}
  />
{/if}

{#if state.mutationError()}
  <ErrorDisplay
    error={state.mutationError()}
    context="Entity operation"
    variant="banner"
    ondismiss={() => mutationErrorBoundary.clearError()}
  />
{/if}

<!-- Entity grid with selection -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each state.entities() as entity (entity.hash)}
    <EntityCard 
      {entity} 
      isSelected={selection.isSelected(entity.hash)}
      onToggleSelection={() => selection.toggleSelection(entity.hash)}
      onUpdate={(input) => operations.updateEntity(entity.hash, input)}
    />
  {/each}
</div>
```

## Service Layer Patterns

### Effect-TS Service Pattern
```typescript
export const makeDomainService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  // CRUD operations with consistent error handling
  const createEntity = (input: CreateEntityInput) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'domain',
        fn_name: 'create_entity',
        payload: input
      });
      
      return createUIEntity(record);
    }).pipe(
      Effect.mapError((error) => DomainError.fromError(error, DOMAIN_CONTEXTS.CREATE_ENTITY)),
      Effect.withSpan('DomainService.createEntity')
    );

  const getAllEntities = () =>
    Effect.gen(function* () {
      const records = yield* client.callZome({
        zome_name: 'domain',
        fn_name: 'get_all_entities',
        payload: null
      });
      
      return mapRecordsToUIEntities(records);
    }).pipe(
      Effect.mapError((error) => DomainError.fromError(error, DOMAIN_CONTEXTS.FETCH_ENTITIES)),
      Effect.withSpan('DomainService.getAllEntities')
    );

  // Specialized operations
  const approveEntity = (hash: ActionHash) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'domain',
        fn_name: 'approve_entity',
        payload: hash
      });
      
      return createUIEntity(record);
    }).pipe(
      Effect.mapError((error) => DomainError.fromError(error, DOMAIN_CONTEXTS.APPROVE_ENTITY, hash)),
      Effect.withSpan('DomainService.approveEntity')
    );

  return {
    createEntity,
    getAllEntities,
    updateEntity,
    deleteEntity,
    approveEntity
  };
});
```

## Testing Patterns

### Layer-Specific Testing
```typescript
// Service layer testing
describe('DomainService', () => {
  it('should create entity with proper error handling', async () => {
    const MockHolochainClient = Layer.succeed(HolochainClientService, {
      callZome: () => Effect.succeed(mockRecord)
    });

    const TestDomainServiceLive = Layer.provide(
      DomainServiceLive,
      MockHolochainClient
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* DomainService;
        return yield* service.createEntity(mockInput);
      }).pipe(Effect.provide(TestDomainServiceLive))
    );

    expect(result.name).toBe(mockInput.name);
  });
});

// Store layer testing
describe('DomainStore', () => {
  it('should implement all 9 helper functions', () => {
    const store = createDomainStore();
    
    expect(typeof store.createUIEntity).toBe('function');
    expect(typeof store.mapRecordsToUIEntities).toBe('function');
    // ... test all 9 helpers
  });
  
  it('should handle entity creation with cache sync', () => {
    const store = createDomainStore();
    const entity = store.createUIEntity(mockRecord);
    
    expect(entity).toBeDefined();
    expect(store.getCachedEntity(entity.hash)).toEqual(entity);
  });
});
```

## Performance Patterns

### Optimization Strategies
```typescript
// Lazy loading pattern
const lazyLoadEntity = (hash: ActionHash) => Effect.lazy(() =>
  Effect.gen(function* () {
    const cached = getCachedEntity(hash);
    if (cached) return cached;
    
    const service = yield* DomainService;
    return yield* service.getEntity(hash);
  })
);

// Batch operations pattern
const batchCreateEntities = (inputs: CreateEntityInput[]) =>
  Effect.gen(function* () {
    const service = yield* DomainService;
    
    // Process in batches to avoid overwhelming the network
    const batches = chunk(inputs, 10);
    const results = [];
    
    for (const batch of batches) {
      const batchResults = yield* Effect.all(
        batch.map(input => service.createEntity(input)),
        { concurrency: 5 }
      );
      results.push(...batchResults);
    }
    
    return results;
  });
```

## Best Practices Summary

### Do's ✅
- **Follow the 9 Helper Functions**: Implement all helpers in every store
- **Use Error Boundaries**: Separate boundaries for different operation types
- **Implement Caching**: Use module-level caching with TTL
- **Event Communication**: Use event bus for cross-domain communication
- **Layer Separation**: Maintain clear dependency flow between layers
- **Effect-TS Patterns**: Use Effect.gen for dependencies, .pipe for transformations
- **Comprehensive Testing**: Test each layer independently

### Don'ts ❌
- **Skip Helper Functions**: Never implement only partial helper functions
- **Direct Store Access**: Components should never directly access stores
- **Mixed Error Contexts**: Don't reuse error contexts across domains
- **Cache Inconsistency**: Always sync cache with reactive state changes
- **Layer Violations**: Never skip layers or create circular dependencies
- **Manual Error Handling**: Always use error boundaries and tagged errors
- **State Mutation**: Never mutate state outside of designated helper functions

## Migration Guide

When implementing a new domain or updating an existing one:

1. **Start with Service Layer**: Implement Effect-TS service with proper dependency injection
2. **Create Store with All 9 Helpers**: Don't skip any helper functions
3. **Add Error Handling**: Implement domain-specific errors and contexts
4. **Build Composable**: Abstract business logic from components
5. **Create Components**: Use composables, never direct store access
6. **Add Comprehensive Tests**: Test each layer independently
7. **Document Patterns**: Update this guide if you establish new patterns

This architectural patterns guide ensures consistency and quality across all domains in the project. Follow these patterns to maintain the high standards established in the Service Types, Requests, and Offers domains.