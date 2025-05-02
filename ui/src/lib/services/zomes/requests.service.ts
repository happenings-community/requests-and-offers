import type { ActionHash, Record } from '@holochain/client';
import { type RequestInDHT } from '@lib/types/holochain';
import holochainClientService, {
  type HolochainClientService
} from '../HolochainClientService.svelte';
import { Effect as E, pipe } from 'effect';

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'RequestError';
  }

  static fromError(error: unknown, context: string): RequestError {
    if (error instanceof Error) {
      return new RequestError(`${context}: ${error.message}`, error);
    }
    return new RequestError(`${context}: ${String(error)}`, error);
  }
}

export type RequestsService = {
  createRequest: (
    request: RequestInDHT,
    organizationHash?: ActionHash
  ) => E.Effect<Record, RequestError>;
  getLatestRequestRecord: (originalActionHash: ActionHash) => E.Effect<Record | null, RequestError>;
  getLatestRequest: (originalActionHash: ActionHash) => E.Effect<RequestInDHT | null, RequestError>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => E.Effect<Record, RequestError>;
  getAllRequestsRecords: () => E.Effect<Record[], RequestError>;
  getUserRequestsRecords: (userHash: ActionHash) => E.Effect<Record[], RequestError>;
  getOrganizationRequestsRecords: (
    organizationHash: ActionHash
  ) => E.Effect<Record[], RequestError>;
  deleteRequest: (requestHash: ActionHash) => E.Effect<boolean, RequestError>;
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
  const createRequest = (
    request: RequestInDHT,
    organizationHash?: ActionHash
  ): E.Effect<Record, RequestError> =>
    pipe(
      E.tryPromise({
        try: () =>
          hc.callZome('requests', 'create_request', {
            request,
            organization: organizationHash
          }),
        catch: (error: unknown) => RequestError.fromError(error, 'Failed to create request')
      }),
      E.map((record: unknown) => record as Record)
    );

  /**
   * Gets the latest request record
   * @param originalActionHash The original action hash of the request
   * @returns The latest request record or null if not found
   */
  const getLatestRequestRecord = (
    originalActionHash: ActionHash
  ): E.Effect<Record | null, RequestError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('requests', 'get_latest_request_record', originalActionHash),
        catch: (error: unknown) =>
          RequestError.fromError(error, 'Failed to get latest request record')
      }),
      E.map((record: unknown) => record as Record | null)
    );

  /**
   * Gets the latest request
   * @param originalActionHash The original action hash of the request
   * @returns The latest request or null if not found
   */
  const getLatestRequest = (
    originalActionHash: ActionHash
  ): E.Effect<RequestInDHT | null, RequestError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('requests', 'get_latest_request', originalActionHash),
        catch: (error: unknown) => RequestError.fromError(error, 'Failed to get latest request')
      }),
      E.map((request: unknown) => request as RequestInDHT | null)
    );

  /**
   * Updates an existing request
   * @param originalActionHash The original action hash of the request
   * @param previousActionHash The previous action hash of the request
   * @param updatedRequest The updated request data
   * @returns The updated record
   */
  const updateRequest = (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ): E.Effect<Record, RequestError> =>
    pipe(
      E.tryPromise({
        try: () =>
          hc.callZome('requests', 'update_request', {
            original_action_hash: originalActionHash,
            previous_action_hash: previousActionHash,
            updated_request: updatedRequest
          }),
        catch: (error: unknown) => RequestError.fromError(error, 'Failed to update request')
      }),
      E.map((record: unknown) => record as Record)
    );

  /**
   * Gets all requests records
   * @returns Array of request records
   */
  const getAllRequestsRecords = (): E.Effect<Record[], RequestError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('requests', 'get_all_requests', null),
        catch: (error: unknown) => RequestError.fromError(error, 'Failed to get all requests')
      }),
      E.map((records: unknown) => records as Record[])
    );

  /**
   * Gets requests records for a specific user
   * @param userHash The user's action hash
   * @returns Array of request records for the user
   */
  const getUserRequestsRecords = (userHash: ActionHash): E.Effect<Record[], RequestError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('requests', 'get_user_requests', userHash),
        catch: (error: unknown) => RequestError.fromError(error, 'Failed to get user requests')
      }),
      E.map((records: unknown) => records as Record[])
    );

  /**
   * Gets requests records for a specific organization
   * @param organizationHash The organization's action hash
   * @returns Array of request records for the organization
   */
  const getOrganizationRequestsRecords = (
    organizationHash: ActionHash
  ): E.Effect<Record[], RequestError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('requests', 'get_organization_requests', organizationHash),
        catch: (error: unknown) =>
          RequestError.fromError(error, 'Failed to get organization requests')
      }),
      E.map((records: unknown) => records as Record[])
    );

  /**
   * Deletes a request (placeholder implementation)
   * @param requestHash The hash of the request to delete
   * @returns Promise that resolves when the request is deleted
   */
  const deleteRequest = (requestHash: ActionHash): E.Effect<boolean, RequestError> =>
    pipe(
      E.tryPromise({
        try: () => hc.callZome('requests', 'delete_request', requestHash),
        catch: (error: unknown) => RequestError.fromError(error, 'Failed to delete request')
      }),
      E.map((result: unknown) => result as boolean)
    );

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
