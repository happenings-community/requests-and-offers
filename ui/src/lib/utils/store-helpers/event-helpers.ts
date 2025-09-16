import type { ActionHash } from '../../../../../documentation/node_modules/@holochain/client/lib';
import { storeEventBus } from '$lib/stores/storeEvents';
import type {
  EventEmitter,
  EventEmitterConfig,
  CacheableEntity,
  EntityStatus
} from '$lib/types/store-helpers.js';

// ============================================================================
// EVENT EMITTER FACTORY
// ============================================================================

/**
 * Creates a standardized event emitter for a specific entity type
 *
 * @param config Configuration for the event emitter
 * @returns Event emitter interface with standardized methods
 *
 * @example
 * ```typescript
 * const serviceTypeEvents = createEventEmitterFactory({
 *   entityName: 'serviceType',
 *   includeStatusEvents: true
 * });
 *
 * // Usage
 * serviceTypeEvents.emitCreated(serviceType);
 * serviceTypeEvents.emitUpdated(serviceType);
 * serviceTypeEvents.emitDeleted(serviceTypeHash);
 * serviceTypeEvents.emitStatusChanged?.(serviceType);
 * ```
 */
export const createEventEmitterFactory = <TEntity extends CacheableEntity>(
  config: EventEmitterConfig
): EventEmitter<TEntity, ActionHash> => {
  const { entityName, includeStatusEvents = false } = config;

  const emitCreated = (entity: TEntity): void => {
    try {
      storeEventBus.emit(`${entityName}:created` as any, { [entityName]: entity });
    } catch (error) {
      console.error(`Failed to emit ${entityName}:created event:`, error);
    }
  };

  const emitUpdated = (entity: TEntity): void => {
    try {
      storeEventBus.emit(`${entityName}:updated` as any, { [entityName]: entity });
    } catch (error) {
      console.error(`Failed to emit ${entityName}:updated event:`, error);
    }
  };

  const emitDeleted = (entityHash: ActionHash): void => {
    try {
      storeEventBus.emit(`${entityName}:deleted` as any, { [`${entityName}Hash`]: entityHash });
    } catch (error) {
      console.error(`Failed to emit ${entityName}:deleted event:`, error);
    }
  };

  const emitStatusChanged = includeStatusEvents
    ? (entity: TEntity): void => {
        try {
          // Check if entity has status
          if ('status' in entity && typeof entity.status === 'string') {
            const status = entity.status as EntityStatus;
            // Emit both generic status change and specific status events
            storeEventBus.emit(`${entityName}:status:changed` as any, {
              [entityName]: entity,
              status
            });
            storeEventBus.emit(`${entityName}:${status}` as any, { [entityName]: entity });
          } else {
            storeEventBus.emit(`${entityName}:status:changed` as any, { [entityName]: entity });
          }
        } catch (error) {
          console.error(`Failed to emit ${entityName}:status:changed event:`, error);
        }
      }
    : undefined;

  return {
    emitCreated,
    emitUpdated,
    emitDeleted,
    ...(emitStatusChanged && { emitStatusChanged })
  };
};

// ============================================================================
// PREDEFINED EVENT EMITTERS
// ============================================================================

/**
 * Creates standard CRUD event emitters for common entity operations
 *
 * @param entityName Name of the entity (e.g., 'serviceType', 'request', 'offer')
 * @returns Standard event emitters
 */
export const createStandardEventEmitters = <TEntity extends CacheableEntity>(entityName: string) =>
  createEventEmitterFactory<TEntity>({ entityName, includeStatusEvents: false });

/**
 * Creates event emitters with status support for approval workflow entities
 *
 * @param entityName Name of the entity
 * @returns Event emitters with status change support
 */
export const createStatusAwareEventEmitters = <TEntity extends CacheableEntity>(
  entityName: string
) => createEventEmitterFactory<TEntity>({ entityName, includeStatusEvents: true });

// ============================================================================
// SPECIALIZED EVENT EMITTERS
// ============================================================================

/**
 * Creates event emitters for service types with approval workflow
 */
export const createServiceTypeEventEmitters = () => createStatusAwareEventEmitters('serviceType');

/**
 * Creates event emitters for requests
 */
export const createRequestEventEmitters = () => createStandardEventEmitters('request');

/**
 * Creates event emitters for offers
 */
export const createOfferEventEmitters = () => createStandardEventEmitters('offer');

/**
 * Creates event emitters for users with status support
 */
export const createUserEventEmitters = () => createStatusAwareEventEmitters('user');

/**
 * Creates event emitters for organizations with status support
 */
export const createOrganizationEventEmitters = () => createStatusAwareEventEmitters('organization');

/**
 * Creates event emitters for mediums of exchange with approval workflow
 */
export const createMediumOfExchangeEventEmitters = () =>
  createStatusAwareEventEmitters('mediumOfExchange');

// ============================================================================
// ADVANCED EVENT UTILITIES
// ============================================================================

/**
 * Creates a batch event emitter for multiple entities
 *
 * @param eventEmitter Single entity event emitter
 * @returns Batch event emitter
 */
export const createBatchEventEmitter = <TEntity extends CacheableEntity>(
  eventEmitter: EventEmitter<TEntity, ActionHash>
) => {
  return {
    emitMultipleCreated: (entities: TEntity[]): void => {
      entities.forEach((entity) => eventEmitter.emitCreated(entity));
    },
    emitMultipleUpdated: (entities: TEntity[]): void => {
      entities.forEach((entity) => eventEmitter.emitUpdated(entity));
    },
    emitMultipleDeleted: (entityHashes: ActionHash[]): void => {
      entityHashes.forEach((hash) => eventEmitter.emitDeleted(hash));
    },
    ...(eventEmitter.emitStatusChanged && {
      emitMultipleStatusChanged: (entities: TEntity[]): void => {
        entities.forEach((entity) => eventEmitter.emitStatusChanged!(entity));
      }
    })
  };
};

/**
 * Creates conditional event emitters that only emit when conditions are met
 *
 * @param eventEmitter Base event emitter
 * @param conditions Conditions for each event type
 * @returns Conditional event emitter
 */
export const createConditionalEventEmitter = <TEntity extends CacheableEntity>(
  eventEmitter: EventEmitter<TEntity, ActionHash>,
  conditions: {
    created?: (entity: TEntity) => boolean;
    updated?: (entity: TEntity) => boolean;
    deleted?: (entityHash: ActionHash) => boolean;
    statusChanged?: (entity: TEntity) => boolean;
  }
) => {
  return {
    emitCreated: (entity: TEntity): void => {
      if (!conditions.created || conditions.created(entity)) {
        eventEmitter.emitCreated(entity);
      }
    },
    emitUpdated: (entity: TEntity): void => {
      if (!conditions.updated || conditions.updated(entity)) {
        eventEmitter.emitUpdated(entity);
      }
    },
    emitDeleted: (entityHash: ActionHash): void => {
      if (!conditions.deleted || conditions.deleted(entityHash)) {
        eventEmitter.emitDeleted(entityHash);
      }
    },
    ...(eventEmitter.emitStatusChanged && {
      emitStatusChanged: (entity: TEntity): void => {
        if (!conditions.statusChanged || conditions.statusChanged(entity)) {
          eventEmitter.emitStatusChanged!(entity);
        }
      }
    })
  };
};

// ============================================================================
// EVENT LISTENING UTILITIES
// ============================================================================

/**
 * Creates standardized event listeners for entity lifecycle events
 *
 * @param entityName Name of the entity
 * @param handlers Event handler functions
 * @returns Cleanup function to unsubscribe from all events
 */
export const createEventSubscriptions = <TEntity extends CacheableEntity>(
  entityName: string,
  handlers: {
    created?: (entity: TEntity) => void;
    updated?: (entity: TEntity) => void;
    deleted?: (entityHash: ActionHash) => void;
    statusChanged?: (entity: TEntity, status?: EntityStatus) => void;
    approved?: (entity: TEntity) => void;
    rejected?: (entity: TEntity) => void;
    pending?: (entity: TEntity) => void;
  }
): (() => void) => {
  const unsubscribeFunctions: Array<() => void> = [];

  // Standard lifecycle events
  if (handlers.created) {
    const unsubscribe = storeEventBus.on(`${entityName}:created` as any, (payload) => {
      const entity = (payload as any)[entityName];
      if (entity) handlers.created!(entity);
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  if (handlers.updated) {
    const unsubscribe = storeEventBus.on(`${entityName}:updated` as any, (payload) => {
      const entity = (payload as any)[entityName];
      if (entity) handlers.updated!(entity);
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  if (handlers.deleted) {
    const unsubscribe = storeEventBus.on(`${entityName}:deleted` as any, (payload) => {
      const entityHash = (payload as any)[`${entityName}Hash`];
      if (entityHash) handlers.deleted!(entityHash);
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  // Status change events
  if (handlers.statusChanged) {
    const unsubscribe = storeEventBus.on(`${entityName}:status:changed` as any, (payload) => {
      const entity = (payload as any)[entityName];
      const status = (payload as any).status;
      if (entity) handlers.statusChanged!(entity, status);
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  // Specific status events
  if (handlers.approved) {
    const unsubscribe = storeEventBus.on(`${entityName}:approved` as any, (payload) => {
      const entity = (payload as any)[entityName];
      if (entity) handlers.approved!(entity);
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  if (handlers.rejected) {
    const unsubscribe = storeEventBus.on(`${entityName}:rejected` as any, (payload) => {
      const entity = (payload as any)[entityName];
      if (entity) handlers.rejected!(entity);
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  if (handlers.pending) {
    const unsubscribe = storeEventBus.on(`${entityName}:pending` as any, (payload) => {
      const entity = (payload as any)[entityName];
      if (entity) handlers.pending!(entity);
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  // Return cleanup function
  return () => {
    unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  };
};

// ============================================================================
// CROSS-DOMAIN EVENT UTILITIES
// ============================================================================

/**
 * Creates event emitters for cross-domain notifications
 * Used for events that affect multiple domains (e.g., user acceptance affects hREA)
 *
 * @param sourceDomain The domain emitting the event
 * @param targetDomains Domains that should be notified
 * @returns Cross-domain event emitter
 */
export const createCrossDomainEventEmitter = <TEntity extends CacheableEntity>(
  sourceDomain: string,
  targetDomains: string[]
) => {
  const emitCrossDomainEvent = (
    eventType: string,
    entity: TEntity,
    additionalData?: Record<string, unknown>
  ): void => {
    try {
      // Emit to source domain
      storeEventBus.emit(`${sourceDomain}:${eventType}` as any, {
        [sourceDomain]: entity,
        ...additionalData
      });

      // Emit to target domains
      targetDomains.forEach((targetDomain) => {
        storeEventBus.emit(`${targetDomain}:${sourceDomain}:${eventType}` as any, {
          [sourceDomain]: entity,
          targetDomain,
          ...additionalData
        });
      });
    } catch (error) {
      console.error(`Failed to emit cross-domain event ${sourceDomain}:${eventType}:`, error);
    }
  };

  return { emitCrossDomainEvent };
};
