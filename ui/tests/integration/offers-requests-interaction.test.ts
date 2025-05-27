import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect } from 'effect';
import { runEffect } from '$lib/utils/effect';
import { createOffersStore } from '$lib/stores/offers.store.svelte';
import { createRequestsStore } from '$lib/stores/requests.store.svelte';
import {
  createMockEventBusLayer,
  clearEmittedEvents,
  getEmittedEvents
} from '../mocks/eventBus.mock';
import { mockEffectFn, mockEffectFnWithParams } from '../unit/effect';
import { createTestOffer, createTestRequest, createMockRecord } from '../unit/test-helpers';
import type { OffersService } from '$lib/services/zomes/offers.service';
import type { RequestsService } from '$lib/services/zomes/requests.service';
import type { OfferError } from '$lib/services/zomes/offers.service';
import type { RequestError } from '$lib/services/zomes/requests.service';
import type { Record, ActionHash } from '@holochain/client';
import { StoreEventBusTag } from '$lib/stores/storeEvents';
import type { OfferInDHT, RequestInDHT } from '$lib/types/holochain';

// Mock the Holochain client service
vi.mock('$lib/services/HolochainClientService.svelte', () => ({
  default: {
    client: {
      callZone: vi.fn(() => Promise.resolve({ Ok: {} }))
    }
  }
}));

// Mock the UsersService
vi.mock('$lib/services/zomes/users.service', () => ({
  UsersService: {
    getAgentUser: vi.fn(() =>
      Effect.succeed({
        original_action_hash: new Uint8Array([1, 2, 3]),
        agent_pub_key: new Uint8Array([4, 5, 6]),
        resource: { name: 'Test User' }
      })
    )
  }
}));

// Mock the organizationsStore
vi.mock('$lib/stores/organizations.store.svelte', () => ({
  default: {
    getAcceptedOrganizations: vi.fn(() => Promise.resolve([])),
    organizations: []
  }
}));

// Mock the usersStore
vi.mock('$lib/stores/users.store.svelte', () => ({
  default: {
    getUserByAgentPubKey: vi.fn(() =>
      Promise.resolve({
        original_action_hash: new Uint8Array([1, 2, 3]),
        agent_pub_key: new Uint8Array([4, 5, 6]),
        resource: { name: 'Test User' }
      })
    ),
    currentUser: {
      original_action_hash: new Uint8Array([1, 2, 3]),
      agent_pub_key: new Uint8Array([4, 5, 6]),
      resource: { name: 'Test User' }
    }
  }
}));

describe('Offers-Requests Store Interaction', () => {
  let mockOffersService: OffersService;
  let mockRequestsService: RequestsService;
  let mockOfferRecord: Record;
  let mockRequestRecord: Record;
  let mockOfferHash: ActionHash;
  let mockRequestHash: ActionHash;
  let testOffer: OfferInDHT;
  let testRequest: RequestInDHT;
  let mockEventBusLayer: ReturnType<typeof createMockEventBusLayer>;

  beforeEach(async () => {
    // Create the event bus layer first
    mockEventBusLayer = createMockEventBusLayer();

    // Clear any previous events
    clearEmittedEvents();

    // Create test data for offers
    mockOfferRecord = await createMockRecord(createTestOffer());
    mockOfferHash = mockOfferRecord.signed_action.hashed.hash;
    testOffer = createTestOffer();

    // Create test data for requests
    mockRequestRecord = await createMockRecord(createTestRequest());
    mockRequestHash = mockRequestRecord.signed_action.hashed.hash;
    testRequest = createTestRequest();

    // Create mock offers service
    const createOfferFn = vi.fn(() => Promise.resolve(mockOfferRecord));
    const getAllOffersRecordsFn = vi.fn(() => Promise.resolve([mockOfferRecord]));
    const getUserOffersRecordsFn = vi.fn(() => Promise.resolve([mockOfferRecord]));
    const getOrganizationOffersRecordsFn = vi.fn(() => Promise.resolve([mockOfferRecord]));
    const getLatestOfferRecordFn = vi.fn(() => Promise.resolve(mockOfferRecord));
    const getLatestOfferFn = vi.fn(() => Promise.resolve(testOffer));
    const updateOfferFn = vi.fn(() => Promise.resolve(mockOfferRecord));
    const deleteOfferFn = vi.fn(() => Promise.resolve(true));
    const getOfferCreatorFn = vi.fn(() => Promise.resolve(mockOfferHash));
    const getOfferOrganizationFn = vi.fn(() => Promise.resolve(mockOfferHash));

    mockOffersService = {
      createOffer: mockEffectFnWithParams(createOfferFn),
      getAllOffersRecords: mockEffectFn<Record[], OfferError>(
        getAllOffersRecordsFn
      ) as unknown as () => Effect.Effect<Record[], OfferError>,
      getUserOffersRecords: mockEffectFnWithParams(getUserOffersRecordsFn),
      getOrganizationOffersRecords: mockEffectFnWithParams(getOrganizationOffersRecordsFn),
      getLatestOfferRecord: mockEffectFnWithParams(getLatestOfferRecordFn),
      getLatestOffer: mockEffectFnWithParams(getLatestOfferFn),
      updateOffer: mockEffectFnWithParams(updateOfferFn),
      deleteOffer: mockEffectFnWithParams(deleteOfferFn),
      getOfferCreator: mockEffectFnWithParams(getOfferCreatorFn),
      getOfferOrganization: mockEffectFnWithParams(getOfferOrganizationFn)
    } as unknown as OffersService;

    // Create mock requests service
    const createRequestFn = vi.fn(() => Promise.resolve(mockRequestRecord));
    const getAllRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRequestRecord]));
    const getUserRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRequestRecord]));
    const getOrganizationRequestsRecordsFn = vi.fn(() => Promise.resolve([mockRequestRecord]));
    const getLatestRequestRecordFn = vi.fn(() => Promise.resolve(mockRequestRecord));
    const getLatestRequestFn = vi.fn(() => Promise.resolve(testRequest));
    const updateRequestFn = vi.fn(() => Promise.resolve(mockRequestRecord));
    const deleteRequestFn = vi.fn(() => Promise.resolve(true));

    mockRequestsService = {
      createRequest: mockEffectFnWithParams(createRequestFn),
      getAllRequestsRecords: mockEffectFn<Record[], RequestError>(
        getAllRequestsRecordsFn
      ) as unknown as () => Effect.Effect<Record[], RequestError>,
      getUserRequestsRecords: mockEffectFnWithParams(getUserRequestsRecordsFn),
      getOrganizationRequestsRecords: mockEffectFnWithParams(getOrganizationRequestsRecordsFn),
      getLatestRequestRecord: mockEffectFnWithParams(getLatestRequestRecordFn),
      getLatestRequest: mockEffectFnWithParams(getLatestRequestFn),
      updateRequest: mockEffectFnWithParams(updateRequestFn),
      deleteRequest: mockEffectFnWithParams(deleteRequestFn)
    } as unknown as RequestsService;

    // Event bus layer already created above
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should propagate offer creation events to other components', async () => {
    // Create the stores with our mock services
    const offersStore = createOffersStore(mockOffersService);
    createRequestsStore(mockRequestsService);

    // Setup a spy to track if the requestsStore reacts to offer events
    const requestsStoreSpy = vi.fn();

    // Create a test effect that sets up event listeners and then creates an offer
    const testEffect = Effect.gen(function* ($) {
      const eventBus = yield* $(StoreEventBusTag);

      // Set up a listener that simulates another component reacting to offer events
      yield* $(
        eventBus.on('offer:created', (payload) => {
          requestsStoreSpy(payload);
          return Effect.void;
        })
      );

      // Create an offer which should emit an event
      yield* $(offersStore.createOffer(testOffer));

      return {
        offers: offersStore.offers,
        events: getEmittedEvents()
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const result = await runEffect(providedEffect);

    // Verify offer was created
    expect(result.offers.length).toBe(1);

    // Verify event was emitted
    expect(result.events.length).toBe(1);
    expect(result.events[0].event).toBe('offer:created');

    // Verify the listener was called with the correct payload
    expect(requestsStoreSpy).toHaveBeenCalledTimes(1);
    expect(requestsStoreSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        offer: expect.objectContaining({
          original_action_hash: mockOfferRecord.signed_action.hashed.hash
        })
      })
    );
  });

  it('should allow cross-store communication for coordinated updates', async () => {
    // Create the stores with our mock services
    const offersStore = createOffersStore(mockOffersService);
    const requestsStore = createRequestsStore(mockRequestsService);

    // Create a test effect that coordinates updates between stores
    const testEffect = Effect.gen(function* ($) {
      const eventBus = yield* $(StoreEventBusTag);

      // Set up a listener that updates requests when offers are created
      // This simulates a component that needs to coordinate between stores
      yield* $(
        eventBus.on('offer:created', (offerPayload) => {
          // When an offer is created, create a corresponding request
          const newRequest = {
            ...testRequest,
            title: `Request for ${offerPayload.offer.title}`,
            requirements: offerPayload.offer.capabilities || []
          };

          // Add the request directly to the cache to simulate the creation
          // (since we can't call createRequest here without proper Effect context)
          requestsStore.cache.set({
            ...newRequest,
            original_action_hash: mockRequestHash,
            previous_action_hash: mockRequestHash,
            created_at: Date.now(),
            updated_at: Date.now()
          });

          return Effect.void;
        })
      );

      // Create an offer which should trigger the creation of a request
      yield* $(offersStore.createOffer(testOffer));

      // Wait a bit for all effects to complete
      yield* $(Effect.sleep(10));

      return {
        offers: offersStore.offers,
        requests: requestsStore.requests,
        events: getEmittedEvents()
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const result = await runEffect(providedEffect);

    // Verify offer was created
    expect(result.offers.length).toBe(1);

    // Verify request was created in response to the offer creation
    expect(result.requests.length).toBe(1);

    // Verify events were emitted (only offer:created since we're simulating request creation)
    expect(result.events.length).toBe(1);
    expect(result.events[0].event).toBe('offer:created');
  });

  it('should handle cache invalidation across stores', async () => {
    // Create the stores with our mock services
    const offersStore = createOffersStore(mockOffersService);
    const requestsStore = createRequestsStore(mockRequestsService);

    // Create spies to track cache invalidation
    const requestsCacheSpy = vi.spyOn(requestsStore.cache, 'clear');

    // Create a test effect that tests cache invalidation coordination
    const testEffect = Effect.gen(function* ($) {
      const eventBus = yield* $(StoreEventBusTag);

      // Set up a listener that invalidates request cache when offer cache is invalidated
      yield* $(
        eventBus.on('offer:created', (payload) => {
          if (payload.offer.title === 'Test Offer') {
            requestsStore.invalidateCache();
          }
          return Effect.void;
        })
      );

      // Create an offer that will trigger the cache invalidation
      yield* $(offersStore.createOffer(testOffer));

      return {
        requestsCacheCleared: requestsCacheSpy.mock.calls.length
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const result = await runEffect(providedEffect);

    // Verify request cache was cleared when offer was created
    expect(result.requestsCacheCleared).toBe(1);
  });

  it('should handle errors in one store without affecting the other', async () => {
    // Create a service that fails
    const errorMessage = 'Failed to get all offers: Test error';
    const getAllOffersRecordsFn = vi.fn(() => Promise.reject(new Error('Test error')));
    mockOffersService.getAllOffersRecords = mockEffectFn<never, OfferError>(
      getAllOffersRecordsFn
    ) as unknown as () => Effect.Effect<Record[], OfferError>;

    // Create the stores with our mock services
    const offersStore = createOffersStore(mockOffersService);
    const requestsStore = createRequestsStore(mockRequestsService);

    // Create a test effect that tests error isolation
    const testEffect = Effect.gen(function* ($) {
      // Try to get all offers (which will fail) and catch the error
      const offersResult = yield* $(Effect.either(offersStore.getAllOffers()));

      // Now try to get all requests (which should succeed)
      yield* $(requestsStore.getAllRequests());

      return {
        offersError: offersResult._tag === 'Left' ? offersResult.left.message : null,
        requestsError: requestsStore.error,
        requests: requestsStore.requests
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const result = await runEffect(providedEffect);

    // Verify offers store has an error
    expect(result.offersError).toBe(errorMessage);

    // Verify requests store is not affected
    expect(result.requestsError).toBeNull();
    expect(result.requests.length).toBe(1);
  });

  it('should support complex workflows involving both stores', async () => {
    // Create the stores with our mock services
    const offersStore = createOffersStore(mockOffersService);
    const requestsStore = createRequestsStore(mockRequestsService);

    // Create a test effect that simulates a complex workflow
    const testEffect = Effect.gen(function* ($) {
      // Step 1: Create a request
      yield* $(requestsStore.createRequest(testRequest));

      // Step 2: Create an offer based on the request
      const offerFromRequest = {
        ...testOffer,
        title: `Offer for ${testRequest.title}`,
        capabilities: testRequest.requirements
      };

      yield* $(offersStore.createOffer(offerFromRequest));

      // Step 3: Update the request to mark it as having an offer
      const updatedRequest = {
        ...testRequest,
        title: `${testRequest.title} (Has Offer)`
      };

      yield* $(requestsStore.updateRequest(mockRequestHash, mockRequestHash, updatedRequest));

      // Step 4: Get all events that occurred during this workflow
      return {
        offers: offersStore.offers,
        requests: requestsStore.requests,
        events: getEmittedEvents()
      };
    });

    // Provide the event bus layer
    const providedEffect = Effect.provide(testEffect, mockEventBusLayer);

    // Run the effect
    const result = await runEffect(providedEffect);

    // Verify the workflow completed successfully
    expect(result.offers.length).toBe(1);
    expect(result.requests.length).toBe(1);

    // Verify all expected events were emitted
    expect(result.events.length).toBe(3);
    expect(result.events[0].event).toBe('request:created');
    expect(result.events[1].event).toBe('offer:created');
    expect(result.events[2].event).toBe('request:updated');
  });
});
