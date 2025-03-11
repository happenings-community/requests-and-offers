/* eslint-disable @typescript-eslint/no-explicit-any */
import type { UIRequest } from '@/types/ui';
import type { ActionHash } from '@holochain/client';

// Application-specific events (only these events are allowed)
export interface AppEvents {
  'request:created': { request: UIRequest };
  'request:updated': { request: UIRequest };
  'request:deleted': { requestHash: ActionHash };
}

/**
 * Type definition for event handler functions
 * @template T The payload type for the event
 */
export type EventHandler<T> = (payload: T) => void;

/**
 * Base type for event maps
 * Serves as a generic constraint for event types
 */
type EventMap = { [key: string]: any }; // Base constraint, refined by AppEvents

/**
 * Interface defining the event bus API
 * @template T The event map type containing event names and their payload types
 */
export interface EventBus<T extends EventMap> {
  /**
   * Subscribe to an event
   * @template K The event name (key in the event map)
   * @param event The event name to subscribe to
   * @param handler The callback function to execute when the event occurs
   * @returns A cleanup function to unsubscribe the handler
   */
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void;

  /**
   * Emit an event with a payload
   * @template K The event name (key in the event map)
   * @param event The event name to emit
   * @param payload The data to pass to event handlers
   */
  emit<K extends keyof T>(event: K, payload: T[K]): void;

  /**
   * Unsubscribe a handler from an event
   * @template K The event name (key in the event map)
   * @param event The event name to unsubscribe from
   * @param handler The handler function to remove
   */
  off<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void;
}

/**
 * Creates a new event bus with type-safe event handling
 * @template T The event map type containing event names and their payload types
 * @returns An event bus instance with on, emit, and off methods
 */
export function createEventBus<T extends EventMap>(): EventBus<T> {
  // Map to store event handlers for each event type
  const handlers = new Map<keyof T, Set<EventHandler<any>>>();

  /**
   * Subscribe to an event with a handler function
   * @template K The event name (key in the event map)
   * @param event The event name to subscribe to
   * @param handler The callback function to execute when the event occurs
   * @returns A cleanup function to unsubscribe the handler
   */
  const on = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): (() => void) => {
    let eventHandlers = handlers.get(event);
    if (!eventHandlers) {
      eventHandlers = new Set();
      handlers.set(event, eventHandlers);
    }
    eventHandlers.add(handler);
    return () => off(event, handler);
  };

  /**
   * Unsubscribe a handler from an event
   * @template K The event name (key in the event map)
   * @param event The event name to unsubscribe from
   * @param handler The handler function to remove
   */
  const off = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): void => {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) handlers.delete(event);
    }
  };

  /**
   * Emit an event with a payload
   * @template K The event name (key in the event map)
   * @param event The event name to emit
   * @param payload The data to pass to event handlers
   */
  const emit = <K extends keyof T>(event: K, payload: T[K]): void => {
    handlers.get(event)?.forEach((handler) => handler(payload));
  };

  return { on, emit, off };
}

/**
 * Application-wide event bus instance
 * Use this to communicate between components without direct coupling
 */
const eventBus = createEventBus<AppEvents>();

export default eventBus;
