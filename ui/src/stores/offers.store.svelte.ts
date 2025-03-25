import type { ActionHash, Record } from '@holochain/client';
import type { UIOffer } from '@/types/ui';
import type { OfferInDHT } from '@/types/holochain';
import offersService, { type OffersService } from '@/services/zomes/offers.service';
import { decodeRecords } from '@utils';
import { type EventBus } from '@/utils/eventBus';
import usersStore from '@/stores/users.store.svelte';
import { createEntityCache, type EntityCache } from '@/utils/cache.svelte';
import { storeEventBus, type StoreEvents } from '@/stores/storeEvents';
import organizationsStore from '@/stores/organizations.store.svelte';

export type OffersStore = {
  readonly offers: UIOffer[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIOffer>;
  getLatestOffer: (originalActionHash: ActionHash) => Promise<UIOffer | null>;
  getAllOffers: () => Promise<UIOffer[]>;
  getUserOffers: (userHash: ActionHash) => Promise<UIOffer[]>;
  getOrganizationOffers: (organizationHash: ActionHash) => Promise<UIOffer[]>;
  createOffer: (offer: OfferInDHT, organizationHash?: ActionHash) => Promise<Record>;
  updateOffer: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedOffer: OfferInDHT
  ) => Promise<Record>;
  deleteOffer: (offerHash: ActionHash) => Promise<void>;
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

  // When an offer is added to the cache, update the offers array if needed
  cache.on('cache:set', ({ entity }) => {
    const index = offers.findIndex(
      (o) => o.original_action_hash?.toString() === entity.original_action_hash?.toString()
    );

    if (index !== -1) {
      // Update existing offer
      offers[index] = entity;
    } else {
      // Add new offer if it's not already in the array
      offers.push(entity);
    }
  });

  // When an offer is removed from the cache, also remove it from the offers array
  cache.on('cache:remove', ({ hash }) => {
    const index = offers.findIndex((o) => o.original_action_hash?.toString() === hash);

    if (index !== -1) {
      offers.splice(index, 1);
    }
  });

  /**
   * Invalidates the entire cache
   */
  function invalidateCache(): void {
    cache.clear();
  }

  /**
   * Creates a new offer
   * @param offer The offer to create
   * @param organizationHash Optional organization hash to associate with the offer
   * @returns The created record
   */
  async function createOffer(offer: OfferInDHT, organizationHash?: ActionHash): Promise<Record> {
    loading = true;
    error = null;

    try {
      const record = await offersService.createOffer(offer, organizationHash);

      // Get current user's original_action_hash
      let creatorHash: ActionHash | undefined;

      // Try to get current user for creator hash
      const currentUser = usersStore.currentUser;
      if (currentUser?.original_action_hash) {
        creatorHash = currentUser.original_action_hash;
      } else {
        // Fallback for tests - use the agent pubkey from the record
        creatorHash = record.signed_action.hashed.content.author;
        console.warn('No current user found, using agent pubkey as creator');
      }

      // Use decodeRecords to transform the record
      const newOffer: UIOffer = {
        ...decodeRecords<OfferInDHT>([record])[0],
        original_action_hash: record.signed_action.hashed.hash,
        previous_action_hash: record.signed_action.hashed.hash,
        organization: organizationHash,
        creator: creatorHash,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      // Add to cache
      cache.set(newOffer);

      // Emit event through event bus
      eventBus.emit('offer:created', { offer: newOffer });

      return record;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets all offers
   * @returns Array of offers
   */
  async function getAllOffers(): Promise<UIOffer[]> {
    loading = true;
    error = null;

    try {
      // Check if we have valid cached offers
      const cachedOffers = cache.getAllValid();
      if (cachedOffers.length > 0) {
        return cachedOffers;
      }

      const records = await offersService.getAllOffersRecords();

      // Get all organizations
      const organizations = await organizationsStore.getAcceptedOrganizations();

      // Create a map of offer hashes to organization hashes
      const offerToOrgMap = new Map<string, ActionHash>();
      await Promise.all(
        organizations.map(async (org) => {
          if (!org.original_action_hash) return;
          const orgOffers = await offersService.getOrganizationOffersRecords(
            org.original_action_hash
          );
          orgOffers.forEach((record) => {
            offerToOrgMap.set(
              record.signed_action.hashed.hash.toString(),
              org.original_action_hash!
            );
          });
        })
      );

      const fetchedOffers = await Promise.all(
        records.map(async (record) => {
          // First check if this offer is already in the cache
          const offerHash = record.signed_action.hashed.hash;
          const cachedOffer = cache.get(offerHash);

          if (cachedOffer) {
            return cachedOffer;
          }

          const offer = decodeRecords<OfferInDHT>([record])[0];
          const authorPubKey = record.signed_action.hashed.content.author;

          // Get the user profile for this agent
          let userProfile = null;
          try {
            userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
          } catch (err) {
            console.warn('Failed to get user profile during offer mapping:', err);
          }

          // Create a UIOffer object
          const uiOffer: UIOffer = {
            ...offer,
            original_action_hash: offerHash,
            previous_action_hash: offerHash,
            creator: userProfile?.original_action_hash || authorPubKey,
            organization: offerToOrgMap.get(offerHash.toString()),
            created_at: record.signed_action.hashed.content.timestamp,
            updated_at: record.signed_action.hashed.content.timestamp
          };

          // Add to cache
          cache.set(uiOffer);

          return uiOffer;
        })
      );

      return fetchedOffers;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets offers for a specific user
   * @param userHash The user's action hash
   * @returns Array of offers
   */
  async function getUserOffers(userHash: ActionHash): Promise<UIOffer[]> {
    loading = true;
    error = null;

    try {
      const records = await offersService.getUserOffersRecords(userHash);
      const offers = decodeRecords<OfferInDHT>(records);

      const uiOffers = await Promise.all(
        offers.map(async (offer, index) => {
          const record = records[index];
          const offerHash = record.signed_action.hashed.hash;

          // Check cache first
          const cachedOffer = cache.get(offerHash);
          if (cachedOffer) {
            return cachedOffer;
          }

          // Get organization if any
          const organizationHash = await offersService.getOfferOrganization(offerHash);

          const uiOffer: UIOffer = {
            ...offer,
            original_action_hash: offerHash,
            previous_action_hash: offerHash,
            creator: userHash,
            organization: organizationHash || undefined,
            created_at: record.signed_action.hashed.content.timestamp,
            updated_at: record.signed_action.hashed.content.timestamp
          };

          // Add to cache
          cache.set(uiOffer);

          return uiOffer;
        })
      );

      return uiOffers;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets offers for a specific organization
   * @param organizationHash The organization's action hash
   * @returns Array of offers
   */
  async function getOrganizationOffers(organizationHash: ActionHash): Promise<UIOffer[]> {
    loading = true;
    error = null;

    try {
      const records = await offersService.getOrganizationOffersRecords(organizationHash);
      const offers = decodeRecords<OfferInDHT>(records);

      const uiOffers = await Promise.all(
        offers.map(async (offer, index) => {
          const record = records[index];
          const offerHash = record.signed_action.hashed.hash;

          // Check cache first
          const cachedOffer = cache.get(offerHash);
          if (cachedOffer) {
            return cachedOffer;
          }

          // Get creator
          const creatorHash = await offersService.getOfferCreator(offerHash);

          const uiOffer: UIOffer = {
            ...offer,
            original_action_hash: offerHash,
            previous_action_hash: offerHash,
            creator: creatorHash || undefined,
            organization: organizationHash,
            created_at: record.signed_action.hashed.content.timestamp,
            updated_at: record.signed_action.hashed.content.timestamp
          };

          // Add to cache
          cache.set(uiOffer);

          return uiOffer;
        })
      );

      return uiOffers;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets the latest offer
   * @param originalActionHash The original action hash of the offer
   * @returns The latest offer or null if not found
   */
  async function getLatestOffer(originalActionHash: ActionHash): Promise<UIOffer | null> {
    loading = true;
    error = null;

    try {
      const record = await offersService.getLatestOfferRecord(originalActionHash);
      if (!record) return null;

      const offerHash = record.signed_action.hashed.hash;

      // Check cache first
      const cachedOffer = cache.get(offerHash);
      if (cachedOffer) {
        return cachedOffer;
      }

      const offer = decodeRecords<OfferInDHT>([record])[0];

      // Get creator and organization
      const [creatorHash, organizationHash] = await Promise.all([
        offersService.getOfferCreator(offerHash),
        offersService.getOfferOrganization(offerHash)
      ]);

      const uiOffer: UIOffer = {
        ...offer,
        original_action_hash: originalActionHash,
        previous_action_hash: offerHash,
        creator: creatorHash || undefined,
        organization: organizationHash || undefined,
        created_at: record.signed_action.hashed.content.timestamp,
        updated_at: record.signed_action.hashed.content.timestamp
      };

      // Add to cache
      cache.set(uiOffer);

      return uiOffer;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
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
    loading = true;
    error = null;

    try {
      const record = await offersService.updateOffer(
        originalActionHash,
        previousActionHash,
        updatedOffer
      );

      const offerHash = record.signed_action.hashed.hash;

      // Get creator and organization
      const [creatorHash, organizationHash] = await Promise.all([
        offersService.getOfferCreator(offerHash),
        offersService.getOfferOrganization(offerHash)
      ]);

      const uiOffer: UIOffer = {
        ...decodeRecords<OfferInDHT>([record])[0],
        original_action_hash: originalActionHash,
        previous_action_hash: offerHash,
        creator: creatorHash || undefined,
        organization: organizationHash || undefined,
        created_at: record.signed_action.hashed.content.timestamp,
        updated_at: Date.now()
      };

      // Update cache
      cache.set(uiOffer);

      // Emit event through event bus
      eventBus.emit('offer:updated', { offer: uiOffer });

      return record;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Deletes an offer
   * @param offerHash The hash of the offer to delete
   * @returns Promise that resolves when the offer is deleted
   */
  async function deleteOffer(offerHash: ActionHash): Promise<void> {
    loading = true;
    error = null;

    try {
      await offersService.deleteOffer(offerHash);

      // Remove from cache
      cache.remove(offerHash);

      // Emit event through event bus
      eventBus.emit('offer:deleted', { offerHash });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  // Return the store object with state and methods
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
}

// Create a singleton instance of the store
const offersStore = createOffersStore(offersService, storeEventBus);
export default offersStore;
