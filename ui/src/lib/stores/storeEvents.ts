import type { UIRequest, UIOffer, UIServiceType } from '$lib/types/ui';
import { createEventBusTag, createEventBusLiveLayer } from '$lib/utils/eventBus.effect';
import type { ActionHash } from '@holochain/client';

/**
 * Defines the map of events used for communication between stores.
 */
export type StoreEvents = {
  'request:created': { request: UIRequest };
  'request:updated': { request: UIRequest };
  'request:deleted': { requestHash: ActionHash };
  'offer:created': { offer: UIOffer };
  'offer:updated': { offer: UIOffer };
  'offer:deleted': { offerHash: ActionHash };
  'serviceType:created': { serviceType: UIServiceType };
  'serviceType:updated': { serviceType: UIServiceType };
  'serviceType:deleted': { serviceTypeHash: ActionHash };
};

const StoreEventBusTag = createEventBusTag<StoreEvents>('StoreEventBus');
const StoreEventBusLive = createEventBusLiveLayer(StoreEventBusTag);

export { StoreEventBusTag, StoreEventBusLive };
