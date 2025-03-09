/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, describe, it, beforeEach } from 'bun:test';
import { RequestsStore } from '@/stores/requests.store.svelte';
import { createTestRequest, createMockRecordSync } from '@/tests/utils/test-helpers';
import type { RequestsService } from '@/services/zomes/requests.service';
import type { EventBus } from '@/stores/eventBus';
import type { ActionHash } from '@holochain/client';
import type { RequestInDHT, RequestProcessState } from '@/types/holochain';
import { fakeActionHash } from '@holochain/client';

// Effect imports
import * as E from 'effect/Effect';
import * as O from 'effect/Option';

// Custom error types
import type {
  RequestCreationError,
  RequestRetrievalError,
  RequestUpdateError,
  RequestDeletionError
} from '@/types/errors';

// Mock dependencies
const mockRequestsService: RequestsService = {
  createRequest: (request: RequestInDHT, organizationHash?: ActionHash) =>
    E.try({
      try: () => {
        // Ensure we're returning a Record, not a Promise<Record>
        return createMockRecordSync();
      },
      catch: (error) => ({
        type: 'RequestCreationError' as const,
        message: `Mock request creation failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        _tag: 'RequestCreationError',
        name: 'RequestCreationError'
      })
    }),

  getAllRequestsRecords: () =>
    E.try({
      try: () => {
        // Ensure we're returning Record[], not Promise<Record>[]
        return [createMockRecordSync()];
      },
      catch: (error) => ({
        type: 'RequestRetrievalError' as const,
        message: `Mock all requests retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        _tag: 'RequestRetrievalError',
        name: 'RequestRetrievalError'
      })
    }),

  getUserRequestsRecords: (userHash: ActionHash) =>
    E.try({
      try: () => {
        // Ensure we're returning Record[], not Promise<Record>[]
        return [createMockRecordSync()];
      },
      catch: (error) => ({
        type: 'RequestRetrievalError' as const,
        message: `Mock user requests retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        _tag: 'RequestRetrievalError',
        name: 'RequestRetrievalError'
      })
    }),

  getOrganizationRequestsRecords: (organizationHash: ActionHash) =>
    E.try({
      try: () => {
        // Ensure we're returning Record[], not Promise<Record>[]
        return [createMockRecordSync()];
      },
      catch: (error) => ({
        type: 'RequestRetrievalError' as const,
        message: `Mock organization requests retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        _tag: 'RequestRetrievalError',
        name: 'RequestRetrievalError'
      })
    }),

  getLatestRequestRecord: (originalActionHash: ActionHash) =>
    E.try({
      try: () => {
        // Return Option<Record> directly, not Effect<Option<Record>>
        return O.some(createMockRecordSync());
      },
      catch: (error) => ({
        type: 'RequestRetrievalError' as const,
        message: `Mock latest request record retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        _tag: 'RequestRetrievalError',
        name: 'RequestRetrievalError'
      })
    }),

  getLatestRequest: (originalActionHash: ActionHash) =>
    E.try({
      try: () => {
        // Return Option<RequestInDHT> directly, not Effect<Option<RequestInDHT>>
        return O.some(createTestRequest());
      },
      catch: (error) => ({
        type: 'RequestRetrievalError' as const,
        message: `Mock latest request retrieval failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        _tag: 'RequestRetrievalError',
        name: 'RequestRetrievalError'
      })
    }),

  updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInDHT
  ) =>
    E.try({
      try: () => {
        // Ensure we're returning a Record, not a Promise<Record>
        return createMockRecordSync();
      },
      catch: (error) => ({
        type: 'RequestCreationError' as const,
        message: `Mock request update failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        _tag: 'RequestCreationError',
        name: 'RequestCreationError'
      })
    }),

  deleteRequest: (requestHash: ActionHash) =>
    E.try({
      try: () => {
        console.log(`Mock request deletion for hash ${requestHash}`);
        // Return void, not undefined
        return undefined as unknown as void;
      },
      catch: (error) => ({
        type: 'RequestDeletionError' as const,
        message: `Mock request deletion failed: ${error instanceof Error ? error.message : String(error)}`,
        details: error,
        name: 'Error',
        stack: error instanceof Error ? error.stack : undefined
      })
    })
};

const mockEventBus: EventBus<any> = {
  emit: () => {},
  on: () => () => {},
  off: () => {}
};

describe('RequestsStore Integration', () => {
  let requestsStore: ReturnType<typeof RequestsStore>;
  let requestsService: RequestsService;
  let eventBus: EventBus<any>;
  let userHash: ActionHash;
  let organizationHash: ActionHash;

  beforeEach(async () => {
    userHash = await fakeActionHash();
    organizationHash = await fakeActionHash();
    requestsService = mockRequestsService;
    eventBus = mockEventBus;
    requestsStore = RequestsStore(requestsService, eventBus);
  });

  describe('createRequest', () => {
    it('should create a request', async () => {
      const request: RequestInDHT = {
        title: 'Test Request',
        description: 'Test Description',
        skills: [],
        process_state: 'DRAFT' as RequestProcessState
      };

      const createRequestEffect = requestsStore.createRequest(request, organizationHash);
      const result = await E.runPromise(createRequestEffect);
      expect(result).toBeDefined();
    });
  });

  describe('getAllRequests', () => {
    it('should retrieve all requests', async () => {
      const getAllRequestsEffect = requestsStore.getAllRequestsSync();
      const result = await E.runPromise(getAllRequestsEffect);
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('original_action_hash');
      expect(result[0]).toHaveProperty('previous_action_hash');
    });
  });

  describe('getUserRequests', () => {
    it('should retrieve user requests', async () => {
      const getUserRequestsEffect = requestsStore.getUserRequestsSync(userHash);
      const result = await E.runPromise(getUserRequestsEffect);
      expect(result.length).toBe(1);
      expect(result[0]).toHaveProperty('original_action_hash');
      expect(result[0]).toHaveProperty('previous_action_hash');
    });
  });

  describe('getOrganizationRequests', () => {
    it('should retrieve organization requests', async () => {
      const getOrganizationRequestsEffect =
        requestsStore.getOrganizationRequestsSync(organizationHash);

      const result = await E.runPromise(
        E.map(getOrganizationRequestsEffect, (requests) => {
          expect(requests).toBeDefined();
          expect(Array.isArray(requests)).toBe(true);
          expect(requests.length).toBe(1);
          expect(requests[0]).toHaveProperty('original_action_hash');
          expect(requests[0]).toHaveProperty('previous_action_hash');
          return requests;
        })
      );

      expect(result.length).toBe(1);
    });
  });

  describe('getLatestRequest', () => {
    it('should retrieve the latest request', async () => {
      const originalActionHash = new Uint8Array(32); // Use a fake ActionHash
      for (let i = 0; i < originalActionHash.length; i++) {
        originalActionHash[i] = i % 256;
      }

      const getLatestRequestEffect = requestsStore.getLatestRequestSync(originalActionHash);

      const result = await E.runPromise(
        E.flatMap(getLatestRequestEffect, (optionRequest) => {
          // Handle Option type
          return E.succeed(
            O.getOrElse(optionRequest, () => {
              throw new Error('Request not found');
            })
          );
        })
      );

      expect(result).toBeDefined();
      expect(result).toHaveProperty('original_action_hash');
      expect(result).toHaveProperty('previous_action_hash');
    });
  });
});
