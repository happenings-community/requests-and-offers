import * as E from 'effect/Effect';
import * as O from 'effect/Option';
import { pipe } from 'effect/Function';
import type { Record, ActionHash } from '@holochain/client';

// Types
import type { RequestInDHT, RequestProcessState } from '@/types/holochain';
import type { UIRequest } from '@/types/ui';
import type {
  RequestRetrievalError,
  RequestUpdateError,
  RequestDeletionError,
  RequestCreationError
} from '@/types/errors';

// Services
import requestsService from '@/services/zomes/requests.service';

// Event bus
import eventBus from '@/stores/eventBus';

// Utility functions
import { decodeRecords } from '@/tests/utils/test-helpers';

// Type guard for Record
function isRecord(value: unknown): value is Record {
  return (
    value !== null &&
    typeof value === 'object' &&
    'signed_action' in value &&
    typeof (value as Record).signed_action === 'object'
  );
}

// Type guard for RequestInDHT
function isRequestInDHT(value: unknown): value is RequestInDHT {
  return value !== null && typeof value === 'object' && 'title' in value && 'description' in value;
}

// Error handling functions with proper typing
function createRequestCreationError(error: unknown): RequestCreationError {
  return {
    type: 'RequestCreationError' as const,
    message: error instanceof Error ? error.message : 'Unknown error',
    details: error,
    _tag: 'RequestCreationError',
    name: 'RequestCreationError'
  };
}

function createRequestRetrievalError(error: unknown): RequestRetrievalError {
  return {
    type: 'RequestRetrievalError' as const,
    message: error instanceof Error ? error.message : 'Unknown error',
    details: error,
    _tag: 'RequestRetrievalError',
    name: 'RequestRetrievalError'
  };
}

function createRequestUpdateError(error: unknown): RequestUpdateError {
  return {
    type: 'RequestUpdateError' as const,
    message: error instanceof Error ? error.message : 'Unknown error',
    details: error,
    _tag: 'RequestUpdateError',
    name: 'RequestUpdateError'
  };
}

function createRequestDeletionError(error: unknown): RequestDeletionError {
  return {
    type: 'RequestDeletionError' as const,
    message: error instanceof Error ? error.message : 'Unknown error',
    details: error,
    _tag: 'RequestDeletionError',
    name: 'RequestDeletionError'
  };
}

/**
 * Factory function for RequestsStore
 * @returns RequestsStore with methods for managing requests
 */
export function RequestsStore(service = requestsService, bus = eventBus) {
  // Use $state rune for reactive state
  const requests = $state<UIRequest[]>([]);

  /**
   * Create a new request
   * @param request Request details to create
   * @param organizationHash Optional organization hash
   * @returns Effect of created request record
   */
  function createRequest(
    request: RequestInDHT,
    organizationHash?: ActionHash
  ): E.Effect<Record, RequestCreationError, never> {
    return E.gen(function* () {
      const record = yield* E.try({
        try: () => service.createRequest(request, organizationHash),
        catch: (error) => createRequestCreationError(error)
      });

      if (!isRecord(record)) {
        return yield* E.fail<RequestCreationError>({
          type: 'RequestCreationError' as const,
          message: 'Invalid record returned from service',
          details: record,
          _tag: 'RequestCreationError',
          name: 'RequestCreationError'
        });
      }

      const decodedRequest = decodeRecords<RequestInDHT>([record])[0];

      if (!isRequestInDHT(decodedRequest)) {
        return yield* E.fail<RequestCreationError>({
          type: 'RequestCreationError' as const,
          message: 'Failed to decode request',
          details: decodedRequest,
          _tag: 'RequestCreationError',
          name: 'RequestCreationError'
        });
      }

      const newRequest: UIRequest = {
        ...decodedRequest,
        original_action_hash: record.signed_action.hashed.hash,
        previous_action_hash: record.signed_action.hashed.hash,
        organization: organizationHash,
        created_at: Date.now(),
        updated_at: Date.now()
      };

      // Mutate state using Svelte 5 $state
      requests.push(newRequest);

      // Emit event through event bus
      bus.emit('request:created', { request: newRequest });

      return record;
    });
  }

  /**
   * Get all requests synchronously
   * @returns Effect of UIRequest array
   */
  function getAllRequestsSync(): E.Effect<UIRequest[], RequestRetrievalError, never> {
    return E.gen(function* () {
      const records = yield* E.try({
        try: () => service.getAllRequestsRecords(),
        catch: (error) => createRequestRetrievalError(error)
      });

      if (!Array.isArray(records)) {
        return yield* E.fail<RequestRetrievalError>({
          type: 'RequestRetrievalError' as const,
          message: 'Invalid records returned from service',
          details: records,
          _tag: 'RequestRetrievalError',
          name: 'RequestRetrievalError'
        });
      }

      const decodedRequests = records.reduce<UIRequest[]>((acc, record) => {
        if (!isRecord(record)) return acc;

        const request = decodeRecords<RequestInDHT>([record])[0];
        if (!isRequestInDHT(request)) return acc;

        acc.push({
          ...request,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          created_at: Date.now(),
          updated_at: Date.now()
        });
        return acc;
      }, []);

      requests.splice(0, requests.length, ...decodedRequests);
      return decodedRequests;
    });
  }

  /**
   * Get all requests synchronously, with a method name matching route expectations
   * @returns Effect of UIRequest array
   */
  function getAllRequests(): E.Effect<UIRequest[], RequestRetrievalError, never> {
    return getAllRequestsSync();
  }

  /**
   * Get user's requests synchronously
   * @param userHash User's action hash
   * @returns Effect of UIRequest array
   */
  function getUserRequestsSync(
    userHash: ActionHash
  ): E.Effect<UIRequest[], RequestRetrievalError, never> {
    return E.gen(function* () {
      const records = yield* E.try({
        try: () => service.getUserRequestsRecords(userHash),
        catch: (error) => createRequestRetrievalError(error)
      });

      if (!Array.isArray(records)) {
        return yield* E.fail<RequestRetrievalError>({
          type: 'RequestRetrievalError' as const,
          message: 'Invalid records returned from service',
          details: records,
          _tag: 'RequestRetrievalError',
          name: 'RequestRetrievalError'
        });
      }

      const decodedRequests = records.reduce<UIRequest[]>((acc, record) => {
        if (!isRecord(record)) return acc;

        const request = decodeRecords<RequestInDHT>([record])[0];
        if (!isRequestInDHT(request)) return acc;

        acc.push({
          ...request,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          created_at: Date.now(),
          updated_at: Date.now()
        });
        return acc;
      }, []);

      requests.splice(0, requests.length, ...decodedRequests);
      return decodedRequests;
    });
  }

  /**
   * Get organization's requests synchronously
   * @param organizationHash Organization's action hash
   * @returns Effect of UIRequest array
   */
  function getOrganizationRequestsSync(
    organizationHash: ActionHash
  ): E.Effect<UIRequest[], RequestRetrievalError, never> {
    return E.gen(function* () {
      const records = yield* E.try({
        try: () => service.getOrganizationRequestsRecords(organizationHash),
        catch: (error) => createRequestRetrievalError(error)
      });

      if (!Array.isArray(records)) {
        return yield* E.fail<RequestRetrievalError>({
          type: 'RequestRetrievalError' as const,
          message: 'Invalid records returned from service',
          details: records,
          _tag: 'RequestRetrievalError',
          name: 'RequestRetrievalError'
        });
      }

      const decodedRequests = records.reduce<UIRequest[]>((acc, record) => {
        if (!isRecord(record)) return acc;

        const request = decodeRecords<RequestInDHT>([record])[0];
        if (!isRequestInDHT(request)) return acc;

        acc.push({
          ...request,
          original_action_hash: record.signed_action.hashed.hash,
          previous_action_hash: record.signed_action.hashed.hash,
          organization: organizationHash,
          created_at: Date.now(),
          updated_at: Date.now()
        });
        return acc;
      }, []);

      requests.splice(0, requests.length, ...decodedRequests);
      return decodedRequests;
    });
  }

  /**
   * Get latest request record synchronously
   * @param requestHash Request's action hash
   * @returns Option of Record
   */
  function getLatestRequestRecord(
    requestHash: ActionHash
  ): E.Effect<O.Option<Record>, RequestRetrievalError, never> {
    return pipe(
      service.getLatestRequestRecord(requestHash),
      E.catchAll((error) => E.fail(createRequestRetrievalError(error))),
      E.map((recordOption) =>
        O.isSome(recordOption) && isRecord(recordOption.value)
          ? O.some(recordOption.value)
          : O.none()
      )
    );
  }

  /**
   * Get latest request synchronously
   * @param requestHash Request's action hash
   * @returns Effect of optional UIRequest
   */
  function getLatestRequestSync(
    requestHash: ActionHash
  ): E.Effect<O.Option<UIRequest>, RequestRetrievalError, never> {
    return pipe(
      getLatestRequestRecord(requestHash),
      E.map((recordOption) =>
        O.flatMap(recordOption, (record) => {
          const request = decodeRecords<RequestInDHT>([record])[0];

          if (!isRequestInDHT(request)) {
            return O.none();
          }

          return O.some({
            ...request,
            original_action_hash: record.signed_action.hashed.hash,
            previous_action_hash: record.signed_action.hashed.hash,
            created_at: Date.now(),
            updated_at: Date.now()
          } as UIRequest);
        })
      )
    );
  }

  /**
   * Get the latest request, unwrapping the Option
   * @param originalActionHash Action hash of the request
   * @returns Effect of optional UIRequest
   */
  function getLatestRequest(
    originalActionHash: ActionHash
  ): E.Effect<O.Option<UIRequest>, RequestRetrievalError, never> {
    return getLatestRequestSync(originalActionHash);
  }

  /**
   * Update request status
   * @param requestHash Request's action hash
   * @param previousActionHash Previous action hash
   * @param newStatus New process state
   * @returns Updated request record
   */
  function updateRequestStatus(
    requestHash: ActionHash,
    previousActionHash: ActionHash,
    newStatus: RequestProcessState
  ): E.Effect<Record, RequestUpdateError, never> {
    return E.gen(function* () {
      // Fetch the latest request
      const requestOptionEffect = getLatestRequestSync(requestHash);

      // Map potential retrieval error to update error
      const requestOption = yield* pipe(
        requestOptionEffect,
        E.mapError((retrievalError) =>
          createRequestUpdateError({
            message: `Failed to retrieve request: ${retrievalError.message}`,
            details: retrievalError,
            _tag: 'RequestUpdateError',
            name: 'RequestUpdateError'
          })
        )
      );

      // Check if the request exists
      if (O.isNone(requestOption)) {
        return yield* E.fail(
          createRequestUpdateError({
            message: 'Request not found',
            _tag: 'RequestUpdateError',
            name: 'RequestUpdateError'
          })
        );
      }

      // Extract the request from the Option
      const request = O.getOrThrow(requestOption);

      // Update the request state
      const updatedRequest: RequestInDHT = {
        ...request,
        process_state: newStatus
      };

      // Call service to update request
      return yield* pipe(
        requestsService.updateRequest(requestHash, previousActionHash, updatedRequest),
        E.mapError((error) =>
          createRequestUpdateError({
            message: `Failed to update request: ${error instanceof Error ? error.message : String(error)}`,
            details: error,
            _tag: 'RequestUpdateError',
            name: 'RequestUpdateError'
          })
        )
      );
    });
  }

  /**
   * Delete a request
   * @param requestHash Request's action hash
   * @returns Effect of void
   */
  function deleteRequest(requestHash: ActionHash): E.Effect<void, RequestDeletionError, never> {
    return E.gen(function* () {
      yield* E.try({
        try: () => service.deleteRequest(requestHash),
        catch: (error) => createRequestDeletionError(error)
      });

      const index = requests.findIndex((req) => req.original_action_hash === requestHash);
      if (index !== -1) {
        requests.splice(index, 1);
      }

      bus.emit('request:deleted', { requestHash });
    });
  }

  // Return store methods
  return {
    get requests() {
      return requests;
    },
    createRequest,
    getAllRequests,
    getAllRequestsSync,
    getUserRequestsSync,
    getOrganizationRequestsSync,
    getLatestRequestSync,
    getLatestRequest,
    updateRequestStatus,
    deleteRequest
  };
}

// Create default store instance
const requestsStore = RequestsStore();
export default requestsStore;
