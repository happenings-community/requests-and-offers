import type { ActionHash, Record } from '@holochain/client';
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

import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { Effect as E, pipe } from 'effect';
import { OfferError } from '../errors/offers.errors';
import { OFFER_CONTEXTS } from '../errors/error-contexts';
import { CacheNotFoundError } from '$lib/errors';
import { CACHE_EXPIRY } from '$lib/utils/constants';

// Import standardized store helpers
import {
  withLoadingState,
  createErrorHandler,
  createGenericCacheSyncHelper,
  createEntityFetcher,
  createStandardEventEmitters,
  createUIEntityFromRecord,
  type LoadingStateSetter
} from '$lib/utils/store-helpers';
import { HolochainClientServiceLive } from '../services/HolochainClientService.svelte';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = CACHE_EXPIRY.OFFERS;

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
  archiveOffer: (offerHash: ActionHash) => E.Effect<void, OfferError>;
  getMyListings: (userHash: ActionHash) => E.Effect<UIOffer[], OfferError>;
  getOffersByTag: (tag: string) => E.Effect<UIOffer[], OfferError>;
  hasOffers: () => E.Effect<boolean, OfferError>;
  invalidateCache: () => void;
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error handler for Offer operations
 */
const handleOfferError = createErrorHandler(OfferError.fromError, 'Offer operation failed');

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Create standardized event emitters for Offer entities
 */
const offerEventEmitters = createStandardEventEmitters<UIOffer>('offer');

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Create standardized entity fetcher for Offers
 */
const offerEntityFetcher = createEntityFetcher<UIOffer, OfferError>(handleOfferError);

// ============================================================================
// ENTITY CREATION HELPERS
// ============================================================================

/**
 * Creates a complete UIOffer from a record using standardized helper pattern
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
const createUIOffer = createUIEntityFromRecord<OfferInDHT, UIOffer>(
  (entry, actionHash, timestamp, additionalData) => {
    const serviceTypeHashes = (additionalData?.serviceTypeHashes as ActionHash[]) || [];
    const mediumOfExchangeHashes = (additionalData?.mediumOfExchangeHashes as ActionHash[]) || [];
    const creator = additionalData?.creator as ActionHash; // Only ActionHash, no fallback
    const authorPubKey = additionalData?.authorPubKey;
    const organization = additionalData?.organization as ActionHash;

    return {
      ...entry,
      original_action_hash: actionHash,
      previous_action_hash: actionHash,
      creator,
      organization,
      created_at: timestamp,
      updated_at: timestamp,
      service_type_hashes: serviceTypeHashes,
      medium_of_exchange_hashes: mediumOfExchangeHashes,
      // Temporary field for permission checking fallback
      authorPubKey
    };
  }
);

/**
 * Creates enhanced UIOffer from record with additional processing
 * This handles service types and medium of exchange relationships
 */
const createEnhancedUIOffer = (
  record: Record,
  offersService: OffersService
): E.Effect<UIOffer, OfferError> => {
  const offerHash = record.signed_action.hashed.hash;
  const authorPubKey = record.signed_action.hashed.content.author;

  return pipe(
    E.all({
      userProfile: pipe(
        usersStore.getUserByAgentPubKey(authorPubKey),
        E.catchAll(() => E.succeed(null))
      ),
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
    E.flatMap(({ userProfile, serviceTypeHashes, mediumOfExchangeHashes }) => {
      const additionalData = {
        serviceTypeHashes,
        mediumOfExchangeHashes,
        creator: userProfile?.original_action_hash, // Only set if user profile exists
        authorPubKey, // Keep AgentPubKey separately for fallback comparison
        organization: undefined // No organization support yet in this simplified flow
      };

      const entity = createUIOffer(record, additionalData);
      return entity
        ? E.succeed(entity)
        : E.fail(
            OfferError.fromError(
              new Error('Failed to create UI entity'),
              OFFER_CONTEXTS.DECODE_OFFERS
            )
          );
    }),
    E.mapError((error) => OfferError.fromError(error, OFFER_CONTEXTS.DECODE_OFFERS))
  );
};

/**
 * Converts UI OfferInput to compatible format for service calls
 * This resolves the type bridge issue between UI types (Uint8Array) and service types (string)
 */
const convertOfferInputForService = (input: OfferInput): OfferInput => ({
  ...input,
  service_type_hashes: input.service_type_hashes.map((hash) =>
    typeof hash === 'string' ? hash : actionHashToSchemaType(hash)
  ),
  medium_of_exchange_hashes: input.medium_of_exchange_hashes.map((hash) =>
    typeof hash === 'string' ? hash : actionHashToSchemaType(hash)
  )
});

/**
 * Cache lookup function for offers
 */
const offerCacheLookup = (key: string): E.Effect<UIOffer, CacheNotFoundError, never> => {
  return E.fail(new CacheNotFoundError({ key }));
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * OFFERS STORE - USING STANDARDIZED STORE HELPER PATTERNS
 *
 * This store demonstrates the integration of standardized helper functions following the Service Types template:
 *
 * 1. createUIEntityFromRecord - Entity creation from Holochain records
 * 2. createGenericCacheSyncHelper - Cache-to-state synchronization
 * 3. createStandardEventEmitters - Type-safe event emission
 * 4. withLoadingState - Consistent loading/error state management
 * 5. createEntityCreationHelper - Standardized entity creation with validation
 * 6. createErrorHandler - Domain-specific error handling
 * 7. createEntityFetcher - Data fetching with loading state and error handling
 *
 * This implementation focuses on consistent patterns for CRUD operations with
 * proper error handling, caching, and event emission.
 *
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

    // 2. CACHE SYNCHRONIZATION - Using createGenericCacheSyncHelper
    const { syncCacheToState } = createGenericCacheSyncHelper({
      all: offers
    });

    // 3. EVENT EMITTERS - Using createStandardEventEmitters
    const eventEmitters = offerEventEmitters;

    // 4. CACHE MANAGEMENT - Using standardized cache lookup pattern
    const cache = yield* cacheService.createEntityCache<UIOffer>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      offerCacheLookup
    );

    // 5. ENTITY CREATION - Using createEntityCreationHelper

    // ===== STATE MANAGEMENT FUNCTIONS =====

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      offers.length = 0;
      setters.setError(null);
    };

    // ===== CORE CRUD OPERATIONS =====

    const createOffer = (
      offer: OfferInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, OfferError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(convertOfferInputForService(offer)),
          E.flatMap((serviceOffer) => offersService.createOffer(serviceOffer, organizationHash)),
          E.tap((record) => {
            const authorPubKey = record.signed_action.hashed.content.author;
            const entity = createUIOffer(record, { authorPubKey });
            if (entity) {
              E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) => E.fail(OfferError.fromError(error, OFFER_CONTEXTS.CREATE_OFFER)))
        )
      )(setters);

    const getAllOffers = (): E.Effect<UIOffer[], OfferError> =>
      offerEntityFetcher(
        () =>
          pipe(
            offersService.getAllOffersRecords(),
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
                  .map((record) => createEnhancedUIOffer(record, offersService))
              )
            ),
            E.tap((uiOffers) =>
              E.sync(() => {
                uiOffers.forEach((uiOffer) => {
                  const offerHash = uiOffer.original_action_hash;
                  if (offerHash) {
                    E.runSync(cache.set(offerHash.toString(), uiOffer));
                    syncCacheToState(uiOffer, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) => {
              const errorMessage = String(error);
              if (errorMessage.includes('Client not connected')) {
                console.warn('Holochain client not connected, returning empty offers array');
                return E.succeed([]);
              }
              return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_ALL_OFFERS));
            })
          ),
        {
          targetArray: offers,
          errorContext: OFFER_CONTEXTS.GET_ALL_OFFERS,
          setters
        }
      );

    const getOffer = (offerHash: ActionHash): E.Effect<UIOffer | null, OfferError> =>
      withLoadingState(() =>
        pipe(
          cache.get(offerHash.toString()),
          E.catchTag('CacheNotFoundError', () => {
            // Cache miss is expected on page refresh, continue to fetch from service
            return E.succeed(null);
          }),
          E.flatMap((cachedOffer) => {
            if (cachedOffer) {
              return E.succeed(cachedOffer);
            }

            return pipe(
              offersService.getLatestOfferRecord(offerHash),
              E.flatMap((record) => {
                if (!record) return E.succeed(null);

                // Use enhanced creation to fetch related data (service types, medium of exchange)
                return pipe(
                  createEnhancedUIOffer(record, offersService),
                  E.map((offer) => {
                    if (offer) {
                      E.runSync(cache.set(offerHash.toString(), offer));
                      syncCacheToState(offer, 'add');
                    }
                    return offer;
                  })
                );
              }),
              E.catchAll((error) => {
                const errorMessage = String(error);
                if (errorMessage.includes('Client not connected')) {
                  console.warn('Holochain client not connected, returning null');
                  return E.succeed(null);
                }
                // Preserve original error context for debugging
                console.error('Failed to fetch offer from service:', error);
                return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_OFFER));
              })
            );
          }),
          E.catchAll((error) => {
            // Log the error for debugging while still providing a user-friendly message
            console.error('Unexpected error in getOffer:', error);
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_OFFER));
          })
        )
      )(setters);

    const updateOffer = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedOffer: OfferInput
    ): E.Effect<Record, OfferError> =>
      withLoadingState(() =>
        pipe(
          offersService.updateOffer(originalActionHash, previousActionHash, updatedOffer),
          E.flatMap((newActionHash) =>
            pipe(
              offersService.getLatestOfferRecord(newActionHash as unknown as ActionHash),
              E.map((record) => {
                if (!record) return { record: null, updatedOffer: null };

                const authorPubKey = record.signed_action.hashed.content.author;
                const baseEntity = createUIOffer(record, { authorPubKey });
                if (!baseEntity) return { record: null, updatedOffer: null };

                const updatedUIOffer: UIOffer = {
                  ...baseEntity,
                  original_action_hash: originalActionHash,
                  previous_action_hash: newActionHash as unknown as ActionHash,
                  updated_at: Date.now()
                };

                E.runSync(cache.set(originalActionHash.toString(), updatedUIOffer));
                syncCacheToState(updatedUIOffer, 'update');

                return { record, updatedOffer: updatedUIOffer };
              })
            )
          ),
          E.tap(({ updatedOffer }) =>
            updatedOffer ? E.sync(() => eventEmitters.emitUpdated(updatedOffer)) : E.asVoid
          ),
          E.map(({ record }) => record!),
          E.catchAll((error) => E.fail(OfferError.fromError(error, OFFER_CONTEXTS.UPDATE_OFFER)))
        )
      )(setters);

    const deleteOffer = (offerHash: ActionHash): E.Effect<void, OfferError> =>
      withLoadingState(() =>
        pipe(
          offersService.deleteOffer(offerHash),
          E.tap(() => {
            E.runSync(cache.invalidate(offerHash.toString()));
            const existing = offers.find(
              (o) =>
                o.original_action_hash && o.original_action_hash.toString() === offerHash.toString()
            );
            if (existing) {
              syncCacheToState(existing, 'remove');
            }
          }),
          E.tap(() => E.sync(() => eventEmitters.emitDeleted(offerHash))),
          E.asVoid,
          E.catchAll((error) => E.fail(OfferError.fromError(error, OFFER_CONTEXTS.DELETE_OFFER)))
        )
      )(setters);

    const archiveOffer = (offerHash: ActionHash): E.Effect<void, OfferError> =>
      withLoadingState(() =>
        pipe(
          offersService.archiveOffer(offerHash),
          E.tap(() => {
            E.runSync(cache.invalidate(offerHash.toString()));
            const existing = offers.find(
              (o) =>
                o.original_action_hash && o.original_action_hash.toString() === offerHash.toString()
            );
            if (existing) {
              syncCacheToState(existing, 'remove');
            }
          }),
          E.tap(() => E.sync(() => eventEmitters.emitDeleted(offerHash))),
          E.asVoid,
          E.catchAll((error) => E.fail(OfferError.fromError(error, OFFER_CONTEXTS.ARCHIVE_OFFER)))
        )
      )(setters);

    // ===== SPECIALIZED QUERY OPERATIONS =====

    const getUserOffers = (userHash: ActionHash): E.Effect<UIOffer[], OfferError> =>
      offerEntityFetcher(
        () =>
          pipe(
            offersService.getUserOffersRecords(userHash),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIOffer(record, offersService)))
            ),
            E.tap((uiOffers) =>
              E.sync(() => {
                uiOffers.forEach((uiOffer) => {
                  const offerHash = uiOffer.original_action_hash;
                  if (offerHash) {
                    E.runSync(cache.set(offerHash.toString(), uiOffer));
                    syncCacheToState(uiOffer, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_USER_OFFERS))
            )
          ),
        {
          targetArray: offers,
          errorContext: OFFER_CONTEXTS.GET_USER_OFFERS,
          setters
        }
      );

    const getOrganizationOffers = (organizationHash: ActionHash): E.Effect<UIOffer[], OfferError> =>
      offerEntityFetcher(
        () =>
          pipe(
            offersService.getOrganizationOffersRecords(organizationHash),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIOffer(record, offersService)))
            ),
            E.tap((uiOffers) =>
              E.sync(() => {
                uiOffers.forEach((uiOffer) => {
                  const offerHash = uiOffer.original_action_hash;
                  if (offerHash) {
                    E.runSync(cache.set(offerHash.toString(), uiOffer));
                    syncCacheToState(uiOffer, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_ORGANIZATION_OFFERS))
            )
          ),
        {
          targetArray: offers,
          errorContext: OFFER_CONTEXTS.GET_ORGANIZATION_OFFERS,
          setters
        }
      );

    const getMyListings = (userHash: ActionHash): E.Effect<UIOffer[], OfferError> =>
      offerEntityFetcher(
        () =>
          pipe(
            offersService.getMyListings(userHash),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIOffer(record, offersService)))
            ),
            E.tap((uiOffers) =>
              E.sync(() => {
                uiOffers.forEach((uiOffer) => {
                  const offerHash = uiOffer.original_action_hash;
                  if (offerHash) {
                    E.runSync(cache.set(offerHash.toString(), uiOffer));
                    syncCacheToState(uiOffer, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_MY_LISTINGS))
            )
          ),
        {
          targetArray: offers,
          errorContext: OFFER_CONTEXTS.GET_MY_LISTINGS,
          setters
        }
      );

    const getLatestOffer = (originalActionHash: ActionHash): E.Effect<UIOffer | null, OfferError> =>
      withLoadingState(() =>
        pipe(
          offersService.getLatestOfferRecord(originalActionHash),
          E.map((record) => {
            if (!record) return null;
            const authorPubKey = record.signed_action.hashed.content.author;
            return createUIOffer(record, { authorPubKey });
          }),
          E.catchAll((error) =>
            E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_LATEST_OFFER))
          )
        )
      )(setters);

    const getOffersByTag = (tag: string): E.Effect<UIOffer[], OfferError> =>
      offerEntityFetcher(
        () =>
          pipe(
            offersService.getOffersByTag(tag),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIOffer(record, offersService)))
            ),
            E.tap((uiOffers) =>
              E.sync(() => {
                uiOffers.forEach((uiOffer) => {
                  const offerHash = uiOffer.original_action_hash;
                  if (offerHash) {
                    E.runSync(cache.set(offerHash.toString(), uiOffer));
                    syncCacheToState(uiOffer, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_OFFERS_BY_TAG))
            )
          ),
        {
          targetArray: offers,
          errorContext: OFFER_CONTEXTS.GET_OFFERS_BY_TAG,
          setters
        }
      );

    const hasOffers = (): E.Effect<boolean, OfferError> =>
      pipe(
        getAllOffers(),
        E.map((offers) => offers.length > 0),
        E.catchAll((error) => {
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected, assuming no offers exist');
            return E.succeed(false);
          }
          return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.CHECK_OFFERS_EXIST));
        })
      );

    // ===== STORE INTERFACE =====

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
      getMyListings,
      createOffer,
      updateOffer,
      deleteOffer,
      archiveOffer,
      getOffersByTag,
      hasOffers,
      invalidateCache
    };
  });

// ============================================================================
// STORE INSTANCE MANAGEMENT
// ============================================================================

const offersStore: OffersStore = pipe(
  createOffersStore(),
  E.provide(OffersServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runSync
);

export default offersStore;
