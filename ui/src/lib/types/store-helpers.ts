import type { Effect as E } from 'effect';
import type { ActionHash } from '@holochain/client';
import type { EntityCacheService } from '$lib/utils/cache.svelte';

// ============================================================================
// CORE INTERFACES
// ============================================================================

/**
 * Base interface for entities that can be cached
 */
export interface CacheableEntity {
  readonly original_action_hash?: ActionHash;
  readonly actionHash?: ActionHash;
  readonly [key: string]: unknown;
}

/**
 * Generic store state interface
 */
export interface StoreState<TEntity extends CacheableEntity, TError> {
  readonly entities: TEntity[];
  readonly loading: boolean;
  readonly error: TError | string | null;
  readonly cache: EntityCacheService<TEntity>;
}

/**
 * Configuration for store operations
 */
export interface StoreConfig {
  readonly cacheExpiryMs?: number;
  readonly debug?: boolean;
}

/**
 * Operation types for cache synchronization
 */
export type CacheOperation = 'add' | 'update' | 'remove';

/**
 * Status types for entities with approval workflow
 */
export type EntityStatus = 'pending' | 'approved' | 'rejected';

// ============================================================================
// LOADING STATE INTERFACES
// ============================================================================

/**
 * Loading state setters interface
 */
export interface LoadingStateSetter {
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string | null) => void;
}

/**
 * Generic operation wrapper type
 */
export type OperationWrapper = <T, E>(
  operation: () => E.Effect<T, E>
) => (setters: LoadingStateSetter) => E.Effect<T, E>;

// ============================================================================
// CACHE HELPER INTERFACES
// ============================================================================

/**
 * Cache synchronization helper interface
 */
export interface CacheSyncHelper<TEntity extends CacheableEntity> {
  readonly syncCacheToState: (entity: TEntity, operation: CacheOperation) => void;
}

/**
 * Cache lookup function type
 */
export type CacheLookupFunction<TEntity> = (key: string) => E.Effect<TEntity, Error>;

/**
 * Cache operation helpers interface
 */
export interface CacheOperationHelpers<TEntity extends CacheableEntity> {
  readonly set: (key: string, entity: TEntity) => E.Effect<void, never>;
  readonly get: (key: string) => E.Effect<TEntity, Error>;
  readonly delete: (key: string) => E.Effect<void, never>;
  readonly clear: () => E.Effect<void, never>;
}

// ============================================================================
// EVENT HELPER INTERFACES
// ============================================================================

/**
 * Standard event emitter interface
 */
export interface EventEmitter<TEntity, THash = ActionHash> {
  readonly emitCreated: (entity: TEntity) => void;
  readonly emitUpdated: (entity: TEntity) => void;
  readonly emitDeleted: (entityHash: THash) => void;
  readonly emitStatusChanged?: (entity: TEntity) => void;
}

/**
 * Event emitter factory configuration
 */
export interface EventEmitterConfig {
  readonly entityName: string;
  readonly includeStatusEvents?: boolean;
}

// ============================================================================
// RECORD PROCESSING INTERFACES
// ============================================================================

/**
 * Record to entity converter function type
 */
export type RecordToEntityConverter<TRecord, TEntity> = (
  record: TRecord,
  additionalData?: Record<string, unknown>
) => TEntity | null;

/**
 * Record processing helper interface
 */
export interface RecordProcessor<TRecord, TEntity extends CacheableEntity> {
  readonly processRecord: (
    record: TRecord,
    additionalData?: Record<string, unknown>
  ) => { record: TRecord; entity: TEntity };
  readonly processRecords: (records: TRecord[]) => TEntity[];
}

/**
 * Entity creation helper interface
 */
export interface EntityCreationHelper<TRecord, TEntity> {
  readonly createEntity: (
    record: TRecord,
    additionalData?: Record<string, unknown>
  ) => TEntity | null;
  readonly createEntities: (records: TRecord[]) => TEntity[];
}

// ============================================================================
// DATA FETCHING INTERFACES
// ============================================================================

/**
 * Data fetching configuration
 */
export interface FetchConfig<TEntity> {
  readonly targetArray: TEntity[];
  readonly errorContext: string;
  readonly setters: LoadingStateSetter;
}

/**
 * Generic entity fetcher function type
 */
export type EntityFetcher<TEntity, TError> = (
  serviceMethod: () => E.Effect<TEntity[], unknown>,
  config: FetchConfig<TEntity>
) => E.Effect<TEntity[], TError>;

/**
 * Status transition helper interface
 */
export interface StatusTransitionHelper<TEntity extends CacheableEntity> {
  readonly transitionEntityStatus: (
    entityHash: ActionHash,
    newStatus: EntityStatus,
    sourceArray: TEntity[],
    targetArray: TEntity[]
  ) => TEntity | null;
}

// ============================================================================
// ERROR HANDLING INTERFACES
// ============================================================================

/**
 * Error context type
 */
export type ErrorContext = string;

/**
 * Error handler function type
 */
export type ErrorHandler<TError> = (
  error: unknown,
  context: ErrorContext
) => E.Effect<never, TError>;

/**
 * Error factory interface
 */
export interface ErrorFactory<TError> {
  readonly fromError: (error: unknown, context: ErrorContext) => TError;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Extract entity ID type from entity
 */
export type EntityId<TEntity> = TEntity extends { id: infer TId }
  ? TId
  : TEntity extends { actionHash: infer THash }
    ? THash
    : TEntity extends { original_action_hash: infer THash }
      ? THash
      : string;

/**
 * Extract hash type from entity
 */
export type EntityHash<TEntity> = TEntity extends { actionHash: infer THash }
  ? THash
  : TEntity extends { original_action_hash: infer THash }
    ? THash
    : ActionHash;

/**
 * Configuration for collection processing
 */
export interface CollectionProcessConfig<TRecord, TEntity extends CacheableEntity> {
  readonly converter: RecordToEntityConverter<TRecord, TEntity>;
  readonly cache: EntityCacheService<TEntity>;
  readonly targetArrays: {
    readonly all: TEntity[];
    readonly pending?: TEntity[];
    readonly approved?: TEntity[];
    readonly rejected?: TEntity[];
  };
}
