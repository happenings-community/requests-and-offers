# Architecture Patterns

Comprehensive architectural patterns for the 7-layer Effect-TS architecture, service patterns, store management, and event-driven communication.

## System Architecture Overview

### 7-Layer Effect-TS Architecture

The project follows a standardized 7-layer pattern for consistency and maintainability:

1. **Service Layer**: Effect-native services with Context.Tag dependency injection
2. **Store Layer**: Factory functions with Svelte 5 Runes + standardized helper functions
3. **Schema Validation**: Effect Schema with strategic validation boundaries
4. **Error Handling**: Domain-specific tagged errors with centralized management
5. **Composables**: Component logic abstraction using Effect-based functions
6. **Components**: Svelte 5 + accessibility focus, using composables for business logic
7. **Testing**: Comprehensive Effect-TS coverage across all layers

### Core Architectural Principles

- **Dependency Inversion**: High-level modules don't depend on low-level modules
- **Single Responsibility**: Each layer has a single, well-defined purpose
- **Open/Closed**: Open for extension, closed for modification
- **Interface Segregation**: Clients depend only on interfaces they use
- **Dependency Injection**: Use Effect Context for all service dependencies

## Service Layer Patterns

### Effect-Native Service Architecture

```typescript
// Service definition with Context.Tag
export const ServiceTypeService =
  Context.GenericTag<ServiceTypeService>("ServiceTypeService");

export const makeServiceTypeService = Effect.gen(function* () {
  const client = yield* HolochainClientService;
  const eventBus = yield* EventBusService;

  const createServiceType = (input: CreateServiceTypeInput) =>
    Effect.gen(function* () {
      // Validate input at business boundary
      const validatedInput = yield* Schema.decodeUnknown(
        CreateServiceTypeInputSchema,
      )(input);

      // Execute business logic
      const result = yield* client.callZome({
        zome_name: "service_types_coordinator",
        fn_name: "create_service_type",
        payload: validatedInput,
      });

      // Transform and emit events
      const serviceType =
        yield* Schema.decodeUnknown(ServiceTypeSchema)(result);
      yield* eventBus.emit("serviceType.created", serviceType);

      return serviceType;
    }).pipe(
      Effect.mapError(
        (error) =>
          new ServiceTypeError({
            message: "Failed to create service type",
            cause: error,
            context: "ServiceTypeService.createServiceType",
          }),
      ),
    );

  return { createServiceType };
});

// Service layer implementation
export const ServiceTypeServiceLive = Layer.effect(
  ServiceTypeService,
  makeServiceTypeService,
);
```

### Service Dependency Patterns

```typescript
// Complex service with multiple dependencies
export const makeComplexService = Effect.gen(function* () {
  const client = yield* HolochainClientService;
  const userService = yield* UserService;
  const eventBus = yield* EventBusService;
  const cache = yield* CacheService;

  const processComplexOperation = (input: ComplexInput) =>
    Effect.gen(function* () {
      // Multi-step operation with dependency orchestration
      const user = yield* userService.getCurrentUser();
      const cachedData = yield* cache.get(`complex:${user.id}`);

      if (cachedData) {
        return cachedData;
      }

      const result = yield* client.callZome(/* ... */);
      yield* cache.set(`complex:${user.id}`, result, 300); // 5 min TTL
      yield* eventBus.emit("complex.processed", { user, result });

      return result;
    });

  return { processComplexOperation };
});
```

## Store Layer Patterns

### Factory Function Pattern with Svelte 5 Runes

```typescript
// Standardized store factory pattern
export const createServiceTypesStore = () => {
  // Reactive state with Svelte 5 Runes
  let entities = $state<UIServiceType[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // Service integration
  const serviceTypeService = yield * ServiceTypeService;
  const eventBus = yield * EventBusService;

  // Standardized helper functions (9 total)

  // 1. Entity Creation Helper
  const createUIEntity = (
    record: ActionHash<ServiceType>,
  ): Effect.Effect<UIServiceType, ServiceTypeError> =>
    Effect.gen(function* () {
      return {
        id: encodeHashToBase64(record.action_hash),
        ...record.entry,
        created_at: new Date(record.action.timestamp),
        isEditable: true,
        displayName: record.entry.name,
      };
    }).pipe(
      Effect.catchAll((error) =>
        Effect.succeed({
          id: "error",
          name: "Error loading entity",
          description: "",
          tags: [],
          created_at: new Date(),
          isEditable: false,
          displayName: "Error",
        }),
      ),
    );

  // 2. Record Mapping Helper
  const mapRecordsToUIEntities = (
    records: ActionHash<ServiceType>[],
  ): UIServiceType[] =>
    Effect.runSync(
      Effect.all(records.map(createUIEntity), { concurrency: "unbounded" }),
    );

  // 3. Cache Sync Helper
  const createCacheSyncHelper = () => {
    const syncCache = (newEntities: UIServiceType[]) => {
      entities = newEntities;
      error = null;
    };

    const addToCache = (entity: UIServiceType) => {
      entities = [...entities, entity];
    };

    const updateInCache = (id: string, updates: Partial<UIServiceType>) => {
      entities = entities.map((e) => (e.id === id ? { ...e, ...updates } : e));
    };

    const removeFromCache = (id: string) => {
      entities = entities.filter((e) => e.id !== id);
    };

    return { syncCache, addToCache, updateInCache, removeFromCache };
  };

  // 4. Event Emission Helpers
  const createEventEmitters = () => {
    const emitEntityCreated = (entity: UIServiceType) =>
      eventBus.emit("serviceType.ui.created", entity);

    const emitEntityUpdated = (entity: UIServiceType) =>
      eventBus.emit("serviceType.ui.updated", entity);

    const emitEntityDeleted = (id: string) =>
      eventBus.emit("serviceType.ui.deleted", { id });

    return { emitEntityCreated, emitEntityUpdated, emitEntityDeleted };
  };

  // 5. Data Fetching Helper
  const createEntityFetcher = () => {
    const fetchAll = Effect.gen(function* () {
      loading = true;
      error = null;

      try {
        const records = yield* serviceTypeService.getAllServiceTypes();
        const uiEntities = mapRecordsToUIEntities(records);
        entities = uiEntities;
        return uiEntities;
      } catch (err) {
        error = err instanceof Error ? err.message : "Unknown error";
        throw err;
      } finally {
        loading = false;
      }
    });

    return { fetchAll };
  };

  // Initialize helpers
  const cacheSync = createCacheSyncHelper();
  const eventEmitters = createEventEmitters();
  const entityFetcher = createEntityFetcher();

  return {
    // State accessors
    entities: () => entities,
    loading: () => loading,
    error: () => error,

    // Operations
    fetchAll: entityFetcher.fetchAll,

    // Cache management
    ...cacheSync,

    // Event emission
    ...eventEmitters,
  };
};

// Module-level store creation (eager initialization)
export const serviceTypesStore = createServiceTypesStore();
```

### Store Helper Functions Pattern

The 9 standardized helper functions provide consistency across all domain stores:

1. **Entity Creation Helper**: Converts Holochain records to UI entities
2. **Record Mapping Helper**: Maps arrays with error recovery
3. **Cache Sync Helper**: Synchronizes cache with state arrays
4. **Event Emission Helpers**: Standardized event broadcasting
5. **Data Fetching Helper**: Higher-order fetching with loading states
6. **Loading State Helper**: Wraps operations with loading patterns
7. **Record Creation Helper**: Processes new records and updates cache
8. **Status Transition Helper**: Manages status changes atomically
9. **Collection Processor**: Handles complex multi-collection responses

## Event Bus Architecture

### Event-Driven Communication Pattern

```typescript
// Centralized event bus service
export const EventBusService =
  Context.GenericTag<EventBusService>("EventBusService");

export const makeEventBusService = Effect.gen(function* () {
  const subscribers = new Map<string, Set<(data: any) => void>>();

  const emit = <TData>(event: string, data: TData) =>
    Effect.gen(function* () {
      const eventSubscribers = subscribers.get(event);
      if (eventSubscribers) {
        for (const callback of eventSubscribers) {
          yield* Effect.sync(() => callback(data));
        }
      }
    }).pipe(
      Effect.catchAll((error) =>
        Effect.logError(`Event emission failed: ${event}`, error),
      ),
    );

  const subscribe = <TData>(event: string, callback: (data: TData) => void) =>
    Effect.gen(function* () {
      if (!subscribers.has(event)) {
        subscribers.set(event, new Set());
      }
      subscribers.get(event)!.add(callback);

      // Return unsubscribe function
      return () => {
        const eventSubscribers = subscribers.get(event);
        if (eventSubscribers) {
          eventSubscribers.delete(callback);
          if (eventSubscribers.size === 0) {
            subscribers.delete(event);
          }
        }
      };
    });

  return { emit, subscribe };
});
```

### Cross-Domain Event Patterns

```typescript
// Domain-specific event definitions
export type ServiceTypeEvents = {
  "serviceType.created": ServiceType;
  "serviceType.updated": ServiceType;
  "serviceType.deleted": { id: string };
  "serviceType.ui.created": UIServiceType;
  "serviceType.ui.updated": UIServiceType;
  "serviceType.ui.deleted": { id: string };
};

// Type-safe event emission
export const emitServiceTypeEvent = <K extends keyof ServiceTypeEvents>(
  eventBus: EventBusService,
  event: K,
  data: ServiceTypeEvents[K],
) => eventBus.emit(event, data);

// Cross-store communication
export const setupCrossStoreEvents = () => {
  const eventBus = yield * EventBusService;

  // Listen for service type changes to update request store
  yield *
    eventBus.subscribe("serviceType.created", (serviceType) => {
      // Update request store with new service type
      requestsStore.addServiceTypeOption(serviceType);
    });

  yield *
    eventBus.subscribe("serviceType.deleted", ({ id }) => {
      // Remove service type option from request store
      requestsStore.removeServiceTypeOption(id);
    });
};
```

## Layer Integration Patterns

### Cross-Layer Communication

```typescript
// Component → Composable → Store → Service flow
export const useEntityManager = () =>
  Effect.gen(function* () {
    const store = serviceTypesStore;
    const eventBus = yield* EventBusService;

    const createEntity = (input: CreateServiceTypeInput) =>
      Effect.gen(function* () {
        // Business logic in composable
        const entity = yield* store.createEntity(input);

        // Cross-layer event emission
        yield* eventBus.emit("entity.management.created", {
          domain: "serviceTypes",
          entity,
        });

        return entity;
      });

    return { createEntity };
  });
```

### Dependency Flow Architecture

```
Components (Svelte 5)
    ↓ (use composables)
Composables (Effect-based)
    ↓ (orchestrate stores)
Stores (Svelte Runes + Effect)
    ↓ (call services)
Services (Effect-native)
    ↓ (validate with schemas)
Schemas (Effect Schema)
    ↓ (handle errors)
Error Handling (Tagged errors)
    ↓ (comprehensive testing)
Testing (Effect test utilities)
```

This architecture ensures clean separation of concerns while maintaining type safety and error handling throughout the entire stack.
