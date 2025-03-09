import type { ActionHash, Record } from '@holochain/client';
import type { RequestInDHT } from '@/types/holochain';
import holochainClientService, {
  type HolochainClientService
} from '../HolochainClientService.svelte';

export type RequestsService = {
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) => Promise<Record>;
  getLatestRequestRecord: (originalActionHash: ActionHash) => Promise<Record | null>;
  getLatestRequest: (originalActionHash: ActionHash) => Promise<RequestInDHT | null>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => Promise<Record>;
  getAllRequestsRecords: () => Promise<Record[]>;
  getUserRequestsRecords: (userHash: ActionHash) => Promise<Record[]>;
  getOrganizationRequestsRecords: (organizationHash: ActionHash) => Promise<Record[]>;
  deleteRequest: (requestHash: ActionHash) => Promise<void>;
};

/**
 * Factory function to create a requests service
 * @returns A requests service with methods to interact with the Holochain backend
 */
export function createRequestsService(hc: HolochainClientService): RequestsService {
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
    try {
      console.log('Creating request:', request, 'in organization:', organizationHash);
      return (await hc.callZome('requests', 'create_request', {
        request,
        organization: organizationHash
      })) as Record;
    } catch (err) {
      throw new Error(`Failed to create request: ${err}`);
    }
  }

  /**
   * Gets the latest request record
   * @param originalActionHash The original action hash of the request
   * @returns The latest request record or null if not found
   */
  async function getLatestRequestRecord(originalActionHash: ActionHash): Promise<Record | null> {
    return (await hc.callZome(
      'requests',
      'get_latest_request_record',
      originalActionHash
    )) as Record | null;
  }

  /**
   * Gets the latest request
   * @param originalActionHash The original action hash of the request
   * @returns The latest request or null if not found
   */
  async function getLatestRequest(originalActionHash: ActionHash): Promise<RequestInDHT | null> {
    return (await hc.callZome(
      'requests',
      'get_latest_request',
      originalActionHash
    )) as RequestInDHT | null;
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
    try {
      return (await hc.callZome('requests', 'update_request', {
        original_action_hash: originalActionHash,
        previous_action_hash: previousActionHash,
        updated_request: updatedRequest
      })) as Record;
    } catch (err) {
      throw new Error(`Failed to update request: ${err}`);
    }
  }

  /**
   * Gets all requests records
   * @returns Array of request records
   */
  async function getAllRequestsRecords(): Promise<Record[]> {
    try {
      return (await hc.callZome('requests', 'get_all_requests', null)) as Record[];
    } catch (err) {
      throw new Error(`Failed to get all requests: ${err}`);
    }
  }

  /**
   * Gets requests records for a specific user
   * @param userHash The user's action hash
   * @returns Array of request records for the user
   */
  async function getUserRequestsRecords(userHash: ActionHash): Promise<Record[]> {
    try {
      return (await hc.callZome('requests', 'get_user_requests', userHash)) as Record[];
    } catch (err) {
      throw new Error(`Failed to get user requests: ${err}`);
    }
  }

  /**
   * Gets requests records for a specific organization
   * @param organizationHash The organization's action hash
   * @returns Array of request records for the organization
   */
  async function getOrganizationRequestsRecords(organizationHash: ActionHash): Promise<Record[]> {
    try {
      return (await hc.callZome(
        'requests',
        'get_organization_requests',
        organizationHash
      )) as Record[];
    } catch (err) {
      throw new Error(`Failed to get organization requests: ${err}`);
    }
  }

  /**
   * Deletes a request (placeholder implementation)
   * @param requestHash The hash of the request to delete
   * @returns Promise that resolves when the request is deleted
   */
  async function deleteRequest(requestHash: ActionHash): Promise<void> {
    try {
      await hc.callZome('requests', 'delete_request', requestHash);
    } catch (err) {
      throw new Error(`Failed to delete request: ${err}`);
    }
  }

  // Return the service object with methods
  return {
    createRequest,
    getLatestRequestRecord,
    getLatestRequest,
    updateRequest,
    getAllRequestsRecords,
    getUserRequestsRecords,
    getOrganizationRequestsRecords,
    deleteRequest
  };
}

// Create a singleton instance of the service
const requestsService = createRequestsService(holochainClientService);
export default requestsService;
