# Application Runtime (Effect TS)

This document describes the current, production-ready runtime and dependency injection pattern used across the app. It reflects the present state of the codebase and omits migration history.

## Overview

- The application uses Effect TS for dependency injection (DI).
- All domain services are aggregated under a single context tag, `AppServicesTag`.
- A single runtime layer, created by `createAppRuntime()`, provides every service at once, so all modules can depend on `AppServicesTag` instead of per-service tags.

## Runtime Modules

- File: `ui/src/lib/runtime/app-runtime.ts`

### AppServices

```ts
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

- All services above are available through a single context tag:

```ts
export class AppServicesTag extends Context.Tag('AppServices')<AppServicesTag, AppServices>() {}
```

### AppServicesLive

- A layer that combines every live service implementation and exposes the aggregated `AppServices` via `AppServicesTag`.
- This is the single source of truth for service provisioning across the app.

### createAppRuntime()

- Returns an Effect `Layer` that provides all application services and structured logging in one go.
- Usage of resource-management layering is optional and can be reintroduced when needed.

```ts
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
    AppServicesLive
  );

  // Structured logging
  const enhancedRuntime = Layer.merge(serviceLayer, createApplicationLogger(config.logging));
  return enhancedRuntime;
};
```

### Helpers

- `initializeApplication(...)`: optional bootstrap with connection checks and logs.
- `withAppServices(program)`: convenience to run a program with the runtime.

## Store DI Pattern (Current)

- Every store factory depends on `AppServicesTag | CacheServiceTag` only.
- Store initialization provides the runtime once at the bottom of the file.

### Factory signature

```ts
export const createXxxStore = (): E.Effect<
  XxxStore,
  never,
  AppServicesTag | CacheServiceTag
> =>
  E.gen(function* () {
    const { xxx: xxxService } = yield* AppServicesTag; // destructure the needed service
    const cacheService = yield* CacheServiceTag;

    // ... store implementation
  });
```

### Store initialization

```ts
const xxxStore: XxxStore = pipe(
  createXxxStore(),
  E.provide(createAppRuntime()),  // one place to provide all services
  E.provide(CacheServiceLive),    // cache remains separate
  E.runSync
);
```

## Cache Lookup Guidance

- Define cache lookup functions inside the store factory after destructuring the service. This ensures no Effect environment (R) leaks from module scope and keeps the function signature as `Effect<..., ..., never>`.

```ts
const { serviceTypes: serviceTypesService } = yield* AppServicesTag;

const serviceTypeCacheLookup = (key: string): E.Effect<UIServiceType, CacheNotFoundError, never> =>
  pipe(
    E.try({
      try: () => decodeHashFromBase64(key),
      catch: () => new CacheNotFoundError({ key })
    }),
    E.flatMap((hash) =>
      pipe(
        serviceTypesService.getServiceType(hash),
        E.flatMap((record) =>
          record
            ? serviceTypesService.getServiceTypeStatus(hash).pipe(
                E.map((status) => createUIServiceType(record, { status } as any)),
                E.flatMap((entity) => (entity ? E.succeed(entity) : E.fail(new CacheNotFoundError({ key }))))
              )
            : E.fail(new CacheNotFoundError({ key }))
        )
      )
    )
  );
```

## Cross-Store Interactions

- Prefer calling domain services via `AppServicesTag` instead of using other stores inside a store.
- If a cross-store call is still required temporarily and introduces an environment requirement, localize it with `E.provide(createAppRuntime())` around that sub-effect to keep the outer method’s `R=never`.

## Components/Composables

- Access services via `AppServicesTag` inside your Effect program and run them with the runtime provided.

```ts
const program = E.gen(function* () {
  const { users, administration } = yield* AppServicesTag;
  const user = yield* users.getLatestUser(someHash);
  const isAdmin = yield* administration.checkIfAgentIsAdministrator();
  return { user, isAdmin };
});

const result = E.runPromise(withAppServices(program));
```

## Testing

- Mock all services at once by providing a mock `AppServices` object.

```ts
const mocks: AppServices = {
  holochainClient: mockHolochain,
  hrea: mockHrea,
  users: mockUsers,
  administration: mockAdmin,
  offers: mockOffers,
  requests: mockRequests,
  serviceTypes: mockServiceTypes,
  organizations: mockOrgs,
  mediumsOfExchange: mockMoe
};

const testProgram = pipe(
  effectUnderTest,
  E.provideService(AppServicesTag, mocks),
  E.provide(CacheServiceLive)
);
```

## Troubleshooting

- __R=unknown or ‘never’ mismatch__
  - Cause: a sub-effect still requires an environment (e.g., another store or service tag) that isn’t discharged.
  - Fix: ensure the factory uses `AppServicesTag` (no per-service tags), and if a cross-store call is still necessary, localize `E.provide(createAppRuntime())` around that specific sub-effect.

- __Cache lookup env leaks__
  - Cause: cache lookup defined at module scope with tag access.
  - Fix: move the lookup inside the factory and close over the service instance.

## Key Takeaways

- Use `AppServicesTag` for all service access in factories.
- Provide `createAppRuntime()` once per store module (in initialization).
- Keep cache lookups inside factories.
- Prefer services over cross-store calls. Localize env provisioning only as a temporary bridge.
