import type { ActionHash, Record } from '@holochain/client';
import type { UIOffer } from '$lib/types/ui';
import type { OfferInDHT, OfferInput } from '$lib/types/holochain';
import { OffersServiceTag, OffersServiceLive } from '$lib/services/zomes/offers.service';
import { decodeRecords } from '$lib/utils';
import usersStore from '$lib/stores/users.store.svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { actionHashToSchemaType } from '../utils/type-bridges';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { storeEventBus } from '$lib/stores/storeEvents';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import { Data, Effect as E, pipe } from 'effect';
import { HolochainClientServiceLive } from '$lib/services/HolochainClientService.svelte';
import { CacheNotFoundError } from '$lib/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Error context constants
const ERROR_CONTEXTS = {
  CREATE_REQUEST: 'Failed to create offer',
  GET_ALL_REQUESTS: 'Failed to get all offers',
  GET_USER_REQUESTS: 'Failed to get user offers',
  GET_ORGANIZATION_REQUESTS: 'Failed to get organization offers',
  GET_LATEST_REQUEST: 'Failed to get latest offer',
  UPDATE_REQUEST: 'Failed to update offer',
  DELETE_REQUEST: 'Failed to delete offer',
  EMIT_REQUEST_CREATED: 'Failed to emit offer created event',
  EMIT_REQUEST_DELETED: 'Failed to emit offer deleted event'
} as const;

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class OfferStoreError extends Data.TaggedError('OfferStoreError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): OfferStoreError {
    if (error instanceof Error) {
      return new OfferStoreError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new OfferStoreError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Parses ActionHash from cache key string format
 */
const parseHashFromCacheKey = (key: string): ActionHash => {
  try {
    const numbers = key.split(',').map((num) => parseInt(num.trim(), 10));
    return new Uint8Array(numbers);
  } catch (parseError) {
    throw new Error(`Invalid hash format: ${key}`);
  }
};

/**
 * Determines the organization hash for a offer based on organization offer mappings
 */
const determineOrganizationForOffer = (
  offerHash: ActionHash,
  organizationOfferMappings: Map<string, ActionHash>
): ActionHash | undefined => organizationOfferMappings.get(offerHash.toString());

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Fetches service types for a offer and handles errors gracefully
 */
const fetchServiceTypes = (
  offerHash: ActionHash,
  context: string = 'offer'
): E.Effect<ActionHash[]> =>
  pipe(
    serviceTypesStore.getServiceTypesForEntity({
      original_action_hash: actionHashToSchemaType(offerHash),
      entity: 'offer'
    }),
    E.catchAll((error) => {
      console.warn(`Failed to get service type hashes during ${context}:`, error);
      return E.succeed([]);
    })
  ) as E.Effect<ActionHash[]>;

/**
 * Fetches user profile and handles errors gracefully
 */
const fetchUserProfile = (agentPubKey: ActionHash, context: string = 'mapping') =>
  E.tryPromise({
    try: () => usersStore.getUserByAgentPubKey(agentPubKey),
    catch: (error) => {
      console.warn(`Failed to get user profile during ${context}:`, error);
      return null;
    }
  }).pipe(E.orElse(() => E.succeed(null)));

/**
 * Fetches accepted organizations and handles errors gracefully
 */
const fetchAcceptedOrganizations = () =>
  E.tryPromise({
    try: () => organizationsStore.getAcceptedOrganizations(),
    catch: (error) => {
      console.warn('Failed to get accepted organizations during offer mapping:', error);
      return [];
    }
  });

// ============================================================================
// REQUEST CREATION HELPERS
// ============================================================================

/**
 * Creates a complete UIOffer from a record and additional data
 */
const createUIOffer = (
  record: Record,
  offer: OfferInDHT,
  serviceTypeHashes: ActionHash[],
  creator?: ActionHash,
  organization?: ActionHash
): UIOffer => ({
  ...offer,
  original_action_hash: record.signed_action.hashed.hash,
  previous_action_hash: record.signed_action.hashed.hash,
  creator: creator || record.signed_action.hashed.content.author,
  organization,
  created_at: record.signed_action.hashed.content.timestamp,
  updated_at: record.signed_action.hashed.content.timestamp,
  service_type_hashes: serviceTypeHashes
});

/**
 * Processes a single offer record into a UIOffer with all dependencies
 */
const processOfferRecord = (
  record: Record,
  cache: EntityCacheService<UIOffer>,
  syncCacheToState: (entity: UIOffer, operation: 'add' | 'update' | 'remove') => void,
  organization?: ActionHash,
  context: string = 'processing'
): E.Effect<UIOffer, never> => {
  const offerHash = record.signed_action.hashed.hash;
  const offer = decodeRecords<OfferInDHT>([record])[0];
  const authorPubKey = record.signed_action.hashed.content.author;

  return pipe(
    E.all([fetchUserProfile(authorPubKey, context), fetchServiceTypes(offerHash, context)]),
    E.map(([userProfile, serviceTypeHashes]) => {
      const uiOffer = createUIOffer(
        record,
        offer,
        serviceTypeHashes,
        userProfile?.original_action_hash || authorPubKey,
        organization
      );

      // Cache and sync
      E.runSync(cache.set(offerHash.toString(), uiOffer));
      syncCacheToState(uiOffer, 'add');

      return uiOffer;
    })
  );
};

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
      E.ensuring(E.sync(() => setLoading(false)))
    );

/**
 * Creates an error handler that wraps errors in OfferStoreError
 */
const createErrorHandler = (context: string) => (error: unknown) =>
  E.fail(OfferStoreError.fromError(error, context));

// ============================================================================
// ORGANIZATION REQUEST MAPPING
// ============================================================================

/**
 * Creates a mapping of offer hashes to their organization hashes
 */
const createOrganizationOfferMapping = (
  organizations: Array<{ original_action_hash?: ActionHash }>,
  offersService: {
    getOrganizationOffersRecords: (hash: ActionHash) => E.Effect<Record[], unknown>;
  }
): E.Effect<Map<string, ActionHash>, never> =>
  pipe(
    E.all(
      organizations.map((org) =>
        org.original_action_hash
          ? pipe(
              offersService.getOrganizationOffersRecords(org.original_action_hash),
              E.map((orgRecords: Record[]) => ({ org, records: orgRecords })),
              E.catchAll(() => E.succeed({ org, records: [] as Record[] }))
            )
          : E.succeed({ org, records: [] as Record[] })
      )
    ),
    E.map((orgOffers) => {
      const offerToOrgMap = new Map<string, ActionHash>();
      for (const { org, records } of orgOffers) {
        for (const record of records) {
          if (
            record &&
            record.signed_action &&
            record.signed_action.hashed &&
            org.original_action_hash
          ) {
            offerToOrgMap.set(
              record.signed_action.hashed.hash.toString(),
              org.original_action_hash
            );
          }
        }
      }
      return offerToOrgMap;
    }),
    E.catchAll(() => E.succeed(new Map<string, ActionHash>()))
  );

// ============================================================================
// STORE TYPE DEFINITION
// ============================================================================

export type OffersStore = {
  readonly offers: UIOffer[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIOffer>;
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
  invalidateCache: () => void;
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create a offers store as an Effect
 * @returns An Effect that creates a offers store with state and methods
 */
export const createOffersStore = (): E.Effect<
  OffersStore,
  never,
  OffersServiceTag | CacheServiceTag
> => {
  return E.gen(function* () {
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

    /**
     * Creates a lookup function for cache misses
     */
    const lookupOffer = (key: string): E.Effect<UIOffer, CacheNotFoundError> =>
      pipe(
        E.tryPromise({
          try: async () => {
            const hash = parseHashFromCacheKey(key);
            const record = await E.runPromise(offersService.getLatestOfferRecord(hash));

            if (!record) {
              throw new Error(`Offer not found for key: ${key}`);
            }

            const offer = decodeRecords<OfferInDHT>([record])[0];
            const authorPubKey = record.signed_action.hashed.content.author;
            const userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
            const serviceTypeHashes = await E.runPromise(fetchServiceTypes(hash, 'cache lookup'));

            return createUIOffer(
              record,
              offer,
              serviceTypeHashes,
              userProfile?.original_action_hash || authorPubKey
            );
          },
          catch: () => new CacheNotFoundError({ key })
        }),
        E.mapError(() => new CacheNotFoundError({ key }))
      );

    const cache = yield* cacheService.createEntityCache<UIOffer>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupOffer
    );

    // ========================================================================
    // STATE SYNCHRONIZATION
    // ========================================================================

    /**
     * Helper function to sync cache with local state
     */
    const syncCacheToState = (entity: UIOffer, operation: 'add' | 'update' | 'remove') => {
      const index = offers.findIndex(
        (r) => r.original_action_hash?.toString() === entity.original_action_hash?.toString()
      );

      switch (operation) {
        case 'add':
        case 'update':
          if (index !== -1) {
            offers[index] = entity;
          } else {
            offers.push(entity);
          }
          break;
        case 'remove':
          if (index !== -1) {
            offers.splice(index, 1);
          }
          break;
      }
    };

    /**
     * Removes a offer from state by hash
     */
    const removeOfferFromState = (offerHash: ActionHash) => {
      const index = offers.findIndex(
        (offer) => offer.original_action_hash?.toString() === offerHash.toString()
      );
      if (index !== -1) {
        offers.splice(index, 1);
      }
    };

    /**
     * Clears all offers from state
     */
    const clearOffersState = () => {
      offers.length = 0;
    };

    // ========================================================================
    // EVENT EMISSION HELPERS
    // ========================================================================

    /**
     * Emits a offer created event
     */
    const emitOfferCreated = (offer: UIOffer): void => {
      try {
        storeEventBus.emit('offer:created', { offer });
      } catch (error) {
        console.error('Failed to emit offer:created event:', error);
      }
    };

    /**
     * Emits a offer deleted event
     */
    const emitOfferDeleted = (offerHash: ActionHash): void => {
      try {
        storeEventBus.emit('offer:deleted', { offerHash });
      } catch (error) {
        console.error('Failed to emit offer:deleted event:', error);
      }
    };

    // ========================================================================
    // CACHE OPERATIONS
    // ========================================================================

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    // ========================================================================
    // STORE METHODS - READ OPERATIONS
    // ========================================================================

    const getAllOffers = (): E.Effect<UIOffer[], OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          // Clear existing offers to prevent duplicates
          E.sync(() => clearOffersState()),
          // Fetch all offers and organizations in parallel
          E.flatMap(() =>
            E.all([offersService.getAllOffersRecords(), fetchAcceptedOrganizations()])
          ),
          // Create organization mapping and process offers
          E.flatMap(([records, organizations]) =>
            pipe(
              createOrganizationOfferMapping(organizations, offersService),
              E.flatMap((offerToOrgMap) =>
                E.all(
                  records.map((record) => {
                    const offerHash = record.signed_action.hashed.hash;
                    const organization = determineOrganizationForOffer(offerHash, offerToOrgMap);
                    return processOfferRecord(
                      record,
                      cache,
                      syncCacheToState,
                      organization,
                      'offer mapping'
                    );
                  })
                )
              )
            )
          ),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_ALL_REQUESTS))
        )
      )(setLoading, setError);

    const getUserOffers = (userHash: ActionHash): E.Effect<UIOffer[], OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.getUserOffersRecords(userHash),
          E.flatMap((records) =>
            pipe(
              offersService.getOrganizationOffersRecords(userHash),
              E.flatMap((orgOffers) => {
                const orgOfferHashes = new Set(
                  orgOffers.map((r) => r.signed_action.hashed.hash.toString())
                );

                return E.all(
                  records.map((record) => {
                    const offerHash = record.signed_action.hashed.hash;
                    const organization = orgOfferHashes.has(offerHash.toString())
                      ? userHash
                      : undefined;
                    return processOfferRecord(
                      record,
                      cache,
                      syncCacheToState,
                      organization,
                      'user offer mapping'
                    );
                  })
                );
              })
            )
          ),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_USER_REQUESTS))
        )
      )(setLoading, setError);

    const getOrganizationOffers = (
      organizationHash: ActionHash
    ): E.Effect<UIOffer[], OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.getOrganizationOffersRecords(organizationHash),
          E.flatMap((records) =>
            E.all(
              records.map((record) =>
                processOfferRecord(
                  record,
                  cache,
                  syncCacheToState,
                  organizationHash,
                  'organization offer mapping'
                )
              )
            )
          ),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_ORGANIZATION_REQUESTS))
        )
      )(setLoading, setError);

    const getLatestOffer = (
      originalActionHash: ActionHash
    ): E.Effect<UIOffer | null, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          cache.get(originalActionHash.toString()),
          E.flatMap((offer: UIOffer) => {
            // If the offer doesn't have service types, fetch them
            if (!offer.service_type_hashes || offer.service_type_hashes.length === 0) {
              return pipe(
                fetchServiceTypes(originalActionHash, 'cached offer'),
                E.map((serviceTypeHashes) => {
                  const updatedOffer: UIOffer = {
                    ...offer,
                    service_type_hashes: serviceTypeHashes
                  };

                  // Update cache with service types
                  E.runSync(cache.set(originalActionHash.toString(), updatedOffer));
                  syncCacheToState(updatedOffer, 'update');
                  return updatedOffer as UIOffer | null;
                })
              );
            } else {
              // Offer already has service types
              syncCacheToState(offer, 'update');
              return E.succeed(offer as UIOffer | null);
            }
          }),
          E.catchAll(() => E.succeed(null as UIOffer | null)),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_LATEST_REQUEST))
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE METHODS - WRITE OPERATIONS
    // ========================================================================

    const createOffer = (
      offer: OfferInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.createOffer(offer, organizationHash),
          E.map((record) => {
            let creatorHash: ActionHash | undefined;
            const currentUser = usersStore.currentUser;

            if (currentUser?.original_action_hash) {
              creatorHash = currentUser.original_action_hash;
            } else {
              creatorHash = record.signed_action.hashed.content.author;
              console.warn('No current user found, using agent pubkey as creator');
            }

            const newOffer: UIOffer = {
              ...decodeRecords<OfferInDHT>([record])[0],
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              organization: organizationHash,
              creator: creatorHash,
              created_at: Date.now(),
              updated_at: Date.now()
            };

            // Cache the new offer
            E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newOffer));
            syncCacheToState(newOffer, 'add');

            return { record, newOffer };
          }),
          E.tap(({ newOffer }) => E.sync(() => emitOfferCreated(newOffer))),
          E.map(({ record }) => record),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.CREATE_REQUEST))
        )
      )(setLoading, setError);

    const updateOffer = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedOffer: OfferInput
    ): E.Effect<Record, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.updateOffer(originalActionHash, previousActionHash, updatedOffer),
          E.map((record) => {
            // After updating, invalidate the cache so the next fetch will get fresh data with updated service types
            E.runSync(cache.invalidate(originalActionHash.toString()));
            // Remove the old version from state
            removeOfferFromState(originalActionHash);
            return record;
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.UPDATE_REQUEST))
        )
      )(setLoading, setError);

    const deleteOffer = (offerHash: ActionHash): E.Effect<void, OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.deleteOffer(offerHash),
          E.tap(() => {
            // Remove from cache and state
            E.runSync(cache.invalidate(offerHash.toString()));
            removeOfferFromState(offerHash);
          }),
          E.tap(() => E.sync(() => emitOfferDeleted(offerHash))),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.DELETE_REQUEST))
        )
      )(setLoading, setError);

    const getOffersByTag = (tag: string): E.Effect<UIOffer[], OfferStoreError> =>
      withLoadingState(() =>
        pipe(
          offersService.getOffersByTag(tag),
          E.flatMap((records) =>
            E.all(
              records.map((record) =>
                processOfferRecord(record, cache, syncCacheToState, undefined, 'tag offer mapping')
              )
            )
          ),
          E.catchAll(createErrorHandler('Failed to get offers by tag'))
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE OBJECT RETURN
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
      invalidateCache,
      getAllOffers,
      getLatestOffer,
      getUserOffers,
      getOrganizationOffers,
      createOffer,
      updateOffer,
      deleteOffer,
      getOffersByTag
    };
  });
};

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

// Lazy store initialization to avoid runtime issues
let _offersStore: OffersStore | null = null;

const getOffersStore = (): OffersStore => {
  if (!_offersStore) {
    _offersStore = pipe(
      createOffersStore(),
      E.provide(OffersServiceLive),
      E.provide(CacheServiceLive),
      E.provide(HolochainClientServiceLive),
      E.runSync
    );
  }
  return _offersStore;
};

// Export a proxy that delegates to the lazy-initialized store
const offersStore = new Proxy({} as OffersStore, {
  get(_target, prop) {
    const store = getOffersStore();
    const value = store[prop as keyof OffersStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default offersStore;
