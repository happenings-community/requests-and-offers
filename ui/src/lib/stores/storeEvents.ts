import type { UIRequest, UIOffer, UIServiceType, UIUser, UIOrganization } from '$lib/types/ui';
import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
import type { ActionHash } from '@holochain/client';

/**
 * Defines the map of events used for communication between stores.
 */
export type StoreEvents = {
  // Users
  'user:created': { user: UIUser };
  'user:updated': { user: UIUser }; // Only for actual profile updates
  'user:loaded': { user: UIUser }; // For caching/loading user data from DHT
  'user:synced': { user: UIUser }; // For current user state synchronization
  'user:deleted': { userHash: ActionHash };

  // Organizations
  'organization:created': { organization: UIOrganization };
  'organization:updated': { organization: UIOrganization };
  'organization:deleted': { organizationHash: ActionHash };

  // Requests
  'request:created': { request: UIRequest };
  'request:updated': { request: UIRequest };
  'request:deleted': { requestHash: ActionHash };

  // Offers
  'offer:created': { offer: UIOffer };
  'offer:updated': { offer: UIOffer };
  'offer:deleted': { offerHash: ActionHash };

  // Service Types
  'serviceType:created': { serviceType: UIServiceType };
  'serviceType:updated': { serviceType: UIServiceType };
  'serviceType:deleted': { serviceTypeHash: ActionHash };
  'serviceType:suggested': { serviceType: UIServiceType };
  'serviceType:approved': { serviceType: UIServiceType };
  'serviceType:rejected': { serviceType: UIServiceType };

  // Mediums of Exchange
  'mediumOfExchange:suggested': { mediumOfExchange: UIMediumOfExchange };
  'mediumOfExchange:approved': { mediumOfExchange: UIMediumOfExchange };
  'mediumOfExchange:rejected': { mediumOfExchange: UIMediumOfExchange };
};

/**
 * Event handler function type
 */
export type EventHandler<T = any> = (payload: T) => void;

/**
 * Simple, clean event bus for inter-store communication.
 * Uses a singleton pattern for global accessibility.
 */
class StoreEventBus {
  private handlers = new Map<keyof StoreEvents, Set<EventHandler<any>>>();

  /**
   * Subscribe to an event
   */
  on<K extends keyof StoreEvents>(event: K, handler: EventHandler<StoreEvents[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const eventHandlers = this.handlers.get(event)!;
    eventHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * Emit an event to all subscribers
   */
  emit<K extends keyof StoreEvents>(event: K, payload: StoreEvents[K]): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`Error in event handler for ${String(event)}:`, error);
        }
      });
    }
  }

  /**
   * Remove a specific handler
   */
  off<K extends keyof StoreEvents>(event: K, handler: EventHandler<StoreEvents[K]>): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Clear all handlers for an event
   */
  clear<K extends keyof StoreEvents>(event: K): void {
    this.handlers.delete(event);
  }

  /**
   * Clear all handlers for all events
   */
  clearAll(): void {
    this.handlers.clear();
  }

  /**
   * Get debug info about current subscriptions
   */
  getDebugInfo(): Record<string, number> {
    const info: Record<string, number> = {};
    this.handlers.forEach((handlers, event) => {
      info[String(event)] = handlers.size;
    });
    return info;
  }
}

// Create and export the singleton instance
export const storeEventBus = new StoreEventBus();

// Export the type for dependency injection in tests if needed
export type StoreEventBusType = typeof storeEventBus;
