import type { Record } from '@holochain/client';
import { createTestRequest } from '../unit/test-helpers';

/**
 * Mock implementation of decodeRecords for testing
 * @param records The records to decode
 * @returns An array of decoded records
 */
export async function decodeRecords<T>(records: Record[]): Promise<T[]> {
  // Create a unique test request for each record
  const results = await Promise.all(
    records.map(async () => {
      const testRequest = await createTestRequest();
      return testRequest as unknown as T;
    })
  );
  return results;
}
