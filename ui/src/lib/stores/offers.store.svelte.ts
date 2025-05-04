import type { ActionHash, Record } from '@holochain/client';
import type { UIOffer } from '$lib/types/ui';
import type { OfferInDHT } from '$lib/types/holochain';
import offersService, { type OffersService } from '$lib/services/zomes/offers.service';
import { decodeRecords } from '$lib/utils';
import usersStore from '$lib/stores/users.store.svelte';
import { createEntityCache, type EntityCache } from '$lib/utils/cache.svelte';
import { StoreEventBusLive, StoreEventBusTag } from '$lib/stores/storeEvents';
import type { EventBusError, EventBusService } from '$lib/utils/eventBus.effect';
import type { StoreEvents } from '$lib/stores/storeEvents';
import organizationsStore from '$lib/stores/organizations.store.svelte';
import { Effect, pipe } from 'effect';

export class OfferStoreError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OfferStoreError';
  }

  static fromError(error: unknown, context: string): OfferStoreError {
    if (error instanceof Error) {
      return new OfferStoreError(`${context}: ${error.message}`, error);
    }
    return new OfferStoreError(`${context}: ${String(error)}`, error);
  }
}

export type OffersStore = {
  readonly offers: UIOffer[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIOffer>;
  getLatestOffer: (
    originalActionHash: ActionHash
  ) => Effect.Effect<UIOffer | null, OfferStoreError>;
  getAllOffers: () => Effect.Effect<UIOffer[], OfferStoreError>;
  getUserOffers: (userHash: ActionHash) => Effect.Effect<UIOffer[], OfferStoreError>;
  getOrganizationOffers: (
    organizationHash: ActionHash
  ) => Effect.Effect<UIOffer[], OfferStoreError>;
  createOffer: (
    offer: OfferInDHT,
    organizationHash?: ActionHash
  ) => Effect.Effect<Record, OfferStoreError | EventBusError>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => Effect.Effect<Record, OfferStoreError | EventBusError>;
  deleteOffer: (offerHash: ActionHash) => Effect.Effect<void, OfferStoreError | EventBusError>;
  invalidateCache: () => void;
};

/**
 * Factory function to create an offers store
 * @returns An offers store with state and methods
 */
export function createOffersStore(offersService: OffersService): OffersStore {
  // State
  const offers: UIOffer[] = $state([]);
  let loading: boolean = $state(false);
  let error: string | null = $state(null);

  // Create a cache for offers
  const cache = createEntityCache<UIOffer>({
    expiryMs: 5 * 60 * 1000, // 5 minutes
    debug: false
  });

  // Set up cache event listeners
  cache.on('cache:set', ({ entity }) => {
    const index = offers.findIndex(
      (o) => o.original_action_hash?.toString() === entity.original_action_hash?.toString()
    );

    if (index !== -1) {
      offers[index] = entity;
    } else {
      offers.push(entity);
    }
  });

  cache.on('cache:remove', ({ hash }) => {
    const index = offers.findIndex((o) => o.original_action_hash?.toString() === hash);
    if (index !== -1) {
      offers.splice(index, 1);
    }
  });

  const invalidateCache = (): void => cache.clear();

  const createOffer = (
    offer: OfferInDHT,
    organizationHash?: ActionHash
  ): Effect.Effect<Record, OfferStoreError | EventBusError> =>
    pipe(
      Effect.sync(() => {
        loading = true;
        error = null;
      }),
      Effect.flatMap(() => offersService.createOffer(offer, organizationHash)),
      Effect.map((record) => {
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

        cache.set(newOffer);
        return { record, newOffer };
      }),
      Effect.flatMap(({ record, newOffer }) =>
        newOffer
          ? pipe(
              StoreEventBusTag,
              Effect.flatMap((eventBus) => eventBus.emit('offer:created', { offer: newOffer })),
              Effect.map(() => record)
            )
          : pipe(
              StoreEventBusTag,
              Effect.map(() => record)
            )
      ),
      Effect.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to create offer');
        return Effect.fail(storeError);
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          loading = false;
        })
      ),
      Effect.provide(StoreEventBusLive)
    );

  const getAllOffers = (): Effect.Effect<UIOffer[], OfferStoreError> =>
    pipe(
      Effect.sync(() => {
        loading = true;
        error = null;
      }),
      Effect.flatMap(() => {
        const cachedOffers = cache.getAllValid();
        if (cachedOffers.length > 0) {
          return Effect.succeed(cachedOffers);
        }

        return pipe(
          Effect.all([
            offersService.getAllOffersRecords(),
            Effect.tryPromise({
              try: () => organizationsStore.getAcceptedOrganizations(),
              catch: (error) => OfferStoreError.fromError(error, 'Failed to get organizations')
            })
          ]),
          Effect.flatMap(([records, organizations]) =>
            pipe(
              Effect.all(
                organizations.map((org) =>
                  org.original_action_hash
                    ? offersService.getOrganizationOffersRecords(org.original_action_hash)
                    : Effect.succeed([])
                )
              ),
              Effect.map((orgOffers) => {
                const offerToOrgMap = new Map<string, ActionHash>();
                organizations.forEach((org, index) => {
                  if (!org.original_action_hash) return;
                  orgOffers[index].forEach((record) => {
                    offerToOrgMap.set(
                      record.signed_action.hashed.hash.toString(),
                      org.original_action_hash!
                    );
                  });
                });
                return offerToOrgMap;
              }),
              Effect.flatMap((offerToOrgMap) =>
                Effect.all(
                  records.map((record) => {
                    const offerHash = record.signed_action.hashed.hash;
                    const cachedOffer = cache.get(offerHash);

                    if (cachedOffer) {
                      return Effect.succeed(cachedOffer);
                    }

                    const offer = decodeRecords<OfferInDHT>([record])[0];
                    const authorPubKey = record.signed_action.hashed.content.author;

                    return pipe(
                      Effect.tryPromise({
                        try: () => usersStore.getUserByAgentPubKey(authorPubKey),
                        catch: (error) => {
                          console.warn('Failed to get user profile during offer mapping:', error);
                          return null;
                        }
                      }),
                      Effect.map((userProfile) => {
                        const uiOffer: UIOffer = {
                          ...offer,
                          original_action_hash: offerHash,
                          previous_action_hash: offerHash,
                          creator: userProfile?.original_action_hash || authorPubKey,
                          organization: offerToOrgMap.get(offerHash.toString()),
                          created_at: record.signed_action.hashed.content.timestamp,
                          updated_at: record.signed_action.hashed.content.timestamp
                        };

                        cache.set(uiOffer);
                        return uiOffer;
                      })
                    );
                  })
                )
              )
            )
          )
        );
      }),
      Effect.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to get all offers');
        return Effect.fail(storeError);
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          loading = false;
        })
      )
    );

  const getUserOffers = (userHash: ActionHash): Effect.Effect<UIOffer[], OfferStoreError> =>
    pipe(
      Effect.sync(() => {
        loading = true;
        error = null;
      }),
      Effect.flatMap(() => offersService.getUserOffersRecords(userHash)),
      Effect.flatMap((records) =>
        Effect.all(
          records.map((record) => {
            const offerHash = record.signed_action.hashed.hash;
            const cachedOffer = cache.get(offerHash);

            if (cachedOffer) {
              return Effect.succeed(cachedOffer);
            }

            return pipe(
              Effect.all([
                Effect.succeed(decodeRecords<OfferInDHT>([record])[0]),
                offersService.getOrganizationOffersRecords(userHash)
              ]),
              Effect.map(([offer, orgOffers]) => {
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
                  updated_at: record.signed_action.hashed.content.timestamp
                };

                cache.set(uiOffer);
                return uiOffer;
              })
            );
          })
        )
      ),
      Effect.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to get user offers');
        return Effect.fail(storeError);
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          loading = false;
        })
      )
    );

  const getOrganizationOffers = (
    organizationHash: ActionHash
  ): Effect.Effect<UIOffer[], OfferStoreError> =>
    pipe(
      Effect.sync(() => {
        loading = true;
        error = null;
      }),
      Effect.flatMap(() => offersService.getOrganizationOffersRecords(organizationHash)),
      Effect.flatMap((records) =>
        Effect.all(
          records.map((record) => {
            const offerHash = record.signed_action.hashed.hash;
            const cachedOffer = cache.get(offerHash);

            if (cachedOffer) {
              return Effect.succeed(cachedOffer);
            }

            const offer = decodeRecords<OfferInDHT>([record])[0];
            const authorPubKey = record.signed_action.hashed.content.author;

            return pipe(
              Effect.tryPromise({
                try: () => usersStore.getUserByAgentPubKey(authorPubKey),
                catch: (error) => {
                  console.warn('Failed to get user profile during offer mapping:', error);
                  return null;
                }
              }),
              Effect.map((userProfile) => {
                const uiOffer: UIOffer = {
                  ...offer,
                  original_action_hash: offerHash,
                  previous_action_hash: offerHash,
                  creator: userProfile?.original_action_hash || authorPubKey,
                  organization: organizationHash,
                  created_at: record.signed_action.hashed.content.timestamp,
                  updated_at: record.signed_action.hashed.content.timestamp
                };

                cache.set(uiOffer);
                return uiOffer;
              })
            );
          })
        )
      ),
      Effect.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to get organization offers');
        return Effect.fail(storeError);
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          loading = false;
        })
      )
    );

  const getLatestOffer = (
    originalActionHash: ActionHash
  ): Effect.Effect<UIOffer | null, OfferStoreError> =>
    pipe(
      Effect.sync(() => {
        loading = true;
        error = null;
      }),
      Effect.flatMap(() => offersService.getLatestOfferRecord(originalActionHash)),
      Effect.flatMap((record) => {
        if (!record) {
          return Effect.succeed(null);
        }

        const offerHash = record.signed_action.hashed.hash;
        const cachedOffer = cache.get(offerHash);

        if (cachedOffer) {
          return Effect.succeed(cachedOffer);
        }

        const offer = decodeRecords<OfferInDHT>([record])[0];
        const authorPubKey = record.signed_action.hashed.content.author;

        return pipe(
          Effect.all([
            Effect.tryPromise({
              try: () => usersStore.getUserByAgentPubKey(authorPubKey),
              catch: (error) => {
                console.warn('Failed to get user profile during offer mapping:', error);
                return null;
              }
            }),
            offersService.getOrganizationOffersRecords(originalActionHash)
          ]),
          Effect.map(([userProfile, orgOffers]) => {
            const uiOffer: UIOffer = {
              ...offer,
              original_action_hash: offerHash,
              previous_action_hash: offerHash,
              creator: userProfile?.original_action_hash || authorPubKey,
              organization: orgOffers.find(
                (r) => r.signed_action.hashed.hash.toString() === offerHash.toString()
              )
                ? originalActionHash
                : undefined,
              created_at: record.signed_action.hashed.content.timestamp,
              updated_at: record.signed_action.hashed.content.timestamp
            };

            cache.set(uiOffer);
            return uiOffer;
          })
        );
      }),
      Effect.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to get latest offer');
        return Effect.fail(storeError);
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          loading = false;
        })
      )
    );

  const updateOffer = (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ): Effect.Effect<Record, OfferStoreError | EventBusError> =>
    pipe(
      Effect.sync(() => {
        loading = true;
        error = null;
      }),
      Effect.flatMap(() =>
        offersService.updateOffer(originalActionHash, previousActionHash, updatedOffer)
      ),
      Effect.map((record) => {
        const offerHash = record.signed_action.hashed.hash;
        const existingOffer = cache.get(originalActionHash);
        let updatedUIOffer: UIOffer | null = null;
        if (existingOffer) {
          updatedUIOffer = {
            ...existingOffer,
            ...decodeRecords<OfferInDHT>([record])[0],
            previous_action_hash: offerHash,
            updated_at: record.signed_action.hashed.content.timestamp
          };
          cache.set(updatedUIOffer);
        }
        return { record, updatedUIOffer };
      }),
      Effect.flatMap(({ record, updatedUIOffer }) =>
        updatedUIOffer
          ? pipe(
              StoreEventBusTag,
              Effect.flatMap((eventBus) =>
                eventBus.emit('offer:updated', { offer: updatedUIOffer })
              ),
              Effect.map(() => record)
            )
          : pipe(
              StoreEventBusTag,
              Effect.map(() => record)
            )
      ),
      Effect.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to update offer');
        return Effect.fail(storeError);
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          loading = false;
        })
      ),
      Effect.provide(StoreEventBusLive)
    );

  const deleteOffer = (
    offerHash: ActionHash
  ): Effect.Effect<void, OfferStoreError | EventBusError> =>
    pipe(
      Effect.sync(() => {
        loading = true;
        error = null;
      }),
      Effect.flatMap(() => offersService.deleteOffer(offerHash)),
      Effect.tap(() =>
        Effect.sync(() => {
          cache.remove(offerHash);
          const index = offers.findIndex(
            (offer) => offer.original_action_hash?.toString() === offerHash.toString()
          );
          if (index !== -1) {
            offers.splice(index, 1);
          }
        })
      ),
      Effect.flatMap((deleted) =>
        deleted
          ? pipe(
              StoreEventBusTag,
              Effect.flatMap((eventBus) => eventBus.emit('offer:deleted', { offerHash })),
              Effect.as(undefined)
            )
          : pipe(StoreEventBusTag, Effect.as(undefined))
      ),
      Effect.catchAll((err) => {
        const storeError =
          err instanceof OfferStoreError
            ? err
            : OfferStoreError.fromError(err, 'Failed to delete offer');
        error = storeError.message;
        return Effect.fail(storeError);
      }),
      Effect.tap(() =>
        Effect.sync(() => {
          loading = false;
        })
      ),
      Effect.provide(StoreEventBusLive)
    );

  return {
    offers,
    loading,
    error,
    cache,
    getLatestOffer,
    getAllOffers,
    getUserOffers,
    getOrganizationOffers,
    createOffer,
    updateOffer,
    deleteOffer,
    invalidateCache
  };
}

// Create a singleton instance of the store
const offersStore = createOffersStore(offersService);
export default offersStore;
