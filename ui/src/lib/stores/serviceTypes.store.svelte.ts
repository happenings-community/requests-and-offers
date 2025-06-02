import type { ActionHash, Record } from '@holochain/client';
import type { UIServiceType } from '$lib/types/ui';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import {
  ServiceTypesServiceTag,
  ServiceTypesServiceLive
} from '$lib/services/zomes/serviceTypes.service';
import { decodeRecords } from '$lib/utils';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService,
  CacheNotFoundError
} from '$lib/utils/cache.svelte';
import { StoreEventBusLive, StoreEventBusTag } from '$lib/stores/storeEvents';
import { Data, Effect as E, pipe } from 'effect';
import { HolochainClientServiceLive } from '../services/HolochainClientService.svelte';

export class ServiceTypeStoreError extends Data.TaggedError('ServiceTypeStoreError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ServiceTypeStoreError {
    if (error instanceof Error) {
      return new ServiceTypeStoreError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }

    return new ServiceTypeStoreError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

export type ServiceTypesStore = {
  readonly serviceTypes: UIServiceType[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIServiceType>;
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
  invalidateCache: () => void;
};

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

    // State
    const serviceTypes: UIServiceType[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // Create lookup function for cache misses
    const lookupServiceType = (key: string): E.Effect<UIServiceType, CacheNotFoundError> =>
      pipe(
        E.tryPromise({
          try: async () => {
            // Try to parse the key as an ActionHash and fetch from service
            const hash = new Uint8Array(Buffer.from(key, 'base64'));
            const record = await E.runPromise(serviceTypesService.getServiceType(hash));

            if (!record) {
              throw new Error(`ServiceType not found for key: ${key}`);
            }

            return {
              ...decodeRecords<ServiceTypeInDHT>([record])[0],
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              creator: record.signed_action.hashed.content.author,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp
            } as UIServiceType;
          },
          catch: () => new CacheNotFoundError({ key })
        }),
        E.mapError(() => new CacheNotFoundError({ key }))
      );

    // Create cache using the cache service
    const cache = yield* cacheService.createEntityCache<UIServiceType>(
      {
        expiryMs: 10 * 60 * 1000, // 10 minutes (longer than requests since service types change less frequently)
        debug: false
      },
      lookupServiceType
    );

    // Helper function to sync cache with local state
    const syncCacheToState = (entity: UIServiceType, operation: 'add' | 'update' | 'remove') => {
      const index = serviceTypes.findIndex(
        (st) => st.original_action_hash?.toString() === entity.original_action_hash?.toString()
      );

      switch (operation) {
        case 'add':
        case 'update':
          if (index !== -1) {
            serviceTypes[index] = entity;
          } else {
            serviceTypes.push(entity);
          }
          break;
        case 'remove':
          if (index !== -1) {
            serviceTypes.splice(index, 1);
          }
          break;
      }
    };

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    const createServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.createServiceType(serviceType)),
        E.map((record) => {
          const newServiceType: UIServiceType = {
            ...decodeRecords<ServiceTypeInDHT>([record])[0],
            original_action_hash: record.signed_action.hashed.hash,
            previous_action_hash: record.signed_action.hashed.hash,
            creator: record.signed_action.hashed.content.author,
            created_at: Date.now(),
            updated_at: Date.now()
          };

          // Cache the new service type
          E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newServiceType));

          syncCacheToState(newServiceType, 'add');

          return { record, newServiceType };
        }),
        E.tap(({ newServiceType }) =>
          newServiceType
            ? E.gen(function* () {
              const eventBus = yield* StoreEventBusTag;
              yield* eventBus.emit('serviceType:created', { serviceType: newServiceType });
            }).pipe(
              E.catchAll((error) =>
                E.fail(
                  ServiceTypeStoreError.fromError(
                    error,
                    'Failed to emit service type created event'
                  )
                )
              ),
              E.provide(StoreEventBusLive)
            )
            : E.asVoid
        ),
        E.map(({ record }) => record),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to create service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    /**
     * Check if any service types exist
     * This is useful for UI components to show appropriate guidance for administrators
     */
    const hasServiceTypes = (): E.Effect<boolean, ServiceTypeStoreError> =>
      pipe(
        getAllServiceTypes(),
        E.map((serviceTypes) => serviceTypes.length > 0),
        E.catchAll((error) => {
          // Handle connection errors gracefully
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected, assuming no service types exist');
            return E.succeed(false);
          }
          return E.fail(
            ServiceTypeStoreError.fromError(error, 'Failed to check if service types exist')
          );
        })
      );

    const getAllServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          pipe(
            serviceTypesService.getAllServiceTypes(),
            E.map((records) =>
              records
                .filter((record) => record && record.signed_action && record.signed_action.hashed)
                .map((record) => {
                  const serviceType: UIServiceType = {
                    ...decodeRecords<ServiceTypeInDHT>([record])[0],
                    original_action_hash: record.signed_action.hashed.hash,
                    previous_action_hash: record.signed_action.hashed.hash,
                    creator: record.signed_action.hashed.content.author,
                    created_at: record.signed_action.hashed.content.timestamp,
                    updated_at: record.signed_action.hashed.content.timestamp
                  };

                  // Cache each service type
                  E.runSync(cache.set(record.signed_action.hashed.hash.toString(), serviceType));

                  syncCacheToState(serviceType, 'add');
                  return serviceType;
                })
            )
          )
        ),
        E.catchAll((error) => {
          // Handle connection errors gracefully
          const errorMessage = String(error);
          if (errorMessage.includes('Client not connected')) {
            console.warn('Holochain client not connected, returning empty service types array');
            return E.succeed([]);
          }
          return E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get all service types'));
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<UIServiceType | null, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          pipe(
            cache.get(serviceTypeHash.toString()),
            E.map((serviceType: UIServiceType) => {
              syncCacheToState(serviceType, 'update');
              return serviceType as UIServiceType | null;
            }),
            E.catchAll(() => E.succeed(null as UIServiceType | null))
          )
        ),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const updateServiceType = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedServiceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          serviceTypesService.updateServiceType(
            originalActionHash,
            previousActionHash,
            updatedServiceType
          )
        ),
        E.flatMap((newActionHash) =>
          pipe(
            serviceTypesService.getServiceType(newActionHash),
            E.map((record) => {
              if (!record) return { record: null, updatedServiceType: null };

              const updatedUIServiceType: UIServiceType = {
                ...decodeRecords<ServiceTypeInDHT>([record])[0],
                original_action_hash: originalActionHash,
                previous_action_hash: newActionHash,
                creator: record.signed_action.hashed.content.author,
                created_at: record.signed_action.hashed.content.timestamp,
                updated_at: Date.now()
              };

              // Update cache
              E.runSync(cache.set(originalActionHash.toString(), updatedUIServiceType));

              syncCacheToState(updatedUIServiceType, 'update');

              return { record, updatedServiceType: updatedUIServiceType };
            })
          )
        ),
        E.tap(({ updatedServiceType }) =>
          updatedServiceType
            ? E.gen(function* () {
              const eventBus = yield* StoreEventBusTag;
              yield* eventBus.emit('serviceType:updated', { serviceType: updatedServiceType });
            }).pipe(
              E.catchAll((error) =>
                E.fail(
                  ServiceTypeStoreError.fromError(
                    error,
                    'Failed to emit service type updated event'
                  )
                )
              ),
              E.provide(StoreEventBusLive)
            )
            : E.asVoid
        ),
        E.map(({ record }) => record!),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to update service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const deleteServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.deleteServiceType(serviceTypeHash)),
        E.tap(() => {
          // Remove from cache
          E.runSync(cache.invalidate(serviceTypeHash.toString()));

          // Remove from local state
          const index = serviceTypes.findIndex(
            (serviceType) =>
              serviceType.original_action_hash?.toString() === serviceTypeHash.toString()
          );
          if (index !== -1) {
            serviceTypes.splice(index, 1);
          }
        }),
        E.tap((deletedServiceType) =>
          deletedServiceType
            ? E.gen(function* () {
              const eventBus = yield* StoreEventBusTag;
              yield* eventBus.emit('serviceType:deleted', { serviceTypeHash });
            }).pipe(
              E.catchAll((error) =>
                E.fail(
                  ServiceTypeStoreError.fromError(
                    error,
                    'Failed to emit service type deleted event'
                  )
                )
              ),
              E.provide(StoreEventBusLive)
            )
            : E.asVoid
        ),
        E.map(() => void 0),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to delete service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    // Return the store object
    return {
      get serviceTypes() {
        return serviceTypes;
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
      getServiceType,
      getAllServiceTypes,
      createServiceType,
      updateServiceType,
      deleteServiceType,
      hasServiceTypes,
      invalidateCache
    };
  });

// Create and export the singleton store instance by running the Effect
const serviceTypesStore = await pipe(
  createServiceTypesStore(),
  E.provide(ServiceTypesServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runPromise
);

// Don't initialize default service types immediately
// Instead, we'll do it when the service is first used
// This ensures the client is connected before we try to initialize

export default serviceTypesStore;
