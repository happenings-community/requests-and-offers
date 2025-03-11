import type { ActionHash, Record } from '@holochain/client';
import type { UIRequest } from '@/types/ui';
import type { RequestInDHT } from '@/types/holochain';
import requestsService, { type RequestsService } from '@/services/zomes/requests.service';
import { decodeRecords } from '@utils';
import { type EventBus } from '@/utils/eventBus';
import usersStore from '@/stores/users.store.svelte';
import { createEntityCache, type EntityCache } from '@/utils/cache.svelte';
import { storeEventBus, type StoreEvents } from '@/stores/storeEvents';

export type RequestsStore = {
  readonly requests: UIRequest[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly cache: EntityCache<UIRequest>;
  getLatestRequest: (originalActionHash: ActionHash) => Promise<UIRequest | null>;
  getAllRequests: () => Promise<UIRequest[]>;
  getUserRequests: (userHash: ActionHash) => Promise<UIRequest[]>;
  getOrganizationRequests: (organizationHash: ActionHash) => Promise<UIRequest[]>;
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Promise<Record>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Promise<Record>;
  deleteRequest?: (requestHash: ActionHash) => Promise<void>;
  invalidateCache: () => void;
};

/**
 * Factory function to create a requests store
 * @returns A requests store with state and methods
 */
export function createRequestsStore(
  requestsService: RequestsService,
  eventBus: EventBus<StoreEvents>
): RequestsStore {
  // State
  const requests: UIRequest[] = $state([]);
  let loading: boolean = $state(false);
  let error: string | null = $state(null);

  // Create a cache for requests
  const cache = createEntityCache<UIRequest>({
    expiryMs: 5 * 60 * 1000, // 5 minutes
    debug: false
  });

  // Set up cache event listeners

  // When a request is added to the cache, update the requests array if needed
  cache.on('cache:set', ({ entity }) => {
    const index = requests.findIndex(
      (r) => r.original_action_hash?.toString() === entity.original_action_hash?.toString()
    );

    if (index !== -1) {
      // Update existing request
      requests[index] = entity;
    } else {
      // Add new request if it's not already in the array
      requests.push(entity);
    }
  });

  // When a request is removed from the cache, also remove it from the requests array
  cache.on('cache:remove', ({ hash }) => {
    const index = requests.findIndex((r) => r.original_action_hash?.toString() === hash);

    if (index !== -1) {
      requests.splice(index, 1);
    }
  });

  /**
   * Invalidates the entire cache
   */
  function invalidateCache(): void {
    cache.clear();
  }

  /**
   * Creates a new request
   * @param request The request to create
   * @param organizationHash Optional organization hash to associate with the request
   * @returns The created record
   */
  async function createRequest(
    request: RequestInDHT,
    organizationHash?: ActionHash
  ): Promise<Record> {
    loading = true;
    error = null;

    try {
      const record = await requestsService.createRequest(request, organizationHash);

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
      const newRequest: UIRequest = {
        ...decodeRecords<RequestInDHT>([record])[0],
        original_action_hash: record.signed_action.hashed.hash,
        previous_action_hash: record.signed_action.hashed.hash,
        organization: organizationHash,
        creator: creatorHash,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      // Add to cache
      cache.set(newRequest);

      // Emit event through event bus
      eventBus.emit('request:created', { request: newRequest });

      return record;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets all requests
   * @returns Array of requests
   */
  async function getAllRequests(): Promise<UIRequest[]> {
    loading = true;
    error = null;

    try {
      // Check if we have valid cached requests
      const cachedRequests = cache.getAllValid();
      if (cachedRequests.length > 0) {
        return cachedRequests;
      }

      const records = await requestsService.getAllRequestsRecords();

      const fetchedRequests = await Promise.all(
        records.map(async (record) => {
          const request = decodeRecords<RequestInDHT>([record])[0];
          const authorPubKey = record.signed_action.hashed.content.author;

          // Get the user profile for this agent
          let userProfile = null;
          try {
            userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
          } catch (err) {
            console.warn('Failed to get user profile during request mapping:', err);
          }

          return {
            ...request,
            original_action_hash: record.signed_action.hashed.hash,
            previous_action_hash: record.signed_action.hashed.hash,
            creator: userProfile?.original_action_hash || authorPubKey
          } as UIRequest;
        })
      );

      // Update the cache with all fetched requests
      fetchedRequests.forEach((request) => {
        cache.set(request);
      });

      // Clear and update the requests array
      requests.length = 0;
      requests.push(...fetchedRequests);

      return fetchedRequests;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets requests for a specific user
   * @param userHash The user's action hash
   * @returns Array of requests for the user
   */
  async function getUserRequests(userHash: ActionHash): Promise<UIRequest[]> {
    loading = true;
    error = null;

    try {
      // We can't easily cache this by user, so we'll always fetch
      const records = await requestsService.getUserRequestsRecords(userHash);

      const userRequests = await Promise.all(
        records.map(async (record) => {
          // First check if this request is already in the cache
          const requestHash = record.signed_action.hashed.hash;
          const cachedRequest = cache.get(requestHash);

          if (cachedRequest) {
            return cachedRequest;
          }

          // If not in cache, process and cache it
          const request = decodeRecords<RequestInDHT>([record])[0];
          const authorPubKey = record.signed_action.hashed.content.author;

          // Get the user profile for this agent
          let userProfile = null;
          try {
            userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
          } catch (err) {
            console.warn('Failed to get user profile during request mapping:', err);
          }

          const uiRequest = {
            ...request,
            original_action_hash: requestHash,
            previous_action_hash: requestHash,
            creator: userProfile?.original_action_hash || authorPubKey
          } as UIRequest;

          // Add to cache
          cache.set(uiRequest);

          return uiRequest;
        })
      );

      return userRequests;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets requests for a specific organization
   * @param organizationHash The organization's action hash
   * @returns Array of requests for the organization
   */
  async function getOrganizationRequests(organizationHash: ActionHash): Promise<UIRequest[]> {
    loading = true;
    error = null;

    try {
      // We can't easily cache this by organization, so we'll always fetch
      const records = await requestsService.getOrganizationRequestsRecords(organizationHash);

      const orgRequests = await Promise.all(
        records.map(async (record) => {
          // First check if this request is already in the cache
          const requestHash = record.signed_action.hashed.hash;
          const cachedRequest = cache.get(requestHash);

          if (cachedRequest) {
            return cachedRequest;
          }

          // If not in cache, process and cache it
          const request = decodeRecords<RequestInDHT>([record])[0];
          const authorPubKey = record.signed_action.hashed.content.author;

          // Get the user profile for this agent
          let userProfile = null;
          try {
            userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
          } catch (err) {
            console.warn('Failed to get user profile during request mapping:', err);
          }

          const uiRequest = {
            ...request,
            original_action_hash: requestHash,
            previous_action_hash: requestHash,
            creator: userProfile?.original_action_hash || authorPubKey,
            organization: organizationHash
          } as UIRequest;

          // Add to cache
          cache.set(uiRequest);

          return uiRequest;
        })
      );

      return orgRequests;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Gets the latest version of a request
   * @param originalActionHash The original action hash of the request
   * @returns The latest version of the request or null if not found
   */
  async function getLatestRequest(originalActionHash: ActionHash): Promise<UIRequest | null> {
    loading = true;
    error = null;

    try {
      // Try to get from cache first
      return await cache.getOrFetch(originalActionHash, async (hash) => {
        const record = await requestsService.getLatestRequestRecord(hash);

        if (!record) {
          return null;
        }

        const request = decodeRecords<RequestInDHT>([record])[0];
        const authorPubKey = record.signed_action.hashed.content.author;

        // Get the user profile for this agent
        let userProfile = null;
        try {
          userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
        } catch (err) {
          console.warn('Failed to get user profile during request mapping:', err);
        }

        return {
          ...request,
          original_action_hash: hash,
          previous_action_hash: record.signed_action.hashed.hash,
          creator: userProfile?.original_action_hash || authorPubKey,
          updated_at: Date.now()
        };
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Updates an existing request
   * @param originalActionHash The original action hash of the request
   * @param previousActionHash The previous action hash of the request
   * @param updatedRequest The updated request data
   * @returns The updated record
   */
  async function updateRequest(
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ): Promise<Record> {
    loading = true;
    error = null;

    try {
      const record = await requestsService.updateRequest(
        originalActionHash,
        previousActionHash,
        updatedRequest
      );

      const request = decodeRecords<RequestInDHT>([record])[0];

      // Get the existing request to preserve its creator
      const existingRequest =
        cache.get(originalActionHash) ||
        requests.find((r) => r.original_action_hash?.toString() === originalActionHash.toString());

      let creator;
      if (existingRequest?.creator) {
        creator = existingRequest.creator;
      } else {
        const authorPubKey = record.signed_action.hashed.content.author;
        let userProfile = null;

        try {
          userProfile = await usersStore.getUserByAgentPubKey(authorPubKey);
        } catch (err) {
          console.warn('Failed to get user profile during request update:', err);
        }

        creator = userProfile?.original_action_hash || authorPubKey;
      }

      const updatedUIRequest: UIRequest = {
        ...request,
        original_action_hash: originalActionHash,
        previous_action_hash: record.signed_action.hashed.hash,
        creator: creator,
        organization: existingRequest?.organization,
        updated_at: Date.now()
      };

      // Update the cache
      cache.set(updatedUIRequest);

      // Emit event through event bus
      eventBus.emit('request:updated', { request: updatedUIRequest });

      return record;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  /**
   * Deletes a request
   * @param requestHash The hash of the request to delete
   */
  async function deleteRequest(requestHash: ActionHash): Promise<void> {
    loading = true;
    error = null;

    try {
      await requestsService.deleteRequest(requestHash);

      // Remove from cache
      cache.remove(requestHash);

      // Emit event through event bus
      eventBus.emit('request:deleted', { requestHash });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      loading = false;
    }
  }

  return {
    requests,
    loading,
    error,
    cache,
    createRequest,
    getAllRequests,
    getUserRequests,
    getOrganizationRequests,
    getLatestRequest,
    updateRequest,
    deleteRequest,
    invalidateCache
  };
}

// Create a singleton instance of the store
const requestsStore = createRequestsStore(requestsService, storeEventBus);
export default requestsStore;
