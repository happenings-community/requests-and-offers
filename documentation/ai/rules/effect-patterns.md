---
trigger: model_decision
description: Coding patterns for Effect TS
globs: src/**/*.ts, src/**/*.svelte
---

# Effect Patterns for Requests & Offers Frontend

This document outlines key patterns for using Effect TS in the SvelteKit frontend of the Requests and Offers project, focusing on services, stores, and event handling. It reflects common practices found in `ui/src/lib/`.

## Core Principles

- **Effect for Async & Business Logic**: All asynchronous operations, Holochain zome calls, and complex business logic are managed within Effect pipelines.
- **Svelte 5 Runes for Reactivity**: Svelte stores and components use Svelte 5 Runes (`$state`, `$derived`, `$effect`) for reactive UI updates.
- **Services for Backend Interaction**: Typed services in `ui/src/lib/services/` encapsulate calls to Holochain zomes, using Effect for robustness.
- **Stores for State Management**: Svelte stores in `ui/src/lib/stores/` manage application state, orchestrate service calls via Effect, and expose reactive properties to the UI.
- **Dependency Injection with Context & Layer**: Effect's `Context.Tag` and `Layer` are used for managing dependencies between services and stores.
- **Typed Errors**: Custom error types extending `Data.TaggedError` provide clear, structured error handling.

## Error Handling

Define structured, tagged errors for services and stores to clearly indicate the source and nature of issues.

```typescript
// ui/src/lib/services/zomes/requests.service.ts (Error Example)
import { Data } from "effect";

export class RequestServiceError extends Data.TaggedError(
  "RequestServiceError"
)<{
  readonly message: string;
  readonly cause?: unknown; // Underlying error, e.g., from Holochain client
}> {}

// ui/src/lib/stores/requests.store.svelte.ts (Error Example)
export class RequestStoreError extends Data.TaggedError("RequestStoreError")<{
  readonly message: string;
  readonly context?: string; // e.g., 'fetchAll', 'create'
  readonly cause?: unknown; // Could be a RequestServiceError or other
}> {}
```

Usage in an Effect pipeline:

```typescript
import { Effect as E, pipe } from "effect";
import { RequestServiceError } from "$lib/services/zomes/requests.service"; // Example import

declare function someFallibleOperation(): E.Effect<string, RequestServiceError>;

pipe(
  someFallibleOperation(),
  E.catchTag("RequestServiceError", (error) => {
    console.error(`Service operation failed: ${error.message}`, error.cause);
    // Recover or transform into a different error/success
    return E.succeed("Recovered value");
  }),
  E.catchAll((unhandledError) => {
    // Catch any other errors not specifically tagged above
    console.error("An unexpected error occurred:", unhandledError);
    return E.fail(new Error("Operation failed unexpectedly"));
  })
);
```

## Service Definition

Services encapsulate interactions with external systems (like Holochain zomes) or complex business logic. They are defined with interfaces, `Context.Tag` for DI, and `Layer` for providing implementations.

### 1. Foundational Service (Promise-Wrapping & Svelte State)

Services like `HolochainClientService.svelte.ts` bridge the gap between promise-based Holochain client interactions and the Effect ecosystem. They might also manage some Svelte-reactive state (e.g., connection status).

**`ui/src/lib/services/HolochainClientService.svelte.ts` Pattern:**

- **Singleton Instance**: Often created as a Svelte-style singleton, possibly using `$state` internally.
- **Promise-Returning Methods**: Core methods like `callZome` return Promises.
- **Effect Integration**: Provides a `Context.Tag` and a `Layer.succeed` that wraps the existing singleton instance, making it injectable into other Effect services.

```typescript
// ui/src/lib/services/HolochainClientService.svelte.ts (Conceptual Structure)
import { Effect as E, Context, Layer, Data } from "effect";
import type { AppAgentWebsocket, CallZomeRequest } from "@holochain/client";

// Simplified representation of the actual service's interface
export interface HolochainClientService {
  readonly connectionState: { connected: boolean; error?: string }; // Example $state
  readonly connectClient: () => Promise<void>;
  readonly callZome: <T>(
    zomeName: string,
    fnName: string,
    payload?: unknown
  ) => Promise<T>;
  // ... other methods and properties
}

// The Tag for DI
export class HolochainClientServiceTag extends Context.Tag(
  "HolochainClientService"
)<HolochainClientServiceTag, HolochainClientService>() {}

// Assume `holochainClientServiceInstance` is the singleton created by `createHolochainClientService()`
// and exported as default from the .svelte.ts file.
// This is a simplified way to show how it's provided as a layer:
// const holochainClientServiceInstance = createHolochainClientService();

export const HolochainClientServiceLive: Layer.Layer<HolochainClientServiceTag> =
  Layer.succeed(
    HolochainClientServiceTag,
    holochainClientServiceInstance // Provide the actual singleton instance
  );
// Note: The actual file exports the instance directly and the layer is constructed where needed or by dependent services.
// For this documentation, we'll focus on how dependent services use it.
```

### 2. Zome-Specific Effect Service

Services like `requests.service.ts` are built entirely with Effect and depend on foundational services like `HolochainClientServiceTag`.

**`ui/src/lib/services/zomes/requests.service.ts` Pattern:**

- **Interface & Tag**: Defines a clear service interface and a `Context.Tag`.
- **Live Layer**: Implements the service interface, taking `HolochainClientServiceTag` as a dependency.
- **`E.tryPromise`**: Wraps calls to `holochainClient.callZome` (which returns a Promise) to convert them into Effects.
- **Typed Errors**: Maps errors from `callZome` into specific `RequestServiceError` instances.

```typescript
// ui/src/lib/services/zomes/requests.service.ts (Simplified)
import { HolochainClientServiceTag } from "$lib/services/HolochainClientService.svelte";
import { Effect as E, Layer, Context, Data, pipe } from "effect";
import type { Record, ActionHash } from "@holochain/client";
import type { RequestInput, Request } from "$lib/types/holochain"; // Assuming these types exist

export class RequestServiceError extends Data.TaggedError(
  "RequestServiceError"
)<{ message: string; cause?: unknown }> {}

export interface RequestsService {
  readonly createRequest: (
    requestInput: RequestInput
  ) => E.Effect<Record, RequestServiceError>;
  readonly getRequest: (
    actionHash: ActionHash
  ) => E.Effect<Record | undefined, RequestServiceError>;
  readonly getAllRequestsRecords: () => E.Effect<Record[], RequestServiceError>;
  // ... other methods like update, delete
}

export class RequestsServiceTag extends Context.Tag("RequestsService")<
  RequestsServiceTag,
  RequestsService
>() {}

export const RequestsServiceLive: Layer.Layer<
  RequestsServiceTag,
  never, // Error in layer construction (none here, assuming HolochainClientServiceTag is valid)
  HolochainClientServiceTag // Dependency
> = Layer.effect(
  RequestsServiceTag,
  E.gen(function* ($) {
    const hcClient = yield* $(HolochainClientServiceTag); // Resolve dependency

    const callZomeRequest = <T>(fnName: string, payload: unknown) =>
      pipe(
        E.tryPromise({
          try: () => hcClient.callZome<T>("requests", fnName, payload),
          catch: (error) =>
            new RequestServiceError({
              message: `Holochain call failed for ${fnName}`,
              cause: error,
            }),
        })
      );

    return RequestsServiceTag.of({
      createRequest: (requestInput) =>
        callZomeRequest<Record>("create_request", requestInput),
      getRequest: (actionHash) =>
        callZomeRequest<Record | undefined>("get_request", {
          original_action_hash: actionHash,
        }),
      getAllRequestsRecords: () =>
        callZomeRequest<Record[]>("get_all_requests_records", null),
      // ... implementations for other methods
    });
  })
);
```

## Effect-driven Svelte Stores

Stores manage application state using Svelte 5 Runes and orchestrate service calls using Effect. `ui/src/lib/stores/requests.store.svelte.ts` is a prime example.

**Core Pattern:**

1.  **Store Factory Function Returning an Effect**: The store is defined by a factory function (e.g., `createRequestsStore`) that returns an `Effect`. This `Effect` depends on service tags (e.g., `RequestsServiceTag`, `CacheServiceTag`, `StoreEventBusTag`) and, when run, produces the store instance.

    ```typescript
    // ui/src/lib/stores/requests.store.svelte.ts (Conceptual Structure)
    import {
      RequestsServiceTag,
      type RequestsService,
    } from "$lib/services/zomes/requests.service";
    import {
      CacheServiceTag,
      type EntityCacheService,
    } from "$lib/utils/entityCache.svelte"; // Assuming EntityCacheService
    import {
      StoreEventBusTag,
      type StoreEvents,
      type StoreEventBusService,
    } from "$lib/stores/storeEvents"; // For event emission
    import type { UIRequest } from "$lib/types/ui"; // UI-specific representation
    import type { Request, RequestInput } from "$lib/types/holochain";
    import { Effect as E, Data, pipe, Option } from "effect";
    import type { Record, ActionHash } from "@holochain/client";

    // Store-specific error type
    export class RequestStoreError extends Data.TaggedError(
      "RequestStoreError"
    )<{ message: string; context?: string; cause?: unknown }> {}

    // The interface of the store that components will interact with
    export type RequestsStore = {
      // Reactive state (Svelte Runes)
      readonly requests: readonly UIRequest[];
      readonly loading: boolean;
      readonly error: Option.Option<RequestStoreError>; // Use Option for optional errors
      readonly cache: EntityCacheService<ActionHash, Request>; // Example cache for raw Holochain records

      // Methods that orchestrate service calls and update state
      fetchAllRequests: () => E.Effect<void, RequestStoreError>; // Returns void, updates state internally
      createRequest: (
        input: RequestInput
      ) => E.Effect<
        UIRequest,
        RequestStoreError,
        StoreEventBusService<StoreEvents>
      >; // Emits event
      getRequestById: (
        id: ActionHash
      ) => E.Effect<Option.Option<UIRequest>, RequestStoreError>;
      // ... other methods: update, delete, clearError, etc.
    };

    // The factory function
    export const createRequestsStoreEffect = (): E.Effect<
      RequestsStore,
      never, // Error during store *creation* (should be none if dependencies are met)
      RequestsServiceTag | CacheServiceTag | StoreEventBusService<StoreEvents> // Dependencies
    > =>
      E.gen(function* ($) {
        const requestsService = yield* $(RequestsServiceTag);
        const cacheService = yield* $(CacheServiceTag);
        // const eventBus = yield* $(StoreEventBusTag); // Only if all methods need it, or get it per-method

        // Svelte 5 Runes for reactive state
        let _requests = $state<UIRequest[]>([]);
        let _loading = $state(false);
        let _error = $state<Option.Option<RequestStoreError>>(Option.none());

        // Initialize the entity cache for raw Request records
        const requestRecordCache = cacheService.createEntityCache<
          ActionHash,
          Request
        >(
          "requests_records",
          (id) =>
            pipe(
              // Fetch function for the cache
              requestsService.getRequest(id),
              E.map(Option.fromNullable)
            ),
          { ttl: 5 * 60 * 1000 } // 5 minutes TTL
        );

        // Helper to map Holochain Record to UIRequest (simplified)
        const mapRecordToUIRequest = (record: Record): UIRequest =>
          ({
            /* ... mapping logic ... */
          }) as UIRequest;
        const mapRecordsToUIRequests = (records: Record[]): UIRequest[] =>
          records.map(mapRecordToUIRequest);

        // Store methods
        const fetchAllRequests = (): E.Effect<void, RequestStoreError> =>
          pipe(
            E.sync(() => {
              _loading = true;
              _error = Option.none();
            }),
            E.flatMap(() => requestsService.getAllRequestsRecords()),
            E.tap((records) => {
              _requests = mapRecordsToUIRequests(records);
            }),
            E.catchAll((cause) =>
              E.fail(
                new RequestStoreError({
                  message: "Failed to fetch all requests",
                  cause,
                })
              )
            ),
            E.tapError((err) => {
              _error = Option.some(err);
            }),
            E.ensuring(
              E.sync(() => {
                _loading = false;
              })
            )
          );

        const createRequest = (
          input: RequestInput
        ): E.Effect<
          UIRequest,
          RequestStoreError,
          StoreEventBusService<StoreEvents>
        > =>
          pipe(
            E.sync(() => {
              _loading = true;
              _error = Option.none();
            }),
            E.flatMap(() => requestsService.createRequest(input)),
            E.flatMap((newRecord) =>
              E.gen(function* (scope) {
                // Use scope for eventBus
                const eventBus = yield* scope(StoreEventBusTag);
                const uiRequest = mapRecordToUIRequest(newRecord);
                _requests = [..._requests, uiRequest]; // Optimistic update or re-fetch
                yield* scope(
                  eventBus.emit("request:created", { request: uiRequest })
                );
                return uiRequest;
              })
            ),
            E.catchAll((cause) =>
              E.fail(
                new RequestStoreError({
                  message: "Failed to create request",
                  cause,
                })
              )
            ),
            E.tapError((err) => {
              _error = Option.some(err);
            }),
            E.ensuring(
              E.sync(() => {
                _loading = false;
              })
            )
          );

        // ... other methods like getRequestById using requestRecordCache.fetch ...

        return {
          get requests() {
            return _requests;
          },
          get loading() {
            return _loading;
          },
          get error() {
            return _error;
          },
          cache: requestRecordCache,
          fetchAllRequests,
          createRequest,
          // ... other methods
        };
      });
    ```

2.  **Singleton Instantiation and Export**: The store factory `Effect` is run once at the module level, providing all necessary service layers, to create a singleton store instance. This instance is then exported.

    ```typescript
    // At the end of ui/src/lib/stores/requests.store.svelte.ts
    import { RequestsServiceLive } from "$lib/services/zomes/requests.service";
    import { HolochainClientServiceLive } from "$lib/services/HolochainClientService.svelte"; // Dependency of RequestsServiceLive
    import { CacheServiceLive } from "$lib/utils/entityCache.svelte";
    import { StoreEventBusLive } from "$lib/stores/storeEvents";

    // Create the full layer needed by createRequestsStoreEffect
    const requestsStoreLayer = Layer.mergeAll(
      RequestsServiceLive,
      CacheServiceLive,
      StoreEventBusLive,
      HolochainClientServiceLive // Ensure all transitive dependencies are included
    );

    // Run the factory Effect with the combined layer to get the store instance
    const requestsStore = E.runSync(
      pipe(createRequestsStoreEffect(), E.provide(requestsStoreLayer))
    );
    // Use E.runPromise if store creation involves async operations not dependent on runtime context.

    export default requestsStore; // Export the resolved singleton store instance
    ```

3.  **Usage in Svelte Components**: UI components import the singleton store. They access its reactive properties (which are Svelte Runes) and call its methods. Store methods return Effects, which are then run by the component (e.g., using `E.runPromise` or `E.runFork`).

    ```svelte
    <!-- Example Svelte Component: src/routes/requests/+page.svelte -->
    <script lang="ts">
      import requestsStore from '$lib/stores/requests.store.svelte';
      import { Effect as E, pipe, Option } from 'effect';
      import type { RequestInput } from '$lib/types/holochain';

      // Access reactive state directly from the store instance
      // Svelte 5 runes ($state) inside the store make these reactive
      // No need for $derived(requestsStore) if store properties are getters for runes

      function handleFetchAll() {
        pipe(
          requestsStore.fetchAllRequests(),
          E.runPromise
        ).catch(err => {
          // Error is already set in store's `error` state by the store method itself.
          // Component can react to `requestsStore.error` changes.
          console.error('Component: Fetch all failed', err);
        });
      }

      function handleCreateRequest(input: RequestInput) {
        pipe(
          requestsStore.createRequest(input),
          // Note: StoreEventBusLive is already part of the store's context via requestsStoreLayer
          E.runPromise
        ).then(newRequest => {
          console.log('Component: Request created', newRequest);
        }).catch(err => {
          console.error('Component: Create request failed', err);
        });
      }

      // Initial fetch when component mounts
      $effect(() => {
        handleFetchAll();
      });
    </script>

    <div>
      {#if requestsStore.loading}
        <p>Loading requests...</p>
      {/if}

      {#if Option.isSome(requestsStore.error)}
        <p style="color: red;">Error: {requestsStore.error.value.message}</p>
      {/if}

      <ul>
        {#each requestsStore.requests as request (request.id) /* Assuming UIRequest has an id */}
          <li>{request.title}</li> {/* Assuming UIRequest has a title */}
        {/each}
      </ul>

      <button onclick={handleFetchAll}>Refresh Requests</button>
      <!-- Add UI for creating a new request that calls handleCreateRequest -->
    </div>
    ```

## Event Bus Pattern (`ui/src/lib/utils/eventBus.effect.ts`)

A generic, typed event bus using Effect's `Context.Tag` and `Layer` for decoupled communication, often between stores or services.

- **Generic Factory**: `createEventBusTag<Events>()` and `createEventBusLiveLayer(tag)` allow creating specific event bus instances (e.g., `StoreEventBusTag` for `StoreEvents`).
- **Usage**: Store methods requiring event emission declare the specific `EventBusService<MyEvents>` in their Effect's context (`R` type). The corresponding `Live` layer is provided when the store's factory Effect is run or when the specific method's Effect is run.

```typescript
// 1. Define event map (e.g., in ui/src/lib/stores/storeEvents.ts)
export type StoreEvents = {
  "request:created": { request: UIRequest };
  "request:updated": { request: UIRequest };
  // ... other events
};

// 2. Create specific tag and live layer using generic factories
// (in ui/src/lib/stores/storeEvents.ts)
import {
  createEventBusTag,
  createEventBusLiveLayer,
  type EventBusService,
} from "$lib/utils/eventBus.effect";
export const StoreEventBusTag = createEventBusTag<StoreEvents>("StoreEventBus");
export const StoreEventBusLive = createEventBusLiveLayer(StoreEventBusTag);
export type StoreEventBusService = EventBusService<StoreEvents>;

// 3. Emitting an event from a store method (see createRequest example in RequestsStore above)
// The method's Effect declares StoreEventBusService in its R type:
createRequest: (input: RequestInput) =>
  E.Effect<UIRequest, RequestStoreError, StoreEventBusService<StoreEvents>>;

// Inside the method, it gets the bus from context and emits:
E.gen(function* (scope) {
  const eventBus = yield* scope(StoreEventBusTag);
  yield* scope(eventBus.emit("request:created", { request: uiRequest }));
});

// 4. Subscribing to events (e.g., in another store or a long-lived service)
const setupRequestListener = E.gen(function* ($) {
  const eventBus = yield* $(StoreEventBusTag);
  // on() returns an Effect that resolves to an unsubscribe Effect
  const unsubscribeEffect = yield* $(
    eventBus.on("request:created", (payload) => {
      console.log("A new request was created:", payload.request);
      // Potentially run another Effect here to update this store's state
      return E.void; // The handler itself can be an Effect
    })
  );

  // To clean up, run the unsubscribeEffect, e.g., when the application shuts down
  // or the subscribing component is destroyed.
  yield* $(E.addFinalizer(() => unsubscribeEffect)); // If in a Scoped Effect
  return unsubscribeEffect;
});

// Running the subscription setup:
const runnableSubscription = pipe(
  setupRequestListener,
  E.provide(StoreEventBusLive)
);
E.runFork(runnableSubscription); // Fork as it's a long-running listener
```

## Best Practices

- **Clear Separation**: Keep Svelte for UI and reactivity, Effect for logic, async operations, and state orchestration.
- **Typed Everything**: Leverage TypeScript and Effect's strong typing for services, stores, errors, and events.
- **Small, Composable Effects**: Build complex logic from smaller, well-defined Effects.
- **Explicit Dependencies**: Use `Context.Tag` and `Layer` for all service/store dependencies.
- **Structured Error Handling**: Use `Data.TaggedError` and catch specific tags.
- **Svelte 5 Runes**: Use `$state`, `$derived`, `$effect` appropriately within stores and components.
- **Immutability**: Prefer immutable updates to state where possible, especially when dealing with arrays/objects managed by `$state` (e.g., `_requests = [..._requests, newItem];`).

## Anti-patterns to Avoid

- **Mixing `async/await` with Effect Pipelines**: Once inside an Effect pipeline, stay within Effect. Use `E.tryPromise` to bridge promises into Effect.
- **Manual Dependency Management**: Avoid manually passing service instances; use `Context.Tag` and `Layer.provide`.
- **Ignoring Effect Error Channel**: Don't let Effects fail silently; handle errors explicitly with `E.catch*` or ensure they propagate to a runner that handles them.
- **Overuse of `E.runSync`**: Only use `E.runSync` if you are certain the Effect is synchronous and all its dependencies are already met. Prefer `E.runPromise` or `E.runFork` for Effects involving async operations or needing layers.
- **Large, Monolithic Stores/Services**: Break down complex domains into smaller, focused stores and services.
