import type { ActionHash, Record } from '@holochain/client';
import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
import {
  HolochainClientServiceTag,
  HolochainClientServiceLive
} from '$lib/services/HolochainClientService.svelte';
import {
  ServiceTypesServiceTag,
  ServiceTypesServiceLive,
  type ServiceTypesService
} from '$lib/services/zomes/serviceTypes.service';
import type { GetServiceTypeForEntityInput } from '$lib/services/zomes/serviceTypes.service';
import type { UIServiceType } from '$lib/types/ui';
import type { ServiceTypeInDHT } from '$lib/types/holochain';

import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService
} from '$lib/utils/cache.svelte';
import { Effect as E, pipe } from 'effect';
import { ServiceTypeError } from '$lib/errors/service-types.errors';
import { CacheNotFoundError } from '$lib/errors';
import { CACHE_EXPIRY } from '$lib/utils/constants';
import { SERVICE_TYPE_CONTEXTS } from '$lib/errors/error-contexts';

// Import our new store helpers
import {
  withLoadingState,
  createGenericCacheSyncHelper,
  createStatusAwareEventEmitters,
  createUIEntityFromRecord,
  createStatusTransitionHelper,
  processMultipleRecordCollections,
  type LoadingStateSetter,
  type EntityStatus
} from '$lib/utils/store-helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

const CACHE_EXPIRY_MS = CACHE_EXPIRY.SERVICE_TYPES;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ServiceTypesStore = {
  readonly serviceTypes: UIServiceType[];
  readonly pendingServiceTypes: UIServiceType[];
  readonly approvedServiceTypes: UIServiceType[];
  readonly rejectedServiceTypes: UIServiceType[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIServiceType>;

  getServiceType: (serviceTypeHash: ActionHash) => E.Effect<UIServiceType | null, ServiceTypeError>;
  getAllServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeError>;
  createServiceType: (serviceType: ServiceTypeInDHT) => E.Effect<Record, ServiceTypeError>;
  updateServiceType: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedServiceType: ServiceTypeInDHT
  ) => E.Effect<Record, ServiceTypeError>;
  deleteServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeError>;
  hasServiceTypes: () => E.Effect<boolean, ServiceTypeError>;
  getServiceTypesForEntity: (
    input: GetServiceTypeForEntityInput
  ) => E.Effect<ActionHash[], ServiceTypeError>;
  invalidateCache: () => void;

  // Status management methods
  suggestServiceType: (serviceType: ServiceTypeInDHT) => E.Effect<Record, ServiceTypeError>;
  approveServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeError>;
  rejectServiceType: (serviceTypeHash: ActionHash) => E.Effect<void, ServiceTypeError>;
  getPendingServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeError>;
  getApprovedServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeError>;
  getRejectedServiceTypes: () => E.Effect<UIServiceType[], ServiceTypeError>;
};

// ============================================================================
// ENTITY CREATION HELPERS
// ============================================================================

/**
 * Creates a complete UIServiceType from a record using our standardized helper
 * This demonstrates the use of createUIEntityFromRecord from store-helpers
 */
const createUIServiceType = createUIEntityFromRecord<ServiceTypeInDHT, UIServiceType>(
  (entry, actionHash, timestamp, additionalData) => ({
    ...entry,
    original_action_hash: actionHash,
    previous_action_hash: actionHash,
    creator: actionHash, // TODO: Extract creator from record
    created_at: timestamp,
    updated_at: timestamp,
    status: (additionalData?.status as 'pending' | 'approved' | 'rejected') || 'approved'
  })
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Create standardized event emitters for ServiceType with status support
 */
const serviceTypeEventEmitters = createStatusAwareEventEmitters<UIServiceType>('serviceType');

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Cache lookup function for serviceTypes
 */
const createServiceTypeCacheLookup = (serviceTypesService: ServiceTypesService) => {
  return (key: string): E.Effect<UIServiceType, CacheNotFoundError, never> => {
    return pipe(
      E.gen(function* () {
        const hash = decodeHashFromBase64(key);
        const record = yield* serviceTypesService.getServiceType(hash);

        if (!record) {
          return yield* E.fail(new CacheNotFoundError({ key }));
        }

        // Get the actual status instead of defaulting to 'approved'
        const status = yield* serviceTypesService.getServiceTypeStatus(hash);
        const entity = createUIServiceType(record, {
          status: status as 'pending' | 'approved' | 'rejected'
        });
        if (!entity) {
          return yield* E.fail(new CacheNotFoundError({ key }));
        }

        return entity;
      }),
      E.catchAll(() => E.fail(new CacheNotFoundError({ key })))
    );
  };
};

// ============================================================================
// STORE FACTORY FUNCTION
// ============================================================================

/**
 * SERVICE TYPES STORE - DEMONSTRATING STANDARDIZED STORE HELPER PATTERNS
 *
 * This store serves as the reference implementation for the 9 standardized helper functions:
 *
 * 1. createUIEntityFromRecord - Entity creation from Holochain records
 * 2. createGenericCacheSyncHelper - Cache-to-state synchronization
 * 3. createStatusAwareEventEmitters - Type-safe event emission with status support
 * 4. withLoadingState - Consistent loading/error state management
 * 5. createStatusTransitionHelper - Status workflow management (pending/approved/rejected)
 * 6. createEntityCreationHelper - Standardized entity creation with validation
 * 7. processMultipleRecordCollections - Handling complex API responses with multiple collections
 * 8. createErrorHandler - Domain-specific error handling
 * 9. createCacheLookupFunction - Cache miss handling with service fallback
 *
 * This implementation can serve as the architectural template for other domain stores.
 *
 * @returns An Effect that creates a service types store with state and methods
 */
export const createServiceTypesStore = (): E.Effect<
  ServiceTypesStore,
  never,
  HolochainClientServiceTag | ServiceTypesServiceTag | CacheServiceTag
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

    // ========================================================================
    // HELPER INITIALIZATION WITH STANDARDIZED UTILITIES
    // ========================================================================

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
    // This demonstrates how to sync cache operations with reactive state arrays
    const { syncCacheToState } = createGenericCacheSyncHelper({
      all: serviceTypes,
      pending: pendingServiceTypes,
      approved: approvedServiceTypes,
      rejected: rejectedServiceTypes
    });

    // 3. EVENT EMITTERS - Using createStatusAwareEventEmitters
    // This provides type-safe event emission for CRUD operations with status support
    const eventEmitters = serviceTypeEventEmitters;

    // Individual emitter functions for backward compatibility
    const emitServiceTypeApproved = (entity: UIServiceType) => {
      eventEmitters.emitStatusChanged?.(entity);
    };

    const emitServiceTypeRejected = (entity: UIServiceType) => {
      eventEmitters.emitStatusChanged?.(entity);
    };

    // 4. CACHE MANAGEMENT - Using standardized cache lookup pattern
    // This demonstrates how to create a cache with custom lookup function
    const cacheLookup = createServiceTypeCacheLookup(serviceTypesService as ServiceTypesService);
    const cache = yield* cacheService.createEntityCache<UIServiceType>(
      {
        expiryMs: CACHE_EXPIRY_MS,
        debug: false
      },
      cacheLookup
    );

    // 5. STATUS TRANSITIONS - Using createStatusTransitionHelper
    // This handles moving entities between pending/approved/rejected arrays
    const { transitionEntityStatus } = createStatusTransitionHelper(
      {
        pending: pendingServiceTypes,
        approved: approvedServiceTypes,
        rejected: rejectedServiceTypes
      },
      cache
    );

    // Helper function for status transitions
    const transitionServiceTypeStatus = (serviceTypeHash: ActionHash, newStatus: EntityStatus) => {
      return transitionEntityStatus(serviceTypeHash, newStatus);
    };

    // 6. ENTITY CREATION - Using createEntityCreationHelper
    // This provides standardized entity creation with validation

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    // ========================================================================
    // CORE CRUD OPERATIONS - Demonstrating Helper Function Usage
    // ========================================================================
    // These operations showcase the key patterns:
    // - withLoadingState() for consistent loading/error state management
    // - processMultipleRecordCollections() for handling complex API responses
    // - syncCacheToState() for cache-to-state synchronization
    // - Event emitters for reactive updates
    // - Error handling with domain-specific error contexts

    const createServiceType = (serviceType: ServiceTypeInDHT): E.Effect<Record, ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.createServiceType(serviceType),
          E.tap((record) => {
            const entity = createUIServiceType(record, { status: 'approved' });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
              eventEmitters.emitStatusChanged?.(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE))
          )
        )
      )(setters);

    const getAllServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getAllServiceTypes(),
          E.flatMap((result: { pending: Record[]; approved: Record[]; rejected: Record[] }) =>
            E.try({
              try: () =>
                processMultipleRecordCollections(
                  {
                    converter: createUIServiceType,
                    cache,
                    targetArrays: {
                      all: serviceTypes,
                      pending: pendingServiceTypes,
                      approved: approvedServiceTypes,
                      rejected: rejectedServiceTypes
                    }
                  },
                  result
                ),
              catch: (unknownError) =>
                ServiceTypeError.fromError(unknownError, SERVICE_TYPE_CONTEXTS.DECODE_SERVICE_TYPES)
            })
          ),
          E.map(() => serviceTypes),
          E.catchAll((error) => {
            // Handle connection errors gracefully
            const errorMessage = String(error);
            if (errorMessage.includes('Client not connected')) {
              console.warn('Holochain client not connected, returning empty service types array');
              return E.succeed([]);
            }
            return E.fail(
              ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES)
            );
          })
        )
      )(setters);

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<UIServiceType | null, ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          cache.get(encodeHashToBase64(serviceTypeHash)),
          E.flatMap((cachedServiceType) => {
            // If we have a cached result, return it immediately
            if (cachedServiceType) {
              return E.succeed(cachedServiceType);
            }

            // If not in cache, try service call
            return pipe(
              E.all({
                record: serviceTypesService.getServiceType(serviceTypeHash),
                status: serviceTypesService.getServiceTypeStatus(serviceTypeHash)
              }),
              E.map(({ record, status }) => {
                if (!record) {
                  return null;
                }

                // Use the actual status instead of defaulting to 'approved'
                const serviceType = createUIServiceType(record, {
                  status: status as 'pending' | 'approved' | 'rejected'
                });
                if (serviceType) {
                  E.runSync(cache.set(encodeHashToBase64(serviceTypeHash), serviceType));
                  syncCacheToState(serviceType, 'add');
                }
                return serviceType;
              }),
              E.catchAll((error) => {
                const errorMessage = String(error);
                if (errorMessage.includes('Client not connected')) {
                  console.warn('Holochain client not connected, returning null');
                  return E.succeed(null);
                }
                return E.fail(
                  ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPE)
                );
              })
            );
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPE))
          )
        )
      )(setters);

    const updateServiceType = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeError> =>
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

                const baseEntity = createUIServiceType(record, { status: 'approved' });
                if (!baseEntity) return { record: null, updatedServiceType: null };

                const updatedUIServiceType: UIServiceType = {
                  ...baseEntity,
                  original_action_hash: originalActionHash,
                  previous_action_hash: newActionHash,
                  updated_at: Date.now()
                };

                // Update cache and sync
                E.runSync(cache.set(encodeHashToBase64(originalActionHash), updatedUIServiceType));
                syncCacheToState(updatedUIServiceType, 'update');

                return { record, updatedServiceType: updatedUIServiceType };
              })
            )
          ),
          E.tap(({ updatedServiceType }) =>
            updatedServiceType
              ? E.sync(() => eventEmitters.emitUpdated(updatedServiceType))
              : E.asVoid
          ),
          E.map(({ record }) => record!),
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.UPDATE_SERVICE_TYPE))
          )
        )
      )(setters);

    const deleteServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.deleteServiceType(serviceTypeHash),
          E.tap(() => {
            E.runSync(cache.invalidate(encodeHashToBase64(serviceTypeHash)));
            const dummyServiceType = { original_action_hash: serviceTypeHash } as UIServiceType;
            syncCacheToState(dummyServiceType, 'remove');
          }),
          E.tap(() => E.sync(() => eventEmitters.emitDeleted(serviceTypeHash))),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.DELETE_SERVICE_TYPE))
          )
        )
      )(setters);

    // ========================================================================
    // STATUS MANAGEMENT OPERATIONS
    // ========================================================================

    const suggestServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.suggestServiceType(serviceType),
          E.tap((record) => {
            const entity = createUIServiceType(record, { status: 'pending' });
            if (entity) {
              E.runSync(cache.set(encodeHashToBase64(record.signed_action.hashed.hash), entity));
              syncCacheToState(entity, 'add');
              eventEmitters.emitCreated(entity);
              eventEmitters.emitStatusChanged?.(entity);
            }
          }),
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.SUGGEST_SERVICE_TYPE))
          )
        )
      )(setters);

    const approveServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.approveServiceType(serviceTypeHash),
          E.tap(() => {
            transitionServiceTypeStatus(serviceTypeHash, 'approved');

            // Find the approved service type to emit with the event
            const hashString = encodeHashToBase64(serviceTypeHash);
            const approvedServiceType = approvedServiceTypes.find((st) =>
              st.original_action_hash
                ? encodeHashToBase64(st.original_action_hash) === hashString
                : false
            );

            if (approvedServiceType) {
              emitServiceTypeApproved(approvedServiceType);
            }
          }),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.APPROVE_SERVICE_TYPE))
          )
        )
      )(setters);

    const rejectServiceType = (serviceTypeHash: ActionHash): E.Effect<void, ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.rejectServiceType(serviceTypeHash),
          E.tap(() => {
            transitionServiceTypeStatus(serviceTypeHash, 'rejected');

            // Find the rejected service type to emit with the event
            const hashString = encodeHashToBase64(serviceTypeHash);
            const rejectedServiceType = rejectedServiceTypes.find((st) =>
              st.original_action_hash
                ? encodeHashToBase64(st.original_action_hash) === hashString
                : false
            );

            if (rejectedServiceType) {
              emitServiceTypeRejected(rejectedServiceType);
            }
          }),
          E.asVoid,
          E.catchAll((error) =>
            E.fail(ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.REJECT_SERVICE_TYPE))
          )
        )
      )(setters);

    // ========================================================================
    // STATUS-SPECIFIC GETTERS
    // ========================================================================

    const getPendingServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getPendingServiceTypes(),
          E.map((records) => {
            const entities = records
              .map((record) => createUIServiceType(record, { status: 'pending' }))
              .filter(Boolean) as UIServiceType[];
            pendingServiceTypes.splice(0, pendingServiceTypes.length, ...entities);
            return entities;
          }),
          E.catchAll((error) =>
            E.fail(
              ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_PENDING_SERVICE_TYPES)
            )
          )
        )
      )(setters);

    const getApprovedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getApprovedServiceTypes(),
          E.map((records) => {
            const entities = records
              .map((record) => createUIServiceType(record, { status: 'approved' }))
              .filter(Boolean) as UIServiceType[];
            approvedServiceTypes.splice(0, approvedServiceTypes.length, ...entities);
            return entities;
          }),
          E.catchAll((error) =>
            E.fail(
              ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_APPROVED_SERVICE_TYPES)
            )
          )
        )
      )(setters);

    const getRejectedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getRejectedServiceTypes(),
          E.map((records) => {
            const entities = records
              .map((record) => createUIServiceType(record, { status: 'rejected' }))
              .filter(Boolean) as UIServiceType[];
            rejectedServiceTypes.splice(0, rejectedServiceTypes.length, ...entities);
            return entities;
          }),
          E.catchAll((error) =>
            E.fail(
              ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_REJECTED_SERVICE_TYPES)
            )
          )
        )
      )(setters);

    // ========================================================================
    // UTILITY OPERATIONS
    // ========================================================================

    const hasServiceTypes = (): E.Effect<boolean, ServiceTypeError> =>
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
            ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CHECK_SERVICE_TYPES_EXIST)
          );
        })
      );

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeError> =>
      withLoadingState(() =>
        pipe(
          serviceTypesService.getServiceTypesForEntity(input),
          E.catchAll((error) =>
            E.fail(
              ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_SERVICE_TYPES_FOR_ENTITY)
            )
          )
        )
      )(setters);

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
      getRejectedServiceTypes
    };
  });

// ============================================================================
// STORE INSTANCE CREATION
// ============================================================================

const serviceTypesStore: ServiceTypesStore = pipe(
  createServiceTypesStore(),
  E.provide(CacheServiceLive),
  E.provide(ServiceTypesServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runSync
);

export default serviceTypesStore;
