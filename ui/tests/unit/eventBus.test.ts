import { describe, expect, beforeEach, vi, it } from 'vitest';
import { Effect } from 'effect';
import { createEventBusClass } from '$lib/utils/eventBus.effect';

// Define a test event map for type safety
type TestEvents = {
  'test:event': { data: string };
  'user:login': { userId: string };
};

describe('Event Bus', () => {
  let eventBus: InstanceType<ReturnType<typeof createEventBusClass<TestEvents>>>;

  // Mock handlers for testing
  let mockHandler1: (payload: { data: string }) => void;
  let mockHandler2: (payload: { data: string }) => void;
  let loginHandler: (payload: { userId: string }) => void;

  beforeEach(() => {
    // Create a new EventBus instance for each test
    const EventBusClass = createEventBusClass<TestEvents>();
    eventBus = new EventBusClass('TestEventBus');

    // Reset mocks before each test
    mockHandler1 = vi.fn();
    mockHandler2 = vi.fn();
    loginHandler = vi.fn();
  });

  // Use Effect Vitest runner with 'it'
  it('should register an event handler and emit events to it', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      const unsubscribe = yield* $(service.on('test:event', mockHandler1));
      yield* $(service.emit('test:event', { data: 'test data' }));

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(mockHandler1).toHaveBeenCalledWith({ data: 'test data' });

      yield* $(unsubscribe);
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));

  it('should register multiple handlers for the same event', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      const unsub1 = yield* $(service.on('test:event', mockHandler1));
      const unsub2 = yield* $(service.on('test:event', mockHandler2));
      const payload = { data: 'test data' };
      yield* $(service.emit('test:event', payload));

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(mockHandler1).toHaveBeenCalledWith(payload);
      expect(mockHandler2).toHaveBeenCalledTimes(1);
      expect(mockHandler2).toHaveBeenCalledWith(payload);

      yield* $(unsub1);
      yield* $(unsub2);
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));

  it('should not trigger handlers for different events', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      const unsub1 = yield* $(service.on('test:event', mockHandler1));
      const unsub2 = yield* $(service.on('user:login', loginHandler));
      yield* $(service.emit('test:event', { data: 'test data' }));

      expect(mockHandler1).toHaveBeenCalledTimes(1);
      expect(loginHandler).not.toHaveBeenCalled();

      yield* $(unsub1);
      yield* $(unsub2);
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));

  it('should unregister a specific handler with off method', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      const unsub1 = yield* $(service.on('test:event', mockHandler1));
      const unsub2 = yield* $(service.on('test:event', mockHandler2));

      yield* $(service.off('test:event', mockHandler1));

      const payload = { data: 'test data' };
      yield* $(service.emit('test:event', payload));

      expect(mockHandler1).not.toHaveBeenCalled();
      expect(mockHandler2).toHaveBeenCalledTimes(1);

      yield* $(unsub1);
      yield* $(unsub2);
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));

  it('should unregister a handler using the returned effect', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      const unsubscribe = yield* $(service.on('test:event', mockHandler1));

      yield* $(unsubscribe);

      const payload = { data: 'test data' };
      yield* $(service.emit('test:event', payload));

      expect(mockHandler1).not.toHaveBeenCalled();
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));

  it('should handle events with the correct payload types', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      const unsub1 = yield* $(service.on('test:event', mockHandler1));
      const unsub2 = yield* $(service.on('user:login', loginHandler));

      const testPayload = { data: 'test data' };
      const loginPayload = { userId: 'user123' };

      yield* $(service.emit('test:event', testPayload));
      yield* $(service.emit('user:login', loginPayload));

      expect(mockHandler1).toHaveBeenCalledWith(testPayload);
      expect(loginHandler).toHaveBeenCalledWith(loginPayload);

      yield* $(unsub1);
      yield* $(unsub2);
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));

  it('should do nothing when emitting to an event with no handlers', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      const payload = { data: 'test data' };
      yield* $(service.emit('test:event', payload));
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));

  it('should do nothing when trying to unregister a non-existent handler', () =>
    Effect.gen(function* ($) {
      const service = yield* $(eventBus.Tag);
      yield* $(service.off('test:event', mockHandler1));
    }).pipe(Effect.provide(eventBus.Live), Effect.asVoid));
});
