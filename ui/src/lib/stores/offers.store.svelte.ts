/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionHash, Record } from '@holochain/client';
import { decodeHashFromBase64 } from '@holochain/client';

import {
  OffersServiceTag,
  OffersServiceLive,
  type OffersService
} from '$lib/services/zomes/offers.service';
import type { UIOffer } from '$lib/types/ui';
import type { OfferInDHT, OfferInput } from '$lib/types/holochain';
import { actionHashToSchemaType } from '$lib/utils/type-bridges';
import usersStore from '$lib/stores/users.store.svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';

import { decode } from '@msgpack/msgpack';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { OfferError } from '../errors/offers.errors';
import { OFFER_CONTEXTS } from '../errors/error-contexts';
import { CacheNotFoundError } from '$lib/errors';
import { encodeHashToBase64 } from '@holochain/client';
import { decodeRecords } from '../utils';

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

  getOffer: (offerHash: ActionHash) => E.Effect<UIOffer | null, OfferError>;
  getLatestOffer: (originalActionHash: ActionHash) => E.Effect<UIOffer | null, OfferError>;
  getAllOffers: () => E.Effect<UIOffer[], OfferError>;
  getUserOffers: (userHash: ActionHash) => E.Effect<UIOffer[], OfferError>;
  getOrganizationOffers: (organizationHash: ActionHash) => E.Effect<UIOffer[], OfferError>;
  createOffer: (offer: OfferInput, organizationHash?: ActionHash) => E.Effect<Record, OfferError>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInput
  ) => E.Effect<Record, OfferError>;
  deleteOffer: (offerHash: ActionHash) => E.Effect<void, OfferError>;
  getOffersByTag: (tag: string) => E.Effect<UIOffer[], OfferError>;
  hasOffers: () => E.Effect<boolean, OfferError>;
  invalidateCache: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a complete UIOffer from a record with proper type conversion
 */
const createUIOffer = (
  record: Record,
  serviceTypeHashes: ActionHash[] = [],
  mediumOfExchangeHashes: ActionHash[] = [],
  creator?: ActionHash,
  organization?: ActionHash
): UIOffer => {
  const decodedEntry = decode((record.entry as HolochainEntry).Present.entry) as OfferInDHT;

  return {
    ...decodedEntry,
    original_action_hash: record.signed_action.hashed.hash,
    previous_action_hash: record.signed_action.hashed.hash,
    creator: creator || record.signed_action.hashed.content.author,
    organization,
    created_at: record.signed_action.hashed.content.timestamp,
    updated_at: record.signed_action.hashed.content.timestamp,
    service_type_hashes: serviceTypeHashes,
    medium_of_exchange_hashes: mediumOfExchangeHashes
  };
};

/**
 * Processes a Holochain record to create a UIOffer.
 * Fetches the creator, organization ActionHashes, service types, and medium of exchange hashes.
 * @param record - The Holochain record to process
 * @param offersService - The offers service to use
 * @returns The processed UIOffer
 */
const processRecord = (
  record: Record,
  offersService: OffersService
): E.Effect<UIOffer, OfferError> => {
  const offerHash = record.signed_action.hashed.hash;
  const authorPubKey = record.signed_action.hashed.content.author;

  return pipe(
    E.all({
      userProfile: usersStore.getUserByAgentPubKey(authorPubKey),
      serviceTypeHashes: pipe(
        serviceTypesStore.getServiceTypesForEntity({
          original_action_hash: actionHashToSchemaType(offerHash),
          entity: 'offer'
        }),
        E.orElse(() => E.succeed([] as ActionHash[]))
      ),
      mediumOfExchangeHashes: pipe(
        offersService.getMediumsOfExchangeForOffer(offerHash),
        E.orElse(() => E.succeed([] as ActionHash[]))
      )
    }),
    E.flatMap((offer) =>
      usersStore.getUserByAgentPubKey(authorPubKey).pipe(
        E.map((user) => ({
          ...offer,
          userProfile: user ?? null
        }))
      )
    ),
    E.map(({ userProfile, serviceTypeHashes, mediumOfExchangeHashes }) => {
      return createUIOffer(
        record,
        serviceTypeHashes,
        mediumOfExchangeHashes,
        userProfile?.original_action_hash || authorPubKey,
        undefined // No organization support yet in this simplified flow
      );
    }),
    E.mapError((error) => OfferError.fromError(error, ERROR_CONTEXTS.DECODE_OFFERS))
  );
};

/**
 * Maps records array to UIOffer with consistent error handling
 * TODO: Service types will be empty initially and should be fetched separately
 * @param recordsArray - The array of records to map to UIOffers
 * @param cache - The cache service to use
 * @param syncCacheToState - The function to sync the cache to the state
 * @param offersService - The offers service to use
 * @returns The array of UIOffers
 */
const mapRecordsToUIOffers = (
  recordsArray: E.Effect<Record[], OfferError>,
  cache: EntityCacheService<UIOffer>,
  syncCacheToState: (entity: UIOffer, operation: 'add' | 'update' | 'remove') => void,
  offersService: OffersService
): E.Effect<UIOffer[], OfferError> =>
  pipe(
    recordsArray,
    E.flatMap((records) =>
      E.all(
        records
          .filter(
            (record) =>
              record &&
              record.signed_action &&
              record.signed_action.hashed &&
              record.entry &&
              (record.entry as HolochainEntry).Present &&
              (record.entry as HolochainEntry).Present.entry
          )
          .map((record) => processRecord(record, offersService))
      )
    ),
    E.map((uiOffers) => {
      // Update cache and sync state for all offers
      uiOffers.forEach((offer) => {
        E.runSync(cache.set(offer.original_action_hash?.toString() || '', offer));
        syncCacheToState(offer, 'add');
      });
      return uiOffers;
    })
  );

// ============================================================================
// STATE MANAGEMENT HELPERS
// ============================================================================

/**
 * Creates a higher-order function that wraps operations with loading/error state management
 * @param operation - The operation to wrap
 * @param setLoading - The function to set the loading state
 * @param setError - The function to set the error state
 * @returns The wrapped operation
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
 * @param offers - The array of offers to synchronize
 * @returns The cache sync helper
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
 * @returns The event emitters
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

/**
 * Creates a lookup function for cache misses
 * @returns The cache lookup function
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

        return yield* processRecord(record, offersService);
      }),
      E.catchAll(() => E.fail(new CacheNotFoundError({ key }))),
      E.provide(OffersServiceLive),
      E.provide(HolochainClientLive)
    );

  return { lookupOffer };
};

/**
 * Creates a higher-order function that wraps operations with loading/error state management
 * @param serviceMethod - The method to fetch the records
 * @param targetArray - The array to store the offers
 * @param errorContext - The error context
 * @param setLoading - The function to set the loading state
 * @param setError - The function to set the error state
 * @param cache - The cache service
 * @param syncCacheToState - The function to sync the cache to the state
 * @param offersService - The offers service
 * @returns The offers fetcher
 */
const createOffersFetcher = (
  serviceMethod: () => E.Effect<Record[], OfferError>,
  targetArray: UIOffer[],
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  cache: EntityCacheService<UIOffer>,
  syncCacheToState: (entity: UIOffer, operation: 'add' | 'update' | 'remove') => void,
  offersService: OffersService
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.flatMap((records) =>
        mapRecordsToUIOffers(E.succeed(records), cache, syncCacheToState, offersService)
      ),
      E.tap((uiOffers) =>
        E.sync(() => {
          targetArray.splice(0, targetArray.length, ...uiOffers);
        })
      ),
      E.catchAll((error) => {
        // Handle connection errors gracefully
        const errorMessage = String(error);
        if (errorMessage.includes('Client not connected')) {
          console.warn(`Holochain client not connected, returning empty offers array`);
          return E.succeed([]);
        }
        return E.fail(OfferError.fromError(error, errorContext));
      })
    )
  )(setLoading, setError);

/**
 * Creates a helper for record creation operations
 * @param cache - The cache service
 * @param syncCacheToState - The function to sync the cache to the state
 * @param offersService - The offers service
 * @returns The record creation helper
 */
const createRecordCreationHelper = (
  cache: EntityCacheService<UIOffer>,
  syncCacheToState: (entity: UIOffer, operation: 'add' | 'update' | 'remove') => void,
  offersService: OffersService
) => {
  const processCreatedRecord = (record: Record): E.Effect<UIOffer, OfferError> =>
    pipe(
      processRecord(record, offersService),
      E.tap((uiOffer) =>
        E.sync(() => {
          E.runSync(cache.set(uiOffer.original_action_hash?.toString() || '', uiOffer));
          syncCacheToState(uiOffer, 'add');
        })
      )
    );

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
    const { processCreatedRecord } = createRecordCreationHelper(
      cache,
      syncCacheToState,
      offersService
    );

    // ========================================================================
    // CACHE OPERATIONS
    // ========================================================================

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    // ========================================================================
    // STORE METHODS
    // ========================================================================

    /**
     * Creates a new offer
     * @param offer - The offer to create
     * @param organizationHash - The organization hash to create the offer for
     * @returns The created offer
     */
    const createOffer = (
      offer: OfferInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, OfferError> =>
      withLoadingState(() =>
        pipe(
          offersService.createOffer(offer, organizationHash),
          E.flatMap((record) =>
            pipe(
              processCreatedRecord(record),
              E.tap((uiOffer) => E.sync(() => emitOfferCreated(uiOffer))),
              E.map(() => record) // Return the original record for the Effect chain
            )
          ),
          E.catchAll((error) => E.fail(OfferError.fromError(error, ERROR_CONTEXTS.CREATE_OFFER)))
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE METHODS - READ OPERATIONS
    // ========================================================================

    /**
     * Gets all offers
     * @returns All offers
     */
    const getAllOffers = (): E.Effect<UIOffer[], OfferError> => {
      const errorContext = ERROR_CONTEXTS.GET_ALL_OFFERS;
      return createOffersFetcher(
        () =>
          pipe(
            offersService.getAllOffersRecords(),
            E.mapError((error) => OfferError.fromError(error, errorContext))
          ),
        offers,
        errorContext,
        setLoading,
        setError,
        cache,
        syncCacheToState,
        offersService
      );
    };

    /**
     * Gets an offer by its hash
     * @param offerHash - The hash of the offer to get
     * @returns The offer
     */
    const getOffer = (offerHash: ActionHash): E.Effect<UIOffer | null, OfferError> =>
      withLoadingState(() =>
        pipe(
          cache.get(offerHash.toString()),
          E.map((cached) => cached),
          E.catchAll(() =>
            pipe(
              offersService.getLatestOfferRecord(offerHash),
              E.flatMap((record) => {
                if (!record) return E.succeed(null);
                return pipe(
                  processRecord(record, offersService),
                  E.tap((uiOffer) =>
                    E.sync(() => {
                      E.runSync(cache.set(offerHash.toString(), uiOffer));
                      syncCacheToState(uiOffer, 'add');
                    })
                  )
                );
              })
            )
          ),
          E.catchAll((error) => E.fail(OfferError.fromError(error, ERROR_CONTEXTS.GET_OFFER)))
        )
      )(setLoading, setError);

    /**
     * Gets the latest offer by its original action hash
     * @param originalActionHash - The original action hash of the offer
     * @returns The latest offer
     */
    const getLatestOffer = (originalActionHash: ActionHash): E.Effect<UIOffer | null, OfferError> =>
      getOffer(originalActionHash); // Delegate to getOffer since they're functionally the same

    /**
     * Gets all offers for a user
     * @param userHash - The hash of the user to get offers for
     * @returns All offers for the user
     */
    const getUserOffers = (userHash: ActionHash): E.Effect<UIOffer[], OfferError> =>
      createOffersFetcher(
        () => offersService.getUserOffersRecords(userHash),
        offers,
        ERROR_CONTEXTS.GET_USER_OFFERS,
        setLoading,
        setError,
        cache,
        syncCacheToState,
        offersService
      );

    /**
     * Gets all offers for an organization
     * @param organizationHash - The hash of the organization to get offers for
     * @returns All offers for the organization
     */
    const getOrganizationOffers = (organizationHash: ActionHash): E.Effect<UIOffer[], OfferError> =>
      createOffersFetcher(
        () => offersService.getOrganizationOffersRecords(organizationHash),
        offers,
        ERROR_CONTEXTS.GET_ORGANIZATION_OFFERS,
        setLoading,
        setError,
        cache,
        syncCacheToState,
        offersService
      );

    /**
     * Gets all offers by a tag
     * @param tag - The tag to get offers for
     * @returns All offers with the tag
     */
    const getOffersByTag = (tag: string): E.Effect<UIOffer[], OfferError> =>
      createOffersFetcher(
        () => offersService.getOffersByTag(tag),
        offers,
        ERROR_CONTEXTS.GET_OFFERS_BY_TAG,
        setLoading,
        setError,
        cache,
        syncCacheToState,
        offersService
      );

    /**
     * Checks if there are any offers
     * @returns True if there are offers, false otherwise
     */
    const hasOffers = (): E.Effect<boolean, OfferError> =>
      pipe(
        getAllOffers(),
        E.map((allOffers) => allOffers.length > 0),
        E.catchAll((error) =>
          E.fail(OfferError.fromError(error, ERROR_CONTEXTS.CHECK_OFFERS_EXIST))
        )
      );

    // ========================================================================
    // STORE METHODS - UPDATE OPERATIONS
    // ========================================================================

    /**
     * Updates an offer
     * @param originalActionHash - The original action hash of the offer
     * @param previousActionHash - The previous action hash of the offer
     * @param updatedOffer - The updated offer
     * @returns The updated offer
     */
    const updateOffer = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedOffer: OfferInput
    ): E.Effect<Record, OfferError> =>
      withLoadingState(() =>
        pipe(
          offersService.updateOffer(originalActionHash, previousActionHash, updatedOffer),
          E.flatMap((record) =>
            pipe(
              processCreatedRecord(record),
              E.tap((uiOffer) => E.sync(() => emitOfferUpdated(uiOffer))),
              E.map(() => record) // Return the original record for the Effect chain
            )
          ),
          E.catchAll((error) => E.fail(OfferError.fromError(error, ERROR_CONTEXTS.UPDATE_OFFER)))
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE METHODS - DELETE OPERATIONS
    // ========================================================================

    /**
     * Deletes an offer
     * @param offerHash - The hash of the offer to delete
     * @returns Void Effect
     */
    const deleteOffer = (offerHash: ActionHash): E.Effect<void, OfferError> =>
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
          E.catchAll((error) => E.fail(OfferError.fromError(error, ERROR_CONTEXTS.DELETE_OFFER)))
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
