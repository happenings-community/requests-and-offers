/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Ref from 'effect/Ref';
import * as HashSet from 'effect/HashSet';

// --- Core Types ---

/**
 * Base type for event maps.
 * Serves as a generic constraint for event types.
 */
export type EventMap = Record<string, any>;

/**
 * Type definition for event handler functions.
 * For now, handlers are synchronous void functions.
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
  on: <K extends keyof T>(
    event: K,
    handler: EventHandler<T[K]>
  ) => Effect.Effect<Effect.Effect<void>>;

  /**
   * Emit an event with a payload.
   * @template K The event name (key in the event map).
   * @param event The event name to emit.
   * @param payload The data to pass to event handlers.
   * @returns An Effect that completes when all handlers have been notified.
   */
  emit: <K extends keyof T>(event: K, payload: T[K]) => Effect.Effect<void>;

  /**
   * Unsubscribe a handler from an event.
   * @template K The event name (key in the event map).
   * @param event The event name to unsubscribe from.
   * @param handler The handler function to remove.
   * @returns An Effect that completes when the handler is removed.
   */
  off: <K extends keyof T>(event: K, handler: EventHandler<T[K]>) => Effect.Effect<void>;
}

// --- Factory Function ---

/**
 * Creates a Tag and a Live Layer for an EventBusService.
 * @template T The specific EventMap for this bus instance.
 * @returns An object containing the Tag and the Live Layer.
 */
export const makeEventBusService = <T extends EventMap>(identifier: string) => {
  // Create a Tag for the service type with the given identifier
  const Tag = Context.GenericTag<EventBusService<T>>(identifier);

  const Live = Layer.effect(
    Tag,
    Effect.gen(function* () {
      // Ref to store handlers: Map<EventKey, HashSet<EventHandler>>
      const handlersRef = yield* Ref.make(new Map<keyof T, HashSet.HashSet<EventHandler<any>>>());

      const off = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): Effect.Effect<void> =>
        Ref.update(handlersRef, (handlers) => {
          const currentHandlers = handlers.get(event);
          if (currentHandlers) {
            const updatedHandlers = HashSet.remove(currentHandlers, handler);
            if (HashSet.size(updatedHandlers) === 0) {
              handlers.delete(event);
            } else {
              handlers.set(event, updatedHandlers);
            }
          }
          return handlers;
        });

      const on = <K extends keyof T>(
        event: K,
        handler: EventHandler<T[K]>
      ): Effect.Effect<Effect.Effect<void>> =>
        Effect.map(
          Ref.update(handlersRef, (handlers) => {
            const currentHandlers = handlers.get(event) ?? HashSet.empty<EventHandler<any>>();
            handlers.set(event, HashSet.add(currentHandlers, handler));
            return handlers;
          }),
          () => off(event, handler) // Return the specific off effect for this subscription
        );

      const emit = <K extends keyof T>(event: K, payload: T[K]): Effect.Effect<void> =>
        Effect.flatMap(Ref.get(handlersRef), (handlers) => {
          const eventHandlers = handlers.get(event);
          if (eventHandlers) {
            // Iterate over the HashSet and execute handlers synchronously within Effect
            return Effect.forEach(eventHandlers, (handler) => Effect.sync(() => handler(payload)), {
              discard: true
            });
          }
          return Effect.void;
        });

      // Implement the EventBusService interface
      return Tag.of({
        on,
        emit,
        off
      });
    })
  );

  return { Tag, Live };
};
