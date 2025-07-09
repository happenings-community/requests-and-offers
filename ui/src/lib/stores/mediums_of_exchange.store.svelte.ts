import type { ActionHash, Record as HolochainRecord } from '@holochain/client';
import {
  MediumsOfExchangeServiceTag,
  MediumsOfExchangeServiceLive,
  type MediumsOfExchangeService,
  MediumOfExchangeError
} from '$lib/services/zomes/mediums-of-exchange.service';
import type {
  MediumOfExchangeInDHT,
  UIMediumOfExchange,
  MediumsOfExchangeCollection
} from '$lib/schemas/mediums-of-exchange.schemas';
import { decode } from '@msgpack/msgpack';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Data, Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { CacheNotFoundError } from '$lib/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Error context constants
const ERROR_CONTEXTS = {
  SUGGEST_MEDIUM_OF_EXCHANGE: 'Failed to suggest medium of exchange',
  GET_MEDIUM_OF_EXCHANGE: 'Failed to get medium of exchange',
  GET_ALL_MEDIUMS_OF_EXCHANGE: 'Failed to get all mediums of exchange',
  GET_PENDING_MEDIUMS_OF_EXCHANGE: 'Failed to get pending mediums of exchange',
  GET_APPROVED_MEDIUMS_OF_EXCHANGE: 'Failed to get approved mediums of exchange',
  GET_REJECTED_MEDIUMS_OF_EXCHANGE: 'Failed to get rejected mediums of exchange',
  APPROVE_MEDIUM_OF_EXCHANGE: 'Failed to approve medium of exchange',
  REJECT_MEDIUM_OF_EXCHANGE: 'Failed to reject medium of exchange',
  EMIT_MEDIUM_OF_EXCHANGE_SUGGESTED: 'Failed to emit medium of exchange suggested event',
  EMIT_MEDIUM_OF_EXCHANGE_APPROVED: 'Failed to emit medium of exchange approved event',
  EMIT_MEDIUM_OF_EXCHANGE_REJECTED: 'Failed to emit medium of exchange rejected event'
} as const;

// ============================================================================
// ERROR TYPES
// ============================================================================

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
 * Creates a UI medium of exchange from a record
 */
const createUIMediumOfExchange = (
  record: HolochainRecord,
  status: 'pending' | 'approved' | 'rejected'
): UIMediumOfExchange => {
  const entry = decode((record.entry as any).Present.entry) as MediumOfExchangeInDHT;
  const actionHash = record.signed_action.hashed.hash;
  const timestamp = record.signed_action.hashed.content.timestamp;

  return {
    actionHash,
    original_action_hash: actionHash, // Required for CacheableEntity compatibility
    code: entry.code,
    name: entry.name,
    resourceSpecHreaId: entry.resource_spec_hrea_id || null,
    status,
    createdAt: new Date(timestamp / 1000), // Convert microseconds to milliseconds
    updatedAt: undefined // Will be set if there are updates
  };
};

/**
 * Parses hash from cache key
 */
const parseHashFromCacheKey = (key: string): ActionHash => {
  // Cache keys are typically in format "prefix:hash" or just "hash"
  const hashPart = key.includes(':') ? key.split(':')[1] : key;
  return new Uint8Array(Buffer.from(hashPart, 'base64'));
};

/**
 * Helper function to determine medium of exchange status by checking all status buckets
 */
const createStatusDeterminer = (mediumsOfExchangeService: MediumsOfExchangeService) => {
  const determineMediumOfExchangeStatus = (
    mediumOfExchangeHash: ActionHash
  ): E.Effect<'pending' | 'approved' | 'rejected' | null, MediumOfExchangeError> =>
    pipe(
      E.all([
        mediumsOfExchangeService.getPendingMediumsOfExchange(),
        mediumsOfExchangeService.getApprovedMediumsOfExchange(),
        mediumsOfExchangeService.getRejectedMediumsOfExchange()
      ]),
      E.map(([pending, approved, rejected]) => {
        const hashStr = mediumOfExchangeHash.toString();

        // Check if it's in pending
        if (pending.some((record) => record.signed_action.hashed.hash.toString() === hashStr)) {
          return 'pending' as const;
        }

        // Check if it's in approved
        if (approved.some((record) => record.signed_action.hashed.hash.toString() === hashStr)) {
          return 'approved' as const;
        }

        // Check if it's in rejected
        if (rejected.some((record) => record.signed_action.hashed.hash.toString() === hashStr)) {
          return 'rejected' as const;
        }

        // Not found in any status bucket
        return null;
      })
    );

  return { determineMediumOfExchangeStatus };
};

/**
 * Higher-order function to wrap operations with loading state management
 */
const withLoadingState =
  <T, E>(
    operation: () => E.Effect<T, E>
  ): ((
    setLoading: (loading: boolean) => void,
    setError: (error: string | null) => void
  ) => E.Effect<T, E>) =>
  (setLoading, setError) =>
    pipe(
      E.sync(() => {
        setLoading(true);
        setError(null);
      }),
      E.flatMap(() => operation()),
      E.tap(() => E.sync(() => setLoading(false))),
      E.tapError((error) =>
        E.sync(() => {
          setLoading(false);
          setError(error instanceof Error ? error.message : String(error));
        })
      )
    );

/**
 * Creates error handler for specific contexts
 */
const createErrorHandler =
  (context: string) =>
  (error: unknown): E.Effect<never, MediumOfExchangeStoreError> =>
    E.fail(MediumOfExchangeStoreError.fromError(error, context));

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
  getAllMediumsOfExchange: () => E.Effect<UIMediumOfExchange[], MediumOfExchangeStoreError>;
  suggestMediumOfExchange: (
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
  invalidateCache: () => void;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper to synchronize cache with local state arrays
 */
const createCacheSyncHelper = (
  mediumsOfExchange: UIMediumOfExchange[],
  pendingMediumsOfExchange: UIMediumOfExchange[],
  approvedMediumsOfExchange: UIMediumOfExchange[],
  rejectedMediumsOfExchange: UIMediumOfExchange[]
) => {
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

    switch (operation) {
      case 'add':
      case 'update':
        // Remove from all arrays first
        findAndRemoveFromArray(mediumsOfExchange);
        findAndRemoveFromArray(pendingMediumsOfExchange);
        findAndRemoveFromArray(approvedMediumsOfExchange);
        findAndRemoveFromArray(rejectedMediumsOfExchange);

        // Add to appropriate arrays
        addToArray(mediumsOfExchange, entity);
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
        findAndRemoveFromArray(mediumsOfExchange);
        findAndRemoveFromArray(pendingMediumsOfExchange);
        findAndRemoveFromArray(approvedMediumsOfExchange);
        findAndRemoveFromArray(rejectedMediumsOfExchange);
        break;
    }
  };

  return { syncCacheToState };
};

/**
 * Creates cache lookup function for cache misses
 */
const createCacheLookupFunction = (mediumsOfExchangeService: MediumsOfExchangeService) => {
  const lookupMediumOfExchange = (key: string): E.Effect<UIMediumOfExchange, CacheNotFoundError> =>
    pipe(
      E.tryPromise({
        try: async () => {
          const hash = parseHashFromCacheKey(key);

          // Get the record from the service
          const record = await E.runPromise(mediumsOfExchangeService.getMediumOfExchange(hash));

          if (!record) {
            throw new CacheNotFoundError({ key });
          }

          // Determine status using the status determiner
          const { determineMediumOfExchangeStatus } =
            createStatusDeterminer(mediumsOfExchangeService);
          const status = await E.runPromise(determineMediumOfExchangeStatus(hash));

          // Create UI medium of exchange with determined status
          return createUIMediumOfExchange(record, status || 'pending');
        },
        catch: (error) => {
          if (error instanceof CacheNotFoundError) {
            return error;
          }
          return new CacheNotFoundError({ key });
        }
      })
    );

  return { lookupMediumOfExchange };
};

/**
 * Creates event emitters for store events
 */
const createEventEmitters = () => {
  const emitMediumOfExchangeSuggested = (mediumOfExchange: UIMediumOfExchange): void => {
    try {
      storeEventBus.emit('mediumOfExchange:suggested', { mediumOfExchange });
    } catch (error) {
      console.error('Failed to emit mediumOfExchange:suggested event:', error);
    }
  };

  const emitMediumOfExchangeApproved = (mediumOfExchange: UIMediumOfExchange): void => {
    try {
      storeEventBus.emit('mediumOfExchange:approved', { mediumOfExchange });
    } catch (error) {
      console.error('Failed to emit mediumOfExchange:approved event:', error);
    }
  };

  const emitMediumOfExchangeRejected = (mediumOfExchange: UIMediumOfExchange): void => {
    try {
      storeEventBus.emit('mediumOfExchange:rejected', { mediumOfExchange });
    } catch (error) {
      console.error('Failed to emit mediumOfExchange:rejected event:', error);
    }
  };

  return {
    emitMediumOfExchangeSuggested,
    emitMediumOfExchangeApproved,
    emitMediumOfExchangeRejected
  };
};

/**
 * Creates record processing helper
 */
const createRecordProcessingHelper = (
  cache: EntityCacheService<UIMediumOfExchange>,
  syncCacheToState: (entity: UIMediumOfExchange, operation: 'add' | 'update' | 'remove') => void
) => {
  const processRecord = (
    record: HolochainRecord,
    status: 'pending' | 'approved' | 'rejected'
  ): { record: HolochainRecord; mediumOfExchange: UIMediumOfExchange } => {
    const mediumOfExchange = createUIMediumOfExchange(record, status);

    // Add to cache
    E.runSync(cache.set(record.signed_action.hashed.hash.toString(), mediumOfExchange));

    // Sync to state
    syncCacheToState(mediumOfExchange, 'add');

    return { record, mediumOfExchange };
  };

  return { processRecord };
};

/**
 * Creates status transition helper for admin operations
 */
const createStatusTransitionHelper = (
  pendingMediumsOfExchange: UIMediumOfExchange[],
  approvedMediumsOfExchange: UIMediumOfExchange[],
  rejectedMediumsOfExchange: UIMediumOfExchange[],
  cache: EntityCacheService<UIMediumOfExchange>
) => {
  const transitionMediumOfExchangeStatus = (
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

    // Add to appropriate list
    if (newStatus === 'approved') {
      approvedMediumsOfExchange.push(updatedMediumOfExchange);
    } else {
      rejectedMediumsOfExchange.push(updatedMediumOfExchange);
    }

    // Update cache
    E.runSync(cache.set(hashStr, updatedMediumOfExchange));

    return updatedMediumOfExchange;
  };

  return { transitionMediumOfExchangeStatus };
};

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

    // State setters for use with higher-order functions
    const setLoading = (value: boolean) => {
      loading = value;
    };
    const setError = (value: string | null) => {
      error = value;
    };

    // ========================================================================
    // HELPER INITIALIZATION
    // ========================================================================

    const { syncCacheToState } = createCacheSyncHelper(
      mediumsOfExchange,
      pendingMediumsOfExchange,
      approvedMediumsOfExchange,
      rejectedMediumsOfExchange
    );

    const { lookupMediumOfExchange } = createCacheLookupFunction(mediumsOfExchangeService);

    const {
      emitMediumOfExchangeSuggested,
      emitMediumOfExchangeApproved,
      emitMediumOfExchangeRejected
    } = createEventEmitters();

    // ========================================================================
    // CACHE SETUP
    // ========================================================================

    const cache = yield* cacheService.createEntityCache<UIMediumOfExchange>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupMediumOfExchange
    );

    const { processRecord } = createRecordProcessingHelper(cache, syncCacheToState);

    const { transitionMediumOfExchangeStatus } = createStatusTransitionHelper(
      pendingMediumsOfExchange,
      approvedMediumsOfExchange,
      rejectedMediumsOfExchange,
      cache
    );

    // ========================================================================
    // CACHE OPERATIONS
    // ========================================================================

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      mediumsOfExchange.length = 0;
      pendingMediumsOfExchange.length = 0;
      approvedMediumsOfExchange.length = 0;
      rejectedMediumsOfExchange.length = 0;
      setError(null);
    };

    // ========================================================================
    // STORE METHODS - READ OPERATIONS
    // ========================================================================

    // Create status determiner for this store instance
    const { determineMediumOfExchangeStatus } = createStatusDeterminer(mediumsOfExchangeService);

    const getMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<UIMediumOfExchange | null, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getMediumOfExchange(mediumOfExchangeHash),
          E.flatMap((record) => {
            if (!record) return E.succeed(null);

            // Determine the actual status by checking all status buckets
            return pipe(
              determineMediumOfExchangeStatus(mediumOfExchangeHash),
              E.map((status) => createUIMediumOfExchange(record, status || 'pending')),
              E.mapError((error) =>
                MediumOfExchangeStoreError.fromError(error, ERROR_CONTEXTS.GET_MEDIUM_OF_EXCHANGE)
              )
            );
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_MEDIUM_OF_EXCHANGE))
        )
      )(setLoading, setError);

    const getAllMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getAllMediumsOfExchange(),
          E.map((records) => {
            // Clear existing state
            mediumsOfExchange.length = 0;

            return records.map((record) => {
              // Determine status - simplified approach
              const uiMediumOfExchange = createUIMediumOfExchange(record, 'pending');
              syncCacheToState(uiMediumOfExchange, 'add');
              return uiMediumOfExchange;
            });
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_ALL_MEDIUMS_OF_EXCHANGE))
        )
      )(setLoading, setError);

    const getPendingMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getPendingMediumsOfExchange(),
          E.map((records) => {
            // Clear existing pending state
            pendingMediumsOfExchange.length = 0;

            return records.map((record) => {
              const uiMediumOfExchange = createUIMediumOfExchange(record, 'pending');
              syncCacheToState(uiMediumOfExchange, 'add');
              return uiMediumOfExchange;
            });
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_PENDING_MEDIUMS_OF_EXCHANGE))
        )
      )(setLoading, setError);

    const getApprovedMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getApprovedMediumsOfExchange(),
          E.map((records) => {
            // Clear existing approved state
            approvedMediumsOfExchange.length = 0;

            return records.map((record) => {
              const uiMediumOfExchange = createUIMediumOfExchange(record, 'approved');
              syncCacheToState(uiMediumOfExchange, 'add');
              return uiMediumOfExchange;
            });
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_APPROVED_MEDIUMS_OF_EXCHANGE))
        )
      )(setLoading, setError);

    const getRejectedMediumsOfExchange = (): E.Effect<
      UIMediumOfExchange[],
      MediumOfExchangeStoreError
    > =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.getRejectedMediumsOfExchange(),
          E.map((records) => {
            // Clear existing rejected state
            rejectedMediumsOfExchange.length = 0;

            return records.map((record) => {
              const uiMediumOfExchange = createUIMediumOfExchange(record, 'rejected');
              syncCacheToState(uiMediumOfExchange, 'add');
              return uiMediumOfExchange;
            });
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_REJECTED_MEDIUMS_OF_EXCHANGE))
        )
      )(setLoading, setError);

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
              const uiMediumOfExchange = createUIMediumOfExchange(record, 'pending');
              syncCacheToState(uiMediumOfExchange, 'add');
            });

            approvedRecords.forEach((record) => {
              const uiMediumOfExchange = createUIMediumOfExchange(record, 'approved');
              syncCacheToState(uiMediumOfExchange, 'add');
            });

            rejectedRecords.forEach((record) => {
              const uiMediumOfExchange = createUIMediumOfExchange(record, 'rejected');
              syncCacheToState(uiMediumOfExchange, 'add');
            });

            return {
              pending: pendingRecords,
              approved: approvedRecords,
              rejected: rejectedRecords
            };
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_ALL_MEDIUMS_OF_EXCHANGE))
        )
      )(setLoading, setError);

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
            const { mediumOfExchange: newMediumOfExchange } = processRecord(record, 'pending');
            emitMediumOfExchangeSuggested(newMediumOfExchange);
            return record;
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.SUGGEST_MEDIUM_OF_EXCHANGE))
        )
      )(setLoading, setError);

    const approveMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.approveMediumOfExchange(mediumOfExchangeHash),
          E.map(() => {
            const updatedMediumOfExchange = transitionMediumOfExchangeStatus(
              mediumOfExchangeHash,
              'approved'
            );
            if (updatedMediumOfExchange) {
              emitMediumOfExchangeApproved(updatedMediumOfExchange);
            }
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.APPROVE_MEDIUM_OF_EXCHANGE))
        )
      )(setLoading, setError);

    const rejectMediumOfExchange = (
      mediumOfExchangeHash: ActionHash
    ): E.Effect<void, MediumOfExchangeStoreError> =>
      withLoadingState(() =>
        pipe(
          mediumsOfExchangeService.rejectMediumOfExchange(mediumOfExchangeHash),
          E.map(() => {
            const updatedMediumOfExchange = transitionMediumOfExchangeStatus(
              mediumOfExchangeHash,
              'rejected'
            );
            if (updatedMediumOfExchange) {
              emitMediumOfExchangeRejected(updatedMediumOfExchange);
            }
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.REJECT_MEDIUM_OF_EXCHANGE))
        )
      )(setLoading, setError);

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
      getAllMediumsOfExchange,
      suggestMediumOfExchange,
      getPendingMediumsOfExchange,
      getApprovedMediumsOfExchange,
      getRejectedMediumsOfExchange,
      approveMediumOfExchange,
      rejectMediumOfExchange,
      getAllMediumsOfExchangeByStatus
    };
  });
};

// ============================================================================
// LIVE LAYER AND STORE INSTANCE
// ============================================================================

/**
 * Live layer for the mediums of exchange store
 */
export const MediumsOfExchangeStoreLive = pipe(
  createMediumsOfExchangeStore(),
  E.provide(MediumsOfExchangeServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive)
);

/**
 * Store instance for use in components
 */
const mediumsOfExchangeStore = E.runSync(MediumsOfExchangeStoreLive);

export default mediumsOfExchangeStore;
