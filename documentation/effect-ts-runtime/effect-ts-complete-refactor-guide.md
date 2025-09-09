# Complete Application Refactor: Centralized Effect TS Runtime

**UPDATED GUIDE** - Based on Current Codebase Analysis (2025-01-09)

## Overview

This document provides the complete step-by-step guide to implement centralized Effect TS runtime based on actual analysis of the current codebase. The refactor eliminates redundant service provisioning and creates a unified service access pattern.

## Current State Summary

✅ **FOUNDATION COMPLETE**: `AppServices` interface, `AppServicesTag`, `createAppRuntime()`, all individual service layers
❌ **MISSING BRIDGE**: `AppServicesLive` layer that combines individual services into `AppServicesTag`
❌ **STORE COMPLEXITY**: 8 stores use individual service dependencies instead of centralized approach

## 1. AppServices Interface Status

✅ **ALREADY COMPLETE** - The `AppServices` interface in `app-runtime.ts` is fully implemented with all 9 services:

```typescript
// ui/src/lib/runtime/app-runtime.ts (ALREADY EXISTS - NO CHANGES NEEDED)
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

export class AppServicesTag extends Context.Tag('AppServices')<AppServicesTag, AppServices>() {}
```

**STATUS**: ✅ No action required - interface is complete

## 2. Add Missing AppServicesLive Layer

**CRITICAL STEP**: Add the missing `AppServicesLive` layer to `app-runtime.ts`:

```typescript
// ui/src/lib/runtime/app-runtime.ts
// ADD THIS AFTER LINE 140 (after AppServicesTag definition):

/**
 * AppServicesLive Layer - THE MISSING CRITICAL PIECE
 * 
 * This layer combines all individual service layers into a single AppServices object.
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

// UPDATE EXISTING createAppRuntime FUNCTION (around line 330):
// Add AppServicesLive to the Layer.mergeAll call:
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
    AppServicesLive, // ← ADD THIS SINGLE LINE
  );
  
  // Rest remains the same...
};
```

## 3. Refactor 8 Store Factories

Based on actual current state analysis, update each store factory:

### Users Store - ACTUAL CURRENT STATE REFACTORING

```typescript
// ui/src/lib/stores/users.store.svelte.ts

// CHANGE THIS (line 103-107):
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  UsersServiceTag | CacheServiceTag  // ← Change to AppServicesTag
> =>
  E.gen(function* () {
    const usersService = yield* UsersServiceTag;  // ← Change to destructured access
    const cacheService = yield* CacheServiceTag;
    
// TO THIS:
export const createUsersStore = (): E.Effect<
  UsersStore,
  never,
  AppServicesTag | CacheServiceTag  // ← Single dependency
> =>
  E.gen(function* () {
    const { users: usersService, holochainClient } = yield* AppServicesTag;  // ← Destructured
    const cacheService = yield* CacheServiceTag;
    // All business logic remains 100% identical
```

### Administration Store - ACTUAL CURRENT STATE REFACTORING  

```typescript
// ui/src/lib/stores/administration.store.svelte.ts

// CHANGE DEPENDENCIES FROM:
// AdministrationServiceTag | CacheServiceTag | HolochainClientServiceTag
// TO:
// AppServicesTag | CacheServiceTag

export const createAdministrationStore = (): E.Effect<
  AdministrationStore,
  never,
  AppServicesTag | CacheServiceTag  // ← Reduced from 3 to 2 dependencies
> =>
  E.gen(function* () {
    const { administration, holochainClient } = yield* AppServicesTag;  // ← Unified access
    const cacheService = yield* CacheServiceTag;
    // Business logic remains identical
  });
```

**APPLY SAME PATTERN TO ALL 8 STORES**: users, administration, offers, requests, serviceTypes, organizations, mediumsOfExchange, hrea

## 4. Update Store Initializations

Based on actual current state, update all 8 store initializations:

### Users Store Initialization - ACTUAL REFACTORING

```typescript
// ui/src/lib/stores/users.store.svelte.ts (line 524-530)

// CHANGE FROM:
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(UsersServiceLive),      // ← Multiple individual provisions
  E.provide(CacheServiceLive),      
  E.provide(HolochainClientLive),   
  E.runSync
);

// TO:
const usersStore: UsersStore = pipe(
  createUsersStore(),
  E.provide(createAppRuntime()),    // ← Single centralized runtime
  E.provide(CacheServiceLive),      // ← Cache remains separate
  E.runSync
);
```

### Administration Store Initialization - ACTUAL REFACTORING

```typescript
// ui/src/lib/stores/administration.store.svelte.ts

// CHANGE FROM (similar pattern):
const administrationStore: AdministrationStore = pipe(
  createAdministrationStore(),
  E.provide(AdministrationServiceLive),  // ← Multiple individual provisions
  E.provide(CacheServiceLive),           
  E.provide(HolochainClientLive),        
  E.runSync
);

// TO:
const administrationStore: AdministrationStore = pipe(
  createAdministrationStore(),
  E.provide(createAppRuntime()),         // ← Single centralized runtime
  E.provide(CacheServiceLive),           
  E.runSync
);
```

**APPLY SAME PATTERN TO ALL 8 STORES**: Replace multiple individual `E.provide()` calls with single `E.provide(createAppRuntime())`

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
  const { users: usersService, administration: administrationService } =
    yield* AppServicesTag;
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
  E.provideService(AppServicesTag, mockAppServices),
);
```

## 6. Implementation Checklist - BASED ON ACTUAL ANALYSIS

### PHASE 1: Foundation (CRITICAL FIRST STEP)
- [ ] **ADD AppServicesLive Layer** to `app-runtime.ts` (25 lines of code)
- [ ] **UPDATE createAppRuntime** - Add `AppServicesLive` to `Layer.mergeAll` (1 line change)

### PHASE 2: Store Factory Refactoring (8 stores)
- [ ] **users.store.svelte.ts** - Change `UsersServiceTag | CacheServiceTag` to `AppServicesTag | CacheServiceTag` 
- [ ] **administration.store.svelte.ts** - Change `AdministrationServiceTag | CacheServiceTag | HolochainClientServiceTag` to `AppServicesTag | CacheServiceTag`
- [ ] **offers.store.svelte.ts** - Refactor to use AppServicesTag
- [ ] **requests.store.svelte.ts** - Refactor to use AppServicesTag  
- [ ] **serviceTypes.store.svelte.ts** - Refactor to use AppServicesTag
- [ ] **organizations.store.svelte.ts** - Refactor to use AppServicesTag
- [ ] **mediumsOfExchange.store.svelte.ts** - Refactor to use AppServicesTag
- [ ] **hrea.store.svelte.ts** - Refactor to use AppServicesTag

### PHASE 3: Store Initialization Updates (8 stores)
- [ ] **users store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`
- [ ] **administration store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`  
- [ ] **offers store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`
- [ ] **requests store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`
- [ ] **serviceTypes store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`
- [ ] **organizations store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`
- [ ] **mediumsOfExchange store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`
- [ ] **hrea store** - Replace multiple `E.provide()` with `E.provide(createAppRuntime())`

### PHASE 4: Service Access Updates
- [ ] **Update service access patterns** - Change `yield* UsersServiceTag` to `const { users } = yield* AppServicesTag`
- [ ] **Update components** to use AppServicesTag (if any use services directly)
- [ ] **Update composables** to use AppServicesTag (if any use services directly)

### PHASE 5: Testing & Validation  
- [ ] **Simplify test setups** - Use centralized AppServicesTag mocking
- [ ] **Verify all functionality** works correctly after refactoring
- [ ] **Run all tests** to ensure no regressions

**TOTAL EFFORT**: ~25 lines new code + 1 line change + systematic refactoring of 8 stores

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
