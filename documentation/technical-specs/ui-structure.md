# UI Structure Documentation

This document provides a comprehensive overview of the UI structure for the Requests and Offers application.

## Project Structure

The UI is built with:

- SvelteKit as the framework
- TailwindCSS for styling
- SkeletonUI for UI components
- Svelte 5 features (runes and native HTML events)
- Effect TS (effect) for functional error handling and asynchronous operations

> **Note:** Effect TS integration is currently focused on the requests and offers service and store layers, with plans to expand its usage throughout the entire UI codebase over time. This aligns with the project's functional programming patterns and commitment to robust error handling.

Main directories:

- `/src/routes`: Application routes and pages
- `/src/lib`: Reusable components and utilities
- `/src/services`: Service layer for backend communication
- `/src/stores`: Svelte stores for state management
- `/src/types`: TypeScript type definitions
- `/src/utils`: Utility functions

## Routes

The application uses SvelteKit's file-based routing system with two main sections:

### Main Application Routes (`/src/routes/(app)/`)

Contains the main application routes that are accessible to regular users:

- `/`: Home page (`+page.svelte`)
- `/offers`: Offers management
- `/organizations`: Organization management
- `/projects`: Project management
- `/requests`: Request management
  - `/requests`: Requests listing
  - `/requests/create`: New request creation
  - `/requests/[id]`: Single request view
  - `/requests/[id]/edit`: Edit request
- `/offers`: Offer management
  - `/offers`: Offers listing
  - `/offers/create`: New offer creation
  - `/offers/[id]`: Single offer view
  - `/offers/[id]/edit`: Edit offer
- `/user`: User profile and settings
  - `/user`: User profile
  - `/user/create`: Create new user
  - `/user/edit`: Edit user profile
- `/users`: User directory
  - `/users`: User directory listing
  - `/users/[id]`: Single user view

Layout:

- `(app)/+layout.svelte`: Layout for main application routes

### Admin Routes (`/src/routes/admin/`)

Contains administrative routes and functionalities:

- `/admin`: Admin dashboard (`+page.svelte`)
- `/admin/administrators`: Administrator management
- `/admin/offers`: Offer administration
- `/admin/organizations`: Organization administration
- `/admin/projects`: Project administration
- `/admin/requests`: Request administration
- `/admin/users`: User administration

Layout:

- `admin/+layout.svelte`: Layout for admin routes

### Root Layout

- `+layout.svelte`: The root layout component that wraps all routes
- `+layout.ts`: Layout load function for initialization
- `+error.svelte`: Global error handling component

## Components

Located in `/src/lib/components`, organized by feature domain:

### Feature-Based Organization

Components are organized by feature domain for better maintainability and separation of concerns:

- `/components/offers/`: Offer-related components
- `/components/organizations/`: Organization-related components
- `/components/requests/`: Request-related components
- `/components/users/`: User-related components
- `/components/shared/`: Shared components used across features

### Shared Components

Located in `/src/lib/components/shared`, containing reusable UI components:

- `ActionBar.svelte`: Action bar component with common actions
- `NavBar.svelte`: Main navigation bar component
- `NavButton.svelte`: Navigation button component
- `MenuLink.svelte`: Menu link component

#### Dialog Components

Located in `/src/lib/components/shared/dialogs`, containing dialog UI components.

#### Drawer Components

Located in `/src/lib/components/shared/drawers`, containing drawer UI components.

#### Status Components

Located in `/src/lib/components/shared/status`, containing status indicators and notifications.

#### SVG Components

Located in `/src/lib/components/shared/svg`, containing SVG icons and graphics.

### Request Components

Located in `/src/lib/components/requests`, containing request-related UI components:

- Card components for displaying request summaries
- List components for multiple requests
- Detail views for single requests
- Forms for creating and updating requests
- Badge components for displaying request requirements

### Offer Components

Located in `/src/lib/components/offers`, containing offer-related UI components:

- Card components for displaying offer summaries
- List components for multiple offers
- Detail views for single offers
- Forms for creating and updating offers

## Services

Located in `/src/services`, handling all communication with the Holochain backend. These are implemented as **Effect Services** to leverage Effect TS for dependency management, composability, and robust error handling.

### Implementation Pattern: Effect Service (Tag/Layer)

1.  **Service Interface:** A TypeScript interface defines the methods the service provides.
    ```typescript
    // Example: ui/src/lib/services/zomes/requests.service.ts
    export type RequestsService = {
      createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Effect<never, RequestError, Record>;
      // ... other methods returning Effect
    };
    ```
2.  **Context Tag:** A `Context.Tag` is created to uniquely identify the service within Effect's dependency injection system.
    ```typescript
    // Example: ui/src/lib/services/zomes/requests.service.ts
    export const RequestsServiceTag = Context.Tag<RequestsService>();
    ```
3.  **Live Layer:** An Effect `Layer` provides the concrete implementation of the service interface. This layer constructs the service, often injecting dependencies (like `HolochainClientService`) by requiring their Tags.
    ```typescript
    // Example: ui/src/lib/services/zomes/requests.service.ts
    export const RequestsServiceLive = Layer.effect(
      RequestsServiceTag,
      E.gen(function* () {
        const client = yield* $(HolochainClientServiceTag); // Inject dependency
        const callZome = // ... helper function using client ...

        return RequestsServiceTag.of({
          createRequest: (request, orgHash) => pipe(...),
          // ... implementations using callZome
        });
      })
    );
    ```
4.  **Internal State (if needed):** If a service needs mutable internal state (e.g., a connection status), it typically uses Effect `Ref` for atomic, managed updates.
5.  **Consumption:** Other Effects (usually within Stores) declare a dependency on the service using its Tag and access it via `yield* $(ServiceTag)` or `E.provide(ServiceLiveLayer)`.

**Benefits:**

-   **Explicit Dependencies:** Clearly defined dependencies managed by Effect.
-   **Composability:** Service methods return `Effect`, integrating seamlessly with other Effect operations.
-   **Testability:** Easy to provide mock service implementations via different Layers during testing.

### HolochainClientService

Main service for Holochain client initialization and management (`HolochainClientService.svelte.ts`).

### Zome Services

Located in `/src/services/zomes`, containing specific zome interaction services:

- `requests.service.ts`: Service for interacting with the Requests zome
- `users.service.ts`: Service for interacting with the Users zome
- `organizations.service.ts`: Service for interacting with the Organizations zome
- `administration.service.ts`: Service for interacting with the Administration zome

The services layer is responsible for:

- Making calls to Holochain zomes
- Handling data transformation
- Managing backend communication state

### Effect TS Integration

All services use Effect TS (`effect`) for robust error handling and asynchronous operations:

```typescript
// Example from requests.service.ts
export type RequestsService = {
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Effect<never, RequestError, Record>;
  getLatestRequest: (originalActionHash: ActionHash) => Effect<never, RequestError, RequestInDHT | null>;
  // Other methods...
};

// Implementation example
const createRequest = (
  request: RequestInDHT,
  organizationHash?: ActionHash
): Effect<never, RequestError, Record> =>
  pipe(
    callZome('create_request', { request, organization: organizationHash }),
    E.mapError((e) => new RequestError('Failed to create request', e))
  );
```

Key Effect TS features used:

- `Effect<R, E, A>` type for representing asynchronous computations that may fail
- `pipe()` for function composition
- `E.mapError()` for transforming error types
- `E.flatMap()` for sequential operations
- `E.all()` for parallel operations

The project includes a utility module (`utils/effect.ts`) that provides standardized ways to work with Effects:

```typescript
// From utils/effect.ts
export async function runEffect<E, A>(effect: E.Effect<never, E, A>): Promise<A> {
  return E.runPromise(effect).catch((error) => {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  });
}
```

## Stores

Located in `/src/stores`, managing application state using Svelte 5 runes and Effect TS. Stores act as the bridge between the reactive UI and the Effect-based Service layer.

### Implementation Pattern: Svelte Factory Function + Runes + Effect Orchestration

Stores are created using **factory functions** that return an object containing reactive state and methods.

1.  **Factory Function:** A function (e.g., `createRequestsStore`) typically accepts dependencies (like an instance of a corresponding service, although often service access is managed via Effect context) and initializes the store logic.
2.  **Reactive State (Svelte Runes):** The store uses Svelte 5 Runes (`$state`, `$derived`) to hold the data that UI components will display. This ensures direct, efficient reactivity within Svelte.
    ```typescript
    // Inside factory function
    const requests: UIRequest[] = $state([]); // Reactive array
    let loading: boolean = $state(false);     // Reactive loading flag
    let selectedRequest = $derived(requests.find(r => r.id === someId)); // Reactive derived value
    ```
3.  **Methods with Effect Orchestration:** Store methods that perform actions (fetching data, creating/updating entities) create and run Effect pipelines. These Effects:
    *   Declare dependencies on needed Effect Services (e.g., `RequestsServiceTag`).
    *   Call service methods (`yield* $(RequestsServiceTag).then(s => s.createRequest(...))`).
    *   Handle success/error outcomes from the service Effect.
    *   Update the store's reactive `$state` variables based on the outcome.
    *   Often manage related state like `loading` flags within the Effect pipeline (`E.tap` or `E.acquireUseRelease`).
    ```typescript
    // Inside factory function
    const createRequest = (requestData: RequestInDHT) =>
      pipe(
        E.sync(() => { loading = true; error = null; }), // Update loading state
        E.flatMap(() => E.service(RequestsServiceTag)), // Access the service
        E.flatMap(service => service.createRequest(requestData)), // Call service method
        E.tap(newRecord => E.sync(() => { // On success
          const newRequest = mapRecordToUI(newRecord); 
          requests.push(newRequest); // Update reactive state
        })),
        E.catchAll(err => E.sync(() => { error = err.message; })), // Handle errors
        E.tap(() => E.sync(() => { loading = false; })) // Finalize loading state
        // This Effect is then run, often via runEffect utility or E.runPromise
      );
    ```

**Benefits:**

-   **Native Svelte Reactivity:** Leverages `$state` for seamless UI updates.
-   **Clear Separation:** Isolates reactive UI state management from service logic.
-   **Robust Actions:** Uses Effect TS within methods for handling async operations, service calls, and errors reliably.

### Administration Store

`administration.store.svelte.ts`: Manages administrative state and operations.

### Organizations Store

`organizations.store.svelte.ts`: Handles organization-related state and operations.

### Requests Store

`requests.store.svelte.ts`: Manages request-related state and operations:

- State management for requests using Svelte 5 runes
- Cache implementation (`EntityCache`) for performance
- Event integration (`storeEventBus`) for real-time updates and cross-store communication
- Error handling using Effect TS
- Methods for CRUD operations on requests

### Users Store

`users.store.svelte.ts`: Manages user-related state and operations.

Key features:

- Uses `$state` for reactive state management
- Uses `$derived` for computed values
- Uses `$effect` for side effects
- Implements native HTML events (onclick, oninput, onsubmit, etc.)
- Uses Effect TS for robust error handling and asynchronous operations

### Store Implementation Pattern

(This sub-heading and its example can now be removed as the pattern is described above)

### Cross-Store Communication

The application uses an Effect TS-based Event Bus for communication between stores. This provides a type-safe, decoupled mechanism for real-time updates:

```typescript
// From requests.store.svelte.ts
E.tap(({ newRequest }) =>
  newRequest
    ? E.gen(function* () {
        const eventBus = yield* StoreEventBusTag;
        yield* eventBus.emit('request:created', { request: newRequest });
      })
    : E.asVoid
)
```

For detailed information about the Event Bus implementation, see [Event Bus Pattern](./event-bus-pattern.md).

## Type System

Located in `/src/types`:

- TypeScript interfaces and types for the application
- Type definitions for Holochain data structures
- `ui.ts`: UI-specific type definitions including `UIRequest`
- `holochain.ts`: Holochain-specific type definitions including `RequestInDHT`

### Effect TS Types

The application uses Effect TS types for error handling and asynchronous operations. Custom, structured error types are defined using `Data.TaggedError` for better pattern matching and integration with Effect's error handling mechanisms (like `E.catchTag`).

```typescript
// Effect type for service methods
type Effect<R, E, A> = import('effect').Effect<R, E, A>;

// Custom error types using Effect's Data.TaggedError
import { Data } from 'effect';

// Example: Error originating from a Service call
export class RequestError extends Data.TaggedError('RequestError')<{
  readonly message: string;
  readonly cause?: unknown; // Optional underlying cause (e.g., the raw Holochain error)
}> {
  // Optional: Static helper for common error scenarios
  static creationFailure(cause?: unknown) {
    return new RequestError({ message: 'Failed to create request', cause });
  }
  static fetchFailure(id: string, cause?: unknown) {
    return new RequestError({ message: `Failed to fetch request ${id}`, cause });
  }
}

// Example: Error originating from within a Store
export class RequestStoreError extends Data.TaggedError('RequestStoreError')<{
  readonly message: string;
  readonly context?: string; // Optional context where the error occurred
  readonly cause?: unknown;  // Optional underlying cause (could be a RequestError)
}> {
  // Optional: Static helper for adapting other errors
  static fromError(error: unknown, context: string) {
    const message = error instanceof Error ? error.message : String(error);
    // If the cause is already a TaggedError, we might not need to wrap it again,
    // or we might want to preserve its structure. This depends on desired granularity.
    return new RequestStoreError({
      message: `${context}: ${message}`,
      context,
      cause: error
    });
  }
}
```

## Utils

Located in `/src/lib/utils`, containing utility functions and helpers:

### Cache Utilities

`cache.svelte.ts`: Implements a reactive entity cache system using Svelte 5 runes, providing:

- Time-based cache expiration
- Event-based cache invalidation
- Memory-efficient entity storage

### Effect Utilities

`effect.ts`: Provides utility functions for working with Effect TS:

```typescript
// Runs an Effect and returns the result or throws an error
export async function runEffect<E, A>(effect: E.Effect<never, E, A>): Promise<A> {
  return E.runPromise(effect).catch((error) => {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(String(error));
  });
}
```

### Event Bus

`eventBus.ts`: Implements a typed event bus system for cross-component and cross-store communication:

- Type-safe event emission and subscription
- Support for multiple event types
- Automatic event cleanup

#### Store Events

`storeEvents.ts`: Implements a specialized event bus for store-to-store communication:

```typescript
// From storeEvents.ts
export type StoreEvents = {
  'request:created': { request: UIRequest };
  'request:updated': { request: UIRequest };
  'request:deleted': { requestHash: ActionHash };
  'offer:created': { offer: UIOffer };
  'offer:updated': { offer: UIOffer };
  'offer:deleted': { offerHash: ActionHash };
};

export const storeEventBus = createEventBus<StoreEvents>();
```

The `storeEventBus` is used throughout the store layer to coordinate state changes between different stores. For example:

- When a request is created, the requests store emits a `request:created` event
- When an offer is updated, the offers store emits an `offer:updated` event
- Other stores can subscribe to these events to react to changes in related data


### Date/Time Handling

- The UI uses [Luxon](https://moment.github.io/luxon/#/) for all date and time operations, including time zone support.
- For time zone selection, the application uses the browser's `Intl.supportedValuesOf('timeZone')` API when available for a complete, up-to-date list of IANA time zones.
- In environments where this API is not available, a static fallback list of IANA time zones is provided in [`ui/src/lib/utils/timezones.ts`](../../ui/src/lib/utils/timezones.ts). This list can be expanded as needed for broader compatibility.

### Mock Utilities

`mocks.ts`: Provides mock data and utilities for testing and development.

## Testing

The UI includes:

- End-to-end tests using Playwright
- Type checking using "bun check" in the ui
- Tests must be run using "nix develop --command [test command]" for proper environment setup
