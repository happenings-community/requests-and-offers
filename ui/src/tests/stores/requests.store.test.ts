/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, describe, it, beforeEach } from 'vitest';
import { RequestsStore } from '@/stores/requests.store.svelte';
import {
  createTestRequest,
  createMockRecordSync,
  mockRequestsService
} from '@/tests/utils/test-helpers';
import type { RequestsService } from '@/services/zomes/requests.service';
import type { ActionHash } from '@holochain/client';
import type { RequestInDHT, RequestProcessState } from '@/types/holochain';
import { createEventBus, type AppEvents, type EventBus } from '@/stores/eventBus';

// Effect imports
import * as E from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as O from 'effect/Option';
import { pipe } from 'effect/Function';

// Custom error types
import type { RequestRetrievalError } from '@/types/errors';

describe('RequestsStore with Functional Patterns', () => {
  let requestsStore: ReturnType<typeof RequestsStore>;

  beforeEach(() => {
    requestsStore = RequestsStore(mockRequestsService, createEventBus<AppEvents>());
  });

  describe('Request Creation', () => {
    it('should create a request', () => {
      const request: RequestInDHT = {
        title: 'Test Request',
        description: 'Test Description',
        skills: [],
        process_state: 'DRAFT' as RequestProcessState
      };

      // Use the Effect directly from the store
      const createRequestEffect = requestsStore.createRequest(request);

      const result = pipe(
        createRequestEffect,
        E.runSyncExit
      );

      Exit.match(result, {
        onFailure: (cause) => {
          console.error('Request creation failed:', cause);
          throw new Error('Failed to create request');
        },
        onSuccess: (record) => {
          expect(record).toBeDefined();
          expect(record.signed_action.hashed.content.type).toBe('Create');
        }
      });
    });
  });

  describe('Request Retrieval', () => {
    it('should retrieve all requests', () => {
      // Use the Effect directly from the store
      const getAllRequestsEffect = requestsStore.getAllRequestsSync();

      const result = pipe(
        getAllRequestsEffect,
        E.runSyncExit
      );

      Exit.match(result, {
        onFailure: (cause) => {
          console.error('Request retrieval failed:', cause);
          throw new Error('Failed to retrieve requests');
        },
        onSuccess: (requests) => {
          expect(requests).toBeDefined();
          expect(Array.isArray(requests)).toBe(true);
          expect(requests.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle retrieval errors', () => {
      // Simulate a failing request retrieval
      const mockFailingService: RequestsService = {
        ...mockRequestsService,
        getAllRequestsRecords: () =>
          E.fail({
            type: 'RequestRetrievalError' as const,
            message: 'Simulated retrieval failure',
            details: new Error('Simulated error'),
            _tag: 'RequestRetrievalError',
            name: 'RequestRetrievalError'
          })
      };

      const failingRequestsStore = RequestsStore(mockFailingService, createEventBus<AppEvents>());

      // Use the Effect directly from the store
      const retrieveRequestsEffect = failingRequestsStore.getAllRequestsSync();

      // Run the effect and check the result
      const exit = pipe(retrieveRequestsEffect, E.runSyncExit);

      // Verify it failed with the expected error
      expect(Exit.isFailure(exit)).toBe(true);

      if (Exit.isFailure(exit)) {
        // The cause contains our error information
        const error = exit.cause as unknown as RequestRetrievalError;
        
        expect(error).toBeDefined();
        expect(error.type).toBe('RequestRetrievalError');
        expect(error.message).toContain('Simulated retrieval failure');
      }
    });
  });

  describe('Request Status Update', () => {
    it('should update a request status', () => {
      const requestHash = 'test-hash' as unknown as ActionHash;
      const previousActionHash = 'previous-hash' as unknown as ActionHash;
      const newState = 'ACCEPTED' as RequestProcessState;

      const updateStatusEffect = requestsStore.updateRequestStatus(
        requestHash,
        previousActionHash,
        newState
      );

      const result = pipe(
        updateStatusEffect,
        E.runSyncExit
      );

      Exit.match(result, {
        onFailure: (cause) => {
          console.error('Request status update failed:', cause);
          throw new Error('Failed to update request status');
        },
        onSuccess: (record) => {
          expect(record).toBeDefined();
          expect(record.signed_action.hashed.content.type).toBe('Update');
        }
      });
    });
  });

  describe('Request Deletion', () => {
    it('should delete a request', () => {
      const requestHash = 'test-hash' as unknown as ActionHash;

      const deleteEffect = requestsStore.deleteRequest(requestHash);

      const result = pipe(
        deleteEffect,
        E.runSyncExit
      );

      Exit.match(result, {
        onFailure: (cause) => {
          console.error('Request deletion failed:', cause);
          throw new Error('Failed to delete request');
        },
        onSuccess: () => {
          expect(true).toBe(true); // Deletion successful
        }
      });
    });
  });
});
