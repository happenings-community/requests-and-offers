import type { ActionHash, Record } from '@holochain/client';
import type { UIOffer } from '$lib/types/ui';
import type { OfferInDHT, OfferInput } from '$lib/types/holochain';
import { OffersServiceTag, OffersServiceLive } from '$lib/services/zomes/offers.service';
import { decodeRecords } from '$lib/utils';
import usersStore from '$lib/stores/users.store.svelte';
import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
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

export class OfferStoreError extends Data.TaggedError('OfferStoreError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): OfferStoreError {
    if (error instanceof Error) {
      return new OfferStoreError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }

    return new OfferStoreError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

export type OffersStore = {
  readonly offers: UIOffer[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCacheService<UIOffer>;
  getLatestOffer: (originalActionHash: ActionHash) => E.Effect<UIOffer | null, OfferStoreError>;
  getAllOffers: () => E.Effect<UIOffer[], OfferStoreError>;
  getUserOffers: (userHash: ActionHash) => E.Effect<UIOffer[], OfferStoreError>;
  getOrganizationOffers: (organizationHash: ActionHash) => E.Effect<UIOffer[], OfferStoreError>;
  createOffer: (
    offer: OfferInput,
    organizationHash?: ActionHash
  ) => E.Effect<Record, OfferStoreError, EventBusService<StoreEvents>>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInput
  ) => E.Effect<Record, OfferStoreError, EventBusService<StoreEvents>>;
  deleteOffer: (
    offerHash: ActionHash
  ) => E.Effect<void, OfferStoreError, EventBusService<StoreEvents>>;
  invalidateCache: () => void;
};

/**
 * Factory function to create an offers store as an Effect
 * @returns An Effect that creates an offers store with state and methods
 */
export function createOffersStore(): E.Effect<
  OffersStore,
  never,
  OffersServiceTag | CacheServiceTag
> {
  return E.gen(function* () {
    const offersService = yield* OffersServiceTag;
    const cacheService = yield* CacheServiceTag;

    // State
    const offers: UIOffer[] = $state([]);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // Create lookup function for cache misses
    const lookupOffer = (key: string): E.Effect<UIOffer, CacheNotFoundError> =>
      pipe(
        E.tryPromise({
          try: async () => {
            // Try to parse the key as an ActionHash and fetch from service
            const hash = new Uint8Array(Buffer.from(key, 'base64'));
            const record = await E.runPromise(offersService.getLatestOfferRecord(hash));

            if (!record) {
              throw new Error(`Offer not found for key: ${key}`);
            }

            const offer = decodeRecords<OfferInDHT>([record])[0];
            const authorPubKey = record.signed_action.hashed.content.author;
            const userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);

            // Get service types for this offer
            const serviceTypeHashes = await E.runPromise(
              pipe(
                serviceTypesStore.getServiceTypesForEntity({
                  original_action_hash: hash,
                  entity: 'offer'
                }),
                E.catchAll(() => E.succeed([]))
              )
            );

            return {
              ...offer,
              original_action_hash: record.signed_action.hashed.hash,
              previous_action_hash: record.signed_action.hashed.hash,
              creator: userProfile?.original_action_hash || authorPubKey,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp,
              service_type_hashes: serviceTypeHashes
            } as UIOffer;
          },
          catch: () => new CacheNotFoundError({ key })
        }),
        E.mapError(() => new CacheNotFoundError({ key }))
      );

    // Create cache using the cache service
    const cache = yield* cacheService.createEntityCache<UIOffer>(
      {
        expiryMs: 5 * 60 * 1000, // 5 minutes
        debug: false
      },
      lookupOffer
    );

    // Helper function to sync cache with local state
    const syncCacheToState = (entity: UIOffer, operation: 'add' | 'update' | 'remove') => {
      const index = offers.findIndex(
        (o) => o.original_action_hash?.toString() === entity.original_action_hash?.toString()
      );

      switch (operation) {
        case 'add':
        case 'update':
          if (index !== -1) {
            offers[index] = entity;
          } else {
            offers.push(entity);
          }
          break;
        case 'remove':
          if (index !== -1) {
            offers.splice(index, 1);
          }
          break;
      }
    };

    const invalidateCache = (): void => {
      E.runSync(cache.clear());
    };

    const createOffer = (
      offer: OfferInput,
      organizationHash?: ActionHash
    ): E.Effect<Record, OfferStoreError, EventBusService<StoreEvents>> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => offersService.createOffer(offer, organizationHash)),
        E.map((record) => {
          let creatorHash: ActionHash | undefined;
          const currentUser = usersStore.currentUser;

          if (currentUser?.original_action_hash) {
            creatorHash = currentUser.original_action_hash;
          } else {
            creatorHash = record.signed_action.hashed.content.author;
            console.warn('No current user found, using agent pubkey as creator');
          }

          const newOffer: UIOffer = {
            ...decodeRecords<OfferInDHT>([record])[0],
            original_action_hash: record.signed_action.hashed.hash,
            previous_action_hash: record.signed_action.hashed.hash,
            organization: organizationHash,
            creator: creatorHash,
            created_at: Date.now(),
            updated_at: Date.now()
          };

          // Cache the new offer
          E.runSync(cache.set(record.signed_action.hashed.hash.toString(), newOffer));

          syncCacheToState(newOffer, 'add');

          return { record, newOffer };
        }),
        E.tap(({ newOffer }) =>
          newOffer
            ? E.gen(function* () {
                const eventBus = yield* StoreEventBusTag;
                yield* eventBus.emit('offer:created', { offer: newOffer });
              }).pipe(
                E.catchAll((error) =>
                  E.fail(OfferStoreError.fromError(error, 'Failed to emit offer created event'))
                )
              )
            : E.asVoid
        ),
        E.map(({ record }) => record),
        E.catchAll((error) => E.fail(OfferStoreError.fromError(error, 'Failed to create offer'))),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        ),
        E.provide(StoreEventBusLive)
      );

    const getAllOffers = (): E.Effect<UIOffer[], OfferStoreError> =>
      pipe(
        // Set loading state
        E.sync(() => {
          loading = true;
          error = null;
        }),
        // Fetch all offers and organizations
        E.flatMap(() =>
          E.all([
            offersService.getAllOffersRecords(),
            E.tryPromise({
              try: () => organizationsStore.getAcceptedOrganizations(),
              catch: (error) => {
                console.warn('Failed to get accepted organizations during offer mapping:', error);
                return [];
              }
            })
          ])
        ),
        // Map organizations to offers
        E.flatMap(([records, organizations]) => {
          // First, get all offers for each organization
          return pipe(
            E.all(
              organizations.map((org) =>
                org.original_action_hash
                  ? pipe(
                      offersService.getOrganizationOffersRecords(org.original_action_hash),
                      E.map((orgRecords) => ({ org, records: orgRecords }))
                    )
                  : E.succeed({ org, records: [] })
              )
            ),
            // Create a map of offer hash to organization
            E.map((orgOffers) => {
              const offerToOrgMap = new Map<string, UIOffer['organization']>();

              for (const { org, records } of orgOffers) {
                for (const record of records) {
                  offerToOrgMap.set(
                    record.signed_action.hashed.hash.toString(),
                    org.original_action_hash
                  );
                }
              }

              return { records, offerToOrgMap };
            }),
            // Process each offer record
            E.flatMap(({ records, offerToOrgMap }) =>
              E.all(
                records.map((record) => {
                  const offerHash = record.signed_action.hashed.hash;
                  const offer = decodeRecords<OfferInDHT>([record])[0];
                  const authorPubKey = record.signed_action.hashed.content.author;

                  // Get user profile for the offer creator
                  return pipe(
                    E.tryPromise({
                      try: () => usersStore.getUserByAgentPubKey(authorPubKey),
                      catch: (error) => {
                        console.warn('Failed to get user profile during offer mapping:', error);
                        return null;
                      }
                    }),
                    // Get service types for this offer
                    E.flatMap((userProfile) =>
                      pipe(
                        serviceTypesStore.getServiceTypesForEntity({
                          original_action_hash: offerHash,
                          entity: 'offer'
                        }),
                        // Handle errors gracefully
                        E.catchAll((error) => {
                          console.warn(
                            'Failed to get service type hashes during offer mapping:',
                            error
                          );
                          return E.succeed([]);
                        }),
                        // Create the UI offer object
                        E.map((serviceTypeHashes) => {
                          const uiOffer: UIOffer = {
                            ...offer,
                            original_action_hash: offerHash,
                            previous_action_hash: offerHash,
                            creator: userProfile?.original_action_hash || authorPubKey,
                            organization: offerToOrgMap.get(offerHash.toString()),
                            created_at: record.signed_action.hashed.content.timestamp,
                            updated_at: record.signed_action.hashed.content.timestamp,
                            service_type_hashes: serviceTypeHashes
                          };

                          // Cache each offer
                          E.runSync(cache.set(offerHash.toString(), uiOffer));

                          // Update state
                          syncCacheToState(uiOffer, 'add');

                          return uiOffer;
                        })
                      )
                    )
                  );
                })
              )
            )
          );
        }),
        // Handle errors
        E.catchAll((error) => {
          const storeError = OfferStoreError.fromError(error, 'Failed to get all offers');
          return E.fail(storeError);
        }),
        // Reset loading state
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getUserOffers = (userHash: ActionHash): E.Effect<UIOffer[], OfferStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => offersService.getUserOffersRecords(userHash)),
        E.flatMap((records) =>
          E.all(
            records.map((record) => {
              const offerHash = record.signed_action.hashed.hash;

              return pipe(
                E.all([
                  E.succeed(decodeRecords<OfferInDHT>([record])[0]),
                  offersService.getOrganizationOffersRecords(userHash)
                ]),
                E.flatMap(([offer, orgOffers]) =>
                  pipe(
                    serviceTypesStore.getServiceTypesForEntity({
                      original_action_hash: offerHash,
                      entity: 'offer'
                    }),
                    E.catchAll((error) => {
                      console.warn(
                        'Failed to get service type hashes during user offer mapping:',
                        error
                      );
                      return E.succeed([]);
                    }),
                    E.map((serviceTypeHashes) => {
                      const uiOffer: UIOffer = {
                        ...offer,
                        original_action_hash: offerHash,
                        previous_action_hash: offerHash,
                        creator: userHash,
                        organization: orgOffers.find(
                          (r) => r.signed_action.hashed.hash.toString() === offerHash.toString()
                        )
                          ? userHash
                          : undefined,
                        created_at: record.signed_action.hashed.content.timestamp,
                        updated_at: record.signed_action.hashed.content.timestamp,
                        service_type_hashes: serviceTypeHashes
                      };

                      // Cache the offer
                      E.runSync(cache.set(offerHash.toString(), uiOffer));

                      syncCacheToState(uiOffer, 'add');
                      return uiOffer;
                    })
                  )
                )
              );
            })
          )
        ),
        E.catchAll((error) => {
          const storeError = OfferStoreError.fromError(error, 'Failed to get user offers');
          return E.fail(storeError);
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getOrganizationOffers = (
      organizationHash: ActionHash
    ): E.Effect<UIOffer[], OfferStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() => offersService.getOrganizationOffersRecords(organizationHash)),
        E.flatMap((records) =>
          E.all(
            records.map((record) => {
              const offerHash = record.signed_action.hashed.hash;

              const offer = decodeRecords<OfferInDHT>([record])[0];
              const authorPubKey = record.signed_action.hashed.content.author;

              return pipe(
                E.tryPromise({
                  try: () => usersStore.getUserByAgentPubKey(authorPubKey),
                  catch: (error) => {
                    console.warn('Failed to get user profile during offer mapping:', error);
                    return null;
                  }
                }),
                E.flatMap((userProfile) =>
                  pipe(
                    serviceTypesStore.getServiceTypesForEntity({
                      original_action_hash: offerHash,
                      entity: 'offer'
                    }),
                    E.catchAll((error) => {
                      console.warn(
                        'Failed to get service type hashes during organization offer mapping:',
                        error
                      );
                      return E.succeed([]);
                    }),
                    E.map((serviceTypeHashes) => {
                      const uiOffer: UIOffer = {
                        ...offer,
                        original_action_hash: offerHash,
                        previous_action_hash: offerHash,
                        creator: userProfile?.original_action_hash || authorPubKey,
                        organization: organizationHash,
                        created_at: record.signed_action.hashed.content.timestamp,
                        updated_at: record.signed_action.hashed.content.timestamp,
                        service_type_hashes: serviceTypeHashes
                      };

                      // Cache the offer
                      E.runSync(cache.set(offerHash.toString(), uiOffer));

                      syncCacheToState(uiOffer, 'add');
                      return uiOffer;
                    })
                  )
                )
              );
            })
          )
        ),
        E.catchAll((error) => {
          const storeError = OfferStoreError.fromError(error, 'Failed to get organization offers');
          return E.fail(storeError);
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const getLatestOffer = (
      originalActionHash: ActionHash
    ): E.Effect<UIOffer | null, OfferStoreError> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          pipe(
            cache.get(originalActionHash.toString()),
            E.map((offer: UIOffer) => {
              syncCacheToState(offer, 'update');
              return offer as UIOffer | null;
            }),
            E.catchAll(() => E.succeed(null as UIOffer | null))
          )
        ),
        E.catchAll((error) => {
          const storeError = OfferStoreError.fromError(error, 'Failed to get latest offer');
          return E.fail(storeError);
        }),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        )
      );

    const updateOffer = (
      originalActionHash: ActionHash,
      previousActionHash: ActionHash,
      updatedOffer: OfferInput
    ): E.Effect<Record, OfferStoreError, EventBusService<StoreEvents>> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          offersService.updateOffer(originalActionHash, previousActionHash, updatedOffer)
        ),
        E.map((record) => {
          const offerHash = record.signed_action.hashed.hash;

          // Try to get existing from cache
          const existingOffer = E.runSync(
            pipe(
              cache.get(originalActionHash.toString()),
              E.catchAll(() => E.succeed(null))
            )
          );

          let updatedUIOffer: UIOffer | null = null;

          if (existingOffer) {
            updatedUIOffer = {
              ...existingOffer,
              ...decodeRecords<OfferInDHT>([record])[0],
              previous_action_hash: offerHash,
              updated_at: record.signed_action.hashed.content.timestamp
            };

            // Update cache
            E.runSync(cache.set(originalActionHash.toString(), updatedUIOffer));

            syncCacheToState(updatedUIOffer, 'update');
          }

          return { record, updatedUIOffer };
        }),
        E.tap(({ updatedUIOffer }) =>
          updatedUIOffer
            ? E.gen(function* () {
                const eventBus = yield* StoreEventBusTag;
                yield* eventBus.emit('offer:updated', { offer: updatedUIOffer });
              }).pipe(
                E.catchAll((error) =>
                  E.fail(OfferStoreError.fromError(error, 'Failed to emit offer updated event'))
                )
              )
            : E.asVoid
        ),
        E.map(({ record }) => record),
        E.catchAll((error) => E.fail(OfferStoreError.fromError(error, 'Failed to update offer'))),
        E.tap(() =>
          E.sync(() => {
            loading = false;
          })
        ),
        E.provide(StoreEventBusLive)
      );

    const deleteOffer = (
      offerHash: ActionHash
    ): E.Effect<void, OfferStoreError, EventBusService<StoreEvents>> =>
      pipe(
        E.sync(() => {
          loading = true;
          error = null;
        }),
        E.flatMap(() =>
          pipe(
            offersService.deleteOffer(offerHash),
            E.tap(() => {
              // Remove from cache
              E.runSync(cache.invalidate(offerHash.toString()));

              // Remove from local state
              const index = offers.findIndex(
                (offer) => offer.original_action_hash?.toString() === offerHash.toString()
              );
              if (index !== -1) {
                offers.splice(index, 1);
              }
            }),
            E.tap((deletedOffer) =>
              deletedOffer
                ? E.gen(function* () {
                    const eventBus = yield* StoreEventBusTag;
                    yield* eventBus.emit('offer:deleted', { offerHash });
                  }).pipe(
                    E.catchAll((error) =>
                      E.fail(OfferStoreError.fromError(error, 'Failed to emit offer deleted event'))
                    )
                  )
                : E.asVoid
            ),
            E.catchAll((err) => E.fail(OfferStoreError.fromError(err, 'Failed to delete offer'))),
            E.tap(() =>
              E.sync(() => {
                loading = false;
              })
            )
          )
        ),
        E.provide(StoreEventBusLive)
      );

    // Return the store object
    return {
      get offers() {
        return offers;
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
      getLatestOffer,
      getAllOffers,
      getUserOffers,
      getOrganizationOffers,
      createOffer,
      updateOffer,
      deleteOffer,
      invalidateCache
    };
  });
}

// Create a singleton instance of the store by running the Effect with the required services
const offersStore = await pipe(
  createOffersStore(),
  E.provide(OffersServiceLive),
  E.provide(CacheServiceLive),
  E.provide(HolochainClientServiceLive),
  E.runPromise
);

export default offersStore;
