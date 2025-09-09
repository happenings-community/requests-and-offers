# Testing Framework

Comprehensive testing strategy covering all testing layers and methodologies across the application stack.

## Testing Architecture Overview

The project implements a **3-Layer Testing Strategy**:

1. **Backend Integration Tests** (`tests/`) - Holochain zome testing with Tryorama
2. **Frontend Unit Tests** (`ui/tests/unit/`) - Isolated component and service testing
3. **Frontend Integration Tests** (`ui/tests/integration/`) - Cross-component UI flow testing

## Core Testing Philosophy

### Test-Driven Quality Assurance

- **Focus on Public APIs**: Test behavior from consumer perspective, not implementation details
- **Isolation**: Tests should be independent with no external dependencies
- **Predictability**: Consistent results on every run
- **Fast Feedback**: Quick test execution for rapid development cycles

### Testing Pyramid Strategy

```
    E2E Tests (Few)
   ▲ Slow, Expensive, Brittle
  ▲ ▲ Integration Tests (Some)
 ▲ ▲ ▲ Fast, Reliable, Focused
Unit Tests (Many)
```

1. **Many Unit Tests**: Fast, focused, testing individual components
2. **Some Integration Tests**: Testing component interactions and workflows
3. **Few E2E Tests**: Critical user journeys and system validation

## Backend Testing with Tryorama

### Holochain Multi-Agent Testing

```rust
// Tryorama test pattern for zome functionality
#[tokio::test(flavor = "multi_thread")]
async fn test_service_type_workflow() -> anyhow::Result<()> {
    let (conductor, _agent, cell) = setup_conductor_test().await?;

    // Test data setup
    let service_type_input = CreateServiceTypeInput {
        name: "Test Service".to_string(),
        description: Some("Test description".to_string()),
        tags: vec!["test".to_string(), "service".to_string()],
    };

    // Test service type creation
    let service_type_hash: ActionHash = conductor
        .call(
            &cell.zome("service_types_coordinator"),
            "create_service_type",
            service_type_input.clone(),
        )
        .await?;

    // Verify creation
    assert!(!service_type_hash.get_raw_39().is_empty());

    // Test retrieval
    let retrieved_service_type: Option<Record> = conductor
        .call(
            &cell.zome("service_types_coordinator"),
            "get_service_type",
            service_type_hash.clone(),
        )
        .await?;

    // Assertions
    assert!(retrieved_service_type.is_some());
    let record = retrieved_service_type.unwrap();
    let entry: ServiceType = record.entry().try_into()?;
    assert_eq!(entry.name, service_type_input.name);
    assert_eq!(entry.description, service_type_input.description);
    assert_eq!(entry.tags, service_type_input.tags);

    Ok(())
}
```

### Multi-Agent Scenarios

```rust
// Testing cross-agent interactions
#[tokio::test(flavor = "multi_thread")]
async fn test_multi_agent_service_types() -> anyhow::Result<()> {
    let (conductor, agent1, agent2) = setup_multi_agent_test(2).await?;

    // Agent 1 creates service type
    let service_type_hash = create_service_type_as_agent(&conductor, &agent1,
        "Shared Service", "Available to all agents").await?;

    // Agent 2 should be able to retrieve it
    let retrieved = get_service_type_as_agent(&conductor, &agent2, service_type_hash).await?;
    assert!(retrieved.is_some());

    // Test DHT synchronization
    wait_for_integration(&conductor, Duration::from_secs(5)).await?;

    // Both agents should see all service types
    let all_types_agent1 = get_all_service_types_as_agent(&conductor, &agent1).await?;
    let all_types_agent2 = get_all_service_types_as_agent(&conductor, &agent2).await?;

    assert_eq!(all_types_agent1.len(), all_types_agent2.len());
    assert!(all_types_agent1.len() > 0);

    Ok(())
}
```

### Zome Testing Patterns

```rust
// Individual zome functionality testing
mod service_types_tests {
    use super::*;

    #[tokio::test]
    async fn test_create_service_type_validation() -> anyhow::Result<()> {
        let (conductor, _agent, cell) = setup_conductor_test().await?;

        // Test invalid input (empty name)
        let invalid_input = CreateServiceTypeInput {
            name: "".to_string(),
            description: None,
            tags: vec![],
        };

        let result: Result<ActionHash, _> = conductor
            .call(
                &cell.zome("service_types_coordinator"),
                "create_service_type",
                invalid_input,
            )
            .await;

        // Should fail validation
        assert!(result.is_err());

        Ok(())
    }

    #[tokio::test]
    async fn test_service_type_tags_indexing() -> anyhow::Result<()> {
        let (conductor, _agent, cell) = setup_conductor_test().await?;

        // Create service types with tags
        let service_type1 = create_test_service_type(&conductor, &cell,
            "Service 1", vec!["web", "development"]).await?;
        let service_type2 = create_test_service_type(&conductor, &cell,
            "Service 2", vec!["web", "design"]).await?;

        // Test tag-based retrieval
        let web_services: Vec<ActionHash> = conductor
            .call(
                &cell.zome("service_types_coordinator"),
                "get_service_types_by_tag",
                "web".to_string(),
            )
            .await?;

        assert_eq!(web_services.len(), 2);
        assert!(web_services.contains(&service_type1));
        assert!(web_services.contains(&service_type2));

        Ok(())
    }
}
```

## Frontend Unit Testing

### Effect-TS Service Testing

```typescript
// Unit testing Effect-TS services
import { describe, it, expect } from "vitest";
import { Effect, Layer, Context } from "effect";
import {
  ServiceTypeService,
  makeServiceTypeService,
} from "../services/serviceType.service";

describe("ServiceTypeService", () => {
  // Mock Holochain client
  const MockHolochainClient = Context.GenericTag<HolochainClientService>(
    "MockHolochainClient",
  );
  const mockClientLayer = Layer.succeed(MockHolochainClient, {
    callZome: Effect.succeed({
      action_hash: "test-hash",
      entry: {
        name: "Test Service",
        description: "Test description",
        tags: ["test"],
      },
      action: { timestamp: Date.now() },
    }),
  });

  const TestServiceLayer = makeServiceTypeService.pipe(
    Layer.provide(mockClientLayer),
  );

  it("should create service type successfully", async () => {
    const program = Effect.gen(function* () {
      const service = yield* ServiceTypeService;

      const input = {
        name: "Test Service",
        description: "Test description",
        tags: ["test"],
      };

      const result = yield* service.createServiceType(input);
      return result;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestServiceLayer)),
    );

    expect(result.name).toBe("Test Service");
    expect(result.tags).toContain("test");
  });

  it("should handle validation errors", async () => {
    const program = Effect.gen(function* () {
      const service = yield* ServiceTypeService;

      // Invalid input (empty name)
      const input = {
        name: "",
        description: "Test description",
        tags: ["test"],
      };

      return yield* service.createServiceType(input);
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(TestServiceLayer))),
    ).rejects.toThrow("Validation failed");
  });
});
```

### Svelte Store Testing

```typescript
// Testing Svelte stores with Effect integration
import { describe, it, expect, beforeEach } from "vitest";
import { createServiceTypesStore } from "../stores/serviceTypes.store";
import { Effect, Layer } from "effect";

describe("ServiceTypesStore", () => {
  let store: ReturnType<typeof createServiceTypesStore>;

  beforeEach(() => {
    // Create store with mock dependencies
    store = Effect.runSync(
      createServiceTypesStore().pipe(Effect.provide(MockServiceLayer)),
    );
  });

  it("should initialize with empty state", () => {
    expect(store.entities()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it("should fetch entities successfully", async () => {
    const fetchResult = await Effect.runPromise(
      store.fetchAll().pipe(Effect.provide(MockServiceLayer)),
    );

    expect(store.loading()).toBe(false);
    expect(store.entities().length).toBeGreaterThan(0);
    expect(store.error()).toBeNull();
  });

  it("should handle fetch errors", async () => {
    // Mock service to return error
    const errorService = Layer.succeed(ServiceTypeService, {
      getAllServiceTypes: Effect.fail(
        new ServiceTypeError({
          message: "Network error",
        }),
      ),
    });

    await expect(
      Effect.runPromise(store.fetchAll().pipe(Effect.provide(errorService))),
    ).rejects.toThrow("Network error");

    expect(store.error()).toBe("Network error");
    expect(store.loading()).toBe(false);
  });
});
```

### Component Testing with Testing Library

```typescript
// Component testing with user interactions
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect, vi } from "vitest";
import ServiceTypeForm from "../components/ServiceTypeForm.svelte";

describe("ServiceTypeForm", () => {
  const mockOnSubmit = vi.fn();

  it("should render form fields correctly", () => {
    render(ServiceTypeForm, {
      props: {
        onSubmit: mockOnSubmit,
        loading: false,
      },
    });

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
  });

  it("should validate required fields", async () => {
    render(ServiceTypeForm, {
      props: {
        onSubmit: mockOnSubmit,
        loading: false,
      },
    });

    const submitButton = screen.getByRole("button", { name: /create/i });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("should submit valid form data", async () => {
    render(ServiceTypeForm, {
      props: {
        onSubmit: mockOnSubmit,
        loading: false,
      },
    });

    const nameInput = screen.getByLabelText(/name/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const tagsInput = screen.getByLabelText(/tags/i);
    const submitButton = screen.getByRole("button", { name: /create/i });

    await fireEvent.input(nameInput, { target: { value: "Test Service" } });
    await fireEvent.input(descriptionInput, {
      target: { value: "Test description" },
    });
    await fireEvent.input(tagsInput, { target: { value: "test, service" } });
    await fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: "Test Service",
        description: "Test description",
        tags: ["test", "service"],
      });
    });
  });
});
```

## Integration Testing

### Cross-Component Integration

```typescript
// Testing component interactions and workflows
import { render, screen, fireEvent, waitFor } from "@testing-library/svelte";
import { describe, it, expect } from "vitest";
import ServiceTypesPage from "../routes/service-types/+page.svelte";

describe("ServiceTypes Integration", () => {
  it("should handle complete service type creation workflow", async () => {
    render(ServiceTypesPage);

    // Should show empty state initially
    expect(screen.getByText(/no service types found/i)).toBeInTheDocument();

    // Open creation form
    const createButton = screen.getByRole("button", {
      name: /create service type/i,
    });
    await fireEvent.click(createButton);

    // Fill and submit form
    const nameInput = screen.getByLabelText(/name/i);
    await fireEvent.input(nameInput, { target: { value: "Web Development" } });

    const submitButton = screen.getByRole("button", { name: /create/i });
    await fireEvent.click(submitButton);

    // Should show success state and new item
    await waitFor(() => {
      expect(screen.getByText("Web Development")).toBeInTheDocument();
    });

    // Should close form and return to list
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });

  it("should handle error states gracefully", async () => {
    // Mock network error
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

    render(ServiceTypesPage);

    const createButton = screen.getByRole("button", {
      name: /create service type/i,
    });
    await fireEvent.click(createButton);

    const nameInput = screen.getByLabelText(/name/i);
    await fireEvent.input(nameInput, { target: { value: "Test Service" } });

    const submitButton = screen.getByRole("button", { name: /create/i });
    await fireEvent.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    // Form should remain open for retry
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });
});
```

## Test Organization and Best Practices

### Test File Structure

```
tests/
├── tryorama/                    # Backend integration tests
│   ├── service_types.test.rs
│   ├── requests.test.rs
│   ├── offers.test.rs
│   └── administration.test.rs
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

### Testing Utilities and Helpers

```typescript
// Shared testing utilities
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

### Test Data Management

```typescript
// Test data factories
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

// Test scenario builders
export const buildServiceTypeScenario = {
  withValidData: () =>
    createMockServiceType({
      name: "Web Development",
      tags: ["web", "development"],
    }),

  withInvalidData: () =>
    createMockServiceType({
      name: "", // Invalid empty name
      tags: [],
    }),

  withManyTags: () =>
    createMockServiceType({
      tags: Array.from({ length: 15 }, (_, i) => `tag${i}`), // Too many tags
    }),
};
```

This comprehensive testing framework ensures reliability, maintainability, and confidence in all application layers while following Effect-TS patterns throughout.
