/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionHash, Record } from '@holochain/client';
import {
  ServiceTypesServiceTag,
  ServiceTypesServiceLive
} from '$lib/services/zomes/serviceTypes.service';
import type {
  GetServiceTypeForEntityInput,
  ServiceTypesService
} from '$lib/services/zomes/serviceTypes.service';
import type { UIServiceType } from '$lib/types/ui';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { decodeRecord, decodeRecords } from '$lib/utils';
import { decode } from '@msgpack/msgpack';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { StoreEventBusLive, StoreEventBusTag, type StoreEvents } from '$lib/stores/storeEvents';
import { Effect as E, pipe, Schema } from 'effect';
import { ServiceTypeStoreError } from '$lib/errors/service-types.errors';
import { CacheNotFoundError } from '$lib/errors';
import { HolochainClientLive } from '$lib/services/holochainClient.service';

// ============================================================================
// CONSTANTS
// ============================================================================
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes - service types change less frequently
const DEFAULT_STATUS: UIServiceType['status'] = 'approved';

const ERROR_CONTEXTS = {
  CREATE: 'Failed to create service type',
  UPDATE: 'Failed to update service type',
  DELETE: 'Failed to delete service type',
  GET: 'Failed to get service type',
  GET_ALL: 'Failed to get all service types',
  GET_PENDING: 'Failed to get pending service types',
  GET_APPROVED: 'Failed to get approved service types',
  GET_REJECTED: 'Failed to get rejected service types',
  SUGGEST: 'Failed to suggest service type',
  APPROVE: 'Failed to approve service type',
  REJECT: 'Failed to reject service type',
  HAS_SERVICE_TYPES: 'Failed to check if service types exist',
  GET_FOR_ENTITY: 'Failed to get service types for entity',
  DETERMINE_STATUS: 'Failed to determine service type status',
  GET_TAGS: 'Failed to get all tags',
  LOAD_TAGS: 'Failed to load all tags',
  GET_BY_TAG: 'Failed to get service types by tag',
  GET_BY_TAGS: 'Failed to get service types by tags',
  SEARCH_BY_PREFIX: 'Failed to search service types by tag prefix',
  GET_TAG_STATISTICS: 'Failed to get tag statistics'
} as const;

// ============================================================================
// STORE TYPE DEFINITION
// ============================================================================
export type ServiceTypesStore = {
  readonly serviceTypes: UIServiceType[];
  readonly pendingServiceTypes: UIServiceType[];
  readonly approvedServiceTypes: UIServiceType[];
  readonly rejectedServiceTypes: UIServiceType[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIServiceType>;

  // Tag-related state
  readonly allTags: string[];
  readonly selectedTags: string[];
  readonly tagStatistics: Array<[string, number]>;
  readonly searchResults: UIServiceType[];

  getServiceType: (
    serviceTypeHash: ActionHash
  ) => E.Effect<UIServiceType | null, ServiceTypeStoreError>;
  getAllServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeStoreError>;
  createServiceType: (serviceType: ServiceTypeInDHT) => E.Effect<Record, ServiceTypeStoreError>;
  updateServiceType: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedServiceType: ServiceTypeInDHT
  ) => E.Effect<Record, ServiceTypeStoreError>;
  deleteServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeStoreError>;
  hasServiceTypes: () => E.Effect<boolean, ServiceTypeStoreError>;
  getServiceTypesForEntity: (
    input: GetServiceTypeForEntityInput
  ) => E.Effect<ActionHash[], ServiceTypeStoreError>;
  invalidateCache: () => void;

  // Status management methods
  suggestServiceType: (serviceType: ServiceTypeInDHT) => E.Effect<Record, ServiceTypeStoreError>;
  approveServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeStoreError>;
  rejectServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeStoreError>;
  getPendingServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeStoreError>;
  getApprovedServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeStoreError>;
  getRejectedServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeStoreError>;

  // Tag-related methods
  loadAllTags: () => E.Effect<string[], ServiceTypeStoreError>;
  getAllTags: () => E.Effect<string[], ServiceTypeStoreError>;
  getServiceTypesByTag: (tag: string) => E.Effect<UIServiceType[], ServiceTypeStoreError>;
  getServiceTypesByTags: (tags: string[]) => E.Effect<UIServiceType[], ServiceTypeStoreError>;
  searchServiceTypesByTagPrefix: (
    prefix: string
  ) => E.Effect<UIServiceType[], ServiceTypeStoreError>;
  getTagStatistics: () => E.Effect<Array<[string, number]>, ServiceTypeStoreError>;
  setSelectedTags: (tags: string[]) => void;
  addSelectedTag: (tag: string) => void;
  removeSelectedTag: (tag: string) => void;
  clearSelectedTags: () => void;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a UIServiceType from a Record with proper metadata
 */
const createUIServiceType = (
  record: Record,
  status: UIServiceType['status'] = DEFAULT_STATUS
): UIServiceType => ({
  ...decodeRecords<ServiceTypeInDHT>([record])[0],
  original_action_hash: record.signed_action.hashed.hash,
  previous_action_hash: record.signed_action.hashed.hash,
  creator: record.signed_action.hashed.content.author,
  created_at: record.signed_action.hashed.content.timestamp,
  updated_at: record.signed_action.hashed.content.timestamp,
  status
});

/**
 * Maps an array of Records to UIServiceType array with consistent error handling
 */
const mapRecordsToUIServiceTypes = (
  recordsArray: Record[],
  status: UIServiceType['status']
): UIServiceType[] =>
  recordsArray
    .filter(
      (record) =>
        record &&
        record.signed_action &&
        record.signed_action.hashed &&
        record.entry &&
        (record.entry as any).Present &&
        (record.entry as any).Present.entry
    )
    .map((record) => createUIServiceType(record, status))
    .filter((serviceType): serviceType is UIServiceType => serviceType !== null);

/**
 * Creates a cache lookup function for service types
 */
const createCacheLookupFunction =
  (serviceTypesService: ServiceTypesService) =>
  (key: string): E.Effect<UIServiceType, CacheNotFoundError> =>
    pipe(
      E.tryPromise({
        try: async () => {
          const hash = new Uint8Array(Buffer.from(key, 'base64'));
          const record = await E.runPromise(serviceTypesService.getServiceType(hash));

          if (!record) {
            throw new Error(`ServiceType not found for key: ${key}`);
          }

          return createUIServiceType(record);
        },
        catch: () => new CacheNotFoundError({ key })
      }),
      E.mapError(() => new CacheNotFoundError({ key }))
    );

// ============================================================================
// STATE MANAGEMENT HELPERS
// ============================================================================

/**
 * Handles loading state management for store operations
 */
const withLoadingState = <T, E>(
  effect: E.Effect<T, E>,
  loadingState: { loading: boolean; error: string | null }
): E.Effect<T, E> =>
  pipe(
    E.sync(() => {
      loadingState.loading = true;
      loadingState.error = null;
    }),
    E.flatMap(() => effect),
    E.tap(() =>
      E.sync(() => {
        loadingState.loading = false;
      })
    ),
    E.tapError(() =>
      E.sync(() => {
        loadingState.loading = false;
      })
    )
  );

/**
 * Syncs cache entity with local state arrays
 */
const createCacheSyncHelper =
  (
    serviceTypes: UIServiceType[],
    pendingServiceTypes: UIServiceType[],
    approvedServiceTypes: UIServiceType[],
    rejectedServiceTypes: UIServiceType[]
  ) =>
  (entity: UIServiceType, operation: 'add' | 'update' | 'remove') => {
    const findIndex = (array: UIServiceType[]) =>
      array.findIndex(
        (st) => st.original_action_hash?.toString() === entity.original_action_hash?.toString()
      );

    const updateArray = (array: UIServiceType[]) => {
      const index = findIndex(array);
      switch (operation) {
        case 'add':
        case 'update':
          if (index !== -1) {
            array[index] = entity;
          } else {
            array.push(entity);
          }
          break;
        case 'remove':
          if (index !== -1) {
            array.splice(index, 1);
          }
          break;
      }
    };

    // Update main array
    updateArray(serviceTypes);

    // Update status-specific arrays based on entity status
    if (operation === 'add' || operation === 'update') {
      // Remove from other status arrays first
      [pendingServiceTypes, approvedServiceTypes, rejectedServiceTypes].forEach((arr) => {
        if (arr !== getStatusArray(entity.status)) {
          const idx = findIndex(arr);
          if (idx !== -1) arr.splice(idx, 1);
        }
      });

      // Add to correct status array
      const statusArray = getStatusArray(entity.status);
      const statusIndex = findIndex(statusArray);
      if (statusIndex === -1) {
        statusArray.push(entity);
      }
    }

    function getStatusArray(status: UIServiceType['status']) {
      switch (status) {
        case 'pending':
          return pendingServiceTypes;
        case 'approved':
          return approvedServiceTypes;
        case 'rejected':
          return rejectedServiceTypes;
        default:
          return approvedServiceTypes;
      }
    }
  };

/**
 * Creates a function to remove service type from all state arrays
 */
const createRemoveFromAllArrays =
  (
    serviceTypes: UIServiceType[],
    pendingServiceTypes: UIServiceType[],
    approvedServiceTypes: UIServiceType[],
    rejectedServiceTypes: UIServiceType[]
  ) =>
  (serviceTypeHash: ActionHash) => {
    const removeFromArray = (array: UIServiceType[]) => {
      const index = array.findIndex(
        (serviceType) => serviceType.original_action_hash?.toString() === serviceTypeHash.toString()
      );
      if (index !== -1) {
        array.splice(index, 1);
        return true;
      }
      return false;
    };

    // Remove from all arrays
    removeFromArray(serviceTypes);
    removeFromArray(pendingServiceTypes);
    removeFromArray(approvedServiceTypes);
    removeFromArray(rejectedServiceTypes);
  };

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Creates standardized event emission functions
 */
const createEventEmitters = () => {
  const emitServiceTypeEvent = <T>(
    eventName: keyof StoreEvents,
    payload: T
  ): E.Effect<void, never> =>
    E.ignore(
      E.gen(function* () {
        const eventBus = yield* StoreEventBusTag;
        yield* eventBus.emit(eventName as any, payload);
      }).pipe(
        E.catchAll(() => E.void),
        E.provide(StoreEventBusLive)
      )
    ) as E.Effect<void, never>;

  return {
    emitServiceTypeCreated: (serviceType: UIServiceType) =>
      emitServiceTypeEvent('serviceType:created', { serviceType }),

    emitServiceTypeUpdated: (serviceType: UIServiceType) =>
      emitServiceTypeEvent('serviceType:updated', { serviceType }),

    emitServiceTypeSuggested: (serviceType: UIServiceType) =>
      emitServiceTypeEvent('serviceType:suggested', { serviceType }),

    emitServiceTypeApproved: (serviceTypeHash: ActionHash) =>
      emitServiceTypeEvent('serviceType:approved', { serviceTypeHash }),

    emitServiceTypeRejected: (serviceTypeHash: ActionHash) =>
      emitServiceTypeEvent('serviceType:rejected', { serviceTypeHash }),

    emitServiceTypeDeleted: (serviceTypeHash: ActionHash) =>
      emitServiceTypeEvent('serviceType:deleted', { serviceTypeHash })
  };
};

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Determines service type status dynamically by checking all status arrays
 */
const createStatusDeterminer =
  (serviceTypesService: ServiceTypesService) =>
  (serviceTypeHash: ActionHash): E.Effect<UIServiceType['status'], ServiceTypeStoreError> =>
    pipe(
      E.all([
        serviceTypesService.getPendingServiceTypes(),
        serviceTypesService.getApprovedServiceTypes(),
        serviceTypesService.getRejectedServiceTypes()
      ]),
      E.map(([pendingRecords, approvedRecords, rejectedRecords]: any[]) => {
        const hashString = serviceTypeHash.toString();

        if (
          pendingRecords.some((r: any) => r.signed_action.hashed.hash.toString() === hashString)
        ) {
          return 'pending' as const;
        } else if (
          approvedRecords.some((r: any) => r.signed_action.hashed.hash.toString() === hashString)
        ) {
          return 'approved' as const;
        } else if (
          rejectedRecords.some((r: any) => r.signed_action.hashed.hash.toString() === hashString)
        ) {
          return 'rejected' as const;
        }

        return DEFAULT_STATUS;
      }),
      E.catchAll((error) =>
        E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.DETERMINE_STATUS))
      )
    );

/**
 * Handles graceful connection errors for service type operations
 */
const handleConnectionError = <T>(
  effect: E.Effect<T, any>,
  fallbackValue: T,
  context: string
): E.Effect<T, ServiceTypeStoreError> =>
  pipe(
    effect,
    E.catchAll((error) => {
      const errorMessage = String(error);
      if (errorMessage.includes('Client not connected')) {
        console.warn(`Holochain client not connected for ${context}, using fallback`);
        return E.succeed(fallbackValue);
      }
      return E.fail(ServiceTypeStoreError.fromError(error, context));
    })
  );

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * Factory function to create a service types store as an Effect
 * @returns An Effect that creates a service types store with state and methods
 */
export const createServiceTypesStore = (): E.Effect<
  ServiceTypesStore,
  never,
  ServiceTypesServiceTag | CacheServiceTag
> =>
  E.gen(function* () {
    const serviceTypesService = yield* ServiceTypesServiceTag;
    const cacheService = yield* CacheServiceTag;

    // ========================================================================
    // STATE INITIALIZATION
    // ========================================================================
    const serviceTypes: UIServiceType[] = $state([]);
    const pendingServiceTypes: UIServiceType[] = $state([]);
    const approvedServiceTypes: UIServiceType[] = $state([]);
    const rejectedServiceTypes: UIServiceType[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // Tag-related state
    const allTags: string[] = $state([]);
    const selectedTags: string[] = $state([]);
    const tagStatistics: Array<[string, number]> = $state([]);
    const searchResults: UIServiceType[] = $state([]);

    // ========================================================================
    // HELPER FUNCTION INITIALIZATION
    // ========================================================================
    const loadingState = { loading, error };
    const cacheLookup = createCacheLookupFunction(serviceTypesService);
    const syncCacheToState = createCacheSyncHelper(
      serviceTypes,
      pendingServiceTypes,
      approvedServiceTypes,
      rejectedServiceTypes
    );
    const removeFromAllArrays = createRemoveFromAllArrays(
      serviceTypes,
      pendingServiceTypes,
      approvedServiceTypes,
      rejectedServiceTypes
    );
    const eventEmitters = createEventEmitters();
    const determineServiceTypeStatus = createStatusDeterminer(serviceTypesService);

    // ========================================================================
    // CACHE INITIALIZATION
    // ========================================================================
    const cache = yield* cacheService.createEntityCache<UIServiceType>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      cacheLookup
    );

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    // ========================================================================
    // CORE CRUD OPERATIONS
    // ========================================================================

    const createServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.createServiceType(serviceType),
          E.map((record) => {
            const newServiceType = createUIServiceType(record, 'pending');

            // Cache and sync state
            E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newServiceType));
            syncCacheToState(newServiceType, 'add');

            return { record, newServiceType };
          }),
          E.tap(({ newServiceType }) => eventEmitters.emitServiceTypeCreated(newServiceType)),
          E.map(({ record }) => record),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.CREATE))
          )
        ),
        loadingState
      );

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<UIServiceType | null, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          cache.get(serviceTypeHash.toString()),
          E.catchAll(() => E.succeed(null as UIServiceType | null)),
          E.flatMap((cachedServiceType) => {
            if (cachedServiceType) {
              return E.succeed(cachedServiceType);
            }

            // Fetch from service and determine status
            return pipe(
              serviceTypesService.getServiceType(serviceTypeHash),
              E.flatMap((record) => {
                if (!record) {
                  return E.succeed(null);
                }

                return pipe(
                  determineServiceTypeStatus(serviceTypeHash),
                  E.map((status) => {
                    const serviceType = createUIServiceType(record, status);
                    E.runSync(cache.set(serviceTypeHash.toString(), serviceType));
                    return serviceType;
                  }),
                  E.catchAll(() => E.succeed(null as UIServiceType | null))
                );
              }),
              E.catchAll(() => E.succeed(null as UIServiceType | null))
            );
          }),
          E.catchAll((error) => E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET)))
        ),
        loadingState
      );

    const getAllServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(
        handleConnectionError(
          pipe(
            serviceTypesService.getAllServiceTypes(),
            E.flatMap((result: { pending: Record[]; approved: Record[]; rejected: Record[] }) =>
              E.try({
                try: () => {
                  const pendingUiServiceTypes = mapRecordsToUIServiceTypes(
                    result.pending,
                    'pending'
                  );
                  const approvedUiServiceTypes = mapRecordsToUIServiceTypes(
                    result.approved,
                    'approved'
                  );
                  const rejectedUiServiceTypes = mapRecordsToUIServiceTypes(
                    result.rejected,
                    'rejected'
                  );

                  const allNewServiceTypes = [
                    ...pendingUiServiceTypes,
                    ...approvedUiServiceTypes,
                    ...rejectedUiServiceTypes
                  ];

                  // Update cache and sync state
                  allNewServiceTypes.forEach((st) => {
                    E.runSync(cache.set(st.original_action_hash?.toString() || '', st));
                    syncCacheToState(st, 'add');
                  });

                  return allNewServiceTypes;
                },
                catch: (unknownError) =>
                  ServiceTypeStoreError.fromError(
                    unknownError,
                    'Failed to decode or process service types'
                  )
              })
            )
          ),
          [],
          ERROR_CONTEXTS.GET_ALL
        ),
        loadingState
      );

    const updateServiceType = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.updateServiceType(
            originalActionHash,
            previousActionHash,
            updatedServiceType
          ),
          E.flatMap((newActionHash) =>
            pipe(
              serviceTypesService.getServiceType(newActionHash),
              E.map((record) => {
                if (!record) return { record: null, updatedServiceType: null };

                const updatedUIServiceType = createUIServiceType(record, DEFAULT_STATUS);
                updatedUIServiceType.original_action_hash = originalActionHash;
                updatedUIServiceType.previous_action_hash = newActionHash;
                updatedUIServiceType.updated_at = Date.now();

                // Update cache and sync state
                E.runSync(cache.set(originalActionHash.toString(), updatedUIServiceType));
                syncCacheToState(updatedUIServiceType, 'update');

                return { record, updatedServiceType: updatedUIServiceType };
              })
            )
          ),
          E.tap(({ updatedServiceType }) =>
            updatedServiceType ? eventEmitters.emitServiceTypeUpdated(updatedServiceType) : E.asVoid
          ),
          E.map(({ record }) => record!),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.UPDATE))
          )
        ),
        loadingState
      );

    const deleteServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.deleteServiceType(serviceTypeHash),
          E.tap(() => {
            E.runSync(cache.invalidate(serviceTypeHash.toString()));
            removeFromAllArrays(serviceTypeHash);
          }),
          E.tap(() => eventEmitters.emitServiceTypeDeleted(serviceTypeHash)),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.DELETE))
          )
        ),
        loadingState
      );

    const hasServiceTypes = (): E.Effect<boolean, ServiceTypeStoreError> =>
      handleConnectionError(
        pipe(
          getAllServiceTypes(),
          E.map((serviceTypes) => serviceTypes.length > 0)
        ),
        false,
        ERROR_CONTEXTS.HAS_SERVICE_TYPES
      );

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getServiceTypesForEntity(input),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_FOR_ENTITY))
          )
        ),
        loadingState
      );

    // ========================================================================
    // STATUS MANAGEMENT OPERATIONS
    // ========================================================================

    const getPendingServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getPendingServiceTypes(),
          E.map((records) => {
            const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'pending');
            pendingServiceTypes.splice(0, pendingServiceTypes.length, ...uiServiceTypes);
            return uiServiceTypes;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_PENDING))
          )
        ),
        loadingState
      );

    const getApprovedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getApprovedServiceTypes(),
          E.map((records) => {
            const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'approved');
            approvedServiceTypes.splice(0, approvedServiceTypes.length, ...uiServiceTypes);
            return uiServiceTypes;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_APPROVED))
          )
        ),
        loadingState
      );

    const getRejectedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getRejectedServiceTypes(),
          E.map((records) => {
            const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'rejected');
            rejectedServiceTypes.splice(0, rejectedServiceTypes.length, ...uiServiceTypes);
            return uiServiceTypes;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_REJECTED))
          )
        ),
        loadingState
      );

    const suggestServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.suggestServiceType(serviceType),
          E.map((record) => {
            const newServiceType = createUIServiceType(record, 'pending');

            // Cache and sync state
            E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newServiceType));
            syncCacheToState(newServiceType, 'add');

            return { record, newServiceType };
          }),
          E.tap(({ newServiceType }) => eventEmitters.emitServiceTypeSuggested(newServiceType)),
          E.map(({ record }) => record),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.SUGGEST))
          )
        ),
        loadingState
      );

    const approveServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.approveServiceType(serviceTypeHash),
          E.tap(() => {
            // Move service type to approved status
            const hashString = serviceTypeHash.toString();

            // Check pending first
            const pendingIndex = pendingServiceTypes.findIndex(
              (st) => st.original_action_hash?.toString() === hashString
            );
            if (pendingIndex !== -1) {
              const serviceType = pendingServiceTypes.splice(pendingIndex, 1)[0];
              if (serviceType) {
                serviceType.status = 'approved';
                approvedServiceTypes.push(serviceType);
                E.runSync(cache.set(hashString, serviceType));
              }
            }

            // Check rejected
            const rejectedIndex = rejectedServiceTypes.findIndex(
              (st) => st.original_action_hash?.toString() === hashString
            );
            if (rejectedIndex !== -1) {
              const serviceType = rejectedServiceTypes.splice(rejectedIndex, 1)[0];
              if (serviceType) {
                serviceType.status = 'approved';
                approvedServiceTypes.push(serviceType);
                E.runSync(cache.set(hashString, serviceType));
              }
            }
          }),
          E.tap(() => eventEmitters.emitServiceTypeApproved(serviceTypeHash)),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.APPROVE))
          )
        ),
        loadingState
      );

    const rejectServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.rejectServiceType(serviceTypeHash),
          E.tap(() => {
            // Move from pending to rejected
            const pendingIndex = pendingServiceTypes.findIndex(
              (st) => st.original_action_hash?.toString() === serviceTypeHash.toString()
            );
            if (pendingIndex !== -1) {
              const serviceType = pendingServiceTypes.splice(pendingIndex, 1)[0];
              if (serviceType) {
                serviceType.status = 'rejected';
                rejectedServiceTypes.push(serviceType);
                E.runSync(
                  cache.set(serviceType.original_action_hash?.toString() || '', serviceType)
                );
              }
            }
          }),
          E.tap(() => eventEmitters.emitServiceTypeRejected(serviceTypeHash)),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.REJECT))
          )
        ),
        loadingState
      );

    // ========================================================================
    // TAG-RELATED OPERATIONS
    // ========================================================================

    const getAllTags = (): E.Effect<string[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getAllServiceTypeTags(),
          E.map((tags) => {
            allTags.splice(0, allTags.length, ...tags);
            return tags;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_TAGS))
          )
        ),
        loadingState
      );

    const loadAllTags = (): E.Effect<string[], ServiceTypeStoreError> =>
      pipe(
        serviceTypesService.getAllServiceTypeTags(),
        E.tap((tags) =>
          E.sync(() => {
            allTags.splice(0, allTags.length, ...tags);
          })
        ),
        E.mapError((err) => ServiceTypeStoreError.fromError(err, ERROR_CONTEXTS.LOAD_TAGS))
      );

    const getServiceTypesByTag = (tag: string): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getServiceTypesByTag(tag),
          E.map((records) => {
            const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'approved');
            searchResults.splice(0, searchResults.length, ...uiServiceTypes);
            return uiServiceTypes;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_BY_TAG))
          )
        ),
        loadingState
      );

    const getServiceTypesByTags = (
      tags: string[]
    ): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getServiceTypesByTags(tags),
          E.map((records) => {
            const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'approved');
            searchResults.splice(0, searchResults.length, ...uiServiceTypes);
            return uiServiceTypes;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_BY_TAGS))
          )
        ),
        loadingState
      );

    const searchServiceTypesByTagPrefix = (
      prefix: string
    ): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.searchServiceTypesByTagPrefix(prefix),
          E.map((records) => {
            const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'approved');
            searchResults.splice(0, searchResults.length, ...uiServiceTypes);
            return uiServiceTypes;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.SEARCH_BY_PREFIX))
          )
        ),
        loadingState
      );

    const getTagStatistics = (): E.Effect<Array<[string, number]>, ServiceTypeStoreError> =>
      withLoadingState(
        pipe(
          serviceTypesService.getTagStatistics(),
          E.map((statistics) => {
            tagStatistics.splice(0, tagStatistics.length, ...statistics);
            return statistics;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_TAG_STATISTICS))
          )
        ),
        loadingState
      );

    // ========================================================================
    // TAG SELECTION OPERATIONS
    // ========================================================================

    const setSelectedTags = (tags: string[]): void => {
      selectedTags.splice(0, selectedTags.length, ...tags);
    };

    const addSelectedTag = (tag: string): void => {
      if (!selectedTags.includes(tag)) {
        selectedTags.push(tag);
      }
    };

    const removeSelectedTag = (tag: string): void => {
      const index = selectedTags.indexOf(tag);
      if (index !== -1) {
        selectedTags.splice(index, 1);
      }
    };

    const clearSelectedTags = (): void => {
      selectedTags.splice(0, selectedTags.length);
    };

    // ========================================================================
    // STORE INTERFACE RETURN
    // ========================================================================

    return {
      get serviceTypes() {
        return serviceTypes;
      },
      get pendingServiceTypes() {
        return pendingServiceTypes;
      },
      get approvedServiceTypes() {
        return approvedServiceTypes;
      },
      get rejectedServiceTypes() {
        return rejectedServiceTypes;
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
      get allTags() {
        return allTags;
      },
      get selectedTags() {
        return selectedTags;
      },
      get tagStatistics() {
        return tagStatistics;
      },
      get searchResults() {
        return searchResults;
      },

      // Core CRUD operations
      getServiceType,
      getAllServiceTypes,
      createServiceType,
      updateServiceType,
      deleteServiceType,
      hasServiceTypes,
      getServiceTypesForEntity,
      invalidateCache,

      // Status management operations
      suggestServiceType,
      approveServiceType,
      rejectServiceType,
      getPendingServiceTypes,
      getApprovedServiceTypes,
      getRejectedServiceTypes,

      // Tag-related operations
      getAllTags,
      loadAllTags,
      getServiceTypesByTag,
      getServiceTypesByTags,
      searchServiceTypesByTagPrefix,
      getTagStatistics,

      // Tag selection operations
      setSelectedTags,
      addSelectedTag,
      removeSelectedTag,
      clearSelectedTags
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

// Create and export the singleton store instance by running the Effect
const serviceTypesStore = await pipe(
  createServiceTypesStore(),
  E.provide(ServiceTypesServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive),
  E.runPromise
);

export default serviceTypesStore;
