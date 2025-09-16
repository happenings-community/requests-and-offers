# Testing: Frontend Unit (Effect-TS + Svelte Stores)

## Effect-TS Service Testing

```ts
import { describe, it, expect } from "vitest";
import { Effect, Layer, Context } from "effect";
import {
  ServiceTypeService,
  makeServiceTypeService,
} from "../services/serviceType.service";

describe("ServiceTypeService", () => {
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
      const input = { name: "Test Service", description: "Test description", tags: ["test"] };
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
      const input = { name: "", description: "Test description", tags: ["test"] };
      return yield* service.createServiceType(input);
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(TestServiceLayer))),
    ).rejects.toThrow("Validation failed");
  });
});
```

## Svelte Store Testing

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createServiceTypesStore } from "../stores/serviceTypes.store";
import { Effect, Layer } from "effect";

describe("ServiceTypesStore", () => {
  let store: ReturnType<typeof createServiceTypesStore>;

  beforeEach(() => {
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
    const errorService = Layer.succeed(ServiceTypeService, {
      getAllServiceTypes: Effect.fail(
        new ServiceTypeError({ message: "Network error" }),
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
