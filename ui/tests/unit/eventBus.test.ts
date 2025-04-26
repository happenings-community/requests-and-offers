import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Context from 'effect/Context';
import { makeEventBusService, type EventBusService } from '@utils/eventBus.effect';

// Define a test event map for type safety
type TestEvents = {
  'test:event': { data: string };
  'user:login': { userId: string };
};

describe('Event Bus', () => {
  // Create a new event bus instance for testing
  let Tag: Context.Tag<EventBusService<TestEvents>, EventBusService<TestEvents>>;
  let Live: Layer.Layer<EventBusService<TestEvents>>;

  // Mock handlers for testing
  let mockHandler1: (payload: { data: string }) => void;
  let mockHandler2: (payload: { data: string }) => void;
  let loginHandler: (payload: { userId: string }) => void;

  beforeEach(() => {
    // Recreate event bus to reset state
    const { Tag: NewTag, Live: NewLive } = makeEventBusService<TestEvents>('TestEventBus');
    Tag = NewTag;
    Live = NewLive;

    // Reset mocks before each test
    mockHandler1 = vi.fn();
    mockHandler2 = vi.fn();
    loginHandler = vi.fn();
  });

  // Helper function to run a test program (assumes requirements are provided)
  const runTest = async (program: Effect.Effect<void, never, never>): Promise<void> => {
    try {
      // Simply run the program
      return await Effect.runPromise(program);
    } catch (error) {
      console.error('Test execution failed:', error);
      throw error; // Re-throw after logging
    }
  };

  test('should register an event handler and emit events to it', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Register a handler
      yield* eventBus.on('test:event', mockHandler1);

      // Emit an event
      const payload = { data: 'test data' };
      yield* eventBus.emit('test:event', payload);

      // Verify the handler was called with the correct payload
      yield* Effect.sync(() => {
        expect(mockHandler1).toHaveBeenCalledTimes(1);
        expect(mockHandler1).toHaveBeenCalledWith(payload);
      });
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await runTest(runnable);
  });

  test('should register multiple handlers for the same event', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Register multiple handlers
      yield* eventBus.on('test:event', mockHandler1);
      yield* eventBus.on('test:event', mockHandler2);

      // Emit an event
      const payload = { data: 'test data' };
      yield* eventBus.emit('test:event', payload);

      // Verify both handlers were called
      yield* Effect.sync(() => {
        expect(mockHandler1).toHaveBeenCalledTimes(1);
        expect(mockHandler1).toHaveBeenCalledWith(payload);
        expect(mockHandler2).toHaveBeenCalledTimes(1);
        expect(mockHandler2).toHaveBeenCalledWith(payload);
      });
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await runTest(runnable);
  });

  test('should not trigger handlers for different events', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Register handlers for different events
      yield* eventBus.on('test:event', mockHandler1);
      yield* eventBus.on('user:login', loginHandler);

      // Emit only one event
      yield* eventBus.emit('test:event', { data: 'test data' });

      // Verify only the correct handler was called
      yield* Effect.sync(() => {
        expect(mockHandler1).toHaveBeenCalledTimes(1);
        expect(loginHandler).not.toHaveBeenCalled();
      });
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await runTest(runnable);
  });

  test('should unregister a specific handler with off method', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Register handlers
      yield* eventBus.on('test:event', mockHandler1);
      yield* eventBus.on('test:event', mockHandler2);

      // Unregister one handler
      yield* eventBus.off('test:event', mockHandler1);

      // Emit an event
      const payload = { data: 'test data' };
      yield* eventBus.emit('test:event', payload);

      // Verify only the remaining handler was called
      yield* Effect.sync(() => {
        expect(mockHandler1).not.toHaveBeenCalled();
        expect(mockHandler2).toHaveBeenCalledTimes(1);
      });
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await runTest(runnable);
  });

  test('should unregister a handler using the returned effect', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Register a handler and get the unsubscribe effect
      const unsubscribe = yield* eventBus.on('test:event', mockHandler1);

      // Unsubscribe using the returned effect
      yield* unsubscribe;

      // Emit an event
      const payload = { data: 'test data' };
      yield* eventBus.emit('test:event', payload);

      // Verify the handler was not called
      yield* Effect.sync(() => {
        expect(mockHandler1).not.toHaveBeenCalled();
      });
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await runTest(runnable);
  });

  test('should handle events with the correct payload types', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Register handlers for different event types
      yield* eventBus.on('test:event', mockHandler1);
      yield* eventBus.on('user:login', loginHandler);

      // Emit events with their respective payload types
      const testPayload = { data: 'test data' };
      const loginPayload = { userId: 'user123' };

      yield* eventBus.emit('test:event', testPayload);
      yield* eventBus.emit('user:login', loginPayload);

      // Verify handlers received the correct payloads
      yield* Effect.sync(() => {
        expect(mockHandler1).toHaveBeenCalledWith(testPayload);
        expect(loginHandler).toHaveBeenCalledWith(loginPayload);
      });
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await runTest(runnable);
  });

  test('should do nothing when emitting to an event with no handlers', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Emit an event with no handlers
      const payload = { data: 'test data' };
      yield* eventBus.emit('test:event', payload);
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await expect(Effect.runPromise(runnable)).resolves.toBeUndefined();
  });

  test('should do nothing when trying to unregister a non-existent handler', async () => {
    const testLogic = Effect.gen(function* () {
      const eventBus = yield* Tag;

      // Try to unregister a non-existent handler
      yield* eventBus.off('test:event', mockHandler1);
      yield* Effect.void;
    });

    const runnable = testLogic.pipe(Effect.provide(Live), Effect.asVoid);
    await expect(Effect.runPromise(runnable)).resolves.toBeUndefined();
  });
});
