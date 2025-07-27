# Domain Implementation Guide

This guide provides a step-by-step template for implementing new domains in the Requests & Offers project, following our established 7-layer Effect-TS architecture. Use this as a practical walkthrough for creating consistent, maintainable domain implementations.

## Overview

Every domain implementation follows the same pattern, ensuring consistency and maintainability. This guide uses the **Service Types** domain as a concrete example, since it's 100% complete and serves as our architectural template.

## Implementation Checklist

Use this checklist for every new domain:

- [ ] **1. Zome Layer** - Holochain backend implementation
- [ ] **2. Service Layer** - Effect-TS service with dependency injection  
- [ ] **3. Store Layer** - Svelte 5 Runes + Effect-TS with 9 helper functions
- [ ] **4. Error Layer** - Domain-specific error handling and contexts
- [ ] **5. Schema Layer** - Effect Schema validation
- [ ] **6. Composable Layer** - Business logic abstraction  
- [ ] **7. Component Layer** - Svelte 5 components using composables
- [ ] **8. Testing Layer** - Comprehensive test coverage

## Step-by-Step Implementation

### Step 1: Zome Layer (Backend)

#### 1.1 Create Zome Structure

```bash
# Create coordinator zome
cd dnas/requests_and_offers/zomes/coordinator/
mkdir my_domain && cd my_domain

# Create integrity zome  
cd ../../../integrity/
mkdir my_domain && cd my_domain
```

#### 1.2 Implement Coordinator Zome

**File**: `dnas/requests_and_offers/zomes/coordinator/my_domain/src/lib.rs`

```rust
use hdk::prelude::*;
use my_domain_integrity::*;

#[hdk_extern]
pub fn create_my_entity(input: CreateMyEntityInput) -> ExternResult<Record> {
    let my_entity_hash = create_entry(&EntryTypes::MyEntity(input.clone()))?;
    
    let record = get(my_entity_hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Could not find the just created MyEntity"))))?;
        
    let path = Path::from("all_my_entities");
    create_link(path.path_entry_hash()?, my_entity_hash.clone(), LinkTypes::AllMyEntities, ())?;
    
    Ok(record)
}

#[hdk_extern]
pub fn get_all_my_entities(_: ()) -> ExternResult<Vec<Record>> {
    let path = Path::from("all_my_entities");
    let links = get_links(path.path_entry_hash()?, LinkTypes::AllMyEntities, None)?;
    
    let get_input: Vec<GetInput> = links
        .into_iter()
        .map(|link| GetInput::new(
            ActionHash::from(link.target).into(),
            GetOptions::default(),
        ))
        .collect();
        
    let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
    let records: Vec<Record> = records.into_iter().filter_map(|r| r).collect();
    
    Ok(records)
}

#[hdk_extern]
pub fn get_my_entity(my_entity_hash: ActionHash) -> ExternResult<Option<Record>> {
    get(my_entity_hash, GetOptions::default())
}

#[hdk_extern]
pub fn update_my_entity(input: UpdateMyEntityInput) -> ExternResult<Record> {
    let updated_my_entity_hash = update_entry(input.original_my_entity_hash.clone(), &input.my_entity)?;
    
    let record = get(updated_my_entity_hash, GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Could not find the just updated MyEntity"))))?;
        
    Ok(record)
}

#[hdk_extern]
pub fn delete_my_entity(original_my_entity_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_entry(original_my_entity_hash)
}
```

#### 1.3 Implement Integrity Zome

**File**: `dnas/requests_and_offers/zomes/integrity/my_domain/src/lib.rs`

```rust
use hdi::prelude::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
    MyEntity(MyEntity),
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllMyEntities,
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct MyEntity {
    pub name: String,
    pub description: String,
    pub status: MyEntityStatus,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum MyEntityStatus {
    Pending,
    Approved,
    Rejected,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CreateMyEntityInput {
    pub name: String,
    pub description: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateMyEntityInput {
    pub original_my_entity_hash: ActionHash,
    pub my_entity: MyEntity,
}
```

#### 1.4 Test the Zome

```bash
# Build and test the zome
bun build:zomes
bun test:my-domain
```

### Step 2: Service Layer (Effect-TS)

**File**: `ui/src/lib/services/zomes/myDomain.service.ts`

```typescript
import { Context, Effect, pipe } from 'effect';
import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientService } from '../HolochainClientService.svelte';
import { MyDomainError, MY_DOMAIN_CONTEXTS } from '$lib/errors';
import type { CreateMyEntityInput, UpdateMyEntityInput, UIMyEntity } from '$lib/types';

// 1. Define service interface
export interface MyDomainService {
  readonly createMyEntity: (input: CreateMyEntityInput) => Effect.Effect<UIMyEntity, MyDomainError>;
  readonly getAllMyEntities: () => Effect.Effect<UIMyEntity[], MyDomainError>;
  readonly getMyEntity: (hash: ActionHash) => Effect.Effect<UIMyEntity | null, MyDomainError>;
  readonly updateMyEntity: (hash: ActionHash, input: UpdateMyEntityInput) => Effect.Effect<UIMyEntity, MyDomainError>;
  readonly deleteMyEntity: (hash: ActionHash) => Effect.Effect<void, MyDomainError>;
}

// 2. Create service tag for dependency injection
export const MyDomainService = Context.GenericTag<MyDomainService>("MyDomainService");

// 3. Implement service with dependencies
export const makeMyDomainService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createMyEntity = (input: CreateMyEntityInput) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'my_domain',
        fn_name: 'create_my_entity',
        payload: input
      });
      
      const entity = createUIMyEntity(record);
      if (!entity) {
        yield* Effect.fail(MyDomainError.create('Failed to create UI entity from record'));
      }
      
      return entity;
    }).pipe(
      Effect.mapError((error) => MyDomainError.fromError(error, MY_DOMAIN_CONTEXTS.CREATE_MY_ENTITY)),
      Effect.withSpan('MyDomainService.createMyEntity')
    );

  const getAllMyEntities = () =>
    Effect.gen(function* () {
      const records = yield* client.callZome({
        zome_name: 'my_domain',
        fn_name: 'get_all_my_entities',
        payload: null
      });
      
      return mapRecordsToUIMyEntities(records);
    }).pipe(
      Effect.mapError((error) => MyDomainError.fromError(error, MY_DOMAIN_CONTEXTS.GET_ALL_MY_ENTITIES)),
      Effect.withSpan('MyDomainService.getAllMyEntities')
    );

  const getMyEntity = (hash: ActionHash) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'my_domain',
        fn_name: 'get_my_entity',
        payload: hash
      });
      
      return record ? createUIMyEntity(record) : null;
    }).pipe(
      Effect.mapError((error) => MyDomainError.fromError(error, MY_DOMAIN_CONTEXTS.GET_MY_ENTITY, hash)),
      Effect.withSpan('MyDomainService.getMyEntity')
    );

  const updateMyEntity = (hash: ActionHash, input: UpdateMyEntityInput) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'my_domain',
        fn_name: 'update_my_entity',
        payload: { ...input, original_my_entity_hash: hash }
      });
      
      const entity = createUIMyEntity(record);
      if (!entity) {
        yield* Effect.fail(MyDomainError.create('Failed to create UI entity from updated record'));
      }
      
      return entity;
    }).pipe(
      Effect.mapError((error) => MyDomainError.fromError(error, MY_DOMAIN_CONTEXTS.UPDATE_MY_ENTITY, hash)),
      Effect.withSpan('MyDomainService.updateMyEntity')
    );

  const deleteMyEntity = (hash: ActionHash) =>
    Effect.gen(function* () {
      yield* client.callZome({
        zome_name: 'my_domain',
        fn_name: 'delete_my_entity',
        payload: hash
      });
    }).pipe(
      Effect.mapError((error) => MyDomainError.fromError(error, MY_DOMAIN_CONTEXTS.DELETE_MY_ENTITY, hash)),
      Effect.withSpan('MyDomainService.deleteMyEntity')
    );

  // Helper functions for UI entity creation
  const createUIMyEntity = (record: Record): UIMyEntity | null => {
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

  const mapRecordsToUIMyEntities = (records: Record[]): UIMyEntity[] => {
    return records
      .map(createUIMyEntity)
      .filter((entity): entity is UIMyEntity => entity !== null);
  };

  return {
    createMyEntity,
    getAllMyEntities,
    getMyEntity,
    updateMyEntity,
    deleteMyEntity
  };
});

// 4. Create service layer for dependency injection
export const MyDomainServiceLive = Layer.effect(
  MyDomainService,
  makeMyDomainService
).pipe(
  Layer.provide(HolochainClientServiceLive)
);
```

### Step 3: Store Layer (Svelte 5 Runes + Effect-TS)

**File**: `ui/src/lib/stores/myDomain.store.svelte.ts`

```typescript
import { Effect } from 'effect';
import { createModuleCache } from '$lib/utils/cache.svelte';
import { MyDomainService } from '$lib/services';
import { createEventEmitters } from '$lib/utils/eventBus.effect';
import type { ActionHash, UIMyEntity, CreateMyEntityInput, UpdateMyEntityInput } from '$lib/types';

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
  const createCacheSyncHelper = () => {
    const syncCacheWithEntities = () => {
      entities.forEach(entity => cache.set(entity.hash, entity));
    };
    
    const syncEntityWithCache = (entity: UIMyEntity) => {
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

  const { syncCacheWithEntities, syncEntityWithCache } = createCacheSyncHelper();

  // 4. Event Emission Helpers
  const eventEmitters = createEventEmitters<UIMyEntity>('myDomain');

  // 5. Data Fetching Helper
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

  // 6. Loading State Helper
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

  // 7. Record Creation Helper
  const createRecordCreationHelper = () => {
    const handleNewRecord = (newEntity: UIMyEntity) => {
      entities = [...entities, newEntity];
      cache.set(newEntity.hash, newEntity);
      eventEmitters.entityCreated(newEntity);
    };
    
    const handleUpdatedRecord = (updatedEntity: UIMyEntity) => {
      const index = entities.findIndex(e => e.hash === updatedEntity.hash);
      if (index !== -1) {
        entities[index] = updatedEntity;
        cache.set(updatedEntity.hash, updatedEntity);
        eventEmitters.entityUpdated(updatedEntity);
      }
    };
    
    return { handleNewRecord, handleUpdatedRecord };
  };

  const { handleNewRecord, handleUpdatedRecord } = createRecordCreationHelper();

  // 8. Status Transition Helper
  const createStatusTransitionHelper = () => {
    const updateEntityStatus = (hash: ActionHash, newStatus: MyEntityStatus) => {
      const index = entities.findIndex(e => e.hash === hash);
      if (index !== -1) {
        const updatedEntity = { ...entities[index], status: newStatus };
        entities[index] = updatedEntity;
        cache.set(hash, updatedEntity);
        eventEmitters.entityUpdated(updatedEntity);
      }
    };
    
    return { updateEntityStatus };
  };

  const { updateEntityStatus } = createStatusTransitionHelper();

  // 9. Collection Processor
  const processMultipleRecordCollections = (response: any) => {
    if (response.myEntities) {
      entities = mapRecordsToUIEntities(response.myEntities);
      syncCacheWithEntities();
    }
    // Handle other collections if needed
  };

  // Main operations using Effect-TS
  const fetchEntities = createEntityFetcher(
    Effect.gen(function* () {
      const myDomainService = yield* MyDomainService;
      return yield* myDomainService.getAllMyEntities();
    }),
    (result) => result // Already processed by service
  );

  const createEntity = (input: CreateMyEntityInput) =>
    withLoadingState(
      Effect.gen(function* () {
        const myDomainService = yield* MyDomainService;
        const newEntity = yield* myDomainService.createMyEntity(input);
        handleNewRecord(newEntity);
        return newEntity;
      })
    );

  const updateEntity = (hash: ActionHash, input: UpdateMyEntityInput) =>
    withLoadingState(
      Effect.gen(function* () {
        const myDomainService = yield* MyDomainService;
        const updatedEntity = yield* myDomainService.updateMyEntity(hash, input);
        handleUpdatedRecord(updatedEntity);
        return updatedEntity;
      })
    );

  const deleteEntity = (hash: ActionHash) =>
    withLoadingState(
      Effect.gen(function* () {
        const myDomainService = yield* MyDomainService;
        yield* myDomainService.deleteMyEntity(hash);
        
        entities = entities.filter(e => e.hash !== hash);
        cache.delete(hash);
        eventEmitters.entityDeleted(hash);
      })
    );

  return {
    // Reactive state accessors
    entities: () => entities,
    isLoading: () => isLoading,
    error: () => error,
    
    // Operations
    fetchEntities,
    createEntity,
    updateEntity,
    deleteEntity,
    updateEntityStatus,
    
    // Helper functions (exposed for composables)
    createUIEntity,
    mapRecordsToUIEntities,
    syncEntityWithCache,
    processMultipleRecordCollections,
    eventEmitters,
    
    // Cache access
    getCachedEntity: (hash: ActionHash) => cache.get(hash) || null,
    clearCache: () => cache.clear()
  };
};
```

### Step 4: Error Layer

**File**: `ui/src/lib/errors/my-domain.errors.ts`

```typescript
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

  static create(
    message: string,
    context?: string,
    entityId?: string,
    operation?: string
  ): MyDomainError {
    return new MyDomainError({
      message,
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
  GET_ALL_MY_ENTITIES: 'Failed to fetch entities',
  APPROVE_MY_ENTITY: 'Failed to approve entity',
  REJECT_MY_ENTITY: 'Failed to reject entity'
} as const;
```

### Step 5: Schema Layer

**File**: `ui/src/lib/schemas/my-domain.schemas.ts`

```typescript
import { Schema } from '@effect/schema';

// Base entity schema
export const MyEntityStatusSchema = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('approved'), 
  Schema.Literal('rejected')
);

export const MyEntitySchema = Schema.Struct({
  name: Schema.String,
  description: Schema.String,
  status: MyEntityStatusSchema
});

// Input schemas
export const CreateMyEntityInputSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.String.pipe(Schema.minLength(1))
});

export const UpdateMyEntityInputSchema = Schema.Struct({
  name: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  description: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
  status: Schema.optional(MyEntityStatusSchema)
});

// UI entity schema (includes UI-specific fields)
export const UIMyEntitySchema = MyEntitySchema.extend(Schema.Struct({
  hash: Schema.String, // ActionHash
  createdAt: Schema.Date
}));

// Type exports
export type MyEntityStatus = Schema.Schema.Type<typeof MyEntityStatusSchema>;
export type MyEntity = Schema.Schema.Type<typeof MyEntitySchema>;
export type CreateMyEntityInput = Schema.Schema.Type<typeof CreateMyEntityInputSchema>;
export type UpdateMyEntityInput = Schema.Schema.Type<typeof UpdateMyEntityInputSchema>;
export type UIMyEntity = Schema.Schema.Type<typeof UIMyEntitySchema>;
```

### Step 6: Composable Layer

**File**: `ui/src/lib/composables/domain/my-domain/useMyDomainManagement.svelte.ts`

```typescript
import { Effect } from 'effect';
import { useErrorBoundary } from '$lib/composables';
import { createMyDomainStore } from '$lib/stores';
import { MY_DOMAIN_CONTEXTS } from '$lib/errors';
import type { ActionHash, CreateMyEntityInput, UpdateMyEntityInput } from '$lib/types';

export function useMyDomainManagement() {
  // Create domain store
  const store = createMyDomainStore();
  
  // Error boundaries for different operations
  const loadingErrorBoundary = useErrorBoundary({
    context: MY_DOMAIN_CONTEXTS.GET_ALL_MY_ENTITIES,
    enableLogging: true,
    enableFallback: true,
    maxRetries: 2,
    retryDelay: 1000
  });

  const createErrorBoundary = useErrorBoundary({
    context: MY_DOMAIN_CONTEXTS.CREATE_MY_ENTITY,
    enableLogging: true,
    maxRetries: 1,
    retryDelay: 500
  });

  const updateErrorBoundary = useErrorBoundary({
    context: MY_DOMAIN_CONTEXTS.UPDATE_MY_ENTITY,
    enableLogging: true,
    maxRetries: 1,
    retryDelay: 500
  });

  const deleteErrorBoundary = useErrorBoundary({
    context: MY_DOMAIN_CONTEXTS.DELETE_MY_ENTITY,
    enableLogging: true,
    maxRetries: 0, // No auto-retry for destructive operations
    enableToast: true
  });

  // Reactive state for components
  let state = $state({
    entities: store.entities,
    isLoading: store.isLoading,
    error: store.error,
    
    // Derived state
    approvedEntities: () => store.entities().filter(e => e.status === 'approved'),
    pendingEntities: () => store.entities().filter(e => e.status === 'pending'),
    rejectedEntities: () => store.entities().filter(e => e.status === 'rejected'),
    
    // Error states from boundaries
    loadingError: () => loadingErrorBoundary.state.error,
    createError: () => createErrorBoundary.state.error,
    updateError: () => updateErrorBoundary.state.error,
    deleteError: () => deleteErrorBoundary.state.error
  });

  // Business operations with error handling
  const operations = {
    async loadEntities() {
      await loadingErrorBoundary.execute(store.fetchEntities, []);
    },

    async createEntity(input: CreateMyEntityInput) {
      return await createErrorBoundary.execute(store.createEntity(input));
    },

    async updateEntity(hash: ActionHash, input: UpdateMyEntityInput) {
      return await updateErrorBoundary.execute(store.updateEntity(hash, input));
    },

    async deleteEntity(hash: ActionHash) {
      await deleteErrorBoundary.execute(store.deleteEntity(hash));
    },

    async approveEntity(hash: ActionHash) {
      await updateErrorBoundary.execute(
        store.updateEntityStatus(hash, 'approved')
      );
    },

    async rejectEntity(hash: ActionHash) {
      await updateErrorBoundary.execute(
        store.updateEntityStatus(hash, 'rejected')
      );
    }
  };

  // Event listeners setup
  const setupEventListeners = () => {
    store.eventEmitters.onEntityCreated((entity) => {
      // Handle entity creation events
    });
    
    store.eventEmitters.onEntityUpdated((entity) => {
      // Handle entity update events
    });
    
    store.eventEmitters.onEntityDeleted((hash) => {
      // Handle entity deletion events
    });
  };

  // Lifecycle management
  $effect(() => {
    setupEventListeners();
    operations.loadEntities();
  });

  return {
    // State
    state,
    
    // Operations
    operations,
    
    // Error boundaries for component error handling
    loadingErrorBoundary,
    createErrorBoundary,
    updateErrorBoundary,
    deleteErrorBoundary,
    
    // Store access (if needed for advanced usage)
    store
  };
}
```

### Step 7: Component Layer

**File**: `ui/src/lib/components/my-domain/MyDomainGrid.svelte`

```svelte
<script>
  import { useMyDomainManagement } from '$lib/composables';
  import ErrorDisplay from '$lib/components/shared/ErrorDisplay.svelte';
  import MyDomainCard from './MyDomainCard.svelte';
  import MyDomainForm from './MyDomainForm.svelte';
  
  const {
    state,
    operations,
    loadingErrorBoundary,
    createErrorBoundary,
    updateErrorBoundary,
    deleteErrorBoundary
  } = useMyDomainManagement();

  let showCreateForm = $state(false);
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

{#if state.createError()}
  <ErrorDisplay
    error={state.createError()}
    context="Creating entity"
    variant="banner"
    ondismiss={() => createErrorBoundary.clearError()}
  />
{/if}

{#if state.updateError()}
  <ErrorDisplay
    error={state.updateError()}
    context="Updating entity"
    variant="inline"
    ondismiss={() => updateErrorBoundary.clearError()}
  />
{/if}

{#if state.deleteError()}
  <ErrorDisplay
    error={state.deleteError()}
    context="Deleting entity"
    variant="banner"
    ondismiss={() => deleteErrorBoundary.clearError()}
  />
{/if}

<!-- Action bar -->
<div class="flex justify-between items-center mb-6">
  <h1 class="text-2xl font-bold">My Entities</h1>
  <button
    class="btn variant-filled-primary"
    onclick={() => showCreateForm = true}
  >
    Create Entity
  </button>
</div>

<!-- Create form modal -->
{#if showCreateForm}
  <MyDomainForm
    onsubmit={async (input) => {
      await operations.createEntity(input);
      if (!state.createError()) {
        showCreateForm = false;
      }
    }}
    oncancel={() => showCreateForm = false}
  />
{/if}

<!-- Loading state -->
{#if state.isLoading()}
  <div class="flex justify-center items-center py-8">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    <span class="ml-2">Loading entities...</span>
  </div>
{/if}

<!-- Entity grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each state.entities() as entity (entity.hash)}
    <MyDomainCard
      {entity}
      onupdate={(input) => operations.updateEntity(entity.hash, input)}
      ondelete={() => operations.deleteEntity(entity.hash)}
      onapprove={() => operations.approveEntity(entity.hash)}
      onreject={() => operations.rejectEntity(entity.hash)}
    />
  {/each}
</div>

<!-- Empty state -->
{#if !state.isLoading() && state.entities().length === 0}
  <div class="text-center py-8">
    <p class="text-gray-500">No entities found. Create your first entity to get started.</p>
  </div>
{/if}
```

### Step 8: Testing Layer

**File**: `ui/tests/unit/stores/myDomain.store.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { createMyDomainStore } from '$lib/stores';
import { MyDomainService } from '$lib/services';
import { HolochainClientService } from '$lib/services';

describe('MyDomain Store', () => {
  let store: ReturnType<typeof createMyDomainStore>;
  
  beforeEach(() => {
    store = createMyDomainStore();
  });

  describe('Helper Functions', () => {
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
      expect(entity?.name).toBe('Test Entity');
    });

    it('should map records to UI entities with null safety', () => {
      const mockRecords = [createMockRecord(), createInvalidRecord()];
      const entities = store.mapRecordsToUIEntities(mockRecords);
      
      expect(entities).toHaveLength(1); // Invalid record filtered out
      expect(entities[0].name).toBe('Test Entity');
    });
  });

  describe('Effect Operations', () => {
    it('should fetch entities successfully', async () => {
      const MockMyDomainService = Layer.succeed(MyDomainService, {
        getAllMyEntities: () => Effect.succeed([createMockUIEntity()])
      });

      const result = await Effect.runPromise(
        store.fetchEntities.pipe(
          Effect.provide(MockMyDomainService)
        )
      );

      expect(result).toHaveLength(1);
      expect(store.entities()).toHaveLength(1);
    });

    it('should handle create entity operation', async () => {
      const MockMyDomainService = Layer.succeed(MyDomainService, {
        createMyEntity: () => Effect.succeed(createMockUIEntity())
      });

      const result = await Effect.runPromise(
        store.createEntity({ name: 'New Entity', description: 'Test' }).pipe(
          Effect.provide(MockMyDomainService)
        )
      );

      expect(result.name).toBe('Test Entity');
      expect(store.entities()).toContain(result);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const MockMyDomainService = Layer.succeed(MyDomainService, {
        getAllMyEntities: () => Effect.fail(new Error('Network error'))
      });

      const result = await Effect.runPromise(
        store.fetchEntities.pipe(
          Effect.provide(MockMyDomainService)
        )
      );

      expect(result).toEqual([]);
      expect(store.error()).toBe('Network error');
      expect(store.isLoading()).toBe(false);
    });
  });
});

// Helper functions for testing
function createMockRecord(): Record {
  return {
    signed_action: {
      hashed: {
        hash: 'test-hash-123',
        content: {
          timestamp: Date.now() * 1000
        }
      }
    },
    entry: {
      Present: {
        name: 'Test Entity',
        description: 'Test Description',
        status: 'pending'
      }
    }
  } as any;
}

function createMockUIEntity() {
  return {
    hash: 'test-hash-123',
    name: 'Test Entity',
    description: 'Test Description',
    status: 'pending',
    createdAt: new Date()
  };
}
```

## Validation Checklist

After implementing all layers, validate your domain:

### ✅ **Functionality Validation**
- [ ] All CRUD operations work in the UI
- [ ] Error handling displays proper messages
- [ ] Loading states show during operations
- [ ] Cache synchronization works correctly
- [ ] Events are emitted and received properly

### ✅ **Code Quality Validation** 
- [ ] All 9 helper functions implemented
- [ ] Effect-TS patterns used consistently
- [ ] Error boundaries handle all operation types
- [ ] TypeScript types are properly defined
- [ ] No direct store access from components

### ✅ **Testing Validation**
- [ ] Backend tests pass: `bun test:my-domain`
- [ ] Frontend unit tests pass: `cd ui && bun test:unit -- my-domain`
- [ ] Integration tests cover main workflows
- [ ] Error scenarios are tested

### ✅ **Documentation Validation**
- [ ] Update `work-in-progress.md` with domain status
- [ ] Add domain to architecture documentation
- [ ] Document any new patterns established
- [ ] Update API documentation if needed

## Common Pitfalls to Avoid

### ❌ **Don't Skip Helper Functions**
- Never implement partial helper functions
- All 9 helpers must be present and functional
- Consistency is more important than optimization

### ❌ **Don't Violate Layer Dependencies**
- Components should never directly access stores
- Use composables for all business logic
- Services only communicate with Holochain

### ❌ **Don't Mix Error Handling**
- Use separate error boundaries for different operations
- Don't reuse error contexts across domains
- Always transform errors to domain-specific types

### ❌ **Don't Ignore Cache Consistency**
- Always sync cache with reactive state changes
- Use helper functions for all cache operations
- Clear cache on errors when appropriate

## Next Steps

Once your domain is implemented and validated:

1. **Performance Testing**: Test with larger datasets
2. **Integration Testing**: Test cross-domain interactions  
3. **User Acceptance**: Validate with actual users
4. **Documentation**: Update all relevant documentation
5. **Patterns Review**: Document any new patterns discovered

This template ensures every domain follows the same high-quality patterns established in the Service Types, Requests, and Offers domains. Use it as your implementation checklist for consistent, maintainable domain development.