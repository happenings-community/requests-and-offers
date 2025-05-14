# Enhance EntityCache (`cache.svelte.ts`) with Effect TS

Refactor the custom `EntityCache` to leverage Effect TS for improved composability, error handling, and potential integration with `Effect.Cache` and the Effect-based `EventBusService`.**/stores/**/*.store.svelte.ts

## Completed Tasks

- [ ] *None yet*

## In Progress Tasks

- [ ] Define structured `CacheError` types using `Data.TaggedError` for fetch failures, invalid arguments, etc.
- [ ] Replace internal `createEventBus` with the Effect-based `EventBusService` from `$lib/utils/eventBus.effect.ts`.
  - [ ] Define a specific `CacheEventBusTag` and `CacheEventBusLive` layer (or reuse a general one if applicable).
  - [ ] Update `on`, `off`, and internal `eventBus.emit` calls to use the Effect-based API.
- [ ] Refactor `getOrFetch` to return `Effect<T | null, CacheError>` instead of `Promise<T | null>`.
  - [ ] Rewrite internal async logic using Effect combinators (e.g., `E.tryPromise`, `E.flatMap`, `E.catchAll`).
  - [ ] Update `pendingRequests` logic to work with Effect streams or Refs if necessary.
- [ ] Refactor `getOrFetchMany` to return `Effect<T[], CacheError>` instead of `Promise<T[]>`.
  - [ ] Leverage the refactored `getOrFetch` internally.
  - [ ] Use Effect concurrency combinators (`E.all`, `E.forEach` with concurrency) for fetching.
- [ ] Update consumers of `EntityCache` (e.g., `requests.store.svelte.ts`) to work with the new Effect-based return types.
  - [ ] Replace `E.tryPromise` wrappers around `getOrFetch`/`getOrFetchMany` with direct Effect composition.
  - [ ] Adapt logic that updates Svelte `$state` based on cache results (might require running the Effect before synchronous updates).
- [ ] Investigate using `Effect.Cache` internally within `EntityCache` to manage storage and TTL.
  - [ ] Compare feasibility and benefits vs. the current manual timestamp management.
  - [ ] If viable, implement `Effect.Cache` integration while retaining the Holochain-specific `EntityCache` API and Svelte integration.

## Future Tasks

- [ ] *None currently planned*

## Implementation Plan

1. **Error Definition:** Start by defining the `CacheError` types.
2. **Event Bus Integration:** Replace the existing event bus with the Effect-based `EventBusService`. This involves creating the necessary Tag/Layer and updating all event handling logic (`on`, `off`, `emit`).
3. **Core Method Refactoring:** Refactor `getOrFetch` and `getOrFetchMany` to use and return `Effect`. Update their internal logic accordingly.
4. **Consumer Updates:** Modify the stores and potentially services that use `EntityCache` to align with the new Effect-based API. Pay close attention to the interaction with Svelte's synchronous state updates.
5. **Effect.Cache Investigation:** Explore integrating `Effect.Cache` for internal state management as a potential optimization.
6. **Testing:** Ensure thorough testing throughout the refactoring process.
7. **Documentation**: Update the documentation and the cursor rules to reflect the changes.

### Relevant Files

- `ui/src/lib/utils/cache.svelte.ts` - The primary file to be refactored. ✅ (Target)
- `ui/src/lib/utils/eventBus.effect.ts` - Provides the target `EventBusService`. ✅ (Reference)
- `ui/src/lib/utils/eventBus.ts` - The current event bus implementation to be replaced. ✅ (To Remove)
- `ui/src/lib/stores/requests.store.svelte.ts` - Example consumer that needs updating. ✅ (To Update)
- `ui/src/lib/stores/users.store.svelte.ts` - Another potential consumer. (To Check/Update)
- `ui/src/lib/stores/organizations.store.svelte.ts` - Another potential consumer. (To Check/Update)
- `effect` - Potential internal dependency if `Effect.Cache` is used. (Reference)
