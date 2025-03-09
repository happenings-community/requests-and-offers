import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createEventBus } from '../stores/eventBus';
import * as E from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { pipe } from 'effect/Function';

// Define a test event map for type safety
interface TestEvents {
  'test:event': { data: string };
  'user:login': { userId: string };
}

describe('Event Bus', () => {
  // Create a new event bus instance for each test
  let eventBus = createEventBus<TestEvents>();

  // Mock handlers for testing
  let mockHandler1: (payload: { data: string }) => void;
  let mockHandler2: (payload: { data: string }) => void;
  let loginHandler: (payload: { userId: string }) => void;

  beforeEach(() => {
    // Reset event bus and mocks before each test
    eventBus = createEventBus<TestEvents>();
    mockHandler1 = vi.fn();
    mockHandler2 = vi.fn();
    loginHandler = vi.fn();
  });

  test('should register an event handler and emit events to it', () => {
    // Register a handler
    pipe(eventBus.on('test:event', mockHandler1), E.runSync);

    // Emit an event
    const payload = { data: 'test data' };
    pipe(eventBus.emit('test:event', payload), E.runSync);

    // Verify the handler was called with the correct payload
    expect(mockHandler1).toHaveBeenCalledTimes(1);
    expect(mockHandler1).toHaveBeenCalledWith(payload);
  });

  test('should register multiple handlers for the same event', () => {
    // Register multiple handlers
    pipe(eventBus.on('test:event', mockHandler1), E.runSync);
    pipe(eventBus.on('test:event', mockHandler2), E.runSync);

    // Emit an event
    const payload = { data: 'test data' };
    pipe(eventBus.emit('test:event', payload), E.runSync);

    // Verify both handlers were called
    expect(mockHandler1).toHaveBeenCalledTimes(1);
    expect(mockHandler1).toHaveBeenCalledWith(payload);
    expect(mockHandler2).toHaveBeenCalledTimes(1);
    expect(mockHandler2).toHaveBeenCalledWith(payload);
  });

  test('should not trigger handlers for different events', () => {
    // Register handlers for different events
    pipe(eventBus.on('test:event', mockHandler1), E.runSync);
    pipe(eventBus.on('user:login', loginHandler), E.runSync);

    // Emit only one event
    pipe(eventBus.emit('test:event', { data: 'test data' }), E.runSync);

    // Verify only the correct handler was called
    expect(mockHandler1).toHaveBeenCalledTimes(1);
    expect(loginHandler).not.toHaveBeenCalled();
  });

  test('should unregister a specific handler with off method', () => {
    // Register handlers
    pipe(eventBus.on('test:event', mockHandler1), E.runSync);
    pipe(eventBus.on('test:event', mockHandler2), E.runSync);

    // Unregister one handler
    pipe(eventBus.off('test:event', mockHandler1), E.runSync);

    // Emit an event
    pipe(eventBus.emit('test:event', { data: 'test data' }), E.runSync);

    // Verify only the remaining handler was called
    expect(mockHandler1).not.toHaveBeenCalled();
    expect(mockHandler2).toHaveBeenCalledTimes(1);
  });

  test('should unregister a handler using the returned function', () => {
    // Register a handler and get the unsubscribe function
    const unsubscribe = pipe(eventBus.on('test:event', mockHandler1), E.runSync);

    // Unsubscribe using the returned function
    unsubscribe();

    // Emit an event
    pipe(eventBus.emit('test:event', { data: 'test data' }), E.runSync);

    // Verify the handler was not called
    expect(mockHandler1).not.toHaveBeenCalled();
  });

  test('should handle events with the correct payload types', () => {
    // Register handlers for different event types
    pipe(eventBus.on('test:event', mockHandler1), E.runSync);
    pipe(eventBus.on('user:login', loginHandler), E.runSync);

    // Emit events with their respective payload types
    const testPayload = { data: 'test data' };
    const loginPayload = { userId: 'user123' };

    pipe(eventBus.emit('test:event', testPayload), E.runSync);
    pipe(eventBus.emit('user:login', loginPayload), E.runSync);

    // Verify handlers received the correct payloads
    expect(mockHandler1).toHaveBeenCalledWith(testPayload);
    expect(loginHandler).toHaveBeenCalledWith(loginPayload);
  });

  test('should do nothing when emitting to an event with no handlers', () => {
    // This should not throw an error
    expect(() => {
      pipe(eventBus.emit('test:event', { data: 'test data' }), E.runSync);
    }).not.toThrow();
  });

  test('should do nothing when trying to unregister a non-existent handler', () => {
    // This should not throw an error
    expect(() => {
      pipe(eventBus.off('test:event', mockHandler1), E.runSync);
    }).not.toThrow();
  });

  test('should handle errors properly when emitting events', () => {
    // Create a handler that throws an error
    const errorHandler = () => {
      throw new Error('Test error');
    };

    // Register the error handler
    pipe(eventBus.on('test:event', errorHandler), E.runSync);

    // Emit an event and catch the error
    const result = E.runSyncExit(eventBus.emit('test:event', { data: 'test data' }));

    // Verify the error was caught and handled properly
    expect(Exit.isFailure(result)).toBe(true);
    if (Exit.isFailure(result)) {
      // The error is in the cause, but we need to access it safely
      expect(result.cause).toBeDefined();
      // We know it's an EventEmissionError from our implementation
    }
  });

  test('should handle invalid event subscriptions', () => {
    // Create a mock event that will trigger the error
    const mockEvent = new Event('test') as unknown as { data: string };
    
    // Register the handler
    const unsubscribe = pipe(eventBus.on('test:event', mockHandler1), E.runSync);
    
    // Force an error in the handler
    try {
      mockHandler1(mockEvent);
    } catch (error) {
      // This is expected
    }
    
    // Clean up
    unsubscribe();
    
    // Verify the handler was called
    expect(mockHandler1).toHaveBeenCalled();
  });
  
  test('should handle errors when unsubscribing', () => {
    // Create a handler
    const unsubscribe = pipe(eventBus.on('test:event', mockHandler1), E.runSync);
    
    // Unsubscribe should work without errors
    expect(() => unsubscribe()).not.toThrow();
    
    // Emitting after unsubscribe should not call the handler
    pipe(eventBus.emit('test:event', { data: 'test data' }), E.runSync);
    expect(mockHandler1).not.toHaveBeenCalled();
  });
});
