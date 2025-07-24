import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/holochainClient.service';
import { Effect as E, Layer, Context, pipe } from 'effect';
import { OfferError, OFFER_CONTEXTS } from '$lib/errors';
import {
  OfferInDHT,
  OfferInput,
  UIOffer,
  OfferRecordSchema,
  OfferRecordOrNullSchema,
  OfferRecordsArraySchema,
  ActionHashArraySchema,
  BooleanResponseSchema,
  VoidResponseSchema
} from '$lib/schemas/offers.schemas';

// Re-export OfferError for external use
export { OfferError };

// Re-export types for external use
export type { OfferInDHT, OfferInput, UIOffer };

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
  readonly getMediumsOfExchangeForOffer: (
    offerHash: ActionHash
  ) => E.Effect<ActionHash[], OfferError>;
  readonly getServiceTypesForOffer: (offerHash: ActionHash) => E.Effect<ActionHash[], OfferError>;
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
          holochainClient.callZomeRawEffect('offers', 'create_offer', {
            offer: {
              title: offer.title,
              description: offer.description,
              time_preference: offer.time_preference,
              time_zone: offer.time_zone,
              interaction_type: offer.interaction_type,
              links: offer.links
            },
            organization: organizationHash,
            service_type_hashes: offer.service_type_hashes || [],
            medium_of_exchange_hashes: offer.medium_of_exchange_hashes || []
          }),
          E.map((result) => result as Record),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.CREATE_OFFER));
          })
        );

      const getLatestOfferRecord = (
        originalActionHash: ActionHash
      ): E.Effect<Record | null, OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect(
            'offers',
            'get_latest_offer_record',
            originalActionHash
          ),
          E.map((result) => result as Record | null),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(
              OfferError.fromError(
                error,
                OFFER_CONTEXTS.GET_LATEST_OFFER,
                originalActionHash.toString()
              )
            );
          })
        );

      const getLatestOffer = (
        originalActionHash: ActionHash
      ): E.Effect<OfferInDHT | null, OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'get_latest_offer', originalActionHash),
          E.map((result) => result as OfferInDHT | null),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_LATEST_OFFER));
          })
        );

      const updateOffer = (
        originalActionHash: ActionHash,
        previousActionHash: ActionHash,
        updatedOffer: OfferInput
      ): E.Effect<Record, OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'update_offer', {
            original_action_hash: originalActionHash,
            previous_action_hash: previousActionHash,
            updated_offer: {
              title: updatedOffer.title,
              description: updatedOffer.description,
              time_preference: updatedOffer.time_preference,
              time_zone: updatedOffer.time_zone,
              interaction_type: updatedOffer.interaction_type,
              links: updatedOffer.links
            },
            service_type_hashes: updatedOffer.service_type_hashes || [],
            medium_of_exchange_hashes: updatedOffer.medium_of_exchange_hashes || []
          }),
          E.map((result) => result as Record),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.UPDATE_OFFER));
          })
        );

      const getAllOffersRecords = (): E.Effect<Record[], OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'get_all_offers', null),
          E.map((result) => result as Record[]),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_ALL_OFFERS));
          })
        );

      const getUserOffersRecords = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'get_user_offers', userHash),
          E.map((result) => result as Record[]),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_USER_OFFERS));
          })
        );

      const getOrganizationOffersRecords = (
        organizationHash: ActionHash
      ): E.Effect<Record[], OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'get_organization_offers', organizationHash),
          E.map((result) => result as Record[]),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_ORGANIZATION_OFFERS));
          })
        );

      const getOfferCreator = (offerHash: ActionHash): E.Effect<ActionHash | null, OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'get_offer_creator', offerHash),
          E.map((result) => result as ActionHash | null),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_OFFER_CREATOR));
          })
        );

      const getOfferOrganization = (
        offerHash: ActionHash
      ): E.Effect<ActionHash | null, OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'get_offer_organization', offerHash),
          E.map((result) => result as ActionHash | null),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_ORGANIZATION_OFFERS));
          })
        );

      const deleteOffer = (offerHash: ActionHash): E.Effect<boolean, OfferError> =>
        pipe(
          holochainClient.callZomeEffect(
            'offers',
            'delete_offer',
            offerHash,
            BooleanResponseSchema
          ),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.DELETE_OFFER));
          })
        );

      const getOffersByTag = (tag: string): E.Effect<Record[], OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('offers', 'get_offers_by_tag', tag),
          E.map((result) => result as Record[]),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_ALL_OFFERS));
          })
        );

      const getMediumsOfExchangeForOffer = (
        offerHash: ActionHash
      ): E.Effect<ActionHash[], OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect(
            'mediums_of_exchange',
            'get_mediums_of_exchange_for_entity',
            {
              original_action_hash: offerHash,
              entity: 'offer'
            }
          ),
          E.map((result) => result as ActionHash[]),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_OFFER));
          })
        );

      const getServiceTypesForOffer = (offerHash: ActionHash): E.Effect<ActionHash[], OfferError> =>
        pipe(
          holochainClient.callZomeRawEffect('service_types', 'get_service_types_for_entity', {
            original_action_hash: offerHash,
            entity: 'offer'
          }),
          E.map((result) => result as ActionHash[]),
          E.catchAll((error) => {
            if (error instanceof OfferError) {
              return E.fail(error);
            }
            return E.fail(OfferError.fromError(error, OFFER_CONTEXTS.GET_OFFER));
          })
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
        getOffersByTag,
        getMediumsOfExchangeForOffer,
        getServiceTypesForOffer
      });
    })
  );
