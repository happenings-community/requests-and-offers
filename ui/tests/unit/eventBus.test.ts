import { describe, test, expect, beforeEach, vi } from 'vitest'; // Use standard vitest imports
import * as Effect from '@effect/io/Effect'; // Match eventBus.effect.ts imports
import * as Layer from '@effect/io/Layer'; // Match eventBus.effect.ts imports
import * as Context from '@effect/data/Context'; // Match eventBus.effect.ts imports
import {
  createEventBusLiveLayer,
  createEventBusTag,
  type EventBusService
} from '@utils/eventBus.effect';

// Define a test event map for type safety
type TestEvents = {
  'test:event': { data: string };
  'user:login': { userId: string };
};

// Revert back to describe block
describe('Event Bus', () => {
  // Reintroduce Tag and Live setup inside describe
  let Tag: Context.Tag<EventBusService<TestEvents>, EventBusService<TestEvents>>;
  let Live: Layer.Layer<never, never, EventBusService<TestEvents>>;

  // Mock handlers for testing
  let mockHandler1: (payload: { data: string }) => void;
  let mockHandler2: (payload: { data: string }) => void;
  let loginHandler: (payload: { userId: string }) => void;

  beforeEach(() => {
    // Recreate Tag and Live for each test to ensure isolation
    Tag = createEventBusTag<TestEvents>('TestEventBus');
    Live = createEventBusLiveLayer(Tag);

    // Reset mocks before each test
    mockHandler1 = vi.fn();
    mockHandler2 = vi.fn();
    loginHandler = vi.fn();
  });

  // Reintroduce runTest helper (optional, but mimics previous structure)
  const runTest = async <E, A>(program: Effect.Effect<never, E, A>): Promise<A> => {
    try {
      // Provide the Live layer and run
      return await Effect.runPromise(Effect.provide(program, Live));
    } catch (error) {
      console.error('Test execution failed:', error);
      throw error; // Re-throw after logging
    }
  };

  // Revert tests to use standard 'test' and runTest helper
  test('should register an event handler and emit events to it', async () => {
    const testLogic = Effect.flatMap(
      Tag,
      (
        eventBus // Use Effect.flatMap to get the service
      ) =>
        Effect.flatMap(
          eventBus.on('test:event', mockHandler1),
          (
            unsub // Use Effect.flatMap for sequential operations
          ) =>
            Effect.flatMap(eventBus.emit('test:event', { data: 'test data' }), () =>
              Effect.sync(() => {
                // Use Effect.sync for synchronous assertions
                expect(mockHandler1).toHaveBeenCalledTimes(1);
                expect(mockHandler1).toHaveBeenCalledWith({ data: 'test data' });
                return unsub; // Return unsub effect for final cleanup
              })
            )
        ).pipe(Effect.flatMap((unsub) => unsub)) // Execute the final unsub effect
    );
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });

  test('should register multiple handlers for the same event', async () => {
    const testLogic = Effect.gen(function* ($) {
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
    });
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });

  test('should not trigger handlers for different events', async () => {
    const testLogic = Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const unsub1 = yield* $(eventBus.on('test:event', mockHandler1));
      const unsub2 = yield* $(eventBus.on('user:login', loginHandler));
      yield* $(eventBus.emit('test:event', { data: 'test data' }));

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(loginHandler).not.toHaveBeenCalled();

      yield* $(unsub1);
      yield* $(unsub2);
    });
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });

  test('should unregister a specific handler with off method', async () => {
    const testLogic = Effect.gen(function* ($) {
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
    });
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });

  test('should unregister a handler using the returned effect', async () => {
    const testLogic = Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const unsubscribe = yield* $(eventBus.on('test:event', mockHandler1));

      yield* $(unsubscribe);

      const payload = { data: 'test data' };
      yield* $(eventBus.emit('test:event', payload));

      expect(mockHandler1).not.toHaveBeenCalled();
    });
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });

  test('should handle events with the correct payload types', async () => {
    const testLogic = Effect.gen(function* ($) {
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
    });
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });

  test('should do nothing when emitting to an event with no handlers', async () => {
    const testLogic = Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      const payload = { data: 'test data' };
      yield* $(eventBus.emit('test:event', payload)); // Check it runs without error
    });
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });

  test('should do nothing when trying to unregister a non-existent handler', async () => {
    const testLogic = Effect.gen(function* ($) {
      const eventBus = yield* $(Tag);
      yield* $(eventBus.off('test:event', mockHandler1)); // Check it runs without error
    });
    const testLogicProvided = Effect.provide(testLogic, Live);
    await runTest(testLogicProvided);
  });
});
