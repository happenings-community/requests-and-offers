import type { Record } from '@holochain/client';
import { createTestRequest } from '../unit/test-helpers';

/**
 * Mock implementation of decodeRecords for testing
 * @param records The records to decode
 * @returns An array of decoded records
 */
export function decodeRecords<T>(records: Record[]): T[] {
  // Return a test request for each record
  return records.map(() => createTestRequest() as unknown as T);
}
