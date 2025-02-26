import { expect, test, describe, vi, beforeEach } from 'vitest';
import { createEventBus } from '../stores/eventBus';

// Define a test event map for type safety
interface TestEvents {
  'test:event': { data: string };
  'user:login': { userId: string };
}

describe('Event Bus', () => {
  // Create a new event bus instance for each test
  const eventBus = createEventBus<TestEvents>();

  // Mock handlers for testing
  let mockHandler1: (payload: { data: string }) => void;
  let mockHandler2: (payload: { data: string }) => void;
  let loginHandler: (payload: { userId: string }) => void;

  beforeEach(() => {
    // Reset mocks before each test
    mockHandler1 = vi.fn();
    mockHandler2 = vi.fn();
    loginHandler = vi.fn();
  });

  test('should register an event handler and emit events to it', () => {
    // Register a handler
    eventBus.on('test:event', mockHandler1);

    // Emit an event
    const payload = { data: 'test data' };
    eventBus.emit('test:event', payload);

    // Verify the handler was called with the correct payload
    expect(mockHandler1).toHaveBeenCalledTimes(1);
    expect(mockHandler1).toHaveBeenCalledWith(payload);
  });

  test('should register multiple handlers for the same event', () => {
    // Register multiple handlers
    eventBus.on('test:event', mockHandler1);
    eventBus.on('test:event', mockHandler2);

    // Emit an event
    const payload = { data: 'test data' };
    eventBus.emit('test:event', payload);

    // Verify both handlers were called
    expect(mockHandler1).toHaveBeenCalledTimes(1);
    expect(mockHandler1).toHaveBeenCalledWith(payload);
    expect(mockHandler2).toHaveBeenCalledTimes(1);
    expect(mockHandler2).toHaveBeenCalledWith(payload);
  });

  test('should not trigger handlers for different events', () => {
    // Register handlers for different events
    eventBus.on('test:event', mockHandler1);
    eventBus.on('user:login', loginHandler);

    // Emit only one event
    eventBus.emit('test:event', { data: 'test data' });

    // Verify only the correct handler was called
    expect(mockHandler1).toHaveBeenCalledTimes(1);
    expect(loginHandler).not.toHaveBeenCalled();
  });

  test('should unregister a specific handler with off method', () => {
    // Register handlers
    eventBus.on('test:event', mockHandler1);
    eventBus.on('test:event', mockHandler2);

    // Unregister one handler
    eventBus.off('test:event', mockHandler1);

    // Emit an event
    eventBus.emit('test:event', { data: 'test data' });

    // Verify only the remaining handler was called
    expect(mockHandler1).not.toHaveBeenCalled();
    expect(mockHandler2).toHaveBeenCalledTimes(1);
  });

  test('should unregister a handler using the returned function', () => {
    // Register a handler and get the unsubscribe function
    const unsubscribe = eventBus.on('test:event', mockHandler1);

    // Unsubscribe using the returned function
    unsubscribe();

    // Emit an event
    eventBus.emit('test:event', { data: 'test data' });

    // Verify the handler was not called
    expect(mockHandler1).not.toHaveBeenCalled();
  });

  test('should handle events with the correct payload types', () => {
    // Register handlers for different event types
    eventBus.on('test:event', mockHandler1);
    eventBus.on('user:login', loginHandler);

    // Emit events with their respective payload types
    const testPayload = { data: 'test data' };
    const loginPayload = { userId: 'user123' };

    eventBus.emit('test:event', testPayload);
    eventBus.emit('user:login', loginPayload);

    // Verify handlers received the correct payloads
    expect(mockHandler1).toHaveBeenCalledWith(testPayload);
    expect(loginHandler).toHaveBeenCalledWith(loginPayload);
  });

  test('should do nothing when emitting to an event with no handlers', () => {
    // This should not throw an error
    expect(() => {
      eventBus.emit('test:event', { data: 'test data' });
    }).not.toThrow();
  });

  test('should do nothing when trying to unregister a non-existent handler', () => {
    // This should not throw an error
    expect(() => {
      eventBus.off('test:event', mockHandler1);
    }).not.toThrow();
  });
});
