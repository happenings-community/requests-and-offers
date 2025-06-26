import {
  fakeActionHash,
  fakeAgentPubKey,
  fakeEntryHash,
  ActionType,
  type ActionHash,
  type Record
} from '@holochain/client';
import { encode } from '@msgpack/msgpack';

import {
  type RequestInDHT,
  InteractionType,
  ExchangePreference,
  type RequestInput,
  type OfferInput
} from '$lib/types/holochain';
import { Buffer } from 'buffer';

/**
 * Helper function to create a test request
 * @param serviceTypeActionHash Optional service type action hash
 * @returns A test request
 */
export async function createTestRequest(serviceTypeActionHash?: ActionHash): Promise<RequestInput> {
  return {
    title: 'Test Request',
    description: 'Test Description',
    links: ['https://example.com/docs', 'https://example.com/requirements'],
    contact_preference: 'Email',
    time_preference: 'NoPreference',
    exchange_preference: ExchangePreference.Arranged,
    interaction_type: InteractionType.InPerson,
    service_type_hashes: [serviceTypeActionHash || (await fakeActionHash())]
  };
}

/**
 * Helper function to create a mock record
 * @param entryData Optional data to use for the entry. If not provided, creates a test request.
 * @returns A mock Record
 */
export async function createMockRecord<T = RequestInDHT>(entryData?: T): Promise<Record> {
  const entry = entryData || (await createTestRequest());

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
        entry: encode(entry)
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

/**
 * Creates a test offer for testing purposes
 * @param serviceTypeActionHash Optional service type action hash
 * @returns A test offer
 */
export async function createTestOffer(serviceTypeActionHash?: ActionHash): Promise<OfferInput> {
  return {
    title: 'Test Offer',
    description: 'Test offer description',
    links: ['https://example.com/docs', 'https://example.com/capabilities'],
    time_preference: 'NoPreference',
    time_zone: 'America/New_York',
    exchange_preference: ExchangePreference.Arranged,
    interaction_type: InteractionType.InPerson,
    service_type_hashes: [serviceTypeActionHash || (await fakeActionHash())]
  };
}

/**
 * Creates a test service type for testing purposes
 * @returns A test service type
 */
export function createTestServiceType(): import('$lib/types/holochain').ServiceTypeInDHT {
  return {
    name: 'Web Development',
    description: 'Frontend and backend web development services',
    tags: ['javascript', 'react', 'nodejs']
  };
}

/**
 * Helper function to create a mock service type record
 * @param serviceTypeData Optional service type data to use for the entry. If not provided, creates a test service type.
 * @returns A mock Record with service type data
 */
export async function createMockServiceTypeRecord(
  serviceTypeData?: import('$lib/types/holochain').ServiceTypeInDHT
): Promise<Record> {
  const serviceType = serviceTypeData || createTestServiceType();

  return {
    signed_action: {
      hashed: {
        content: {
          type: ActionType.Create,
          author: await fakeAgentPubKey(),
          timestamp: Date.now() * 1000, // Convert to microseconds
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
        entry: encode(serviceType)
      }
    }
  };
}

/**
 * Creates a mock ActionHash from a string
 */
export function createMockActionHash(str: string): ActionHash {
  return new Uint8Array(Buffer.from(str.padEnd(32, '0'), 'utf8').subarray(0, 32)) as ActionHash;
}

/**
 * Creates an ActionHash for testing purposes
 */
export async function createActionHash(): Promise<ActionHash> {
  return await fakeActionHash();
}
