/* eslint-disable @typescript-eslint/no-explicit-any */
import { Effect as E, Layer, Ref, Context, Data, HashSet, pipe } from 'effect';

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

/**
 * Error types for event bus operations
 */
export class EventBusError extends Data.TaggedError('EventBusError')<{
  code: string;
  message: string;
  cause?: unknown;
}> {
  static unsubscriptionError(event: string, error: unknown): EventBusError {
    return new EventBusError({
      code: 'UNSUBSCRIBE_ERROR',
      message: `Failed to unsubscribe from event "${event}"`,
      cause: error
    });
  }

  static subscriptionError(event: string, error: unknown): EventBusError {
    return new EventBusError({
      code: 'SUBSCRIBE_ERROR',
      message: `Failed to subscribe to event "${event}"`,
      cause: error
    });
  }

  static emitError(event: string, error: unknown): EventBusError {
    return new EventBusError({
      code: 'EMIT_ERROR',
      message: `Failed to emit event "${event}"`,
      cause: error
    });
  }
}

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
  ) => E.Effect<E.Effect<void, EventBusError>, EventBusError, unknown>;

  /**
   * Emit an event with a payload.
   * @template K The event name (key in the event map).
   * @param event The event name to emit.
   * @param payload The data to pass to event handlers.
   * @returns An Effect that completes when all handlers have been notified.
   */
  readonly emit: <K extends keyof T>(
    event: K,
    payload: T[K]
  ) => E.Effect<void, EventBusError, unknown>;

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
  ) => E.Effect<void, EventBusError, unknown>;
}

// --- Tag Factory ---

/**
 * Creates a Context.Tag for an EventBusService with a specific EventMap.
 * @template T The specific EventMap for this bus instance.
 * @param identifier A unique string identifier for this event bus service tag.
 * @returns A Context.Tag for the EventBusService<T>.
 */
export const createEventBusTag = <T extends EventMap>(identifier: string) =>
  Context.GenericTag<EventBusService<T>>(identifier);

// --- Live Layer Factory ---

/**
 * Creates a Live Layer for an EventBusService Tag.
 * This layer provides the actual implementation managing the event handlers.
 * @template T The specific EventMap for this bus instance.
 * @param tag The Context.Tag created by createEventBusTag.
 * @returns A Layer providing the live implementation of EventBusService<T>.
 */
export const createEventBusLiveLayer = <T extends EventMap>(
  tag: ReturnType<typeof createEventBusTag<T>>
): Layer.Layer<EventBusService<T>> =>
  Layer.effect(
    tag,
    E.gen(function* ($) {
      // Ref to store handlers: Map<EventKey, HashSet<EventHandler>>
      const handlersRef = yield* $(
        Ref.make(new Map<keyof T, HashSet.HashSet<EventHandler<any>>>())
      );

      const off = <K extends keyof T>(
        event: K,
        handler: EventHandler<T[K]>
      ): E.Effect<void, EventBusError> =>
        pipe(
          E.gen(function* ($) {
            // Update the handlers map atomically
            yield* $(
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
                // Return the modified map
                return new Map(handlers);
              })
            );
          }),
          E.catchAll((error: unknown) =>
            E.fail(EventBusError.unsubscriptionError(String(event), error))
          )
        );

      const on = <K extends keyof T>(
        event: K,
        handler: EventHandler<T[K]>
      ): E.Effect<E.Effect<void, EventBusError>, EventBusError> =>
        pipe(
          E.gen(function* ($) {
            // Update the handlers map with the new handler
            yield* $(
              Ref.update(handlersRef, (handlers) => {
                const currentHandlers = handlers.get(event) ?? HashSet.empty<EventHandler<any>>();
                handlers.set(event, HashSet.add(currentHandlers, handler));
                // Return the modified map
                return new Map(handlers);
              })
            );

            // Return the off effect for this specific subscription
            return off(event, handler);
          }),
          E.catchAll((error: unknown) =>
            E.fail(EventBusError.subscriptionError(String(event), error))
          )
        );

      const emit = <K extends keyof T>(event: K, payload: T[K]): E.Effect<void, EventBusError> =>
        pipe(
          E.gen(function* ($) {
            // Get the handlers map from the ref
            const handlers = yield* $(Ref.get(handlersRef));

            // Get event handlers for this specific event
            const eventHandlers = handlers.get(event);

            // If no handlers or empty set, return immediately
            if (!eventHandlers || HashSet.size(eventHandlers) === 0) {
              return void 0;
            }

            // Execute all handlers concurrently
            yield* $(
              E.forEach(
                eventHandlers,
                (handler) =>
                  pipe(
                    E.sync(() => handler(payload)),
                    E.catchAll((error: unknown) => {
                      // Log error but continue processing other handlers
                      console.error(`Handler error for event ${String(event)}:`, error);
                      return E.succeed(void 0);
                    })
                  ),
                {
                  concurrency: 'unbounded',
                  discard: true
                }
              )
            );
          }),
          E.catchAll((error: unknown) => E.fail(EventBusError.emitError(String(event), error)))
        );

      // Construct and return the service implementation object
      return tag.of({
        on,
        emit,
        off
      });
    })
  );

// --- Error Handling Utilities ---

/**
 * Wraps an EventBusService with default error handling
 * @template T The event map type
 * @param eventBus The original event bus service
 * @param errorHandler Optional custom error handler
 * @returns A wrapped EventBusService with standardized error handling
 */
export const withErrorHandling = <T extends EventMap>(
  eventBus: EventBusService<T>,
  errorHandler: (error: EventBusError) => E.Effect<void, never, unknown> = (error) =>
    E.sync(() => console.error(`EventBus Error: ${error.message}`, error.cause))
): EventBusService<T> => {
  return {
    on: <K extends keyof T>(event: K, handler: EventHandler<T[K]>) =>
      pipe(
        eventBus.on(event, handler),
        E.catchAll((error: EventBusError) =>
          pipe(
            errorHandler(error),
            E.map(() => E.succeed(void 0))
          )
        )
      ),

    emit: <K extends keyof T>(event: K, payload: T[K]) =>
      pipe(
        eventBus.emit(event, payload),
        E.catchAll((error: EventBusError) =>
          pipe(
            errorHandler(error),
            E.map(() => void 0)
          )
        )
      ),

    off: <K extends keyof T>(event: K, handler: EventHandler<T[K]>) =>
      pipe(
        eventBus.off(event, handler),
        E.catchAll((error: EventBusError) =>
          pipe(
            errorHandler(error),
            E.map(() => void 0)
          )
        )
      )
  };
};
