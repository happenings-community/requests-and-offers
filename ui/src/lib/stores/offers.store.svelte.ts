/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionHash, Record } from '@holochain/client';
import { decodeHashFromBase64 } from '@holochain/client';
import { OffersServiceTag, OffersServiceLive } from '$lib/services/zomes/offers.service';
import type { UIOffer } from '$lib/types/ui';
import type { OfferInDHT, OfferInput } from '$lib/types/holochain';

import { decode } from '@msgpack/msgpack';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { OfferError } from '$lib/errors/offers.errors';

// Create a store-specific error that extends the base OfferError
export class OfferStoreError extends OfferError {}
import { CacheNotFoundError } from '$lib/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Error context constants for consistent error messaging
const ERROR_CONTEXTS = {
  CREATE_OFFER: 'Failed to create offer',
  GET_OFFER: 'Failed to get offer',
  GET_ALL_OFFERS: 'Failed to get all offers',
  GET_USER_OFFERS: 'Failed to get user offers',
  GET_ORGANIZATION_OFFERS: 'Failed to get organization offers',
  UPDATE_OFFER: 'Failed to update offer',
  DELETE_OFFER: 'Failed to delete offer',
  GET_LATEST_OFFER: 'Failed to get latest offer',
  GET_OFFERS_BY_TAG: 'Failed to get offers by tag',
  GET_MEDIUMS_OF_EXCHANGE_FOR_OFFER: 'Failed to get mediums of exchange for offer',
  DECODE_OFFERS: 'Failed to decode or process offers',
  CHECK_OFFERS_EXIST: 'Failed to check if offers exist'
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Define a proper Entry type to avoid using 'any'
type HolochainEntry = {
  Present: {
    entry: Uint8Array;
  };
};

export type OffersStore = {
  readonly offers: UIOffer[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIOffer>;

  getOffer: (offerHash: ActionHash) => E.Effect<UIOffer | null, OfferStoreError>;
  getLatestOffer: (originalActionHash: ActionHash) => E.Effect<UIOffer | null, OfferStoreError>;
  getAllOffers: () => E.Effect<UIOffer[], OfferStoreError>;
  getUserOffers: (userHash: ActionHash) => E.Effect<UIOffer[], OfferStoreError>;
  getOrganizationOffers: (organizationHash: ActionHash) => E.Effect<UIOffer[], OfferStoreError>;
  createOffer: (
    offer: OfferInput,
    organizationHash?: ActionHash
  ) => E.Effect<Record, OfferStoreError>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInput
  ) => E.Effect<Record, OfferStoreError>;
  deleteOffer: (offerHash: ActionHash) => E.Effect<void, OfferStoreError>;
  getOffersByTag: (tag: string) => E.Effect<UIOffer[], OfferStoreError>;
  hasOffers: () => E.Effect<boolean, OfferStoreError>;
  invalidateCache: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a complete UIOffer from a record
 */
const createUIOffer = (record: Record): UIOffer => {
  const decodedEntry = decode((record.entry as HolochainEntry).Present.entry) as OfferInDHT;

  return {
    ...decodedEntry,
    original_action_hash: record.signed_action.hashed.hash,
    previous_action_hash: record.signed_action.hashed.hash,
    creator: record.signed_action.hashed.content.author,
    created_at: record.signed_action.hashed.content.timestamp,
    updated_at: record.signed_action.hashed.content.timestamp
  };
};

/**
 * Maps records array to UIOffer with consistent error handling
 */
const mapRecordsToUIOffers = (recordsArray: Record[]): UIOffer[] =>
  recordsArray
    .filter(
      (record) =>
        record &&
        record.signed_action &&
        record.signed_action.hashed &&
        record.entry &&
        (record.entry as HolochainEntry).Present &&
        (record.entry as HolochainEntry).Present.entry
    )
    .map((record) => {
      try {
        return createUIOffer(record);
      } catch (error) {
        console.error('Error decoding offer record:', error);
        return null;
      }
    })
    .filter((offer): offer is UIOffer => offer !== null);

// ============================================================================
// STATE MANAGEMENT HELPERS
// ============================================================================

/**
 * Creates a higher-order function that wraps operations with loading/error state management
 */
const withLoadingState =
  <T, E>(operation: () => E.Effect<T, E>) =>
  (setLoading: (loading: boolean) => void, setError: (error: string | null) => void) =>
    pipe(
      E.sync(() => {
        setLoading(true);
        setError(null);
      }),
      E.flatMap(() => operation()),
      E.tap(() =>
        E.sync(() => {
          setLoading(false);
        })
      ),
      E.tapError((error) =>
        E.sync(() => {
          setLoading(false);
          setError(String(error));
        })
      )
    );

/**
 * Helper to synchronize cache with local state arrays
 */
const createCacheSyncHelper = (offers: UIOffer[]) => {
  const syncCacheToState = (entity: UIOffer, operation: 'add' | 'update' | 'remove') => {
    const hash = entity.original_action_hash?.toString();
    if (!hash) return;

    const existingIndex = offers.findIndex((o) => o.original_action_hash?.toString() === hash);

    switch (operation) {
      case 'add':
      case 'update':
        if (existingIndex !== -1) {
          offers[existingIndex] = entity;
        } else {
          offers.push(entity);
        }
        break;
      case 'remove':
        if (existingIndex !== -1) {
          offers.splice(existingIndex, 1);
        }
        break;
    }
  };

  return { syncCacheToState };
};

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Creates standardized event emission helpers
 */
const createEventEmitters = () => {
  const emitOfferCreated = (offer: UIOffer): void => {
    try {
      storeEventBus.emit('offer:created', { offer });
    } catch (error) {
      console.error('Failed to emit offer:created event:', error);
    }
  };

  const emitOfferUpdated = (offer: UIOffer): void => {
    try {
      storeEventBus.emit('offer:updated', { offer });
    } catch (error) {
      console.error('Failed to emit offer:updated event:', error);
    }
  };

  const emitOfferDeleted = (offerHash: ActionHash): void => {
    try {
      storeEventBus.emit('offer:deleted', { offerHash });
    } catch (error) {
      console.error('Failed to emit offer:deleted event:', error);
    }
  };

  return {
    emitOfferCreated,
    emitOfferUpdated,
    emitOfferDeleted
  };
};

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Creates a standardized function for fetching and mapping offers with state updates
 */
const createOffersFetcher = (
  serviceMethod: () => E.Effect<Record[], unknown>,
  targetArray: UIOffer[],
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.map((records) => {
        const uiOffers = mapRecordsToUIOffers(records);
        targetArray.splice(0, targetArray.length, ...uiOffers);
        return uiOffers;
      }),
      E.catchAll((error) => {
        // Handle connection errors gracefully
        const errorMessage = String(error);
        if (errorMessage.includes('Client not connected')) {
          console.warn('Holochain client not connected, returning empty offers array');
          return E.succeed([]);
        }
        return E.fail(OfferStoreError.fromError(error, errorContext));
      })
    )
  )(setLoading, setError);

/**
 * Creates a lookup function for cache misses
 */
const createCacheLookupFunction = () => {
  const lookupOffer = (key: string): E.Effect<UIOffer, CacheNotFoundError, never> =>
    pipe(
      E.gen(function* () {
        const offersService = yield* OffersServiceTag;
        const hash = decodeHashFromBase64(key);
        const record = yield* offersService.getLatestOfferRecord(hash);

        if (!record) {
          throw new Error(`Offer not found for key: ${key}`);
        }

        return createUIOffer(record);
      }),
      E.catchAll(() => E.fail(new CacheNotFoundError({ key }))),
      E.provide(OffersServiceLive),
      E.provide(HolochainClientLive)
    );

  return { lookupOffer };
};

/**
 * Processes multiple record collections and updates cache and state
 */
const processMultipleRecordCollections = (
  records: Record[],
  cache: EntityCacheService<UIOffer>,
  syncCacheToState: (entity: UIOffer, operation: 'add' | 'update' | 'remove') => void
): UIOffer[] => {
  const uiOffers = mapRecordsToUIOffers(records);

  // Update cache and sync state for all offers
  uiOffers.forEach((offer) => {
    E.runSync(cache.set(offer.original_action_hash?.toString() || '', offer));
    syncCacheToState(offer, 'add');
  });

  return uiOffers;
};

/**
 * Creates a helper for record creation operations
 */
const createRecordCreationHelper = (
  cache: EntityCacheService<UIOffer>,
  syncCacheToState: (entity: UIOffer, operation: 'add' | 'update' | 'remove') => void
) => {
  const processCreatedRecord = (record: Record) => {
    const uiOffer = createUIOffer(record);
    E.runSync(cache.set(uiOffer.original_action_hash?.toString() || '', uiOffer));
    syncCacheToState(uiOffer, 'add');
    return uiOffer;
  };

  return { processCreatedRecord };
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create an offers store as an Effect
 * @returns An Effect that creates an offers store with state and methods
 */
export const createOffersStore = (): E.Effect<
  OffersStore,
  never,
  OffersServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const offersService = yield* OffersServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================

    const offers: UIOffer[] = $state([]);
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
    // CACHE SETUP
    // ========================================================================

    const { lookupOffer } = createCacheLookupFunction();

    const cache = yield* cacheService.createEntityCache<UIOffer>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupOffer
    );

    // ========================================================================
    // HELPER FUNCTIONS INITIALIZATION
    // ========================================================================

    const { syncCacheToState } = createCacheSyncHelper(offers);
    const { emitOfferCreated, emitOfferUpdated, emitOfferDeleted } = createEventEmitters();
    const { processCreatedRecord } = createRecordCreationHelper(cache, syncCacheToState);

    // ========================================================================
    // CACHE OPERATIONS
    // ========================================================================

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    // ========================================================================
    // STORE METHODS - CREATE OPERATIONS
    // ========================================================================

    const createOffer = (
      offer: OfferInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.createOffer(offer, organizationHash),
          E.tap((record) =>
            E.sync(() => {
              const uiOffer = processCreatedRecord(record);
              emitOfferCreated(uiOffer);
            })
          ),
          E.catchAll((error) =>
            E.fail(OfferStoreError.fromError(error, ERROR_CONTEXTS.CREATE_OFFER))
          )
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE METHODS - READ OPERATIONS
    // ========================================================================

    const getAllOffers = (): E.Effect<UIOffer[], OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.getAllOffersRecords(),
          E.map((records) => processMultipleRecordCollections(records, cache, syncCacheToState)),
          E.catchAll((error) =>
            E.fail(OfferStoreError.fromError(error, ERROR_CONTEXTS.GET_ALL_OFFERS))
          )
        )
      )(setLoading, setError);

    const getOffer = (offerHash: ActionHash): E.Effect<UIOffer | null, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          cache.get(offerHash.toString()),
          E.map((cached) => cached),
          E.catchAll(() =>
            pipe(
              offersService.getLatestOfferRecord(offerHash),
              E.map((record) => {
                if (!record) return null;
                const uiOffer = createUIOffer(record);
                E.runSync(cache.set(offerHash.toString(), uiOffer));
                syncCacheToState(uiOffer, 'add');
                return uiOffer;
              })
            )
          ),
          E.catchAll((error) => E.fail(OfferStoreError.fromError(error, ERROR_CONTEXTS.GET_OFFER)))
        )
      )(setLoading, setError);

    const getLatestOffer = (
      originalActionHash: ActionHash
    ): E.Effect<UIOffer | null, OfferStoreError> => getOffer(originalActionHash); // Delegate to getOffer since they're functionally the same

    const getUserOffers = (userHash: ActionHash): E.Effect<UIOffer[], OfferStoreError> =>
      createOffersFetcher(
        () => offersService.getUserOffersRecords(userHash),
        offers,
        ERROR_CONTEXTS.GET_USER_OFFERS,
        setLoading,
        setError
      );

    const getOrganizationOffers = (
      organizationHash: ActionHash
    ): E.Effect<UIOffer[], OfferStoreError> =>
      createOffersFetcher(
        () => offersService.getOrganizationOffersRecords(organizationHash),
        offers,
        ERROR_CONTEXTS.GET_ORGANIZATION_OFFERS,
        setLoading,
        setError
      );

    const getOffersByTag = (tag: string): E.Effect<UIOffer[], OfferStoreError> =>
      createOffersFetcher(
        () => offersService.getOffersByTag(tag),
        offers,
        ERROR_CONTEXTS.GET_OFFERS_BY_TAG,
        setLoading,
        setError
      );

    const hasOffers = (): E.Effect<boolean, OfferStoreError> =>
      pipe(
        getAllOffers(),
        E.map((allOffers) => allOffers.length > 0),
        E.catchAll((error) =>
          E.fail(OfferStoreError.fromError(error, ERROR_CONTEXTS.CHECK_OFFERS_EXIST))
        )
      );

    // ========================================================================
    // STORE METHODS - UPDATE OPERATIONS
    // ========================================================================

    const updateOffer = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedOffer: OfferInput
    ): E.Effect<Record, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.updateOffer(originalActionHash, previousActionHash, updatedOffer),
          E.tap((record) =>
            E.sync(() => {
              const uiOffer = processCreatedRecord(record);
              emitOfferUpdated(uiOffer);
            })
          ),
          E.catchAll((error) =>
            E.fail(OfferStoreError.fromError(error, ERROR_CONTEXTS.UPDATE_OFFER))
          )
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE METHODS - DELETE OPERATIONS
    // ========================================================================

    const deleteOffer = (offerHash: ActionHash): E.Effect<void, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.deleteOffer(offerHash),
          E.tap(() =>
            E.sync(() => {
              // Remove from cache and state
              E.runSync(cache.delete(offerHash.toString()));
              const existingIndex = offers.findIndex(
                (o) => o.original_action_hash?.toString() === offerHash.toString()
              );
              if (existingIndex !== -1) {
                offers.splice(existingIndex, 1);
              }
              emitOfferDeleted(offerHash);
            })
          ),
          E.catchAll((error) =>
            E.fail(OfferStoreError.fromError(error, ERROR_CONTEXTS.DELETE_OFFER))
          )
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE INTERFACE IMPLEMENTATION
    // ========================================================================

    return {
      get offers() {
        return offers;
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
      getOffer,
      getLatestOffer,
      getAllOffers,
      getUserOffers,
      getOrganizationOffers,
      createOffer,
      updateOffer,
      deleteOffer,
      getOffersByTag,
      hasOffers,
      invalidateCache
    };
  });

// ============================================================================
// STORE INSTANCE MANAGEMENT
// ============================================================================

const store: OffersStore = pipe(
  createOffersStore(),
  E.provide(OffersServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive),
  E.runSync
);

export default store;
