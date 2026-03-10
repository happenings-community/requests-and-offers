# WriteServiceTest Workflow

Step-by-step guide to writing a unit test for an Effect-TS service.

## Steps

### 1. Load patterns

Read `ServiceTestPatterns.md` from the skill root for complete mock setup code.

### 2. Identify the service under test

- Find the service file: `ui/src/lib/services/zomes/{domain}.service.ts`
- Identify the service tag: `{Domain}ServiceTag`
- Identify the service live layer: `{Domain}ServiceLive`
- List the methods to test

### 3. Create the test file

Place at: `ui/tests/unit/services/{domain}.service.test.ts`

Standard imports:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { {Domain}ServiceTag, {Domain}ServiceLive } from '$lib/services/zomes/{domain}.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
```

### 4. Set up Promise-based mock

Copy the `createMockHolochainClientService` factory from `ServiceTestPatterns.md`.

**Critical:** `callZome` must use `mockResolvedValue` / `mockRejectedValue` — it is Promise-based, NOT Effect-based.

### 5. Create test runner

```typescript
const createServiceTestRunner = (mockClient) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);
  return (effect) =>
    E.runPromise(effect.pipe(
      E.provide({Domain}ServiceLive),
      E.provide(testLayer)
    ));
};
```

### 6. Write success test

```typescript
it('should call {method}', async () => {
  mockClient.callZome.mockResolvedValue(expectedResult);

  const result = await runEffect(
    E.gen(function* () {
      const service = yield* {Domain}ServiceTag;
      return yield* service.{method}(testInput);
    })
  );

  expect(mockClient.callZome).toHaveBeenCalledWith('{zome_name}', '{fn_name}', payload);
  expect(result).toEqual(expectedResult);
});
```

### 7. Write error test

```typescript
it('should handle {method} errors', async () => {
  mockClient.callZome.mockRejectedValue(new Error('Zome call failed'));

  await expect(
    runEffect(E.gen(function* () {
      const service = yield* {Domain}ServiceTag;
      return yield* service.{method}(testInput);
    }))
  ).rejects.toThrow();
});
```

### 8. Run the test

```bash
cd ui && bun run test:unit
# Or single file:
cd ui && bun vitest run tests/unit/services/{domain}.service.test.ts
```

## Reference

- Full mock template: `ServiceTestPatterns.md`
- Real example: `ui/tests/unit/services/serviceTypes.service.test.ts`
