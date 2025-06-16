import type { ActionHash, Record } from '@holochain/client';
import { type OfferInDHT, type OfferInput } from '$lib/types/holochain';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context, Data, pipe } from 'effect';

// --- Error Types ---

export class OfferError extends Data.TaggedError('OfferError')<{
  message: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): OfferError {
    if (error instanceof Error) {
      return new OfferError({
        message: `${context}: ${error.message}`,
        cause: error
      });
    }
    return new OfferError({
      message: `${context}: ${String(error)}`,
      cause: error
    });
  }
}

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
  readonly getOffersByTag: (tag: string) => E.Effect<Record[], OfferError>;
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
          E.tryPromise({
            try: () => {
              // Extract service_type_hashes from the offer
              const { service_type_hashes, ...offerData } = offer;

              return holochainClient.callZome('offers', 'create_offer', {
                offer: offerData,
                organization: organizationHash,
                service_type_hashes: service_type_hashes || []
              });
            },
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to create offer')
          }),
          E.map((record: unknown) => record as Record)
        );

      const getLatestOfferRecord = (
        originalActionHash: ActionHash
      ): E.Effect<Record | null, OfferError> =>
        pipe(
          E.tryPromise({
            try: () =>
              holochainClient.callZome('offers', 'get_latest_offer_record', originalActionHash),
            catch: (error: unknown) =>
              OfferError.fromError(error, 'Failed to get latest offer record')
          }),
          E.map((record: unknown) => record as Record | null)
        );

      const getLatestOffer = (
        originalActionHash: ActionHash
      ): E.Effect<OfferInDHT | null, OfferError> =>
        pipe(
          E.tryPromise({
            try: () => holochainClient.callZome('offers', 'get_latest_offer', originalActionHash),
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to get latest offer')
          }),
          E.map((offer: unknown) => offer as OfferInDHT | null)
        );

      const updateOffer = (
        originalActionHash: ActionHash,
        previousActionHash: ActionHash,
        updated_offer: OfferInput
      ): E.Effect<Record, OfferError> =>
        pipe(
          E.tryPromise({
            try: () => {
              // Extract service_type_hashes from the offer
              const { service_type_hashes, ...offerData } = updated_offer;

              return holochainClient.callZome('offers', 'update_offer', {
                original_action_hash: originalActionHash,
                previous_action_hash: previousActionHash,
                updated_offer: offerData,
                service_type_hashes: service_type_hashes || []
              });
            },
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to update offer')
          }),
          E.map((record: unknown) => record as Record)
        );

      const getAllOffersRecords = (): E.Effect<Record[], OfferError> =>
        pipe(
          E.tryPromise({
            try: () => holochainClient.callZome('offers', 'get_all_offers', null),
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to get all offers')
          }),
          E.map((records: unknown) => records as Record[])
        );

      const getUserOffersRecords = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
        pipe(
          E.tryPromise({
            try: () => holochainClient.callZome('offers', 'get_user_offers', userHash),
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to get user offers')
          }),
          E.map((records: unknown) => records as Record[])
        );

      const getOrganizationOffersRecords = (
        organizationHash: ActionHash
      ): E.Effect<Record[], OfferError> =>
        pipe(
          E.tryPromise({
            try: () =>
              holochainClient.callZome('offers', 'get_organization_offers', organizationHash),
            catch: (error: unknown) =>
              OfferError.fromError(error, 'Failed to get organization offers')
          }),
          E.map((records: unknown) => records as Record[])
        );

      const getOfferCreator = (offerHash: ActionHash): E.Effect<ActionHash | null, OfferError> =>
        pipe(
          E.tryPromise({
            try: () => holochainClient.callZome('offers', 'get_offer_creator', offerHash),
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to get offer creator')
          }),
          E.map((creator: unknown) => creator as ActionHash | null)
        );

      const getOfferOrganization = (
        offerHash: ActionHash
      ): E.Effect<ActionHash | null, OfferError> =>
        pipe(
          E.tryPromise({
            try: () => holochainClient.callZome('offers', 'get_offer_organization', offerHash),
            catch: (error: unknown) =>
              OfferError.fromError(error, 'Failed to get offer organization')
          }),
          E.map((organization: unknown) => organization as ActionHash | null)
        );

      const deleteOffer = (offerHash: ActionHash): E.Effect<boolean, OfferError> =>
        pipe(
          E.tryPromise({
            try: () => holochainClient.callZome('offers', 'delete_offer', offerHash),
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to delete offer')
          }),
          E.map((result: unknown) => result as boolean)
        );

      const getOffersByTag = (tag: string): E.Effect<Record[], OfferError> =>
        pipe(
          E.tryPromise({
            try: () => holochainClient.callZome('offers', 'get_offers_by_tag', tag),
            catch: (error: unknown) => OfferError.fromError(error, 'Failed to get offers by tag')
          }),
          E.map((records: unknown) => records as Record[])
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
        deleteOffer,
        getOffersByTag
      });
    })
  );
