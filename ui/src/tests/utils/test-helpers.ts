import { ActionType, type ActionHash, type Record } from '@holochain/client';
import { fakeActionHash, fakeAgentPubKey, fakeEntryHash } from '@holochain/client';
import { encode } from '@msgpack/msgpack';

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

/**
 * Helper function to create a test request
 * @returns A test request
 */
export function createTestRequest(): RequestInDHT {
  return {
    title: 'Test Request',
    description: 'A sample request for testing',
    skills: ['programming', 'testing'],
    process_state: RequestProcessState.Proposed
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

  // Create placeholder values
  const placeholderBytes = new Uint8Array(32);
  for (let i = 0; i < placeholderBytes.length; i++) {
    placeholderBytes[i] = i % 256;
  }

  return {
    signed_action: {
      hashed: {
        content: {
          type: ActionType.Create,
          author: placeholderBytes.slice(),
          timestamp: 0,
          action_seq: 0,
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
        entry: encode(request)
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
  // Return the decoded records directly
  return records as unknown as T[];
}

/**
 * Decode records into a specific type wrapped in an Effect
 * @param records Array of records to decode
 * @returns Effect with decoded records of type T
 */
export function decodeRecordsEffect<T>(records: Record[]): E.Effect<T[], never, never> {
  // Return an Effect.succeed with the decoded records
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
