# Event Bus Pattern

This document details the Event Bus pattern implemented using Effect TS in the Requests and Offers application.

## Overview

The Event Bus pattern provides a pub/sub mechanism for communication between different parts of the application, particularly between stores. This helps decouple components and enables real-time updates.

In our implementation, we use Effect TS to handle asynchronous operations and error management, providing a robust, type-safe event system.

## Core Implementation

The event bus is implemented in `ui/src/lib/utils/eventBus.effect.ts` as a generic, reusable system with the following key features:

- **Type-safe**: Uses TypeScript generics to ensure events and payloads are type-checked.
- **Effect-based**: Leverages Effect TS for error handling and asynchronous operations.
- **Layered design**: Follows the Context/Layer pattern from Effect TS for dependency injection.

### Key Components

1. **EventBusService**: The core interface that defines the operations available on an event bus:
   - `on`: Subscribe to events
   - `emit`: Publish events
   - `off`: Unsubscribe from events

2. **Context Tag**: Created with `createEventBusTag<T>()` for dependency injection.

3. **Layer Implementation**: Created with `createEventBusLiveLayer()` to provide the actual implementation.

4. **Error Handling**: Custom `EventBusError` class with standardized error handling and utility functions.

## Usage Pattern

### 1. Define Event Map

First, define the events and their payload types:

```typescript
// storeEvents.ts
export type StoreEvents = {
  'request:created': { request: UIRequest };
  'request:updated': { request: UIRequest };
  'request:deleted': { requestHash: ActionHash };
  'offer:created': { offer: UIOffer };
  'offer:updated': { offer: UIOffer };
  'offer:deleted': { offerHash: ActionHash };
};
```

### 2. Create Tag and Layer

```typescript
// storeEvents.ts
const Tag = createEventBusTag<StoreEvents>('StoreEventBus');
const Live = createEventBusLiveLayer(Tag);

export { Tag as StoreEventBusTag, Live as StoreEventBusLive };
```

### 3. Use in Stores or Components

```typescript
// Example from a store
import { StoreEventBusTag, StoreEventBusLive } from '$lib/stores/storeEvents';

// To emit an event
E.gen(function* () {
  const eventBus = yield* StoreEventBusTag;
  yield* eventBus.emit('request:created', { request: newRequest });
})

// Provide the layer
E.provide(StoreEventBusLive)
```

## Integration with Stores

The event bus is used for communication between stores, particularly for CRUD operations:

1. **Create operations**: Emit events when new entities are created
2. **Update operations**: Notify other stores when entities are updated
3. **Delete operations**: Alert subscribers when entities are removed

### Implementation in Store Methods

Each store method that modifies data emits appropriate events:

```typescript
const createRequest = (request: RequestInDHT): E.Effect<Record, RequestStoreError, EventBusService<StoreEvents>> =>
  pipe(
    // Create the request
    requestsService.createRequest(request),
    
    // Map and cache the result
    E.map((record) => {
      const newRequest = mapRecordToUIRequest(record);
      cache.set(newRequest);
      return { record, newRequest };
    }),
    
    // Emit the event
    E.tap(({ newRequest }) =>
      newRequest
        ? E.gen(function* () {
            const eventBus = yield* StoreEventBusTag;
            yield* eventBus.emit('request:created', { request: newRequest });
          })
        : E.asVoid
    ),
    
    // Final transformation and error handling
    E.map(({ record }) => record),
    E.catchAll(handleError),
    
    // Provide the layer
    E.provide(StoreEventBusLive)
  );
```

## Best Practices

1. **Define clear event types**: Create a well-defined event map with descriptive event names and payload types.
2. **Use consistent naming conventions**: Follow patterns like `entity:action` (e.g., `request:created`).
3. **Proper error handling**: Always catch and handle errors from event bus operations.
4. **Event isolation**: Keep event payloads focused and minimal, containing only what subscribers need.
5. **Type safety**: Leverage TypeScript to ensure type correctness across the event system.

## Performance Considerations

- The event bus implementation uses an efficient data structure (`HashSet`) to store and manage event handlers.
- Events are processed concurrently using Effect's parallel processing capabilities.
- Error handling is isolated per handler to prevent one failing handler from affecting others.

## Cross-Store Communication Example

In our application, the event bus facilitates communication between different stores:

1. `requestsStore.createRequest()` emits a `request:created` event
2. `offersStore` can subscribe to this event to update its state based on new requests
3. This decouples the stores while maintaining synchronized state

This pattern ensures that stores remain independent but can react to changes in related data, improving maintainability and robustness. 