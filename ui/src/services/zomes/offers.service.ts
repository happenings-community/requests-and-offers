import type { ActionHash, Record } from '@holochain/client';
import { type OfferInDHT } from '@/types/holochain';
import holochainClientService, {
  type HolochainClientService
} from '../HolochainClientService.svelte';

export type OffersService = {
  createOffer: (offer: OfferInDHT, organizationHash?: ActionHash) => Promise<Record>;
  getLatestOfferRecord: (originalActionHash: ActionHash) => Promise<Record | null>;
  getLatestOffer: (originalActionHash: ActionHash) => Promise<OfferInDHT | null>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => Promise<Record>;
  getAllOffersRecords: () => Promise<Record[]>;
  getUserOffersRecords: (userHash: ActionHash) => Promise<Record[]>;
  getOrganizationOffersRecords: (organizationHash: ActionHash) => Promise<Record[]>;
  getOfferCreator: (offerHash: ActionHash) => Promise<ActionHash | null>;
  getOfferOrganization: (offerHash: ActionHash) => Promise<ActionHash | null>;
  deleteOffer: (offerHash: ActionHash) => Promise<void>;
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
  async function createOffer(offer: OfferInDHT, organizationHash?: ActionHash): Promise<Record> {
    try {
      return (await hc.callZome('offers', 'create_offer', {
        offer,
        organization: organizationHash
      })) as Record;
    } catch (err) {
      throw new Error(`Failed to create offer: ${err}`);
    }
  }

  /**
   * Gets the latest offer record
   * @param originalActionHash The original action hash of the offer
   * @returns The latest offer record or null if not found
   */
  async function getLatestOfferRecord(originalActionHash: ActionHash): Promise<Record | null> {
    return (await hc.callZome(
      'offers',
      'get_latest_offer_record',
      originalActionHash
    )) as Record | null;
  }

  /**
   * Gets the latest offer
   * @param originalActionHash The original action hash of the offer
   * @returns The latest offer or null if not found
   */
  async function getLatestOffer(originalActionHash: ActionHash): Promise<OfferInDHT | null> {
    return (await hc.callZome(
      'offers',
      'get_latest_offer',
      originalActionHash
    )) as OfferInDHT | null;
  }

  /**
   * Updates an existing offer
   * @param originalActionHash The original action hash of the offer
   * @param previousActionHash The previous action hash of the offer
   * @param updatedOffer The updated offer data
   * @returns The updated record
   */
  async function updateOffer(
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ): Promise<Record> {
    try {
      return (await hc.callZome('offers', 'update_offer', {
        original_action_hash: originalActionHash,
        previous_action_hash: previousActionHash,
        updated_offer: updatedOffer
      })) as Record;
    } catch (err) {
      throw new Error(`Failed to update offer: ${err}`);
    }
  }

  /**
   * Gets all offers records
   * @returns Array of offer records
   */
  async function getAllOffersRecords(): Promise<Record[]> {
    try {
      return (await hc.callZome('offers', 'get_all_offers', null)) as Record[];
    } catch (err) {
      throw new Error(`Failed to get all offers: ${err}`);
    }
  }

  /**
   * Gets offers records for a specific user
   * @param userHash The user's action hash
   * @returns Array of offer records for the user
   */
  async function getUserOffersRecords(userHash: ActionHash): Promise<Record[]> {
    try {
      return (await hc.callZome('offers', 'get_user_offers', userHash)) as Record[];
    } catch (err) {
      throw new Error(`Failed to get user offers: ${err}`);
    }
  }

  /**
   * Gets offers records for a specific organization
   * @param organizationHash The organization's action hash
   * @returns Array of offer records for the organization
   */
  async function getOrganizationOffersRecords(organizationHash: ActionHash): Promise<Record[]> {
    try {
      return (await hc.callZome('offers', 'get_organization_offers', organizationHash)) as Record[];
    } catch (err) {
      throw new Error(`Failed to get organization offers: ${err}`);
    }
  }

  /**
   * Gets the creator of an offer
   * @param offerHash The offer's action hash
   * @returns The creator's action hash or null if not found
   */
  async function getOfferCreator(offerHash: ActionHash): Promise<ActionHash | null> {
    try {
      return (await hc.callZome('offers', 'get_offer_creator', offerHash)) as ActionHash | null;
    } catch (err) {
      throw new Error(`Failed to get offer creator: ${err}`);
    }
  }

  /**
   * Gets the organization associated with an offer
   * @param offerHash The offer's action hash
   * @returns The organization's action hash or null if not found
   */
  async function getOfferOrganization(offerHash: ActionHash): Promise<ActionHash | null> {
    try {
      return (await hc.callZome(
        'offers',
        'get_offer_organization',
        offerHash
      )) as ActionHash | null;
    } catch (err) {
      throw new Error(`Failed to get offer organization: ${err}`);
    }
  }

  /**
   * Deletes an offer
   * @param offerHash The hash of the offer to delete
   * @returns Promise that resolves when the offer is deleted
   */
  async function deleteOffer(offerHash: ActionHash): Promise<void> {
    try {
      await hc.callZome('offers', 'delete_offer', offerHash);
    } catch (err) {
      throw new Error(`Failed to delete offer: ${err}`);
    }
  }

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
