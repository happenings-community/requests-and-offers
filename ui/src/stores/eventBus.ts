import type { UIRequest } from '@/types/ui';
import type { ActionHash } from '@holochain/client';
import type { EventEmissionError, EventSubscriptionError } from '@/types/errors';
import * as E from 'effect/Effect';
import { pipe } from 'effect/Function';

// Application-specific events (only these events are allowed)
export interface AppEvents {
  'request:created': { request: UIRequest };
  'request:updated': { request: UIRequest };
  'request:deleted': { requestHash: ActionHash };
}

// Error creation functions
function createEventEmissionError(error: unknown, event: string): EventEmissionError {
  return {
    type: 'EventEmissionError',
    message: error instanceof Error ? error.message : String(error),
    details: error,
    _tag: 'EventEmissionError',
    name: 'EventEmissionError',
    event
  };
}

function createEventSubscriptionError(error: unknown, event: string): EventSubscriptionError {
  return {
    type: 'EventSubscriptionError',
    message: error instanceof Error ? error.message : String(error),
    details: error,
    _tag: 'EventSubscriptionError',
    name: 'EventSubscriptionError',
    event
  };
}

// Define event handler type
type EventHandler<T> = (payload: T) => void;

// EventBus interface with Effect-based operations
export interface EventBus<T> {
  on<K extends keyof T>(
    event: K,
    handler: EventHandler<T[K]>
  ): E.Effect<() => void, EventSubscriptionError>;
  emit<K extends keyof T>(event: K, payload: T[K]): E.Effect<void, EventEmissionError>;
  off<K extends keyof T>(
    event: K,
    handler: EventHandler<T[K]>
  ): E.Effect<void, EventSubscriptionError>;
}

// Create event bus with Effect-based implementation
export function createEventBus<T>(): EventBus<T> {
  const handlers = new Map<keyof T, Set<EventHandler<T[keyof T]>>>();

  const on = <K extends keyof T>(
    event: K,
    handler: EventHandler<T[K]>
  ): E.Effect<() => void, EventSubscriptionError> =>
    E.try({
      try: () => {
        let eventHandlers = handlers.get(event) as Set<EventHandler<T[K]>> | undefined;
        if (!eventHandlers) {
          eventHandlers = new Set<EventHandler<T[K]>>();
          handlers.set(event, eventHandlers as Set<EventHandler<T[keyof T]>>);
        }
        eventHandlers.add(handler);
        
        // Return a cleanup function that properly handles errors
        return () => {
          try {
            // Use a try-catch block to prevent unhandled errors
            const eventHandlers = handlers.get(event) as Set<EventHandler<T[K]>> | undefined;
            if (eventHandlers) {
              eventHandlers.delete(handler);
              if (eventHandlers.size === 0) handlers.delete(event);
            }
          } catch (error) {
            console.error(`Error unsubscribing from event ${String(event)}:`, error);
          }
        };
      },
      catch: (error) => createEventSubscriptionError(error, String(event))
    });

  const off = <K extends keyof T>(
    event: K,
    handler: EventHandler<T[K]>
  ): E.Effect<void, EventSubscriptionError> =>
    E.try({
      try: () => {
        const eventHandlers = handlers.get(event) as Set<EventHandler<T[K]>> | undefined;
        if (eventHandlers) {
          eventHandlers.delete(handler);
          if (eventHandlers.size === 0) handlers.delete(event);
        }
      },
      catch: (error) => createEventSubscriptionError(error, String(event))
    });

  const emit = <K extends keyof T>(event: K, payload: T[K]): E.Effect<void, EventEmissionError> =>
    E.try({
      try: () => {
        const eventHandlers = handlers.get(event) as Set<EventHandler<T[K]>> | undefined;
        if (eventHandlers) {
          eventHandlers.forEach((handler) => handler(payload));
        }
      },
      catch: (error) => createEventEmissionError(error, String(event))
    });

  return { on, emit, off };
}

const eventBus = createEventBus<AppEvents>();

export default eventBus;
