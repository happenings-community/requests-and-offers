import { Effect as E, Layer, pipe } from 'effect';
import { vi } from 'vitest';
import type { EventBusService } from '$lib/utils/eventBus.effect';
import type { StoreEvents } from '$lib/stores/storeEvents';
import { StoreEventBusTag } from '$lib/stores/storeEvents';

// Define type for event handlers to avoid casting
export type EventHandler<T> = (payload: T) => void;

// Define the type for emitted events
export type EmittedEvent<T extends StoreEvents = StoreEvents> = {
  event: keyof T;
  payload: T[keyof T];
};

// Define the enhanced mock service type with testing utilities
type MockEventBusService<T extends StoreEvents = StoreEvents> = EventBusService<T> & {
  __getEmittedEvents: () => EmittedEvent<T>[];
  __getListeners: () => Record<string, Array<EventHandler<unknown>>>;
  __clearEmittedEvents: () => void;
};

/**
 * Creates a mock EventBus service for testing with synchronous event handling
 */
export const createMockEventBusService = (): MockEventBusService<StoreEvents> => {
  // Store listeners and emitted events for testing
  const listeners: Record<string, Array<EventHandler<unknown>>> = {};
  const emittedEvents: EmittedEvent<StoreEvents>[] = [];
  
  // Mock implementation of emit that records events and calls handlers synchronously
  const emitMock = vi.fn(<K extends keyof StoreEvents>(event: K, payload: StoreEvents[K]) => {
    // Record the emitted event
    emittedEvents.push({event, payload});
    
    // Get listeners for this event
    const eventListeners = listeners[event as string] || [];
    
    // Call all listeners synchronously
    eventListeners.forEach(listener => listener(payload));
    
    // Return a successful Effect
    return E.succeed(E.void);
  });
  
  // Mock implementation of on that registers handlers
  const onMock = vi.fn(<K extends keyof StoreEvents>(event: K, handler: EventHandler<StoreEvents[K]>) => {
    if (!listeners[event as string]) {
      listeners[event as string] = [];
    }
    // We need to cast here because we're storing handlers for different event types in the same array
    listeners[event as string].push(handler as EventHandler<unknown>);
    
    // Return a successful Effect
    return E.succeed(E.void);
  });
  
  // Mock implementation of off that removes handlers
  const offMock = vi.fn(<K extends keyof StoreEvents>(event: K, handler: EventHandler<StoreEvents[K]>) => {
    if (listeners[event as string]) {
      const index = listeners[event as string].indexOf(handler as EventHandler<unknown>);
      if (index !== -1) {
        listeners[event as string].splice(index, 1);
      }
    }
    
    // Return a successful Effect
    return E.succeed(E.void);
  });
  
  // Create the service with testing utilities
  return {
    emit: emitMock,
    on: onMock,
    off: offMock,
    __getEmittedEvents: () => emittedEvents,
    __getListeners: () => listeners,
    __clearEmittedEvents: () => { emittedEvents.length = 0; }
  };
};

// Store a reference to the mock service for direct access in tests
let currentMockEventBus: ReturnType<typeof createMockEventBusService>;

/**
 * Creates a mock EventBus Layer for testing
 */
export const createMockEventBusLayer = () => {
  currentMockEventBus = createMockEventBusService();
  
  return Layer.succeed(
    StoreEventBusTag,
    currentMockEventBus
  );
};

/**
 * Helper to access the mock EventBus service from a test
 */
export const getMockEventBus = () => {
  return pipe(
    StoreEventBusTag,
    E.map(eventBus => eventBus as ReturnType<typeof createMockEventBusService>)
  );
};

/**
 * Get the current mock EventBus service instance
 * This allows direct access to the mock outside of Effect context
 */
export const getCurrentMockEventBus = () => {
  return currentMockEventBus;
};

/**
 * Get all events emitted on the current mock EventBus
 */
export const getEmittedEvents = (): EmittedEvent<StoreEvents>[] => {
  return currentMockEventBus.__getEmittedEvents();
};

/**
 * Clear all emitted events on the current mock EventBus
 */
export const clearEmittedEvents = (): void => {
  currentMockEventBus.__clearEmittedEvents();
};

/**
 * Get all registered listeners on the current mock EventBus
 */
export const getEventListeners = (): Record<string, Array<EventHandler<unknown>>> => {
  return currentMockEventBus.__getListeners();
};
