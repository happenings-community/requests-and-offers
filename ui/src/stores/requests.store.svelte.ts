import type { ActionHash, Record } from '@holochain/client';
import { decodeRecords } from '@utils';
import type { UIRequest } from '@/types/ui';
import type { RequestInDHT } from '@/types/holochain';
import requestsService, { type RequestsService } from '@/services/zomes/requests.service';
import eventBus, { type EventBus, type AppEvents } from './eventBus';
import hc from '@/services/HolochainClientService.svelte';
export type RequestsStore = {
  readonly requests: UIRequest[];
  readonly loading: boolean;
  readonly error: string | null;
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
};

/**
 * Factory function to create a requests store
 * @returns A requests store with state and methods
 */
export function RequestsStore(
  requestsService: RequestsService,
  eventBus: EventBus<AppEvents>
): RequestsStore {
  // State
  const requests: UIRequest[] = $state([]);
  let loading: boolean = $state(false);
  let error: string | null = $state(null);

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

      // Use decodeRecords to transform the record
      const newRequest: UIRequest = {
        ...decodeRecords<RequestInDHT>([record])[0],
        original_action_hash: record.signed_action.hashed.hash,
        previous_action_hash: record.signed_action.hashed.hash,
        organization: organizationHash,
        creator: (await hc.getAppInfo())!.agent_pub_key,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      requests.push(newRequest);

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
      const records = await requestsService.getAllRequestsRecords();

      const fetchedRequests = records.map(async (record) => {
        const request = decodeRecords<RequestInDHT>([record])[0];
        return {
          ...request,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          creator: (await hc.getAppInfo())!.agent_pub_key
        } as UIRequest;
      });

      requests.length = 0; // Clear the array
      requests.push(...(await Promise.all(fetchedRequests))); // Add all fetched requests

      return requests;
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
      const records = await requestsService.getUserRequestsRecords(userHash);

      return records.map((record) => {
        const request = decodeRecords<RequestInDHT>([record])[0];
        return {
          ...request,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          creator: userHash
        } as UIRequest;
      });
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
      const records = await requestsService.getOrganizationRequestsRecords(organizationHash);

      return records.map((record) => {
        const request = decodeRecords<RequestInDHT>([record])[0];
        return {
          ...request,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          organization: organizationHash
        } as UIRequest;
      });
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
      const record = await requestsService.getLatestRequestRecord(originalActionHash);

      if (!record) {
        return null;
      }

      const request = decodeRecords<RequestInDHT>([record])[0];

      return {
        ...request,
        original_action_hash: originalActionHash,
        previous_action_hash: record.signed_action.hashed.hash,
        updated_at: Date.now()
      };
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

      const updatedUIRequest: UIRequest = {
        ...request,
        original_action_hash: originalActionHash,
        previous_action_hash: record.signed_action.hashed.hash,
        creator: (await hc.getAppInfo())!.agent_pub_key,
        updated_at: Date.now()
      };

      // Update the request in the local store
      const index = requests.findIndex(
        (r) => r.original_action_hash?.toString() === originalActionHash.toString()
      );
      if (index !== -1) {
        requests[index] = updatedUIRequest;
      }

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

  // Return the store methods
  return {
    requests,
    loading,
    error,
    createRequest,
    getAllRequests,
    getUserRequests,
    getOrganizationRequests,
    getLatestRequest,
    updateRequest
  };
}

// Create a singleton instance of the store
const requestsStore = RequestsStore(requestsService, eventBus);
export default requestsStore;
