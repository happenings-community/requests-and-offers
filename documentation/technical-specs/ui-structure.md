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

### Service Type Components

Located in `/src/lib/components/servicetypes`, these components will handle the UI for service type interactions:

- `ServiceTypeSuggestionForm.svelte`: A form for users to suggest new service types, including fields for name, description, and tags.
- `ServiceTypeCard.svelte`: A reusable component to display information about a single service type (e.g., name, description, status). Used in lists and detail views.
- `ServiceTypeList.svelte`: A component to display lists of service types (e.g., pending suggestions for admins, approved types for selection in request/offer forms).
- `ServiceTypeAdminDashboard.svelte`: A dashboard component for administrators/moderators to view pending service type suggestions, approve, or reject them. This might also include features for editing existing approved service types.
- `ServiceTypeSelector.svelte`: A component (likely a dropdown or modal) used in Request and Offer creation/editing forms to allow users to select from approved service types.

## Services

Located in `/src/services`, handling **all** communication with the Holochain backend. These are implemented as **Effect Services** to leverage Effect TS for dependency management, composability, and robust error handling. All zome calls **must** go through this defined service layer.

### Implementation Pattern: Effect Service (Tag/Layer)

1.  **Service Interface (`.types.ts` or inline):** A TypeScript interface defines the methods the service provides, specifying input types, and the `Effect` return type including its potential errors and success value.
    ```typescript
    // Example: ui/src/services/zomes/servicetypes.types.ts
    export interface ServiceTypesService {
      suggestServiceType: (name: string, description: string, tags: string[]) => Effect<never, ServiceTypeError, Record>;
      getApprovedServiceTypes: () => Effect<never, ServiceTypeError, UIApprovedServiceType[]>;
      // ... other methods for admin approval, rejection, fetching pending, etc.
    }
    ```
2.  **Context Tag (`.service.ts`):** An Effect `Context.Tag<ServiceType>` is created for each zome-specific service (e.g., `RequestsServiceTag`, `ServiceTypesServiceTag`, `OffersServiceTag`). This tag acts as a key for dependency injection within Effect's context system.
    ```typescript
    // Example: ui/src/services/zomes/servicetypes.service.ts
    export const ServiceTypesServiceTag = Context.Tag<ServiceTypesService>();
    ```
3.  **Live Layer (`.service.ts`):** An Effect `Layer` provides the concrete implementation of the service interface. This layer constructs the service, typically by requiring the `HolochainClientServiceTag` (and potentially other service tags) in its environment to make actual zome calls. The layer is then provided to the main application Effect or specific parts of it.
    The `HolochainClientService` itself is a foundational service (often provided globally via a Layer) that wraps the raw `AppAgentWebsocket` or `HolochainClient` instance. It offers low-level methods for making zome calls, handling client setup, and managing connection state.
    Zome-specific services (e.g., `RequestsService`, `OffersService`, `ServiceTypesService`, `UsersOrganizationsService`, `AdministrationService`) are created for each zome.
    ```typescript
    // Example: ui/src/services/zomes/servicetypes.service.ts
    import { Effect, Context, Layer, pipe } from 'effect';
    import type { Record, ActionHash } from '@holochain/client'; // Assuming types
    import type { HolochainClientService, HolochainClientServiceTag } from '../holochainClient.service'; // Adjust path
    import type { ServiceTypesService, ServiceTypeError, UIApprovedServiceType } from './servicetypes.types'; // Adjust path
    // import { mapRecordToUiApprovedServiceType } from '@/utils/mappers'; // Assuming a mapper

    // Placeholder for actual mapper
    const mapRecordToUiApprovedServiceType = (record: Record): UIApprovedServiceType => record.entry.as_any() as UIApprovedServiceType;

    export const ServiceTypesServiceTag = Context.Tag<ServiceTypesService>();

    export const ServiceTypesServiceLive = Layer.effect(
      ServiceTypesServiceTag,
      Effect.gen(function* (_) {
        const hcClient = yield* _(HolochainClientServiceTag); // Dependency on the general Holochain client service
        
        // Helper to call a specific zome (e.g., service_types_coordinator)
        const callCoordinatorZome = <P, O>(fnName: string, payload: P) => 
          hcClient.callZome<O>('service_types_coordinator', fnName, payload);

        return ServiceTypesServiceTag.of({ // Use .of() for simpler service creation if no complex async setup in service itself
          suggestServiceType: (name, description, tags) =>
            pipe(
              callCoordinatorZome('suggest_service_type', { name, description, tags }),
              Effect.mapError((e) => new ServiceTypeError({ message: 'Failed to suggest service type', cause: e })) // Map to a domain-specific error
            ),
          getApprovedServiceTypes: () => 
            pipe(
              callCoordinatorZome('get_approved_service_types', {}),
              Effect.map((records: Record[]) => records.map(mapRecordToUiApprovedServiceType)), // Assuming a mapper
              Effect.mapError((e) => new ServiceTypeError({ message: 'Failed to get approved service types', cause: e }))
            ),
          // ... other method implementations
        });
      })
    );
    ```

**Benefits:**
-   **Decoupling:** UI components and stores depend on service interfaces (via Tags) rather than concrete implementations.
-   **Type Safety:** TypeScript and Effect TS ensure that all calls, data transformations, and error types are rigorously checked.
-   **Composability:** Service methods return `Effect`, integrating seamlessly with other Effect operations in stores or other services, allowing for complex asynchronous flows to be built declaratively.
-   **Testability:** Mock service implementations can be easily provided via different Layers during testing, enabling isolated unit tests for stores and components.

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
3.  **Methods with Effect Orchestration:** Store methods that perform actions (fetching data, creating/updating entities) construct and return Effect pipelines. These Effects are responsible for:
    *   **Declaring Dependencies:** Using `Effect.gen` or `Effect.flatMap`, they declare dependencies on the required zome-specific services by yielding their respective `Context.Tag` (e.g., `RequestsServiceTag`, `ServiceTypesServiceTag`). Effect's runtime resolves these dependencies from the provided context (Layer).
    *   **Orchestrating Operations:** They sequence the necessary operations: calling service methods, transforming the resulting data into UI-friendly formats, updating the store's reactive `$state` variables, and managing `loading` and `error` states.
    *   **Error Handling:** They incorporate robust error handling using Effect's features like `Effect.mapError`, `Effect.catchTag`, or `Effect.tapError` to convert service-level errors into store-specific errors and update UI error states.
    *   **Event Publication:** On successful CRUD operations, they may publish events to the `storeEventBus` to notify other parts of the application (e.g., other stores) about data changes.
    *   **Execution:** The `Effect` returned by a store method is typically executed by the caller (e.g., a UI component event handler or a SvelteKit `load` function) using a utility like `Effect.runPromise` or a custom `runEffect` helper that provides the necessary application-wide Layer (containing all live service implementations).

    ```typescript
    // Example of a store method in serviceTypes.store.svelte.ts
    function suggestServiceType(name: string, description: string, tags: string[]) {
      // This Effect requires ServiceTypesService in its environment to run.
      return Effect.gen(function* (_) {
        const service = yield* _(ServiceTypesServiceTag); // Dependency on ServiceTypesService
{{ ... }}
        
        // Update reactive state for loading and error handling
        loading = $state(true);
        error = $state<ServiceTypeStoreError | null>(null);
        // Assuming 'pendingSuggestions' is a $state array in the store
        // let pendingSuggestions = $state<UIServiceType[]>([]); 

        const record = yield* _(service.suggestServiceType(name, description, tags).pipe(
          Effect.tapError((err) => Effect.sync(() => {
            // Map service error to store error
            error = ServiceTypeStoreError.fromError(err, 'Failed to suggest service type'); 
          }))
        ));
        
        // Assuming a mapping function mapServiceTypeToUi exists
        // const newSuggestion = mapServiceTypeToUi(record);
        // pendingSuggestions.push(newSuggestion); // Update $state array
        
        // Optionally, publish an event
        // storeEventBus.publish('serviceType:suggested', { serviceType: newSuggestion });
        
        return record; // Or newSuggestion
      }).pipe(
        // Ensure loading state is reset regardless of success or failure
        Effect.ensuring(Effect.sync(() => { loading = false; }))
      );
    }
    ```
This pattern of stores orchestrating Effect pipelines that depend on specific service layers is consistently applied across the application (e.g., `RequestsStore` using `RequestsService`, `OffersStore` using `OffersService`, `UsersStore` using `UsersOrganizationsService`, etc.).

    A store method that performs an action (fetching data, creating/updating entities) will typically:
    *   **Construct an Effect:** This Effect encapsulates the entire asynchronous operation.
    *   **Declare Dependencies:** Using `Effect.gen` (for generator-style syntax) or `Effect.flatMap` (for monadic style), it declares dependencies on the required zome-specific services by yielding their respective `Context.Tag` (e.g., `RequestsServiceTag`, `ServiceTypesServiceTag`). Effect's runtime resolves these dependencies from the provided context (Layer) when the Effect is run.
    *   **Orchestrate Operations:** It sequences the necessary operations: calling service methods, transforming the resulting data into UI-friendly formats (using mappers from `ui/src/utils/`), updating the store's reactive `$state` variables, and managing `loading` and `error` states (which are also Svelte `$state` runes).
    *   **Error Handling:** It incorporates robust error handling using Effect's features like `Effect.mapError`, `Effect.catchTag`, or `Effect.tapError` to convert service-level errors into store-specific errors (custom error types extending `Data.TaggedError`) and update UI error states.
    *   **Event Publication:** On successful CRUD operations, it may publish events to the `storeEventBus` (see `ui/src/lib/utils/storeEvents.ts`) to notify other parts of the application (e.g., other stores or components) about data changes, facilitating cross-store communication and cache invalidation if needed.
    *   **Return the Effect:** The store method returns the constructed `Effect`. This `Effect` is typically executed by the caller (e.g., a UI component event handler, a SvelteKit `load` function, or another Effect pipeline) using a utility like `Effect.runPromise` or a custom `runEffect` helper. This helper should provide the necessary application-wide Layer (containing all live service implementations) to the Effect's runtime.

    ```typescript
    // Example of a store method in a conceptual serviceTypes.store.ts
    // Assumes ServiceTypesServiceTag, ServiceTypeError, ServiceTypeStoreError, 
    // UIServiceType, and mapRecordToUiServiceType are defined elsewhere.
    import { Effect, Data, Context, Layer, pipe } from 'effect'; // Assuming Effect and Data are imported
    import { type ServiceTypesService, ServiceTypesServiceTag, type ServiceTypeError } from '@/services/zomes/servicetypes.service'; // Adjust path
    // Define a placeholder UIServiceType if not already defined
    interface UIServiceType { id: string; name: string; description: string; tags: string[]; /* ... other UI fields */ }
    // Define a placeholder mapRecordToUiServiceType
    const mapRecordToUiServiceType = (record: any): UIServiceType => ({ id: record.actionHash, ...record.entry.as_any() });

    // Define a store-specific error type
    class ServiceTypeStoreError extends Data.TaggedError('ServiceTypeStoreError')<{
      readonly message: string;
      readonly cause?: unknown;
      readonly context?: string;
    }> {
      static fromError(error: unknown, context: string) {
        const message = error instanceof Error ? error.message : String(error);
        return new ServiceTypeStoreError({ message: `${context}: ${message}`, cause: error, context });
      }
    }

    function createServiceTypesStore() { // Example factory function for a Svelte store
      let loading = $state(false); // Svelte 5 rune for reactive loading state
      let error = $state<ServiceTypeStoreError | null>(null); // Svelte 5 rune for reactive error state
      let pendingSuggestions = $state<UIServiceType[]>([]); // Example Svelte 5 reactive state array

      function suggestServiceType(name: string, description: string, tags: string[]): Effect<ServiceTypesService, ServiceTypeStoreError, UIServiceType> {
        // This Effect requires ServiceTypesService in its environment to run.
        return Effect.gen(function* (_) {
          const service = yield* _(ServiceTypesServiceTag); // Dependency on ServiceTypesService
          
          loading = true;
          error = null;

          const record = yield* _(
            service.suggestServiceType(name, description, tags).pipe(
              // Map the service-level error to a store-specific error
              Effect.mapError((err) => ServiceTypeStoreError.fromError(err, 'Failed to suggest service type'))
            )
          );
          
          const newSuggestion = mapRecordToUiServiceType(record); // Map to UI type
          pendingSuggestions.push(newSuggestion); // Update $state array
          
          // Optionally, publish an event
          // import { storeEventBus } from '@/utils/storeEvents'; // Assuming event bus
          // storeEventBus.publish('serviceType:suggested', { serviceType: newSuggestion });
          
          return newSuggestion; // Return the UI-mapped object
        }).pipe(
          // Ensure loading state is reset regardless of success or failure
          Effect.ensuring(Effect.sync(() => { loading = false; }))
        );
      }
      
      // ... other store methods (getApproved, approve, reject, etc.)

      return {
        // Expose reactive state (runes are directly reactive)
        pendingSuggestions,
        loading,
        error,
        // Expose methods that return Effects
        suggestServiceType,
        // ... other exported methods and reactive properties
      };
    }
    ```
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
