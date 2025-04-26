# Refactor Event Bus to Effect Service

Implement an Event Bus using Effect TS services, Context, Layer, and Ref, and integrate it with the existing Svelte stores.

## Completed Tasks

- [x] **1. Implement Effect-based Event Bus Service:**
  - [x] Create `ui/src/lib/utils/eventBus.effect.ts`.
  - [x] Define the `EventBusService<T extends EventMap>` interface with `on`, `emit`, `off` returning `Effect`.
  - [x] Implement the `makeEventBusService<T extends EventMap>()` factory function.
  - [x] Inside the factory, define the `Context.Tag<EventBusService<T>>`.
  - [x] Implement the `Live` layer using `Layer.effect`.
  - [x] Use `Ref.make` within the layer to manage the `handlers` map.
  - [x] Implement `on`, `emit`, `off` methods using `Ref.update`/`Ref.get` and Effect combinators (`Effect.map`, `Effect.flatMap`, `Effect.forEach`, `Effect.sync`). Ensure `on` returns `Effect<Effect<void>>` for the unsubscribe effect.
- [x] **2. Update Store Event Definitions:**
  - [x] Modify `ui/src/lib/stores/storeEvents.ts`.
  - [x] Remove the old `createEventBus` call and instance export.
  - [x] Import `makeEventBusService` from `eventBus.effect.ts`.
  - [x] Call `makeEventBusService<StoreEvents>('StoreEventBus')` to get the specific Tag and Layer.
  - [x] Export the `StoreEventBusTag` and `StoreEventBusLive`.
- [ ] **3. Refactor Requests Store:**
  - [ ] Modify `ui/src/lib/stores/requests.store.svelte.ts`.
  - [ ] Remove the `eventBus` parameter from `createRequestsStore`.
  - [ ] In `createRequest`, `updateRequest`, `deleteRequest` Effect pipelines:
    - [ ] Use `Effect.service(StoreEventBusTag)` to access the bus service.
    - [ ] Integrate the `bus.emit(...)` effect into the pipeline using `Effect.tap` or `Effect.flatMap`.
- [ ] **4. Refactor Offers Store:**
  - [ ] Modify `ui/src/lib/stores/offers.store.svelte.ts`.
  - [ ] Remove the `eventBus` parameter from `createOffersStore`.
  - [ ] In `createOffer`, `updateOffer`, `deleteOffer` Effect pipelines:
    - [ ] Use `Effect.service(StoreEventBusTag)` to access the bus service.
    - [ ] Integrate the `bus.emit(...)` effect into the pipeline using `Effect.tap` or `Effect.flatMap`.
- [ ] **5. Update Application Layer Composition:**
  - [ ] Locate the main application Effect setup (e.g., root component, `main.ts`).
  - [ ] Add `StoreEventBusLive` to the layers provided to the main Effect program using `Layer.provideMerge` or similar.

## Future Tasks

- [ ] Add unit/integration tests for `EventBusService`.
- [ ] Consider if stores themselves should become Effect Layers/Services.
- [ ] Evaluate error handling within emitted event handlers.

## Implementation Plan

Refactor the existing imperative event bus (`createEventBus`) into a functional Effect service (`EventBusService`). This involves:
1.  Creating a generic Effect service definition (`EventBusService<T>`) and a factory (`makeEventBusService`) to generate specific Tags and Layers for different event maps. State (`handlers`) will be managed using `Ref`.
2.  Updating `storeEvents.ts` to use this new factory to define and export the `Tag` and `Live` layer for `StoreEvents`.
3.  Refactoring the Svelte stores (`requests.store.svelte.ts`, `offers.store.svelte.ts`) to access the event bus service via its `Tag` within their Effect pipelines and call the effectful `emit` method.
4.  Ensuring the `StoreEventBusLive` layer is provided when the main application Effect program is run.

### Relevant Files

- `ui/src/lib/utils/eventBus.ts` - (To be replaced/refactored)
- `ui/src/lib/utils/eventBus.effect.ts` - (To be created) New Effect service implementation.
- `ui/src/lib/stores/storeEvents.ts` - (To be modified) Define Tag/Layer for store events.
- `ui/src/lib/stores/requests.store.svelte.ts` - (To be modified) Integrate Effect event bus.
- `ui/src/lib/stores/offers.store.svelte.ts` - (To be modified) Integrate Effect event bus.
- `ui/src/main.ts` or equivalent - (To be modified) Provide the new layer.
