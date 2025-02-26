// Application-specific events (only these events are allowed)
interface AppEvents {
  'user:login': { userId: string };
}

// Define event handler type
type EventHandler<T> = (payload: T) => void;

// EventMap as a generic constraint (no need for Record with index signature removed)
type EventMap = { [key: string]: any }; // Base constraint, refined by AppEvents

// EventBus interface with strict typing
interface EventBus<T extends EventMap> {
  on<K extends keyof T>(event: K, handler: EventHandler<T[K]>): () => void;
  emit<K extends keyof T>(event: K, payload: T[K]): void;
  off<K extends keyof T>(event: K, handler: EventHandler<T[K]>): void;
}

// Create event bus with minimal implementation
export function createEventBus<T extends EventMap>(): EventBus<T> {
  const handlers = new Map<keyof T, Set<EventHandler<any>>>();

  const on = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): (() => void) => {
    let eventHandlers = handlers.get(event);
    if (!eventHandlers) {
      eventHandlers = new Set();
      handlers.set(event, eventHandlers);
    }
    eventHandlers.add(handler);
    return () => off(event, handler);
  };

  const off = <K extends keyof T>(event: K, handler: EventHandler<T[K]>): void => {
    const eventHandlers = handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) handlers.delete(event);
    }
  };

  const emit = <K extends keyof T>(event: K, payload: T[K]): void => {
    handlers.get(event)?.forEach((handler) => handler(payload));
  };

  return { on, emit, off };
}

const eventBus = createEventBus<AppEvents>();

export default eventBus;
