# Store Test Patterns

## Mock Service (Effect-Based)

Store services return Effects, not Promises:

```typescript
const createMockService = (overrides = {}): ServiceTypesService => ({
  createServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
  getServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
  getLatestServiceTypeRecord: vi.fn().mockReturnValue(E.succeed(mockRecord)),
  updateServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
  deleteServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
  getAllServiceTypes: vi.fn().mockReturnValue(
    E.succeed({ pending: [], approved: [mockRecord], rejected: [] })
  ),
  getServiceTypeStatus: vi.fn().mockReturnValue(E.succeed('approved')),
  suggestServiceType: vi.fn().mockReturnValue(E.succeed(mockRecord)),
  approveServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
  rejectServiceType: vi.fn().mockReturnValue(E.succeed(mockActionHash)),
  getPendingServiceTypes: vi.fn().mockReturnValue(E.succeed([])),
  getApprovedServiceTypes: vi.fn().mockReturnValue(E.succeed([mockRecord])),
  getRejectedServiceTypes: vi.fn().mockReturnValue(E.succeed([])),
  // ... remaining methods
  ...overrides
});
```

## Store Creation with DI

```typescript
const createStoreWithService = async (service: ServiceTypesService) => {
  return await E.runPromise(
    createServiceTypesStore().pipe(
      E.provideService(ServiceTypesServiceTag, service),
      E.provide(CacheServiceLive),
      E.provideService(HolochainClientServiceTag, createMockHolochainClientService())
    )
  );
};
```

## Mock Record with encode()

```typescript
import { encode } from '@msgpack/msgpack';
import { fakeActionHash, fakeAgentPubKey, fakeEntryHash, ActionType } from '@holochain/client';

export async function createMockRecord<T>(entryData: T): Promise<Record> {
  return {
    signed_action: {
      hashed: {
        content: {
          type: ActionType.Create,
          author: await fakeAgentPubKey(),
          timestamp: 0,
          action_seq: 0,
          prev_action: await fakeActionHash(),
          entry_type: { App: { entry_index: 0, zome_index: 0, visibility: 'Public' } },
          entry_hash: await fakeEntryHash()
        },
        hash: await fakeActionHash()
      },
      signature: await fakeEntryHash()
    },
    entry: {
      Present: {
        entry_type: 'App',
        entry: encode(entryData)
      }
    }
  };
}
```

## Module-Level Mocking for Cross-Store Dependencies

```typescript
// administrationStore is imported at module level in several stores
// MUST mock BEFORE importing the store under test

vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: {
    administrators: [],
    loading: false,
    error: null,
    isCurrentUserAdmin: false
  }
}));

// Import AFTER mocking
const { createMyStore } = await import('$lib/stores/my.store.svelte');
```

## Store Method Testing

```typescript
it('should fetch all entities', async () => {
  const store = await createStoreWithService(createMockService());

  const result = await E.runPromise(store.getAllServiceTypes());

  expect(result).toBeInstanceOf(Array);
  expect(mockServiceTypesService.getAllServiceTypes).toHaveBeenCalled();
});
```

## Error State Testing

```typescript
it('should set error state on failure', async () => {
  const failingService = createMockService({
    getAllServiceTypes: vi.fn().mockReturnValue(
      E.fail(new ServiceTypeError({ message: 'Network error' }))
    )
  });
  const store = await createStoreWithService(failingService);

  await expect(E.runPromise(store.getAllServiceTypes())).rejects.toThrow();
  // withLoadingState sets error on store before re-throwing
  expect(store.error).toBeTruthy();
});
```

## Key Rules

- Store mock services use `E.succeed()` / `E.fail()` (Effect returns)
- `createStoreWithService` must use the `service` parameter, not module-level mocks
- `createMockRecord` must use `encode()` from `@msgpack/msgpack` for entries
- `withLoadingState` sets `error` on store BEFORE re-throwing
- Store creation uses `E.provideService()` for tags, `E.provide()` for layers
