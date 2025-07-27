# Testing Guide

Comprehensive testing strategy for the Requests & Offers application covering all layers of the 7-layer Effect-TS architecture.

## Testing Architecture

### Testing Stack
- **Backend**: Rust unit tests + Tryorama multi-agent tests
- **Frontend**: Vitest + @effect/vitest for Effect-TS testing
- **E2E**: Playwright with Holochain integration
- **Coverage**: All 268 unit tests passing with no unhandled Effect errors

### Testing Philosophy
- **Layer-Specific**: Each layer tested independently
- **Effect-TS Integration**: Proper testing of Effect operations with dependency injection
- **Mock Implementations**: Consistent mocking strategies across all domains
- **Error Boundary Testing**: Comprehensive testing of tagged error handling

## Frontend Testing

### Unit Testing

#### Testing Effect-TS Services

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Effect, Layer } from 'effect';
import { ServiceTypeService, makeServiceTypeService } from '$lib/services';
import { HolochainClientService } from '$lib/services';

describe('ServiceTypeService', () => {
  it('should create service type with proper error handling', async () => {
    const MockHolochainClient = Layer.succeed(HolochainClientService, {
      callZome: () => Effect.succeed(mockRecord)
    });

    const TestServiceTypeServiceLive = Layer.provide(
      ServiceTypeServiceLive,
      MockHolochainClient
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ServiceTypeService;
        return yield* service.createServiceType(mockInput);
      }).pipe(Effect.provide(TestServiceTypeServiceLive))
    );

    expect(result.name).toBe(mockInput.name);
  });
});
```

#### Testing Store Helper Functions

```typescript
describe('ServiceTypes Store - Helper Functions', () => {
  let store: ReturnType<typeof createServiceTypesStore>;
  
  beforeEach(() => {
    store = createServiceTypesStore();
  });

  it('should implement all 9 helper functions', () => {
    expect(typeof store.createUIEntity).toBe('function');
    expect(typeof store.mapRecordsToUIEntities).toBe('function');
    expect(typeof store.syncEntityWithCache).toBe('function');
    expect(typeof store.eventEmitters).toBe('object');
    expect(typeof store.fetchEntities).toBe('object'); // Effect object
    expect(typeof store.createEntity).toBe('function');
    expect(typeof store.updateEntity).toBe('function');
    expect(typeof store.updateEntityStatus).toBe('function');
    expect(typeof store.processMultipleRecordCollections).toBe('function');
  });

  it('should create UI entity correctly', () => {
    const mockRecord = createMockRecord();
    const entity = store.createUIEntity(mockRecord);
    
    expect(entity).toBeDefined();
    expect(entity?.hash).toBe(mockRecord.signed_action.hashed.hash);
    expect(entity?.name).toBe('Test Service Type');
  });

  it('should map records to UI entities with null safety', () => {
    const mockRecords = [createMockRecord(), createInvalidRecord()];
    const entities = store.mapRecordsToUIEntities(mockRecords);
    
    expect(entities).toHaveLength(1); // Invalid record filtered out
    expect(entities[0].name).toBe('Test Service Type');
  });
});
```

#### Testing Composables

```typescript
describe('useServiceTypesManagement', () => {
  it('should provide proper error boundaries', () => {
    const { loadingErrorBoundary, createErrorBoundary } = useServiceTypesManagement();
    
    expect(loadingErrorBoundary.state.error).toBeNull();
    expect(createErrorBoundary.state.error).toBeNull();
    expect(typeof loadingErrorBoundary.execute).toBe('function');
    expect(typeof createErrorBoundary.clearError).toBe('function');
  });

  it('should handle entity creation with error boundaries', async () => {
    const { operations, createErrorBoundary } = useServiceTypesManagement();
    
    const mockInput = { name: 'Test', description: 'Test Description' };
    await operations.createEntity(mockInput);
    
    expect(createErrorBoundary.state.error).toBeNull();
  });
});
```

### Integration Testing

#### Component Integration

```typescript
// tests/integration/components/ServiceTypeGrid.test.ts
import { render, fireEvent } from '@testing-library/svelte';
import ServiceTypeGrid from '$lib/components/service-types/ServiceTypeGrid.svelte';

describe('ServiceTypeGrid Integration', () => {
  it('should load and display service types', async () => {
    const { getByText, findByText } = render(ServiceTypeGrid);
    
    // Wait for data to load
    await findByText('Test Service Type');
    
    expect(getByText('Test Service Type')).toBeInTheDocument();
  });

  it('should handle create operation', async () => {
    const { getByText, getByLabelText } = render(ServiceTypeGrid);
    
    // Trigger create form
    fireEvent.click(getByText('Create Service Type'));
    
    // Fill form
    fireEvent.input(getByLabelText('Name'), { target: { value: 'New Service' } });
    fireEvent.input(getByLabelText('Description'), { target: { value: 'Description' } });
    
    // Submit
    fireEvent.click(getByText('Create'));
    
    // Verify creation
    await findByText('New Service');
  });
});
```

### E2E Testing

#### Playwright with Holochain

```typescript
// tests/e2e/service-types.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Service Types E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Setup Holochain environment
    await page.goto('http://localhost:5173');
    await page.waitForSelector('[data-testid="app-loaded"]');
  });

  test('should create and approve service type', async ({ page }) => {
    // Navigate to service types
    await page.click('text=Service Types');
    
    // Create new service type
    await page.click('text=Create Service Type');
    await page.fill('[data-testid="name-input"]', 'E2E Test Service');
    await page.fill('[data-testid="description-input"]', 'E2E test description');
    await page.click('[data-testid="create-button"]');
    
    // Verify creation
    await expect(page.locator('text=E2E Test Service')).toBeVisible();
    await expect(page.locator('text=Pending')).toBeVisible();
    
    // Approve service type (as admin)
    await page.click('[data-testid="approve-button"]');
    await expect(page.locator('text=Approved')).toBeVisible();
  });

  test('should handle cross-domain interactions', async ({ page }) => {
    // Create service type
    await page.goto('/service-types');
    await page.click('text=Create Service Type');
    // ... creation steps
    
    // Create request using service type
    await page.goto('/requests');
    await page.click('text=Create Request');
    await page.selectOption('[data-testid="service-type-select"]', 'E2E Test Service');
    // ... complete request creation
    
    // Verify service type appears in request
    await expect(page.locator('text=E2E Test Service')).toBeVisible();
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

### Tryorama Multi-Agent Tests

```typescript
// tests/service-types.test.ts
import { Scenario, runScenario } from '@holochain/tryorama';

runScenario('Service Types Multi-Agent Tests', async (scenario: Scenario) => {
  const { alice, bob } = await scenario.addPlayersWithApps([
    { appBundleSource: { path: './workdir/requests_and_offers.happ' } },
    { appBundleSource: { path: './workdir/requests_and_offers.happ' } }
  ]);

  // Alice creates a service type
  const createInput = {
    name: 'Web Development',
    description: 'Frontend and backend web development',
    tags: ['web', 'development']
  };

  const aliceServiceType = await alice.cells[0].callZome({
    zome_name: 'service_types',
    fn_name: 'create_service_type',
    payload: createInput
  });

  // Bob should see Alice's service type
  const bobServiceTypes = await bob.cells[0].callZome({
    zome_name: 'service_types',
    fn_name: 'get_all_service_types',
    payload: null
  });

  scenario.assert(bobServiceTypes.length === 1);
  scenario.assert(bobServiceTypes[0].entry.name === 'Web Development');
});

runScenario('Service Type Approval Workflow', async (scenario: Scenario) => {
  const { admin, user } = await scenario.addPlayersWithApps([
    { appBundleSource: { path: './workdir/requests_and_offers.happ' } },
    { appBundleSource: { path: './workdir/requests_and_offers.happ' } }
  ]);

  // User creates service type
  const userServiceType = await user.cells[0].callZome({
    zome_name: 'service_types',
    fn_name: 'create_service_type',
    payload: { name: 'Design', description: 'UI/UX Design', tags: ['design'] }
  });

  // Admin approves service type
  const approvedServiceType = await admin.cells[0].callZome({
    zome_name: 'service_types',
    fn_name: 'approve_service_type',
    payload: userServiceType.signed_action.hashed.hash
  });

  scenario.assert(approvedServiceType.entry.status === 'Approved');
});
```

## Testing Utilities

### Mock Data Factories

```typescript
// tests/utils/factories.ts
export function createMockRecord(): Record {
  return {
    signed_action: {
      hashed: {
        hash: 'test-hash-123',
        content: {
          timestamp: Date.now() * 1000
        }
      }
    },
    entry: {
      Present: {
        name: 'Test Service Type',
        description: 'Test Description',
        status: 'pending'
      }
    }
  } as any;
}

export function createMockUIServiceType(): UIServiceType {
  return {
    hash: 'test-hash-123',
    name: 'Test Service Type',
    description: 'Test Description',
    status: 'pending',
    tags: ['test'],
    createdAt: new Date()
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
    rejectServiceType: vi.fn().mockResolvedValue(createMockUIServiceType())
  };
}
```

### Effect-TS Test Utilities

```typescript
// tests/utils/effect-helpers.ts
import { Effect, Layer } from 'effect';

export function createMockLayer<T>(tag: any, implementation: T) {
  return Layer.succeed(tag, implementation);
}

export async function runEffectTest<T, E>(
  effect: Effect.Effect<T, E>,
  layers: Layer.Layer<any, any, any>[] = []
) {
  const combinedLayers = layers.reduce((acc, layer) => Layer.merge(acc, layer));
  return await Effect.runPromise(effect.pipe(Effect.provide(combinedLayers)));
}

export function expectEffectToSucceed<T, E>(
  effect: Effect.Effect<T, E>,
  layers: Layer.Layer<any, any, any>[] = []
) {
  return expect(runEffectTest(effect, layers)).resolves;
}

export function expectEffectToFail<T, E>(
  effect: Effect.Effect<T, E>,
  layers: Layer.Layer<any, any, any>[] = []
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

# Backend Tryorama tests
cd tests && bun test
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/']
    }
  }
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
- **✅ All 268 unit tests passing** with no unhandled Effect errors
- **Backend**: Comprehensive Tryorama coverage for all domains
- **Frontend**: Unit and integration tests for all standardized domains
- **E2E**: Basic coverage with Playwright + Holochain integration

### Target Coverage
- **Unit Tests**: >90% code coverage
- **Integration Tests**: All critical user workflows
- **E2E Tests**: Core user journeys across all domains
- **Error Boundary Tests**: All error scenarios and recovery paths

This testing strategy ensures robust quality assurance across all layers of the 7-layer Effect-TS architecture.