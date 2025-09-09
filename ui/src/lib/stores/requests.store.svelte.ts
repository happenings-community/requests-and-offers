import type { ActionHash, Record } from '@holochain/client';
import {
  RequestsServiceTag,
  RequestsServiceLive,
  type RequestsService
} from '$lib/services/zomes/requests.service';
import type { UIRequest } from '$lib/types/ui';
import type { RequestInDHT, RequestInput } from '$lib/types/holochain';
import { decodeRecords } from '$lib/utils';
import { actionHashToSchemaType } from '$lib/utils/type-bridges';
import usersStore from '$lib/stores/users.store.svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { CacheNotFoundError } from '$lib/errors';
import { RequestError } from '$lib/errors/requests.errors';
import { CACHE_EXPIRY } from '$lib/utils/constants';
import { REQUEST_CONTEXTS } from '$lib/errors/error-contexts';

// Import standardized store helpers
import {
  withLoadingState,
  createErrorHandler,
  createGenericCacheSyncHelper,
  createEntityFetcher,
  createStandardEventEmitters,
  createUIEntityFromRecord,
  createEntityCreationHelper,
  mapRecordsToUIEntities,
  type LoadingStateSetter
} from '$lib/utils/store-helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = CACHE_EXPIRY.REQUESTS;

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error handler for Request operations
 */
const handleRequestError = createErrorHandler(RequestError.fromError, 'Request operation failed');

/**
 * Create standardized event emitters for Request entities
 */
const requestEventEmitters = createStandardEventEmitters<UIRequest>('request');

/**
 * Create standardized entity fetcher for Requests
 */
const requestEntityFetcher = createEntityFetcher<UIRequest, RequestError>(handleRequestError);

/**
 * Cache lookup function for requests
 */
const requestCacheLookup = (key: string): E.Effect<UIRequest, CacheNotFoundError, never> => {
  return E.fail(new CacheNotFoundError({ key }));
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Define a proper Entry type to avoid using 'any'
type HolochainEntry = {
  Present: {
    entry: Uint8Array;
  };
};

export type RequestsStore = {
  readonly requests: UIRequest[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIRequest>;

  // Search-related state
  readonly searchResults: UIRequest[];

  getRequest: (requestHash: ActionHash) => E.Effect<UIRequest | null, RequestError>;
  getAllRequests: () => E.Effect<UIRequest[], RequestError>;
  createRequest: (
    request: RequestInput,
    organizationHash?: ActionHash
  ) => E.Effect<Record, RequestError>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInput
  ) => E.Effect<Record, RequestError>;
  deleteRequest: (requestHash: ActionHash) => E.Effect<void, RequestError>;
  archiveRequest: (requestHash: ActionHash) => E.Effect<void, RequestError>;
  getMyListings: (userHash: ActionHash) => E.Effect<UIRequest[], RequestError>;
  hasRequests: () => E.Effect<boolean, RequestError>;
  getUserRequests: (userHash: ActionHash) => E.Effect<UIRequest[], RequestError>;
  getOrganizationRequests: (organizationHash: ActionHash) => E.Effect<UIRequest[], RequestError>;
  getLatestRequest: (originalActionHash: ActionHash) => E.Effect<UIRequest | null, RequestError>;
  getRequestsByTag: (tag: string) => E.Effect<UIRequest[], RequestError>;
  invalidateCache: () => void;
};

// ============================================================================
// ENTITY CREATION HELPERS
// ============================================================================

/**
 * Creates a complete UIRequest from a record using standardized helper pattern
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
const createUIRequest = createUIEntityFromRecord<RequestInDHT, UIRequest>(
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
    } as any; // Type assertion to avoid TypeScript errors for now
  }
);

/**
 * Asynchronously processes a Holochain record to create a UIRequest.
 * Fetches the creator, organization ActionHashes, service types, and medium of exchange hashes.
 */
const processRecord = (
  record: Record,
  requestsService: RequestsService
): E.Effect<UIRequest, RequestError> => {
  const requestHash = record.signed_action.hashed.hash;
  const authorPubKey = record.signed_action.hashed.content.author;

  return pipe(
    E.all({
      userProfile: pipe(
        usersStore.getUserByAgentPubKey(authorPubKey),
        E.catchAll(() => E.succeed(null))
      ),
      serviceTypeHashes: pipe(
        serviceTypesStore.getServiceTypesForEntity({
          original_action_hash: actionHashToSchemaType(requestHash),
          entity: 'request'
        }),
        E.orElse(() => E.succeed([] as ActionHash[]))
      ),
      mediumOfExchangeHashes: pipe(
        requestsService.getMediumsOfExchangeForRequest(requestHash),
        E.orElse(() => E.succeed([] as ActionHash[]))
      )
    }),
    E.flatMap(({ userProfile, serviceTypeHashes, mediumOfExchangeHashes }) =>
      E.succeed({
        userProfile: userProfile,
        serviceTypeHashes,
        mediumOfExchangeHashes
      })
    ),
    E.flatMap(({ userProfile, serviceTypeHashes, mediumOfExchangeHashes }) => {
      const additionalData = {
        serviceTypeHashes,
        mediumOfExchangeHashes,
        creator: userProfile?.original_action_hash, // Only set if user profile exists
        authorPubKey, // Keep AgentPubKey separately for fallback comparison
        organization: undefined // No organization support yet in this simplified flow
      };

      const entity = createUIRequest(record, additionalData);
      return entity
        ? E.succeed(entity)
        : E.fail(
            RequestError.fromError(
              new Error('Failed to create UI entity'),
              REQUEST_CONTEXTS.DECODE_REQUESTS
            )
          );
    }),
    E.mapError((error) => RequestError.fromError(error, REQUEST_CONTEXTS.DECODE_REQUESTS))
  );
};

/**
 * Creates enhanced UIRequest from record with additional processing
 * This handles service types and medium of exchange relationships
 */
const createEnhancedUIRequest = (
  record: Record,
  requestsService: RequestsService
): E.Effect<UIRequest, RequestError> => {
  return processRecord(record, requestsService);
};

/**
 * Converts UI RequestInput to compatible format for service calls
 * This resolves the type bridge issue between UI types (Uint8Array) and service types (string)
 */
const convertRequestInputForService = (input: RequestInput): RequestInput => ({
  ...input,
  service_type_hashes: input.service_type_hashes.map((hash) =>
    typeof hash === 'string' ? hash : actionHashToSchemaType(hash)
  ),
  medium_of_exchange_hashes: input.medium_of_exchange_hashes.map((hash) =>
    typeof hash === 'string' ? hash : actionHashToSchemaType(hash)
  )
});

/**
 * REQUESTS STORE - USING STANDARDIZED STORE HELPER PATTERNS
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
 * 8. createCacheLookupFunction - Cache miss handling with service fallback
 *
 * This implementation focuses on consistent patterns for CRUD operations with
 * proper error handling, caching, and event emission.
 *
 * @returns An Effect that creates a requests store with state and methods
 */
export const createRequestsStore = (): E.Effect<
  RequestsStore,
  never,
  RequestsServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const requestsService = yield* RequestsServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    const requests: UIRequest[] = $state([]);
    const searchResults: UIRequest[] = $state([]);
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
      all: requests,
      searchResults: searchResults
    });

    // 3. EVENT EMITTERS - Using createStandardEventEmitters
    const eventEmitters = requestEventEmitters;

    // 4. CACHE MANAGEMENT - Using standardized cache lookup pattern
    const cache = yield* cacheService.createEntityCache<UIRequest>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      requestCacheLookup
    );

    // 5. ENTITY CREATION - Using createEntityCreationHelper
    const { createEntity } = createEntityCreationHelper(createUIRequest);

    // ===== STATE MANAGEMENT FUNCTIONS =====

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      requests.length = 0;
      searchResults.length = 0;
      setters.setError(null);
    };

    // ===== CORE CRUD OPERATIONS =====

    const createRequest = (
      request: RequestInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, RequestError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(convertRequestInputForService(request)),
          E.flatMap((serviceRequest) =>
            requestsService.createRequest(serviceRequest, organizationHash)
          ),
          E.tap((record) => {
            const entity = createUIRequest(record, {});
            if (entity) {
              E.runSync(cache.set(record.signed_action.hashed.hash.toString(), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.CREATE_REQUEST))
          )
        )
      )(setters);

    const getAllRequests = (): E.Effect<UIRequest[], RequestError> =>
      requestEntityFetcher(
        () =>
          pipe(
            requestsService.getAllRequestsRecords(),
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
                  .map((record) => createEnhancedUIRequest(record, requestsService))
              )
            ),
            E.tap((uiRequests) =>
              E.sync(() => {
                uiRequests.forEach((uiRequest) => {
                  const requestHash = uiRequest.original_action_hash;
                  if (requestHash) {
                    E.runSync(cache.set(requestHash.toString(), uiRequest));
                    syncCacheToState(uiRequest, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) => {
              const errorMessage = String(error);
              if (errorMessage.includes('Client not connected')) {
                console.warn('Holochain client not connected, returning empty requests array');
                return E.succeed([]);
              }
              return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_ALL_REQUESTS));
            })
          ),
        {
          targetArray: requests,
          errorContext: REQUEST_CONTEXTS.GET_ALL_REQUESTS,
          setters
        }
      );

    const getRequest = (requestHash: ActionHash): E.Effect<UIRequest | null, RequestError> =>
      withLoadingState(() =>
        pipe(
          cache.get(requestHash.toString()),
          E.catchTag('CacheNotFoundError', () => {
            // Cache miss is expected on page refresh, continue to fetch from service
            return E.succeed(null);
          }),
          E.flatMap((cachedRequest) => {
            if (cachedRequest) {
              return E.succeed(cachedRequest);
            }

            return pipe(
              requestsService.getLatestRequestRecord(requestHash),
              E.flatMap((record) => {
                if (!record) return E.succeed(null);

                // Use enhanced creation to fetch related data (service types, medium of exchange)
                return pipe(
                  createEnhancedUIRequest(record, requestsService),
                  E.map((request) => {
                    if (request) {
                      E.runSync(cache.set(requestHash.toString(), request));
                      syncCacheToState(request, 'add');
                    }
                    return request;
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
                console.error('Failed to fetch request from service:', error);
                return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_REQUEST));
              })
            );
          }),
          E.catchAll((error) => {
            // Log the error for debugging while still providing a user-friendly message
            console.error('Unexpected error in getRequest:', error);
            return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_REQUEST));
          })
        )
      )(setters);

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedRequest: RequestInput
    ): E.Effect<Record, RequestError> =>
      withLoadingState(() =>
        pipe(
          requestsService.updateRequest(
            originalActionHash,
            previousActionHash,
            updatedRequest as any
          ),
          E.flatMap((newActionHash) =>
            pipe(
              requestsService.getLatestRequestRecord(newActionHash as unknown as ActionHash),
              E.map((record) => {
                if (!record) return { record: null, updatedRequest: null };

                const baseEntity = createUIRequest(record, {});
                if (!baseEntity) return { record: null, updatedRequest: null };

                const updatedUIRequest: UIRequest = {
                  ...baseEntity,
                  original_action_hash: originalActionHash,
                  previous_action_hash: newActionHash as unknown as ActionHash,
                  updated_at: Date.now()
                };

                E.runSync(cache.set(originalActionHash.toString(), updatedUIRequest));
                syncCacheToState(updatedUIRequest, 'update');

                return { record, updatedRequest: updatedUIRequest };
              })
            )
          ),
          E.tap(({ updatedRequest }) =>
            updatedRequest ? E.sync(() => eventEmitters.emitUpdated(updatedRequest)) : E.asVoid
          ),
          E.map(({ record }) => record!),
          E.catchAll((error) =>
            E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.UPDATE_REQUEST))
          )
        )
      )(setters);

    const deleteRequest = (requestHash: ActionHash): E.Effect<void, RequestError> =>
      withLoadingState(() =>
        pipe(
          requestsService.deleteRequest(requestHash),
          E.tap(() => {
            E.runSync(cache.invalidate(requestHash.toString()));
            const dummyRequest = { original_action_hash: requestHash } as UIRequest;
            syncCacheToState(dummyRequest, 'remove');
          }),
          E.tap(() => E.sync(() => eventEmitters.emitDeleted(requestHash))),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.DELETE_REQUEST))
          )
        )
      )(setters);

    const archiveRequest = (requestHash: ActionHash): E.Effect<void, RequestError> =>
      withLoadingState(() =>
        pipe(
          requestsService.archiveRequest(requestHash),
          E.tap(() => {
            // Invalidate cache and update state
            E.runSync(cache.invalidate(requestHash.toString()));
            const dummyRequest = { original_action_hash: requestHash } as UIRequest;
            syncCacheToState(dummyRequest, 'remove');
          }),
          E.tap(() => E.sync(() => eventEmitters.emitDeleted(requestHash))),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.ARCHIVE_REQUEST))
          )
        )
      )(setters);

    // ===== SPECIALIZED QUERY OPERATIONS =====

    const getUserRequests = (userHash: ActionHash): E.Effect<UIRequest[], RequestError> =>
      requestEntityFetcher(
        () =>
          pipe(
            requestsService.getUserRequestsRecords(userHash),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIRequest(record, requestsService)))
            ),
            E.tap((uiRequests) =>
              E.sync(() => {
                uiRequests.forEach((uiRequest) => {
                  const requestHash = uiRequest.original_action_hash;
                  if (requestHash) {
                    E.runSync(cache.set(requestHash.toString(), uiRequest));
                    syncCacheToState(uiRequest, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_USER_REQUESTS))
            )
          ),
        {
          targetArray: searchResults,
          errorContext: REQUEST_CONTEXTS.GET_USER_REQUESTS,
          setters
        }
      );

    const getOrganizationRequests = (
      organizationHash: ActionHash
    ): E.Effect<UIRequest[], RequestError> =>
      requestEntityFetcher(
        () =>
          pipe(
            requestsService.getOrganizationRequestsRecords(organizationHash),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIRequest(record, requestsService)))
            ),
            E.tap((uiRequests) =>
              E.sync(() => {
                uiRequests.forEach((uiRequest) => {
                  const requestHash = uiRequest.original_action_hash;
                  if (requestHash) {
                    E.runSync(cache.set(requestHash.toString(), uiRequest));
                    syncCacheToState(uiRequest, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_ORGANIZATION_REQUESTS))
            )
          ),
        {
          targetArray: searchResults,
          errorContext: REQUEST_CONTEXTS.GET_ORGANIZATION_REQUESTS,
          setters
        }
      );

    const getMyListings = (userHash: ActionHash): E.Effect<UIRequest[], RequestError> =>
      requestEntityFetcher(
        () =>
          pipe(
            requestsService.getMyListings(userHash),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIRequest(record, requestsService)))
            ),
            E.tap((uiRequests) =>
              E.sync(() => {
                uiRequests.forEach((uiRequest) => {
                  const requestHash = uiRequest.original_action_hash;
                  if (requestHash) {
                    E.runSync(cache.set(requestHash.toString(), uiRequest));
                    syncCacheToState(uiRequest, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_MY_LISTINGS))
            )
          ),
        {
          targetArray: searchResults,
          errorContext: REQUEST_CONTEXTS.GET_MY_LISTINGS,
          setters
        }
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<UIRequest | null, RequestError> =>
      withLoadingState(() =>
        pipe(
          requestsService.getLatestRequestRecord(originalActionHash),
          E.map((record) => {
            if (!record) return null;
            return createUIRequest(record, {});
          }),
          E.catchAll((error) =>
            E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_LATEST_REQUEST))
          )
        )
      )(setters);

    const getRequestsByTag = (tag: string): E.Effect<UIRequest[], RequestError> =>
      requestEntityFetcher(
        () =>
          pipe(
            requestsService.getRequestsByTag(tag),
            E.flatMap((records) =>
              E.all(records.map((record) => createEnhancedUIRequest(record, requestsService)))
            ),
            E.tap((uiRequests) =>
              E.sync(() => {
                uiRequests.forEach((uiRequest) => {
                  const requestHash = uiRequest.original_action_hash;
                  if (requestHash) {
                    E.runSync(cache.set(requestHash.toString(), uiRequest));
                    syncCacheToState(uiRequest, 'add');
                  }
                });
              })
            ),
            E.catchAll((error) =>
              E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.GET_REQUESTS_BY_TAG))
            )
          ),
        {
          targetArray: searchResults,
          errorContext: REQUEST_CONTEXTS.GET_REQUESTS_BY_TAG,
          setters
        }
      );

    const hasRequests = (): E.Effect<boolean, RequestError> =>
      pipe(
        getAllRequests(),
        E.map((requests) => requests.length > 0),
        E.catchAll((error) => {
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected, assuming no requests exist');
            return E.succeed(false);
          }
          return E.fail(RequestError.fromError(error, REQUEST_CONTEXTS.CHECK_REQUESTS_EXIST));
        })
      );

    // ===== STORE INTERFACE =====

    return {
      get requests() {
        return requests;
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
      get searchResults() {
        return searchResults;
      },
      getRequest,
      getAllRequests,
      createRequest,
      updateRequest,
      deleteRequest,
      archiveRequest,
      getMyListings,
      hasRequests,
      getUserRequests,
      getOrganizationRequests,
      getLatestRequest,
      getRequestsByTag,
      invalidateCache
    };
  });

// ============================================================================
// STORE INSTANCE MANAGEMENT
// ============================================================================

const requestsStore: RequestsStore = pipe(
  createRequestsStore(),
  E.provide(RequestsServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive),
  E.runSync
);

export default requestsStore;
