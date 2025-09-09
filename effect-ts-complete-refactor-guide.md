# Complete Application Refactor: Centralized Effect TS Runtime

## Overview

This document outlines how to refactor the entire application to use a centralized Effect TS runtime for service dependencies, eliminating the need to provide services at the store level.

## 1. Update AppServices Interface

Ensure the AppServices interface in `app-runtime.ts` includes all necessary services:

```typescript
// ui/src/lib/runtime/app-runtime.ts
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
  // Add any new services here as they're created
}
```

## 2. Refactor All Store Factories

Update each store factory to depend on AppServicesTag instead of individual service tags:

### Users Store
```typescript
// ui/src/lib/stores/users.store.svelte.ts
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag
> => E.gen(function* () {
  const { users: usersService, holochainClient: holochainClientService } = yield* AppServicesTag;
  const cacheService = yield* CacheServiceTag;
  // ... rest of implementation unchanged
})
```

### Administration Store
```typescript
// ui/src/lib/stores/administration.store.svelte.ts
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
  // ... rest of implementation unchanged
})
```

### Offers Store
```typescript
// ui/src/lib/stores/offers.store.svelte.ts
export const createOffersStore = (): E.Effect<
  OffersStore,
  never,
  AppServicesTag | CacheServiceTag
> => E.gen(function* () {
  const { offers: offersService, holochainClient: holochainClientService } = yield* AppServicesTag;
  const cacheService = yield* CacheServiceTag;
  // ... rest of implementation unchanged
})
```

Apply similar patterns to all other stores (requests, serviceTypes, organizations, mediumsOfExchange).

## 3. Update Store Initializations

Update all store initializations to use the centralized runtime:

```typescript
// Example for users store
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(createAppRuntime()),
  E.provide(CacheServiceLive),
  E.runSync
);
```

## 4. Refactor Components and Composables

Update components and composables to access services through AppServicesTag:

```typescript
// Instead of:
const program = E.gen(function* () {
  const usersService = yield* UsersServiceTag;
  const administrationService = yield* AdministrationServiceTag;
  // ...
});

// Use:
const program = E.gen(function* () {
  const { users: usersService, administration: administrationService } = yield* AppServicesTag;
  // ...
});
```

## 5. Simplify Test Setups

Update tests to use centralized service mocking:

```typescript
// Before (complex setup)
const testRuntime = Layer.mergeAll(
  Layer.succeed(HolochainClientServiceTag, mockHolochainClient),
  Layer.succeed(UsersServiceTag, mockUsersService),
  Layer.succeed(AdministrationServiceTag, mockAdministrationService),
  // ... more service layers
);

// After (simplified setup)
const mockAppServices = {
  holochainClient: mockHolochainClient,
  users: mockUsersService,
  administration: mockAdministrationService,
  // ... other services
} as AppServices;

const testProgram = program.pipe(
  E.provideService(AppServicesTag, mockAppServices)
);
```

## 6. Implementation Checklist

- [ ] Update AppServices interface to include all services
- [ ] Refactor users store factory and initialization
- [ ] Refactor administration store factory and initialization
- [ ] Refactor offers store factory and initialization
- [ ] Refactor requests store factory and initialization
- [ ] Refactor serviceTypes store factory and initialization
- [ ] Refactor organizations store factory and initialization
- [ ] Refactor mediumsOfExchange store factory and initialization
- [ ] Refactor hrea store factory and initialization
- [ ] Update components to use AppServicesTag
- [ ] Update composables to use AppServicesTag
- [ ] Simplify test setups
- [ ] Verify all functionality works correctly
- [ ] Update documentation to reflect new patterns

## 7. Benefits Realization

After implementing this refactor:

1. **Centralized Dependency Management**: All service dependencies managed in one place
2. **Reduced Complexity**: Eliminates need to import and provide individual service layers
3. **Better Performance**: Services instantiated once and reused throughout application
4. **Easier Testing**: Simplified test setup with centralized service mocking
5. **Clearer Contracts**: Components explicitly declare what services they need
6. **Improved Maintainability**: Changes to service dependencies happen in one location
7. **Consistent Architecture**: All parts of the application follow the same pattern

## 8. Migration Strategy

To implement this without breaking existing functionality:

1. **Phase 1**: Update the AppServices interface and runtime
2. **Phase 2**: Refactor one store at a time, starting with the least dependent (e.g., users)
3. **Phase 3**: Verify each refactored store works correctly before proceeding
4. **Phase 4**: Update components and composables to use the new pattern
5. **Phase 5**: Simplify test setups
6. **Phase 6**: Remove unused individual service layer imports and provisions

This incremental approach ensures we can verify each step works correctly before proceeding to the next.