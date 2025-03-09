/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ActionType, type ActionHash, type Record, type RecordEntry } from '@holochain/client';
import { fakeActionHash, fakeAgentPubKey, fakeEntryHash } from '@holochain/client';
import { encode, decode } from '@msgpack/msgpack';

import { RequestProcessState } from '@/types/holochain';
import type { RequestInDHT } from '@/types/holochain';
import { Buffer } from 'buffer';

import * as E from 'effect/Effect';
import type {
  RequestCreationError,
  RequestRetrievalError,
  RequestUpdateError,
  RequestDeletionError
} from '@/types/errors';
import type { RequestsService } from '@/services/zomes/requests.service';
import * as O from 'effect/Option';

/**
 * Helper function to create a test request
 * @returns A test request
 */
export function createTestRequest(): RequestInDHT {
  return {
    title: 'Test Request',
    description: 'Test Description',
    skills: [],
    process_state: 'DRAFT' as RequestProcessState
  };
}

/**
 * Helper function to create a mock record
 * @returns An Effect with a Record object for testing
 */
export function createMockRecord(): E.Effect<Record, never, never> {
  const request = createTestRequest();

  return E.gen(function* () {
    const author = yield* E.promise(() => fakeAgentPubKey());
    const prevAction = yield* E.promise(() => fakeActionHash());
    const entryHash = yield* E.promise(() => fakeEntryHash());
    const hash = yield* E.promise(() => fakeActionHash());
    const signature = yield* E.promise(() => fakeEntryHash());

    return {
      signed_action: {
        hashed: {
          content: {
            type: ActionType.Create,
            author,
            timestamp: 0,
            action_seq: 0,
            prev_action: prevAction,
            entry_type: {
              App: {
                entry_index: 0,
                zome_index: 0,
                visibility: 'Public'
              }
            },
            entry_hash: entryHash
          },
          hash
        },
        signature
      },
      entry: {
        Present: {
          entry_type: 'App',
          entry: encode(request)
        }
      }
    };
  });
}

/**
 * Helper function to create a mock record synchronously
 * @returns A Record object for testing with placeholder values
 */
export function createMockRecordSync(): Record {
  const request = createTestRequest();

  // Create comprehensive placeholder values
  const placeholderBytes = new Uint8Array(32);
  for (let i = 0; i < placeholderBytes.length; i++) {
    placeholderBytes[i] = i % 256;
  }

  // Create a fully formed record that matches the expected structure
  return {
    signed_action: {
      hashed: {
        content: {
          type: ActionType.Create,
          author: placeholderBytes.slice(),
          timestamp: Date.now(),
          action_seq: 1,
          prev_action: placeholderBytes.slice(),
          entry_type: {
            App: {
              entry_index: 0,
              zome_index: 0,
              visibility: 'Public'
            }
          },
          entry_hash: placeholderBytes.slice()
        },
        hash: placeholderBytes.slice()
      },
      signature: placeholderBytes.slice()
    },
    entry: {
      Present: {
        entry_type: 'App',
        entry: encode({
          ...request,
          original_action_hash: placeholderBytes.slice(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          process_state: 'DRAFT' as RequestProcessState
        })
      }
    }
  };
}

/**
 * Helper function to convert an action hash to a string
 * @param actionHash The action hash to convert
 * @returns The string representation of the action hash
 */
export function actionHashToStringSync(actionHash: ActionHash): string {
  return Buffer.from(actionHash).toString('hex');
}

/**
 * Helper function to convert an action hash to a string
 * @param actionHash The action hash to convert
 * @returns Effect with the string representation of the action hash
 */
export function actionHashToString(actionHash: ActionHash): E.Effect<string, never, never> {
  return E.succeed(actionHashToStringSync(actionHash));
}

/**
 * Helper function to compare action hashes
 * @param hash1 The first action hash
 * @param hash2 The second action hash
 * @returns Whether the action hashes are equal
 */
export function compareActionHashesSync(hash1: ActionHash, hash2: ActionHash): boolean {
  if (hash1.length !== hash2.length) {
    return false;
  }

  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Helper function to compare action hashes
 * @param hash1 The first action hash
 * @param hash2 The second action hash
 * @returns Effect with whether the action hashes are equal
 */
export function compareActionHashes(
  hash1: ActionHash,
  hash2: ActionHash
): E.Effect<boolean, never, never> {
  return E.succeed(compareActionHashesSync(hash1, hash2));
}

/**
 * Decode records into a specific type
 * @param records Array of records to decode
 * @returns Array of decoded records of type T
 */
export function decodeRecords<T>(records: Record[]): T[] {
  return records.map((record) => {
    if ('Present' in record.entry && record.entry.Present) {
      return decode((record.entry as any).Present.entry) as T;
    }
    throw new Error('Invalid record entry');
  });
}

/**
 * Decode records into a specific type wrapped in an Effect
 * @param records Array of records to decode
 * @returns Effect with decoded records of type T
 */
export function decodeRecordsEffect<T>(records: Record[]): E.Effect<T[], never, never> {
  return E.succeed(decodeRecords<T>(records));
}

/**
 * Mock implementation of decodeRecords for testing
 * @param records The records to decode
 * @returns Array of decoded records
 */
export function mockDecodeRecords<T>(records: Record[]): T[] {
  // Return test requests for each record
  return records.map(() => createTestRequest() as unknown as T);
}

/**
 * Mock implementation of decodeRecords for testing wrapped in an Effect
 * @param records The records to decode
 * @returns Effect with an array of decoded records
 */
export function mockDecodeRecordsEffect<T>(records: Record[]): E.Effect<T[], never, never> {
  // Return an Effect.succeed with test requests for each record
  return E.succeed(mockDecodeRecords<T>(records));
}

/**
 * Create a standardized request creation error object
 * @param message Error message
 * @param details Additional error details
 * @returns A properly formatted request creation error
 */
export function createRequestCreationError(
  message: string,
  details: unknown = {}
): RequestCreationError {
  return {
    type: 'RequestCreationError' as const,
    message,
    details,
    _tag: 'RequestCreationError',
    name: 'RequestCreationError'
  };
}

/**
 * Create a standardized request retrieval error object
 * @param message Error message
 * @param details Additional error details
 * @returns A properly formatted request retrieval error
 */
export function createRequestRetrievalError(
  message: string,
  details: unknown = {}
): RequestRetrievalError {
  return {
    type: 'RequestRetrievalError' as const,
    message,
    details,
    _tag: 'RequestRetrievalError',
    name: 'RequestRetrievalError'
  };
}

/**
 * Create a standardized request update error object
 * @param message Error message
 * @param details Additional error details
 * @returns A properly formatted request update error
 */
export function createRequestUpdateError(
  message: string,
  details: unknown = {}
): RequestUpdateError {
  return {
    type: 'RequestUpdateError' as const,
    message,
    details,
    _tag: 'RequestUpdateError',
    name: 'RequestUpdateError'
  };
}

/**
 * Create a standardized request deletion error object
 * @param message Error message
 * @param details Additional error details
 * @returns A properly formatted request deletion error
 */
export function createRequestDeletionError(
  message: string,
  details: unknown = {}
): RequestDeletionError {
  return {
    type: 'RequestDeletionError' as const,
    message,
    details,
    _tag: 'RequestDeletionError',
    name: 'RequestDeletionError'
  };
}

export const mockRequestsService: RequestsService = {
  createRequest: (request: RequestInDHT, organizationHash?: Uint8Array) =>
    E.gen(function* () {
      if (!request) {
        return yield* E.fail(createRequestCreationError('Request is required'));
      }

      const mockRecord = createMockRecordSync();
      mockRecord.signed_action.hashed.content.type = ActionType.Create;
      mockRecord.entry = {
        Present: {
          entry_type: 'App',
          entry: encode({
            ...request,
            original_action_hash: mockRecord.signed_action.hashed.hash,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            process_state: request.process_state || 'DRAFT'
          })
        }
      };
      return yield* E.succeed(mockRecord);
    }),

  getAllRequestsRecords: () =>
    E.gen(function* () {
      try {
        const records = [createMockRecordSync()];
        records[0].signed_action.hashed.content.type = ActionType.Create;
        records[0].entry = {
          Present: {
            entry_type: 'App',
            entry: encode(createTestRequest())
          }
        };
        return yield* E.succeed(records);
      } catch (error) {
        return yield* E.fail(createRequestRetrievalError('Failed to retrieve requests'));
      }
    }),

  getUserRequestsRecords: (userHash: Uint8Array) =>
    E.gen(function* () {
      if (!userHash) {
        return yield* E.fail(createRequestRetrievalError('User hash is required'));
      }

      try {
        const records = [createMockRecordSync()];
        records[0].signed_action.hashed.content.type = ActionType.Create;
        records[0].entry = {
          Present: {
            entry_type: 'App',
            entry: encode(createTestRequest())
          }
        };
        return yield* E.succeed(records);
      } catch (error) {
        return yield* E.fail(createRequestRetrievalError('Failed to retrieve user requests'));
      }
    }),

  getOrganizationRequestsRecords: (organizationHash: Uint8Array) =>
    E.gen(function* () {
      if (!organizationHash) {
        return yield* E.fail(createRequestRetrievalError('Organization hash is required'));
      }

      try {
        const records = [createMockRecordSync()];
        records[0].signed_action.hashed.content.type = ActionType.Create;
        records[0].entry = {
          Present: {
            entry_type: 'App',
            entry: encode(createTestRequest())
          }
        };
        return yield* E.succeed(records);
      } catch (error) {
        return yield* E.fail(
          createRequestRetrievalError('Failed to retrieve organization requests')
        );
      }
    }),

  getLatestRequestRecord: (originalActionHash: Uint8Array) =>
    E.gen(function* () {
      if (!originalActionHash) {
        return yield* E.fail(createRequestRetrievalError('Original action hash is required'));
      }

      try {
        const record = createMockRecordSync();
        record.signed_action.hashed.content.type = ActionType.Create;
        record.entry = {
          Present: {
            entry_type: 'App',
            entry: encode(createTestRequest())
          }
        };
        return yield* E.succeed(O.some(record));
      } catch (error) {
        return yield* E.fail(
          createRequestRetrievalError('Failed to retrieve latest request record')
        );
      }
    }),

  getLatestRequest: (originalActionHash: Uint8Array) =>
    E.gen(function* () {
      if (!originalActionHash) {
        return yield* E.fail(createRequestRetrievalError('Original action hash is required'));
      }

      try {
        return yield* E.succeed(O.some(createTestRequest()));
      } catch (error) {
        return yield* E.fail(createRequestRetrievalError('Failed to retrieve latest request'));
      }
    }),

  updateRequest: (
    originalActionHash: Uint8Array,
    previousActionHash: Uint8Array,
    updatedRequest: RequestInDHT
  ): E.Effect<Record, RequestCreationError, never> =>
    E.gen(function* () {
      if (!originalActionHash || !previousActionHash || !updatedRequest) {
        return yield* E.fail(createRequestCreationError(
          'Original action hash, previous action hash, and updated request are required'
        ));
      }

      try {
        const mockRecord = createMockRecordSync();
        mockRecord.signed_action.hashed.content.type = ActionType.Update;
        mockRecord.entry = {
          Present: {
            entry_type: 'App',
            entry: encode({
              ...updatedRequest,
              original_action_hash: originalActionHash,
              previous_action_hash: previousActionHash,
              updated_at: new Date().toISOString()
            })
          }
        };
        return yield* E.succeed(mockRecord);
      } catch (error) {
        return yield* E.fail(createRequestCreationError('Failed to update request'));
      }
    }),

  deleteRequest: (requestHash: Uint8Array) =>
    E.gen(function* () {
      if (!requestHash) {
        return yield* E.fail(createRequestDeletionError('Request hash is required'));
      }

      try {
        yield* E.succeed(undefined);
        return undefined;
      } catch (error) {
        return yield* E.fail(createRequestDeletionError('Failed to delete request'));
      }
    })
};
