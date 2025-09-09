# Effect TS Runtime Implementation Plan

## 1. Enhanced AppServices Interface

First, we need to ensure our AppServices interface includes all necessary services:

```typescript
// runtime/app-runtime.ts
export interface AppServices {
  readonly holochainClient: typeof HolochainClientServiceTag.Service;
  readonly hrea: typeof HreaServiceTag.Service;
  readonly users: typeof UsersServiceTag.Service;
  readonly administration: typeof AdministrationServiceTag.Service;
  readonly offers: typeof OffersServiceTag.Service;
  readonly requests: typeof RequestsServiceTag.Service;
  readonly serviceTypes: typeof ServiceTypesServiceTag.Service;
  readonly organizations: typeof OrganizationsServiceTag.Service;
  readonly mediumsOfExchange: typeof MediumsOfExchangeServiceTag.Service;
}
```

## 2. Updated Store Factory Pattern

Here's how we should modify store factories to depend on AppServicesTag:

### Before (Current Pattern)
```typescript
// users.store.svelte.ts
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  UsersServiceTag | CacheServiceTag | HolochainClientServiceTag
> => E.gen(function* () {
  const usersService = yield* UsersServiceTag;
  const cacheService = yield* CacheServiceTag;
  const holochainClientService = yield* HolochainClientServiceTag;
  // ... implementation
})
```

### After (Improved Pattern)
```typescript
// users.store.svelte.ts
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag
> => E.gen(function* () {
  const { users: usersService, holochainClient: holochainClientService } = yield* AppServicesTag;
  const cacheService = yield* CacheServiceTag;
  // ... implementation (identical to before)
})
```

## 3. Runtime-based Store Initialization

Update store initialization to use the centralized runtime:

```typescript
// users.store.svelte.ts
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(createAppRuntime()), // Provide all services at once
  E.provide(CacheServiceLive),   // Keep cache as separate dependency if needed
  E.runSync
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
  createResourceManagementLayer(defaultAppRuntimeConfig.resources)
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
  mediumsOfExchange: {} as any
} as AppServices;

const testRuntime = Layer.succeed(AppServicesTag, mockAppServices);
```

## 6. Implementation Steps

### Step 1: Update All Store Factories

Modify each store factory to depend on AppServicesTag:

```typescript
// Example for administration.store.svelte.ts
export const createAdministrationStore = (): E.Effect<
  AdministrationStore,
  never,
  AppServicesTag | CacheServiceTag
> => E.gen(function* () {
  const { 
    administration: administrationService, 
    holochainClient: holochainClientService 
  } = yield* AppServicesTag;
  const cacheService = yield* CacheServiceTag;
  // ... rest of implementation remains the same
})
```

### Step 2: Update Store Initializations

Update all store initializations to use the centralized runtime:

```typescript
// Example for administration.store.svelte.ts
const administrationStore: AdministrationStore = pipe(
  createAdministrationStore(),
  E.provide(createAppRuntime()),
  E.provide(CacheServiceLive),
  E.runSync
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