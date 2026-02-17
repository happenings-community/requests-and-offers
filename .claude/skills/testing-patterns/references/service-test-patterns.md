# Service Test Patterns

## Complete Mock Setup

The `HolochainClientService` interface is **Promise-based**. All fields must be mocked:

```typescript
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
    networkSeed: 'test-network-seed',
    dnaHash: 'test-dna-hash',
    roleName: 'requests_and_offers'
  })),
  getNetworkPeers: vi.fn(() => Promise.resolve(['peer1', 'peer2', 'peer3'])),
  isGroupProgenitor: vi.fn(() => Promise.resolve(false))
});
```

## Test Runner with Layer.succeed

```typescript
const createServiceTestRunner = (
  mockClient: ReturnType<typeof createMockHolochainClientService>
) => {
  const testLayer = Layer.succeed(HolochainClientServiceTag, mockClient);
  return <T, E>(effect: E.Effect<T, E, ServiceTypesServiceTag>) =>
    E.runPromise(effect.pipe(
      E.provide(ServiceTypesServiceLive),
      E.provide(testLayer)
    ));
};
```

## Success Test Pattern

```typescript
it('should create entity', async () => {
  mockHolochainClient.callZome.mockResolvedValue(mockRecord);

  const result = await runServiceEffect(
    E.gen(function* () {
      const service = yield* ServiceTypesServiceTag;
      return yield* service.createServiceType(testServiceType);
    })
  );

  expect(mockHolochainClient.callZome).toHaveBeenCalledWith(
    'service_types', 'create_service_type', { service_type: testServiceType }
  );
  expect(result).toEqual(mockRecord);
});
```

## Error Test Pattern

```typescript
it('should handle errors', async () => {
  mockHolochainClient.callZome.mockRejectedValue(new Error('Zome call failed'));

  await expect(
    runServiceEffect(
      E.gen(function* () {
        const service = yield* ServiceTypesServiceTag;
        return yield* service.createServiceType(testServiceType);
      })
    )
  ).rejects.toThrow();
});
```

## Key Rules

- `callZome` is mocked with `mockResolvedValue` / `mockRejectedValue` (Promise-based)
- `wrapZomeCallWithErrorFactory` converts Promises to Effects internally
- Test layer uses `Layer.succeed(HolochainClientServiceTag, mockClient)`
- Service effects run via `E.runPromise(effect.pipe(E.provide(...), E.provide(...)))`
