import type { ActionHash, Record } from '@holochain/client';
import type { UIRequest } from '$lib/types/ui';
import type { RequestInDHT, RequestInput } from '$lib/types/holochain';
import { RequestsServiceTag, RequestsServiceLive } from '$lib/services/zomes/requests.service';
import { decodeRecords } from '$lib/utils';
import usersStore from '$lib/stores/users.store.svelte';
import {
  CacheServiceTag,
  CacheServiceLive,
  type EntityCacheService,
  CacheNotFoundError
} from '$lib/utils/cache.svelte';
import { StoreEventBusLive, StoreEventBusTag } from '$lib/stores/storeEvents';
import type { EventBusService } from '$lib/utils/eventBus.effect';
import type { StoreEvents } from '$lib/stores/storeEvents';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import { Data, Effect as E, pipe } from 'effect';
import { HolochainClientServiceLive } from '../services/HolochainClientService.svelte';

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
  ) => E.Effect<Record, RequestStoreError, EventBusService<StoreEvents>>;
  deleteRequest: (
    requestHash: ActionHash
  ) => E.Effect<void, RequestStoreError, EventBusService<StoreEvents>>;
  invalidateCache: () => void;
};

/**
 * Factory function to create a requests store as an Effect
 * @returns An Effect that creates a requests store with state and methods
 */
export function createRequestsStore(): E.Effect<
  RequestsStore,
  never,
  RequestsServiceTag | CacheServiceTag
> {
  return E.gen(function* () {
    const requestsService = yield* RequestsServiceTag;
    const cacheService = yield* CacheServiceTag;

    // State
    const requests: UIRequest[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // Create lookup function for cache misses
    const lookupRequest = (key: string): E.Effect<UIRequest, CacheNotFoundError> =>
      pipe(
        E.tryPromise({
          try: async () => {
            // Try to parse the key as an ActionHash and fetch from service
            const hash = new Uint8Array(Buffer.from(key, 'base64'));
            const record = await E.runPromise(requestsService.getLatestRequestRecord(hash));

            if (!record) {
              throw new Error(`Request not found for key: ${key}`);
            }

            const request = decodeRecords<RequestInDHT>([record])[0];
            const authorPubKey = record.signed_action.hashed.content.author;
            const userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);

            return {
              ...request,
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              creator: userProfile?.original_action_hash || authorPubKey,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp
            } as UIRequest;
          },
          catch: () => new CacheNotFoundError({ key })
        }),
        E.mapError(() => new CacheNotFoundError({ key }))
      );

    // Create cache using the cache service
    const cache = yield* cacheService.createEntityCache<UIRequest>(
      {
        expiryMs: 5 * 60 * 1000, // 5 minutes
        debug: false
      },
      lookupRequest
    );

    // Helper function to sync cache with local state
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

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    const createRequest = (
      request: RequestInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, RequestStoreError, EventBusService<StoreEvents>> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => requestsService.createRequest(request, organizationHash)),
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
        E.tap(({ newRequest }) =>
          newRequest
            ? E.gen(function* () {
              const eventBus = yield* StoreEventBusTag;
              yield* eventBus.emit('request:created', { request: newRequest });
            }).pipe(
              E.catchAll((error) =>
                E.fail(RequestStoreError.fromError(error, 'Failed to emit request created event'))
              )
            )
            : E.asVoid
        ),
        E.map(({ record }) => record),
        E.catchAll((error) =>
          E.fail(RequestStoreError.fromError(error, 'Failed to create request'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        ),
        E.provide(StoreEventBusLive),
      );

    const getAllRequests = (): E.Effect<UIRequest[], RequestStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          pipe(
            E.all([
              requestsService.getAllRequestsRecords(),
              E.tryPromise({
                try: () => organizationsStore.getAcceptedOrganizations(),
                catch: (error) => RequestStoreError.fromError(error, 'Failed to get organizations')
              })
            ]),
            E.flatMap(([records, organizations]) =>
              pipe(
                E.all(
                  organizations.map((org) =>
                    org.original_action_hash
                      ? requestsService.getOrganizationRequestsRecords(org.original_action_hash)
                      : E.succeed([])
                  )
                ),
                E.map((orgRequests) => {
                  const requestToOrgMap = new Map<string, ActionHash>();
                  organizations.forEach((org, index) => {
                    if (!org.original_action_hash) return;
                    orgRequests[index].forEach((record) => {
                      requestToOrgMap.set(
                        record.signed_action.hashed.hash.toString(),
                        org.original_action_hash!
                      );
                    });
                  });
                  return requestToOrgMap;
                }),
                E.flatMap((requestToOrgMap) =>
                  E.all(
                    records.map((record) => {
                      const requestHash = record.signed_action.hashed.hash;

                      const request = decodeRecords<RequestInDHT>([record])[0];
                      const authorPubKey = record.signed_action.hashed.content.author;

                      return pipe(
                        E.tryPromise({
                          try: () => usersStore.getUserByAgentPubKey(authorPubKey),
                          catch: (error) => {
                            console.warn(
                              'Failed to get user profile during request mapping:',
                              error
                            );
                            return null;
                          }
                        }),
                        E.map((userProfile) => {
                          const uiRequest: UIRequest = {
                            ...request,
                            original_action_hash: requestHash,
                            previous_action_hash: requestHash,
                            creator: userProfile?.original_action_hash || authorPubKey,
                            organization: requestToOrgMap.get(requestHash.toString()),
                            created_at: record.signed_action.hashed.content.timestamp,
                            updated_at: record.signed_action.hashed.content.timestamp
                          };

                          // Cache each request
                          E.runSync(cache.set(requestHash.toString(), uiRequest));

                          syncCacheToState(uiRequest, 'add');
                          return uiRequest;
                        })
                      );
                    })
                  )
                )
              )
            )
          )
        ),
        E.catchAll((error) => {
          const storeError = RequestStoreError.fromError(error, 'Failed to get all requests');
          return E.fail(storeError);
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getUserRequests = (userHash: ActionHash): E.Effect<UIRequest[], RequestStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => requestsService.getUserRequestsRecords(userHash)),
        E.flatMap((records) =>
          E.all(
            records.map((record) => {
              const requestHash = record.signed_action.hashed.hash;

              return pipe(
                E.all([
                  E.succeed(decodeRecords<RequestInDHT>([record])[0]),
                  requestsService.getOrganizationRequestsRecords(userHash)
                ]),
                E.map(([request, orgRequests]) => {
                  const uiRequest: UIRequest = {
                    ...request,
                    original_action_hash: requestHash,
                    previous_action_hash: requestHash,
                    creator: userHash,
                    organization: orgRequests.find(
                      (r) => r.signed_action.hashed.hash.toString() === requestHash.toString()
                    )
                      ? userHash
                      : undefined,
                    created_at: record.signed_action.hashed.content.timestamp,
                    updated_at: record.signed_action.hashed.content.timestamp
                  };

                  // Cache the request
                  E.runSync(cache.set(requestHash.toString(), uiRequest));

                  syncCacheToState(uiRequest, 'add');
                  return uiRequest;
                })
              );
            })
          )
        ),
        E.catchAll((error) => {
          const storeError = RequestStoreError.fromError(error, 'Failed to get user requests');
          return E.fail(storeError);
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getOrganizationRequests = (
      organizationHash: ActionHash
    ): E.Effect<UIRequest[], RequestStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => requestsService.getOrganizationRequestsRecords(organizationHash)),
        E.flatMap((records) =>
          E.all(
            records.map((record) => {
              const requestHash = record.signed_action.hashed.hash;

              const request = decodeRecords<RequestInDHT>([record])[0];
              const authorPubKey = record.signed_action.hashed.content.author;

              return pipe(
                E.tryPromise({
                  try: () => usersStore.getUserByAgentPubKey(authorPubKey),
                  catch: (error) => {
                    console.warn('Failed to get user profile during request mapping:', error);
                    return null;
                  }
                }),
                E.map((userProfile) => {
                  const uiRequest: UIRequest = {
                    ...request,
                    original_action_hash: requestHash,
                    previous_action_hash: requestHash,
                    creator: userProfile?.original_action_hash || authorPubKey,
                    organization: organizationHash,
                    created_at: record.signed_action.hashed.content.timestamp,
                    updated_at: record.signed_action.hashed.content.timestamp
                  };

                  // Cache the request
                  E.runSync(cache.set(requestHash.toString(), uiRequest));

                  syncCacheToState(uiRequest, 'add');
                  return uiRequest;
                })
              );
            })
          )
        ),
        E.catchAll((error) => {
          const storeError = RequestStoreError.fromError(
            error,
            'Failed to get organization requests'
          );
          return E.fail(storeError);
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getLatestRequest = (
      originalActionHash: ActionHash
    ): E.Effect<UIRequest | null, RequestStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          pipe(
            cache.get(originalActionHash.toString()),
            E.map((request: UIRequest) => {
              syncCacheToState(request, 'update');
              return request as UIRequest | null;
            }),
            E.catchAll(() => E.succeed(null as UIRequest | null))
          )
        ),
        E.catchAll((error) => {
          const storeError = RequestStoreError.fromError(error, 'Failed to get latest request');
          return E.fail(storeError);
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const updateRequest = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedRequest: RequestInput
    ): E.Effect<Record, RequestStoreError, EventBusService<StoreEvents>> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          requestsService.updateRequest(originalActionHash, previousActionHash, updatedRequest)
        ),
        E.map((record) => {
          const requestHash = record.signed_action.hashed.hash;

          // Try to get existing from cache
          const existingRequest = E.runSync(
            pipe(
              cache.get(originalActionHash.toString()),
              E.catchAll(() => E.succeed(null))
            )
          );

          let updatedUIRequest: UIRequest | null = null;

          if (existingRequest) {
            updatedUIRequest = {
              ...existingRequest,
              ...decodeRecords<RequestInDHT>([record])[0],
              previous_action_hash: requestHash,
              updated_at: record.signed_action.hashed.content.timestamp
            };

            // Update cache
            E.runSync(cache.set(originalActionHash.toString(), updatedUIRequest));

            syncCacheToState(updatedUIRequest, 'update');
          }

          return { record, updatedUIRequest };
        }),
        E.tap(({ updatedUIRequest }) =>
          updatedUIRequest
            ? E.gen(function* () {
              const eventBus = yield* StoreEventBusTag;
              yield* eventBus.emit('request:updated', { request: updatedUIRequest });
            }).pipe(
              E.catchAll((error) =>
                E.fail(RequestStoreError.fromError(error, 'Failed to emit request updated event'))
              )
            )
            : E.asVoid
        ),
        E.map(({ record }) => record),
        E.catchAll((error) =>
          E.fail(RequestStoreError.fromError(error, 'Failed to update request'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        ),
        E.provide(StoreEventBusLive),
      );

    const deleteRequest = (
      requestHash: ActionHash
    ): E.Effect<void, RequestStoreError, EventBusService<StoreEvents>> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => requestsService.deleteRequest(requestHash)),
        E.tap(() => {
          // Remove from cache
          E.runSync(cache.invalidate(requestHash.toString()));

          // Remove from local state
          const index = requests.findIndex(
            (request) => request.original_action_hash?.toString() === requestHash.toString()
          );
          if (index !== -1) {
            requests.splice(index, 1);
          }
        }),
        E.tap((deletedRequest) =>
          deletedRequest
            ? E.gen(function* () {
              const eventBus = yield* StoreEventBusTag;
              yield* eventBus.emit('request:deleted', { requestHash });
            }).pipe(
              E.catchAll((error) =>
                E.fail(RequestStoreError.fromError(error, 'Failed to emit request deleted event'))
              )
            )
            : E.asVoid
        ),
        E.catchAll((error) =>
          E.fail(RequestStoreError.fromError(error, 'Failed to delete request'))
        ),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        ),
        E.provide(StoreEventBusLive),
      );

    // Return the store object
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
      invalidateCache
    };
  });
}

// Create a singleton instance of the store by running the Effect with the required services
const requestsStore = await pipe(
  createRequestsStore(),
  E.provide(RequestsServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runPromise
);

export default requestsStore;
