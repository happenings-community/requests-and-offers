# WriteStoreTest Workflow

Step-by-step guide to writing a unit test for a Svelte 5 store.

## Steps

### 1. Load patterns

Read `StoreTestPatterns.md` from the skill root for complete mock setup code.

### 2. Check for module-level imports

Before writing any code, grep the store under test for module-level `administrationStore` usage:

```bash
grep -n "administrationStore" ui/src/lib/stores/{domain}.store.svelte.ts
```

If found → the store imports `administrationStore` at module level. You MUST mock it before importing.

### 3. Create the test file

Place at: `ui/tests/unit/stores/{domain}.store.test.ts`

### 4. Set up module-level mocks (if needed)

If `administrationStore` is used at module level, add this BEFORE any store imports:

```typescript
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: {
    administrators: [],
    loading: false,
    error: null,
    isCurrentUserAdmin: false
  }
}));
```

**Order is critical:** mock → then import the store.

### 5. Create Effect-based service mock

```typescript
const createMockService = (overrides = {}) => ({
  {method1}: vi.fn().mockReturnValue(E.succeed(mockRecord)),
  {method2}: vi.fn().mockReturnValue(E.succeed([])),
  // ... all interface methods
  ...overrides
});
```

**Critical:** Store mocks return `E.succeed()` / `E.fail()` — NOT Promises.

### 6. Create store with DI

```typescript
const createStoreWithService = async (service) => {
  return await E.runPromise(
    create{Domain}Store().pipe(
      E.provideService({Domain}ServiceTag, service),
      E.provide(CacheServiceLive),
      E.provideService(HolochainClientServiceTag, createMockHolochainClientService())
    )
  );
};
```

### 7. Write store method tests

```typescript
it('should {action}', async () => {
  const store = await createStoreWithService(createMockService());

  const result = await E.runPromise(store.{method}());

  expect(result).toBeInstanceOf(Array);
  expect(mockService.{method}).toHaveBeenCalled();
});
```

### 8. Write error state test

```typescript
it('should set error state on failure', async () => {
  const failingService = createMockService({
    {method}: vi.fn().mockReturnValue(
      E.fail(new {Domain}Error({ message: 'error' }))
    )
  });
  const store = await createStoreWithService(failingService);

  await expect(E.runPromise(store.{method}())).rejects.toThrow();
  expect(store.error).toBeTruthy();
});
```

### 9. Run the test

```bash
cd ui && bun run test:unit
# Or single file:
cd ui && bun vitest run tests/unit/stores/{domain}.store.test.ts
```

## Reference

- Full patterns: `StoreTestPatterns.md`
- Real example: `ui/tests/unit/stores/serviceTypes.store.test.ts`
- Mock record helper: `ui/tests/unit/test-helpers.ts`
