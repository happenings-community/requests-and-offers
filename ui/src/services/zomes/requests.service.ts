import type { ActionHash, Record } from '@holochain/client';
import type { RequestInDHT } from '@/types/holochain';
import holochainClientService, {
  type HolochainClientService
} from '../HolochainClientService.svelte';

// Effect imports for functional programming
import * as E from 'effect/Effect';
import * as O from 'effect/Option';

// Custom error types for more precise error handling
export class RequestCreationError extends Error {
  readonly _tag = 'RequestCreationError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

export class RequestRetrievalError extends Error {
  readonly _tag = 'RequestRetrievalError';
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}

export type RequestsService = {
  createRequest: (
    request: RequestInDHT,
    organizationHash?: ActionHash
  ) => E.Effect<Record, RequestCreationError>;
  getLatestRequestRecord: (
    originalActionHash: ActionHash
  ) => E.Effect<O.Option<Record>, RequestRetrievalError>;
  getLatestRequest: (
    originalActionHash: ActionHash
  ) => E.Effect<O.Option<RequestInDHT>, RequestRetrievalError>;
  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) => E.Effect<Record, RequestCreationError>;
  getAllRequestsRecords: () => E.Effect<Record[], RequestRetrievalError>;
  getUserRequestsRecords: (userHash: ActionHash) => E.Effect<Record[], RequestRetrievalError>;
  getOrganizationRequestsRecords: (
    organizationHash: ActionHash
  ) => E.Effect<Record[], RequestRetrievalError>;
  deleteRequest: (requestHash: ActionHash) => E.Effect<void, Error>;
};

/**
 * Factory function to create a requests service with Effect-based error handling
 * @returns A requests service with methods to interact with the Holochain backend
 */
export function createRequestsService(hc: HolochainClientService): RequestsService {
  /**
   * Creates a new request using Effect for error handling
   * @param request The request to create
   * @param organizationHash Optional organization hash to associate with the request
   * @returns An Effect containing the created record or a RequestCreationError
   */
  function createRequest(
    request: RequestInDHT,
    organizationHash?: ActionHash
  ): E.Effect<Record, RequestCreationError> {
    return E.tryPromise({
      try: async () => {
        console.log('Creating request:', request, 'in organization:', organizationHash);
        return (await hc.callZome('requests', 'create_request', {
          request,
          organization: organizationHash
        })) as Record;
      },
      catch: (error) =>
        new RequestCreationError(
          `Failed to create request: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
    });
  }

  /**
   * Gets the latest request record using Effect for error handling
   * @param originalActionHash The original action hash of the request
   * @returns An Effect containing the latest request record as an Option
   */
  const getLatestRequestRecord = (
    originalActionHash: ActionHash
  ): E.Effect<O.Option<Record>, RequestRetrievalError> => {
    return E.tryPromise({
      try: async () => {
        const record = (await hc.callZome(
          'requests',
          'get_latest_request_record',
          originalActionHash
        )) as Record | null;
        return O.fromNullable(record);
      },
      catch: (error) =>
        new RequestRetrievalError(
          `Failed to retrieve latest request record: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
    });
  };

  /**
   * Gets the latest request using Effect for error handling
   * @param originalActionHash The original action hash of the request
   * @returns An Effect containing the latest request as an Option
   */
  function getLatestRequest(
    originalActionHash: ActionHash
  ): E.Effect<O.Option<RequestInDHT>, RequestRetrievalError> {
    return E.tryPromise({
      try: async () => {
        const request = (await hc.callZome(
          'requests',
          'get_latest_request',
          originalActionHash
        )) as RequestInDHT | null;
        return O.fromNullable(request);
      },
      catch: (error) =>
        new RequestRetrievalError(
          `Failed to retrieve latest request: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
    });
  }

  /**
   * Updates an existing request using Effect for error handling
   * @param originalActionHash The original action hash of the request
   * @param previousActionHash The previous action hash of the request
   * @param updatedRequest The updated request data
   * @returns An Effect containing the updated record
   */
  function updateRequest(
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ): E.Effect<Record, RequestCreationError> {
    return E.tryPromise({
      try: async () =>
        (await hc.callZome('requests', 'update_request', {
          original_action_hash: originalActionHash,
          previous_action_hash: previousActionHash,
          updated_request: updatedRequest
        })) as Record,
      catch: (error) =>
        new RequestCreationError(
          `Failed to update request: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
    });
  }

  /**
   * Gets all requests records using Effect for error handling
   * @returns An Effect containing an array of request records
   */
  function getAllRequestsRecords(): E.Effect<Record[], RequestRetrievalError> {
    return E.tryPromise({
      try: async () => (await hc.callZome('requests', 'get_all_requests', null)) as Record[],
      catch: (error) =>
        new RequestRetrievalError(
          `Failed to retrieve all requests: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
    });
  }

  /**
   * Gets requests records for a specific user using Effect for error handling
   * @param userHash The user's action hash
   * @returns An Effect containing an array of request records for the user
   */
  function getUserRequestsRecords(userHash: ActionHash): E.Effect<Record[], RequestRetrievalError> {
    return E.tryPromise({
      try: async () => (await hc.callZome('requests', 'get_user_requests', userHash)) as Record[],
      catch: (error) =>
        new RequestRetrievalError(
          `Failed to retrieve user requests: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
    });
  }

  /**
   * Gets requests records for a specific organization using Effect for error handling
   * @param organizationHash The organization's action hash
   * @returns An Effect containing an array of request records for the organization
   */
  function getOrganizationRequestsRecords(
    organizationHash: ActionHash
  ): E.Effect<Record[], RequestRetrievalError> {
    return E.tryPromise({
      try: async () =>
        (await hc.callZome('requests', 'get_organization_requests', organizationHash)) as Record[],
      catch: (error) =>
        new RequestRetrievalError(
          `Failed to retrieve organization requests: ${error instanceof Error ? error.message : String(error)}`,
          error
        )
    });
  }

  /**
   * Deletes a request using Effect for error handling
   * @param requestHash The hash of the request to delete
   * @returns An Effect that resolves when the request is deleted
   */
  function deleteRequest(requestHash: ActionHash): E.Effect<void, Error> {
    return E.try({
      try: () => {
        console.log(`Request with hash ${requestHash} would be deleted here`);
        // Placeholder for actual implementation
        // In a real scenario, you would uncomment and use the zome call
        // return hc.callZome('requests', 'delete_request', requestHash);
      },
      catch: (error) =>
        new Error(
          `Failed to delete request: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error }
        )
    });
  }

  // Return the service object with Effect-based methods
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
