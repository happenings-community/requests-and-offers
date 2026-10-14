# Store-Helpers Utilities API

Comprehensive utilities for standardizing store implementations in the Requests & Offers application using Effect-TS and Svelte 5 Runes.

## Overview

The store-helpers provide a collection of reusable utilities organized into 5 modules to ensure consistency, performance, and maintainability across all domain stores.

## Module Structure

### Core Module (`core.ts`)

- **Loading state management**: `withLoadingState`, `createLoadingStateSetter`
- **Error handling**: `createErrorHandler`, `createGenericErrorHandler`
- **Operation wrapping**: Safe operation execution with connection fallback
- **Validation**: Field and hash validation utilities

### Cache Module (`cache-helpers.ts`)

- **Cache synchronization**: `createGenericCacheSyncHelper`
- **Status transitions**: `createStatusTransitionHelper`
- **Collection processing**: `processMultipleRecordCollections`
- **Batch operations**: Efficient batch cache updates
- **Cache lookup**: `createCacheLookupFunction`

### Event Module (`event-helpers.ts`)

- **Standard emitters**: `createStandardEventEmitters`
- **Status-aware emitters**: `createStatusAwareEventEmitters`
- **Domain-specific emitters**: Specialized emitters for each domain
- **Cross-domain communication**: Event bridging between domains
- **Batch and conditional emitters**: Advanced event patterns

### Record Module (`record-helpers.ts`)

- **Entity creation**: `createUIEntityFromRecord`
- **Record mapping**: `mapRecordsToUIEntities`
- **Entity factories**: Higher-order entity creation functions
- **Batch processing**: Efficient bulk record processing
- **Validation**: Record structure validation

### Fetching Module (`fetching-helpers.ts`)

- **Basic fetching**: `createEntityFetcher`
- **Cache integration**: `createCacheIntegratedFetcher`
- **Specialized fetchers**: Status-aware, paginated, filtered fetchers
- **Dependency management**: Fetchers with dependency resolution
- **Fallback strategies**: Robust fetching with error recovery

## API Reference

### Core Utilities

#### `withLoadingState<T, E>(operation: () => Effect<T, E>): (setters: LoadingStateSetter) => Effect<T, E>`

Higher-order function that wraps operations with loading state management.

**Parameters:**

- `operation`: Function returning an Effect to be wrapped
- `setters`: Object with `setLoading` and `setError` functions

**Returns:** Wrapped operation that manages loading/error state

**Example:**

```typescript
const fetchData = withLoadingState(() =>
  pipe(
    service.getData(),
    E.map((data) => {
      entities.splice(0, entities.length, ...data);
      return data;
    }),
  ),
);

// Usage with state setters
fetchData({
  setLoading: (loading) => (isLoading = loading),
  setError: (error) => (errorMessage = error),
});
```

#### `createErrorHandler<TError>(errorFactory, context): (error: unknown) => Effect<never, TError>`

Creates standardized error handlers with contextual information.

**Parameters:**

- `errorFactory`: Function to create domain-specific errors (e.g., `ServiceError.fromError`)
- `context`: Context string for error messages

**Returns:** Error handler function for use in Effect chains

**Example:**

```typescript
const handleServiceError = createErrorHandler(
  ServiceError.fromError,
  "Failed to fetch service types",
);

pipe(serviceOperation(), E.catchAll(handleServiceError));
```

#### `createLoadingStateSetter(loadingState, errorState): LoadingStateSetter`

Creates standardized state setters for reactive loading and error state.

**Parameters:**

- `loadingState`: Reactive loading state variable
- `errorState`: Reactive error state variable

**Returns:** Object with `setLoading` and `setError` methods

### Cache Utilities

#### `createGenericCacheSyncHelper<T>(arrays: CacheArrays<T>): { syncCacheToState: Function }`

Synchronizes cache with reactive state arrays for CRUD operations.

**Parameters:**

- `arrays`: Object containing reactive arrays (all, pending, approved, rejected)

**Returns:** Object with `syncCacheToState` function

**Example:**

```typescript
const { syncCacheToState } = createGenericCacheSyncHelper({
  all: entities,
  pending: pendingEntities,
  approved: approvedEntities,
  rejected: rejectedEntities,
});

// Add entity to appropriate arrays based on status
syncCacheToState(newEntity, "add");

// Update entity in all relevant arrays
syncCacheToState(updatedEntity, "update");

// Remove entity from all arrays
syncCacheToState(deletedEntity, "remove");
```

#### `createStatusTransitionHelper<T>(statusArrays, cache): { transitionEntityStatus: Function }`

Manages status changes with atomic updates between status arrays.

**Parameters:**

- `statusArrays`: Object with pending, approved, rejected arrays
- `cache`: Cache instance for synchronization

**Returns:** Object with `transitionEntityStatus` function

**Example:**

```typescript
const { transitionEntityStatus } = createStatusTransitionHelper(
  {
    pending: pendingEntities,
    approved: approvedEntities,
    rejected: rejectedEntities,
  },
  cache,
);

// Move entity from pending to approved
transitionEntityStatus(entityHash, "approved");
```

#### `processMultipleRecordCollections<T>(config, response): T[]`

Processes complex API responses with multiple record collections.

**Parameters:**

- `config`: Configuration object with converter, cache, and target arrays
- `response`: API response with multiple collections

**Returns:** Processed entities

**Example:**

```typescript
const entities = processMultipleRecordCollections(
  {
    converter: createUIEntity,
    cache,
    targetArrays: {
      all: allEntities,
      pending: pendingEntities,
      approved: approvedEntities,
      rejected: rejectedEntities
    }
  },
  { pending: [...], approved: [...], rejected: [...] }
);
```

### Event Utilities

#### `createStandardEventEmitters<T>(domain: string): StandardEventEmitters<T>`

Creates standard CRUD event emitters for basic entities.

**Parameters:**

- `domain`: Domain name for event namespacing

**Returns:** Object with event emission methods

**Methods:**

- `emitCreated(entity: T)`: Emit entity creation event
- `emitUpdated(entity: T)`: Emit entity update event
- `emitDeleted(hash: ActionHash)`: Emit entity deletion event
- `emitLoaded(entities: T[])`: Emit entities loaded event

**Example:**

```typescript
const eventEmitters = createStandardEventEmitters<UIRequest>("request");

// Emit events during CRUD operations
eventEmitters.emitCreated(newRequest);
eventEmitters.emitUpdated(updatedRequest);
eventEmitters.emitDeleted(requestHash);
eventEmitters.emitLoaded(allRequests);
```

#### `createStatusAwareEventEmitters<T>(domain: string): StatusAwareEventEmitters<T>`

Creates enhanced event emitters with status change support for approval workflows.

**Parameters:**

- `domain`: Domain name for event namespacing

**Returns:** Object with standard and status-aware event methods

**Additional Methods:**

- `emitStatusChanged(entity: T)`: Emit status change event
- `emitApproved(entity: T)`: Emit entity approval event
- `emitRejected(entity: T)`: Emit entity rejection event
- `emitBatchStatusChanged(entities: T[])`: Emit batch status change event

**Example:**

```typescript
const eventEmitters =
  createStatusAwareEventEmitters<UIServiceType>("serviceType");

// Standard events
eventEmitters.emitCreated(serviceType);

// Status-specific events
eventEmitters.emitStatusChanged(serviceType);
eventEmitters.emitApproved(serviceType);
eventEmitters.emitRejected(serviceType);
```

### Record Utilities

#### `createUIEntityFromRecord<TRecord, TEntity>(converter): (record: Record, additionalData?) => TEntity | null`

Higher-order function to create UI entities from Holochain records with error recovery.

**Parameters:**

- `converter`: Function that converts record data to UI entity

**Returns:** Function that safely converts records to entities

**Example:**

```typescript
const createUIServiceType = createUIEntityFromRecord<
  ServiceTypeInDHT,
  UIServiceType
>((entry, actionHash, timestamp, additionalData) => ({
  ...entry,
  original_action_hash: actionHash,
  created_at: timestamp,
  status: additionalData?.status || "pending",
}));

// Usage
const entity = createUIServiceType(record, { status: "approved" });
```

#### `mapRecordsToUIEntities<T>(records: Record[], converter): T[]`

Maps arrays of Records to UI entities with null safety and error handling.

**Parameters:**

- `records`: Array of Holochain records
- `converter`: Entity creation function

**Returns:** Array of UI entities with null values filtered out

**Example:**

```typescript
const entities = mapRecordsToUIEntities(records, createUIServiceType);
// Automatically handles errors and filters null values
```

### Fetching Utilities

#### `createEntityFetcher<T, E>(errorHandler): EntityFetcher<T, E>`

Creates standardized entity fetcher with error handling integration.

**Parameters:**

- `errorHandler`: Error handling function for failed operations

**Returns:** Function that creates fetching operations with state management

**Example:**

```typescript
const entityFetcher = createEntityFetcher<UIServiceType, ServiceTypeError>(
  handleServiceTypeError,
);

const fetchOperation = entityFetcher(
  serviceOperation,
  processingFunction,
  loadingStateSetter,
);
```

#### `createCacheIntegratedFetcher<T>(cache, serviceOperation, converter): (key: string) => Effect<T | null, E>`

Creates advanced fetcher with cache-first strategy and service fallback.

**Parameters:**

- `cache`: Cache instance for data storage
- `serviceOperation`: Service function for data fetching
- `converter`: Function to convert service response to UI entity

**Returns:** Function that fetches with cache integration

**Example:**

```typescript
const cacheFetcher = createCacheIntegratedFetcher(
  cache,
  (hash) => service.getEntity(hash),
  createUIEntity,
);

// Automatically checks cache first, falls back to service
const entity = await Effect.runPromise(cacheFetcher(entityHash));
```

## Usage Patterns

### Basic Store Implementation

```typescript
export const createDomainStore = () => {
  // 1. State initialization with Svelte 5 Runes
  let entities = $state<UIDomainEntity[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  // 2. Helper initialization
  const createUIEntity = createUIEntityFromRecord<RecordType, UIType>(
    converter,
  );
  const eventEmitters = createStandardEventEmitters<UIType>("domain");
  const { syncCacheToState } = createGenericCacheSyncHelper({ all: entities });
  const setters = createLoadingStateSetter(loading, error);

  // 3. Operations with helpers
  const fetchEntities = withLoadingState(() =>
    pipe(
      domainService.getAllEntities(),
      E.map((records) => {
        const processed = mapRecordsToUIEntities(records, createUIEntity);
        entities.splice(0, entities.length, ...processed);
        eventEmitters.emitLoaded(processed);
        return processed;
      }),
    ),
  );

  // 4. Return store interface
  return {
    entities: () => entities,
    loading: () => loading,
    error: () => error,
    fetchEntities: () => fetchEntities(setters),
  };
};
```

### Advanced Store with Status Management

```typescript
export const createAdvancedStore = () => {
  // State with status arrays
  let allEntities = $state<UIEntity[]>([]);
  let pendingEntities = $state<UIEntity[]>([]);
  let approvedEntities = $state<UIEntity[]>([]);
  let rejectedEntities = $state<UIEntity[]>([]);

  // Advanced helpers
  const createUIEntity = createUIEntityFromRecord<RecordType, UIType>(
    converter,
  );
  const eventEmitters = createStatusAwareEventEmitters<UIType>("domain");
  const { syncCacheToState } = createGenericCacheSyncHelper({
    all: allEntities,
    pending: pendingEntities,
    approved: approvedEntities,
    rejected: rejectedEntities,
  });
  const { transitionEntityStatus } = createStatusTransitionHelper(
    {
      pending: pendingEntities,
      approved: approvedEntities,
      rejected: rejectedEntities,
    },
    cache,
  );

  // Complex operations
  const getAllEntities = withLoadingState(() =>
    pipe(
      domainService.getAllEntities(),
      E.map((response) =>
        processMultipleRecordCollections(
          {
            converter: createUIEntity,
            cache,
            targetArrays: {
              all: allEntities,
              pending: pendingEntities,
              approved: approvedEntities,
              rejected: rejectedEntities,
            },
          },
          response,
        ),
      ),
    ),
  );

  const approveEntity = (hash: ActionHash) =>
    withLoadingState(() =>
      pipe(
        domainService.approveEntity(hash),
        E.tap(() =>
          E.sync(() => {
            transitionEntityStatus(hash, "approved");
            const entity = approvedEntities.find((e) => e.hash === hash);
            if (entity) eventEmitters.emitApproved(entity);
          }),
        ),
      ),
    );

  return {
    // State accessors
    allEntities: () => allEntities,
    pendingEntities: () => pendingEntities,
    approvedEntities: () => approvedEntities,
    rejectedEntities: () => rejectedEntities,

    // Operations
    getAllEntities: () => getAllEntities(setters),
    approveEntity: (hash: ActionHash) => approveEntity(hash)(setters),
  };
};
```

## Best Practices

### Do's ✅

- **Use appropriate helpers**: Choose the right helper for each use case
- **Maintain consistency**: Use the same patterns across all stores
- **Handle errors gracefully**: Always use error handlers for Effect operations
- **Cache synchronization**: Keep cache and state synchronized
- **Event emission**: Emit events for cross-domain communication

### Don'ts ❌

- **Mix patterns**: Don't mix old patterns with new helpers
- **Skip error handling**: Always handle errors with appropriate helpers
- **Direct state mutation**: Use helpers for all state updates
- **Cache inconsistency**: Never allow cache and state to diverge
- **Silent failures**: Always provide feedback for failed operations

## Migration Guide

### From Legacy Patterns

1. **Replace manual loading state**: Use `withLoadingState` wrapper
2. **Replace manual cache sync**: Use `createGenericCacheSyncHelper`
3. **Replace manual event emission**: Use appropriate event emitters
4. **Replace manual entity creation**: Use `createUIEntityFromRecord`
5. **Replace manual error handling**: Use `createErrorHandler`

### Service Types as Reference

The Service Types store (`serviceTypes.store.svelte.ts`) serves as the complete reference implementation demonstrating all helpers in action. Use it as a template for implementing or upgrading other stores.

This comprehensive utilities library ensures consistent, maintainable, and performant store implementations across the entire application.
