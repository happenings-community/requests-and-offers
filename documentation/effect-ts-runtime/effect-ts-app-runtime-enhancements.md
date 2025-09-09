# App Runtime Updates for Centralized Service Dependencies

**UPDATED** - Based on Current Codebase Analysis (2025-01-09)

## Current App Runtime Status

**✅ EXCELLENT FOUNDATION**: The current `app-runtime.ts` already has:
- Complete `AppServices` interface with all 9 services
- `AppServicesTag` context tag definition  
- Sophisticated error recovery, logging, and resource management
- `createAppRuntime()` function that merges all service layers

**❌ CRITICAL MISSING PIECE**: 
- No `AppServicesLive` layer to bridge individual services to `AppServicesTag`
- This prevents stores from using the centralized runtime approach

## Updated App Runtime Implementation

Here's how to modify the app runtime to properly support centralized service dependencies:

```typescript
// ui/src/lib/runtime/app-runtime.ts
// ADD THIS AFTER THE AppServicesTag DEFINITION (around line 140)

// ========================================================================
// APP SERVICES LAYER - THE MISSING PIECE
// ========================================================================

/**
 * AppServicesLive Layer - Combines all individual service layers into unified AppServices
 * 
 * This is the critical missing piece that enables centralized service access throughout
 * the application. It bridges individual service layers to the AppServicesTag.
 */
export const AppServicesLive: Layer.Layer<AppServicesTag, never, never> =
  Layer.effect(
    AppServicesTag,
    E.gen(function* () {
      // Yield all individual services to create the combined AppServices object
      const holochainClient = yield* HolochainClientServiceTag;
      const hrea = yield* HreaServiceTag;
      const users = yield* UsersServiceTag;
      const administration = yield* AdministrationServiceTag;
      const offers = yield* OffersServiceTag;
      const requests = yield* RequestsServiceTag;
      const serviceTypes = yield* ServiceTypesServiceTag;
      const organizations = yield* OrganizationsServiceTag;
      const mediumsOfExchange = yield* MediumsOfExchangeServiceTag;

      // Return the complete AppServices object (satisfies ensures type safety)
      return {
        holochainClient,
        hrea,
        users,
        administration,
        offers,
        requests,
        serviceTypes,
        organizations,
        mediumsOfExchange,
      } satisfies AppServices;
    }),
  );

// ========================================================================
// ENHANCED RUNTIME CREATION
// ========================================================================

/**
 * UPDATE THE EXISTING createAppRuntime FUNCTION
 * 
 * The current function merges all individual service layers but doesn't include
 * AppServicesLive. This single line addition enables the entire centralized approach.
 */
export const createAppRuntime = (
  config: AppRuntimeConfig = defaultAppRuntimeConfig,
) => {
  // MODIFY THIS SECTION: Add AppServicesLive to the existing mergeAll
  const serviceLayer = Layer.mergeAll(
    HolochainClientServiceLive,
    HreaServiceLive,
    UsersServiceLive,
    AdministrationServiceLive,
    OffersServiceLive,
    RequestsServiceLive,
    ServiceTypesServiceLive,
    OrganizationsServiceLive,
    MediumsOfExchangeServiceLive,
    AppServicesLive, // ← ADD THIS SINGLE LINE TO EXISTING FUNCTION
  );

  // The rest of the existing function remains exactly the same
  const enhancedRuntime = pipe(
    serviceLayer,
    Layer.provide(createApplicationLogger(config.logging)),
    Layer.provideMerge(createResourceManagementLayer(config.resources)),
  );

  return enhancedRuntime;
};

// ========================================================================
// PROGRAM EXECUTION WITH ALL SERVICES
// ========================================================================

/**
 * Execute a program with all application services provided
 */
export const withAppServices = <A, E>(
  program: E.Effect<A, E, AppServicesTag>,
) => pipe(program, E.provide(createAppRuntime()));

/**
 * Execute a program with all application services and additional layers
 */
export const runAppProgram = <A, E, R>(
  program: E.Effect<A, E, R | AppServicesTag>,
  additionalLayers: Layer.Layer<R, never, never> = Layer.empty,
) => pipe(program, E.provide(createAppRuntime()), E.provide(additionalLayers));
```

## Usage Examples

### In Store Factories - ACTUAL REFACTORING EXAMPLE

```typescript
// ui/src/lib/stores/users.store.svelte.ts

// BEFORE (CURRENT STATE):
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  UsersServiceTag | CacheServiceTag  // ← Individual dependencies
> =>
  E.gen(function* () {
    const usersService = yield* UsersServiceTag;  // ← Direct service access
    const cacheService = yield* CacheServiceTag;
    // HolochainClientServiceTag accessed manually within functions
    // ... implementation
  });

// AFTER (REFACTORED):
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag  // ← Unified dependency
> =>
  E.gen(function* () {
    // Access all services from unified AppServices object
    const { users: usersService, holochainClient } = yield* AppServicesTag;
    const cacheService = yield* CacheServiceTag;
    
    // Business logic remains 100% identical
    // ... implementation (no changes to actual business logic)
  });
```

### In Store Initialization - ACTUAL REFACTORING EXAMPLE

```typescript
// ui/src/lib/stores/users.store.svelte.ts

// BEFORE (CURRENT STATE):
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(UsersServiceLive),      // ← Multiple individual provisions
  E.provide(CacheServiceLive),      
  E.provide(HolochainClientLive),   
  E.runSync
);

// AFTER (REFACTORED):
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(createAppRuntime()),    // ← Single centralized runtime
  E.provide(CacheServiceLive),      // ← Cache remains separate
  E.runSync
);
```

### In Components/Composables

```typescript
// Any component or composable
const program = E.gen(function* () {
  const { users, administration } = yield* AppServicesTag;

  // Use services directly
  const user = yield* users.getLatestUser(someHash);
  const isAdmin = yield* administration.checkIfAgentIsAdministrator();

  return { user, isAdmin };
});

// Execute with all services provided
const result = E.runPromise(withAppServices(program));
```

### In Tests

```typescript
// Simplified test setup
const mockAppServices = {
  holochainClient: mockHolochainClient,
  users: mockUsersService,
  administration: mockAdministrationService,
  // ... other services as needed
} as AppServices;

const testProgram = program.pipe(
  E.provideService(AppServicesTag, mockAppServices),
  E.provide(CacheServiceLive),
);

const result = await E.runPromise(testProgram);
```

## Benefits of These Changes

1. **Single Point of Service Provision**: All services provided through one mechanism
2. **Type Safety**: Full TypeScript support for all service access
3. **Easy Testing**: Simple mocking through AppServicesTag
4. **Performance**: Services instantiated once and reused
5. **Maintainability**: Adding new services only requires updating AppServices interface
6. **Consistency**: All parts of the app use the same pattern

## Implementation Priority

**CRITICAL FIRST STEP**: Add AppServicesLive layer and update createAppRuntime
- This single addition enables the entire centralized approach
- All other refactoring depends on this foundation

## Implementation Steps

1. **ADD AppServicesLive Layer** - Add the missing layer to `app-runtime.ts` (25 lines of code)
2. **UPDATE createAppRuntime** - Add `AppServicesLive` to existing `Layer.mergeAll` (1 line change)  
3. **REFACTOR 8 Store Factories** - Change dependencies from individual services to `AppServicesTag`
4. **UPDATE 8 Store Initializations** - Replace multiple provides with `createAppRuntime()`
5. **UPDATE Service Access** - Change `yield* UsersServiceTag` to `const { users } = yield* AppServicesTag`
6. **SIMPLIFY Tests** - Use centralized service mocking through `AppServicesTag`

**MINIMAL RISK**: Changes are architectural only - business logic remains 100% identical

This approach provides a clean, maintainable way to manage all service dependencies at the application runtime level.
