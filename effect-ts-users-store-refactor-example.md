# Refactoring Example: Users Store

This document shows how to refactor the users store to use the centralized AppServices pattern.

## Current Implementation

```typescript
// ui/src/lib/stores/users.store.svelte.ts (current)
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

## Refactored Implementation

```typescript
// ui/src/lib/stores/users.store.svelte.ts (refactored)
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag
> => E.gen(function* () {
  // Destructure the specific services we need from AppServices
  const { users: usersService, holochainClient: holochainClientService } = yield* AppServicesTag;
  const cacheService = yield* CacheServiceTag;
  // ... rest of implementation remains IDENTICAL
})
```

## Updated Store Initialization

```typescript
// ui/src/lib/stores/users.store.svelte.ts (updated initialization)
const usersStore: UsersStore = pipe(
  createUsersStore(),
  // Provide all services through the centralized runtime
  E.provide(createAppRuntime()),
  // Cache service is still provided separately as it may have different lifecycle requirements
  E.provide(CacheServiceLive),
  E.runSync
);
```

## Benefits of This Refactoring

1. **Simplified Dependencies**: Instead of listing 3 individual service tags, we only need AppServicesTag
2. **Centralized Management**: All service dependencies are now managed through the app runtime
3. **Easier Testing**: Tests can provide a mock AppServices object instead of individual services
4. **Better Maintainability**: Adding/removing services only requires updating the AppServices interface

## Test Refactoring Example

### Before
```typescript
// Complex test setup with multiple service layers
const result = await E.runPromise(
  someTestProgram.pipe(
    E.provide(UsersServiceLive),
    E.provide(CacheServiceLive),
    E.provide(HolochainClientLive)
  )
);
```

### After
```typescript
// Simplified test setup with centralized services
const mockAppServices = {
  users: mockUsersService,
  holochainClient: mockHolochainClient,
  // ... other services as needed for the test
} as AppServices;

const result = await E.runPromise(
  someTestProgram.pipe(
    E.provideService(AppServicesTag, mockAppServices),
    E.provide(CacheServiceLive) // Cache still provided separately if needed
  )
);
```

This refactoring pattern can be applied to all stores in the application for consistency and better dependency management.