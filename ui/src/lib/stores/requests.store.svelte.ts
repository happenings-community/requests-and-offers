/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionHash, Record } from '@holochain/client';
import {
  RequestsServiceTag,
  RequestsServiceLive,
  type RequestsService
} from '$lib/services/zomes/requests.service';
import type { UIRequest } from '$lib/types/ui';
import type { RequestInDHT, RequestInput } from '$lib/types/holochain';
import { decodeRecords } from '$lib/utils';
import {
  actionHashToString,
  stringToActionHash,
  agentPubKeyToString,
  stringToAgentPubKey
} from '$lib/utils/type-bridges';
import usersStore from '$lib/stores/users.store.svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { StoreEventBusLive, StoreEventBusTag } from '$lib/stores/storeEvents';
import type { StoreEvents } from '$lib/stores/storeEvents';
import type { EventBusService } from '$lib/utils/eventBus.effect';
import { Data, Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { RequestStoreError } from '$lib/errors/requests.errors';
import { CacheNotFoundError } from '$lib/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Error context constants for consistent error messaging
const ERROR_CONTEXTS = {
  CREATE_REQUEST: 'Failed to create request',
  GET_REQUEST: 'Failed to get request',
  GET_ALL_REQUESTS: 'Failed to get all requests',
  UPDATE_REQUEST: 'Failed to update request',
  DELETE_REQUEST: 'Failed to delete request',
  GET_USER_REQUESTS: 'Failed to get user requests',
  GET_ORGANIZATION_REQUESTS: 'Failed to get organization requests',
  GET_LATEST_REQUEST: 'Failed to get latest request',
  CHECK_REQUESTS_EXIST: 'Failed to check if requests exist',
  GET_REQUESTS_BY_TAG: 'Failed to get requests by tag',
  DECODE_REQUESTS: 'Failed to decode or process requests',
  EMIT_REQUEST_CREATED: 'Failed to emit request created event',
  EMIT_REQUEST_UPDATED: 'Failed to emit request updated event',
  EMIT_REQUEST_DELETED: 'Failed to emit request deleted event'
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

export type RequestsStore = {
  readonly requests: UIRequest[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIRequest>;

  // Search-related state
  readonly searchResults: UIRequest[];

  getRequest: (requestHash: ActionHash) => E.Effect<UIRequest | null, RequestStoreError>;
  getAllRequests: () => E.Effect<UIRequest[], RequestStoreError>;
  createRequest: (
    request: RequestInput,
    organizationHash?: ActionHash
  ) => E.Effect<Record, RequestStoreError>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInput
  ) => E.Effect<Record, RequestStoreError>;
  deleteRequest: (requestHash: ActionHash) => E.Effect<void, RequestStoreError>;
  hasRequests: () => E.Effect<boolean, RequestStoreError>;
  getUserRequests: (userHash: ActionHash) => E.Effect<UIRequest[], RequestStoreError>;
  getOrganizationRequests: (
    organizationHash: ActionHash
  ) => E.Effect<UIRequest[], RequestStoreError>;
  getLatestRequest: (
    originalActionHash: ActionHash
  ) => E.Effect<UIRequest | null, RequestStoreError>;
  getRequestsByTag: (tag: string) => E.Effect<UIRequest[], RequestStoreError>;
  invalidateCache: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a complete UIRequest from a record with proper type conversion
 */
const createUIRequest = (
  record: Record,
  serviceTypeHashes: ActionHash[] = [],
  creator?: ActionHash,
  organization?: ActionHash
): UIRequest => {
  const decodedEntry = decodeRecords<RequestInDHT>([record])[0];

  return {
    ...decodedEntry,
    original_action_hash: record.signed_action.hashed.hash,
    previous_action_hash: record.signed_action.hashed.hash,
    creator,
    organization,
    created_at: record.signed_action.hashed.content.timestamp,
    updated_at: record.signed_action.hashed.content.timestamp,
    service_type_hashes: serviceTypeHashes
  };
};

/**
 * Asynchronously processes a Holochain record to create a UIRequest.
 * Fetches the creator and organization ActionHashes.
 */
const processRecord = (
  record: Record,
  requestsService: RequestsService
): E.Effect<UIRequest, RequestStoreError> =>
  pipe(
    E.all({
      creator: requestsService.getRequestCreator(record.signed_action.hashed.hash)
      // Future: Add organization fetching here if needed
    }),
    E.map(({ creator }) => {
      // For initial implementation, use empty service types array
      // Service types will be fetched and updated separately
      const serviceTypeHashes: ActionHash[] = [];
      return createUIRequest(record, serviceTypeHashes, creator || undefined, undefined);
    }),
    E.mapError((error) => RequestStoreError.fromError(error, ERROR_CONTEXTS.DECODE_REQUESTS))
  );

/**
 * Maps records array to UIRequest with consistent error handling
 * NOTE: Service types will be empty initially and should be fetched separately
 */
const mapRecordsToUIRequests = (
  recordsArray: E.Effect<Record[], RequestStoreError>,
  requestsService: RequestsService,
  cache: EntityCacheService<UIRequest>,
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void
): E.Effect<UIRequest[], RequestStoreError> =>
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
          .map((record) => processRecord(record, requestsService))
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
    E.mapError((error) =>
      error instanceof RequestStoreError
        ? error
        : RequestStoreError.fromError(error, ERROR_CONTEXTS.DECODE_REQUESTS)
    )
  );

/**
 * Converts UI RequestInput to compatible format for service calls
 * This resolves the type bridge issue between UI types (Uint8Array) and service types (string)
 */
const convertRequestInputForService = (input: RequestInput): any => ({
  ...input,
  service_type_hashes: input.service_type_hashes.map((hash) =>
    typeof hash === 'string' ? hash : actionHashToString(hash)
  )
});

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
const createCacheSyncHelper = (requests: UIRequest[], searchResults: UIRequest[]) => {
  const syncCacheToState = (entity: UIRequest, operation: 'add' | 'update' | 'remove') => {
    const entityKey = entity.original_action_hash?.toString();
    if (!entityKey) return;

    const findAndRemoveFromArray = (array: UIRequest[]) => {
      const index = array.findIndex((item) => item.original_action_hash?.toString() === entityKey);
      if (index !== -1) {
        array.splice(index, 1);
      }
      return index;
    };

    const addToArray = (array: UIRequest[], item: UIRequest) => {
      // Check if item already exists before adding
      const exists = array.some(
        (existing) =>
          existing.original_action_hash?.toString() === item.original_action_hash?.toString()
      );
      if (!exists) {
        array.push(item);
      }
    };

    if (operation === 'remove') {
      findAndRemoveFromArray(requests);
      findAndRemoveFromArray(searchResults);
    } else if (operation === 'add') {
      addToArray(requests, entity);
    } else if (operation === 'update') {
      // Remove old version and add updated version
      findAndRemoveFromArray(requests);
      findAndRemoveFromArray(searchResults);
      addToArray(requests, entity);
    }
  };

  return { syncCacheToState };
};

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

const createEventEmitters = () => {
  const emitRequestCreated = (request: UIRequest): E.Effect<void, never, never> =>
    pipe(
      E.tryPromise({
        try: async () => {
          // Event emission is optional, so we catch and log errors
          try {
            const eventBus = E.runSync(E.serviceOption(StoreEventBusTag));
            if (eventBus._tag === 'Some') {
              eventBus.value.emit('request:created', { request });
            }
          } catch (error) {
            console.warn(ERROR_CONTEXTS.EMIT_REQUEST_CREATED, error);
          }
        },
        catch: () => new Error(ERROR_CONTEXTS.EMIT_REQUEST_CREATED)
      }),
      E.catchAll((error) => {
        console.error(ERROR_CONTEXTS.EMIT_REQUEST_CREATED, error);
        return E.succeed(undefined);
      }),
      E.map(() => undefined)
    ) as E.Effect<void, never, never>;

  const emitRequestUpdated = (request: UIRequest): E.Effect<void, never, never> =>
    pipe(
      E.tryPromise({
        try: async () => {
          try {
            const eventBus = E.runSync(E.serviceOption(StoreEventBusTag));
            if (eventBus._tag === 'Some') {
              eventBus.value.emit('request:updated', { request });
            }
          } catch (error) {
            console.warn(ERROR_CONTEXTS.EMIT_REQUEST_UPDATED, error);
          }
        },
        catch: () => new Error(ERROR_CONTEXTS.EMIT_REQUEST_UPDATED)
      }),
      E.catchAll((error) => {
        console.error(ERROR_CONTEXTS.EMIT_REQUEST_UPDATED, error);
        return E.succeed(undefined);
      }),
      E.map(() => undefined)
    ) as E.Effect<void, never, never>;

  const emitRequestDeleted = (requestHash: ActionHash): E.Effect<void, never, never> =>
    pipe(
      E.tryPromise({
        try: async () => {
          try {
            const eventBus = E.runSync(E.serviceOption(StoreEventBusTag));
            if (eventBus._tag === 'Some') {
              eventBus.value.emit('request:deleted', { requestHash });
            }
          } catch (error) {
            console.warn(ERROR_CONTEXTS.EMIT_REQUEST_DELETED, error);
          }
        },
        catch: () => new Error(ERROR_CONTEXTS.EMIT_REQUEST_DELETED)
      }),
      E.catchAll((error) => {
        console.error(ERROR_CONTEXTS.EMIT_REQUEST_DELETED, error);
        return E.succeed(undefined);
      }),
      E.map(() => undefined)
    ) as E.Effect<void, never, never>;

  return {
    emitRequestCreated,
    emitRequestUpdated,
    emitRequestDeleted
  };
};

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Creates a standardized fetcher for requests with consistent error handling
 */
const createRequestsFetcher = (
  serviceMethod: () => E.Effect<UIRequest[], RequestStoreError>,
  targetArray: UIRequest[],
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  cache: EntityCacheService<UIRequest>,
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void,
  requestsService: RequestsService
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.map((processedRequests) => {
        // Clear target array
        targetArray.length = 0;

        targetArray.push(...processedRequests);

        return processedRequests;
      }),
      E.mapError((error) => RequestStoreError.fromError(error, errorContext))
    )
  )(setLoading, setError);

// ============================================================================
// CACHE LOOKUP HELPERS
// ============================================================================

const createCacheLookupFunction = () => {
  const lookupRequest = (key: string): E.Effect<UIRequest, CacheNotFoundError> =>
    pipe(
      E.fail(new CacheNotFoundError({ key })),
      E.catchAll((error) => E.fail(error))
    );

  return { lookupRequest };
};

// ============================================================================
// RECORD PROCESSING HELPERS
// ============================================================================

const createRecordCreationHelper = (
  cache: EntityCacheService<UIRequest>,
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void,
  requestsService: RequestsService
) => {
  const processCreatedRecord = (record: Record): E.Effect<UIRequest, RequestStoreError> => {
    const requestHash = record.signed_action.hashed.hash;

    // This is now an async operation, so we create an Effect
    const processEffect = pipe(
      requestsService.getRequestCreator(requestHash),
      E.mapError((err) => RequestStoreError.fromError(err, 'processCreatedRecord')),
      E.map((creatorHash) => {
        // For new records, we'll use empty service types initially, but we should fetch them
        const serviceTypeHashes: ActionHash[] = [];
        const uiRequest = createUIRequest(
          record,
          serviceTypeHashes,
          creatorHash || undefined,
          undefined
        );

        E.runSync(cache.set(requestHash.toString(), uiRequest));
        syncCacheToState(uiRequest, 'add');
        return uiRequest;
      })
    );

    return processEffect;
  };

  const processCreatedRecordWithServiceTypes = (
    record: Record
  ): E.Effect<UIRequest, RequestStoreError> => {
    const requestHash = record.signed_action.hashed.hash;

    const processEffect = pipe(
      E.all({
        serviceTypeHashes: requestsService.getServiceTypesForRequest(requestHash),
        creatorHash: requestsService.getRequestCreator(requestHash)
      }),
      E.mapError((err) => RequestStoreError.fromError(err, 'processCreatedRecordWithServiceTypes')),
      E.map(({ serviceTypeHashes, creatorHash }) => {
        const uiRequest = createUIRequest(
          record,
          serviceTypeHashes,
          creatorHash || undefined,
          undefined
        );

        E.runSync(cache.set(requestHash.toString(), uiRequest));
        syncCacheToState(uiRequest, 'add');

        return uiRequest;
      }),
      E.catchAll((error) => {
        console.warn('Failed to fetch service types or creator for request:', error);
        // Fallback to empty service types and no creator
        const uiRequest = createUIRequest(record, [], undefined, undefined);

        E.runSync(cache.set(requestHash.toString(), uiRequest));
        syncCacheToState(uiRequest, 'add');

        return E.succeed(uiRequest);
      })
    );

    return processEffect;
  };

  return { processCreatedRecord, processCreatedRecordWithServiceTypes };
};

// ============================================================================
// SERVICE TYPE FETCHER
// ============================================================================

/**
 * Fetches service types for requests and updates them in cache/state
 */
const createServiceTypeFetcher = (
  requestsService: any, // Will be properly typed in the store
  cache: EntityCacheService<UIRequest>,
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void
) => {
  const fetchServiceTypesForRequests = async (requests: UIRequest[]) => {
    // Only fetch for requests that don't have service types yet
    const requestsNeedingServiceTypes = requests.filter(
      (request) => !request.service_type_hashes || request.service_type_hashes.length === 0
    );

    if (requestsNeedingServiceTypes.length === 0) return;

    for (const request of requestsNeedingServiceTypes) {
      try {
        if (!request.original_action_hash) continue;

        const serviceTypeHashes = (await E.runPromise(
          requestsService.getServiceTypesForRequest(request.original_action_hash)
        )) as ActionHash[];

        if (serviceTypeHashes.length > 0) {
          const updatedRequest = { ...request, service_type_hashes: serviceTypeHashes };
          E.runSync(cache.set(request.original_action_hash.toString(), updatedRequest));
          syncCacheToState(updatedRequest, 'update');
        }
      } catch (error) {
        console.warn('Failed to fetch service types for request:', error);
      }
    }
  };

  return { fetchServiceTypesForRequests };
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

export const createRequestsStore = (): E.Effect<
  RequestsStore,
  never,
  RequestsServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const requestsService = yield* RequestsServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ===== STATE =====

    // Reactive state arrays using Svelte 5 runes
    let requests = $state<UIRequest[]>([]);
    let searchResults = $state<UIRequest[]>([]);
    let loading = $state<boolean>(false);
    let error = $state<string | null>(null);

    // ===== HELPER FUNCTIONS =====

    const setLoading = (value: boolean) => {
      loading = value;
    };

    const setError = (value: string | null) => {
      error = value;
    };

    // Initialize helper modules
    const { syncCacheToState } = createCacheSyncHelper(requests, searchResults);
    const { lookupRequest } = createCacheLookupFunction();
    const { emitRequestCreated, emitRequestUpdated, emitRequestDeleted } = createEventEmitters();

    // Create cache using the cache service
    const cache = yield* cacheService.createEntityCache<UIRequest>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupRequest
    );

    const { processCreatedRecord, processCreatedRecordWithServiceTypes } =
      createRecordCreationHelper(cache, syncCacheToState, requestsService);

    const { fetchServiceTypesForRequests } = createServiceTypeFetcher(
      requestsService,
      cache,
      syncCacheToState
    );

    // ===== STATE MANAGEMENT FUNCTIONS =====

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
      requests.length = 0;
      searchResults.length = 0;
      setError(null);
    };

    // ===== CORE CRUD OPERATIONS =====

    const createRequest = (
      request: RequestInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(convertRequestInputForService(request)),
          E.flatMap((serviceRequest) =>
            requestsService.createRequest(serviceRequest, organizationHash)
          ),
          E.mapError((err) => RequestStoreError.fromError(err, 'createRequest')),
          E.flatMap((record) =>
            pipe(
              processCreatedRecord(record),
              E.tap((uiRequest) => emitRequestCreated(uiRequest))
            )
          ),
          E.map((uiRequest) => uiRequest as unknown as Record) // This is a bit of a hack, but create should return the record
        )
      )(setLoading, setError);

    const getAllRequests = (): E.Effect<UIRequest[], RequestStoreError> =>
      pipe(
        createRequestsFetcher(
          () =>
            mapRecordsToUIRequests(
              pipe(
                requestsService.getAllRequestsRecords(),
                E.mapError((err) => RequestStoreError.fromError(err, 'getAllRequests'))
              ),
              requestsService,
              cache,
              syncCacheToState
            ),
          requests,
          ERROR_CONTEXTS.GET_ALL_REQUESTS,
          setLoading,
          setError,
          cache,
          syncCacheToState,
          requestsService
        ),
        E.flatMap((requests) =>
          pipe(
            E.promise(() => fetchServiceTypesForRequests(requests)),
            E.map(() => requests)
          )
        )
      );

    const getRequest = (requestHash: ActionHash): E.Effect<UIRequest | null, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          lookupRequest(requestHash.toString()),
          E.orElse(() =>
            pipe(
              requestsService.getLatestRequestRecord(requestHash),
              E.mapError((err) => RequestStoreError.fromError(err, 'getLatestRequestRecord')),
              E.flatMap((record) => {
                if (!record) return E.succeed(null);
                return processCreatedRecord(record);
              })
            )
          )
        )
      )(setLoading, setError);

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedRequest: RequestInput
    ): E.Effect<Record, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.updateRequest(
            originalActionHash,
            previousActionHash,
            updatedRequest as any
          ),
          E.mapError((err) => RequestStoreError.fromError(err, 'updateRequest')),
          E.flatMap((record) =>
            pipe(
              processCreatedRecord(record),
              E.tap((uiRequest) => emitRequestUpdated(uiRequest))
            )
          ),
          E.map((uiRequest) => uiRequest as unknown as Record) // This is a bit of a hack, but create should return the record
        )
      )(setLoading, setError);

    const deleteRequest = (requestHash: ActionHash): E.Effect<void, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.deleteRequest(requestHash),
          E.tap(() => {
            // Remove from cache and state
            E.runSync(cache.delete(requestHash.toString()));
            syncCacheToState({ original_action_hash: requestHash } as UIRequest, 'remove');
            return emitRequestDeleted(requestHash);
          }),
          E.map(() => undefined),
          E.mapError((error) => RequestStoreError.fromError(error, ERROR_CONTEXTS.DELETE_REQUEST))
        )
      )(setLoading, setError);

    // ===== SPECIALIZED QUERY OPERATIONS =====

    const getUserRequests = (userHash: ActionHash): E.Effect<UIRequest[], RequestStoreError> =>
      createRequestsFetcher(
        () =>
          mapRecordsToUIRequests(
            pipe(
              requestsService.getUserRequestsRecords(userHash),
              E.mapError((err) => RequestStoreError.fromError(err, 'getUserRequests'))
            ),
            requestsService,
            cache,
            syncCacheToState
          ),
        requests,
        ERROR_CONTEXTS.GET_USER_REQUESTS,
        setLoading,
        setError,
        cache,
        syncCacheToState,
        requestsService
      );

    const getOrganizationRequests = (
      organizationHash: ActionHash
    ): E.Effect<UIRequest[], RequestStoreError> =>
      createRequestsFetcher(
        () =>
          mapRecordsToUIRequests(
            pipe(
              requestsService.getOrganizationRequestsRecords(organizationHash),
              E.mapError((err) => RequestStoreError.fromError(err, 'getOrganizationRequests'))
            ),
            requestsService,
            cache,
            syncCacheToState
          ),
        requests,
        ERROR_CONTEXTS.GET_ORGANIZATION_REQUESTS,
        setLoading,
        setError,
        cache,
        syncCacheToState,
        requestsService
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<UIRequest | null, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.getLatestRequestRecord(originalActionHash),
          E.mapError((err) => RequestStoreError.fromError(err, 'getLatestRequestRecord')),
          E.flatMap((record) => {
            if (!record) return E.succeed(null);
            return processCreatedRecord(record);
          })
        )
      )(setLoading, setError);

    const getRequestsByTag = (tag: string): E.Effect<UIRequest[], RequestStoreError> =>
      createRequestsFetcher(
        () =>
          mapRecordsToUIRequests(
            pipe(
              requestsService.getRequestsByTag(tag),
              E.mapError((err) => RequestStoreError.fromError(err, 'getRequestsByTag'))
            ),
            requestsService,
            cache,
            syncCacheToState
          ),
        searchResults,
        ERROR_CONTEXTS.GET_REQUESTS_BY_TAG,
        setLoading,
        setError,
        cache,
        syncCacheToState,
        requestsService
      );

    const hasRequests = (): E.Effect<boolean, RequestStoreError> =>
      pipe(
        requestsService.getAllRequestsRecords(),
        E.map((records) => records.length > 0),
        E.mapError((error) =>
          RequestStoreError.fromError(error, ERROR_CONTEXTS.CHECK_REQUESTS_EXIST)
        )
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

/**
 * Lazy initialization pattern following established memory guidelines
 * This prevents "Cannot use 'in' operator to search for 'Symbol(effect/ManagedRuntime)' in undefined" errors
 */
let _store: RequestsStore | null = null;

const getRequestsStore = (): RequestsStore => {
  if (!_store) {
    _store = pipe(
      createRequestsStore(),
      E.provide(RequestsServiceLive),
      E.provide(CacheServiceLive),
      E.provide(StoreEventBusLive),
      E.provide(HolochainClientLive),
      E.runSync
    );
  }
  return _store;
};

// Export store instance with proxy pattern for lazy initialization
const requestsStore = new Proxy({} as RequestsStore, {
  get(_target, prop) {
    const store = getRequestsStore();
    const value = store[prop as keyof RequestsStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default requestsStore;
