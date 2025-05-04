/* eslint-disable @typescript-eslint/no-explicit-any */
import { Effect, Layer } from 'effect';
import { vi } from 'vitest';
import { StoreEventBusTag } from '$lib/stores/storeEvents';
import type { EventBusService } from '$lib/utils/eventBus.effect';

/**
 * Creates a mock EventBus for testing purposes
 * Provides cleaner testing of event bus interactions without side effects
 */
export const createMockEventBus = <T extends Record<string, any>>() => {
  const handlers = new Map<string, Array<(payload: any) => void>>();
  const emitHistory: Array<{ event: string; payload: any }> = [];

  return {
    // Expose internal state for test assertions
    handlers,
    emitHistory,
    clearHistory: () => {
      emitHistory.length = 0;
    },

    // Create a mock service implementation
    service: {
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        if (!handlers.has(event)) {
          handlers.set(event, []);
        }
        handlers.get(event)!.push(handler);
        return Effect.succeed(
          Effect.sync(() => {
            const eventHandlers = handlers.get(event);
            if (eventHandlers) {
              const index = eventHandlers.indexOf(handler);
              if (index > -1) {
                eventHandlers.splice(index, 1);
              }
            }
          })
        );
      }),

      emit: vi.fn((event: string, payload: any) => {
        emitHistory.push({ event, payload });
        const eventHandlers = handlers.get(event) || [];
        eventHandlers.forEach((handler) => handler(payload));
        return Effect.succeed(undefined);
      }),

      off: vi.fn((event: string, handler: (payload: any) => void) => {
        const eventHandlers = handlers.get(event);
        if (eventHandlers) {
          const index = eventHandlers.indexOf(handler);
          if (index > -1) {
            eventHandlers.splice(index, 1);
          }
        }
        return Effect.succeed(undefined);
      })
    } as unknown as EventBusService<T>,

    // Create a Layer that can be provided to Effects
    mockLayer: Layer.succeed(
      StoreEventBusTag as any,
      {
        on: vi.fn((event: string, handler: (payload: any) => void) => {
          if (!handlers.has(event)) {
            handlers.set(event, []);
          }
          handlers.get(event)!.push(handler);
          return Effect.succeed(
            Effect.sync(() => {
              const eventHandlers = handlers.get(event);
              if (eventHandlers) {
                const index = eventHandlers.indexOf(handler);
                if (index > -1) {
                  eventHandlers.splice(index, 1);
                }
              }
            })
          );
        }),

        emit: vi.fn((event: string, payload: any) => {
          emitHistory.push({ event, payload });
          const eventHandlers = handlers.get(event) || [];
          eventHandlers.forEach((handler) => handler(payload));
          return Effect.succeed(undefined);
        }),

        off: vi.fn((event: string, handler: (payload: any) => void) => {
          const eventHandlers = handlers.get(event);
          if (eventHandlers) {
            const index = eventHandlers.indexOf(handler);
            if (index > -1) {
              eventHandlers.splice(index, 1);
            }
          }
          return Effect.succeed(undefined);
        })
      } as unknown as EventBusService<T>
    )
  };
};
