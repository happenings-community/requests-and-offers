import { ActionType, type ActionHash, type Record } from '@holochain/client';
import { fakeActionHash, fakeAgentPubKey, fakeEntryHash } from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import { RequestProcessState } from '@/types/holochain';
import type { RequestInDHT } from '@/types/holochain';
import { Buffer } from 'buffer';

/**
 * Helper function to create a test request
 * @returns A test request
 */
export function createTestRequest(): RequestInDHT {
  return {
    title: 'Test Request',
    description: 'Test Description',
    process_state: RequestProcessState.Proposed,
    skills: ['Test Skill 1', 'Test Skill 2']
  };
}

/**
 * Helper function to create a mock record
 * @returns A mock Record
 */
export async function createMockRecord(): Promise<Record> {
  const request = createTestRequest();

  return {
    signed_action: {
      hashed: {
        content: {
          type: ActionType.Create,
          author: await fakeAgentPubKey(),
          timestamp: 0,
          action_seq: 0,
          prev_action: await fakeActionHash(),
          entry_type: {
            App: {
              entry_index: 0,
              zome_index: 0,
              visibility: 'Public'
            }
          },
          entry_hash: await fakeEntryHash()
        },
        hash: await fakeActionHash()
      },
      signature: await fakeEntryHash()
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
export function actionHashToString(actionHash: ActionHash): string {
  return Buffer.from(actionHash).toString('hex');
}

/**
 * Helper function to compare action hashes
 * @param hash1 The first action hash
 * @param hash2 The second action hash
 * @returns Whether the action hashes are equal
 */
export function compareActionHashes(hash1: ActionHash, hash2: ActionHash): boolean {
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
 * Mock implementation of decodeRecords for testing
 * @param records The records to decode
 * @returns An array of decoded records
 */
export function mockDecodeRecords<T>(records: Record[]): T[] {
  // Return a test request for each record
  return records.map(() => createTestRequest() as unknown as T);
}
