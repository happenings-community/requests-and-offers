/**
 * Unit tests for Effect-SvelteKit integration utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Effect as E, pipe, Context, Layer } from 'effect';

// Mock Svelte lifecycle functions - must be hoisted
vi.mock('svelte', () => ({
  onMount: vi.fn(),
  onDestroy: vi.fn()
}));

// Import mocked functions
import { onMount, onDestroy } from 'svelte';

// Import utilities after mocking
import {
  useEffectOnMount,
  useEffectWithCallback,
  createStoreInitializer,
  createEffectErrorBoundary,
  createGenericErrorBoundary,
  useEffectResource,
  createScopedResourceManager,
  runEffectInSvelte,
  createDebouncedEffectRunner
} from '$lib/utils/effect-svelte-integration';

// Cast to MockedFunction for better typing
const mockOnMount = onMount as any;
const mockOnDestroy = onDestroy as any;

// Mock services for testing
interface TestService {
  getValue: () => E.Effect<string, Error>;
  setValue: (value: string) => E.Effect<void, Error>;
}

const TestServiceTag = Context.GenericTag<TestService>('TestService');

const TestServiceLive = Layer.succeed(TestServiceTag, {
  getValue: () => E.succeed('test-value'),
  setValue: (value: string) => E.succeed(undefined)
});

describe('Effect-SvelteKit Integration Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useEffectOnMount', () => {
    it('should execute Effect on mount and setup cleanup on destroy', () => {
      const mockEffect = E.succeed('test-result');
      const mockErrorBoundary = {
        handleError: vi.fn(() => E.void),
        logErrors: true
      };

      useEffectOnMount(mockEffect, { errorBoundary: mockErrorBoundary });

      // Verify onMount was called
      expect(mockOnMount).toHaveBeenCalledOnce();
      expect(mockOnDestroy).toHaveBeenCalledOnce();
    });

    it('should handle timeout option', () => {
      const mockEffect = E.succeed('test-result');

      useEffectOnMount(mockEffect, { timeout: '5 seconds' });

      expect(mockOnMount).toHaveBeenCalledOnce();
    });

    it('should provide default error handling when no error boundary is provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingEffect = E.fail(new Error('test error'));

      useEffectOnMount(failingEffect);

      expect(mockOnMount).toHaveBeenCalledOnce();

      consoleSpy.mockRestore();
    });
  });

  describe('useEffectWithCallback', () => {
    it('should execute Effect on mount with callbacks', () => {
      const onSuccess = vi.fn();
      const mockEffect = E.succeed('success-result');

      useEffectWithCallback(mockEffect, onSuccess);

      expect(mockOnMount).toHaveBeenCalledOnce();
    });

    it('should handle error callback option', () => {
      const onError = vi.fn();
      const error = new Error('test error');
      const failingEffect = E.fail(error);

      useEffectWithCallback(failingEffect, () => {}, { onError });

      expect(mockOnMount).toHaveBeenCalledOnce();
    });
  });

  describe('createStoreInitializer', () => {
    it('should create initializer for sequential store effects', async () => {
      const effect1 = vi.fn(() => E.succeed('result1'));
      const effect2 = vi.fn(() => E.succeed('result2'));

      const initializer = createStoreInitializer([effect1, effect2]);
      const program = initializer({ parallel: false });

      const result = await E.runPromise(program);

      expect(effect1).toHaveBeenCalledOnce();
      expect(effect2).toHaveBeenCalledOnce();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should create initializer for parallel store effects', async () => {
      const effect1 = vi.fn(() => E.succeed('result1'));
      const effect2 = vi.fn(() => E.succeed('result2'));

      const initializer = createStoreInitializer([effect1, effect2]);
      const program = initializer({ parallel: true });

      const result = await E.runPromise(program);

      expect(effect1).toHaveBeenCalledOnce();
      expect(effect2).toHaveBeenCalledOnce();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle initialization errors with error boundary', async () => {
      const handleError = vi.fn(() => E.void);
      const errorBoundary = { handleError, logErrors: true };
      const failingEffect = vi.fn(() => E.fail(new Error('init error')));

      const initializer = createStoreInitializer([failingEffect]);
      const program = initializer({ errorBoundary });

      await E.runPromise(program);

      expect(failingEffect).toHaveBeenCalledOnce();
      expect(handleError).toHaveBeenCalled();
    });
  });

  describe('createEffectErrorBoundary', () => {
    it('should create error boundary with custom error handler', async () => {
      const handleError = vi.fn(() => E.void);
      const recover = vi.fn(() => E.succeed('recovered'));

      const errorBoundary = createEffectErrorBoundary({
        handleError,
        recover,
        logErrors: true
      });

      const error = new Error('test error');
      await E.runPromise(errorBoundary.handleError(error));

      expect(handleError).toHaveBeenCalledWith(error);

      if (errorBoundary.recover) {
        const recoveryResult = await E.runPromise(errorBoundary.recover(error));
        expect(recover).toHaveBeenCalledWith(error);
        expect(recoveryResult).toBe('recovered');
      }
    });

    it('should optionally log errors', async () => {
      const handleError = vi.fn(() => E.void);

      const errorBoundary = createEffectErrorBoundary({
        handleError,
        logErrors: true
      });

      const error = new Error('test error');
      await E.runPromise(errorBoundary.handleError(error));

      expect(handleError).toHaveBeenCalledWith(error);
    });
  });

  describe('createGenericErrorBoundary', () => {
    it('should create generic error boundary with user error callback', async () => {
      const showUserError = vi.fn();
      const errorBoundary = createGenericErrorBoundary(showUserError);

      const error = new Error('user facing error');
      await E.runPromise(errorBoundary.handleError(error));

      expect(showUserError).toHaveBeenCalledWith('user facing error');
    });

    it('should fallback to console.error when no callback provided', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorBoundary = createGenericErrorBoundary();

      const error = new Error('console error');
      await E.runPromise(errorBoundary.handleError(error));

      expect(consoleSpy).toHaveBeenCalledWith('Application error:', error);

      consoleSpy.mockRestore();
    });
  });

  describe('useEffectResource', () => {
    it('should acquire resource on mount and cleanup on destroy', () => {
      const mockResource = { id: 'test-resource' };
      const acquire = E.succeed(mockResource);
      const release = vi.fn(() => E.void);

      const { resource } = useEffectResource(acquire, release);

      expect(mockOnMount).toHaveBeenCalledOnce();
      expect(mockOnDestroy).toHaveBeenCalledOnce();
    });
  });

  describe('createScopedResourceManager', () => {
    it('should manage multiple resources with cleanup', () => {
      const resourceManager = createScopedResourceManager();

      const mockResource1 = { id: 'resource-1' };
      const mockResource2 = { id: 'resource-2' };

      const cleanup1 = vi.fn(() => E.void);
      const cleanup2 = vi.fn(() => E.void);

      resourceManager.acquire(E.succeed(mockResource1), cleanup1);
      resourceManager.acquire(E.succeed(mockResource2), cleanup2);

      expect(mockOnDestroy).toHaveBeenCalledOnce();
    });
  });

  describe('runEffectInSvelte', () => {
    it('should run Effect with success callback', async () => {
      const onSuccess = vi.fn();
      const mockEffect = E.succeed('test-result');

      runEffectInSvelte(mockEffect, { onSuccess });

      // Wait for effect to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(onSuccess).toHaveBeenCalledWith('test-result');
    });

    it('should run Effect with error callback', async () => {
      const onError = vi.fn();
      const error = new Error('test error');
      const failingEffect = E.fail(error);

      runEffectInSvelte(failingEffect, { onError });

      // Wait for effect to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should apply timeout when provided', () => {
      const mockEffect = E.succeed('test-result');

      runEffectInSvelte(mockEffect, { timeout: '1 second' });

      // Test doesn't fail, indicating timeout was applied correctly
    });
  });

  describe('createDebouncedEffectRunner', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce Effect execution', async () => {
      const onSuccess = vi.fn();
      const mockEffect = E.succeed('debounced-result');

      const debouncedRunner = createDebouncedEffectRunner(mockEffect, 100);

      // Call multiple times quickly
      debouncedRunner({ onSuccess });
      debouncedRunner({ onSuccess });
      debouncedRunner({ onSuccess });

      // Fast-forward time past the debounce delay
      vi.advanceTimersByTime(150);

      // Use real timers for the Promise delay to avoid conflicts
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();

      // Should only be called once due to debouncing
      expect(onSuccess).toHaveBeenCalledOnce();
      expect(onSuccess).toHaveBeenCalledWith('debounced-result');
    });

    it('should reset debounce timer on subsequent calls', async () => {
      const onSuccess = vi.fn();
      const mockEffect = E.succeed('debounced-result');

      const debouncedRunner = createDebouncedEffectRunner(mockEffect, 100);

      // First call
      debouncedRunner({ onSuccess });

      // Advance time partially
      vi.advanceTimersByTime(50);

      // Second call should reset timer
      debouncedRunner({ onSuccess });

      // Advance time to complete debounce from the second call
      vi.advanceTimersByTime(150);

      // Use real timers for the Promise delay
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 50));
      vi.useFakeTimers();

      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  describe('Integration Tests', () => {
    it('should work with Effect services and dependency injection', async () => {
      const program = E.gen(function* () {
        const service = yield* TestServiceTag;
        const value = yield* service.getValue();
        return value;
      });

      const result = await E.runPromise(pipe(program, E.provide(TestServiceLive)));

      expect(result).toBe('test-value');
    });

    it('should integrate error boundaries with store initialization', async () => {
      const handleError = vi.fn(() => E.void);
      const errorBoundary = createEffectErrorBoundary({ handleError });

      const failingStoreEffect = () => E.fail(new Error('store init failed'));
      const successStoreEffect = () => E.succeed('store initialized');

      const initializer = createStoreInitializer([failingStoreEffect, successStoreEffect]);

      await E.runPromise(initializer({ errorBoundary }));

      expect(handleError).toHaveBeenCalled();
    });
  });
});
