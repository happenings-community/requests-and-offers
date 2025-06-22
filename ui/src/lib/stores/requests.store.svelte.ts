import type { ActionHash, Record } from '@holochain/client';
import type { UIRequest } from '$lib/types/ui';
import type { RequestInDHT, RequestInput } from '$lib/types/holochain';
import { RequestsServiceTag, RequestsServiceLive } from '$lib/services/zomes/requests.service';
import { decodeRecords } from '$lib/utils';
import usersStore from '$lib/stores/users.store.svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import { actionHashToString } from '../utils/type-bridges';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { StoreEventBusLive, StoreEventBusTag } from '$lib/stores/storeEvents';
import type { StoreEvents } from '$lib/stores/storeEvents';
import type { EventBusService } from '$lib/utils/eventBus.effect';
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
  CREATE_REQUEST: 'Failed to create request',
  GET_ALL_REQUESTS: 'Failed to get all requests',
  GET_USER_REQUESTS: 'Failed to get user requests',
  GET_ORGANIZATION_REQUESTS: 'Failed to get organization requests',
  GET_LATEST_REQUEST: 'Failed to get latest request',
  UPDATE_REQUEST: 'Failed to update request',
  DELETE_REQUEST: 'Failed to delete request',
  EMIT_REQUEST_CREATED: 'Failed to emit request created event',
  EMIT_REQUEST_DELETED: 'Failed to emit request deleted event'
} as const;

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class RequestStoreError extends Data.TaggedError('RequestStoreError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): RequestStoreError {
    if (error instanceof Error) {
      return new RequestStoreError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new RequestStoreError({
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
 * Determines the organization hash for a request based on organization request mappings
 */
const determineOrganizationForRequest = (
  requestHash: ActionHash,
  organizationRequestMappings: Map<string, ActionHash>
): ActionHash | undefined => organizationRequestMappings.get(requestHash.toString());

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Fetches service types for a request and handles errors gracefully
 */
const fetchServiceTypes = (
  requestHash: ActionHash,
  context: string = 'request'
): E.Effect<ActionHash[], never> =>
  pipe(
    serviceTypesStore.getServiceTypesForEntity({
      original_action_hash: actionHashToString(requestHash),
      entity: 'request'
    }),
    E.catchAll((error) => {
      console.warn(`Failed to get service type hashes during ${context}:`, error);
      return E.succeed([]);
    })
  );

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
      console.warn('Failed to get accepted organizations during request mapping:', error);
      return [];
    }
  });

// ============================================================================
// REQUEST CREATION HELPERS
// ============================================================================

/**
 * Creates a complete UIRequest from a record and additional data
 */
const createUIRequest = (
  record: Record,
  request: RequestInDHT,
  serviceTypeHashes: ActionHash[],
  creator?: ActionHash,
  organization?: ActionHash
): UIRequest => ({
  ...request,
  original_action_hash: record.signed_action.hashed.hash,
  previous_action_hash: record.signed_action.hashed.hash,
  creator: creator || record.signed_action.hashed.content.author,
  organization,
  created_at: record.signed_action.hashed.content.timestamp,
  updated_at: record.signed_action.hashed.content.timestamp,
  service_type_hashes: serviceTypeHashes
});

/**
 * Processes a single request record into a UIRequest with all dependencies
 */
const processRequestRecord = (
  record: Record,
  cache: EntityCacheService<UIRequest>,
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void,
  organization?: ActionHash,
  context: string = 'processing'
): E.Effect<UIRequest, never> => {
  const requestHash = record.signed_action.hashed.hash;
  const request = decodeRecords<RequestInDHT>([record])[0];
  const authorPubKey = record.signed_action.hashed.content.author;

  return pipe(
    E.all([fetchUserProfile(authorPubKey, context), fetchServiceTypes(requestHash, context)]),
    E.map(([userProfile, serviceTypeHashes]) => {
      const uiRequest = createUIRequest(
        record,
        request,
        serviceTypeHashes,
        userProfile?.original_action_hash || authorPubKey,
        organization
      );

      // Cache and sync
      E.runSync(cache.set(requestHash.toString(), uiRequest));
      syncCacheToState(uiRequest, 'add');

      return uiRequest;
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
 * Creates an error handler that wraps errors in RequestStoreError
 */
const createErrorHandler = (context: string) => (error: unknown) =>
  E.fail(RequestStoreError.fromError(error, context));

// ============================================================================
// ORGANIZATION REQUEST MAPPING
// ============================================================================

/**
 * Creates a mapping of request hashes to their organization hashes
 */
const createOrganizationRequestMapping = (
  organizations: Array<{ original_action_hash?: ActionHash }>,
  requestsService: {
    getOrganizationRequestsRecords: (hash: ActionHash) => E.Effect<Record[], unknown>;
  }
): E.Effect<Map<string, ActionHash>, never> =>
  pipe(
    E.all(
      organizations.map((org) =>
        org.original_action_hash
          ? pipe(
              requestsService.getOrganizationRequestsRecords(org.original_action_hash),
              E.map((orgRecords: Record[]) => ({ org, records: orgRecords })),
              E.catchAll(() => E.succeed({ org, records: [] as Record[] }))
            )
          : E.succeed({ org, records: [] as Record[] })
      )
    ),
    E.map((orgRequests) => {
      const requestToOrgMap = new Map<string, ActionHash>();
      for (const { org, records } of orgRequests) {
        for (const record of records) {
          if (
            record &&
            record.signed_action &&
            record.signed_action.hashed &&
            org.original_action_hash
          ) {
            requestToOrgMap.set(
              record.signed_action.hashed.hash.toString(),
              org.original_action_hash
            );
          }
        }
      }
      return requestToOrgMap;
    }),
    E.catchAll(() => E.succeed(new Map<string, ActionHash>()))
  );

// ============================================================================
// STORE TYPE DEFINITION
// ============================================================================

export type RequestsStore = {
  readonly requests: UIRequest[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIRequest>;
  getLatestRequest: (
    originalActionHash: ActionHash
  ) => E.Effect<UIRequest | null, RequestStoreError>;
  getAllRequests: () => E.Effect<UIRequest[], RequestStoreError>;
  getUserRequests: (userHash: ActionHash) => E.Effect<UIRequest[], RequestStoreError>;
  getOrganizationRequests: (
    organizationHash: ActionHash
  ) => E.Effect<UIRequest[], RequestStoreError>;
  createRequest: (
    request: RequestInput,
    organizationHash?: ActionHash
  ) => E.Effect<Record, RequestStoreError, EventBusService<StoreEvents>>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInput
  ) => E.Effect<Record, RequestStoreError>;
  deleteRequest: (
    requestHash: ActionHash
  ) => E.Effect<void, RequestStoreError, EventBusService<StoreEvents>>;
  getRequestsByTag: (tag: string) => E.Effect<UIRequest[], RequestStoreError>;
  invalidateCache: () => void;
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create a requests store as an Effect
 * @returns An Effect that creates a requests store with state and methods
 */
export const createRequestsStore = (): E.Effect<
  RequestsStore,
  never,
  RequestsServiceTag | CacheServiceTag
> => {
  return E.gen(function* () {
    const requestsService = yield* RequestsServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================

    const requests: UIRequest[] = $state([]);
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
    const lookupRequest = (key: string): E.Effect<UIRequest, CacheNotFoundError> =>
      pipe(
        E.tryPromise({
          try: async () => {
            const hash = parseHashFromCacheKey(key);
            const record = await E.runPromise(requestsService.getLatestRequestRecord(hash));

            if (!record) {
              throw new Error(`Request not found for key: ${key}`);
            }

            const request = decodeRecords<RequestInDHT>([record])[0];
            const authorPubKey = record.signed_action.hashed.content.author;
            const userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
            const serviceTypeHashes = await E.runPromise(fetchServiceTypes(hash, 'cache lookup'));

            return createUIRequest(
              record,
              request,
              serviceTypeHashes,
              userProfile?.original_action_hash || authorPubKey
            );
          },
          catch: () => new CacheNotFoundError({ key })
        }),
        E.mapError(() => new CacheNotFoundError({ key }))
      );

    const cache = yield* cacheService.createEntityCache<UIRequest>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupRequest
    );

    // ========================================================================
    // STATE SYNCHRONIZATION
    // ========================================================================

    /**
     * Helper function to sync cache with local state
     */
    const syncCacheToState = (entity: UIRequest, operation: 'add' | 'update' | 'remove') => {
      const index = requests.findIndex(
        (r) => r.original_action_hash?.toString() === entity.original_action_hash?.toString()
      );

      switch (operation) {
        case 'add':
        case 'update':
          if (index !== -1) {
            requests[index] = entity;
          } else {
            requests.push(entity);
          }
          break;
        case 'remove':
          if (index !== -1) {
            requests.splice(index, 1);
          }
          break;
      }
    };

    /**
     * Removes a request from state by hash
     */
    const removeRequestFromState = (requestHash: ActionHash) => {
      const index = requests.findIndex(
        (request) => request.original_action_hash?.toString() === requestHash.toString()
      );
      if (index !== -1) {
        requests.splice(index, 1);
      }
    };

    /**
     * Clears all requests from state
     */
    const clearRequestsState = () => {
      requests.length = 0;
    };

    // ========================================================================
    // EVENT EMISSION HELPERS
    // ========================================================================

    /**
     * Emits a request created event
     */
    const emitRequestCreated = (request: UIRequest) =>
      E.gen(function* () {
        const eventBus = yield* StoreEventBusTag;
        yield* eventBus.emit('request:created', { request });
      }).pipe(
        E.catchAll((error) =>
          E.fail(RequestStoreError.fromError(error, ERROR_CONTEXTS.EMIT_REQUEST_CREATED))
        ),
        E.provide(StoreEventBusLive)
      );

    /**
     * Emits a request deleted event
     */
    const emitRequestDeleted = (requestHash: ActionHash) =>
      E.gen(function* () {
        const eventBus = yield* StoreEventBusTag;
        yield* eventBus.emit('request:deleted', { requestHash });
      }).pipe(
        E.catchAll((error) =>
          E.fail(RequestStoreError.fromError(error, ERROR_CONTEXTS.EMIT_REQUEST_DELETED))
        ),
        E.provide(StoreEventBusLive)
      );

    // ========================================================================
    // CACHE OPERATIONS
    // ========================================================================

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    // ========================================================================
    // STORE METHODS - READ OPERATIONS
    // ========================================================================

    const getAllRequests = (): E.Effect<UIRequest[], RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          // Clear existing requests to prevent duplicates
          E.sync(() => clearRequestsState()),
          // Fetch all requests and organizations in parallel
          E.flatMap(() =>
            E.all([requestsService.getAllRequestsRecords(), fetchAcceptedOrganizations()])
          ),
          // Create organization mapping and process requests
          E.flatMap(([records, organizations]) =>
            pipe(
              createOrganizationRequestMapping(organizations, requestsService),
              E.flatMap((requestToOrgMap) =>
                E.all(
                  records.map((record) => {
                    const requestHash = record.signed_action.hashed.hash;
                    const organization = determineOrganizationForRequest(
                      requestHash,
                      requestToOrgMap
                    );
                    return processRequestRecord(
                      record,
                      cache,
                      syncCacheToState,
                      organization,
                      'request mapping'
                    );
                  })
                )
              )
            )
          ),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_ALL_REQUESTS))
        )
      )(setLoading, setError);

    const getUserRequests = (userHash: ActionHash): E.Effect<UIRequest[], RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.getUserRequestsRecords(userHash),
          E.flatMap((records) =>
            pipe(
              requestsService.getOrganizationRequestsRecords(userHash),
              E.flatMap((orgRequests) => {
                const orgRequestHashes = new Set(
                  orgRequests.map((r) => r.signed_action.hashed.hash.toString())
                );

                return E.all(
                  records.map((record) => {
                    const requestHash = record.signed_action.hashed.hash;
                    const organization = orgRequestHashes.has(requestHash.toString())
                      ? userHash
                      : undefined;
                    return processRequestRecord(
                      record,
                      cache,
                      syncCacheToState,
                      organization,
                      'user request mapping'
                    );
                  })
                );
              })
            )
          ),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_USER_REQUESTS))
        )
      )(setLoading, setError);

    const getOrganizationRequests = (
      organizationHash: ActionHash
    ): E.Effect<UIRequest[], RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.getOrganizationRequestsRecords(organizationHash),
          E.flatMap((records) =>
            E.all(
              records.map((record) =>
                processRequestRecord(
                  record,
                  cache,
                  syncCacheToState,
                  organizationHash,
                  'organization request mapping'
                )
              )
            )
          ),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_ORGANIZATION_REQUESTS))
        )
      )(setLoading, setError);

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<UIRequest | null, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          cache.get(originalActionHash.toString()),
          E.flatMap((request: UIRequest) => {
            // If the request doesn't have service types, fetch them
            if (!request.service_type_hashes || request.service_type_hashes.length === 0) {
              return pipe(
                fetchServiceTypes(originalActionHash, 'cached request'),
                E.map((serviceTypeHashes) => {
                  const updatedRequest: UIRequest = {
                    ...request,
                    service_type_hashes: serviceTypeHashes
                  };

                  // Update cache with service types
                  E.runSync(cache.set(originalActionHash.toString(), updatedRequest));
                  syncCacheToState(updatedRequest, 'update');
                  return updatedRequest as UIRequest | null;
                })
              );
            } else {
              // Request already has service types
              syncCacheToState(request, 'update');
              return E.succeed(request as UIRequest | null);
            }
          }),
          E.catchAll(() => E.succeed(null as UIRequest | null)),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.GET_LATEST_REQUEST))
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE METHODS - WRITE OPERATIONS
    // ========================================================================

    const createRequest = (
      request: RequestInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, RequestStoreError, EventBusService<StoreEvents>> =>
      withLoadingState(() =>
        pipe(
          requestsService.createRequest(request, organizationHash),
          E.map((record) => {
            let creatorHash: ActionHash | undefined;
            const currentUser = usersStore.currentUser;

            if (currentUser?.original_action_hash) {
              creatorHash = currentUser.original_action_hash;
            } else {
              creatorHash = record.signed_action.hashed.content.author;
              console.warn('No current user found, using agent pubkey as creator');
            }

            const newRequest: UIRequest = {
              ...decodeRecords<RequestInDHT>([record])[0],
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              organization: organizationHash,
              creator: creatorHash,
              created_at: Date.now(),
              updated_at: Date.now()
            };

            // Cache the new request
            E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newRequest));
            syncCacheToState(newRequest, 'add');

            return { record, newRequest };
          }),
          E.tap(({ newRequest }) => (newRequest ? emitRequestCreated(newRequest) : E.asVoid)),
          E.map(({ record }) => record),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.CREATE_REQUEST))
        )
      )(setLoading, setError);

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedRequest: RequestInput
    ): E.Effect<Record, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.updateRequest(originalActionHash, previousActionHash, updatedRequest),
          E.map((record) => {
            // After updating, invalidate the cache so the next fetch will get fresh data with updated service types
            E.runSync(cache.invalidate(originalActionHash.toString()));
            // Remove the old version from state
            removeRequestFromState(originalActionHash);
            return record;
          }),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.UPDATE_REQUEST))
        )
      )(setLoading, setError);

    const deleteRequest = (
      requestHash: ActionHash
    ): E.Effect<void, RequestStoreError, EventBusService<StoreEvents>> =>
      withLoadingState(() =>
        pipe(
          requestsService.deleteRequest(requestHash),
          E.tap(() => {
            // Remove from cache and state
            E.runSync(cache.invalidate(requestHash.toString()));
            removeRequestFromState(requestHash);
          }),
          E.tap((deletedRequest) => (deletedRequest ? emitRequestDeleted(requestHash) : E.asVoid)),
          E.catchAll(createErrorHandler(ERROR_CONTEXTS.DELETE_REQUEST))
        )
      )(setLoading, setError);

    const getRequestsByTag = (tag: string): E.Effect<UIRequest[], RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.getRequestsByTag(tag),
          E.flatMap((records) =>
            E.all(
              records.map((record) =>
                processRequestRecord(
                  record,
                  cache,
                  syncCacheToState,
                  undefined,
                  'tag request mapping'
                )
              )
            )
          ),
          E.catchAll(createErrorHandler('Failed to get requests by tag'))
        )
      )(setLoading, setError);

    // ========================================================================
    // STORE OBJECT RETURN
    // ========================================================================

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
      getLatestRequest,
      getAllRequests,
      getUserRequests,
      getOrganizationRequests,
      createRequest,
      updateRequest,
      deleteRequest,
      getRequestsByTag,
      invalidateCache
    };
  });
};

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

// Lazy store instance creation to avoid top-level await issues in tests
let requestsStoreInstance: RequestsStore | null = null;

export const getRequestsStore = async (): Promise<RequestsStore> => {
  if (!requestsStoreInstance) {
    requestsStoreInstance = await pipe(
      createRequestsStore(),
      E.provide(RequestsServiceLive),
      E.provide(CacheServiceLive),
      E.provide(HolochainClientServiceLive),
      E.runPromise
    );
  }
  return requestsStoreInstance;
};

// Export the lazy initialization function as default
export default getRequestsStore;
