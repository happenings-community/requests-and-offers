# App Runtime Updates for Centralized Service Dependencies

## Current App Runtime Issues

The current `app-runtime.ts` provides individual service layers but doesn't make it easy to access all services as a single dependency. We need to enhance it to provide a complete AppServices object.

## Updated App Runtime Implementation

Here's how to modify the app runtime to properly support centralized service dependencies:

```typescript
// ui/src/lib/runtime/app-runtime.ts

// ... existing imports ...

// ========================================================================
// APP SERVICES LAYER
// ========================================================================

/**
 * Layer that provides all services as a single AppServices object
 */
export const AppServicesLive: Layer.Layer<AppServicesTag, never, never> = Layer.effect(
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

    // Return the complete AppServices object
    return AppServicesTag.of({
      holochainClient,
      hrea,
      users,
      administration,
      offers,
      requests,
      serviceTypes,
      organizations,
      mediumsOfExchange
    });
  })
);

// ========================================================================
// ENHANCED RUNTIME CREATION
// ========================================================================

/**
 * Main application runtime that combines all service layers with
 * error recovery, logging, and resource management
 */
export const createAppRuntime = (config: AppRuntimeConfig = defaultAppRuntimeConfig) => {
  // Base service layers including the new AppServices layer
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
    AppServicesLive // Add the combined services layer
  );

  // Enhanced runtime with logging and resource management
  const enhancedRuntime = pipe(
    serviceLayer,
    Layer.provide(createApplicationLogger(config.logging)),
    Layer.provideMerge(createResourceManagementLayer(config.resources))
  );

  return enhancedRuntime;
};

// ========================================================================
// PROGRAM EXECUTION WITH ALL SERVICES
// ========================================================================

/**
 * Execute a program with all application services provided
 */
export const withAppServices = <A, E>(program: E.Effect<A, E, AppServicesTag>) =>
  pipe(program, E.provide(createAppRuntime()));

/**
 * Execute a program with all application services and additional layers
 */
export const runAppProgram = <A, E, R>(
  program: E.Effect<A, E, R | AppServicesTag>,
  additionalLayers: Layer.Layer<R, never, never> = Layer.empty
) => 
  pipe(
    program,
    E.provide(createAppRuntime()),
    E.provide(additionalLayers)
  );
```

## Usage Examples

### In Store Factories

```typescript
// ui/src/lib/stores/users.store.svelte.ts
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag
> => E.gen(function* () {
  // Access specific services from the combined AppServices
  const { users: usersService, holochainClient: holochainClientService } = yield* AppServicesTag;
  const cacheService = yield* CacheServiceTag;
  
  // Implementation remains exactly the same
  // ...
});
```

### In Store Initialization

```typescript
// ui/src/lib/stores/users.store.svelte.ts
const usersStore: UsersStore = runAppProgram(
  createUsersStore(),
  CacheServiceLive
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
  E.provide(CacheServiceLive)
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

## Implementation Steps

1. Add the `AppServicesLive` layer to `app-runtime.ts`
2. Update the `createAppRuntime` function to include `AppServicesLive`
3. Add the `runAppProgram` helper function
4. Refactor store factories to depend on `AppServicesTag`
5. Update store initializations to use `runAppProgram`
6. Update components/composables to access services through `AppServicesTag`
7. Simplify test setups to use `AppServicesTag` for mocking

This approach provides a clean, maintainable way to manage all service dependencies at the application runtime level.