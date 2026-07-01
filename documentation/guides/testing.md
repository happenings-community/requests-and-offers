# Testing Guide

Comprehensive testing strategy for the Requests & Offers application covering all layers of the 7-layer Effect-TS architecture.

## Testing Architecture

### Testing Stack

- **Backend**: Rust unit tests + Sweettest multi-agent tests
- **Frontend**: Vitest + @effect/vitest for Effect-TS testing
- **E2E**: Playwright with Holochain integration
- **Coverage**: All 343 unit tests passing across 20 test files with no unhandled Effect errors

### Testing Philosophy

- **Layer-Specific**: Each layer tested independently
- **Effect-TS Integration**: Proper testing of Effect operations with dependency injection
- **Mock Implementations**: Consistent mocking strategies across all domains
- **Error Boundary Testing**: Comprehensive testing of tagged error handling

## Frontend Testing

### Unit Testing

#### Testing Effect-TS Services

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { Effect, Layer } from "effect";
import { ServiceTypeService, makeServiceTypeService } from "$lib/services";
import { HolochainClientService } from "$lib/services";

describe("ServiceTypeService", () => {
  it("should create service type with proper error handling", async () => {
    const MockHolochainClient = Layer.succeed(HolochainClientService, {
      callZome: () => Effect.succeed(mockRecord),
    });

    const TestServiceTypeServiceLive = Layer.provide(
      ServiceTypeServiceLive,
      MockHolochainClient,
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ServiceTypeService;
        return yield* service.createServiceType(mockInput);
      }).pipe(Effect.provide(TestServiceTypeServiceLive)),
    );

    expect(result.name).toBe(mockInput.name);
  });
});
```

#### Testing Store Helper Functions

```typescript
describe("ServiceTypes Store - Helper Functions", () => {
  let store: ReturnType<typeof createServiceTypesStore>;

  beforeEach(() => {
    store = createServiceTypesStore();
  });

  it("should implement all 9 helper functions", () => {
    expect(typeof store.createUIEntity).toBe("function");
    expect(typeof store.mapRecordsToUIEntities).toBe("function");
    expect(typeof store.syncEntityWithCache).toBe("function");
    expect(typeof store.eventEmitters).toBe("object");
    expect(typeof store.fetchEntities).toBe("object"); // Effect object
    expect(typeof store.createEntity).toBe("function");
    expect(typeof store.updateEntity).toBe("function");
    expect(typeof store.updateEntityStatus).toBe("function");
    expect(typeof store.processMultipleRecordCollections).toBe("function");
  });

  it("should create UI entity correctly", () => {
    const mockRecord = createMockRecord();
    const entity = store.createUIEntity(mockRecord);

    expect(entity).toBeDefined();
    expect(entity?.hash).toBe(mockRecord.signed_action.hashed.hash);
    expect(entity?.name).toBe("Test Service Type");
  });

  it("should map records to UI entities with null safety", () => {
    const mockRecords = [createMockRecord(), createInvalidRecord()];
    const entities = store.mapRecordsToUIEntities(mockRecords);

    expect(entities).toHaveLength(1); // Invalid record filtered out
    expect(entities[0].name).toBe("Test Service Type");
  });
});
```

#### Testing Composables

```typescript
describe("useServiceTypesManagement", () => {
  it("should provide proper error boundaries", () => {
    const { loadingErrorBoundary, createErrorBoundary } =
      useServiceTypesManagement();

    expect(loadingErrorBoundary.state.error).toBeNull();
    expect(createErrorBoundary.state.error).toBeNull();
    expect(typeof loadingErrorBoundary.execute).toBe("function");
    expect(typeof createErrorBoundary.clearError).toBe("function");
  });

  it("should handle entity creation with error boundaries", async () => {
    const { operations, createErrorBoundary } = useServiceTypesManagement();

    const mockInput = { name: "Test", description: "Test Description" };
    await operations.createEntity(mockInput);

    expect(createErrorBoundary.state.error).toBeNull();
  });
});
```

### Integration Testing

#### Component Integration

```typescript
// tests/integration/components/ServiceTypeGrid.test.ts
import { render, fireEvent } from "@testing-library/svelte";
import ServiceTypeGrid from "$lib/components/service-types/ServiceTypeGrid.svelte";

describe("ServiceTypeGrid Integration", () => {
  it("should load and display service types", async () => {
    const { getByText, findByText } = render(ServiceTypeGrid);

    // Wait for data to load
    await findByText("Test Service Type");

    expect(getByText("Test Service Type")).toBeInTheDocument();
  });

  it("should handle create operation", async () => {
    const { getByText, getByLabelText } = render(ServiceTypeGrid);

    // Trigger create form
    fireEvent.click(getByText("Create Service Type"));

    // Fill form
    fireEvent.input(getByLabelText("Name"), {
      target: { value: "New Service" },
    });
    fireEvent.input(getByLabelText("Description"), {
      target: { value: "Description" },
    });

    // Submit
    fireEvent.click(getByText("Create"));

    // Verify creation
    await findByText("New Service");
  });
});
```

### E2E Testing

The e2e test suite uses Playwright against a real Holochain conductor. Tests run against a single-agent sandbox, which is sufficient for UI verification and basic zome integration.

The suite is intentionally lean — three spec files, each seeding its own agent via direct zome calls rather than relying on shared fixture data:

- `user-registration-flow.spec.ts` — connects to the conductor, creates a profile via `callZome`, and verifies it renders in the UI.
- `offer-request-flow.spec.ts` — seeds an approved profile and a service type, then drives the real `/offers/create` and `/requests/create` forms and confirms both listings show the new entry.
- `admin-management.spec.ts` — the first user auto-registers as network administrator (dev-mode bootstrap); seeds a service type and a medium of exchange via `callZome` and confirms both appear on their admin list pages.

#### Prerequisites

```bash
# Must be inside the Nix shell
nix develop

# Build the hApp before the first run, or after any zome change
bun build:happ
```

#### Running E2E Tests

```bash
# From ui/ directory, inside nix develop
bun test:e2e:smoke     # user-registration-flow spec only — fastest feedback
bun test:e2e:offers    # offer-request-flow spec only
bun test:e2e:admin     # admin-management spec only
bun test:e2e:verbose   # full suite with conductor stderr visible
```

Set `E2E_VERBOSE=true` to stream conductor stderr to the terminal for startup debugging. If the Vite dev server is already running (`bun start`), tests reuse it automatically.

#### How It Works

The test infrastructure owns the full conductor lifecycle via `tests/setup/conductor-manager.ts`:

1. **Global setup** — generates a Holochain sandbox in `test-e2e-workdir/`, patches the conductor config to a fixed admin port (55000), starts the conductor, installs the hApp via `AdminWebsocket`, attaches an app interface on a dynamic port, and issues an authentication token.
2. **Environment handoff** — app port and base64-encoded token are written to `.test-env.json` and injected into `process.env` (`HC_APP_PORT`, `HC_APP_TOKEN`) for all test workers.
3. **Test helpers** — `tests/e2e/utils/e2e-helpers.ts` exposes:
   - `holochainUrl(path)` — builds the full URL including `?hcPort=&hcToken=` params that `HolochainClientService` reads to connect (mirrors what `hc-spin` injects)
   - `gotoApp(page, path)` — navigates and waits for the connection indicator to clear
   - `createTestClient()` — opens an `AppWebsocket` with the **same token as the browser**, so zome calls from test code are visible in the UI immediately (same agent, no DHT gossip delay)
   - `callZome(client, zome, fn, payload)` — typed zome call helper for test data seeding
4. **Global teardown** — stops the conductor and removes `test-e2e-workdir/`.

#### Writing E2E Tests

Always use `gotoApp` rather than `page.goto` directly — it injects the Holochain connection params automatically:

```typescript
import { test, expect } from '@playwright/test';
import { gotoApp, createTestClient, callZome } from '../utils/e2e-helpers.js';

test.describe('My feature', () => {
  test('should display seeded data', async ({ page }) => {
    const client = await createTestClient();
    await callZome(client, 'my_zome', 'create_entry', { name: 'Test' });

    await gotoApp(page, '/my-route');
    await expect(page.locator('text=Test')).toBeVisible();

    await client.close();
  });
});
```

## Backend Testing

### Zome Unit Tests

```rust
// dnas/requests_and_offers/zomes/coordinator/service_types/src/tests.rs
#[cfg(test)]
mod tests {
    use super::*;
    use hdk::prelude::*;

    #[test]
    fn test_create_service_type() {
        let input = CreateServiceTypeInput {
            name: "Test Service".to_string(),
            description: "Test Description".to_string(),
            tags: vec!["test".to_string()],
        };

        let result = create_service_type(input);
        assert!(result.is_ok());

        let record = result.unwrap();
        let service_type: ServiceType = record.entry().to_app_option().unwrap().unwrap();
        assert_eq!(service_type.name, "Test Service");
        assert_eq!(service_type.status, ServiceTypeStatus::Pending);
    }

    #[test]
    fn test_approve_service_type() {
        // Create service type first
        let create_input = CreateServiceTypeInput {
            name: "Test Service".to_string(),
            description: "Test Description".to_string(),
            tags: vec!["test".to_string()],
        };

        let create_result = create_service_type(create_input).unwrap();
        let service_type_hash = create_result.signed_action.hashed.hash.clone();

        // Approve it
        let approve_result = approve_service_type(service_type_hash);
        assert!(approve_result.is_ok());

        let updated_record = approve_result.unwrap();
        let updated_service_type: ServiceType = updated_record.entry().to_app_option().unwrap().unwrap();
        assert_eq!(updated_service_type.status, ServiceTypeStatus::Approved);
    }
}
```

### Sweettest Multi-Agent Tests

```rust
// tests/sweettest/tests/service_types.rs
use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_service_type_crud_operations() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Alice is auto-registered as admin via progenitor init callback
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Alice creates a service type (admin-only; auto-approved)
    let st_record: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Web Development"),
        )
        .await;

    let st_hash = st_record.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob reads the service type
    let st_from_bob: Option<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_service_type", st_hash.clone())
        .await;
    assert!(st_from_bob.is_some());

    let st: ServiceType = st_from_bob
        .unwrap()
        .entry()
        .to_app_option()
        .unwrap()
        .expect("entry");
    assert_eq!(st.name, "Web Development");

    // Get all approved service types
    let all_types: Vec<Record> = conductors[0]
        .call(&alice.zome("service_types"), "get_approved_service_types", ())
        .await;
    assert!(!all_types.is_empty());
}
```

## Testing Utilities

### Mock Data Factories

```typescript
// tests/utils/factories.ts
export function createMockRecord(): Record {
  return {
    signed_action: {
      hashed: {
        hash: "test-hash-123",
        content: {
          timestamp: Date.now() * 1000,
        },
      },
    },
    entry: {
      Present: {
        name: "Test Service Type",
        description: "Test Description",
        status: "pending",
      },
    },
  } as any;
}

export function createMockUIServiceType(): UIServiceType {
  return {
    hash: "test-hash-123",
    name: "Test Service Type",
    description: "Test Description",
    status: "pending",
    tags: ["test"],
    createdAt: new Date(),
  };
}

export function createMockServiceTypeService() {
  return {
    createServiceType: vi.fn().mockResolvedValue(createMockUIServiceType()),
    getAllServiceTypes: vi.fn().mockResolvedValue([createMockUIServiceType()]),
    getServiceType: vi.fn().mockResolvedValue(createMockUIServiceType()),
    updateServiceType: vi.fn().mockResolvedValue(createMockUIServiceType()),
    deleteServiceType: vi.fn().mockResolvedValue(undefined),
    approveServiceType: vi.fn().mockResolvedValue(createMockUIServiceType()),
    rejectServiceType: vi.fn().mockResolvedValue(createMockUIServiceType()),
  };
}
```

### Effect-TS Test Utilities

```typescript
// tests/utils/effect-helpers.ts
import { Effect, Layer } from "effect";

export function createMockLayer<T>(tag: any, implementation: T) {
  return Layer.succeed(tag, implementation);
}

export async function runEffectTest<T, E>(
  effect: Effect.Effect<T, E>,
  layers: Layer.Layer<any, any, any>[] = [],
) {
  const combinedLayers = layers.reduce((acc, layer) => Layer.merge(acc, layer));
  return await Effect.runPromise(effect.pipe(Effect.provide(combinedLayers)));
}

export function expectEffectToSucceed<T, E>(
  effect: Effect.Effect<T, E>,
  layers: Layer.Layer<any, any, any>[] = [],
) {
  return expect(runEffectTest(effect, layers)).resolves;
}

export function expectEffectToFail<T, E>(
  effect: Effect.Effect<T, E>,
  layers: Layer.Layer<any, any, any>[] = [],
) {
  return expect(runEffectTest(effect, layers)).rejects;
}
```

## Test Commands

### Running Tests

```bash
# All tests
bun test

# Frontend only
bun test:ui

# Unit tests (requires Nix for hREA integration)
nix develop --command bun test:unit

# Integration tests
cd ui && bun test:integration

# E2E tests
cd ui && bun test:e2e
cd ui && bun test:e2e:holochain

# Domain-specific tests
bun test:service-types
bun test:requests
bun test:offers
bun test:users
bun test:organizations
bun test:administration

# Backend Sweettest tests (requires Nix)
nix develop --command cargo test --manifest-path tests/sweettest/Cargo.toml
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "tests/"],
    },
  },
});
```

## Testing Best Practices

### Do's ✅

- **Test all 9 helper functions** for every domain store
- **Use Effect-TS testing patterns** with proper dependency injection
- **Test error boundaries** and error handling paths
- **Mock external dependencies** consistently
- **Test cross-domain interactions** in integration tests
- **Use domain-specific test data** that reflects real usage
- **Test both happy path and error cases**

### Don'ts ❌

- **Skip testing helper functions** - they're critical for consistency
- **Mix testing patterns** - use Effect-TS patterns consistently
- **Test implementation details** - focus on behavior
- **Ignore error cases** - test error boundaries thoroughly
- **Skip integration tests** - they catch real-world issues
- **Use production data** - always use controlled test data

## Coverage Goals

### Current Status

- **✅ All 343 unit tests passing** across 20 test files with no unhandled Effect errors
- **Backend**: Comprehensive Sweettest coverage for all domains
- **Frontend**: Unit and integration tests for all standardized domains
- **E2E**: Basic coverage with Playwright + Holochain integration

### Target Coverage

- **Unit Tests**: >90% code coverage
- **Integration Tests**: All critical user workflows
- **E2E Tests**: Core user journeys across all domains
- **Error Boundary Tests**: All error scenarios and recovery paths

This testing strategy ensures robust quality assurance across all layers of the 7-layer Effect-TS architecture.
