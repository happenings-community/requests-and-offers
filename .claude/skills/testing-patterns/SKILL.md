---
name: Testing Patterns
description: This skill should be used when writing or debugging unit tests, integration tests, mocking Effect-TS services, testing Svelte 5 stores, or setting up Tryorama multi-agent scenarios
---

# Testing Patterns

Patterns for testing this project's Effect-TS services, Svelte 5 stores, and Holochain zomes.

## Key Reference Files

- **Service test**: `ui/tests/unit/services/serviceTypes.service.test.ts`
- **Store test**: `ui/tests/unit/stores/serviceTypes.store.test.ts`
- **Test helpers**: `ui/tests/unit/test-helpers.ts`
- **Tryorama utils**: `tests/src/requests_and_offers/utils.ts`
- **Effect runner**: `ui/src/lib/utils/effect.ts` (`runEffect`)

## Running Tests

```bash
bun run test:unit                          # From ui/ directory
nix develop --command bun test:unit        # With Nix (needed for hREA)
bun test                                   # All tests (builds zomes first)
```

## Service Test Pattern

Services use **Promise-based** `callZome` mocks (not Effect returns):

```typescript
import { Effect as E, Layer } from 'effect';
import { ServiceTypesServiceLive, ServiceTypesServiceTag } from '$lib/services/zomes/serviceTypes.service';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

// 1. Mock the HolochainClientService (Promise-based interface)
const createMockHolochainClientService = () => ({
  appId: 'test-app',
  client: null,
  isConnected: true,
  isConnecting: false,
  weaveClient: null,
  profilesClient: null,
  isWeaveContext: false,
  connectClient: vi.fn(),
  waitForConnection: vi.fn(() => Promise.resolve()),
  getAppInfo: vi.fn(),
  getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
  callZome: vi.fn(),
  verifyConnection: vi.fn(),
  getNetworkSeed: vi.fn(() => Promise.resolve('test-network-seed')),
  getNetworkInfo: vi.fn(() => Promise.resolve({
    networkSeed: 'test-seed', dnaHash: 'test-dna', roleName: 'requests_and_offers'
  })),
  getNetworkPeers: vi.fn(() => Promise.resolve([])),
  isGroupProgenitor: vi.fn(() => Promise.resolve(false))
});

// 2. Create test runner with Layer.succeed
const createServiceTestRunner = (mockClient) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);
  return <T, E>(effect: E.Effect<T, E, ServiceTypesServiceTag>) =>
    E.runPromise(effect.pipe(
      E.provide(ServiceTypesServiceLive),
      E.provide(testLayer)
    ));
};

// 3. Test with mockResolvedValue / mockRejectedValue
it('should create entity', async () => {
  mockClient.callZome.mockResolvedValue(mockRecord);
  const result = await runServiceEffect(
    E.gen(function* () {
      const service = yield* ServiceTypesServiceTag;
      return yield* service.createServiceType(testInput);
    })
  );
  expect(result).toEqual(mockRecord);
});
```

## Store Test Pattern

Store mocks return **Effects** (not Promises):

```typescript
import { Effect as E } from 'effect';
import { createServiceTypesStore } from '$lib/stores/serviceTypes.store.svelte';
import { ServiceTypesServiceTag } from '$lib/services/zomes/serviceTypes.service';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

// 1. Mock service returns E.succeed() / E.fail()
const createMockService = () => ({
  createServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
  getAllServiceTypes: vi.fn().mockReturnValue(
    E.succeed({ pending: [], approved: [mockRecord], rejected: [] })
  ),
  getServiceTypeStatus: vi.fn().mockReturnValue(E.succeed('approved')),
  // ... all interface methods
});

// 2. Create store with E.provideService + E.provide
const createStoreWithService = async (service) => {
  return await E.runPromise(
    createServiceTypesStore().pipe(
      E.provideService(ServiceTypesServiceTag, service),
      E.provide(CacheServiceLive),
      E.provideService(HolochainClientServiceTag, createMockHolochainClientService())
    )
  );
};
```

## Mock Record Creation

Records MUST use `encode()` from `@msgpack/msgpack` for entry data. See `ui/tests/unit/test-helpers.ts` for `createMockRecord()`, `createMockServiceTypeRecord()`, and other helpers.

## Module-Level Mocking Rule

Some stores import `administrationStore` at module level. Tests MUST mock these BEFORE importing the store:

```typescript
// CORRECT: mock BEFORE import
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: { administrators: [], isCurrentUserAdmin: false }
}));

// THEN import the store under test
const { createMyStore } = await import('$lib/stores/my.store.svelte');
```

## Tryorama Pattern (Integration Tests)

Use `runScenarioWithTwoAgents()` from `tests/src/requests_and_offers/utils.ts`. Key steps:
1. Get cells via `player.namedCells.get('requests_and_offers')`
2. Call zomes via `cells.callZome({ zome_name, fn_name, payload })`
3. Sync DHT via `dhtSync([alice, bob], dnaHash)` between agent operations
4. Decode results via `decodeRecords()` / `decodeRecord()`

See `references/tryorama-patterns.md` for full examples.

## Common Pitfalls

1. **Service mocks**: Use `mockResolvedValue` (Promises), not `E.succeed`
2. **Store mocks**: Use `E.succeed()` / `E.fail()` (Effects), not Promises
3. **Record entries**: Must use `encode()` from `@msgpack/msgpack`
4. **Module mocking**: Must happen BEFORE `import` of store under test
5. **hREA tests**: Need module mocks for `@valueflows/vf-graphql-holochain` and `@apollo/client/link/schema`
6. **Tryorama**: Always call `dhtSync()` between agent operations
