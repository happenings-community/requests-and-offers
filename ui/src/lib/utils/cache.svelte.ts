import type { ActionHash } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';
import { Effect as E, Layer, Context, Data, pipe, Cache, Duration } from 'effect';

/**
 * Generic cache interface for entities with ActionHash
 */
export interface CacheableEntity {
  original_action_hash?: ActionHash;
}

/**
 * Configuration options for the cache
 */
export interface CacheConfig {
  /** Cache capacity (number of entries) */
  capacity?: number;
  /** Cache expiration time in milliseconds */
  expiryMs?: number;
  /** Debug mode to log cache operations */
  debug?: boolean;
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: Required<CacheConfig> = {
  capacity: 1000,
  expiryMs: 5 * 60 * 1000, // 5 minutes
  debug: false
};

/**
 * Error types for cache operations
 */
export class CacheNotFoundError extends Data.TaggedError('CacheNotFoundError')<{
  readonly key: string;
}> {}

export class CacheValidationError extends Data.TaggedError('CacheValidationError')<{
  readonly key: string;
  readonly reason: string;
}> {}

/**
 * Service interface for entity cache operations
 */
export interface EntityCacheService<T extends CacheableEntity> {
  /** Configuration used by this cache */
  readonly config: Required<CacheConfig>;

  /** Get entity by key - uses Effect's native caching with lookup function */
  readonly get: (key: string) => E.Effect<T, CacheNotFoundError>;

  /** Set entity by key - bypasses cache lookup and stores directly */
  readonly set: (key: string, entity: T) => E.Effect<void>;

  /** Check if entity exists in cache */
  readonly contains: (key: string) => E.Effect<boolean>;

  /** Delete entity by key */
  readonly delete: (key: string) => E.Effect<boolean>;

  /** Clear all cached entities */
  readonly clear: () => E.Effect<void>;

  /** Get cache statistics */
  readonly stats: () => E.Effect<{
    size: number;
    hits: number;
    misses: number;
  }>;

  /** Invalidate cache entry to force refresh */
  readonly invalidate: (key: string) => E.Effect<void>;

  /** Refresh cache entry in background */
  readonly refresh: (key: string) => E.Effect<void>;
}

/**
 * Generic Cache Service that can be used as an Effect dependency
 */
export interface CacheService {
  /** Create a cache factory for a specific entity type */
  createEntityCache: <T extends CacheableEntity>(
    config?: CacheConfig,
    lookupFunction?: (key: string) => E.Effect<T, CacheNotFoundError>
  ) => E.Effect<EntityCacheService<T>, never>;
}

/**
 * Helper function to create cache key for entities
 */
export const createCacheKey = (entity: CacheableEntity): string => {
  return entity.original_action_hash
    ? encodeHashToBase64(entity.original_action_hash)
    : Math.random().toString(36);
};

/**
 * Creates a factory function for Effect Cache services
 */
export const createEntityCacheFactory = <T extends CacheableEntity>(config: CacheConfig = {}) => {
  const cacheConfig = { ...DEFAULT_CONFIG, ...config };

  /**
   * Service tag for this specific cache type
   */
  const EntityCacheServiceTag = Context.GenericTag<EntityCacheService<T>>('EntityCacheService');

  /**
   * Create cache layer that uses Effect's native Cache
   */
  const createCacheLayer = (
    lookupFunction: (key: string) => E.Effect<T, CacheNotFoundError>
  ): Layer.Layer<EntityCacheService<T>> => {
    return Layer.effect(
      EntityCacheServiceTag,
      E.gen(function* () {
        // Create Effect's native cache with lookup function
        const cache = yield* Cache.make({
          capacity: cacheConfig.capacity,
          timeToLive: Duration.millis(cacheConfig.expiryMs),
          lookup: (key: string) => lookupFunction(key)
        });

        // Manual storage for entities set directly (bypassing lookup)
        const manualStorage = new Map<string, { entity: T; timestamp: number }>();

        const log = (message: string, data?: unknown) => {
          if (cacheConfig.debug) {
            console.log(`[EntityCache] ${message}`, data);
          }
        };

        return EntityCacheServiceTag.of({
          config: cacheConfig,

          get: (key: string) =>
            pipe(
              // First check manual storage
              E.sync(() => {
                const stored = manualStorage.get(key);
                if (stored) {
                  const age = Date.now() - stored.timestamp;
                  if (age < cacheConfig.expiryMs) {
                    log('Retrieved from manual storage', { key });
                    return stored.entity;
                  }
                  // Remove expired entry
                  manualStorage.delete(key);
                }
                return null;
              }),
              E.flatMap(
                (stored) => (stored ? E.succeed(stored) : cache.get(key)) // Use Effect's cache with lookup
              ),
              E.tap(() => E.sync(() => log('Cache hit', { key }))),
              E.tapError(() => E.sync(() => log('Cache miss', { key })))
            ),

          set: (key: string, entity: T) =>
            E.sync(() => {
              manualStorage.set(key, { entity, timestamp: Date.now() });
              log('Entity set in manual storage', { key });
            }),

          contains: (key: string) =>
            pipe(
              E.sync(() => {
                // Check manual storage first
                const stored = manualStorage.get(key);
                if (stored) {
                  const age = Date.now() - stored.timestamp;
                  return age < cacheConfig.expiryMs;
                }
                return false;
              }),
              E.flatMap((inManual) => (inManual ? E.succeed(true) : cache.contains(key)))
            ),

          delete: (key: string) =>
            E.sync(() => {
              const hadManual = manualStorage.delete(key);
              // Note: Effect's Cache doesn't expose a direct delete method
              // but invalidate will remove it from cache
              log('Entity deleted', { key, hadManual });
              return hadManual;
            }),

          clear: () =>
            pipe(
              E.sync(() => {
                const size = manualStorage.size;
                manualStorage.clear();
                log('Manual storage cleared', { clearedEntries: size });
              }),
              E.flatMap(() => cache.invalidateAll),
              E.orElse(() => E.void)
            ),

          stats: () =>
            pipe(
              cache.cacheStats,
              E.map((stats) => ({
                size: stats.size,
                hits: stats.hits,
                misses: stats.misses
              })),
              E.tap((stats) => E.sync(() => log('Cache stats retrieved', stats))),
              E.orElse(() => E.succeed({ size: 0, hits: 0, misses: 0 }))
            ),

          invalidate: (key: string) =>
            pipe(
              E.sync(() => manualStorage.delete(key)),
              E.flatMap(() => cache.invalidate(key)),
              E.tap(() => E.sync(() => log('Cache invalidated', { key }))),
              E.orElse(() => E.void)
            ),

          refresh: (key: string) =>
            pipe(
              cache.refresh(key),
              E.tap(() => E.sync(() => log('Cache refreshed', { key }))),
              E.orElse(() => E.void)
            )
        });
      })
    );
  };

  return {
    tag: EntityCacheServiceTag,
    createLayer: createCacheLayer,
    config: cacheConfig
  };
};

/**
 * Implementation of the CacheService
 */
const createCacheService = (): CacheService => ({
  createEntityCache: <T extends CacheableEntity>(
    config: CacheConfig = {},
    lookupFunction?: (key: string) => E.Effect<T, CacheNotFoundError>
  ) => {
    const factory = createEntityCacheFactory<T>(config);

    // If no lookup function provided, create a default one that always fails
    const defaultLookup = (key: string): E.Effect<T, CacheNotFoundError> =>
      E.fail(new CacheNotFoundError({ key }));

    const lookup = lookupFunction || defaultLookup;
    const layer = factory.createLayer(lookup);

    return E.provide(factory.tag, layer);
  }
});

/**
 * Cache Service Tag for dependency injection
 */
export class CacheServiceTag extends Context.Tag('CacheService')<CacheServiceTag, CacheService>() {}

/**
 * Cache Service Live Layer
 */
export const CacheServiceLive: Layer.Layer<CacheServiceTag> = Layer.succeed(
  CacheServiceTag,
  createCacheService()
);
