import type { UIRequest } from '@/types/ui';
import { createEventBus } from '@/utils/eventBus';
import type { ActionHash } from '@holochain/client';

export type StoreEvents = {
  'request:created': { request: UIRequest };
  'request:updated': { request: UIRequest };
  'request:deleted': { requestHash: ActionHash };
};

export const storeEventBus = createEventBus<StoreEvents>();
export default storeEventBus;
