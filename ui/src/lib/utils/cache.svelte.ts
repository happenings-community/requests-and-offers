import type { ActionHash } from '@holochain/client';
import { encodeHashToBase64 } from '@holochain/client';
import { createEventBus } from '$lib/utils/eventBus';
import type { EventHandler } from '$lib/utils/eventBus';

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
  /** Cache expiration time in milliseconds */
  expiryMs?: number;
  /** Debug mode to log cache operations */
  debug?: boolean;
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  expiryMs: 5 * 60 * 1000, // 5 minutes
  debug: false
};

/**
 * Events emitted by the cache
 * @template T The entity type stored in the cache
 */
export interface CacheEvents<T extends CacheableEntity> {
  /**
   * Emitted when an entity is added or updated in the cache
   * @property entity The entity that was added or updated
   * @property hash The string representation of the entity's hash
   */
  'cache:set': { entity: T; hash: string };

  /**
   * Emitted when an entity is retrieved from the cache
   * @property entity The retrieved entity or null if not found
   * @property hash The string representation of the entity's hash
   * @property fromCache Whether the entity was found in the cache
   */
  'cache:get': { entity: T | null; hash: string; fromCache: boolean };

  /**
   * Emitted when an entity is removed from the cache
   * @property hash The string representation of the removed entity's hash
   */
  'cache:remove': { hash: string };

  /**
   * Emitted when an entity is invalidated (marked as expired)
   * @property hash The string representation of the invalidated entity's hash
   */
  'cache:invalidate': { hash: string };

  /**
   * Emitted when an entity is detected as expired during a validity check
   * @property entity The expired entity
   * @property hash The string representation of the entity's hash
   */
  'cache:expired': { entity: T; hash: string };

  /**
   * Emitted when a fetch operation for an entity begins
   * @property hash The string representation of the entity's hash being fetched
   */
  'cache:fetch:start': { hash: string };

  /**
   * Emitted when a fetch operation for an entity completes successfully
   * @property entity The successfully fetched entity
   * @property hash The string representation of the entity's hash
   */
  'cache:fetch:success': { entity: T; hash: string };

  /**
   * Emitted when a fetch operation for an entity fails
   * @property hash The string representation of the entity's hash that failed to fetch
   * @property error The error that occurred during fetching
   */
  'cache:fetch:error': { hash: string; error: unknown };

  /**
   * Emitted when the cache is cleared
   * @property count The number of entities that were in the cache before clearing
   */
  'cache:clear': { count: number };
}

/**
 * Interface for the EntityCache API
 */
export interface EntityCache<T extends CacheableEntity> {
  /** Get an entity from the cache */
  get(hash: ActionHash): T | null;

  /** Add or update an entity in the cache */
  set(entity: T): void;

  /** Remove an entity from the cache */
  remove(hash: ActionHash): void;

  /** Invalidate an entity in the cache (mark as expired) */
  invalidate(hash: ActionHash): void;

  /** Get an entity from cache if valid, otherwise fetch it */
  getOrFetch(hash: ActionHash, fetchFn: (hash: ActionHash) => Promise<T | null>): Promise<T | null>;

  /** Get multiple entities, using cache for valid ones and fetching others */
  getOrFetchMany(
    hashes: ActionHash[],
    fetchFn: (hash: ActionHash) => Promise<T | null>
  ): Promise<T[]>;

  /** Clear the entire cache */
  clear(): void;

  /** Get all entities in the cache */
  getAll(): T[];

  /** Get all valid (non-expired) entities in the cache */
  getAllValid(): T[];

  /** Check if an entity is in the cache and valid */
  isValid(hash: ActionHash): boolean;

  /**
   * Subscribe to cache events
   * @template K The event name (key in the CacheEvents)
   * @param event The event name to subscribe to
   * @param handler The callback function to execute when the event occurs
   * @returns A cleanup function to unsubscribe the handler
   */
  on<K extends keyof CacheEvents<T>>(
    event: K,
    handler: EventHandler<CacheEvents<T>[K]>
  ): () => void;

  /**
   * Unsubscribe from cache events
   * @template K The event name (key in the CacheEvents)
   * @param event The event name to unsubscribe from
   * @param handler The handler function to remove
   */
  off<K extends keyof CacheEvents<T>>(event: K, handler: EventHandler<CacheEvents<T>[K]>): void;
}

/**
 * Create a reusable cache for Holochain entities
 */
export function createEntityCache<T extends CacheableEntity>(
  config: CacheConfig = {}
): EntityCache<T> {
  // Merge default config with provided config
  const cacheConfig = { ...DEFAULT_CONFIG, ...config };

  // Cache state using Svelte 5 runes
  const entities = $state<Record<string, T>>({});
  const timestamps = $state<Record<string, number>>({});
  const pendingRequests = $state<Record<string, Promise<T | null>>>({});

  // Create event bus for this cache instance
  const eventBus = createEventBus<CacheEvents<T>>();

  /**
   * Log a message if debug mode is enabled
   * @param message The message to log
   * @param args Additional arguments to log
   */
  function log(message: string, ...args: unknown[]): void {
    if (cacheConfig.debug) {
      console.log(`[EntityCache] ${message}`, ...args);
    }
  }

  /**
   * Check if an entity is in the cache and valid
   * @param hash The entity hash to check
   * @returns True if the entity is in cache and not expired
   */
  function isValid(hash: ActionHash): boolean {
    const hashStr = encodeHashToBase64(hash);
    const timestamp = timestamps[hashStr];

    if (!timestamp) {
      log(`Cache miss for ${hashStr}`);
      return false;
    }

    const isValid = Date.now() - timestamp < cacheConfig.expiryMs!;

    // If the entity just expired, emit an event
    if (!isValid && entities[hashStr]) {
      eventBus.emit('cache:expired', {
        entity: entities[hashStr],
        hash: hashStr
      });
    }

    log(`Cache ${isValid ? 'hit' : 'expired'} for ${hashStr}`);
    return isValid;
  }

  /**
   * Get an entity from the cache
   * @param hash The entity hash
   * @returns The entity or null if not found
   */
  function get(hash: ActionHash): T | null {
    const hashStr = encodeHashToBase64(hash);
    const entity = entities[hashStr] || null;

    eventBus.emit('cache:get', {
      entity,
      hash: hashStr,
      fromCache: !!entity
    });

    return entity;
  }

  /**
   * Add or update an entity in the cache
   * @param entity The entity to cache
   */
  function set(entity: T): void {
    if (!entity?.original_action_hash) {
      log('Cannot cache entity without original_action_hash');
      return;
    }

    const hashStr = encodeHashToBase64(entity.original_action_hash);
    entities[hashStr] = entity;
    timestamps[hashStr] = Date.now();

    log(`Cached entity ${hashStr}`);
    eventBus.emit('cache:set', { entity, hash: hashStr });
  }

  /**
   * Remove an entity from the cache
   * @param hash The entity hash to remove
   */
  function remove(hash: ActionHash): void {
    const hashStr = encodeHashToBase64(hash);

    delete entities[hashStr];
    delete timestamps[hashStr];

    log(`Removed entity ${hashStr} from cache`);
    eventBus.emit('cache:remove', { hash: hashStr });
  }

  /**
   * Invalidate an entity in the cache (mark as expired)
   * @param hash The entity hash to invalidate
   */
  function invalidate(hash: ActionHash): void {
    const hashStr = encodeHashToBase64(hash);
    delete timestamps[hashStr];
    log(`Invalidated entity ${hashStr}`);
    eventBus.emit('cache:invalidate', { hash: hashStr });
  }

  /**
   * Get an entity from cache if valid, otherwise fetch it
   * @param hash The entity hash
   * @param fetchFn Function to fetch the entity if not in cache
   * @returns The entity or null
   */
  async function getOrFetch(
    hash: ActionHash,
    fetchFn: (hash: ActionHash) => Promise<T | null>
  ): Promise<T | null> {
    const hashStr = encodeHashToBase64(hash);

    // Return from cache if valid
    if (isValid(hash)) {
      const entity = get(hash);
      if (entity) return entity;
    }

    // Return from pending request if one exists
    if (pendingRequests[hashStr] !== undefined) {
      log(`Using pending request for ${hashStr}`);
      return pendingRequests[hashStr];
    }

    // Create a new request and store it
    log(`Fetching entity ${hashStr}`);
    eventBus.emit('cache:fetch:start', { hash: hashStr });

    const fetchPromise = (async () => {
      try {
        const entity = await fetchFn(hash);
        if (entity) {
          set(entity);
          eventBus.emit('cache:fetch:success', { entity, hash: hashStr });
        }
        return entity;
      } catch (error) {
        console.error(`Error fetching entity ${hashStr}:`, error);
        eventBus.emit('cache:fetch:error', { hash: hashStr, error });
        return null;
      } finally {
        delete pendingRequests[hashStr];
      }
    })();

    pendingRequests[hashStr] = fetchPromise;
    return fetchPromise;
  }

  /**
   * Get multiple entities, using cache for valid ones and fetching others
   * @param hashes Array of entity hashes
   * @param fetchFn Function to fetch a single entity
   * @returns Array of entities (null values filtered out)
   */
  async function getOrFetchMany(
    hashes: ActionHash[],
    fetchFn: (hash: ActionHash) => Promise<T | null>
  ): Promise<T[]> {
    // First get all cached entities that are still valid
    const cachedEntities: T[] = [];
    const hashesToFetch: ActionHash[] = [];

    hashes.forEach((hash) => {
      if (isValid(hash)) {
        const entity = get(hash);
        if (entity) {
          cachedEntities.push(entity);
          return;
        }
      }
      hashesToFetch.push(hash);
    });

    log(`Found ${cachedEntities.length} cached entities, fetching ${hashesToFetch.length} more`);

    // Fetch remaining entities in parallel
    if (hashesToFetch.length > 0) {
      const fetchedEntities = await Promise.all(
        hashesToFetch.map((hash) => getOrFetch(hash, fetchFn))
      );

      // Filter out null values and combine with cached entities
      const validFetchedEntities = fetchedEntities.filter(
        (entity): entity is NonNullable<typeof entity> => entity !== null
      ) as T[];

      return [...cachedEntities, ...validFetchedEntities];
    }

    return cachedEntities;
  }

  /**
   * Clear the entire cache
   */
  function clear(): void {
    const count = Object.keys(entities).length;

    for (const key in entities) {
      delete entities[key];
    }

    for (const key in timestamps) {
      delete timestamps[key];
    }

    log('Cache cleared');
    eventBus.emit('cache:clear', { count });
  }

  /**
   * Get all entities in the cache
   * @returns Array of all cached entities
   */
  function getAll(): T[] {
    return Object.values(entities);
  }

  /**
   * Get all valid entities in the cache
   * @returns Array of valid cached entities
   */
  function getAllValid(): T[] {
    const now = Date.now();

    return Object.entries(entities)
      .filter(([hashStr]) => {
        const timestamp = timestamps[hashStr];
        return timestamp && now - timestamp < cacheConfig.expiryMs!;
      })
      .map(([, entity]) => entity);
  }

  // Return the public API
  return {
    get,
    set,
    remove,
    invalidate,
    getOrFetch,
    getOrFetchMany,
    clear,
    getAll,
    getAllValid,
    isValid,
    on: eventBus.on,
    off: eventBus.off
  };
}
