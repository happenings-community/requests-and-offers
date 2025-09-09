import { Effect as E, pipe, Context } from 'effect';
import { getToastStore } from '@skeletonlabs/skeleton';
import { ErrorHandling, ErrorRecovery, UIErrorHandling } from '$lib/errors';
import type { BaseComposableState } from '$lib/types/ui';

export interface ErrorBoundaryState extends BaseComposableState {
  retryCount: number;
  lastRetryAt: number | null;
}

export interface ErrorBoundaryOptions {
  context: string;
  maxRetries?: number;
  enableLogging?: boolean;
  enableToast?: boolean;
  enableFallback?: boolean;
  retryDelay?: number;
  timeoutMs?: number;
}

export interface UseErrorBoundary {
  state: ErrorBoundaryState;
  execute: <A>(effect: E.Effect<A, any, any>, fallback?: A) => Promise<A | null>;
  executeWithRetry: <A>(effect: E.Effect<A, any, any>, fallback?: A) => Promise<A | null>;
  executeWithTimeout: <A>(effect: E.Effect<A, any, any>, fallback?: A) => Promise<A | null>;
  clearError: () => void;
  retry: <A>(effect: E.Effect<A, any, any>, fallback?: A) => Promise<A | null>;
}

export function useErrorBoundary(options: ErrorBoundaryOptions): UseErrorBoundary {
  const {
    context,
    maxRetries = 3,
    enableLogging = true,
    enableToast = true,
    enableFallback = true,
    retryDelay = 1000,
    timeoutMs
  } = options;

  const toastStore = getToastStore();

  const state = $state<ErrorBoundaryState>({
    isLoading: false,
    error: null,
    retryCount: 0,
    lastRetryAt: null
  });

  function clearError() {
    state.error = null;
    state.retryCount = 0;
    state.lastRetryAt = null;
  }

  function handleError(error: unknown): void {
    state.error = UIErrorHandling.formatForUser(error);

    if (enableToast && UIErrorHandling.shouldDisplayToUser(error)) {
      toastStore.trigger({
        message: UIErrorHandling.formatForUser(error),
        background: 'variant-filled-error'
      });
    }
  }

  function createEffectWithErrorHandling<A>(
    effect: E.Effect<A, any, any>,
    fallback?: A,
    options?: {
      enableRetry?: boolean;
      customTimeoutMs?: number;
    }
  ): E.Effect<A, any, any> {
    const { enableRetry = false, customTimeoutMs } = options || {};

    return pipe(
      effect,
      // Add logging if enabled
      enableLogging ? (eff) => ErrorHandling.withLogging(eff, context) : (eff) => eff,
      // Add retry if enabled
      enableRetry ? (eff) => ErrorHandling.withRetry(eff, maxRetries, retryDelay) : (eff) => eff,
      // Add timeout if specified
      customTimeoutMs || timeoutMs
        ? (eff) => ErrorHandling.withTimeout(eff, customTimeoutMs || timeoutMs!)
        : (eff) => eff,
      // Add fallback if enabled and provided
      enableFallback && fallback !== undefined
        ? (eff) => ErrorRecovery.withFallback(eff, fallback)
        : (eff) => eff
    );
  }

  async function execute<A>(effect: E.Effect<A, any, any>, fallback?: A): Promise<A | null> {
    state.isLoading = true;
    clearError();

    try {
      const enhancedEffect = createEffectWithErrorHandling(effect, fallback);
      const result = await E.runPromise(enhancedEffect as any);
      return result as A;
    } catch (error) {
      handleError(error);
      return fallback ?? null;
    } finally {
      state.isLoading = false;
    }
  }

  async function executeWithRetry<A>(
    effect: E.Effect<A, any, any>,
    fallback?: A
  ): Promise<A | null> {
    state.isLoading = true;
    state.retryCount = 0;
    clearError();

    try {
      const enhancedEffect = createEffectWithErrorHandling(effect, fallback, {
        enableRetry: true
      });

      const eitherResult = (await E.runPromise(E.either(enhancedEffect) as any)) as any;
      if (eitherResult._tag === 'Right') {
        return eitherResult.right;
      } else {
        throw eitherResult.left;
      }
    } catch (error) {
      // The retry count is managed internally by Effect's retry mechanism
      // We only set it here to indicate we've exhausted retries
      state.retryCount = maxRetries;
      handleError(error);
      return fallback || null;
    } finally {
      state.isLoading = false;
    }
  }

  async function executeWithTimeout<A>(
    effect: E.Effect<A, any, any>,
    fallback?: A
  ): Promise<A | null> {
    if (!timeoutMs) {
      console.warn(
        `${context}: executeWithTimeout called but no timeoutMs specified, falling back to regular execute`
      );
      return execute(effect, fallback);
    }

    state.isLoading = true;
    clearError();

    try {
      // Use the consolidated helper function
      const enhancedEffect = createEffectWithErrorHandling(effect, fallback);

      const eitherResult = (await E.runPromise(E.either(enhancedEffect) as any)) as any;
      if (eitherResult._tag === 'Right') {
        return eitherResult.right;
      } else {
        throw eitherResult.left;
      }
    } catch (error) {
      handleError(error);
      return fallback ?? null;
    } finally {
      state.isLoading = false;
    }
  }

  async function retry<A>(effect: E.Effect<A, any, any>, fallback?: A): Promise<A | null> {
    if (state.retryCount >= maxRetries) {
      console.warn(`${context}: Maximum retry attempts (${maxRetries}) reached`);
      return fallback ?? null;
    }

    state.retryCount++;
    state.lastRetryAt = Date.now();

    // Add delay between retries
    if (retryDelay > 0 && state.retryCount > 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    return execute(effect, fallback);
  }

  return {
    get state() {
      return state;
    },
    execute,
    executeWithRetry,
    executeWithTimeout,
    clearError,
    retry
  };
}
