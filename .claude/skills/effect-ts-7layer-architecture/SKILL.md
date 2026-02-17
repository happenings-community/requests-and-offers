---
name: Effect-TS Architecture
description: This skill should be used when creating, implementing, or modifying a store, service, or domain layer. Covers Effect-TS services, Svelte 5 stores, store helpers, domain error handling, creating new domains, adding service methods, or validating architectural consistency
---

# Effect-TS 7-Layer Architecture

Architecture patterns for this Holochain hApp's frontend: Service → Store → Schema → Errors → Composables → Components → Testing.

## Key Reference Files

- **Service template**: `ui/src/lib/services/zomes/serviceTypes.service.ts`
- **Store template**: `ui/src/lib/stores/serviceTypes.store.svelte.ts`
- **Store helpers**: `ui/src/lib/utils/store-helpers/` (withLoadingState, createGenericCacheSyncHelper, etc.)
- **Zome helpers**: `ui/src/lib/utils/zome-helpers.ts` (wrapZomeCallWithErrorFactory)
- **Error contexts**: `ui/src/lib/errors/error-contexts.ts`
- **Cache service**: `ui/src/lib/utils/cache.svelte` (CacheServiceTag, CacheServiceLive)

## Service Layer Pattern

Services use `Context.Tag` for DI and `wrapZomeCallWithErrorFactory` to wrap Promise-based zome calls into Effects:

```typescript
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context } from 'effect';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';
import { MyDomainError } from '$lib/errors/my-domain.errors';
import { MY_DOMAIN_CONTEXTS } from '$lib/errors/error-contexts';

export interface MyDomainService {
  readonly createEntity: (input: EntityInDHT) => E.Effect<Record, MyDomainError>;
  // ... other methods
}

export class MyDomainServiceTag extends Context.Tag('MyDomainService')<
  MyDomainServiceTag, MyDomainService
>() {}

export const MyDomainServiceLive: Layer.Layer<
  MyDomainServiceTag, never, HolochainClientServiceTag
> = Layer.effect(
  MyDomainServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    const wrapZomeCall = <T>(zomeName: string, fnName: string, payload: unknown, context: string) =>
      wrapZomeCallWithErrorFactory<T, MyDomainError>(
        holochainClient, zomeName, fnName, payload, context, MyDomainError.fromError
      );

    const createEntity = (input: EntityInDHT) =>
      wrapZomeCall('my_zome', 'create_entity', { entity: input }, MY_DOMAIN_CONTEXTS.CREATE);

    return MyDomainServiceTag.of({ createEntity });
  })
);
```

## Store Layer Pattern

Stores use **Svelte 5 Runes** (`$state()`, `$derived()`), import helpers from `$lib/utils/store-helpers`, and file extension is `.store.svelte.ts`:

```typescript
import { withLoadingState, createGenericCacheSyncHelper, createStatusAwareEventEmitters,
  createUIEntityFromRecord, createStatusTransitionHelper, processMultipleRecordCollections,
  type LoadingStateSetter } from '$lib/utils/store-helpers';
import { CacheServiceTag, CacheServiceLive } from '$lib/utils/cache.svelte';

export const createMyDomainStore = () => E.gen(function* () {
  const service = yield* MyDomainServiceTag;
  const cacheService = yield* CacheServiceTag;

  // Svelte 5 Runes for reactive state
  const entities: UIEntity[] = $state([]);
  let loading: boolean = $state(false);
  let error: string | null = $state(null);

  const setters: LoadingStateSetter = {
    setLoading: (v) => { loading = v; },
    setError: (v) => { error = v; }
  };

  // Use standardized helpers
  const { syncCacheToState } = createGenericCacheSyncHelper({ all: entities });
  const eventEmitters = createStatusAwareEventEmitters<UIEntity>('myDomain');
  // ... withLoadingState(() => pipe(...)) pattern for operations
});

// Store instance creation
const store = pipe(
  createMyDomainStore(),
  E.provide(CacheServiceLive),
  E.provide(MyDomainServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runSync
);
export default store;
```

## Validation

Run `npx tsx .claude/skills/effect-ts-7layer-architecture/validation/architecture-check.ts ServiceType` to validate a domain's architectural compliance.

## 9 Store Helper Functions

All imported from `$lib/utils/store-helpers`:
1. `createUIEntityFromRecord` — Entity creation from Holochain records
2. `createGenericCacheSyncHelper` — Cache-to-state synchronization
3. `createStatusAwareEventEmitters` — Type-safe event emission
4. `withLoadingState` — Loading/error state management
5. `createStatusTransitionHelper` — Status workflow (pending/approved/rejected)
6. `processMultipleRecordCollections` — Multi-collection response handling
7. `createStandardEventEmitters` — Basic CRUD event emission
8. `LoadingStateSetter` (type) — Setter interface for loading state
9. `EntityStatus` (type) — Status type for status transitions

## Architecture Rules

- Services return `E.Effect<T, DomainError>`, never raw Promises
- Stores use `$state()` and `$derived()` (Svelte 5), never `writable`/`readable`
- Store files must have `.store.svelte.ts` extension
- All domain errors extend tagged error pattern with `fromError` static method
- Error contexts defined in `$lib/errors/error-contexts.ts`
- DI via `E.provide()` / `E.provideService()` chains
