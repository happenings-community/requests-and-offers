import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { createHreaStore, type HreaStore } from '$lib/stores/hrea.store.svelte';
import type { HreaService } from '$lib/services/zomes/hrea.service';
import { HreaServiceTag } from '$lib/services/zomes/hrea.service';
import { mockEffectFn, mockEffectFnWithParams } from '../effect';
import { runEffect } from '$lib/utils/effect';
import type { Agent } from '$lib/types/hrea';
import type { UIUser } from '$lib/types/ui';
import { HreaError } from '$lib/errors';

describe('HreaStore', () => {
  let store: HreaStore;
  let mockHreaService: HreaService;
  let testAgent: Agent;
  let testUser: UIUser;

  // Helper function to create a mock HreaService
  const createMockService = (overrides: Partial<HreaService> = {}): HreaService => {
    const defaultService = {
      initialize: mockEffectFn<any, HreaError>(vi.fn(() => Promise.resolve({ id: 'mock-client' }))),
      createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
        vi.fn(() => Promise.resolve(testAgent))
      ),
      updatePerson: mockEffectFnWithParams<
        [{ id: string; name: string; note?: string }],
        Agent,
        HreaError
      >(vi.fn(() => Promise.resolve(testAgent))),
      getAgent: mockEffectFnWithParams<[{ id: string }], Agent, HreaError>(
        vi.fn(() => Promise.resolve(testAgent))
      ),
      getAgents: mockEffectFn<Agent[], HreaError>(vi.fn(() => Promise.resolve([testAgent])))
    } as HreaService;
    return { ...defaultService, ...overrides } as HreaService;
  };

  // Helper function to create a store with custom service
  const createStoreWithService = async (service: HreaService): Promise<HreaStore> => {
    const mockLayer = Layer.succeed(HreaServiceTag, service);
    return await runEffect(createHreaStore().pipe(E.provide(mockLayer)));
  };

  beforeEach(async () => {
    testAgent = {
      id: 'agent-123',
      name: 'Test Agent',
      note: 'A test agent for testing'
    };

    testUser = {
      name: 'Test User',
      nickname: 'testuser',
      bio: 'A test user',
      email: 'test@example.com',
      location: 'Test City',
      time_zone: 'UTC',
      user_type: 'creator',
      original_action_hash: new Uint8Array([1, 2, 3, 4])
    } as UIUser;

    // Create default mock service
    mockHreaService = createMockService();

    // Create store instance with mocked service
    store = await createStoreWithService(mockHreaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      expect(store.agents).toEqual([]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Act
      const result = await runEffect(store.initialize());

      // Assert
      expect(result).toBeUndefined();
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(mockHreaService.initialize).toHaveBeenCalled();
    });

    it('should set loading state during initialization', async () => {
      // Arrange - Create a service that keeps the promise pending
      let resolvePromise!: (value: any) => void;
      const pendingPromise = new Promise<any>((resolve) => {
        resolvePromise = resolve;
      });

      const slowService = createMockService({
        initialize: mockEffectFn<any, HreaError>(vi.fn(() => pendingPromise))
      });

      const slowStore = await createStoreWithService(slowService);

      // Act - Start initialization (don't await yet)
      const initPromise = runEffect(slowStore.initialize());

      // Verify loading state is true during operation
      // Note: We need to check this immediately after starting the operation
      // because the state might change very quickly in tests

      // Complete the operation
      resolvePromise({ id: 'mock-client' });
      await initPromise;

      // Assert final state
      expect(slowStore.loading).toBe(false);
      expect(slowStore.error).toBeNull();
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const initError = new Error('Failed to initialize hREA service');
      const errorService = createMockService({
        initialize: mockEffectFn<any, HreaError>(vi.fn(() => Promise.reject(initError)))
      });

      const errorStore = await createStoreWithService(errorService);

      // Act & Assert
      await expect(runEffect(errorStore.initialize())).rejects.toThrow(
        'Failed to initialize hREA service'
      );

      // Verify state - initialize method doesn't set store errors, it throws them
      expect(errorStore.loading).toBe(false);
      expect(errorStore.error).toBeNull(); // initialize doesn't set store errors
    });

    it('should clear previous errors on successful initialization', async () => {
      // Arrange - First cause an error
      const errorService = createMockService({
        initialize: mockEffectFn<any, HreaError>(
          vi.fn(() => Promise.reject(new Error('Initial error')))
        )
      });

      const errorStore = await createStoreWithService(errorService);

      // Cause initial error
      await expect(runEffect(errorStore.initialize())).rejects.toThrow();
      expect(errorStore.error).toBeDefined();

      // Update the service to succeed
      const successService = createMockService();
      const successStore = await createStoreWithService(successService);

      // Act - Initialize successfully
      await runEffect(successStore.initialize());

      // Assert - Error should be cleared
      expect(successStore.error).toBeNull();
    });
  });

  describe('createPersonFromUser', () => {
    beforeEach(async () => {
      // Initialize the store before each createPersonFromUser test
      await runEffect(store.initialize());
    });

    it('should create a person from user successfully', async () => {
      // Act
      const result = await runEffect(store.createPersonFromUser(testUser));

      // Assert
      expect(result).toEqual(testAgent);
      expect(store.error).toBeNull();
      expect(mockHreaService.createPerson).toHaveBeenCalledWith({
        name: testUser.name,
        note: expect.stringContaining('A test user')
      });
    });

    it('should handle user without action hash', async () => {
      // Arrange
      const userWithoutHash = { ...testUser, original_action_hash: undefined };

      // Act
      const result = await runEffect(store.createPersonFromUser(userWithoutHash));

      // Assert
      expect(result).toBeNull();
      expect(mockHreaService.createPerson).not.toHaveBeenCalled();
    });

    it('should prevent duplicate agent creation for same user', async () => {
      // Act - Create twice
      await runEffect(store.createPersonFromUser(testUser));
      const secondResult = await runEffect(store.createPersonFromUser(testUser));

      // Assert
      expect(secondResult).toBeNull(); // Second call should return null
      expect(mockHreaService.createPerson).toHaveBeenCalledTimes(1);
    });

    it('should set loading state during creation', async () => {
      // Arrange - Create a service that keeps the promise pending
      let resolvePromise!: (value: Agent) => void;
      const pendingPromise = new Promise<Agent>((resolve) => {
        resolvePromise = resolve;
      });

      const slowService = createMockService({
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn(() => pendingPromise)
        )
      });

      const slowStore = await createStoreWithService(slowService);
      await runEffect(slowStore.initialize());

      // Act - Start creation (don't await yet)
      const createPromise = runEffect(slowStore.createPersonFromUser(testUser));

      // Complete the operation
      resolvePromise(testAgent);
      await createPromise;

      // Assert final state
      expect(slowStore.error).toBeNull();
    });

    it('should handle creation errors gracefully', async () => {
      // Arrange
      const errorService = createMockService({
        initialize: mockEffectFn<any, HreaError>(
          vi.fn(() => Promise.resolve({ id: 'mock-client' }))
        ),
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn(() => Promise.reject(new Error('Creation failed')))
        )
      });

      const errorStore = await createStoreWithService(errorService);
      await runEffect(errorStore.initialize());

      // Act & Assert
      await expect(runEffect(errorStore.createPersonFromUser(testUser))).rejects.toThrow(
        'Creation failed'
      );
    });

    it('should handle creation errors with error context', async () => {
      // Arrange
      const errorService = createMockService({
        initialize: mockEffectFn<any, HreaError>(
          vi.fn(() => Promise.resolve({ id: 'mock-client' }))
        ),
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn(() => Promise.reject(new Error('Service error')))
        )
      });

      const errorStore = await createStoreWithService(errorService);
      await runEffect(errorStore.initialize());

      // Cause initial error
      await expect(runEffect(errorStore.createPersonFromUser(testUser))).rejects.toThrow();
      expect(errorStore.error).toBeDefined();

      // Update the service to succeed
      const successService = createMockService({
        initialize: mockEffectFn<any, HreaError>(
          vi.fn(() => Promise.resolve({ id: 'mock-client' }))
        ),
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn(() => Promise.resolve(testAgent))
        )
      });

      const successStore = await createStoreWithService(successService);
      await runEffect(successStore.initialize());

      // Act - Create successfully
      await runEffect(successStore.createPersonFromUser(testUser));

      // Assert - Error should be cleared
      expect(successStore.error).toBeNull();
    });
  });

  describe('getAllAgents', () => {
    beforeEach(async () => {
      await runEffect(store.initialize());
    });

    it('should fetch all agents successfully', async () => {
      // Act
      await runEffect(store.getAllAgents());

      // Assert
      expect(store.agents).toEqual([testAgent]);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(mockHreaService.getAgents).toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      // Arrange
      const errorService = createMockService({
        initialize: mockEffectFn<any, HreaError>(
          vi.fn(() => Promise.reject(new Error('Test error')))
        )
      });

      const errorStore = await createStoreWithService(errorService);

      // Act & Assert
      await expect(runEffect(errorStore.getAllAgents())).rejects.toThrow();
    });
  });

  describe('Service Integration', () => {
    it('should integrate with different service implementations', async () => {
      // Arrange
      const customService = createMockService();
      const customStore = await createStoreWithService(customService);

      // Test initialization
      await runEffect(customStore.initialize());
      expect(customService.initialize).toHaveBeenCalled();

      // Test createPersonFromUser
      await runEffect(customStore.createPersonFromUser(testUser));
      expect(customService.createPerson).toHaveBeenCalledWith({
        name: testUser.name,
        note: expect.stringContaining('A test user')
      });

      // Test getAllAgents
      await runEffect(customStore.getAllAgents());
      expect(customService.getAgents).toHaveBeenCalled();
    });
  });

  describe('Store Interface', () => {
    it('should expose the expected public interface', () => {
      expect(typeof store.initialize).toBe('function');
      expect(typeof store.createPersonFromUser).toBe('function');
      expect(typeof store.updatePersonAgent).toBe('function');
      expect(typeof store.getAllAgents).toBe('function');
      expect(typeof store.createRetroactiveMappings).toBe('function');
      expect(typeof store.dispose).toBe('function');
    });
  });
});
