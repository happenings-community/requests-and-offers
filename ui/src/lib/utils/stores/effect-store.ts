import type { ActionHash, Record as HolochainRecord } from '@holochain/client';
import { Effect as E, Data, pipe, Schema, Context, Layer } from 'effect';
import type { EntityCacheService, CacheableEntity } from '$lib/utils/cache.svelte';
import { CacheNotFoundError } from '$lib/utils/cache.svelte';
import type { EventBusService } from '$lib/utils/eventBus.effect';
import type { StoreEvents } from '$lib/stores/storeEvents';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Base interface for entities that can be cached and managed by Effect stores
 * Extends the existing CacheableEntity interface for consistency
 */
export interface UIEntity extends CacheableEntity {
  creator?: ActionHash;
  created_at?: number;
  updated_at?: number;
}

/**
 * Standard store state structure using Svelte 5 runes
 */
export interface BaseStoreState<T extends UIEntity> {
  /** Reactive array of entities */
  readonly entities: T[];
  /** Loading state for async operations */
  readonly loading: boolean;
  /** Error state using domain-specific error types */
  readonly error: Error | null;
  /** Cache statistics for debugging */
  readonly cacheStats: { hits: number; misses: number; size: number };
}

/**
 * Standard store operations interface
 */
export interface BaseStoreOperations<T extends UIEntity, TInput, TError> {
  /** Create a new entity */
  readonly create: (input: TInput) => E.Effect<T, TError>;
  /** Get all entities */
  readonly getAll: () => E.Effect<T[], TError>;
  /** Get entity by hash */
  readonly getByHash: (hash: ActionHash) => E.Effect<T | null, TError>;
  /** Update an entity */
  readonly update: (
    originalHash: ActionHash,
    previousHash: ActionHash,
    input: TInput
  ) => E.Effect<T, TError>;
  /** Delete an entity */
  readonly delete: (hash: ActionHash) => E.Effect<void, TError>;
  /** Refresh cache */
  readonly refreshCache: () => E.Effect<void, never>;
  /** Clear error state */
  readonly clearError: () => E.Effect<void, never>;
}

/**
 * Configuration for store creation
 */
export interface StoreConfig {
  /** Cache expiry time in milliseconds */
  cacheExpiryMs?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Initial loading state */
  initialLoading?: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Standard error context constants generator
 */
export const createErrorContexts = <T extends string>(entityName: T) =>
  ({
    [`CREATE_${entityName.toUpperCase()}`]: `Failed to create ${entityName}`,
    [`GET_ALL_${entityName.toUpperCase()}S`]: `Failed to get all ${entityName}s`,
    [`GET_${entityName.toUpperCase()}`]: `Failed to get ${entityName}`,
    [`UPDATE_${entityName.toUpperCase()}`]: `Failed to update ${entityName}`,
    [`DELETE_${entityName.toUpperCase()}`]: `Failed to delete ${entityName}`,
    [`EMIT_${entityName.toUpperCase()}_CREATED`]: `Failed to emit ${entityName} created event`,
    [`EMIT_${entityName.toUpperCase()}_UPDATED`]: `Failed to emit ${entityName} updated event`,
    [`EMIT_${entityName.toUpperCase()}_DELETED`]: `Failed to emit ${entityName} deleted event`
  }) as const;

/**
 * Standard loading state wrapper for async operations
 * Consistent with the pattern used across all three stores
 */
export const withLoadingState = <T, E>(
  effect: E.Effect<T, E>,
  setLoading: (loading: boolean) => void,
  setError: (error: E | null) => void
): E.Effect<T, E> =>
  pipe(
    E.sync(() => setLoading(true)),
    E.flatMap(() => effect),
    E.tap(() => E.sync(() => setError(null))),
    E.tapError((error) => E.sync(() => setError(error))),
    E.tapBoth({
      onFailure: () => E.sync(() => setLoading(false)),
      onSuccess: () => E.sync(() => setLoading(false))
    })
  );

/**
 * Standard cache synchronization helper
 * Consistent with the syncCacheToState pattern used in all stores
 */
export const createCacheSyncHelper = <T extends UIEntity>(
  entities: T[],
  getEntityKey: (entity: T) => string = (entity) => entity.original_action_hash?.toString() || ''
) => {
  return (entity: T, operation: 'add' | 'update' | 'remove') => {
    const entityKey = getEntityKey(entity);
    const index = entities.findIndex((e) => getEntityKey(e) === entityKey);

    switch (operation) {
      case 'add':
      case 'update':
        if (index !== -1) {
          entities[index] = entity;
        } else {
          entities.push(entity);
        }
        break;
      case 'remove':
        if (index !== -1) {
          entities.splice(index, 1);
        }
        break;
    }
  };
};

/**
 * Standard event emission helper
 * Consistent with the emit pattern used across all stores
 */
export const createEventEmitter = <TEventMap extends Record<string, unknown>>(
  eventBusTag: Context.Tag<EventBusService<TEventMap>, EventBusService<TEventMap>>,
  eventBusLive: Layer.Layer<EventBusService<TEventMap>>
) => {
  return <K extends keyof TEventMap>(
    eventName: K,
    payload: TEventMap[K]
  ): E.Effect<void, never, unknown> =>
    pipe(
      E.gen(function* () {
        const eventBus = yield* eventBusTag;
        yield* eventBus.emit(eventName, payload);
      }),
      E.provide(eventBusLive),
      E.catchAll(() => E.void),
      E.ignore
    );
};

/**
 * Standard cache key parser for hash extraction
 * Consistent with the parseHashFromCacheKey pattern
 */
export const parseHashFromCacheKey = (key: string): ActionHash => {
  return new Uint8Array(Buffer.from(key, 'base64'));
};

/**
 * Standard UI entity creator helper
 * Reduces boilerplate in entity creation across stores
 */
export const createUIEntity = <TRecord, TUI extends UIEntity>(
  record: HolochainRecord,
  decodedData: TRecord,
  additionalFields: Partial<TUI> = {}
): TUI => {
  return {
    ...decodedData,
    original_action_hash: record.signed_action.hashed.hash,
    previous_action_hash: record.signed_action.hashed.hash,
    creator: record.signed_action.hashed.content.author,
    created_at: record.signed_action.hashed.content.timestamp,
    updated_at: record.signed_action.hashed.content.timestamp,
    ...additionalFields
  } as unknown as TUI;
};

// ============================================================================
// STORE FACTORY UTILITIES
// ============================================================================

/**
 * Standard cache lookup function creator
 * Reduces boilerplate for cache miss handling
 */
export const createCacheLookupFunction = <T extends UIEntity, TService>(
  service: TService,
  getEntityMethod: (service: TService, hash: ActionHash) => E.Effect<HolochainRecord | null, any>,
  decodeAndTransform: (record: HolochainRecord) => E.Effect<T, any>
) => {
  return (key: string): E.Effect<T, CacheNotFoundError> =>
    pipe(
      E.tryPromise({
        try: async () => {
          const hash = parseHashFromCacheKey(key);
          const record = await E.runPromise(getEntityMethod(service, hash));

          if (!record) {
            throw new Error(`Entity not found for key: ${key}`);
          }

          return await E.runPromise(decodeAndTransform(record));
        },
        catch: () => new CacheNotFoundError({ key })
      }),
      E.mapError(() => new CacheNotFoundError({ key }))
    );
};

/**
 * Standard store state creator using Svelte 5 runes
 * Ensures consistent state structure across all stores
 */
export const createStoreState = <T extends UIEntity>(
  initialState: Partial<BaseStoreState<T>> = {}
): BaseStoreState<T> => {
  let entities = $state<T[]>(initialState.entities || []);
  let loading = $state<boolean>(initialState.loading || false);
  let error = $state<unknown | null>(initialState.error || null);
  let cacheStats = $state<{ hits: number; misses: number; size: number }>({
    hits: 0,
    misses: 0,
    size: 0,
    ...initialState.cacheStats
  });

  return {
    get entities() {
      return entities;
    },
    get loading() {
      return loading;
    },
    get error() {
      return error;
    },
    get cacheStats() {
      return cacheStats;
    },
    // Internal setters for store operations
    _setEntities: (newEntities: T[]) => {
      entities.splice(0, entities.length, ...newEntities);
    },
    _setLoading: (newLoading: boolean) => {
      loading = newLoading;
    },
    _setError: (newError: unknown | null) => {
      error = newError;
    },
    _setCacheStats: (newStats: { hits: number; misses: number; size: number }) => {
      Object.assign(cacheStats, newStats);
    }
  } as BaseStoreState<T> & {
    _setEntities: (entities: T[]) => void;
    _setLoading: (loading: boolean) => void;
    _setError: (error: unknown | null) => void;
    _setCacheStats: (stats: { hits: number; misses: number; size: number }) => void;
  };
};

/**
 * Standard constants for common store configurations
 */
export const STORE_CONSTANTS = {
  CACHE_EXPIRY: {
    SHORT: 2 * 60 * 1000, // 2 minutes
    MEDIUM: 5 * 60 * 1000, // 5 minutes
    LONG: 10 * 60 * 1000, // 10 minutes
    VERY_LONG: 30 * 60 * 1000 // 30 minutes
  },
  BATCH_SIZE: {
    SMALL: 10,
    MEDIUM: 25,
    LARGE: 50
  }
} as const;

/**
 * Standard helper for parallel service type fetching
 * Extracted from the common pattern across stores
 */
export const createServiceTypesFetcher = (serviceTypesStore: {
  getServiceTypesForEntity: (input: {
    original_action_hash: string;
    entity: string;
  }) => E.Effect<ActionHash[], never, unknown>;
}) => {
  return (
    entityHash: ActionHash,
    context: string = 'fetching service types'
  ): E.Effect<ActionHash[], never, unknown> =>
    pipe(
      serviceTypesStore.getServiceTypesForEntity({
        original_action_hash: Buffer.from(entityHash).toString('base64'),
        entity: context.split(' ')[1] || 'entity' // Extract entity type from context
      }),
      E.map((result) => result as ActionHash[]),
      E.catchAll(() => E.succeed([] as ActionHash[]))
    );
};

/**
 * Standard helper for user profile fetching
 * Extracted from the common pattern across stores
 */
export const createUserProfileFetcher = (usersStore: {
  getUserByAgentPubKey: (agentPubKey: ActionHash) => Promise<unknown>;
}) => {
  return (
    agentPubKey: ActionHash,
    context: string = 'fetching user profile'
  ): E.Effect<any, never> =>
    pipe(
      E.promise(() => usersStore.getUserByAgentPubKey(agentPubKey)),
      E.catchAll(() => E.succeed(null))
    );
};

// ============================================================================
// VALIDATION AND SCHEMA HELPERS
// ============================================================================

/**
 * Validation error class
 */
class ValidationError extends Data.TaggedError('ValidationError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Standard validation helper for entity operations
 * Provides consistent validation patterns across stores
 */
export const createEntityValidator = <T>(schema: Schema.Schema<T, any, any>) => {
  return (data: unknown): E.Effect<T, ValidationError, any> =>
    pipe(
      Schema.decodeUnknown(schema)(data),
      E.mapError(
        (error) => new ValidationError({ message: 'Entity validation failed', cause: error })
      )
    );
};

/**
 * Export commonly used default configurations
 */
export const DEFAULT_STORE_CONFIG: Required<StoreConfig> = {
  cacheExpiryMs: STORE_CONSTANTS.CACHE_EXPIRY.MEDIUM,
  debug: false,
  initialLoading: false
};
