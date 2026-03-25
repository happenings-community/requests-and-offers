# Testing: Organization & Best Practices

## File Structure

```
tests/sweettest/
├── src/common/                  # Shared helpers (conductors, fixtures, mirrors)
│   ├── conductors.rs
│   ├── fixtures.rs
│   └── mirrors.rs
└── tests/                       # Test files per domain
    ├── service_types.rs
    ├── requests.rs
    ├── offers.rs
    ├── organizations.rs
    ├── mediums_of_exchange.rs
    ├── administration/
    └── users.rs
ui/tests/
├── unit/                        # Frontend unit tests
│   ├── services/
│   ├── stores/
│   ├── components/
│   └── utils/
└── integration/                 # Frontend integration tests
    ├── workflows/
    ├── pages/
    └── features/
```

## Utilities & Helpers

```ts
export const createMockServiceLayer = (overrides = {}) => {
  return Layer.succeed(ServiceTypeService, {
    getAllServiceTypes: Effect.succeed([]),
    createServiceType: Effect.succeed(mockServiceType),
    updateServiceType: Effect.succeed(mockServiceType),
    deleteServiceType: Effect.succeed(true),
    ...overrides,
  });
};

export const createMockStore = () => {
  return Effect.runSync(
    createServiceTypesStore().pipe(Effect.provide(createMockServiceLayer())),
  );
};

export const waitForStoreUpdate = async (store: any, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    const unsubscribe = store.subscribe(() => {
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
};
```

## Test Data Management

```ts
export const createMockServiceType = (overrides = {}): ServiceType => ({
  name: "Test Service",
  description: "Test description",
  tags: ["test"],
  created_at: new Date(),
  ...overrides,
});

export const createMockUIServiceType = (overrides = {}): UIServiceType => ({
  ...createMockServiceType(),
  id: "test-id",
  displayName: "Test Service",
  isEditable: true,
  ...overrides,
});

export const buildServiceTypeScenario = {
  withValidData: () =>
    createMockServiceType({ name: "Web Development", tags: ["web", "development"] }),
  withInvalidData: () =>
    createMockServiceType({ name: "", tags: [] }),
  withManyTags: () =>
    createMockServiceType({ tags: Array.from({ length: 15 }, (_, i) => `tag${i}`) }),
};
```

## Guidelines

- Keep unit tests fast and isolated
- Prefer testing behavior over implementation details
- Use helpers for repeatable patterns
- Minimize flakiness with stable selectors and controlled async
- Use integration tests for critical cross-component flows; few E2E
