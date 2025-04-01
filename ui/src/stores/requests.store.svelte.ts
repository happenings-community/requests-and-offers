import type { ActionHash, Record } from '@holochain/client';
import type { UIRequest } from '@/types/ui';
import type { RequestInDHT } from '@/types/holochain';
import requestsService, { type RequestsService } from '@/services/zomes/requests.service';
import { decodeRecords } from '@utils';
import { type EventBus } from '@/utils/eventBus';
import usersStore from '@/stores/users.store.svelte';
import { createEntityCache, type EntityCache } from '@/utils/cache.svelte';
import { storeEventBus, type StoreEvents } from '@/stores/storeEvents';
import organizationsStore from '@/stores/organizations.store.svelte';
import * as E from '@effect/io/Effect';
import { pipe } from '@effect/data/Function';

export class RequestStoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RequestStoreError';
  }

  static fromError(error: unknown, context: string): RequestStoreError {
    if (error instanceof Error) {
      return new RequestStoreError(`${context}: ${error.message}`, error);
    }
    return new RequestStoreError(`${context}: ${String(error)}`, error);
  }
}

export type RequestsStore = {
  readonly requests: UIRequest[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIRequest>;
  getLatestRequest: (
    originalActionHash: ActionHash
  ) => E.Effect<never, RequestStoreError, UIRequest | null>;
  getAllRequests: () => E.Effect<never, RequestStoreError, UIRequest[]>;
  getUserRequests: (userHash: ActionHash) => E.Effect<never, RequestStoreError, UIRequest[]>;
  getOrganizationRequests: (
    organizationHash: ActionHash
  ) => E.Effect<never, RequestStoreError, UIRequest[]>;
  createRequest: (
    request: RequestInDHT,
    organizationHash?: ActionHash
  ) => E.Effect<never, RequestStoreError, Record>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => E.Effect<never, RequestStoreError, Record>;
  deleteRequest: (requestHash: ActionHash) => E.Effect<never, RequestStoreError, void>;
  invalidateCache: () => void;
};

/**
 * Factory function to create a requests store
 * @returns A requests store with state and methods
 */
export function createRequestsStore(
  requestsService: RequestsService,
  eventBus: EventBus<StoreEvents>
): RequestsStore {
  // State
  const requests: UIRequest[] = $state([]);
  let loading: boolean = $state(false);
  let error: string | null = $state(null);

  // Create a cache for requests
  const cache = createEntityCache<UIRequest>({
    expiryMs: 5 * 60 * 1000, // 5 minutes
    debug: false
  });

  // Set up cache event listeners
  cache.on('cache:set', ({ entity }) => {
    const index = requests.findIndex(
      (r) => r.original_action_hash?.toString() === entity.original_action_hash?.toString()
    );

    if (index !== -1) {
      requests[index] = entity;
    } else {
      requests.push(entity);
    }
  });

  cache.on('cache:remove', ({ hash }) => {
    const index = requests.findIndex((r) => r.original_action_hash?.toString() === hash);
    if (index !== -1) {
      requests.splice(index, 1);
    }
  });

  const invalidateCache = (): void => cache.clear();

  const createRequest = (
    request: RequestInDHT,
    organizationHash?: ActionHash
  ): E.Effect<never, RequestStoreError, Record> =>
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

        cache.set(newRequest);
        eventBus.emit('request:created', { request: newRequest });
        return record;
      }),
      E.catchAll((error) => {
        const storeError = RequestStoreError.fromError(error, 'Failed to create request');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
    );

  const getAllRequests = (): E.Effect<never, RequestStoreError, UIRequest[]> =>
    pipe(
      E.sync(() => {
        loading = true;
        error = null;
      }),
      E.flatMap(() => {
        const cachedRequests = cache.getAllValid();
        if (cachedRequests.length > 0) {
          return E.succeed(cachedRequests);
        }

        return pipe(
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
                    const cachedRequest = cache.get(requestHash);

                    if (cachedRequest) {
                      return E.succeed(cachedRequest);
                    }

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
                          organization: requestToOrgMap.get(requestHash.toString()),
                          created_at: record.signed_action.hashed.content.timestamp,
                          updated_at: record.signed_action.hashed.content.timestamp
                        };

                        cache.set(uiRequest);
                        return uiRequest;
                      })
                    );
                  })
                )
              )
            )
          )
        );
      }),
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

  const getUserRequests = (userHash: ActionHash): E.Effect<never, RequestStoreError, UIRequest[]> =>
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
            const cachedRequest = cache.get(requestHash);

            if (cachedRequest) {
              return E.succeed(cachedRequest);
            }

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

                cache.set(uiRequest);
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
  ): E.Effect<never, RequestStoreError, UIRequest[]> =>
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
            const cachedRequest = cache.get(requestHash);

            if (cachedRequest) {
              return E.succeed(cachedRequest);
            }

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

                cache.set(uiRequest);
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
  ): E.Effect<never, RequestStoreError, UIRequest | null> =>
    pipe(
      E.sync(() => {
        loading = true;
        error = null;
      }),
      E.flatMap(() => requestsService.getLatestRequestRecord(originalActionHash)),
      E.flatMap((record) => {
        if (!record) {
          return E.succeed(null);
        }

        const requestHash = record.signed_action.hashed.hash;
        const cachedRequest = cache.get(requestHash);

        if (cachedRequest) {
          return E.succeed(cachedRequest);
        }

        const request = decodeRecords<RequestInDHT>([record])[0];
        const authorPubKey = record.signed_action.hashed.content.author;

        return pipe(
          E.all([
            E.tryPromise({
              try: () => usersStore.getUserByAgentPubKey(authorPubKey),
              catch: (error) => {
                console.warn('Failed to get user profile during request mapping:', error);
                return null;
              }
            }),
            requestsService.getOrganizationRequestsRecords(originalActionHash)
          ]),
          E.map(([userProfile, orgRequests]) => {
            const uiRequest: UIRequest = {
              ...request,
              original_action_hash: requestHash,
              previous_action_hash: requestHash,
              creator: userProfile?.original_action_hash || authorPubKey,
              organization: orgRequests.find(
                (r) => r.signed_action.hashed.hash.toString() === requestHash.toString()
              )
                ? originalActionHash
                : undefined,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp
            };

            cache.set(uiRequest);
            return uiRequest;
          })
        );
      }),
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
    updatedRequest: RequestInDHT
  ): E.Effect<never, RequestStoreError, Record> =>
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
        const existingRequest = cache.get(originalActionHash);

        if (existingRequest) {
          const updatedUIRequest: UIRequest = {
            ...existingRequest,
            ...decodeRecords<RequestInDHT>([record])[0],
            previous_action_hash: requestHash,
            updated_at: record.signed_action.hashed.content.timestamp
          };

          cache.set(updatedUIRequest);
          eventBus.emit('request:updated', { request: updatedUIRequest });
        }

        return record;
      }),
      E.catchAll((error) => {
        const storeError = RequestStoreError.fromError(error, 'Failed to update request');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
    );

  const deleteRequest = (requestHash: ActionHash): E.Effect<never, RequestStoreError, void> =>
    pipe(
      E.sync(() => {
        loading = true;
        error = null;
      }),
      E.flatMap(() => requestsService.deleteRequest(requestHash)),
      E.map(() => {
        cache.remove(requestHash);
        eventBus.emit('request:deleted', { requestHash });
      }),
      E.catchAll((error) => {
        const storeError = RequestStoreError.fromError(error, 'Failed to delete request');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
    );

  return {
    requests,
    loading,
    error,
    cache,
    getLatestRequest,
    getAllRequests,
    getUserRequests,
    getOrganizationRequests,
    createRequest,
    updateRequest,
    deleteRequest,
    invalidateCache
  };
}

// Create a singleton instance of the store
const requestsStore = createRequestsStore(requestsService, storeEventBus);
export default requestsStore;
