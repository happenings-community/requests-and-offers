import type { UIRequest, UIOffer, UIServiceType } from '$lib/types/ui';
import { createEventBusClass } from '$lib/utils/eventBus.effect';
import type { ActionHash } from '@holochain/client';

/**
 * Defines the map of events used for communication between stores.
 */
export type StoreEvents = {
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
  'serviceType:approved': { serviceTypeHash: ActionHash };
  'serviceType:rejected': { serviceTypeHash: ActionHash };
};

/**
 * Store Event Bus class for type-safe store-to-store communication.
 * Uses the new class-based EventBus approach for better organization.
 */
class StoreEventBusClass extends createEventBusClass<StoreEvents>() {
  constructor() {
    super('StoreEventBus');
  }
}

// Create singleton instance
const storeEventBus = new StoreEventBusClass();

// Export the tag and live layer for dependency injection
export const StoreEventBusTag = storeEventBus.Tag;
export const StoreEventBusLive = storeEventBus.Live;
