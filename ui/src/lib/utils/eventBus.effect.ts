/* eslint-disable @typescript-eslint/no-explicit-any */
import { Effect as E, Layer, Ref, Context, Data, HashSet, pipe, Console } from 'effect';

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

// --- Class-Based Event Bus Management ---

/**
 * Abstract base class for creating event bus services with integrated tag and layer management.
 * Provides a convenient way to manage both the Context.Tag and Layer together.
 * @template T The event map type for this event bus.
 */
export abstract class EventBus<T extends EventMap> {
  /**
   * The Context.Tag for this event bus service.
   */
  public readonly Tag: Context.Tag<EventBusService<T>, EventBusService<T>>;

  /**
   * The Live Layer implementation for this event bus service.
   */
  public readonly Live: Layer.Layer<EventBusService<T>>;

  /**
   * Creates an EventBus instance with the specified identifier.
   * @param identifier A unique string identifier for this event bus.
   */
  constructor(identifier: string) {
    this.Tag = Context.GenericTag<EventBusService<T>>(identifier);
    this.Live = this.createLiveLayer();
  }

  /**
   * Creates the live layer implementation for this event bus.
   * @returns A Layer providing the live implementation of EventBusService<T>.
   */
  protected createLiveLayer(): Layer.Layer<EventBusService<T>> {
    return Layer.effect(
      this.Tag,
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
        return {
          on,
          emit,
          off
        };
      })
    );
  }

  /**
   * Creates a wrapped version of this event bus with enhanced error handling.
   * @param errorHandler Optional custom error handler function.
   * @returns A new EventBus instance with error handling.
   */
  public withErrorHandling(
    errorHandler: (error: EventBusError) => E.Effect<void, never, unknown> = (error) =>
      E.sync(() => console.error(`EventBus Error: ${error.message}`, error.cause))
  ): EventBus<T> {
    const originalTag = this.Tag;
    const originalLive = this.Live;

    return new (class extends EventBus<T> {
      constructor() {
        super(`${originalTag.key}_WithErrorHandling`);
      }

      protected createLiveLayer(): Layer.Layer<EventBusService<T>> {
        return Layer.effect(
          this.Tag,
          E.gen(function* ($) {
            const originalService = yield* $(originalTag);

            return {
              on: <K extends keyof T>(event: K, handler: EventHandler<T[K]>) =>
                pipe(
                  originalService.on(event, handler),
                  E.catchAll((error: EventBusError) =>
                    pipe(
                      errorHandler(error),
                      E.map(() => E.succeed(void 0))
                    )
                  )
                ),

              emit: <K extends keyof T>(event: K, payload: T[K]) =>
                pipe(
                  originalService.emit(event, payload),
                  E.tap(() => Console.log('emit', event, payload)),
                  E.catchAll((error: EventBusError) =>
                    pipe(
                      errorHandler(error),
                      E.map(() => void 0)
                    )
                  )
                ),

              off: <K extends keyof T>(event: K, handler: EventHandler<T[K]>) =>
                pipe(
                  originalService.off(event, handler),
                  E.catchAll((error: EventBusError) =>
                    pipe(
                      errorHandler(error),
                      E.map(() => void 0)
                    )
                  )
                )
            };
          })
        ).pipe(Layer.provide(originalLive));
      }
    })();
  }
}

export const createEventBusClass = <T extends EventMap>() => {
  return class extends EventBus<T> { };
};
