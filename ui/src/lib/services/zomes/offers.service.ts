import type { ActionHash, Record } from '@holochain/client';
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';
import { Effect as E, Layer, Context } from 'effect';
import { OfferError, OFFER_CONTEXTS } from '$lib/errors';
import { OfferInDHT, OfferInput, UIOffer } from '$lib/schemas/offers.schemas';
import { wrapZomeCallWithErrorFactory } from '$lib/utils/zome-helpers';

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
  readonly getActiveOffersRecords: () => E.Effect<Record[], OfferError>;
  readonly getArchivedOffersRecords: () => E.Effect<Record[], OfferError>;
  readonly getUserOffersRecords: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
  readonly getUserActiveOffersRecords: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
  readonly getUserArchivedOffersRecords: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
  readonly getOrganizationOffersRecords: (
    organizationHash: ActionHash
  ) => E.Effect<Record[], OfferError>;
  readonly getOfferCreator: (offerHash: ActionHash) => E.Effect<ActionHash | null, OfferError>;
  readonly getOfferOrganization: (offerHash: ActionHash) => E.Effect<ActionHash | null, OfferError>;
  readonly deleteOffer: (offerHash: ActionHash) => E.Effect<boolean, OfferError>;
  readonly archiveOffer: (offerHash: ActionHash) => E.Effect<boolean, OfferError>;
  readonly getMyListings: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
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
    E.gen(function* () {
      const holochainClient = yield* HolochainClientServiceTag;

      // Helper to wrap Promise-based methods in Effect
      const wrapZomeCall = <T>(
        zomeName: string,
        fnName: string,
        payload: unknown,
        context: string = OFFER_CONTEXTS.GET_OFFER
      ): E.Effect<T, OfferError> =>
        wrapZomeCallWithErrorFactory(
          holochainClient,
          zomeName,
          fnName,
          payload,
          context,
          OfferError.fromError
        );

      const createOffer = (
        offer: OfferInput,
        organizationHash?: ActionHash
      ): E.Effect<Record, OfferError> =>
        wrapZomeCall('offers', 'create_offer', {
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
        });

      const getLatestOfferRecord = (
        originalActionHash: ActionHash
      ): E.Effect<Record | null, OfferError> =>
        wrapZomeCall('offers', 'get_latest_offer_record', originalActionHash);

      const getLatestOffer = (
        originalActionHash: ActionHash
      ): E.Effect<OfferInDHT | null, OfferError> =>
        wrapZomeCall('offers', 'get_latest_offer', originalActionHash);

      const updateOffer = (
        originalActionHash: ActionHash,
        previousActionHash: ActionHash,
        updatedOffer: OfferInput
      ): E.Effect<Record, OfferError> =>
        wrapZomeCall('offers', 'update_offer', {
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
        });

      const getActiveOffersRecords = (): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_active_offers', null);

      const getArchivedOffersRecords = (): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_archived_offers', null);

      const getUserOffersRecords = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_user_offers', userHash);

      const getUserActiveOffersRecords = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_user_active_offers', userHash);

      const getUserArchivedOffersRecords = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_user_archived_offers', userHash);

      const getOrganizationOffersRecords = (
        organizationHash: ActionHash
      ): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_organization_offers', organizationHash);

      const getOfferCreator = (offerHash: ActionHash): E.Effect<ActionHash | null, OfferError> =>
        wrapZomeCall('offers', 'get_offer_creator', offerHash);

      const getOfferOrganization = (
        offerHash: ActionHash
      ): E.Effect<ActionHash | null, OfferError> =>
        wrapZomeCall('offers', 'get_offer_organization', offerHash);

      const deleteOffer = (offerHash: ActionHash): E.Effect<boolean, OfferError> =>
        wrapZomeCall('offers', 'delete_offer', offerHash);

      const archiveOffer = (offerHash: ActionHash): E.Effect<boolean, OfferError> =>
        wrapZomeCall('offers', 'archive_offer', offerHash);

      const getMyListings = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_my_listings', userHash);

      const getOffersByTag = (tag: string): E.Effect<Record[], OfferError> =>
        wrapZomeCall('offers', 'get_offers_by_tag', tag);

      const getMediumsOfExchangeForOffer = (
        offerHash: ActionHash
      ): E.Effect<ActionHash[], OfferError> =>
        wrapZomeCall('mediums_of_exchange', 'get_mediums_of_exchange_for_entity', {
          original_action_hash: offerHash,
          entity: 'offer'
        });

      const getServiceTypesForOffer = (offerHash: ActionHash): E.Effect<ActionHash[], OfferError> =>
        wrapZomeCall('service_types', 'get_service_types_for_entity', {
          original_action_hash: offerHash,
          entity: 'offer'
        });

      return OffersServiceTag.of({
        createOffer,
        getLatestOfferRecord,
        getLatestOffer,
        updateOffer,
        getActiveOffersRecords,
        getArchivedOffersRecords,
        getUserOffersRecords,
        getUserActiveOffersRecords,
        getUserArchivedOffersRecords,
        getOrganizationOffersRecords,
        getOfferCreator,
        getOfferOrganization,
        deleteOffer,
        archiveOffer,
        getMyListings,
        getOffersByTag,
        getMediumsOfExchangeForOffer,
        getServiceTypesForOffer
      });
    })
  );
