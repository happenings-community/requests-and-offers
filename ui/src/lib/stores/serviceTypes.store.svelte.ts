/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActionHash, Record } from '@holochain/client';
import {
  ServiceTypesServiceTag,
  ServiceTypesServiceLive
} from '$lib/services/zomes/serviceTypes.service';
import type { GetServiceTypeForEntityInput } from '$lib/services/zomes/serviceTypes.service';
import type { UIServiceType } from '$lib/types/ui';
import type { ServiceTypeInDHT } from '$lib/types/holochain';
import { decodeRecords } from '$lib/utils';
import { decode } from '@msgpack/msgpack';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService,
  CacheNotFoundError
} from '$lib/utils/cache.svelte';
import { StoreEventBusLive, StoreEventBusTag } from '$lib/stores/storeEvents';
import { Effect as E, pipe, Schema } from 'effect';
import { HolochainClientLive } from '../services/holochainClient.service';
import { ServiceTypeStoreError } from '$lib/errors/service-types.errors';

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
              updated_at: record.signed_action.hashed.content.timestamp,
              status: 'approved'
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

    /**
     * Emits a service type created event
     */
    const emitServiceTypeCreated = (serviceType: UIServiceType) =>
      E.ignore(
        E.gen(function* () {
          const eventBus = yield* StoreEventBusTag;
          yield* eventBus.emit('serviceType:created', { serviceType });
        }).pipe(
          E.catchAll(() => E.void),
          E.provide(StoreEventBusLive)
        )
      );

    /**
     * Emits a service type updated event
     */
    const emitServiceTypeUpdated = (serviceType: UIServiceType) =>
      E.ignore(
        E.gen(function* () {
          const eventBus = yield* StoreEventBusTag;
          yield* eventBus.emit('serviceType:updated', { serviceType });
        }).pipe(
          E.catchAll(() => E.void),
          E.provide(StoreEventBusLive)
        )
      );

    /**
     * Emits a service type suggested event
     */
    const emitServiceTypeSuggested = (serviceType: UIServiceType) =>
      E.ignore(
        E.gen(function* () {
          const eventBus = yield* StoreEventBusTag;
          yield* eventBus.emit('serviceType:suggested', { serviceType });
        }).pipe(
          E.catchAll(() => E.void),
          E.provide(StoreEventBusLive)
        )
      );

    /**
     * Emits a service type approved event
     */
    const emitServiceTypeApproved = (serviceTypeHash: ActionHash): E.Effect<void, never, never> =>
      pipe(
        E.gen(function* () {
          const eventBus = yield* StoreEventBusTag;
          yield* eventBus.emit('serviceType:approved', { serviceTypeHash });
        }),
        E.catchAll(() => E.void),
        E.provide(StoreEventBusLive)
      ) as unknown as E.Effect<void, never, never>;

    /**
     * Emits a service type rejected event
     */
    const emitServiceTypeRejected = (serviceTypeHash: ActionHash): E.Effect<void, never, never> =>
      pipe(
        E.gen(function* () {
          const eventBus = yield* StoreEventBusTag;
          yield* eventBus.emit('serviceType:rejected', { serviceTypeHash });
        }),
        E.catchAll(() => E.void),
        E.provide(StoreEventBusLive)
      ) as unknown as E.Effect<void, never, never>;

    /**
     * Emits a service type deleted event
     */
    const emitServiceTypeDeleted = (serviceTypeHash: ActionHash): E.Effect<void, never, never> =>
      pipe(
        E.gen(function* () {
          const eventBus = yield* StoreEventBusTag;
          yield* eventBus.emit('serviceType:deleted', { serviceTypeHash });
        }),
        E.catchAll(() => E.void),
        E.provide(StoreEventBusLive)
      ) as unknown as E.Effect<void, never, never>;

    // Helper function to determine service type status dynamically
    const determineServiceTypeStatus = (
      serviceTypeHash: ActionHash
    ): E.Effect<'pending' | 'approved' | 'rejected', ServiceTypeStoreError> =>
      pipe(
        E.all([
          serviceTypesService.getPendingServiceTypes(),
          serviceTypesService.getApprovedServiceTypes(),
          serviceTypesService.getRejectedServiceTypes()
        ]),
        E.map(([pendingRecords, approvedRecords, rejectedRecords]) => {
          const hashString = serviceTypeHash.toString();

          if (pendingRecords.some((r) => r.signed_action.hashed.hash.toString() === hashString)) {
            return 'pending';
          } else if (
            approvedRecords.some((r) => r.signed_action.hashed.hash.toString() === hashString)
          ) {
            return 'approved';
          } else if (
            rejectedRecords.some((r) => r.signed_action.hashed.hash.toString() === hashString)
          ) {
            return 'rejected';
          }

          return 'approved' as const; // default fallback
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to determine service type status'))
        )
      );

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
            updated_at: Date.now(),
            status: 'pending'
          };

          // Cache the new service type
          E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newServiceType));

          syncCacheToState(newServiceType, 'add');

          // Also add to the appropriate status-specific array
          if (newServiceType.status === 'pending') {
            pendingServiceTypes.push(newServiceType);
          } else if (newServiceType.status === 'approved') {
            approvedServiceTypes.push(newServiceType);
          } else if (newServiceType.status === 'rejected') {
            rejectedServiceTypes.push(newServiceType);
          }

          return { record, newServiceType };
        }),
        E.tap(({ newServiceType }) =>
          newServiceType ? emitServiceTypeCreated(newServiceType) : E.asVoid
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
            E.flatMap((result: { pending: Record[]; approved: Record[]; rejected: Record[] }) =>
              E.try({
                try: () => {
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
                        const entry = decode(
                          (record.entry as HolochainEntry).Present.entry
                        ) as ServiceTypeInDHT;
                        const actionHash = record.signed_action.hashed.hash;

                        return {
                          ...entry,
                          original_action_hash: actionHash,
                          previous_action_hash: actionHash, // Assuming same for new entries
                          creator: record.signed_action.hashed.content.author,
                          created_at: record.signed_action.hashed.content.timestamp,
                          updated_at: record.signed_action.hashed.content.timestamp,
                          status: status
                        };
                      });

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

                  // Update cache and sync state for all new/updated service types
                  allNewServiceTypes.forEach((st) => {
                    E.runSync(cache.set(st.original_action_hash?.toString() || '', st));
                    syncCacheToState(st, 'add'); // 'add' will also update if exists due to cache behavior
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
            E.catchAll(() => E.succeed(null as UIServiceType | null)),
            E.flatMap((cachedServiceType) => {
              // If found in cache, return it
              if (cachedServiceType) {
                // Don't sync to state for individual lookups to avoid reactive loops
                return E.succeed(cachedServiceType);
              }

              // If not in cache, fetch from service and determine status
              return pipe(
                serviceTypesService.getServiceType(serviceTypeHash),
                E.flatMap((record) => {
                  if (!record) {
                    return E.succeed(null);
                  }

                  // Determine the actual status dynamically
                  return pipe(
                    determineServiceTypeStatus(serviceTypeHash),
                    E.map((status) => {
                      const serviceType: UIServiceType = {
                        ...decodeRecords<ServiceTypeInDHT>([record])[0],
                        original_action_hash: record.signed_action.hashed.hash,
                        previous_action_hash: record.signed_action.hashed.hash,
                        creator: record.signed_action.hashed.content.author,
                        created_at: record.signed_action.hashed.content.timestamp,
                        updated_at: record.signed_action.hashed.content.timestamp,
                        status
                      };

                      // Cache the fetched service type
                      E.runSync(cache.set(serviceTypeHash.toString(), serviceType));

                      // Don't sync to state for individual lookups to avoid reactive loops
                      return serviceType;
                    }),
                    E.catchAll(() => E.succeed(null as UIServiceType | null))
                  );
                }),
                E.catchAll(() => E.succeed(null as UIServiceType | null))
              );
            })
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

              // For updates, preserve the original status unless we know it changed
              // Since this is an update operation, the status likely hasn't changed
              const updatedUIServiceType: UIServiceType = {
                ...decodeRecords<ServiceTypeInDHT>([record])[0],
                original_action_hash: originalActionHash,
                previous_action_hash: newActionHash,
                creator: record.signed_action.hashed.content.author,
                created_at: record.signed_action.hashed.content.timestamp,
                updated_at: Date.now(),
                status: 'approved' // TODO: Consider fetching actual status if needed
              };

              // Update cache
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

          // Remove from all local state arrays
          const removeFromArray = (array: UIServiceType[]) => {
            const index = array.findIndex(
              (serviceType) =>
                serviceType.original_action_hash?.toString() === serviceTypeHash.toString()
            );
            if (index !== -1) {
              // Create a new array without the deleted item for reactivity
              array.splice(index, 1);
              return true;
            }
            return false;
          };

          // Try to remove from each array
          removeFromArray(serviceTypes);
          removeFromArray(pendingServiceTypes);
          removeFromArray(approvedServiceTypes);
          removeFromArray(rejectedServiceTypes);
        }),
        // Emit deletion event after state has been updated
        E.tap(() => emitServiceTypeDeleted(serviceTypeHash)),
        E.asVoid,
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to delete service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getServiceTypesForEntity = (
      input: GetServiceTypeForEntityInput
    ): E.Effect<ActionHash[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getServiceTypesForEntity(input)),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get service types for entity'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getPendingServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getPendingServiceTypes()),
        E.map((records) => {
          const uiServiceTypes = records.map(
            (record): UIServiceType => ({
              ...decodeRecords<ServiceTypeInDHT>([record])[0],
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              creator: record.signed_action.hashed.content.author,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp,
              status: 'pending'
            })
          );

          // Update local state
          pendingServiceTypes.splice(0, pendingServiceTypes.length, ...uiServiceTypes);

          return uiServiceTypes;
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get pending service types'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getApprovedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getApprovedServiceTypes()),
        E.map((records) => {
          const uiServiceTypes = records.map(
            (record): UIServiceType => ({
              ...decodeRecords<ServiceTypeInDHT>([record])[0],
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              creator: record.signed_action.hashed.content.author,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp,
              status: 'approved'
            })
          );

          // Update local state
          approvedServiceTypes.splice(0, approvedServiceTypes.length, ...uiServiceTypes);

          return uiServiceTypes;
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get approved service types'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getRejectedServiceTypes = (): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getRejectedServiceTypes()),
        E.map((records) => {
          const uiServiceTypes = records.map(
            (record): UIServiceType => ({
              ...decodeRecords<ServiceTypeInDHT>([record])[0],
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              creator: record.signed_action.hashed.content.author,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp,
              status: 'rejected'
            })
          );

          // Update local state
          rejectedServiceTypes.splice(0, rejectedServiceTypes.length, ...uiServiceTypes);

          return uiServiceTypes;
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get rejected service types'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const suggestServiceType = (
      serviceType: ServiceTypeInDHT
    ): E.Effect<Record, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.suggestServiceType(serviceType)),
        E.map((record) => {
          const newServiceType: UIServiceType = {
            ...decodeRecords<ServiceTypeInDHT>([record])[0],
            original_action_hash: record.signed_action.hashed.hash,
            previous_action_hash: record.signed_action.hashed.hash,
            creator: record.signed_action.hashed.content.author,
            created_at: Date.now(),
            updated_at: Date.now(),
            status: 'pending'
          };

          // Cache the new service type suggestion
          E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newServiceType));

          // Add to pending service types
          pendingServiceTypes.push(newServiceType);

          return { record, newServiceType };
        }),
        E.tap(({ newServiceType }) =>
          newServiceType ? emitServiceTypeSuggested(newServiceType) : E.asVoid
        ),
        E.map(({ record }) => record),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to suggest service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const approveServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.approveServiceType(serviceTypeHash)),
        E.tap(() => {
          // Check if service type is in pending state
          const pendingIndex = pendingServiceTypes.findIndex(
            (st) => st.original_action_hash?.toString() === serviceTypeHash.toString()
          );
          if (pendingIndex !== -1) {
            const serviceType = pendingServiceTypes.splice(pendingIndex, 1)[0];
            if (serviceType) {
              serviceType.status = 'approved';
              approvedServiceTypes.push(serviceType);
              // Update cache entry with new status
              E.runSync(cache.set(serviceType.original_action_hash?.toString() || '', serviceType));
            }
          }

          // Check if service type is in rejected state
          const rejectedIndex = rejectedServiceTypes.findIndex(
            (st) => st.original_action_hash?.toString() === serviceTypeHash.toString()
          );
          if (rejectedIndex !== -1) {
            const serviceType = rejectedServiceTypes.splice(rejectedIndex, 1)[0];
            if (serviceType) {
              serviceType.status = 'approved';
              approvedServiceTypes.push(serviceType);
              // Update cache entry with new status
              E.runSync(cache.set(serviceType.original_action_hash?.toString() || '', serviceType));
            }
          }
        }),
        E.tap(() => emitServiceTypeApproved(serviceTypeHash)),
        E.asVoid,
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to approve service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const rejectServiceType = (
      serviceTypeHash: ActionHash
    ): E.Effect<void, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.rejectServiceType(serviceTypeHash)),
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
              E.runSync(cache.set(serviceType.original_action_hash?.toString() || '', serviceType));
            }
          }

          // No-op inside, actual emission done in next tap
        }),
        E.tap(() => emitServiceTypeRejected(serviceTypeHash)),
        E.asVoid,
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to reject service type'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    // Tag-related methods
    const getAllTags = (): E.Effect<string[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getAllServiceTypeTags()),
        E.map((tags) => {
          allTags.splice(0, allTags.length, ...tags);
          return tags;
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get all tags'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const loadAllTags = (): E.Effect<string[], ServiceTypeStoreError> =>
      pipe(
        serviceTypesService.getAllServiceTypeTags(),
        E.tap((tags) =>
          E.sync(() => {
            allTags.splice(0, allTags.length, ...tags);
          })
        ),
        E.mapError((err) => ServiceTypeStoreError.fromError(err, 'Failed to load all tags'))
      );

    const getServiceTypesByTag = (tag: string): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getServiceTypesByTag(tag)),
        E.map((records) => {
          // Use the existing mapRecordsToUIServiceTypes helper function from getAllServiceTypes
          const mapRecordsToUIServiceTypes = (
            recordsArray: Record[],
            status: 'pending' | 'approved' | 'rejected'
          ): UIServiceType[] =>
            recordsArray
              .map((record) => {
                try {
                  const decodedServiceType = decodeRecords<ServiceTypeInDHT>([record])[0];
                  if (!decodedServiceType) return null;

                  return {
                    ...decodedServiceType,
                    original_action_hash: record.signed_action.hashed.hash,
                    previous_action_hash: record.signed_action.hashed.hash,
                    creator: record.signed_action.hashed.content.author,
                    created_at: record.signed_action.hashed.content.timestamp,
                    updated_at: record.signed_action.hashed.content.timestamp,
                    status
                  } as UIServiceType;
                } catch (error) {
                  console.error('Error decoding service type record:', error);
                  return null;
                }
              })
              .filter((serviceType): serviceType is UIServiceType => serviceType !== null);

          const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'approved');
          searchResults.splice(0, searchResults.length, ...uiServiceTypes);
          return uiServiceTypes;
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get service types by tag'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getServiceTypesByTags = (
      tags: string[]
    ): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getServiceTypesByTags(tags)),
        E.map((records) => {
          // Convert Records to UIServiceType using the same helper function
          const mapRecordsToUIServiceTypes = (
            recordsArray: Record[],
            status: 'pending' | 'approved' | 'rejected'
          ): UIServiceType[] =>
            recordsArray
              .map((record) => {
                try {
                  const decodedServiceType = decodeRecords<ServiceTypeInDHT>([record])[0];
                  if (!decodedServiceType) return null;

                  return {
                    ...decodedServiceType,
                    original_action_hash: record.signed_action.hashed.hash,
                    previous_action_hash: record.signed_action.hashed.hash,
                    creator: record.signed_action.hashed.content.author,
                    created_at: record.signed_action.hashed.content.timestamp,
                    updated_at: record.signed_action.hashed.content.timestamp,
                    status
                  } as UIServiceType;
                } catch (error) {
                  console.error('Error decoding service type record:', error);
                  return null;
                }
              })
              .filter((serviceType): serviceType is UIServiceType => serviceType !== null);

          const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'approved');
          searchResults.splice(0, searchResults.length, ...uiServiceTypes);
          return uiServiceTypes;
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get service types by tags'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const searchServiceTypesByTagPrefix = (
      prefix: string
    ): E.Effect<UIServiceType[], ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.searchServiceTypesByTagPrefix(prefix)),
        E.map((records) => {
          // Convert Records to UIServiceType using the same helper function
          const mapRecordsToUIServiceTypes = (
            recordsArray: Record[],
            status: 'pending' | 'approved' | 'rejected'
          ): UIServiceType[] =>
            recordsArray
              .map((record) => {
                try {
                  const decodedServiceType = decodeRecords<ServiceTypeInDHT>([record])[0];
                  if (!decodedServiceType) return null;

                  return {
                    ...decodedServiceType,
                    original_action_hash: record.signed_action.hashed.hash,
                    previous_action_hash: record.signed_action.hashed.hash,
                    creator: record.signed_action.hashed.content.author,
                    created_at: record.signed_action.hashed.content.timestamp,
                    updated_at: record.signed_action.hashed.content.timestamp,
                    status
                  } as UIServiceType;
                } catch (error) {
                  console.error('Error decoding service type record:', error);
                  return null;
                }
              })
              .filter((serviceType): serviceType is UIServiceType => serviceType !== null);

          const uiServiceTypes = mapRecordsToUIServiceTypes(records, 'approved');
          searchResults.splice(0, searchResults.length, ...uiServiceTypes);
          return uiServiceTypes;
        }),
        E.catchAll((error) =>
          E.fail(
            ServiceTypeStoreError.fromError(error, 'Failed to search service types by tag prefix')
          )
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getTagStatistics = (): E.Effect<Array<[string, number]>, ServiceTypeStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => serviceTypesService.getTagStatistics()),
        E.map((statistics) => {
          tagStatistics.splice(0, tagStatistics.length, ...statistics);
          return statistics;
        }),
        E.catchAll((error) =>
          E.fail(ServiceTypeStoreError.fromError(error, 'Failed to get tag statistics'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

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

    // Return the store object
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

      getServiceType,
      getAllServiceTypes,
      createServiceType,
      updateServiceType,
      deleteServiceType,
      hasServiceTypes,
      getServiceTypesForEntity,
      invalidateCache,
      suggestServiceType,
      approveServiceType,
      rejectServiceType,
      getPendingServiceTypes,
      getApprovedServiceTypes,
      getRejectedServiceTypes,
      getAllTags,
      loadAllTags,
      getServiceTypesByTag,
      getServiceTypesByTags,
      searchServiceTypesByTagPrefix,
      getTagStatistics,
      setSelectedTags,
      addSelectedTag,
      removeSelectedTag,
      clearSelectedTags
    };
  });

// Create and export the singleton store instance by running the Effect
const serviceTypesStore = await pipe(
  createServiceTypesStore(),
  E.provide(ServiceTypesServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientLive),
  E.runPromise
);

// Don't initialize default service types immediately
// Instead, we'll do it when the service is first used
// This ensures the client is connected before we try to initialize

export default serviceTypesStore;
