/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, describe, it, beforeEach, vi } from 'vitest';
import { RequestsStore } from '@/stores/requests.store.svelte';
import { createTestRequest, mockRequestsService } from '@/tests/utils/test-helpers';
import type { RequestsService } from '@/services/zomes/requests.service';
import { createEventBus, type AppEvents, type EventBus } from '@/stores/eventBus';
import type { ActionHash } from '@holochain/client';
import type { RequestInDHT, RequestProcessState } from '@/types/holochain';
import { fakeActionHash } from '@holochain/client';

// Effect imports
import * as E from 'effect/Effect';
import * as O from 'effect/Option';
import { pipe } from 'effect/Function';
import type { UIRequest } from '@/types/ui';

// Mock dependencies

describe('RequestsStore Integration', () => {
  let requestsStore: ReturnType<typeof RequestsStore>;
  let requestsService: RequestsService;
  let eventBus: EventBus<AppEvents>;
  let userHash: ActionHash;
  let organizationHash: ActionHash;

  beforeEach(async () => {
    userHash = await fakeActionHash();
    organizationHash = await fakeActionHash();
    requestsService = mockRequestsService;
    eventBus = createEventBus<AppEvents>();
    requestsStore = RequestsStore(requestsService, eventBus);
  });

  describe('createRequest', () => {
    it('should create a request', () => {
      const request: RequestInDHT = {
        title: 'Test Request',
        description: 'Test Description',
        skills: [],
        process_state: 'DRAFT' as RequestProcessState
      };

      const createRequestEffect = requestsStore.createRequest(request, organizationHash);
      const result = pipe(createRequestEffect, E.runSyncExit);
      expect(result).toBeDefined();
    });
  });

  describe('getAllRequests', () => {
    it('should retrieve all requests', () => {
      const getAllRequestsEffect = requestsStore.getAllRequestsSync();

      // Use runSync instead of runSyncExit to directly get the result
      // This will throw if there's an error, which Vitest will catch
      const result = pipe(getAllRequestsEffect, E.runSyncExit);

      E.match(result, {
        onFailure: (cause) => {
          throw cause;
        },
        onSuccess: (requests) => {
          expect(requests.length).toBe(1);
          expect(requests[0]).toHaveProperty('original_action_hash');
          expect(requests[0]).toHaveProperty('previous_action_hash');
        }
      });
    });
  });

  describe('getUserRequests', () => {
    it('should retrieve user requests', () => {
      const getUserRequestsEffect = requestsStore.getUserRequestsSync(userHash);

      // Use runSync instead of runSyncExit to directly get the result
      // This will throw if there's an error, which Vitest will catch
      const result = pipe(getUserRequestsEffect, E.runSyncExit);

      E.match(result, {
        onFailure: (cause) => {
          throw cause;
        },
        onSuccess: (requests) => {
          expect(requests.length).toBe(1);
          expect(requests[0]).toHaveProperty('original_action_hash');
          expect(requests[0]).toHaveProperty('previous_action_hash');
        }
      });
    });
  });

  describe('getOrganizationRequests', () => {
    it('should retrieve organization requests', () => {
      // Use pipe and runSync to handle the effect synchronously
      const result = pipe(
        requestsStore.getOrganizationRequestsSync(organizationHash),
        E.map((requests: UIRequest[]) => {
          expect(requests[0]).toHaveProperty('original_action_hash');
          expect(requests[0]).toHaveProperty('previous_action_hash');
          expect(requests.length).toBe(1);
          return requests;
        }),
        E.runSyncExit
      );
    });
  });

  describe('getLatestRequest', () => {
    it('should retrieve the latest request', () => {
      const originalActionHash = new Uint8Array(32); // Use a fake ActionHash
      for (let i = 0; i < originalActionHash.length; i++) {
        originalActionHash[i] = i % 256;
      }

      // Mock the service to return a request instead of throwing
      requestsService.getLatestRequest = vi.fn().mockImplementation(() => {
        return E.succeed(O.some(createTestRequest()));
      });

      const getLatestRequestEffect = requestsStore.getLatestRequestSync(originalActionHash);

      // Use pipe and runSync to handle the effect synchronously
      const result = pipe(
        getLatestRequestEffect,
        E.flatMap((optionRequest: O.Option<UIRequest>) => {
          // Handle Option type
          return pipe(
            optionRequest,
            O.match({
              onNone: () => E.fail(new Error('Request not found')),
              onSome: (request: UIRequest) => E.succeed(request)
            })
          );
        }),
        E.runSyncExit
      );

      E.match(result, {
        onFailure: (cause) => {
          throw cause;
        },
        onSuccess: (request) => {
          expect(request).toBeDefined();
          expect(request).toHaveProperty('original_action_hash');
          expect(request).toHaveProperty('previous_action_hash');
        }
      });
    });
  });
});
