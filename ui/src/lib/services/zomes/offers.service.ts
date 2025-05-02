import type { ActionHash, Record } from '@holochain/client';
import { type OfferInDHT } from '@lib/types/holochain';
import holochainClientService, {
  type HolochainClientService
} from '../HolochainClientService.svelte';
import { Effect as E, pipe } from 'effect';

export class OfferError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'OfferError';
  }

  static fromError(error: unknown, context: string): OfferError {
    if (error instanceof Error) {
      return new OfferError(`${context}: ${error.message}`, error);
    }
    return new OfferError(`${context}: ${String(error)}`, error);
  }
}

export type OffersService = {
  createOffer: (offer: OfferInDHT, organizationHash?: ActionHash) => E.Effect<Record, OfferError>;
  getLatestOfferRecord: (originalActionHash: ActionHash) => E.Effect<Record | null, OfferError>;
  getLatestOffer: (originalActionHash: ActionHash) => E.Effect<OfferInDHT | null, OfferError>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => E.Effect<Record, OfferError>;
  getAllOffersRecords: () => E.Effect<Record[], OfferError>;
  getUserOffersRecords: (userHash: ActionHash) => E.Effect<Record[], OfferError>;
  getOrganizationOffersRecords: (organizationHash: ActionHash) => E.Effect<Record[], OfferError>;
  getOfferCreator: (offerHash: ActionHash) => E.Effect<ActionHash | null, OfferError>;
  getOfferOrganization: (offerHash: ActionHash) => E.Effect<ActionHash | null, OfferError>;
  deleteOffer: (offerHash: ActionHash) => E.Effect<boolean, OfferError>;
};

/**
 * Factory function to create an offers service
 * @returns An offers service with methods to interact with the Holochain backend
 */
export function createOffersService(hc: HolochainClientService): OffersService {
  /**
   * Creates a new offer
   * @param offer The offer to create
   * @param organizationHash Optional organization hash to associate with the offer
   * @returns The created record
   */
  const createOffer = (
    offer: OfferInDHT,
    organizationHash?: ActionHash
  ): E.Effect<Record, OfferError> =>
    pipe(
      E.tryPromise({
        try: () =>
          hc.callZome('offers', 'create_offer', {
            offer,
            organization: organizationHash
          }),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to create offer')
      }),
      E.map((record: unknown) => record as Record)
    );

  /**
   * Gets the latest offer record
   * @param originalActionHash The original action hash of the offer
   * @returns The latest offer record or null if not found
   */
  const getLatestOfferRecord = (
    originalActionHash: ActionHash
  ): E.Effect<Record | null, OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'get_latest_offer_record', originalActionHash),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to get latest offer record')
      }),
      E.map((record: unknown) => record as Record | null)
    );

  /**
   * Gets the latest offer
   * @param originalActionHash The original action hash of the offer
   * @returns The latest offer or null if not found
   */
  const getLatestOffer = (
    originalActionHash: ActionHash
  ): E.Effect<OfferInDHT | null, OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'get_latest_offer', originalActionHash),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to get latest offer')
      }),
      E.map((offer: unknown) => offer as OfferInDHT | null)
    );

  /**
   * Updates an existing offer
   * @param originalActionHash The original action hash of the offer
   * @param previousActionHash The previous action hash of the offer
   * @param updatedOffer The updated offer data
   * @returns The updated record
   */
  const updateOffer = (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ): E.Effect<Record, OfferError> =>
    pipe(
      E.tryPromise({
        try: () =>
          hc.callZome('offers', 'update_offer', {
            original_action_hash: originalActionHash,
            previous_action_hash: previousActionHash,
            updated_offer: updatedOffer
          }),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to update offer')
      }),
      E.map((record: unknown) => record as Record)
    );

  /**
   * Gets all offers records
   * @returns Array of offer records
   */
  const getAllOffersRecords = (): E.Effect<Record[], OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'get_all_offers', null),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to get all offers')
      }),
      E.map((records: unknown) => records as Record[])
    );

  /**
   * Gets offers records for a specific user
   * @param userHash The user's action hash
   * @returns Array of offer records for the user
   */
  const getUserOffersRecords = (userHash: ActionHash): E.Effect<Record[], OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'get_user_offers', userHash),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to get user offers')
      }),
      E.map((records: unknown) => records as Record[])
    );

  /**
   * Gets offers records for a specific organization
   * @param organizationHash The organization's action hash
   * @returns Array of offer records for the organization
   */
  const getOrganizationOffersRecords = (
    organizationHash: ActionHash
  ): E.Effect<Record[], OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'get_organization_offers', organizationHash),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to get organization offers')
      }),
      E.map((records: unknown) => records as Record[])
    );

  /**
   * Gets the creator of an offer
   * @param offerHash The offer's action hash
   * @returns The creator's action hash or null if not found
   */
  const getOfferCreator = (offerHash: ActionHash): E.Effect<ActionHash | null, OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'get_offer_creator', offerHash),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to get offer creator')
      }),
      E.map((creator: unknown) => creator as ActionHash | null)
    );

  /**
   * Gets the organization associated with an offer
   * @param offerHash The offer's action hash
   * @returns The organization's action hash or null if not found
   */
  const getOfferOrganization = (offerHash: ActionHash): E.Effect<ActionHash | null, OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'get_offer_organization', offerHash),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to get offer organization')
      }),
      E.map((organization: unknown) => organization as ActionHash | null)
    );

  /**
   * Deletes an offer
   * @param offerHash The hash of the offer to delete
   * @returns Promise that resolves when the offer is deleted
   */
  const deleteOffer = (offerHash: ActionHash): E.Effect<boolean, OfferError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('offers', 'delete_offer', offerHash),
        catch: (error: unknown) => OfferError.fromError(error, 'Failed to delete offer')
      }),
      E.map((result: unknown) => result as boolean)
    );

  // Return the service object with methods
  return {
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
  };
}

// Create a singleton instance of the service
const offersService = createOffersService(holochainClientService);
export default offersService;
