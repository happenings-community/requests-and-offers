import type { AppWebsocket, AppInfo, CallZomeRequest } from '@holochain/client';
import { vi } from 'vitest';

/**
 * A simple mock implementation of the Holochain client for testing.
 * This mock focuses on the functionality needed by our tests without
 * complex Tryorama dependencies.
 */
export class HolochainClientMock implements Partial<AppWebsocket> {
  isConnected = true;

  // Mock functions that can be spied on in tests
  public callZome = vi.fn();
  public appInfo = vi.fn();

  constructor() {
    // Set up default mock implementations
    this.setupDefaults();
  }

  private setupDefaults() {
    // Default appInfo implementation
    this.appInfo.mockResolvedValue({
      installed_app_id: 'requests_and_offers',
      agent_pub_key: new Uint8Array(32), // Mock agent public key
      cell_info: {},
      status: { enabled: { } },
      installed_at: Date.now() * 1000 // Mock timestamp in microseconds
    } as unknown as AppInfo);

    // Default callZome implementation - returns empty object
    this.callZome.mockResolvedValue({});
  }

  /**
   * Reset all mocks to their default state
   */
  reset(): void {
    vi.clearAllMocks();
    this.setupDefaults();
  }

  /**
   * Configure the mock to return specific responses for zome calls
   */
  mockZomeCall(zomeName: string, fnName: string, response: unknown): void {
    this.callZome.mockImplementation((request: CallZomeRequest) => {
      if (request.zome_name === zomeName && request.fn_name === fnName) {
        return Promise.resolve(response);
      }
      return Promise.resolve({});
    });
  }

  /**
   * Configure the mock to reject with an error for specific zome calls
   */
  mockZomeCallError(zomeName: string, fnName: string, error: Error): void {
    this.callZome.mockImplementation((request: CallZomeRequest) => {
      if (request.zome_name === zomeName && request.fn_name === fnName) {
        return Promise.reject(error);
      }
      return Promise.resolve({});
    });
  }
}

/**
 * Helper factory function to create a HolochainClientMock
 */
export function createMockHolochainClient(): HolochainClientMock {
  return new HolochainClientMock();
}

/**
 * Helper to create a mock client with common test responses pre-configured
 */
export function createTestHolochainClient(): HolochainClientMock {
  const client = new HolochainClientMock();

  // Pre-configure common responses that tests expect
  client.mockZomeCall('service_types', 'get_all_service_types', {
    pending: [],
    approved: [],
    rejected: []
  });

  return client;
}
