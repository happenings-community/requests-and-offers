# State Management Documentation

This document details the state management approach in the Requests and Offers application, which uses Svelte stores
integrated with Effect TS for robust error handling and data flow management.

## Store Architecture

The application uses a standardized store architecture located in `ui/src/lib/stores/`, with factory functions creating
Effect-integrated Svelte stores.

### Store Organization

```
/stores/
├── serviceTypes.store.svelte.ts      # Service types state
├── requests.store.svelte.ts          # Requests state
├── offers.store.svelte.ts            # Offers state
├── users.store.svelte.ts             # User profiles state
├── organizations.store.svelte.ts     # Organizations state
├── administration.store.svelte.ts    # Admin functionality state
├── mediums_of_exchange.store.svelte.ts # Medium of exchange state
├── hrea.store.svelte.ts              # hREA integration state
└── storeEvents.ts                    # Event bus definitions
```

## The 9-Helper Function Pattern

Stores implement a standardized architecture using nine helper functions for consistent patterns:

1. **`createUIEntity()`**: Transforms Holochain records into UI-friendly entities
   ```typescript
   const createUIEntity = (record: Record): UIEntity => ({
     id: encodeHashToBase64(record.actionHash),
     // Transform record entry data to UI model
   });
   ```

2. **`mapRecordsToUIEntities()`**: Handles bulk record mapping with error handling
   ```typescript
   const mapRecordsToUIEntities = (
     records: Record[]
   ): E.Effect<UIEntity[], DomainError> => E.gen(function* () {
     // Map and validate records to UI entities
   });
   ```

3. **`createCacheSyncHelper()`**: Synchronizes cache with application state
   ```typescript
   const createCacheSyncHelper = () => {
     return {
       syncCacheToState: () => { /* Implementation */ },
       invalidateCache: () => { /* Implementation */ }
     };
   };
   ```

4. **`createEventEmitters()`**: Standardized event emission patterns
   ```typescript
   const createEventEmitters = () => {
     return {
       emitEntityCreated: (entity: UIEntity) => { /* Implementation */ },
       emitEntityUpdated: (entity: UIEntity) => { /* Implementation */ },
       // Other event emitters
     };
   };
   ```

5. **`createEntitiesFetcher()`**: Data fetching with state updates
   ```typescript
   const createEntitiesFetcher = (
     service: DomainService,
     state: State
   ) => {
     return {
       fetchAllEntities: () => { /* Implementation */ },
       fetchEntityById: (id: string) => { /* Implementation */ }
     };
   };
   ```

6. **`withLoadingState()`**: Loading state management for consistent UX
   ```typescript
   const withLoadingState = async <T>(
     operation: () => Promise<T>,
     state: { loading: boolean }
   ): Promise<T> => {
     state.loading = true;
     try {
       return await operation();
     } finally {
       state.loading = false;
     }
   };
   ```

7. **`createRecordCreationHelper()`**: Record creation operation patterns
   ```typescript
   const createRecordCreationHelper = (
     service: DomainService,
     state: State
   ) => {
     return {
       createEntity: (input: EntityInput) => { /* Implementation */ },
       // Other creation methods
     };
   };
   ```

8. **`createStatusTransitionHelper()`**: Status transition management
   ```typescript
   const createStatusTransitionHelper = (
     service: DomainService,
     state: State
   ) => {
     return {
       approveEntity: (id: string) => { /* Implementation */ },
       rejectEntity: (id: string) => { /* Implementation */ },
       // Other status transitions
     };
   };
   ```

9. **`processMultipleRecordCollections()`**: Complex collection processing
   ```typescript
   const processMultipleRecordCollections = <T>(
     collections: Record[][],
     processor: (records: Record[]) => T[]
   ): T[] => {
     // Implementation for handling multiple record collections
   };
   ```

## Store Factory Pattern

Stores are created using a factory pattern with Effect TS for dependency injection:

```typescript
export const createDomainStore = (): E.Effect<
    DomainStore,
    never,
    DomainServiceTag | CacheServiceTag
> => E.gen(function* () {
    const domainService = yield* Context.get(DomainServiceTag);
    const cacheService = yield* Context.get(CacheServiceTag);

    // State initialization with Svelte 5 runes
    const state = {
        entities: $state<UIEntity[]>([]),
        selectedEntity: $state<UIEntity | null>(null),
        loading: $state(false),
        error: $state<DomainError | null>(null)
    };

    // Implement store using the 9 helper functions
    // ...

    return {
        state,
        // Store methods
    };
});
```

## Lazy Initialization with Proxy Pattern

Stores use a proxy pattern for lazy initialization to prevent circular dependencies:

```typescript
let _domainStore: DomainStore | undefined;

export const getDomainStore = (): DomainStore => {
    if (!_domainStore) {
        _domainStore = pipe(
            createDomainStore(),
            E.provide(DomainServiceLive),
            E.provide(CacheServiceLive),
            E.runSync
        );
    }
    return _domainStore;
};

export const domainStore = new Proxy({} as DomainStore, {
    get: (target, prop) => {
        return getDomainStore()[prop as keyof DomainStore];
    }
});
```

## Cross-Store Communication with Event Bus

Stores communicate using an event bus pattern defined in `storeEvents.ts`:

```typescript
export const EntityCreatedEvent = EventTag<{
    type: 'entity_created';
    payload: {
        domain: 'service_types' | 'requests' | 'offers' | 'users' | 'organizations';
        entity: any;
    };
}>();

export const EntityUpdatedEvent = EventTag<{
    type: 'entity_updated';
    payload: {
        domain: 'service_types' | 'requests' | 'offers' | 'users' | 'organizations';
        entity: any;
    };
}>();

// Other events...
```

Stores can subscribe to events from other stores:

```typescript
$effect(() => {
    const subscription = pipe(
        EventBus.subscribe(EntityCreatedEvent),
        S.filter(event => event.payload.domain === 'service_types'),
        S.tap(event => {
            // Handle the event in this store
        }),
        S.runDrain
    );

    return () => subscription.interrupt();
});
```

## Data Flow

The application follows a unidirectional data flow pattern:

1. **User Interaction**: Component triggers an action via store method
2. **Store Processing**: Store calls appropriate service method using Effect TS
3. **Service Execution**: Service communicates with Holochain backend
4. **Data Return**: Results flow back through service to store
5. **State Update**: Store updates its state using Svelte 5 reactivity
6. **UI Update**: Components reactively update based on store state changes
7. **Cross-Store Updates**: Event bus notifies other stores of relevant changes

## Implementation Status

| Store                | Implementation Status | Notes                                    |
|----------------------|-----------------------|------------------------------------------|
| serviceTypes.store   | ✅ Complete            | Fully standardized with 9-helper pattern |
| requests.store       | ✅ Complete            | Fully standardized with 9-helper pattern |
| offers.store         | 🔄 In Progress        | Being updated to 9-helper pattern        |
| users.store          | 📋 Planned            | Needs conversion to Effect architecture  |
| organizations.store  | 📋 Planned            | Needs conversion to Effect architecture  |
| administration.store | 📋 Planned            | Needs conversion to Effect architecture  |

## Best Practices

1. **Always use Effect for async operations**: Avoid mixing Promises and Effects
2. **Implement proper error handling**: Use tagged errors with context
3. **Maintain store isolation**: Use event bus for cross-store communication
4. **Follow the 9-helper pattern**: For consistent implementation
5. **Add proper type definitions**: For all store state and methods
6. **Document store interfaces**: For developer reference
7. **Add comprehensive tests**: For store functionality
