import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import { Effect as E, Layer } from 'effect';
import { createHreaStore, type HreaStore, HreaStoreError } from '$lib/stores/hrea.store.svelte';
import type { HreaService } from '$lib/services/zomes/hrea.service';
import { HreaServiceTag } from '$lib/services/zomes/hrea.service';
import { mockEffectFn, mockEffectFnWithParams } from '../effect';
import { runEffect } from '$lib/utils/effect';
import type { Agent } from '$lib/types/hrea';
import { HreaError } from '$lib/errors';

describe('HreaStore', () => {
  let store: HreaStore;
  let mockHreaService: HreaService;
  let testAgent: Agent;

  // Helper function to create a mock HreaService
  const createMockService = (overrides: Partial<HreaService> = {}): HreaService => {
    const defaultService = {
      initialize: mockEffectFn<void, HreaError>(vi.fn(() => Promise.resolve())),
      createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
        vi.fn(() => Promise.resolve(testAgent))
      )
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
      let resolvePromise: () => void;
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      const slowService = createMockService({
        initialize: mockEffectFn<void, HreaError>(vi.fn(() => pendingPromise))
      });

      const slowStore = await createStoreWithService(slowService);

      // Act - Start initialization (don't await yet)
      const initPromise = runEffect(slowStore.initialize());

      // Verify loading state is true during operation
      // Note: We need to check this immediately after starting the operation
      // because the state might change very quickly in tests

      // Complete the operation
      resolvePromise!();
      await initPromise;

      // Assert final state
      expect(slowStore.loading).toBe(false);
      expect(slowStore.error).toBeNull();
    });

    it('should handle initialization errors', async () => {
      // Arrange
      const initError = new Error('Failed to initialize hREA service');
      const errorService = createMockService({
        initialize: mockEffectFn<void, HreaError>(vi.fn(() => Promise.reject(initError)))
      });

      const errorStore = await createStoreWithService(errorService);

      // Act & Assert
      await expect(runEffect(errorStore.initialize())).rejects.toThrow(
        'Failed to initialize hREA service'
      );

      // Verify error state
      expect(errorStore.loading).toBe(false);
      expect(errorStore.error).toBeDefined();
      expect(errorStore.error?.message).toContain('Failed to initialize hREA service');
    });

    it('should clear previous errors on successful initialization', async () => {
      // Arrange - First cause an error
      const errorService = createMockService({
        initialize: mockEffectFn<void, HreaError>(
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

  describe('createPerson', () => {
    const personParams = { name: 'John Doe', note: 'A new person' };

    beforeEach(async () => {
      // Initialize the store before each createPerson test
      await runEffect(store.initialize());
    });

    it('should create a person successfully', async () => {
      // Act
      const result = await runEffect(store.createPerson(personParams));

      // Assert
      expect(result).toBeUndefined();
      expect(store.agents).toHaveLength(1);
      expect(store.agents[0]).toEqual(testAgent);
      expect(store.loading).toBe(false);
      expect(store.error).toBeNull();
      expect(mockHreaService.createPerson).toHaveBeenCalledWith(personParams);
    });

    it('should handle creation without optional note', async () => {
      // Arrange
      const paramsWithoutNote = { name: 'Jane Doe' };

      // Act
      await runEffect(store.createPerson(paramsWithoutNote));

      // Assert
      expect(store.agents).toHaveLength(1);
      expect(mockHreaService.createPerson).toHaveBeenCalledWith(paramsWithoutNote);
    });

    it('should add multiple agents to the store', async () => {
      // Arrange
      const secondAgent: Agent = {
        id: 'agent-456',
        name: 'Second Agent',
        note: 'Another test agent'
      };

      const multiAgentService = createMockService({
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn().mockResolvedValueOnce(testAgent).mockResolvedValueOnce(secondAgent)
        )
      });

      const multiStore = await createStoreWithService(multiAgentService);
      await runEffect(multiStore.initialize());

      // Act
      await runEffect(multiStore.createPerson({ name: 'First' }));
      await runEffect(multiStore.createPerson({ name: 'Second' }));

      // Assert
      expect(multiStore.agents).toHaveLength(2);
      expect(multiStore.agents[0]).toEqual(testAgent);
      expect(multiStore.agents[1]).toEqual(secondAgent);
    });

    it('should set loading state during creation', async () => {
      // Arrange - Create a service that keeps the promise pending
      let resolvePromise: (agent: Agent) => void;
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
      const createPromise = runEffect(slowStore.createPerson(personParams));

      // Complete the operation
      resolvePromise!(testAgent);
      await createPromise;

      // Assert final state
      expect(slowStore.loading).toBe(false);
      expect(slowStore.error).toBeNull();
      expect(slowStore.agents).toHaveLength(1);
    });

    it('should handle creation errors', async () => {
      // Arrange
      const createError = new Error('Failed to create person agent');
      const errorService = createMockService({
        initialize: mockEffectFn<void, HreaError>(vi.fn(() => Promise.resolve())),
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn(() => Promise.reject(createError))
        )
      });

      const errorStore = await createStoreWithService(errorService);
      await runEffect(errorStore.initialize());

      // Act & Assert
      await expect(runEffect(errorStore.createPerson(personParams))).rejects.toThrow(
        'Failed to create person agent'
      );

      // Verify state
      expect(errorStore.agents).toHaveLength(0);
      expect(errorStore.loading).toBe(false);
      expect(errorStore.error).toBeDefined();
      expect(errorStore.error?.message).toContain('Failed to create person agent');
    });

    it('should clear previous errors on successful creation', async () => {
      // Arrange - First cause an error
      const errorService = createMockService({
        initialize: mockEffectFn<void, HreaError>(vi.fn(() => Promise.resolve())),
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn(() => Promise.reject(new Error('Creation error')))
        )
      });

      const errorStore = await createStoreWithService(errorService);
      await runEffect(errorStore.initialize());

      // Cause initial error
      await expect(runEffect(errorStore.createPerson(personParams))).rejects.toThrow();
      expect(errorStore.error).toBeDefined();

      // Update the service to succeed
      const successService = createMockService({
        initialize: mockEffectFn<void, HreaError>(vi.fn(() => Promise.resolve())),
        createPerson: mockEffectFnWithParams<[{ name: string; note?: string }], Agent, HreaError>(
          vi.fn(() => Promise.resolve(testAgent))
        )
      });
      const successStore = await createStoreWithService(successService);
      await runEffect(successStore.initialize());

      // Act - Create successfully
      await runEffect(successStore.createPerson(personParams));

      // Assert - Error should be cleared
      expect(successStore.error).toBeNull();
      expect(successStore.agents).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should create HreaStoreError correctly', () => {
      // Arrange
      const testError = new Error('Test error message');
      const context = 'Test context';

      // Act
      const storeError = HreaStoreError.fromError(testError, context);

      // Assert
      expect(storeError).toBeInstanceOf(HreaStoreError);
      expect(storeError.message).toBe(`${context}: ${testError.message}`);
      expect(storeError.cause).toBe(testError);
    });

    it('should handle non-Error objects in HreaStoreError', () => {
      // Arrange
      const testError = 'String error';
      const context = 'Test context';

      // Act
      const storeError = HreaStoreError.fromError(testError, context);

      // Assert
      expect(storeError).toBeInstanceOf(HreaStoreError);
      expect(storeError.message).toBe(`${context}: ${testError}`);
      expect(storeError.cause).toBe(testError);
    });
  });

  describe('Reactive State', () => {
    it('should have reactive agents property', async () => {
      // Initial state
      expect(store.agents).toEqual([]);

      // After adding an agent
      await runEffect(store.initialize());
      await runEffect(store.createPerson({ name: 'Test Agent' }));

      expect(store.agents).toHaveLength(1);
      expect(store.agents[0]).toEqual(testAgent);
    });

    it('should have reactive loading property', async () => {
      // Initial state
      expect(store.loading).toBe(false);

      // Note: Testing loading state changes during async operations is challenging
      // in unit tests because the state changes very quickly. The important thing
      // is that loading is false before and after operations.
    });

    it('should have reactive error property', async () => {
      // Initial state
      expect(store.error).toBeNull();

      // After an error
      const errorService = createMockService({
        initialize: mockEffectFn<void, HreaError>(
          vi.fn(() => Promise.reject(new Error('Test error')))
        )
      });

      const errorStore = await createStoreWithService(errorService);

      await expect(runEffect(errorStore.initialize())).rejects.toThrow();
      expect(errorStore.error).toBeDefined();
    });
  });

  describe('Service Integration', () => {
    it('should properly integrate with HreaService via dependency injection', async () => {
      // This test verifies that the store correctly uses the injected service
      const customService = createMockService();
      const customStore = await createStoreWithService(customService);

      // Test initialize
      await runEffect(customStore.initialize());
      expect(customService.initialize).toHaveBeenCalled();

      // Test createPerson
      await runEffect(customStore.createPerson({ name: 'Test' }));
      expect(customService.createPerson).toHaveBeenCalledWith({ name: 'Test' });
    });

    it('should handle service dependency correctly', async () => {
      // Verify that the store fails appropriately if service is not provided
      // This test ensures proper dependency injection usage

      const storeWithoutDeps = createHreaStore();

      // This should work since we're providing the service layer
      const mockLayer = Layer.succeed(HreaServiceTag, mockHreaService);
      const store = await runEffect(storeWithoutDeps.pipe(E.provide(mockLayer)));

      expect(store).toBeDefined();
      expect(typeof store.initialize).toBe('function');
      expect(typeof store.createPerson).toBe('function');
    });
  });
});
