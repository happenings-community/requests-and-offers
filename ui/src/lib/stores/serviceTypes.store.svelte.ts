/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionHash, Record } from '@holochain/client';
import { decodeHashFromBase64 } from '@holochain/client';
import {
  ServiceTypesServiceTag,
  ServiceTypesServiceLive
} from '$lib/services/zomes/serviceTypes.service';
import type { GetServiceTypeForEntityInput } from '$lib/services/zomes/serviceTypes.service';
import type { UIServiceType } from '$lib/types/ui';
import type { ServiceTypeInDHT } from '$lib/types/holochain';

import { decode } from '@msgpack/msgpack';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { storeEventBus } from '$lib/stores/storeEvents';
import { Effect as E, pipe } from 'effect';
import { HolochainClientLive } from '$lib/services/holochainClient.service';
import { ServiceTypeStoreError } from '$lib/errors/service-types.errors';
import { CacheNotFoundError } from '$lib/errors';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes (longer than requests since service types change less frequently)

// Error context constants for consistent error messaging
const ERROR_CONTEXTS = {
  CREATE_SERVICE_TYPE: 'Failed to create service type',
  GET_SERVICE_TYPE: 'Failed to get service type',
  GET_ALL_SERVICE_TYPES: 'Failed to get all service types',
  UPDATE_SERVICE_TYPE: 'Failed to update service type',
  DELETE_SERVICE_TYPE: 'Failed to delete service type',
  SUGGEST_SERVICE_TYPE: 'Failed to suggest service type',
  APPROVE_SERVICE_TYPE: 'Failed to approve service type',
  REJECT_SERVICE_TYPE: 'Failed to reject service type',
  GET_PENDING_SERVICE_TYPES: 'Failed to get pending service types',
  GET_APPROVED_SERVICE_TYPES: 'Failed to get approved service types',
  GET_REJECTED_SERVICE_TYPES: 'Failed to get rejected service types',
  GET_SERVICE_TYPES_FOR_ENTITY: 'Failed to get service types for entity',
  GET_ALL_TAGS: 'Failed to get all tags',
  GET_SERVICE_TYPES_BY_TAG: 'Failed to get service types by tag',
  GET_SERVICE_TYPES_BY_TAGS: 'Failed to get service types by tags',
  SEARCH_SERVICE_TYPES_BY_TAG_PREFIX: 'Failed to search service types by tag prefix',
  GET_TAG_STATISTICS: 'Failed to get tag statistics',
  DETERMINE_SERVICE_TYPE_STATUS: 'Failed to determine service type status',
  CHECK_SERVICE_TYPES_EXIST: 'Failed to check if service types exist',
  DECODE_SERVICE_TYPES: 'Failed to decode or process service types'
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
 * Creates a complete UIServiceType from a record
 */
const createUIServiceType = (
  record: Record,
  status: 'pending' | 'approved' | 'rejected' = 'approved'
): UIServiceType => {
  const decodedEntry = decode((record.entry as HolochainEntry).Present.entry) as ServiceTypeInDHT;

  return {
    ...decodedEntry,
    original_action_hash: record.signed_action.hashed.hash,
    previous_action_hash: record.signed_action.hashed.hash,
    creator: record.signed_action.hashed.content.author,
    created_at: record.signed_action.hashed.content.timestamp,
    updated_at: record.signed_action.hashed.content.timestamp,
    status
  };
};

/**
 * Maps records array to UIServiceType with consistent error handling
 */
const mapRecordsToUIServiceTypes = (
  recordsArray: Record[],
  status: 'pending' | 'approved' | 'rejected'
): UIServiceType[] =>
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
        return createUIServiceType(record, status);
      } catch (error) {
        console.error('Error decoding service type record:', error);
        return null;
      }
    })
    .filter((serviceType): serviceType is UIServiceType => serviceType !== null);

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
const createCacheSyncHelper = (
  serviceTypes: UIServiceType[],
  pendingServiceTypes: UIServiceType[],
  approvedServiceTypes: UIServiceType[],
  rejectedServiceTypes: UIServiceType[]
) => {
  const syncCacheToState = (entity: UIServiceType, operation: 'add' | 'update' | 'remove') => {
    const hash = entity.original_action_hash?.toString();
    if (!hash) return;

    const findAndRemoveFromArray = (array: UIServiceType[]) => {
      const index = array.findIndex((st) => st.original_action_hash?.toString() === hash);
      if (index !== -1) {
        return array.splice(index, 1)[0];
      }
      return null;
    };

    const addToArray = (array: UIServiceType[], item: UIServiceType) => {
      const existingIndex = array.findIndex((st) => st.original_action_hash?.toString() === hash);
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
        findAndRemoveFromArray(serviceTypes);
        findAndRemoveFromArray(pendingServiceTypes);
        findAndRemoveFromArray(approvedServiceTypes);
        findAndRemoveFromArray(rejectedServiceTypes);

        // Add to appropriate arrays
        addToArray(serviceTypes, entity);
        switch (entity.status) {
          case 'pending':
            addToArray(pendingServiceTypes, entity);
            break;
          case 'approved':
            addToArray(approvedServiceTypes, entity);
            break;
          case 'rejected':
            addToArray(rejectedServiceTypes, entity);
            break;
        }
        break;
      case 'remove':
        findAndRemoveFromArray(serviceTypes);
        findAndRemoveFromArray(pendingServiceTypes);
        findAndRemoveFromArray(approvedServiceTypes);
        findAndRemoveFromArray(rejectedServiceTypes);
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
  const emitServiceTypeCreated = (serviceType: UIServiceType): void => {
    try {
      storeEventBus.emit('serviceType:created', { serviceType });
    } catch (error) {
      console.error('Failed to emit serviceType:created event:', error);
    }
  };

  const emitServiceTypeUpdated = (serviceType: UIServiceType): void => {
    try {
      storeEventBus.emit('serviceType:updated', { serviceType });
    } catch (error) {
      console.error('Failed to emit serviceType:updated event:', error);
    }
  };

  const emitServiceTypeSuggested = (serviceType: UIServiceType): void => {
    try {
      storeEventBus.emit('serviceType:suggested', { serviceType });
    } catch (error) {
      console.error('Failed to emit serviceType:suggested event:', error);
    }
  };

  const emitServiceTypeApproved = (serviceTypeHash: ActionHash): void => {
    try {
      storeEventBus.emit('serviceType:approved', { serviceTypeHash });
    } catch (error) {
      console.error('Failed to emit serviceType:approved event:', error);
    }
  };

  const emitServiceTypeRejected = (serviceTypeHash: ActionHash): void => {
    try {
      storeEventBus.emit('serviceType:rejected', { serviceTypeHash });
    } catch (error) {
      console.error('Failed to emit serviceType:rejected event:', error);
    }
  };

  const emitServiceTypeDeleted = (serviceTypeHash: ActionHash): void => {
    try {
      storeEventBus.emit('serviceType:deleted', { serviceTypeHash });
    } catch (error) {
      console.error('Failed to emit serviceType:deleted event:', error);
    }
  };

  return {
    emitServiceTypeCreated,
    emitServiceTypeUpdated,
    emitServiceTypeSuggested,
    emitServiceTypeApproved,
    emitServiceTypeRejected,
    emitServiceTypeDeleted
  };
};

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Creates a standardized function for fetching and mapping service types with state updates
 */
const createServiceTypesFetcher = (
  serviceMethod: () => E.Effect<Record[], unknown>,
  targetArray: UIServiceType[],
  status: 'pending' | 'approved' | 'rejected',
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.map((records) => {
        const uiServiceTypes = mapRecordsToUIServiceTypes(records, status);
        targetArray.splice(0, targetArray.length, ...uiServiceTypes);
        return uiServiceTypes;
      }),
      E.catchAll((error) => {
        // Handle connection errors gracefully
        const errorMessage = String(error);
        if (errorMessage.includes('Client not connected')) {
          console.warn(
            `Holochain client not connected, returning empty ${status} service types array`
          );
          return E.succeed([]);
        }
        return E.fail(ServiceTypeStoreError.fromError(error, errorContext));
      })
    )
  )(setLoading, setError);

/**
 * Creates a standardized function for searching service types with results updates
 */
const createServiceTypesSearcher = (
  serviceMethod: () => E.Effect<Record[], unknown>,
  resultsArray: UIServiceType[],
  status: 'pending' | 'approved' | 'rejected',
  errorContext: string,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) =>
  withLoadingState(() =>
    pipe(
      serviceMethod(),
      E.map((records) => {
        const uiServiceTypes = mapRecordsToUIServiceTypes(records, status);
        resultsArray.splice(0, resultsArray.length, ...uiServiceTypes);
        return uiServiceTypes;
      }),
      E.catchAll((error) => {
        // Handle connection errors gracefully
        const errorMessage = String(error);
        if (errorMessage.includes('Client not connected')) {
          console.warn(
            `Holochain client not connected, returning empty ${status} service types search results`
          );
          return E.succeed([]);
        }
        return E.fail(ServiceTypeStoreError.fromError(error, errorContext));
      })
    )
  )(setLoading, setError);

/**
 * Helper function to determine service type status dynamically
 */
const createStatusDeterminer = () => {
  const determineServiceTypeStatus = (
    serviceTypeHash: ActionHash
  ): E.Effect<'pending' | 'approved' | 'rejected', ServiceTypeStoreError> =>
    pipe(
      E.gen(function* () {
        const serviceTypesService = yield* ServiceTypesServiceTag;
        const results = yield* E.all({
          pendingRecords: serviceTypesService.getPendingServiceTypes(),
          approvedRecords: serviceTypesService.getApprovedServiceTypes(),
          rejectedRecords: serviceTypesService.getRejectedServiceTypes()
        });
        return results;
      }),
      E.map(({ pendingRecords, approvedRecords, rejectedRecords }) => {
        const hashString = serviceTypeHash.toString();

        if (
          pendingRecords.some((r: Record) => r.signed_action.hashed.hash.toString() === hashString)
        ) {
          return 'pending';
        } else if (
          approvedRecords.some((r: Record) => r.signed_action.hashed.hash.toString() === hashString)
        ) {
          return 'approved';
        } else if (
          rejectedRecords.some((r: Record) => r.signed_action.hashed.hash.toString() === hashString)
        ) {
          return 'rejected';
        }

        return 'approved' as const; // default fallback
      }),
      E.catchAll((error) =>
        E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.DETERMINE_SERVICE_TYPE_STATUS))
      ),
      E.provide(ServiceTypesServiceLive),
      E.provide(HolochainClientLive)
    );

  return { determineServiceTypeStatus };
};

/**
 * Creates a lookup function for cache misses
 */
const createCacheLookupFunction = () => {
  const lookupServiceType = (key: string): E.Effect<UIServiceType, CacheNotFoundError, never> =>
    pipe(
      E.gen(function* () {
        const serviceTypesService = yield* ServiceTypesServiceTag;
        const hash = decodeHashFromBase64(key);
        const record = yield* serviceTypesService.getServiceType(hash);

        if (!record) {
          throw new Error(`ServiceType not found for key: ${key}`);
        }

        return createUIServiceType(record, 'approved');
      }),
      E.catchAll(() => E.fail(new CacheNotFoundError({ key }))),
      E.provide(ServiceTypesServiceLive),
      E.provide(HolochainClientLive)
    );

  return { lookupServiceType };
};

/**
 * Processes multiple record collections and updates cache and state
 */
const processMultipleRecordCollections = (
  collections: { pending: Record[]; approved: Record[]; rejected: Record[] },
  cache: EntityCacheService<UIServiceType>,
  syncCacheToState: (entity: UIServiceType, operation: 'add' | 'update' | 'remove') => void
): UIServiceType[] => {
  const pendingUiServiceTypes = mapRecordsToUIServiceTypes(collections.pending, 'pending');
  const approvedUiServiceTypes = mapRecordsToUIServiceTypes(collections.approved, 'approved');
  const rejectedUiServiceTypes = mapRecordsToUIServiceTypes(collections.rejected, 'rejected');

  const allNewServiceTypes = [
    ...pendingUiServiceTypes,
    ...approvedUiServiceTypes,
    ...rejectedUiServiceTypes
  ];

  // Update cache and sync state for all service types
  allNewServiceTypes.forEach((st) => {
    E.runSync(cache.set(st.original_action_hash?.toString() || '', st));
    syncCacheToState(st, 'add');
  });

  return allNewServiceTypes;
};

/**
 * Creates a helper for record creation operations (create/suggest)
 */
const createRecordCreationHelper = (
  cache: EntityCacheService<UIServiceType>,
  syncCacheToState: (entity: UIServiceType, operation: 'add' | 'update' | 'remove') => void
) => {
  const processCreatedRecord = (
    record: Record,
    status: 'pending' | 'approved' | 'rejected' = 'pending'
  ) => {
    const newServiceType = createUIServiceType(record, status);
    E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newServiceType));
    syncCacheToState(newServiceType, 'add');
    return { record, newServiceType };
  };

  return { processCreatedRecord };
};

/**
 * Creates a helper for status transition operations (approve/reject)
 */
const createStatusTransitionHelper = (
  pendingServiceTypes: UIServiceType[],
  approvedServiceTypes: UIServiceType[],
  rejectedServiceTypes: UIServiceType[],
  cache: EntityCacheService<UIServiceType>
) => {
  const transitionServiceTypeStatus = (
    serviceTypeHash: ActionHash,
    newStatus: 'approved' | 'rejected'
  ) => {
    const hashString = serviceTypeHash.toString();
    const pendingIndex = pendingServiceTypes.findIndex(
      (st) => st.original_action_hash?.toString() === hashString
    );
    const rejectedIndex = rejectedServiceTypes.findIndex(
      (st) => st.original_action_hash?.toString() === hashString
    );

    let serviceType: UIServiceType | null = null;

    // Find the service type in appropriate arrays based on new status
    if (newStatus === 'approved') {
      if (pendingIndex !== -1) {
        serviceType = pendingServiceTypes.splice(pendingIndex, 1)[0];
      } else if (rejectedIndex !== -1) {
        serviceType = rejectedServiceTypes.splice(rejectedIndex, 1)[0];
      }

      if (serviceType) {
        serviceType.status = 'approved';
        approvedServiceTypes.push(serviceType);
        E.runSync(cache.set(hashString, serviceType));
      }
    } else if (newStatus === 'rejected') {
      if (pendingIndex !== -1) {
        serviceType = pendingServiceTypes.splice(pendingIndex, 1)[0];
        if (serviceType) {
          serviceType.status = 'rejected';
          rejectedServiceTypes.push(serviceType);
          E.runSync(cache.set(hashString, serviceType));
        }
      }
    }
  };

  return { transitionServiceTypeStatus };
};

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
    // HELPER INITIALIZATION
    // ========================================================================
    const setLoading = (value: boolean) => {
      loading = value;
    };
    const setError = (value: string | null) => {
      error = value;
    };

    const { lookupServiceType } = createCacheLookupFunction();
    const { syncCacheToState } = createCacheSyncHelper(
      serviceTypes,
      pendingServiceTypes,
      approvedServiceTypes,
      rejectedServiceTypes
    );
    const {
      emitServiceTypeCreated,
      emitServiceTypeUpdated,
      emitServiceTypeSuggested,
      emitServiceTypeApproved,
      emitServiceTypeRejected,
      emitServiceTypeDeleted
    } = createEventEmitters();
    const { determineServiceTypeStatus } = createStatusDeterminer();

    // Create cache using the cache service
    const cache = yield* cacheService.createEntityCache<UIServiceType>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      lookupServiceType
    );

    const { processCreatedRecord } = createRecordCreationHelper(cache, syncCacheToState);
    const { transitionServiceTypeStatus } = createStatusTransitionHelper(
      pendingServiceTypes,
      approvedServiceTypes,
      rejectedServiceTypes,
      cache
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
      withLoadingState(() =>
        pipe(
          serviceTypesService.createServiceType(serviceType),
          E.map((record) => processCreatedRecord(record, 'pending')),
          E.tap(({ newServiceType }) => E.sync(() => emitServiceTypeCreated(newServiceType))),
          E.map(({ record }) => record),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.CREATE_SERVICE_TYPE))
          )
        )
      )(setLoading, setError);

    const getAllServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getAllServiceTypes(),
          E.flatMap((result: { pending: Record[]; approved: Record[]; rejected: Record[] }) =>
            E.try({
              try: () => processMultipleRecordCollections(result, cache, syncCacheToState),
              catch: (unknownError) =>
                ServiceTypeStoreError.fromError(unknownError, ERROR_CONTEXTS.DECODE_SERVICE_TYPES)
            })
          ),
          E.catchAll((error) => {
            // Handle connection errors gracefully
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty service types array');
              return E.succeed([]);
            }
            return E.fail(
              ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_ALL_SERVICE_TYPES)
            );
          })
        )
      )(setLoading, setError);

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<UIServiceType | null, ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          cache.get(serviceTypeHash.toString()),
          E.flatMap((cachedServiceType) => {
            // If we have a cached result, return it immediately without any service calls
            if (cachedServiceType) {
              return E.succeed(cachedServiceType);
            }

            // If not in cache, try multiple approaches to find the service type
            return pipe(
              // First, try the standard service call
              serviceTypesService.getServiceType(serviceTypeHash),
              E.flatMap((record) => {
                if (record) {
                  return pipe(
                    determineServiceTypeStatus(serviceTypeHash),
                    E.map((status) => {
                      const serviceType = createUIServiceType(record, status);
                      E.runSync(cache.set(serviceTypeHash.toString(), serviceType));
                      return serviceType;
                    }),
                    E.catchAll(() => {
                      // If status determination fails, default to pending
                      const serviceType = createUIServiceType(record, 'pending');
                      E.runSync(cache.set(serviceTypeHash.toString(), serviceType));
                      return E.succeed(serviceType);
                    })
                  );
                }

                // If record not found, try to find it in local state arrays
                // This handles cases where the service type was just created and might not be
                // immediately available via the standard service call
                return pipe(
                  E.try({
                    try: () => {
                      // Check all local arrays for this service type
                      const hashString = serviceTypeHash.toString();

                      const allLocalServiceTypes = [
                        ...pendingServiceTypes,
                        ...approvedServiceTypes,
                        ...rejectedServiceTypes
                      ];

                      const foundServiceType = allLocalServiceTypes.find(
                        (st) => st.original_action_hash?.toString() === hashString
                      );

                      if (foundServiceType) {
                        E.runSync(cache.set(hashString, foundServiceType));
                        return foundServiceType;
                      }

                      return null;
                    },
                    catch: () => new Error('Failed to search local service types')
                  }),
                  E.catchAll(() => E.succeed(null as UIServiceType | null))
                );
              }),
              E.catchAll((error) => {
                const errorMessage = String(error);

                // For authorization errors, try to find in pending service types
                // (user might be looking for their own pending service type)
                if (
                  errorMessage.includes('Unauthorized') ||
                  errorMessage.includes('UserProfileRequired')
                ) {
                  return pipe(
                    E.try({
                      try: () => {
                        const hashString = serviceTypeHash.toString();
                        const foundServiceType = pendingServiceTypes.find(
                          (st) => st.original_action_hash?.toString() === hashString
                        );

                        if (foundServiceType) {
                          // Cache the found pending service type
                          E.runSync(cache.set(hashString, foundServiceType));
                          return foundServiceType;
                        }
                        return null;
                      },
                      catch: () => new Error('Failed to search pending service types')
                    }),
                    E.catchAll(() => E.succeed(null as UIServiceType | null))
                  );
                }

                // For other errors, return null
                return E.succeed(null as UIServiceType | null);
              })
            );
          }),
          E.catchAll((error) => {
            // If cache.get fails (which should be rare), fall back to service call
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
                  E.catchAll(() => {
                    // If status determination fails, default to pending
                    const serviceType = createUIServiceType(record, 'pending');
                    E.runSync(cache.set(serviceTypeHash.toString(), serviceType));
                    return E.succeed(serviceType);
                  })
                );
              }),
              E.catchAll(() => E.succeed(null as UIServiceType | null))
            );
          })
        )
      )(setLoading, setError);

    const updateServiceType = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      withLoadingState(() =>
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

                const updatedUIServiceType: UIServiceType = {
                  ...createUIServiceType(record, 'approved'),
                  original_action_hash: originalActionHash,
                  previous_action_hash: newActionHash,
                  updated_at: Date.now()
                };

                // Update cache and sync
                E.runSync(cache.set(originalActionHash.toString(), updatedUIServiceType));
                syncCacheToState(updatedUIServiceType, 'update');

                return { record, updatedServiceType: updatedUIServiceType };
              })
            )
          ),
          E.tap(({ updatedServiceType }) =>
            updatedServiceType ? emitServiceTypeUpdated(updatedServiceType) : E.asVoid
          ),
          E.map(({ record }) => record!),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.UPDATE_SERVICE_TYPE))
          )
        )
      )(setLoading, setError);

    const deleteServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.deleteServiceType(serviceTypeHash),
          E.tap(() => {
            E.runSync(cache.invalidate(serviceTypeHash.toString()));
            const dummyServiceType = { original_action_hash: serviceTypeHash } as UIServiceType;
            syncCacheToState(dummyServiceType, 'remove');
          }),
          E.tap(() => E.sync(() => emitServiceTypeDeleted(serviceTypeHash))),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.DELETE_SERVICE_TYPE))
          )
        )
      )(setLoading, setError);

    // ========================================================================
    // STATUS MANAGEMENT OPERATIONS
    // ========================================================================

    const suggestServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.suggestServiceType(serviceType),
          E.map((record) => processCreatedRecord(record, 'pending')),
          E.tap(({ newServiceType }) => E.sync(() => emitServiceTypeSuggested(newServiceType))),
          E.map(({ record }) => record),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.SUGGEST_SERVICE_TYPE))
          )
        )
      )(setLoading, setError);

    const approveServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.approveServiceType(serviceTypeHash),
          E.tap(() => transitionServiceTypeStatus(serviceTypeHash, 'approved')),
          E.tap(() => E.sync(() => emitServiceTypeApproved(serviceTypeHash))),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.APPROVE_SERVICE_TYPE))
          )
        )
      )(setLoading, setError);

    const rejectServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.rejectServiceType(serviceTypeHash),
          E.tap(() => transitionServiceTypeStatus(serviceTypeHash, 'rejected')),
          E.tap(() => E.sync(() => emitServiceTypeRejected(serviceTypeHash))),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.REJECT_SERVICE_TYPE))
          )
        )
      )(setLoading, setError);

    // ========================================================================
    // STATUS-SPECIFIC GETTERS
    // ========================================================================

    const getPendingServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      createServiceTypesFetcher(
        serviceTypesService.getPendingServiceTypes,
        pendingServiceTypes,
        'pending',
        ERROR_CONTEXTS.GET_PENDING_SERVICE_TYPES,
        setLoading,
        setError
      );

    const getApprovedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      createServiceTypesFetcher(
        serviceTypesService.getApprovedServiceTypes,
        approvedServiceTypes,
        'approved',
        ERROR_CONTEXTS.GET_APPROVED_SERVICE_TYPES,
        setLoading,
        setError
      );

    const getRejectedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      createServiceTypesFetcher(
        serviceTypesService.getRejectedServiceTypes,
        rejectedServiceTypes,
        'rejected',
        ERROR_CONTEXTS.GET_REJECTED_SERVICE_TYPES,
        setLoading,
        setError
      );

    // ========================================================================
    // UTILITY OPERATIONS
    // ========================================================================

    const hasServiceTypes = (): E.Effect<boolean, ServiceTypeStoreError> =>
      pipe(
        getAllServiceTypes(),
        E.map((serviceTypes) => serviceTypes.length > 0),
        E.catchAll((error) => {
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected, assuming no service types exist');
            return E.succeed(false);
          }
          return E.fail(
            ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.CHECK_SERVICE_TYPES_EXIST)
          );
        })
      );

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getServiceTypesForEntity(input),
          E.catchAll((error) =>
            E.fail(
              ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_SERVICE_TYPES_FOR_ENTITY)
            )
          )
        )
      )(setLoading, setError);

    // ========================================================================
    // TAG-RELATED OPERATIONS
    // ========================================================================

    const getAllTags = (): E.Effect<string[], ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getAllServiceTypeTags(),
          E.map((tags) => {
            allTags.splice(0, allTags.length, ...tags);
            return tags;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_ALL_TAGS))
          )
        )
      )(setLoading, setError);

    const loadAllTags = (): E.Effect<string[], ServiceTypeStoreError> =>
      pipe(
        serviceTypesService.getAllServiceTypeTags(),
        E.tap((tags) =>
          E.sync(() => {
            allTags.splice(0, allTags.length, ...tags);
          })
        ),
        E.mapError((err) => ServiceTypeStoreError.fromError(err, ERROR_CONTEXTS.GET_ALL_TAGS))
      );

    const getServiceTypesByTag = (tag: string): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      createServiceTypesSearcher(
        () => serviceTypesService.getServiceTypesByTag(tag),
        searchResults,
        'approved',
        ERROR_CONTEXTS.GET_SERVICE_TYPES_BY_TAG,
        setLoading,
        setError
      );

    const getServiceTypesByTags = (
      tags: string[]
    ): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      createServiceTypesSearcher(
        () => serviceTypesService.getServiceTypesByTags(tags),
        searchResults,
        'approved',
        ERROR_CONTEXTS.GET_SERVICE_TYPES_BY_TAGS,
        setLoading,
        setError
      );

    const searchServiceTypesByTagPrefix = (
      prefix: string
    ): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      createServiceTypesSearcher(
        () => serviceTypesService.searchServiceTypesByTagPrefix(prefix),
        searchResults,
        'approved',
        ERROR_CONTEXTS.SEARCH_SERVICE_TYPES_BY_TAG_PREFIX,
        setLoading,
        setError
      );

    const getTagStatistics = (): E.Effect<Array<[string, number]>, ServiceTypeStoreError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getTagStatistics(),
          E.map((statistics) => {
            tagStatistics.splice(0, tagStatistics.length, ...statistics);
            return statistics;
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeStoreError.fromError(error, ERROR_CONTEXTS.GET_TAG_STATISTICS))
          )
        )
      )(setLoading, setError);

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

// Lazy store initialization to avoid runtime issues
let _serviceTypesStore: ServiceTypesStore | null = null;

const getServiceTypesStore = (): ServiceTypesStore => {
  if (_serviceTypesStore) {
    return _serviceTypesStore;
  }

  const storeEffect = pipe(
    createServiceTypesStore(),
    E.provide(ServiceTypesServiceLive),
    E.provide(CacheServiceLive),
    E.provide(HolochainClientLive)
  );

  _serviceTypesStore = E.runSync(storeEffect);

  return _serviceTypesStore;
};

// Export a proxy that delegates to the lazy-initialized store
const serviceTypesStore = new Proxy({} as ServiceTypesStore, {
  get(_target, prop) {
    const store = getServiceTypesStore();
    const value = store[prop as keyof ServiceTypesStore];
    return typeof value === 'function' ? value.bind(store) : value;
  }
});

export default serviceTypesStore;
