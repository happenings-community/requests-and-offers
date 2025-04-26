import type { UIRequest, UIOffer } from '@lib/types/ui';
import { makeEventBusService } from '@utils/eventBus.effect';
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
};

const { Tag, Live } = makeEventBusService<StoreEvents>('StoreEventBus');

export { Tag as StoreEventBusTag, Live as StoreEventBusLive };
