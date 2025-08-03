import { Effect as E } from 'effect';
import type { ActionHash } from '@holochain/client';
import type { EntityCacheService } from '$lib/utils/cache.svelte';
import type {
  CacheableEntity,
  CacheSyncHelper,
  CacheLookupFunction,
  CacheOperationHelpers,
  CacheOperation,
  EntityStatus,
  CollectionProcessConfig
} from '$lib/types/store-helpers.js';

// ============================================================================
// CACHE SYNCHRONIZATION
// ============================================================================

/**
 * Creates a generic cache synchronization helper that works with any entity type
 * 
 * @param entityArrays Object containing arrays to synchronize
 * @returns Cache sync helper interface
 * 
 * @example
 * ```typescript
 * const { syncCacheToState } = createGenericCacheSyncHelper({
 *   all: entities,
 *   pending: pendingEntities,
 *   approved: approvedEntities,
 *   rejected: rejectedEntities
 * });
 * ```
 */
export const createGenericCacheSyncHelper = <TEntity extends CacheableEntity>(
  entityArrays: {
    readonly all: TEntity[];
    readonly pending?: TEntity[];
    readonly approved?: TEntity[];
    readonly rejected?: TEntity[];
    readonly [key: string]: TEntity[] | undefined;
  }
): CacheSyncHelper<TEntity> => {
  const getEntityHash = (entity: TEntity): string | null => {
    return (
      entity.actionHash?.toString() ||
      entity.original_action_hash?.toString() ||
      null
    );
  };

  const findAndRemoveFromArray = (array: TEntity[], hash: string): TEntity | null => {
    const index = array.findIndex((item) => getEntityHash(item) === hash);
    if (index !== -1) {
      return array.splice(index, 1)[0];
    }
    return null;
  };

  const addToArray = (array: TEntity[], entity: TEntity): void => {
    const hash = getEntityHash(entity);
    if (!hash) return;

    const existingIndex = array.findIndex((item) => getEntityHash(item) === hash);
    if (existingIndex !== -1) {
      array[existingIndex] = entity;
    } else {
      array.push(entity);
    }
  };

  const syncCacheToState = (entity: TEntity, operation: CacheOperation): void => {
    const hash = getEntityHash(entity);
    if (!hash) return;

    switch (operation) {
      case 'add':
      case 'update':
        // Remove from all arrays first to avoid duplicates
        Object.values(entityArrays).forEach((array) => {
          if (array) {
            findAndRemoveFromArray(array, hash);
          }
        });

        // Add to 'all' array
        addToArray(entityArrays.all, entity);

        // Add to status-specific array if applicable
        if ('status' in entity && typeof entity.status === 'string') {
          const statusArray = entityArrays[entity.status as string];
          if (statusArray) {
            addToArray(statusArray, entity);
          }
        }
        break;

      case 'remove':
        Object.values(entityArrays).forEach((array) => {
          if (array) {
            findAndRemoveFromArray(array, hash);
          }
        });
        break;
    }
  };

  return { syncCacheToState };
};

// ============================================================================
// CACHE LOOKUP FUNCTIONS
// ============================================================================

/**
 * Creates a generic cache lookup function factory
 * 
 * @param serviceMethod Method to fetch entity from service
 * @param entityConverter Converter from service result to UI entity
 * @returns Cache lookup function
 * 
 * @example
 * ```typescript
 * const lookupEntity = createCacheLookupFunction(
 *   (hash) => service.getEntity(hash),
 *   (record) => createUIEntity(record, 'approved')
 * );
 * ```
 */
export const createCacheLookupFunction = <TServiceResult, TEntity>(
  serviceMethod: (hash: ActionHash) => E.Effect<TServiceResult | null, unknown>,
  entityConverter: (result: TServiceResult) => TEntity | null
): CacheLookupFunction<TEntity> => {
  return (key: string): E.Effect<TEntity, Error> =>
    E.gen(function* () {
      try {
        // Parse hash from cache key
        const hashPart = key.includes(':') ? key.split(':')[1] : key;
        const hash = new Uint8Array(Buffer.from(hashPart, 'base64'));

        // Fetch from service
        const result = yield* E.mapError(serviceMethod(hash), (error) => 
          new Error(`Service call failed: ${error}`)
        );

        if (!result) {
          return yield* E.fail(new Error(`Entity not found for key: ${key}`));
        }

        // Convert to UI entity
        const entity = entityConverter(result);

        if (!entity) {
          return yield* E.fail(new Error(`Failed to convert entity for key: ${key}`));
        }

        return entity;
      } catch (error) {
        return yield* E.fail(new Error(`Cache lookup failed for key ${key}: ${error}`));
      }
    });
};

// ============================================================================
// CACHE OPERATION HELPERS
// ============================================================================

/**
 * Creates cache operation helpers for common cache operations
 * 
 * @param cache The cache service instance
 * @returns Cache operation helpers
 */
export const createCacheOperationHelpers = <TEntity extends CacheableEntity>(
  cache: EntityCacheService<TEntity>
): CacheOperationHelpers<TEntity> => {
  const getEntityKey = (entity: TEntity): string => {
    return (
      entity.actionHash?.toString() ||
      entity.original_action_hash?.toString() ||
      'unknown'
    );
  };

  return {
    set: (key: string, entity: TEntity) => cache.set(key, entity),
    get: (key: string) => cache.get(key),
    delete: (key: string) => cache.delete(key),
    clear: () => cache.clear()
  };
};

// ============================================================================
// COLLECTION PROCESSING
// ============================================================================

/**
 * Processes multiple record collections with consistent caching and state management
 * 
 * @param config Configuration for collection processing
 * @param collections Record collections to process
 * @returns Processed collections
 * 
 * @example
 * ```typescript
 * const result = processMultipleRecordCollections(
 *   { converter, cache, targetArrays },
 *   {
 *     pending: pendingRecords,
 *     approved: approvedRecords,
 *     rejected: rejectedRecords
 *   }
 * );
 * ```
 */
export const processMultipleRecordCollections = <TRecord, TEntity extends CacheableEntity>(
  config: CollectionProcessConfig<TRecord, TEntity>,
  collections: Record<string, TRecord[]>
): Record<string, TEntity[]> => {
  const { converter, cache, targetArrays } = config;
  const { syncCacheToState } = createGenericCacheSyncHelper(targetArrays);
  const cacheOps = createCacheOperationHelpers(cache);

  // Clear all target arrays
  Object.values(targetArrays).forEach((array) => {
    if (array) {
      array.length = 0;
    }
  });

  const result: Record<string, TEntity[]> = {};

  // Process each collection
  Object.entries(collections).forEach(([status, records]) => {
    const entities: TEntity[] = [];

    records.forEach((record) => {
      const entity = converter(record, { status });
      if (entity) {
        entities.push(entity);

        // Add to cache
        const key = (
          entity.actionHash?.toString() ||
          entity.original_action_hash?.toString() ||
          'unknown'
        );
        E.runSync(cacheOps.set(key, entity));

        // Sync to state
        syncCacheToState(entity, 'add');
      }
    });

    result[status] = entities;
  });

  return result;
};

// ============================================================================
// STATUS TRANSITION HELPERS
// ============================================================================

/**
 * Creates a status transition helper for entities with approval workflows
 * 
 * @param entityArrays Arrays containing entities by status
 * @param cache Cache service for updating cached entities
 * @returns Status transition helper
 * 
 * @example
 * ```typescript
 * const { transitionEntityStatus } = createStatusTransitionHelper(
 *   { pending: pendingEntities, approved: approvedEntities, rejected: rejectedEntities },
 *   cache
 * );
 * ```
 */
export const createStatusTransitionHelper = <TEntity extends CacheableEntity>(
  entityArrays: {
    readonly pending: TEntity[];
    readonly approved: TEntity[];
    readonly rejected: TEntity[];
  },
  cache: EntityCacheService<TEntity>
) => {
  const transitionEntityStatus = (
    entityHash: ActionHash,
    newStatus: EntityStatus
  ): TEntity | null => {
    const hashStr = entityHash.toString();

    // Find entity in pending array
    const pendingIndex = entityArrays.pending.findIndex((entity) => {
      const entityHashStr =
        entity.actionHash?.toString() ||
        entity.original_action_hash?.toString();
      return entityHashStr === hashStr;
    });

    if (pendingIndex === -1) {
      console.warn('Entity not found in pending list:', hashStr);
      return null;
    }

    // Remove from pending
    const [entity] = entityArrays.pending.splice(pendingIndex, 1);

    // Update status and timestamp if entity supports it
    const updatedEntity: TEntity = {
      ...entity,
      ...(('status' in entity) && { status: newStatus }),
      ...(('updatedAt' in entity) && { updatedAt: new Date() })
    };

    // Add to appropriate target array
    const targetArray = entityArrays[newStatus];
    targetArray.push(updatedEntity);

    // Update cache
    E.runSync(cache.set(hashStr, updatedEntity));

    return updatedEntity;
  };

  return { transitionEntityStatus };
};

// ============================================================================
// CACHE KEY UTILITIES
// ============================================================================

/**
 * Parses hash from cache key with multiple format support
 * 
 * @param key Cache key to parse
 * @returns ActionHash parsed from key
 */
export const parseHashFromCacheKey = (key: string): ActionHash => {
  // Handle different cache key formats: "prefix:hash" or just "hash"
  const hashPart = key.includes(':') ? key.split(':')[1] : key;
  return new Uint8Array(Buffer.from(hashPart, 'base64'));
};

/**
 * Creates a standardized cache key from entity hash
 * 
 * @param hash Entity hash
 * @param prefix Optional prefix for the key
 * @returns Standardized cache key
 */
export const createCacheKey = (hash: ActionHash | string, prefix?: string): string => {
  const hashString = typeof hash === 'string' ? hash : Buffer.from(hash).toString('base64');
  return prefix ? `${prefix}:${hashString}` : hashString;
};

// ============================================================================
// CACHE SYNCHRONIZATION UTILITIES
// ============================================================================

/**
 * Creates a batch cache update function for multiple entities
 * 
 * @param cache Cache service
 * @param syncToState Function to sync entities to state
 * @returns Batch update function
 */
export const createBatchCacheUpdater = <TEntity extends CacheableEntity>(
  cache: EntityCacheService<TEntity>,
  syncToState: (entity: TEntity, operation: CacheOperation) => void
) => {
  return (entities: TEntity[], operation: CacheOperation = 'add'): void => {
    entities.forEach((entity) => {
      const key = (
        entity.actionHash?.toString() ||
        entity.original_action_hash?.toString() ||
        'unknown'
      );

      if (operation === 'remove') {
        E.runSync(cache.delete(key));
      } else {
        E.runSync(cache.set(key, entity));
      }

      syncToState(entity, operation);
    });
  };
};