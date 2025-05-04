import { describe, expect, beforeEach, vi, it } from 'vitest'; // Keep vitest for expect and mocks
import { Effect, Context, Layer } from 'effect'; // Use unified 'effect' import
import {
  createEventBusLiveLayer,
  // createEventBusLiveLayer, // Remove unused import
  createEventBusTag,
  type EventBusService
} from '$lib/utils/eventBus.effect';

// Define a test event map for type safety
type TestEvents = {
  'test:event': { data: string };
  'user:login': { userId: string };
};

// Revert back to describe block
describe('Event Bus', () => {
  // Reintroduce Tag setup inside describe
  let Tag: Context.Tag<EventBusService<TestEvents>, EventBusService<TestEvents>>;
  // Remove Live layer variable, runner might handle it
  let Live: Layer.Layer<never, never, EventBusService<TestEvents>>;

  // Mock handlers for testing
  let mockHandler1: (payload: { data: string }) => void;
  let mockHandler2: (payload: { data: string }) => void;
  let loginHandler: (payload: { userId: string }) => void;

  beforeEach(() => {
    // Recreate Tag for each test to ensure isolation
    Tag = createEventBusTag<TestEvents>('TestEventBus');
    // Remove Live layer creation
    Live = createEventBusLiveLayer(Tag);

    // Reset mocks before each test
    mockHandler1 = vi.fn();
    mockHandler2 = vi.fn();
    loginHandler = vi.fn();
  });

  // Use Effect Vitest runner with 'it'
  it('should register an event handler and emit events to it', () =>
    Effect.flatMap(
      Tag, // Get the EventBus service
      (eventBus) =>
        Effect.flatMap(
          eventBus.on('test:event', mockHandler1), // Register handler, get unsub effect
          (unsub) =>
            // Emit event, then run sync assertions, returning the unsub effect
            Effect.flatMap(eventBus.emit('test:event', { data: 'test data' }), () =>
              Effect.sync(() => {
                expect(mockHandler1).toHaveBeenCalledTimes(1);
                expect(mockHandler1).toHaveBeenCalledWith({ data: 'test data' });
                return unsub; // Return unsub for cleanup
              })
            )
        ).pipe(Effect.flatMap((unsubEffect) => unsubEffect)) // Clean up subscription
    ).pipe(Effect.provide(Live), Effect.asVoid));

  it('should register multiple handlers for the same event', () =>
    Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const unsub1 = yield* $(eventBus.on('test:event', mockHandler1));
      const unsub2 = yield* $(eventBus.on('test:event', mockHandler2));
      const payload = { data: 'test data' };
      yield* $(eventBus.emit('test:event', payload));

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(mockHandler1).toHaveBeenCalledWith(payload);
      expect(mockHandler2).toHaveBeenCalledTimes(1);
      expect(mockHandler2).toHaveBeenCalledWith(payload);

      yield* $(unsub1);
      yield* $(unsub2);
    }).pipe(Effect.asVoid, Effect.provide(Live))); // Ensure the final result is void

  it('should not trigger handlers for different events', () =>
    Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const unsub1 = yield* $(eventBus.on('test:event', mockHandler1));
      const unsub2 = yield* $(eventBus.on('user:login', loginHandler));
      yield* $(eventBus.emit('test:event', { data: 'test data' }));

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(loginHandler).not.toHaveBeenCalled();

      yield* $(unsub1);
      yield* $(unsub2);
    }).pipe(Effect.asVoid, Effect.provide(Live))); // Ensure the final result is void

  it('should unregister a specific handler with off method', () =>
    Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const unsub1 = yield* $(eventBus.on('test:event', mockHandler1)); // Store unsub effect
      const unsub2 = yield* $(eventBus.on('test:event', mockHandler2));

      yield* $(eventBus.off('test:event', mockHandler1));

      const payload = { data: 'test data' };
      yield* $(eventBus.emit('test:event', payload));

      expect(mockHandler1).not.toHaveBeenCalled();
      expect(mockHandler2).toHaveBeenCalledTimes(1);

      // Only unsub2 needs explicit cleanup now
      // unsub1 might be invalid after off, but let's keep pattern for now
      yield* $(unsub1); // Attempt cleanup (might do nothing)
      yield* $(unsub2);
    }).pipe(Effect.asVoid, Effect.provide(Live))); // Ensure the final result is void

  it('should unregister a handler using the returned effect', () =>
    Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const unsubscribe = yield* $(eventBus.on('test:event', mockHandler1));

      yield* $(unsubscribe);

      const payload = { data: 'test data' };
      yield* $(eventBus.emit('test:event', payload));

      // Revert: Remove Effect.sync wrapper if assertion is sync
      expect(mockHandler1).not.toHaveBeenCalled();
    }).pipe(Effect.asVoid, Effect.provide(Live))); // Ensure the final result is void

  it('should handle events with the correct payload types', () =>
    Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const unsub1 = yield* $(eventBus.on('test:event', mockHandler1));
      const unsub2 = yield* $(eventBus.on('user:login', loginHandler));

      const testPayload = { data: 'test data' };
      const loginPayload = { userId: 'user123' };

      yield* $(eventBus.emit('test:event', testPayload));
      yield* $(eventBus.emit('user:login', loginPayload));

      expect(mockHandler1).toHaveBeenCalledWith(testPayload);
      expect(loginHandler).toHaveBeenCalledWith(loginPayload);

      yield* $(unsub1);
      yield* $(unsub2);
    }).pipe(Effect.asVoid, Effect.provide(Live))); // Ensure the final result is void

  it('should do nothing when emitting to an event with no handlers', () =>
    Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const payload = { data: 'test data' };
      yield* $(eventBus.emit('test:event', payload)); // Check it runs without error
    }).pipe(Effect.asVoid, Effect.provide(Live))); // Ensure the final result is void

  it('should do nothing when trying to unregister a non-existent handler', () =>
    Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      yield* $(eventBus.off('test:event', mockHandler1)); // Check it runs without error
    }).pipe(Effect.asVoid, Effect.provide(Live))); // Ensure the final result is void
});
