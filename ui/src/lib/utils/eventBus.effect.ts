/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Context from '@effect/data/Context';
import * as Effect from '@effect/io/Effect';
import * as Layer from '@effect/io/Layer';
import * as Ref from '@effect/io/Ref';
import * as HashSet from '@effect/data/HashSet';

// --- Core Types ---

/**
 * Base type for event maps.
 * Serves as a generic constraint for event types.
 */
export type EventMap = Record<string, any>;

/**
 * Type definition for event handler functions.
 * Handlers are synchronous void functions.
 * @template T The payload type for the event.
 */
export type EventHandler<T = any> = (payload: T) => void;

// --- Service Definition ---

/**
 * Interface defining the Effect-based event bus service API.
 * @template T The event map type containing event names and their payload types.
 */
export interface EventBusService<T extends EventMap> {
  /**
   * Subscribe to an event.
   * Returns an Effect that resolves to the unsubscribe Effect.
   * @template K The event name (key in the event map).
   * @param event The event name to subscribe to.
   * @param handler The callback function to execute when the event occurs.
   * @returns An Effect containing the Effect to unsubscribe the handler.
   */
  readonly on: <K extends keyof T>(
    event: K,
    handler: EventHandler<T[K]>
  ) => Effect.Effect<never, never, Effect.Effect<never, never, void>>; // Explicit Error/Requirement types

  /**
   * Emit an event with a payload.
   * @template K The event name (key in the event map).
   * @param event The event name to emit.
   * @param payload The data to pass to event handlers.
   * @returns An Effect that completes when all handlers have been notified.
   */
  readonly emit: <K extends keyof T>(event: K, payload: T[K]) => Effect.Effect<never, never, void>; // Explicit Error/Requirement types

  /**
   * Unsubscribe a handler from an event.
   * @template K The event name (key in the event map).
   * @param event The event name to unsubscribe from.
   * @param handler The handler function to remove.
   * @returns An Effect that completes when the handler is removed.
   */
  readonly off: <K extends keyof T>(
    event: K,
    handler: EventHandler<T[K]>
  ) => Effect.Effect<never, never, void>; // Explicit Error/Requirement types
}

// --- Tag Factory ---

/**
 * Creates a Context.Tag for an EventBusService with a specific EventMap.
 * @template T The specific EventMap for this bus instance.
 * @param identifier A unique string identifier for this event bus service tag.
 * @returns A Context.Tag for the EventBusService<T>.
 */
export const createEventBusTag = <T extends EventMap>(
  identifier: string
): Context.Tag<EventBusService<T>, EventBusService<T>> =>
  Context.Tag<EventBusService<T>>(identifier);

// --- Live Layer Factory ---

/**
 * Creates a Live Layer for an EventBusService Tag.
 * This layer provides the actual implementation managing the event handlers.
 * @template T The specific EventMap for this bus instance.
 * @param tag The Context.Tag created by createEventBusTag.
 * @returns A Layer providing the live implementation of EventBusService<T>.
 */
export const createEventBusLiveLayer = <T extends EventMap>(
  tag: Context.Tag<EventBusService<T>, EventBusService<T>>
): Layer.Layer<never, never, EventBusService<T>> =>
  Layer.effect(
    tag,
    Effect.gen(function* ($) {
      // Ref to store handlers: Map<EventKey, HashSet<EventHandler>>
      const handlersRef = yield* $(
        Ref.make(new Map<keyof T, HashSet.HashSet<EventHandler<any>>>())
      );

      const off = <K extends keyof T>(
        event: K,
        handler: EventHandler<T[K]>
      ): Effect.Effect<never, never, void> =>
        Ref.update(handlersRef, (handlers) => {
          const currentHandlers = handlers.get(event);
          if (currentHandlers) {
            const updatedHandlers = HashSet.remove(currentHandlers, handler);
            // Clean up map entry if no handlers remain
            if (HashSet.size(updatedHandlers) === 0) {
              handlers.delete(event);
            } else {
              handlers.set(event, updatedHandlers);
            }
          }
          // Return the modified map (or original if no changes)
          return new Map(handlers); // Ensure immutability if necessary, though Ref handles atomicity
        });

      const on = <K extends keyof T>(
        event: K,
        handler: EventHandler<T[K]>
      ): Effect.Effect<never, never, Effect.Effect<never, never, void>> =>
        Effect.map(
          Ref.update(handlersRef, (handlers) => {
            const currentHandlers = handlers.get(event) ?? HashSet.empty<EventHandler<any>>();
            handlers.set(event, HashSet.add(currentHandlers, handler));
            // Return the modified map
            return new Map(handlers);
          }),
          // Return the specific 'off' effect for this subscription
          () => off(event, handler)
        );

      const emit = <K extends keyof T>(
        event: K,
        payload: T[K]
      ): Effect.Effect<never, never, void> =>
        Effect.flatMap(Ref.get(handlersRef), (handlers) => {
          const eventHandlers = handlers.get(event);
          if (eventHandlers && HashSet.size(eventHandlers) > 0) {
            // Iterate over the HashSet and execute handlers synchronously within Effect
            return Effect.forEach(eventHandlers, (handler) => Effect.sync(() => handler(payload)), {
              concurrency: 'unbounded', // Allow handlers to run concurrently if needed, though they are sync
              discard: true
            });
          }
          // If no handlers, return a completed void Effect
          return Effect.succeed(void 0);
        });

      // Construct and return the service implementation object
      return tag.of({
        // Use tag.of for better type inference potentially, or just return the object
        on,
        emit,
        off
      });
    })
  );
