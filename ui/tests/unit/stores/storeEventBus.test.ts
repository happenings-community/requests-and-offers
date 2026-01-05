import { describe, expect, beforeEach, vi, it, afterEach } from 'vitest';
import type { MockedFunction } from 'vitest';
import { storeEventBus } from '$lib/stores/storeEvents';
import type { StoreEvents } from '$lib/stores/storeEvents';
import { fakeActionHash } from '@holochain/client';
import type { ActionHash } from '@holochain/client';
import type { UIServiceType, UIRequest, UIOffer, UIUser, UIOrganization } from '$lib/types/ui';
import { InteractionType, ListingStatus } from '$lib/types/holochain';

describe('StoreEventBus', () => {
  // Mock handlers for testing
  let serviceTypeCreatedHandler: MockedFunction<
    (payload: StoreEvents['serviceType:created']) => void
  >;
  let serviceTypeUpdatedHandler: MockedFunction<
    (payload: StoreEvents['serviceType:updated']) => void
  >;
  let requestCreatedHandler: MockedFunction<(payload: StoreEvents['request:created']) => void>;
  let offerCreatedHandler: MockedFunction<(payload: StoreEvents['offer:created']) => void>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let userCreatedHandler: MockedFunction<(payload: StoreEvents['user:created']) => void>;

  // Mock data for testing
  let mockServiceType: UIServiceType;
  let mockRequest: UIRequest;
  let mockOffer: UIOffer;
  let mockUser: UIUser;
  let mockOrganization: UIOrganization;
  let mockHash: ActionHash;

  beforeEach(async () => {
    // Clear all event handlers before each test
    storeEventBus.clearAll();

    // Reset all mocks
    serviceTypeCreatedHandler = vi.fn();
    serviceTypeUpdatedHandler = vi.fn();
    requestCreatedHandler = vi.fn();
    offerCreatedHandler = vi.fn();
    userCreatedHandler = vi.fn();

    // Create mock data
    mockHash = await fakeActionHash();

    mockServiceType = {
      name: 'Web Development',
      description: 'Full-stack web development services',
      technical: true,
      original_action_hash: mockHash,
      status: 'approved'
    };

    mockRequest = {
      title: 'Need React Developer',
      description: 'Looking for a skilled React developer',
      contact_preference: 'Email',
      date_range: {
        start: Date.now(),
        end: Date.now() + 86400000
      },
      time_estimate_hours: 2,
      time_preference: 'Morning',
      time_zone: 'UTC',
      interaction_type: InteractionType.Virtual,
      links: [],
      original_action_hash: mockHash,
      service_type_hashes: [mockHash],
      status: ListingStatus.Active
    };

    mockOffer = {
      title: 'React Development Services',
      description: 'Professional React development',
      time_preference: 'Evening',
      time_zone: 'UTC',
      interaction_type: InteractionType.Virtual,
      links: [],
      original_action_hash: mockHash,
      service_type_hashes: [mockHash],
      status: ListingStatus.Active
    };

    mockUser = {
      name: 'Test User',
      nickname: 'testuser',
      bio: 'Test user bio',
      email: 'test@example.com',
      user_type: 'creator',
      original_action_hash: mockHash
    };

    mockOrganization = {
      name: 'Test Organization',
      description: 'A test organization',
      full_legal_name: 'Test Organization Inc.',
      logo: new Uint8Array(),
      email: 'org@example.com',
      urls: [],
      location: 'virtual',
      original_action_hash: mockHash,
      members: [],
      coordinators: []
    };
  });

  afterEach(() => {
    // Clean up all handlers after each test
    storeEventBus.clearAll();
    vi.clearAllMocks();
  });

  describe('Event Subscription and Emission', () => {
    it('should register an event handler and emit events to it', () => {
      // Arrange
      const unsubscribe = storeEventBus.on('serviceType:created', serviceTypeCreatedHandler);

      // Act
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });

      // Assert
      expect(serviceTypeCreatedHandler).toHaveBeenCalledTimes(1);
      expect(serviceTypeCreatedHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });

      // Cleanup
      unsubscribe();
    });

    it('should register multiple handlers for the same event', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsubscribe1 = storeEventBus.on('serviceType:created', handler1);
      const unsubscribe2 = storeEventBus.on('serviceType:created', handler2);

      const payload = { serviceType: mockServiceType };

      // Act
      storeEventBus.emit('serviceType:created', payload);

      // Assert
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith(payload);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith(payload);

      // Cleanup
      unsubscribe1();
      unsubscribe2();
    });

    it('should not trigger handlers for different events', () => {
      // Arrange
      const unsubscribe1 = storeEventBus.on('serviceType:created', serviceTypeCreatedHandler);
      const unsubscribe2 = storeEventBus.on('request:created', requestCreatedHandler);

      // Act
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });

      // Assert
      expect(serviceTypeCreatedHandler).toHaveBeenCalledTimes(1);
      expect(requestCreatedHandler).not.toHaveBeenCalled();

      // Cleanup
      unsubscribe1();
      unsubscribe2();
    });

    it('should unregister a specific handler with off method', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      storeEventBus.on('serviceType:created', handler1);
      storeEventBus.on('serviceType:created', handler2);

      // Act - Remove only handler1
      storeEventBus.off('serviceType:created', handler1);
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });

      // Assert
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should unregister a handler using the returned unsubscribe function', () => {
      // Arrange
      const unsubscribe = storeEventBus.on('serviceType:created', serviceTypeCreatedHandler);

      // Act - Unsubscribe and then emit
      unsubscribe();
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });

      // Assert
      expect(serviceTypeCreatedHandler).not.toHaveBeenCalled();
    });
  });

  describe('Cross-Domain Event Types', () => {
    it('should handle service type events', () => {
      // Arrange
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();
      const suggestedHandler = vi.fn();
      const approvedHandler = vi.fn();
      const rejectedHandler = vi.fn();

      storeEventBus.on('serviceType:created', createdHandler);
      storeEventBus.on('serviceType:updated', updatedHandler);
      storeEventBus.on('serviceType:deleted', deletedHandler);
      storeEventBus.on('serviceType:suggested', suggestedHandler);
      storeEventBus.on('serviceType:approved', approvedHandler);
      storeEventBus.on('serviceType:rejected', rejectedHandler);

      // Act
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });
      storeEventBus.emit('serviceType:updated', { serviceType: mockServiceType });
      storeEventBus.emit('serviceType:deleted', { serviceTypeHash: mockHash });
      storeEventBus.emit('serviceType:suggested', { serviceType: mockServiceType });
      storeEventBus.emit('serviceType:approved', { serviceType: mockServiceType });
      storeEventBus.emit('serviceType:rejected', { serviceType: mockServiceType });

      // Assert
      expect(createdHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
      expect(updatedHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
      expect(deletedHandler).toHaveBeenCalledWith({ serviceTypeHash: mockHash });
      expect(suggestedHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
      expect(approvedHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
      expect(rejectedHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
    });

    it('should handle request events', () => {
      // Arrange
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();

      storeEventBus.on('request:created', createdHandler);
      storeEventBus.on('request:updated', updatedHandler);
      storeEventBus.on('request:deleted', deletedHandler);

      // Act
      storeEventBus.emit('request:created', { request: mockRequest });
      storeEventBus.emit('request:updated', { request: mockRequest });
      storeEventBus.emit('request:deleted', { requestHash: mockHash });

      // Assert
      expect(createdHandler).toHaveBeenCalledWith({ request: mockRequest });
      expect(updatedHandler).toHaveBeenCalledWith({ request: mockRequest });
      expect(deletedHandler).toHaveBeenCalledWith({ requestHash: mockHash });
    });

    it('should handle offer events', () => {
      // Arrange
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();

      storeEventBus.on('offer:created', createdHandler);
      storeEventBus.on('offer:updated', updatedHandler);
      storeEventBus.on('offer:deleted', deletedHandler);

      // Act
      storeEventBus.emit('offer:created', { offer: mockOffer });
      storeEventBus.emit('offer:updated', { offer: mockOffer });
      storeEventBus.emit('offer:deleted', { offerHash: mockHash });

      // Assert
      expect(createdHandler).toHaveBeenCalledWith({ offer: mockOffer });
      expect(updatedHandler).toHaveBeenCalledWith({ offer: mockOffer });
      expect(deletedHandler).toHaveBeenCalledWith({ offerHash: mockHash });
    });

    it('should handle user events', () => {
      // Arrange
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();

      storeEventBus.on('user:created', createdHandler);
      storeEventBus.on('user:updated', updatedHandler);
      storeEventBus.on('user:deleted', deletedHandler);

      // Act
      storeEventBus.emit('user:created', { user: mockUser });
      storeEventBus.emit('user:updated', { user: mockUser });
      storeEventBus.emit('user:deleted', { userHash: mockHash });

      // Assert
      expect(createdHandler).toHaveBeenCalledWith({ user: mockUser });
      expect(updatedHandler).toHaveBeenCalledWith({ user: mockUser });
      expect(deletedHandler).toHaveBeenCalledWith({ userHash: mockHash });
    });

    it('should handle organization events', () => {
      // Arrange
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();

      storeEventBus.on('organization:created', createdHandler);
      storeEventBus.on('organization:updated', updatedHandler);
      storeEventBus.on('organization:deleted', deletedHandler);

      // Act
      storeEventBus.emit('organization:created', { organization: mockOrganization });
      storeEventBus.emit('organization:updated', { organization: mockOrganization });
      storeEventBus.emit('organization:deleted', { organizationHash: mockHash });

      // Assert
      expect(createdHandler).toHaveBeenCalledWith({ organization: mockOrganization });
      expect(updatedHandler).toHaveBeenCalledWith({ organization: mockOrganization });
      expect(deletedHandler).toHaveBeenCalledWith({ organizationHash: mockHash });
    });
  });

  describe('Error Handling', () => {
    it('should continue emitting to other handlers if one handler throws', () => {
      // Arrange
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      storeEventBus.on('serviceType:created', errorHandler);
      storeEventBus.on('serviceType:created', normalHandler);

      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });

      // Assert
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(normalHandler).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in event handler for serviceType:created:',
        expect.any(Error)
      );

      // Cleanup
      consoleSpy.mockRestore();
    });

    it('should do nothing when emitting to an event with no handlers', () => {
      // Act & Assert - Should not throw
      expect(() => {
        storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });
      }).not.toThrow();
    });

    it('should do nothing when trying to unregister a non-existent handler', () => {
      // Act & Assert - Should not throw
      expect(() => {
        storeEventBus.off('serviceType:created', serviceTypeCreatedHandler);
      }).not.toThrow();
    });
  });

  describe('Event Bus Management', () => {
    it('should clear all handlers for a specific event', () => {
      // Arrange
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      storeEventBus.on('serviceType:created', handler1);
      storeEventBus.on('serviceType:created', handler2);
      storeEventBus.on('request:created', requestCreatedHandler);

      // Act
      storeEventBus.clear('serviceType:created');
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });
      storeEventBus.emit('request:created', { request: mockRequest });

      // Assert
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(requestCreatedHandler).toHaveBeenCalledTimes(1); // Other events should still work
    });

    it('should clear all handlers for all events', () => {
      // Arrange
      storeEventBus.on('serviceType:created', serviceTypeCreatedHandler);
      storeEventBus.on('request:created', requestCreatedHandler);
      storeEventBus.on('offer:created', offerCreatedHandler);

      // Act
      storeEventBus.clearAll();
      storeEventBus.emit('serviceType:created', { serviceType: mockServiceType });
      storeEventBus.emit('request:created', { request: mockRequest });
      storeEventBus.emit('offer:created', { offer: mockOffer });

      // Assert
      expect(serviceTypeCreatedHandler).not.toHaveBeenCalled();
      expect(requestCreatedHandler).not.toHaveBeenCalled();
      expect(offerCreatedHandler).not.toHaveBeenCalled();
    });

    it('should provide debug information about current subscriptions', () => {
      // Arrange
      storeEventBus.on('serviceType:created', serviceTypeCreatedHandler);
      storeEventBus.on('serviceType:created', serviceTypeUpdatedHandler);
      storeEventBus.on('request:created', requestCreatedHandler);

      // Act
      const debugInfo = storeEventBus.getDebugInfo();

      // Assert
      expect(debugInfo).toEqual({
        'serviceType:created': 2,
        'request:created': 1
      });
    });

    it('should return empty debug info when no handlers are registered', () => {
      // Act
      const debugInfo = storeEventBus.getDebugInfo();

      // Assert
      expect(debugInfo).toEqual({});
    });
  });

  describe('Real-world Usage Scenarios', () => {
    it('should simulate cross-store communication when service type is approved', () => {
      // Arrange - Simulate stores listening to service type approval
      const requestsStoreHandler = vi.fn(); // Requests store would refresh its service types
      const offersStoreHandler = vi.fn(); // Offers store would refresh its service types
      const uiNotificationHandler = vi.fn(); // UI would show notification

      storeEventBus.on('serviceType:approved', requestsStoreHandler);
      storeEventBus.on('serviceType:approved', offersStoreHandler);
      storeEventBus.on('serviceType:approved', uiNotificationHandler);

      // Act - Service type gets approved
      storeEventBus.emit('serviceType:approved', { serviceType: mockServiceType });

      // Assert - All interested stores/components get notified
      expect(requestsStoreHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
      expect(offersStoreHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
      expect(uiNotificationHandler).toHaveBeenCalledWith({ serviceType: mockServiceType });
    });

    it('should simulate UI updates when requests and offers are created', () => {
      // Arrange - Simulate UI components listening for new content
      const dashboardUpdateHandler = vi.fn();
      const statisticsUpdateHandler = vi.fn();

      storeEventBus.on('request:created', dashboardUpdateHandler);
      storeEventBus.on('offer:created', dashboardUpdateHandler);
      storeEventBus.on('request:created', statisticsUpdateHandler);
      storeEventBus.on('offer:created', statisticsUpdateHandler);

      // Act - New request and offer are created
      storeEventBus.emit('request:created', { request: mockRequest });
      storeEventBus.emit('offer:created', { offer: mockOffer });

      // Assert - UI components get updated
      expect(dashboardUpdateHandler).toHaveBeenCalledTimes(2);
      expect(statisticsUpdateHandler).toHaveBeenCalledTimes(2);
      expect(dashboardUpdateHandler).toHaveBeenCalledWith({ request: mockRequest });
      expect(dashboardUpdateHandler).toHaveBeenCalledWith({ offer: mockOffer });
    });
  });
});
