# Effect TS Runtime Implementation Plan

**UPDATED PLAN** - Based on Current Codebase Analysis (2025-01-09)

## Current State Assessment

✅ **Already Complete**:
- `AppServices` interface with all 9 services ✅
- `AppServicesTag` context tag ✅  
- `createAppRuntime()` function ✅
- Individual service layers ✅

❌ **Missing Critical Component**:
- `AppServicesLive` layer (the bridge that combines everything)

## 1. Create Missing AppServicesLive Layer

**CRITICAL FIRST STEP**: Add the missing `AppServicesLive` layer to `app-runtime.ts`:

```typescript
// Add this to app-runtime.ts after the AppServicesTag definition:

/**
 * AppServicesLive Layer - THE MISSING PIECE
 * 
 * This layer combines all individual service layers into a single AppServices object
 * that can be accessed via AppServicesTag throughout the application.
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

      // Return the complete AppServices object
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

// Update createAppRuntime to include AppServicesLive
export const createAppRuntime = (config: AppRuntimeConfig = defaultAppRuntimeConfig) => {
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
    AppServicesLive, // ← ADD THIS LINE
  );

  // Rest of function remains the same...
};
```

## 2. Updated Store Factory Pattern

Here's how we should modify store factories to depend on AppServicesTag:

### Before (Current Pattern) - FROM ACTUAL USERS STORE

```typescript
// users.store.svelte.ts (CURRENT STATE)
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  UsersServiceTag | CacheServiceTag  // ← Individual service dependencies
> =>
  E.gen(function* () {
    const usersService = yield* UsersServiceTag;  // ← Direct service access
    const cacheService = yield* CacheServiceTag;
    // Inside functions, manual HolochainClientServiceTag access:
    // const holochainClient = yield* HolochainClientServiceTag;
    // ... implementation
  });

// Current initialization with multiple provides:
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(UsersServiceLive),      // ← Individual service layers
  E.provide(CacheServiceLive),      
  E.provide(HolochainClientLive),   // ← Added manually in functions
  E.runSync
);
```

### After (Improved Pattern) - WHAT IT SHOULD BE

```typescript
// users.store.svelte.ts (REFACTORED)
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag  // ← Single unified dependency
> =>
  E.gen(function* () {
    const { users: usersService, holochainClient: holochainClientService } =
      yield* AppServicesTag;  // ← Destructured access to all services
    const cacheService = yield* CacheServiceTag;
    // ... implementation (business logic identical)
  });

// Simplified initialization with centralized runtime:
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(createAppRuntime()),    // ← Single runtime provision
  E.provide(CacheServiceLive),      // ← Keep cache separate if needed
  E.runSync
);
```

## 3. Runtime-based Store Initialization

Update store initialization to use the centralized runtime:

```typescript
// users.store.svelte.ts
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(createAppRuntime()), // Provide all services at once
  E.provide(CacheServiceLive), // Keep cache as separate dependency if needed
  E.runSync,
);
```

## 4. Component Usage Pattern

Components should access services through the centralized runtime:

```typescript
// Instead of this pattern:
const program = E.gen(function* () {
  const usersService = yield* UsersServiceTag;
  const holochainClient = yield* HolochainClientServiceTag;
  // ...
});

// Use this pattern:
const program = E.gen(function* () {
  const { users: usersService, holochainClient } = yield* AppServicesTag;
  // ...
});
```

## 5. Test Setup Simplification

Tests become much simpler with this approach:

### Before

```typescript
// app-runtime.test.ts (complex test setup)
const testRuntime = Layer.mergeAll(
  Layer.succeed(HolochainClientServiceTag, mockHolochainClient),
  Layer.succeed(HreaServiceTag, mockHreaService),
  Layer.succeed(UsersServiceTag, {} as any),
  Layer.succeed(AdministrationServiceTag, {} as any),
  Layer.succeed(OffersServiceTag, {} as any),
  Layer.succeed(RequestsServiceTag, {} as any),
  Layer.succeed(ServiceTypesServiceTag, {} as any),
  Layer.succeed(OrganizationsServiceTag, {} as any),
  Layer.succeed(MediumsOfExchangeServiceTag, {} as any),
  createApplicationLogger(defaultAppRuntimeConfig.logging),
  createResourceManagementLayer(defaultAppRuntimeConfig.resources),
);
```

### After

```typescript
// Much simpler test setup
const mockAppServices = {
  holochainClient: mockHolochainClient,
  hrea: mockHreaService,
  users: {} as any,
  administration: {} as any,
  offers: {} as any,
  requests: {} as any,
  serviceTypes: {} as any,
  organizations: {} as any,
  mediumsOfExchange: {} as any,
} as AppServices;

const testRuntime = Layer.succeed(AppServicesTag, mockAppServices);
```

## 6. Implementation Steps

### Step 1: Add AppServicesLive Layer to app-runtime.ts

**PRIORITY 1**: This is the critical missing piece that enables everything else.

### Step 2: Update Store Factories (8 stores total)

Modify each store factory to depend on AppServicesTag. **Based on actual analysis**:

```typescript
// users.store.svelte.ts (Current: UsersServiceTag | CacheServiceTag)
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag  // ← Changed from UsersServiceTag
> =>
  E.gen(function* () {
    const { users: usersService, holochainClient } = yield* AppServicesTag;
    const cacheService = yield* CacheServiceTag;
    // Business logic remains identical
  });

// administration.store.svelte.ts (Current: AdministrationServiceTag | CacheServiceTag | HolochainClientServiceTag)
export const createAdministrationStore = (): E.Effect<
  AdministrationStore,
  never,
  AppServicesTag | CacheServiceTag  // ← Reduced from 3 dependencies to 2
> =>
  E.gen(function* () {
    const { administration, holochainClient } = yield* AppServicesTag;
    const cacheService = yield* CacheServiceTag;
    // Business logic remains identical
  });
```

**All 8 stores to update**: users, administration, offers, requests, serviceTypes, organizations, mediumsOfExchange, hrea

### Step 2: Update Store Initializations

Update all store initializations to use the centralized runtime:

```typescript
// Example for administration.store.svelte.ts
const administrationStore: AdministrationStore = pipe(
  createAdministrationStore(),
  E.provide(createAppRuntime()),
  E.provide(CacheServiceLive),
  E.runSync,
);
```

### Step 3: Refactor Components and Composables

Update all components and composables to use AppServicesTag:

```typescript
// In any component or composable
const program = E.gen(function* () {
  const { users, administration, offers } = yield* AppServicesTag;
  // Use services directly
});
```

## 7. Benefits Realization

This approach provides several key benefits:

1. **Centralized Dependency Management**: All service dependencies are managed in one place
2. **Reduced Import Complexity**: No need to import individual service layers
3. **Better Performance**: Services instantiated once and reused
4. **Simplified Testing**: Easy to mock entire service suite
5. **Clearer Contracts**: Components explicitly declare service dependencies
6. **Easier Maintenance**: Changes to service dependencies happen in one location

## 8. Migration Strategy

To implement this without breaking existing functionality:

1. **Phase 1**: Update the AppServices interface and runtime to ensure it provides all services
2. **Phase 2**: Gradually update store factories to accept AppServicesTag instead of individual service tags
3. **Phase 3**: Update store initializations to use the centralized runtime
4. **Phase 4**: Refactor components and composables to use AppServicesTag
5. **Phase 5**: Simplify test setups to use the centralized service mocking

This incremental approach ensures we can verify each step works correctly before proceeding to the next.
