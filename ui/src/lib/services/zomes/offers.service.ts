import type { ActionHash, Record } from '@holochain/client';
import { type OfferInDHT, type OfferInput } from '$lib/types/holochain';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { OfferError } from '$lib/errors';
import { wrapPromise } from '$lib/utils';

// --- Service Interface ---

export interface OffersService {
  readonly createOffer: (
    offer: OfferInput,
    organizationHash?: ActionHash
  ) => E.Effect<Record, OfferError>;
  readonly getLatestOfferRecord: (
    originalActionHash: ActionHash
  ) => E.Effect<Record | null, OfferError>;
  readonly getLatestOffer: (
    originalActionHash: ActionHash
  ) => E.Effect<OfferInDHT | null, OfferError>;
  readonly updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInput
  ) => E.Effect<Record, OfferError>;
  readonly getAllOffersRecords: () => E.Effect<Record[], OfferError>;
  readonly getUserOffersRecords: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
  readonly getOrganizationOffersRecords: (
    organizationHash: ActionHash
  ) => E.Effect<Record[], OfferError>;
  readonly getOfferCreator: (offerHash: ActionHash) => E.Effect<ActionHash | null, OfferError>;
  readonly getOfferOrganization: (offerHash: ActionHash) => E.Effect<ActionHash | null, OfferError>;
  readonly deleteOffer: (offerHash: ActionHash) => E.Effect<boolean, OfferError>;
}

export class OffersServiceTag extends Context.Tag('OffersService')<
  OffersServiceTag,
  OffersService
>() {}

export const OffersServiceLive: Layer.Layer<OffersServiceTag, never, HolochainClientServiceTag> =
  Layer.effect(
    OffersServiceTag,
    E.gen(function* ($) {
      const holochainClient = yield* $(HolochainClientServiceTag);

      const createOffer = (
        offer: OfferInput,
        organizationHash?: ActionHash
      ): E.Effect<Record, OfferError> =>
        pipe(
          wrapPromise(
            () => {
              // Extract service_type_hashes from the offer
              const { service_type_hashes, ...offerData } = offer;

              return holochainClient.callZome('offers', 'create_offer', {
                offer: offerData,
                organization: organizationHash,
                service_type_hashes: service_type_hashes || []
              });
            },
            OfferError,
            'Failed to create offer'
          ),
          E.map((record: unknown) => record as Record)
        );

      const getLatestOfferRecord = (
        originalActionHash: ActionHash
      ): E.Effect<Record | null, OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'get_latest_offer_record', originalActionHash),
            OfferError,
            'Failed to get latest offer record'
          ),
          E.map((record: unknown) => record as Record | null)
        );

      const getLatestOffer = (
        originalActionHash: ActionHash
      ): E.Effect<OfferInDHT | null, OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'get_latest_offer', originalActionHash),
            OfferError,
            'Failed to get latest offer'
          ),
          E.map((offer: unknown) => offer as OfferInDHT | null)
        );

      const updateOffer = (
        originalActionHash: ActionHash,
        previousActionHash: ActionHash,
        updated_offer: OfferInput
      ): E.Effect<Record, OfferError> =>
        pipe(
          wrapPromise(
            () => {
              // Extract service_type_hashes from the offer
              const { service_type_hashes, ...offerData } = updated_offer;

              return holochainClient.callZome('offers', 'update_offer', {
                original_action_hash: originalActionHash,
                previous_action_hash: previousActionHash,
                updated_offer: offerData,
                service_type_hashes: service_type_hashes || []
              });
            },
            OfferError,
            'Failed to update offer'
          ),
          E.map((record: unknown) => record as Record)
        );

      const getAllOffersRecords = (): E.Effect<Record[], OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'get_all_offers', null),
            OfferError,
            'Failed to get all offers'
          ),
          E.map((records: unknown) => records as Record[])
        );

      const getUserOffersRecords = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'get_user_offers', userHash),
            OfferError,
            'Failed to get user offers'
          ),
          E.map((records: unknown) => records as Record[])
        );

      const getOrganizationOffersRecords = (
        organizationHash: ActionHash
      ): E.Effect<Record[], OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'get_organization_offers', organizationHash),
            OfferError,
            'Failed to get organization offers'
          ),
          E.map((records: unknown) => records as Record[])
        );

      const getOfferCreator = (offerHash: ActionHash): E.Effect<ActionHash | null, OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'get_offer_creator', offerHash),
            OfferError,
            'Failed to get offer creator'
          ),
          E.map((creator: unknown) => creator as ActionHash | null)
        );

      const getOfferOrganization = (
        offerHash: ActionHash
      ): E.Effect<ActionHash | null, OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'get_offer_organization', offerHash),
            OfferError,
            'Failed to get offer organization'
          ),
          E.map((organization: unknown) => organization as ActionHash | null)
        );

      const deleteOffer = (offerHash: ActionHash): E.Effect<boolean, OfferError> =>
        pipe(
          wrapPromise(
            () => holochainClient.callZome('offers', 'delete_offer', offerHash),
            OfferError,
            'Failed to delete offer'
          ),
          E.map((result: unknown) => result as boolean)
        );

      return OffersServiceTag.of({
        createOffer,
        getLatestOfferRecord,
        getLatestOffer,
        updateOffer,
        getAllOffersRecords,
        getUserOffersRecords,
        getOrganizationOffersRecords,
        getOfferCreator,
        getOfferOrganization,
        deleteOffer
      });
    })
  );
