import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Effect as E } from 'effect';
import type { OrganizationInDHT } from '$lib/types/holochain';
import type { OrganizationsService } from '$lib/services/zomes/organizations.service';
import { OrganizationError } from '$lib/errors/organizations.errors';
import { testOrganizations } from '../fixtures/organizations';
import type { Record as HcRecord } from '@holochain/client';
import { CacheServiceLive } from '$lib/utils/cache.svelte';
import {
  HolochainClientServiceTag,
  type HolochainClientService
} from '$lib/services/HolochainClientService.svelte';
import { encode } from '@msgpack/msgpack';

// Mock the administration store module before importing the organizations store
vi.mock('$lib/stores/administration.store.svelte', () => ({
  default: {
    getLatestStatusForEntity: vi.fn().mockReturnValue(E.succeed({ status_type: 'accepted' }))
  }
}));

// Import after mock setup
import { createOrganizationsStore } from '$lib/stores/organizations.store.svelte';
import type { OrganizationsStore } from '$lib/stores/organizations.store.svelte';
import { OrganizationsServiceTag } from '$lib/services/zomes/organizations.service';

/**
 * Creates a properly msgpack-encoded mock Holochain record from an organization entry.
 * The store's createUIEntityFromRecord uses msgpack decode, so entries must be encoded.
 */
const createMockRecord = (
  org: OrganizationInDHT & { original_action_hash?: any },
  actionHash: any
): HcRecord => {
  // Only encode the DHT fields (not UI-only fields like original_action_hash, status, etc.)
  const dhtEntry: OrganizationInDHT = {
    name: org.name,
    description: org.description,
    full_legal_name: org.full_legal_name,
    email: org.email,
    urls: org.urls || [],
    location: org.location
  };

  return {
    signed_action: {
      hashed: {
        hash: actionHash,
        content: { timestamp: Date.now() * 1000 }
      }
    },
    entry: {
      Present: {
        entry: encode(dhtEntry)
      }
    }
  } as any;
};

// Mock the holochain client service
const createMockHolochainClientService = () =>
  ({
    appId: 'test-app',
    client: null,
    isConnected: true,
    isConnecting: false,
    connectClient: vi.fn(() => Promise.resolve()),
    waitForConnection: vi.fn(() => Promise.resolve()),
    getAppInfo: vi.fn(() => Promise.resolve({})),
    getPeerMetaInfo: vi.fn(() => Promise.resolve({})),
    callZome: vi.fn(),
    verifyConnection: vi.fn(() => Promise.resolve(true)),
    getNetworkSeed: vi.fn(() => Promise.resolve('test-seed')),
    getNetworkInfo: vi.fn(() => Promise.resolve({})),
    getNetworkPeers: vi.fn(() => Promise.resolve([]))
  }) as unknown as HolochainClientService;

// Mock the organization service
const mockOrganizationService: OrganizationsService = {
  getAllOrganizationsLinks: vi.fn(),
  getLatestOrganizationRecord: vi.fn(),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  deleteOrganization: vi.fn(),
  getOrganizationMembersLinks: vi.fn(),
  getOrganizationCoordinatorsLinks: vi.fn(),
  addOrganizationMember: vi.fn(),
  addOrganizationCoordinator: vi.fn(),
  removeOrganizationMember: vi.fn(),
  removeOrganizationCoordinator: vi.fn(),
  leaveOrganization: vi.fn(),
  getOrganizationStatusLink: vi.fn(),
  getAcceptedOrganizationsLinks: vi.fn(),
  getUserOrganizationsLinks: vi.fn(),
  isOrganizationCoordinator: vi.fn()
};

describe('OrganizationsStore', () => {
  let store: OrganizationsStore;

  // Helper function to create a store with mocked services
  const createStore = async (): Promise<OrganizationsStore> => {
    return await E.runPromise(
      createOrganizationsStore().pipe(
        E.provideService(OrganizationsServiceTag, mockOrganizationService),
        E.provide(CacheServiceLive),
        E.provideService(HolochainClientServiceTag, createMockHolochainClientService())
      )
    );
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Create store instance with mocked services
    store = await createStore();
  });

  describe('Initial State', () => {
    it('should initialize with empty acceptedOrganizations', () => {
      expect(store.acceptedOrganizations).toEqual([]);
    });

    it('should initialize with loading false', () => {
      expect(store.loading).toBe(false);
    });

    it('should initialize with no error', () => {
      expect(store.error).toBe(null);
    });
  });

  describe('getAcceptedOrganizations', () => {
    it('should fetch organizations successfully', async () => {
      const actionHash = testOrganizations.main.original_action_hash;
      const mockLinks = [{ target: actionHash }];

      const mockRecord = createMockRecord(testOrganizations.main, actionHash);

      vi.mocked(mockOrganizationService.getAcceptedOrganizationsLinks).mockReturnValue(
        E.succeed(mockLinks as any)
      );

      vi.mocked(mockOrganizationService.getLatestOrganizationRecord).mockReturnValue(
        E.succeed(mockRecord)
      );

      vi.mocked(mockOrganizationService.getOrganizationMembersLinks).mockReturnValue(E.succeed([]));

      vi.mocked(mockOrganizationService.getOrganizationCoordinatorsLinks).mockReturnValue(
        E.succeed([])
      );

      const result = await E.runPromise(store.getAcceptedOrganizations());

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: testOrganizations.main.name,
        description: testOrganizations.main.description,
        full_legal_name: testOrganizations.main.full_legal_name,
        email: testOrganizations.main.email
      });
    });

    it('should handle fetch errors gracefully', async () => {
      const error = new OrganizationError({
        message: 'Fetch failed',
        context: 'test error'
      });
      vi.mocked(mockOrganizationService.getAcceptedOrganizationsLinks).mockReturnValue(
        E.fail(error)
      );

      try {
        await E.runPromise(store.getAcceptedOrganizations());
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  describe('createOrganization', () => {
    it('should create organization with required full_legal_name field', async () => {
      const newOrg: OrganizationInDHT = {
        name: 'New Test Organization',
        description: 'A new test organization',
        full_legal_name: 'New Test Organization LLC', // Required field
        email: 'new@test.com',
        urls: ['https://new-test.com'],
        location: 'Test City'
      };

      const mockRecord: HcRecord = {
        signed_action: {
          hashed: { hash: new Uint8Array([1, 2, 3, 4]) }
        },
        entry: {
          Present: {
            entry: newOrg
          }
        }
      } as any;

      vi.mocked(mockOrganizationService.createOrganization).mockReturnValue(E.succeed(mockRecord));

      const result = await E.runPromise(store.createOrganization(newOrg));

      expect(mockOrganizationService.createOrganization).toHaveBeenCalledWith(newOrg);
      expect(result).toBe(mockRecord);
    });

});

  describe('updateOrganization', () => {
    it('should update organization with all fields including full_legal_name', async () => {
      const updatedOrg: OrganizationInDHT = {
        name: 'Updated Organization',
        description: 'Updated description',
        full_legal_name: 'Updated Organization Corp', // Updated legal name
        email: 'updated@test.com',
        urls: ['https://updated.com'],
        location: 'Updated City'
      };

      const actionHash = testOrganizations.main.original_action_hash;

      // Mock the initial record fetch (for getOrganizationByActionHash -> getLatestOrganization)
      const existingRecord = createMockRecord(testOrganizations.main, actionHash);

      vi.mocked(mockOrganizationService.getLatestOrganizationRecord).mockReturnValue(
        E.succeed(existingRecord)
      );

      vi.mocked(mockOrganizationService.getOrganizationMembersLinks).mockReturnValue(E.succeed([]));
      vi.mocked(mockOrganizationService.getOrganizationCoordinatorsLinks).mockReturnValue(
        E.succeed([])
      );

      vi.mocked(mockOrganizationService.updateOrganization).mockReturnValue(E.succeed(true));

      const result = await E.runPromise(store.updateOrganization(actionHash!, updatedOrg));

      // The store calls updateOrganization with { original_action_hash, previous_action_hash, updated_organization }
      expect(mockOrganizationService.updateOrganization).toHaveBeenCalled();

      // updateOrganization returns UIOrganization | null, and after the update it refreshes
      // from getLatestOrganization which returns the enhanced organization
      expect(result).not.toBeUndefined();
    });
  });

});
