# UI Structure Documentation

This document provides a comprehensive overview of the UI structure for the Requests and Offers application.

## Project Structure

The UI is built with:

- SvelteKit as the framework
- TailwindCSS for styling
- SkeletonUI for UI components
- Svelte 5 features (runes and native HTML events)
- Effect TS (@effect/io) for functional error handling and asynchronous operations

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

Located in `/src/services`, handling all communication with the Holochain backend:

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

All services use Effect TS (@effect/io) for robust error handling and asynchronous operations:

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

Located in `/src/stores`, managing application state using Svelte 5 runes and Effect TS:

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

Stores follow a consistent pattern combining Svelte 5 runes with Effect TS:

```typescript
// Example store pattern
export function createRequestsStore(
  requestsService: RequestsService,
  eventBus: EventBus<StoreEvents>
): RequestsStore {
  // Reactive state using Svelte 5 runes
  const requests: UIRequest[] = $state([]);
  let loading: boolean = $state(false);
  let error: string | null = $state(null);
  
  // Cache implementation
  const cache = createEntityCache<UIRequest>({
    expiryMs: 5 * 60 * 1000, // 5 minutes
    debug: false
  });
  
  // Method implementation using Effect TS
  const getAllRequests = (): Effect<never, RequestStoreError, UIRequest[]> =>
    pipe(
      E.sync(() => {
        loading = true;
        error = null;
      }),
      E.flatMap(() => requestsService.getAllRequestsRecords()),
      E.map((records) => {
        // Transform records to UIRequest objects
        // Update cache and state
        return requests;
      }),
      E.catchAll((error) => {
        const storeError = RequestStoreError.fromError(error, 'Failed to get requests');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
    );
    
  // Return the store interface
  return {
    requests,
    loading,
    error,
    cache,
    getAllRequests,
    // Other methods...
  };
}
```

## Type System

Located in `/src/types`:

- TypeScript interfaces and types for the application
- Type definitions for Holochain data structures
- `ui.ts`: UI-specific type definitions including `UIRequest`
- `holochain.ts`: Holochain-specific type definitions including `RequestInDHT`

### Effect TS Types

The application uses Effect TS types for error handling and asynchronous operations:

```typescript
// Effect type for service methods
type Effect<R, E, A> = import('@effect/io/Effect').Effect<R, E, A>;

// Custom error types
export class RequestError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export class RequestStoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RequestStoreError';
  }
  
  static fromError(error: unknown, context: string): RequestStoreError {
    if (error instanceof Error) {
      return new RequestStoreError(`${context}: ${error.message}`, error);
    }
    return new RequestStoreError(`${context}: ${String(error)}`, error);
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

### Mock Utilities

`mocks.ts`: Provides mock data and utilities for testing and development.

## Testing

The UI includes:

- End-to-end tests using Playwright
- Type checking using "bun check" in the ui
- Tests must be run using "nix develop --command [test command]" for proper environment setup
