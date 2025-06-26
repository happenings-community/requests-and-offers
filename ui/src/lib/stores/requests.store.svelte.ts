/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionHash, Record } from '@holochain/client';
import { RequestsServiceTag, RequestsServiceLive } from '$lib/services/zomes/requests.service';
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
    creator: creator || record.signed_action.hashed.content.author,
    organization,
    created_at: record.signed_action.hashed.content.timestamp,
    updated_at: record.signed_action.hashed.content.timestamp,
    service_type_hashes: serviceTypeHashes
  };
};

/**
 * Maps records array to UIRequest with consistent error handling
 */
const mapRecordsToUIRequests = (
  recordsArray: Record[],
  cache: EntityCacheService<UIRequest>,
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void
): UIRequest[] =>
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
        const requestHash = record.signed_action.hashed.hash;
        const authorPubKey = record.signed_action.hashed.content.author;

        // For initial implementation, use empty service types array
        const serviceTypeHashes: ActionHash[] = [];
        const uiRequest = createUIRequest(record, serviceTypeHashes, authorPubKey, undefined);

        // Cache and sync
        E.runSync(cache.set(requestHash.toString(), uiRequest));
        syncCacheToState(uiRequest, 'add');

        return uiRequest;
      } catch (error) {
        console.error('Error decoding request record:', error);
        return null;
      }
    })
    .filter((request): request is UIRequest => request !== null);

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
  serviceMethod: () => E.Effect<Record[], unknown>,
  targetArray: UIRequest[],
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void,
  cache: EntityCacheService<UIRequest>,
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.map((records) => {
        // Clear target array
        targetArray.length = 0;

        // Process records
        const processedRequests = mapRecordsToUIRequests(records, cache, syncCacheToState);
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
  syncCacheToState: (entity: UIRequest, operation: 'add' | 'update' | 'remove') => void
) => {
  const processCreatedRecord = (record: Record) => {
    const requestHash = record.signed_action.hashed.hash;
    const authorPubKey = record.signed_action.hashed.content.author;

    // For new records, we'll use empty service types initially
    const serviceTypeHashes: ActionHash[] = [];
    const uiRequest = createUIRequest(record, serviceTypeHashes, authorPubKey, undefined);

    E.runSync(cache.set(requestHash.toString(), uiRequest));
    syncCacheToState(uiRequest, 'add');

    return uiRequest;
  };

  return { processCreatedRecord };
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

    const { processCreatedRecord } = createRecordCreationHelper(cache, syncCacheToState);

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
          E.tap((record) => {
            const uiRequest = processCreatedRecord(record);
            return emitRequestCreated(uiRequest);
          }),
          E.mapError((error) => RequestStoreError.fromError(error, ERROR_CONTEXTS.CREATE_REQUEST))
        )
      )(setLoading, setError);

    const getAllRequests = (): E.Effect<UIRequest[], RequestStoreError> =>
      createRequestsFetcher(
        () => requestsService.getAllRequestsRecords(),
        requests,
        ERROR_CONTEXTS.GET_ALL_REQUESTS,
        setLoading,
        setError,
        cache,
        syncCacheToState
      );

    const getRequest = (requestHash: ActionHash): E.Effect<UIRequest | null, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          lookupRequest(requestHash.toString()),
          E.orElse(() =>
            pipe(
              requestsService.getLatestRequestRecord(requestHash),
              E.flatMap((record) => {
                if (!record) return E.succeed(null);
                const uiRequest = processCreatedRecord(record);
                return E.succeed(uiRequest);
              })
            )
          ),
          E.mapError((error) => RequestStoreError.fromError(error, ERROR_CONTEXTS.GET_REQUEST))
        )
      )(setLoading, setError);

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedRequest: RequestInput
    ): E.Effect<Record, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          E.succeed(convertRequestInputForService(updatedRequest)),
          E.flatMap((serviceRequest) =>
            requestsService.updateRequest(originalActionHash, previousActionHash, serviceRequest)
          ),
          E.tap((record) => {
            const uiRequest = processCreatedRecord(record);
            return emitRequestUpdated(uiRequest);
          }),
          E.mapError((error) => RequestStoreError.fromError(error, ERROR_CONTEXTS.UPDATE_REQUEST))
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
        () => requestsService.getUserRequestsRecords(userHash),
        searchResults,
        ERROR_CONTEXTS.GET_USER_REQUESTS,
        setLoading,
        setError,
        cache,
        syncCacheToState
      );

    const getOrganizationRequests = (
      organizationHash: ActionHash
    ): E.Effect<UIRequest[], RequestStoreError> =>
      createRequestsFetcher(
        () => requestsService.getOrganizationRequestsRecords(organizationHash),
        searchResults,
        ERROR_CONTEXTS.GET_ORGANIZATION_REQUESTS,
        setLoading,
        setError,
        cache,
        syncCacheToState
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<UIRequest | null, RequestStoreError> =>
      withLoadingState(() =>
        pipe(
          requestsService.getLatestRequestRecord(originalActionHash),
          E.map((record) => {
            if (!record) return null;
            return processCreatedRecord(record);
          }),
          E.mapError((error) =>
            RequestStoreError.fromError(error, ERROR_CONTEXTS.GET_LATEST_REQUEST)
          )
        )
      )(setLoading, setError);

    const getRequestsByTag = (tag: string): E.Effect<UIRequest[], RequestStoreError> =>
      createRequestsFetcher(
        () => requestsService.getRequestsByTag(tag),
        searchResults,
        ERROR_CONTEXTS.GET_REQUESTS_BY_TAG,
        setLoading,
        setError,
        cache,
        syncCacheToState
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
