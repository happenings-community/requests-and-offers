# Development Workflow Guide

This guide provides practical patterns for implementing features in the Requests & Offers project, following our established 7-layer Effect-TS architecture.

## Overview

Our development workflow follows a standardized pattern across all domains, ensuring consistency and maintainability. Every feature implementation follows the same 7-layer structure with established patterns.

## Development Cycle

### 1. Domain Analysis & Planning

Before implementing any feature, understand the domain structure:

```bash
# Explore existing domains for patterns
ls ui/src/lib/services/zomes/     # Service layer implementations
ls ui/src/lib/stores/             # Store layer implementations  
ls ui/src/lib/composables/domain/ # Composable implementations
ls ui/src/lib/components/         # Component implementations
```

**Use Service Types as Template**: The service-types domain is 100% complete and serves as the architectural template for all new implementations.

### 2. Layer Implementation Order

Always implement layers in this order to maintain dependencies:

1. **Zome Layer** (Backend) → 2. **Service Layer** → 3. **Store Layer** → 4. **Composable Layer** → 5. **Component Layer** → 6. **Error Handling** → 7. **Testing**

### 3. Backend Development (Zomes)

#### Coordinator Zome Implementation

```bash
# Create new zome structure
cd dnas/requests_and_offers/zomes/coordinator/
mkdir my_domain && cd my_domain
```

**Pattern**: Follow the coordinator/integrity separation:

```rust
// coordinator/my_domain/src/lib.rs
use hdk::prelude::*;
use my_domain_integrity::*;

#[hdk_extern]
pub fn create_my_entity(input: CreateMyEntityInput) -> ExternResult<Record> {
    // Business logic implementation
}

#[hdk_extern] 
pub fn get_my_entities() -> ExternResult<Vec<Record>> {
    // Query implementation
}
```

#### Testing Pattern

```bash
# Create and run zome tests
bun test:my-domain
```

Test all CRUD operations and business logic before moving to frontend.

### 4. Service Layer Implementation

Create Effect-native services with dependency injection:

```typescript
// ui/src/lib/services/zomes/myDomain.service.ts
import { Context, Effect, pipe } from 'effect';
import { HolochainClientService } from '../HolochainClientService.svelte';

export interface MyDomainService {
  readonly createMyEntity: (input: CreateMyEntityInput) => Effect.Effect<UIMyEntity, MyDomainError>;
  readonly getAllMyEntities: () => Effect.Effect<UIMyEntity[], MyDomainError>;
  readonly updateMyEntity: (hash: ActionHash, input: UpdateMyEntityInput) => Effect.Effect<UIMyEntity, MyDomainError>;
  readonly deleteMyEntity: (hash: ActionHash) => Effect.Effect<void, MyDomainError>;
}

export const MyDomainService = Context.GenericTag<MyDomainService>("MyDomainService");

export const makeMyDomainService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createMyEntity = (input: CreateMyEntityInput) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'my_domain',
        fn_name: 'create_my_entity', 
        payload: input
      });
      return createUIMyEntity(record);
    }).pipe(
      Effect.mapError((error) => MyDomainError.fromError(error, MY_DOMAIN_CONTEXTS.CREATE_MY_ENTITY)),
      Effect.withSpan('MyDomainService.createMyEntity')
    );

  return { createMyEntity, getAllMyEntities, updateMyEntity, deleteMyEntity };
});
```

**Key Patterns**:
- Use `Effect.gen` for complex operations with dependencies
- Use `.pipe` for error handling and tracing
- Apply consistent error transformation with domain contexts
- Include telemetry with `Effect.withSpan`

### 5. Store Layer Implementation

Create factory functions combining Svelte 5 Runes with Effect-TS:

```typescript
// ui/src/lib/stores/myDomain.store.svelte.ts
import { Effect, Context } from 'effect';
import { MyDomainService } from '$lib/services';

export const createMyDomainStore = () => {
  // Reactive state with Svelte 5 Runes
  let entities = $state<UIMyEntity[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Cache management
  const cache = createModuleCache<ActionHash, UIMyEntity>('myDomain', 5 * 60 * 1000);

  // 1. Entity Creation Helper
  const createUIEntity = (record: Record): UIMyEntity | null => {
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

  // 2. Record Mapping Helper  
  const mapRecordsToUIEntities = (records: Record[]): UIMyEntity[] => {
    return records
      .map(createUIEntity)
      .filter((entity): entity is UIMyEntity => entity !== null);
  };

  // 3. Cache Sync Helper
  const syncCacheWithEntities = () => {
    entities.forEach(entity => cache.set(entity.hash, entity));
  };

  // 4. Event Emission Helpers
  const eventEmitters = createEventEmitters<UIMyEntity>('myDomain');

  // 5. Data Fetching Helper
  const fetchEntities = Effect.gen(function* () {
    const myDomainService = yield* MyDomainService;
    isLoading = true;
    error = null;

    const result = yield* myDomainService.getAllMyEntities();
    entities = mapRecordsToUIEntities(result);
    syncCacheWithEntities();
    
    isLoading = false;
    return entities;
  }).pipe(
    Effect.catchAll((err) => Effect.sync(() => {
      error = err.message;
      isLoading = false;
      return [];
    }))
  );

  // 6. Loading State Helper
  const withLoadingState = <T>(operation: Effect.Effect<T, any>) =>
    Effect.gen(function* () {
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

  // 7. Record Creation Helper
  const handleNewRecord = (newEntity: UIMyEntity) => {
    entities = [...entities, newEntity];
    cache.set(newEntity.hash, newEntity);
    eventEmitters.entityCreated(newEntity);
  };

  // 8. Status Transition Helper (if applicable)
  const updateEntityStatus = (hash: ActionHash, newStatus: EntityStatus) => {
    const index = entities.findIndex(e => e.hash === hash);
    if (index !== -1) {
      entities[index] = { ...entities[index], status: newStatus };
      cache.set(hash, entities[index]);
      eventEmitters.entityUpdated(entities[index]);
    }
  };

  // 9. Collection Processor
  const processMultipleCollections = (response: ComplexResponse) => {
    if (response.myEntities) {
      entities = mapRecordsToUIEntities(response.myEntities);
    }
    // Handle related collections...
  };

  return {
    // Reactive state
    entities: () => entities,
    isLoading: () => isLoading,
    error: () => error,
    
    // Actions
    fetchEntities,
    createEntity: (input: CreateMyEntityInput) => withLoadingState(
      Effect.gen(function* () {
        const myDomainService = yield* MyDomainService;
        const newEntity = yield* myDomainService.createMyEntity(input);
        handleNewRecord(newEntity);
        return newEntity;
      })
    ),
    
    // Helpers (exposed for composables)
    createUIEntity,
    mapRecordsToUIEntities,
    eventEmitters
  };
};
```

**Implementation Notes**:
- Always implement all 9 standardized helper functions
- Use Svelte 5 Runes for reactive state
- Integrate Effect-TS for async operations
- Include proper error handling and loading states
- Implement cache management with TTL

### 6. Composable Layer Implementation

Create composables that abstract business logic from components:

```typescript
// ui/src/lib/composables/domain/my-domain/useMyDomainManagement.svelte.ts
import { Effect } from 'effect';
import { useErrorBoundary } from '$lib/composables';
import { createMyDomainStore } from '$lib/stores';
import { MY_DOMAIN_CONTEXTS } from '$lib/errors';

export function useMyDomainManagement() {
  // Create domain store
  const store = createMyDomainStore();
  
  // Error boundaries for different operations
  const loadingErrorBoundary = useErrorBoundary({
    context: MY_DOMAIN_CONTEXTS.FETCH_MY_ENTITIES,
    enableLogging: true,
    enableFallback: true,
    maxRetries: 2
  });

  const createErrorBoundary = useErrorBoundary({
    context: MY_DOMAIN_CONTEXTS.CREATE_MY_ENTITY,
    enableLogging: true,
    maxRetries: 1
  });

  // Enhanced operations with error handling
  const loadEntities = async () => {
    await loadingErrorBoundary.execute(store.fetchEntities, []);
  };

  const createEntity = async (input: CreateMyEntityInput) => {
    await createErrorBoundary.execute(store.createEntity(input));
  };

  // Reactive state that components can use
  let state = $state({
    entities: store.entities,
    isLoading: store.isLoading,
    error: store.error,
    loadingError: () => loadingErrorBoundary.state.error,
    createError: () => createErrorBoundary.state.error
  });

  return {
    // State
    state,
    
    // Actions
    loadEntities,
    createEntity,
    
    // Error boundaries
    loadingErrorBoundary,
    createErrorBoundary,
    
    // Store methods (if needed directly)
    store
  };
}
```

### 7. Component Layer Implementation

Create Svelte components that use composables for business logic:

```svelte
<!-- ui/src/lib/components/my-domain/MyDomainGrid.svelte -->
<script>
  import { useMyDomainManagement } from '$lib/composables';
  import ErrorDisplay from '$lib/components/shared/ErrorDisplay.svelte';
  
  const {
    state,
    loadEntities,
    createEntity,
    loadingErrorBoundary,
    createErrorBoundary
  } = useMyDomainManagement();

  // Load entities on mount
  $effect(() => {
    loadEntities();
  });
</script>

<!-- Error Displays -->
{#if state.loadingError()}
  <ErrorDisplay
    error={state.loadingError()}
    context="Loading entities"
    variant="inline"
    showRetry={true}
    onretry={() => loadEntities()}
    ondismiss={() => loadingErrorBoundary.clearError()}
  />
{/if}

<!-- Loading State -->
{#if state.isLoading()}
  <div>Loading entities...</div>
{/if}

<!-- Entity Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each state.entities() as entity (entity.hash)}
    <MyDomainCard {entity} />
  {/each}
</div>
```

### 8. Error Handling Implementation

Create domain-specific error handling:

```typescript
// ui/src/lib/errors/my-domain.errors.ts
import { Data } from 'effect';

export class MyDomainError extends Data.TaggedError('MyDomainError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly entityId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    entityId?: string,
    operation?: string
  ): MyDomainError {
    const message = error instanceof Error ? error.message : String(error);
    return new MyDomainError({
      message,
      cause: error,
      context,
      entityId,
      operation
    });
  }
}

// Add to error-contexts.ts
export const MY_DOMAIN_CONTEXTS = {
  CREATE_MY_ENTITY: 'Failed to create entity',
  GET_MY_ENTITY: 'Failed to get entity', 
  UPDATE_MY_ENTITY: 'Failed to update entity',
  DELETE_MY_ENTITY: 'Failed to delete entity',
  FETCH_MY_ENTITIES: 'Failed to fetch entities'
} as const;
```

### 9. Testing Implementation

Create comprehensive tests for each layer:

```bash
# Backend tests (Tryorama)
cd tests && bun test # Runs all integration tests

# Frontend unit tests  
cd ui && bun test:unit -- my-domain

# Integration tests
cd ui && bun test:integration -- my-domain
```

**Test Structure**:
```typescript
// ui/tests/unit/stores/myDomain.store.test.ts
import { describe, it, expect } from 'vitest';
import { createMyDomainStore } from '$lib/stores';

describe('MyDomain Store', () => {
  it('should create UI entities correctly', () => {
    const store = createMyDomainStore();
    const mockRecord = createMockRecord();
    const entity = store.createUIEntity(mockRecord);
    
    expect(entity).toBeDefined();
    expect(entity.hash).toBe(mockRecord.signed_action.hashed.hash);
  });

  it('should handle all 9 helper functions', () => {
    const store = createMyDomainStore();
    
    // Test each helper function
    expect(typeof store.createUIEntity).toBe('function');
    expect(typeof store.mapRecordsToUIEntities).toBe('function');
    // ... test all 9 helpers
  });
});
```

## Best Practices

### Effect-TS Patterns

#### When to Use Effect.gen vs .pipe

```typescript
// Use Effect.gen for:
// 1. Injecting dependencies
const serviceOperation = Effect.gen(function* () {
  const service = yield* MyDomainService;
  const result = yield* service.getAllEntities();
  return result;
});

// 2. Sequential operations with error handling
const complexOperation = Effect.gen(function* () {
  const step1 = yield* operation1();
  const step2 = yield* operation2(step1);
  return yield* operation3(step2);
});

// Use .pipe for:
// 1. Error handling
const withErrorHandling = operation.pipe(
  Effect.mapError(error => MyDomainError.fromError(error, context)),
  Effect.catchAll(fallbackOperation)
);

// 2. Transformations
const transformed = operation.pipe(
  Effect.map(result => transformResult(result)),
  Effect.withSpan('operation-name')
);
```

### Store Patterns

#### Always Implement the 9 Helper Functions

1. **createUIEntity**: Convert Holochain Record to UI entity
2. **mapRecordsToUIEntities**: Map array of Records with null safety
3. **createCacheSyncHelper**: Sync cache with state arrays
4. **createEventEmitters**: Standardized event broadcasting  
5. **createEntityFetcher**: Higher-order fetching with loading state
6. **withLoadingState**: Wrap operations with loading/error patterns
7. **createRecordCreationHelper**: Process new records and update cache
8. **createStatusTransitionHelper**: Handle status changes atomically
9. **processMultipleRecordCollections**: Handle complex responses

### Component Patterns

#### Use Composables for Business Logic

```svelte
<script>
  // ✅ Good - Use composable for business logic
  const { state, actions, errorBoundaries } = useMyDomainManagement();

  // ❌ Avoid - Direct store usage in components
  // const store = createMyDomainStore();
</script>
```

#### Consistent Error Display

```svelte
<!-- Always include error displays for user feedback -->
{#if errorBoundary.state.error}
  <ErrorDisplay
    error={errorBoundary.state.error}
    context="Operation description"
    showRetry={true}
    onretry={() => retryOperation()}
    ondismiss={() => errorBoundary.clearError()}
  />
{/if}
```

## Common Patterns

### Domain Implementation Checklist

- [ ] **Zome implemented** with coordinator/integrity pattern
- [ ] **Service layer** with Effect-TS and dependency injection
- [ ] **Store layer** with all 9 helper functions
- [ ] **Composable layer** abstracting business logic
- [ ] **Component layer** using composables
- [ ] **Error handling** with domain-specific errors and contexts
- [ ] **Tests** covering all layers (backend + frontend)
- [ ] **Documentation** updated with new domain

### Performance Considerations

- **Cache Management**: Implement TTL-based caching for frequently accessed data
- **Event Bus**: Use event emitters for cross-domain communication
- **Loading States**: Always provide loading feedback for async operations
- **Error Recovery**: Implement retry strategies and fallback mechanisms

### Maintenance Guidelines

- **Follow Service Types**: Use as reference implementation for all patterns
- **Consistent Naming**: Follow established naming conventions across domains
- **Documentation**: Update guides when adding new patterns
- **Testing**: Maintain test coverage for all new functionality

## Next Steps

1. **Study Complete Examples**: Examine service-types, requests, and offers domains
2. **Practice Implementation**: Try implementing a simple domain following this workflow
3. **Read Architecture Guides**: [Architectural Patterns](./architectural-patterns.md) and [Effect-TS Primer](./effect-ts-primer.md)
4. **Join Community**: Connect with other developers on [Discord](https://discord.gg/happening)

This workflow ensures consistency, maintainability, and scalability across all feature implementations in the project.