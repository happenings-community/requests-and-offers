import type { ActionHash, Record as HolochainRecord } from '@holochain/client';
import type {
  MediumOfExchangeInDHT,
  UIMediumOfExchange,
  MediumsOfExchangeCollection
} from '$lib/schemas/mediums-of-exchange.schemas';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { Data, Effect as E, pipe } from 'effect';
import {
  MediumsOfExchangeServiceTag,
  MediumsOfExchangeServiceLive
} from '$lib/services/zomes/mediums-of-exchange.service';
import { CacheNotFoundError } from '$lib/errors';
import { MEDIUM_OF_EXCHANGE_CONTEXTS } from '$lib/errors/error-contexts';
import { CACHE_EXPIRY } from '$lib/utils/constants';

// Import standardized store helpers
import {
  withLoadingState,
  createGenericCacheSyncHelper,
  createStatusAwareEventEmitters,
  createUIEntityFromRecord,
  type LoadingStateSetter
} from '$lib/utils/store-helpers';
import { HolochainClientServiceLive } from '../services/HolochainClientService.svelte';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = CACHE_EXPIRY.MEDIUMS_OF_EXCHANGE;

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error handler for Medium of Exchange operations
 */
// Error handler will be created inline since MediumOfExchangeStoreError is declared later\n// const handleMediumOfExchangeError = createErrorHandler(MediumOfExchangeStoreError.fromError, 'Medium of exchange operation failed');

/**
 * Create standardized event emitters for Medium of Exchange entities with status support
 */
const mediumOfExchangeEventEmitters =
  createStatusAwareEventEmitters<UIMediumOfExchange>('mediumOfExchange');

/**
 * Create standardized entity fetcher for Mediums of Exchange
 */
// Entity fetcher will be created inline\n// const mediumOfExchangeEntityFetcher = createEntityFetcher<UIMediumOfExchange & { [key: string]: any }, MediumOfExchangeStoreError>(handleMediumOfExchangeError);

/**
 * Cache lookup function for mediums of exchange
 */
const mediumOfExchangeCacheLookup = (
  key: string
): E.Effect<UIMediumOfExchange, CacheNotFoundError, never> => {
  return E.fail(new CacheNotFoundError({ key }));
};

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Error type for mediums of exchange store
 */
export class MediumOfExchangeStoreError extends Data.TaggedError('MediumOfExchangeStoreError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: { [key: string]: unknown };
}> {
  static fromError(error: unknown, message: string, context?: { [key: string]: unknown }) {
    return new MediumOfExchangeStoreError({
      message,
      cause: error,
      context
    });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a complete UIMediumOfExchange from a record using standardized helper pattern
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
const createUIMediumOfExchange = createUIEntityFromRecord<
  MediumOfExchangeInDHT,
  UIMediumOfExchange
>((entry, actionHash, timestamp, additionalData) => {
  const status = (additionalData?.status as 'pending' | 'approved' | 'rejected') || 'pending';

  return {
    actionHash,
    original_action_hash: actionHash,
    code: entry.code,
    name: entry.name,
    description: entry.description || null,
    resourceSpecHreaId: entry.resource_spec_hrea_id || null,
    exchange_type: 'base' as 'base' | 'currency', // Default to 'base' type
    status,
    createdAt: new Date(timestamp / 1000), // Convert microseconds to milliseconds
    updatedAt: undefined // Will be set if there are updates
  };
});

/**
 * Creates enhanced UIMediumOfExchange from record with status processing
 * This handles status determination for the medium of exchange
 */
const createEnhancedUIMediumOfExchange = (
  record: HolochainRecord,
  status: 'pending' | 'approved' | 'rejected'
): UIMediumOfExchange | null => {
  const additionalData = { status };
  return createUIMediumOfExchange(record, additionalData);
};

/**
 * MEDIUMS OF EXCHANGE STORE - USING STANDARDIZED STORE HELPER PATTERNS
 *
 * This store demonstrates the integration of standardized helper functions following the Service Types template:
 *
 * 1. createUIEntityFromRecord - Entity creation from Holochain records
 * 2. createGenericCacheSyncHelper - Cache-to-state synchronization
 * 3. createStatusAwareEventEmitters - Type-safe event emission with status support
 * 4. withLoadingState - Consistent loading/error state management
 * 5. createEntityCreationHelper - Standardized entity creation with validation
 * 6. createErrorHandler - Domain-specific error handling
 * 7. createEntityFetcher - Data fetching with loading state and error handling
 * 8. createCacheLookupFunction - Cache miss handling with service fallback
 *
 * This implementation focuses on consistent patterns for CRUD operations with
 * proper error handling, caching, and event emission for status-aware entities.
 *
 * @returns An Effect that creates a mediums of exchange store with state and methods
 */

// ============================================================================
// STORE TYPE DEFINITION
// ============================================================================

export type MediumsOfExchangeStore = {
  readonly mediumsOfExchange: UIMediumOfExchange[];
  readonly pendingMediumsOfExchange: UIMediumOfExchange[];
  readonly approvedMediumsOfExchange: UIMediumOfExchange[];
  readonly rejectedMediumsOfExchange: UIMediumOfExchange[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIMediumOfExchange>;

  getMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<UIMediumOfExchange | null, MediumOfExchangeStoreError>;
  getLatestMediumOfExchangeRecord: (
    originalActionHash: ActionHash
  ) => E.Effect<UIMediumOfExchange | null, MediumOfExchangeStoreError>;
  getAllMediumsOfExchange: () => E.Effect<UIMediumOfExchange[], MediumOfExchangeStoreError>;
  suggestMediumOfExchange: (
    mediumOfExchange: MediumOfExchangeInDHT
  ) => E.Effect<HolochainRecord, MediumOfExchangeStoreError>;
  createMediumOfExchange: (
    mediumOfExchange: MediumOfExchangeInDHT
  ) => E.Effect<HolochainRecord, MediumOfExchangeStoreError>;
  getPendingMediumsOfExchange: () => E.Effect<UIMediumOfExchange[], MediumOfExchangeStoreError>;
  getApprovedMediumsOfExchange: () => E.Effect<UIMediumOfExchange[], MediumOfExchangeStoreError>;
  getRejectedMediumsOfExchange: () => E.Effect<UIMediumOfExchange[], MediumOfExchangeStoreError>;
  approveMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeStoreError>;
  rejectMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeStoreError>;
  getAllMediumsOfExchangeByStatus: () => E.Effect<
    MediumsOfExchangeCollection,
    MediumOfExchangeStoreError
  >;
  updateMediumOfExchange: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedMediumOfExchange: MediumOfExchangeInDHT
  ) => E.Effect<HolochainRecord, MediumOfExchangeStoreError>;
  deleteMediumOfExchange: (
    mediumOfExchangeHash: ActionHash
  ) => E.Effect<void, MediumOfExchangeStoreError>;
  invalidateCache: () => void;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to synchronize cache with local state arrays for status-aware entities
 * Extends the generic cache sync helper to handle status-specific arrays
 */
const createStatusCacheSyncHelper = (
  mediumsOfExchange: UIMediumOfExchange[],
  pendingMediumsOfExchange: UIMediumOfExchange[],
  approvedMediumsOfExchange: UIMediumOfExchange[],
  rejectedMediumsOfExchange: UIMediumOfExchange[]
): {
  syncCacheToState: (entity: UIMediumOfExchange, operation: 'add' | 'update' | 'remove') => void;
} => {
  // Use the generic helper for the main array
  const { syncCacheToState: genericSync } = createGenericCacheSyncHelper({
    all: mediumsOfExchange
  });

  const syncCacheToState = (entity: UIMediumOfExchange, operation: 'add' | 'update' | 'remove') => {
    const hash = entity.actionHash?.toString();
    if (!hash) return;

    const findAndRemoveFromArray = (array: UIMediumOfExchange[]) => {
      const index = array.findIndex((moe) => moe.actionHash?.toString() === hash);
      if (index !== -1) {
        return array.splice(index, 1)[0];
      }
      return null;
    };

    const addToArray = (array: UIMediumOfExchange[], item: UIMediumOfExchange) => {
      const existingIndex = array.findIndex((moe) => moe.actionHash?.toString() === hash);
      if (existingIndex !== -1) {
        array[existingIndex] = item;
      } else {
        array.push(item);
      }
    };

    // Use generic sync for main array
    genericSync(entity, operation);

    switch (operation) {
      case 'add':
      case 'update':
        // Remove from all status arrays first
        findAndRemoveFromArray(pendingMediumsOfExchange);
        findAndRemoveFromArray(approvedMediumsOfExchange);
        findAndRemoveFromArray(rejectedMediumsOfExchange);

        // Add to appropriate status array
        switch (entity.status) {
          case 'pending':
            addToArray(pendingMediumsOfExchange, entity);
            break;
          case 'approved':
            addToArray(approvedMediumsOfExchange, entity);
            break;
          case 'rejected':
            addToArray(rejectedMediumsOfExchange, entity);
            break;
        }
        break;
      case 'remove':
        findAndRemoveFromArray(pendingMediumsOfExchange);
        findAndRemoveFromArray(approvedMediumsOfExchange);
        findAndRemoveFromArray(rejectedMediumsOfExchange);
        break;
    }
  };

  return { syncCacheToState };
};

// The cache lookup is simplified since we'll use the standardized cache lookup pattern

// Event emitters are now handled by the standardized event emitters

// Record processing is now handled by standardized helpers

// Status transition is now handled by standardized helpers

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create a mediums of exchange store as an Effect
 * @returns An Effect that creates a mediums of exchange store with state and methods
 */
export const createMediumsOfExchangeStore = (): E.Effect<
  MediumsOfExchangeStore,
  never,
  MediumsOfExchangeServiceTag | CacheServiceTag
> => {
  return E.gen(function* () {
    const mediumsOfExchangeService = yield* MediumsOfExchangeServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================

    const mediumsOfExchange: UIMediumOfExchange[] = $state([]);
    const pendingMediumsOfExchange: UIMediumOfExchange[] = $state([]);
    const approvedMediumsOfExchange: UIMediumOfExchange[] = $state([]);
    const rejectedMediumsOfExchange: UIMediumOfExchange[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // ===== HELPER FUNCTIONS =====

    // 1. LOADING STATE MANAGEMENT - Using LoadingStateSetter interface
    const setters: LoadingStateSetter = {
      setLoading: (value) => {
        loading = value;
      },
      setError: (value) => {
        error = value;
      }
    };

    // 2. CACHE SYNCHRONIZATION - Using specialized status-aware cache sync helper
    const { syncCacheToState } = createStatusCacheSyncHelper(
      mediumsOfExchange,
      pendingMediumsOfExchange,
      approvedMediumsOfExchange,
      rejectedMediumsOfExchange
    );

    // 3. EVENT EMITTERS - Using createStatusAwareEventEmitters
    const eventEmitters = mediumOfExchangeEventEmitters;

    // 4. CACHE MANAGEMENT - Using standardized cache lookup pattern
    const cache = yield* cacheService.createEntityCache<UIMediumOfExchange>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      mediumOfExchangeCacheLookup
    );

    // 6. STATUS TRANSITION HELPER - Using standardized status transition helper
    const statusTransitionHelper = {
      transitionMediumOfExchangeStatus: (
        mediumOfExchangeHash: ActionHash,
        newStatus: 'approved' | 'rejected'
      ): UIMediumOfExchange | null => {
        const hashStr = mediumOfExchangeHash.toString();

        // Find the medium of exchange in pending list
        const pendingIndex = pendingMediumsOfExchange.findIndex(
          (moe) => moe.actionHash?.toString() === hashStr
        );

        if (pendingIndex === -1) {
          console.warn('Medium of exchange not found in pending list:', hashStr);
          return null;
        }

        // Remove from pending
        const [mediumOfExchange] = pendingMediumsOfExchange.splice(pendingIndex, 1);

        // Update status and timestamp
        const updatedMediumOfExchange: UIMediumOfExchange = {
          ...mediumOfExchange,
          status: newStatus,
          updatedAt: new Date()
        };

        // Sync cache and state
        E.runSync(cache.set(hashStr, updatedMediumOfExchange));
        syncCacheToState(updatedMediumOfExchange, 'update');

        return updatedMediumOfExchange;
      }
    };

    // ========================================================================
    // CACHE OPERATIONS
    // ========================================================================

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      mediumsOfExchange.length = 0;
      pendingMediumsOfExchange.length = 0;
      approvedMediumsOfExchange.length = 0;
      rejectedMediumsOfExchange.length = 0;
      setters.setError(null);
    };

    // ========================================================================
    // STORE METHODS - READ OPERATIONS
    // ========================================================================

    const getMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<UIMediumOfExchange | null, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getMediumOfExchange(mediumOfExchangeHash),
          E.map((record) => {
            if (!record) return null;

            // For individual medium retrieval, assume it's approved since it's linked to a request/offer
            const entity = createEnhancedUIMediumOfExchange(record, 'approved');
            if (entity) {
              E.runSync(cache.set(mediumOfExchangeHash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
            return entity;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.GET_MEDIUM)
            )
          )
        )
      )(setters);

    const getLatestMediumOfExchangeRecord = (
      originalActionHash: ActionHash
    ): E.Effect<UIMediumOfExchange | null, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getLatestMediumOfExchangeRecord(originalActionHash),
          E.map((record) => {
            if (!record) return null;

            // For individual medium retrieval, assume it's approved
            const entity = createEnhancedUIMediumOfExchange(record, 'approved');
            if (entity) {
              E.runSync(cache.set(originalActionHash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
            return entity;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.GET_LATEST_MEDIUM_RECORD
              )
            )
          )
        )
      )(setters);

    const createMediumOfExchange = (
      mediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<HolochainRecord, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.createMediumOfExchange(mediumOfExchange),
          E.map((record) => {
            const entity = createEnhancedUIMediumOfExchange(record, 'approved'); // Admin creates are auto-approved
            if (entity) {
              E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
            return record;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.CREATE_MEDIUM)
            )
          )
        )
      )(setters);

    const getAllMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getAllMediumsOfExchange(),
          E.map((records) => {
            const entities = records
              .map((record) => {
                // Determine status - simplified approach
                const entity = createEnhancedUIMediumOfExchange(record, 'pending');
                if (entity) {
                  E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
                  syncCacheToState(entity, 'add');
                }
                return entity;
              })
              .filter((entity): entity is UIMediumOfExchange => entity !== null);

            // Update main array
            mediumsOfExchange.splice(0, mediumsOfExchange.length, ...entities);
            return entities;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.GET_ALL_MEDIUMS
              )
            )
          )
        )
      )(setters);

    const getPendingMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getPendingMediumsOfExchange(),
          E.map((records) => {
            const entities = records
              .map((record) => {
                const entity = createEnhancedUIMediumOfExchange(record, 'pending');
                if (entity) {
                  E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
                  syncCacheToState(entity, 'add');
                }
                return entity;
              })
              .filter((entity): entity is UIMediumOfExchange => entity !== null);

            // Update pending array
            pendingMediumsOfExchange.splice(0, pendingMediumsOfExchange.length, ...entities);
            return entities;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.GET_PENDING_MEDIUMS
              )
            )
          )
        )
      )(setters);

    const getApprovedMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getApprovedMediumsOfExchange(),
          E.map((records) => {
            const entities = records
              .map((record) => {
                const entity = createEnhancedUIMediumOfExchange(record, 'approved');
                if (entity) {
                  E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
                  syncCacheToState(entity, 'add');
                }
                return entity;
              })
              .filter((entity): entity is UIMediumOfExchange => entity !== null);

            // Update approved array
            approvedMediumsOfExchange.splice(0, approvedMediumsOfExchange.length, ...entities);
            return entities;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.GET_APPROVED_MEDIUMS
              )
            )
          )
        )
      )(setters);

    const getRejectedMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getRejectedMediumsOfExchange(),
          E.map((records) => {
            const entities = records
              .map((record) => {
                const entity = createEnhancedUIMediumOfExchange(record, 'rejected');
                if (entity) {
                  E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
                  syncCacheToState(entity, 'add');
                }
                return entity;
              })
              .filter((entity): entity is UIMediumOfExchange => entity !== null);

            // Update rejected array
            rejectedMediumsOfExchange.splice(0, rejectedMediumsOfExchange.length, ...entities);
            return entities;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.GET_REJECTED_MEDIUMS
              )
            )
          )
        )
      )(setters);

    const getAllMediumsOfExchangeByStatus = (): E.Effect<
      MediumsOfExchangeCollection,
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          E.all([
            mediumsOfExchangeService.getPendingMediumsOfExchange(),
            mediumsOfExchangeService.getApprovedMediumsOfExchange(),
            mediumsOfExchangeService.getRejectedMediumsOfExchange()
          ]),
          E.map(([pendingRecords, approvedRecords, rejectedRecords]) => {
            // Clear all state arrays
            mediumsOfExchange.length = 0;
            pendingMediumsOfExchange.length = 0;
            approvedMediumsOfExchange.length = 0;
            rejectedMediumsOfExchange.length = 0;

            // Process each category
            pendingRecords.forEach((record) => {
              const entity = createEnhancedUIMediumOfExchange(record, 'pending');
              if (entity) {
                E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
                syncCacheToState(entity, 'add');
              }
            });

            approvedRecords.forEach((record) => {
              const entity = createEnhancedUIMediumOfExchange(record, 'approved');
              if (entity) {
                E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
                syncCacheToState(entity, 'add');
              }
            });

            rejectedRecords.forEach((record) => {
              const entity = createEnhancedUIMediumOfExchange(record, 'rejected');
              if (entity) {
                E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
                syncCacheToState(entity, 'add');
              }
            });

            return {
              pending: pendingRecords,
              approved: approvedRecords,
              rejected: rejectedRecords
            };
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.GET_ALL_MEDIUMS
              )
            )
          )
        )
      )(setters);

    // ========================================================================
    // STORE METHODS - WRITE OPERATIONS
    // ========================================================================

    const suggestMediumOfExchange = (
      mediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<HolochainRecord, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.suggestMediumOfExchange(mediumOfExchange),
          E.map((record) => {
            const entity = createEnhancedUIMediumOfExchange(record, 'pending');
            if (entity) {
              E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
            return record;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.SUGGEST_MEDIUM
              )
            )
          )
        )
      )(setters);

    const approveMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.approveMediumOfExchange(mediumOfExchangeHash),
          E.map(() => {
            const updatedMediumOfExchange = statusTransitionHelper.transitionMediumOfExchangeStatus(
              mediumOfExchangeHash,
              'approved'
            );
            if (updatedMediumOfExchange) {
              eventEmitters.emitStatusChanged?.(updatedMediumOfExchange);
            }
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(
                error,
                MEDIUM_OF_EXCHANGE_CONTEXTS.APPROVE_MEDIUM
              )
            )
          )
        )
      )(setters);

    const rejectMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.rejectMediumOfExchange(mediumOfExchangeHash),
          E.map(() => {
            const updatedMediumOfExchange = statusTransitionHelper.transitionMediumOfExchangeStatus(
              mediumOfExchangeHash,
              'rejected'
            );
            if (updatedMediumOfExchange) {
              eventEmitters.emitStatusChanged?.(updatedMediumOfExchange);
            }
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.REJECT_MEDIUM)
            )
          )
        )
      )(setters);

    const updateMediumOfExchange = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedMediumOfExchange: MediumOfExchangeInDHT
    ): E.Effect<HolochainRecord, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.updateMediumOfExchange(
            originalActionHash,
            previousActionHash,
            updatedMediumOfExchange
          ),
          E.map((record) => {
            // First, remove the old entry using the previous action hash
            const previousHashStr = previousActionHash.toString();
            E.runSync(cache.delete(previousHashStr));

            // Create dummy entity for removal
            const dummyEntity = {
              actionHash: previousActionHash,
              status: 'pending'
            } as UIMediumOfExchange;
            syncCacheToState(dummyEntity, 'remove');

            // Now add the new updated entry
            const entity = createEnhancedUIMediumOfExchange(record, 'approved'); // Admin updates are auto-approved
            if (entity) {
              E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitUpdated(entity);
            }
            return record;
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.UPDATE_MEDIUM)
            )
          )
        )
      )(setters);

    const deleteMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.deleteMediumOfExchange(mediumOfExchangeHash),
          E.map(() => {
            E.runSync(cache.invalidate(mediumOfExchangeHash.toString()));
            const dummyEntity = {
              actionHash: mediumOfExchangeHash,
              status: 'pending'
            } as UIMediumOfExchange;
            syncCacheToState(dummyEntity, 'remove');
            eventEmitters.emitDeleted(mediumOfExchangeHash);
          }),
          E.catchAll((error) =>
            E.fail(
              MediumOfExchangeStoreError.fromError(error, MEDIUM_OF_EXCHANGE_CONTEXTS.DELETE_MEDIUM)
            )
          )
        )
      )(setters);

    // ========================================================================
    // STORE OBJECT RETURN
    // ========================================================================

    return {
      get mediumsOfExchange() {
        return mediumsOfExchange;
      },
      get pendingMediumsOfExchange() {
        return pendingMediumsOfExchange;
      },
      get approvedMediumsOfExchange() {
        return approvedMediumsOfExchange;
      },
      get rejectedMediumsOfExchange() {
        return rejectedMediumsOfExchange;
      },
      get loading() {
        return loading;
      },
      get error() {
        return error;
      },
      get cache() {
        return cache;
      },
      invalidateCache,
      getMediumOfExchange,
      getLatestMediumOfExchangeRecord,
      getAllMediumsOfExchange,
      suggestMediumOfExchange,
      createMediumOfExchange,
      getPendingMediumsOfExchange,
      getApprovedMediumsOfExchange,
      getRejectedMediumsOfExchange,
      approveMediumOfExchange,
      rejectMediumOfExchange,
      getAllMediumsOfExchangeByStatus,
      updateMediumOfExchange,
      deleteMediumOfExchange
    };
  });
};

// ============================================================================
// LIVE LAYER AND STORE INSTANCE
// ============================================================================

/**
 * Live layer for the mediums of exchange store
 */
const mediumsOfExchangeStore = pipe(
  createMediumsOfExchangeStore(),
  E.provide(MediumsOfExchangeServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runSync
);

export default mediumsOfExchangeStore;
