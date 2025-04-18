import type { ActionHash, Record } from '@holochain/client';
import type { UIOffer } from '@lib/types/ui';
import type { OfferInDHT } from '@lib/types/holochain';
import offersService, { type OffersService } from '@services/zomes/offers.service';
import { decodeRecords } from '@utils';
import { type EventBus } from '@utils/eventBus';
import usersStore from '@stores/users.store.svelte';
import { createEntityCache, type EntityCache } from '@utils/cache.svelte';
import { storeEventBus, type StoreEvents } from '@stores/storeEvents';
import organizationsStore from '@stores/organizations.store.svelte';
import * as E from '@effect/io/Effect';
import { pipe } from '@effect/data/Function';

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
  ) => E.Effect<never, OfferStoreError, UIOffer | null>;
  getAllOffers: () => E.Effect<never, OfferStoreError, UIOffer[]>;
  getUserOffers: (userHash: ActionHash) => E.Effect<never, OfferStoreError, UIOffer[]>;
  getOrganizationOffers: (
    organizationHash: ActionHash
  ) => E.Effect<never, OfferStoreError, UIOffer[]>;
  createOffer: (
    offer: OfferInDHT,
    organizationHash?: ActionHash
  ) => E.Effect<never, OfferStoreError, Record>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => E.Effect<never, OfferStoreError, Record>;
  deleteOffer: (offerHash: ActionHash) => E.Effect<never, OfferStoreError, void>;
  invalidateCache: () => void;
};

/**
 * Factory function to create an offers store
 * @returns An offers store with state and methods
 */
export function createOffersStore(
  offersService: OffersService,
  eventBus: EventBus<StoreEvents>
): OffersStore {
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
  ): E.Effect<never, OfferStoreError, Record> =>
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

        cache.set(newOffer);
        eventBus.emit('offer:created', { offer: newOffer });
        return record;
      }),
      E.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to create offer');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
    );

  const getAllOffers = (): E.Effect<never, OfferStoreError, UIOffer[]> =>
    pipe(
      E.sync(() => {
        loading = true;
        error = null;
      }),
      E.flatMap(() => {
        const cachedOffers = cache.getAllValid();
        if (cachedOffers.length > 0) {
          return E.succeed(cachedOffers);
        }

        return pipe(
          E.all([
            offersService.getAllOffersRecords(),
            E.tryPromise({
              try: () => organizationsStore.getAcceptedOrganizations(),
              catch: (error) => OfferStoreError.fromError(error, 'Failed to get organizations')
            })
          ]),
          E.flatMap(([records, organizations]) =>
            pipe(
              E.all(
                organizations.map((org) =>
                  org.original_action_hash
                    ? offersService.getOrganizationOffersRecords(org.original_action_hash)
                    : E.succeed([])
                )
              ),
              E.map((orgOffers) => {
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
              E.flatMap((offerToOrgMap) =>
                E.all(
                  records.map((record) => {
                    const offerHash = record.signed_action.hashed.hash;
                    const cachedOffer = cache.get(offerHash);

                    if (cachedOffer) {
                      return E.succeed(cachedOffer);
                    }

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
                      E.map((userProfile) => {
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
      E.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to get all offers');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
    );

  const getUserOffers = (userHash: ActionHash): E.Effect<never, OfferStoreError, UIOffer[]> =>
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
            const cachedOffer = cache.get(offerHash);

            if (cachedOffer) {
              return E.succeed(cachedOffer);
            }

            return pipe(
              E.all([
                E.succeed(decodeRecords<OfferInDHT>([record])[0]),
                offersService.getOrganizationOffersRecords(userHash)
              ]),
              E.map(([offer, orgOffers]) => {
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
  ): E.Effect<never, OfferStoreError, UIOffer[]> =>
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
            const cachedOffer = cache.get(offerHash);

            if (cachedOffer) {
              return E.succeed(cachedOffer);
            }

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
              E.map((userProfile) => {
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
  ): E.Effect<never, OfferStoreError, UIOffer | null> =>
    pipe(
      E.sync(() => {
        loading = true;
        error = null;
      }),
      E.flatMap(() => offersService.getLatestOfferRecord(originalActionHash)),
      E.flatMap((record) => {
        if (!record) {
          return E.succeed(null);
        }

        const offerHash = record.signed_action.hashed.hash;
        const cachedOffer = cache.get(offerHash);

        if (cachedOffer) {
          return E.succeed(cachedOffer);
        }

        const offer = decodeRecords<OfferInDHT>([record])[0];
        const authorPubKey = record.signed_action.hashed.content.author;

        return pipe(
          E.all([
            E.tryPromise({
              try: () => usersStore.getUserByAgentPubKey(authorPubKey),
              catch: (error) => {
                console.warn('Failed to get user profile during offer mapping:', error);
                return null;
              }
            }),
            offersService.getOrganizationOffersRecords(originalActionHash)
          ]),
          E.map(([userProfile, orgOffers]) => {
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
    updatedOffer: OfferInDHT
  ): E.Effect<never, OfferStoreError, Record> =>
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
        const existingOffer = cache.get(originalActionHash);

        if (existingOffer) {
          const updatedUIOffer: UIOffer = {
            ...existingOffer,
            ...decodeRecords<OfferInDHT>([record])[0],
            previous_action_hash: offerHash,
            updated_at: record.signed_action.hashed.content.timestamp
          };

          cache.set(updatedUIOffer);
          eventBus.emit('offer:updated', { offer: updatedUIOffer });
        }

        return record;
      }),
      E.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to update offer');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
    );

  const deleteOffer = (offerHash: ActionHash): E.Effect<never, OfferStoreError, void> =>
    pipe(
      E.sync(() => {
        loading = true;
        error = null;
      }),
      E.flatMap(() => offersService.deleteOffer(offerHash)),
      E.map(() => {
        cache.remove(offerHash);
        const index = offers.findIndex(
          (offer) => offer.original_action_hash?.toString() === offerHash.toString()
        );
        if (index !== -1) {
          offers.splice(index, 1);
        }
        eventBus.emit('offer:deleted', { offerHash });
      }),
      E.catchAll((error) => {
        const storeError = OfferStoreError.fromError(error, 'Failed to delete offer');
        return E.fail(storeError);
      }),
      E.tap(() =>
        E.sync(() => {
          loading = false;
        })
      )
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
const offersStore = createOffersStore(offersService, storeEventBus);
export default offersStore;
