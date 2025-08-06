/**
 * Effect-SvelteKit Integration Utilities
 * 
 * This module provides utilities for integrating Effect-TS with SvelteKit lifecycle
 * and reactive patterns, enabling Effect-first application architecture while
 * maintaining Svelte 5 reactivity.
 */

import { Effect as E, pipe, Fiber, Context, Layer, Duration } from 'effect';
import { onMount, onDestroy } from 'svelte';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Error boundary configuration for Svelte components
 */
export interface EffectErrorBoundary<E = unknown> {
  /** Handler for Effect errors */
  handleError: (error: E) => E.Effect<void, never>;
  /** Optional recovery strategy */
  recover?: (error: E) => E.Effect<unknown, never>;
  /** Whether to log errors to console */
  logErrors?: boolean;
}

/**
 * Store initialization configuration
 */
export interface StoreInitConfig<T> {
  /** Initial value for the store */
  initialValue?: T;
  /** Whether to initialize on mount */
  initializeOnMount?: boolean;
  /** Error handling strategy */
  errorBoundary?: EffectErrorBoundary;
}

// ============================================================================
// LIFECYCLE INTEGRATION
// ============================================================================

/**
 * Effect-wrapped onMount lifecycle helper that provides proper error handling
 * and resource cleanup integration with Svelte's lifecycle.
 */
export const useEffectOnMount = <A, Err>(
  program: E.Effect<A, Err, never>,
  options?: {
    errorBoundary?: EffectErrorBoundary<Err>;
    timeout?: Duration.DurationInput;
  }
): void => {
  let fiber: Fiber.Fiber<void, any> | undefined;

  onMount(() => {
    const effectToRun = options?.timeout 
      ? pipe(program, E.timeout(options.timeout))
      : program;

    fiber = E.runFork(
      pipe(
        effectToRun,
        E.catchAll((error) => {
          if (options?.errorBoundary) {
            return pipe(
              options.errorBoundary.handleError(error as Err),
              E.andThen(() => {
                if (options.errorBoundary?.recover) {
                  return options.errorBoundary.recover(error as Err);
                }
                return E.void;
              })
            );
          }
          
          // Default error handling - log to console
          return E.sync(() => {
            console.error('Effect onMount error:', error);
          });
        }),
        E.asVoid
      )
    );
  });

  onDestroy(() => {
    if (fiber) {
      E.runSync(Fiber.interrupt(fiber));
    }
  });
};

/**
 * Effect-wrapped lifecycle helper that runs an Effect and provides the result
 * to a Svelte reactive variable through a callback.
 */
export const useEffectWithCallback = <A, Err>(
  program: E.Effect<A, Err, never>,
  onSuccess: (result: A) => void,
  options?: {
    errorBoundary?: EffectErrorBoundary<Err>;
    onError?: (error: Err) => void;
  }
): void => {
  useEffectOnMount(
    pipe(
      program,
      E.tap((result) => E.sync(() => onSuccess(result))),
      E.catchAll((error) => {
        if (options?.onError) {
          return E.sync(() => options.onError!(error));
        }
        return E.void;
      })
    ),
    { errorBoundary: options?.errorBoundary }
  );
};

// ============================================================================
// STORE INITIALIZATION HELPERS
// ============================================================================

/**
 * Creates an Effect-based store initialization helper that can be used in
 * Svelte components to initialize stores with proper error handling.
 */
export const createStoreInitializer = <Err = unknown>(
  storeEffects: Array<() => E.Effect<unknown, Err, never>>
) => {
  return (options?: { 
    parallel?: boolean; 
    errorBoundary?: EffectErrorBoundary<Err>;
  }) => {
    const effects = storeEffects.map(fn => fn());
    
    const program = options?.parallel 
      ? E.all(effects, { concurrency: 'unbounded' })
      : E.all(effects, { concurrency: 1 });

    return pipe(
      program,
      E.tap(() => E.logDebug('Store initialization completed')),
      E.catchAll((error) => {
        if (options?.errorBoundary) {
          return options.errorBoundary.handleError(error);
        }
        return E.logError('Store initialization failed', error);
      })
    );
  };
};

/**
 * Creates a reactive store initializer that automatically initializes
 * when dependencies change.
 */
export const createReactiveStoreInitializer = <T, Err = unknown>(
  dependency: () => T,
  getStoreEffects: (dep: T) => Array<() => E.Effect<unknown, Err, never>>,
  options?: StoreInitConfig<T>
) => {
  let lastDependencyValue: T;
  let fiber: Fiber.Fiber<unknown, any> | undefined;

  const checkAndReinitialize = () => {
    const currentValue = dependency();
    
    if (currentValue !== lastDependencyValue) {
      lastDependencyValue = currentValue;
      
      // Cancel previous initialization if running
      if (fiber) {
        E.runSync(Fiber.interrupt(fiber));
      }
      
      // Start new initialization
      const storeEffects = getStoreEffects(currentValue);
      const initializer = createStoreInitializer(storeEffects);
      
      fiber = E.runFork(
        initializer({ 
          parallel: true, 
          errorBoundary: options?.errorBoundary 
        })
      );
    }
  };

  if (options?.initializeOnMount !== false) {
    onMount(checkAndReinitialize);
  }

  onDestroy(() => {
    if (fiber) {
      E.runSync(Fiber.interrupt(fiber));
    }
  });

  return { checkAndReinitialize };
};

// ============================================================================
// ERROR BOUNDARY UTILITIES
// ============================================================================

/**
 * Creates an error boundary for Svelte components that provides structured
 * error handling for Effect operations.
 */
export const createEffectErrorBoundary = <Err>(
  config: {
    handleError: (error: Err) => E.Effect<void, never>;
    recover?: (error: Err) => E.Effect<unknown, never>;
    logErrors?: boolean;
  }
): EffectErrorBoundary<Err> => {
  return {
    handleError: (error: Err) => {
      return pipe(
        config.logErrors !== false 
          ? E.logError('Error boundary caught error:', error)
          : E.void,
        E.andThen(() => config.handleError(error))
      );
    },
    recover: config.recover,
    logErrors: config.logErrors
  };
};

/**
 * Generic error boundary that can be used across different domains.
 * Provides sensible defaults for common error scenarios.
 */
export const createGenericErrorBoundary = <Err>(
  showUserError?: (message: string) => void
): EffectErrorBoundary<Err> => {
  return createEffectErrorBoundary({
    handleError: (error) =>
      E.sync(() => {
        const message = error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred';
        
        if (showUserError) {
          showUserError(message);
        } else {
          console.error('Application error:', error);
        }
      }),
    logErrors: true
  });
};

// ============================================================================
// RESOURCE CLEANUP HELPERS
// ============================================================================

/**
 * Creates a resource management helper that automatically cleans up
 * Effect fibers when the Svelte component is destroyed.
 */
export const useEffectResource = <A, Err>(
  acquire: E.Effect<A, Err, never>,
  release: (resource: A) => E.Effect<void, never>
): { resource: A | null } => {
  let resource: A | null = null;
  let fiber: Fiber.Fiber<A, any> | undefined;

  onMount(() => {
    fiber = E.runFork(
      pipe(
        acquire,
        E.tap((acquired) =>
          E.sync(() => {
            resource = acquired;
          })
        )
      )
    );
  });

  onDestroy(() => {
    if (fiber && resource) {
      E.runSync(
        pipe(
          release(resource),
          E.andThen(() => Fiber.interrupt(fiber!))
        )
      );
    }
  });

  return {
    get resource() {
      return resource;
    }
  };
};

/**
 * Creates a scoped resource manager that can acquire and release multiple
 * resources with automatic cleanup.
 */
export const createScopedResourceManager = () => {
  const resources: Array<{
    resource: unknown;
    cleanup: E.Effect<void, never>;
    fiber?: Fiber.Fiber<unknown, any>;
  }> = [];

  const acquire = <A, Err>(
    acquisitionEffect: E.Effect<A, Err, never>,
    cleanup: (resource: A) => E.Effect<void, never>
  ): { resource: A | null } => {
    let resource: A | null = null;

    const fiber = E.runFork(
      pipe(
        acquisitionEffect,
        E.tap((acquired) =>
          E.sync(() => {
            resource = acquired;
          })
        )
      )
    );

    resources.push({
      resource,
      cleanup: resource ? cleanup(resource) : E.void,
      fiber
    });

    return {
      get resource() {
        return resource;
      }
    };
  };

  const cleanup = (): E.Effect<void, never> => {
    return pipe(
      E.all(
        resources.map(({ cleanup, fiber }) =>
          pipe(
            cleanup,
            E.andThen(() => (fiber ? Fiber.interrupt(fiber) : E.void))
          )
        ),
        { concurrency: 'unbounded' }
      ),
      E.asVoid,
      E.tap(() => E.sync(() => (resources.length = 0)))
    );
  };

  onDestroy(() => {
    E.runSync(cleanup());
  });

  return { acquire, cleanup };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Runs an Effect in a SvelteKit-compatible way with proper error handling
 * and logging. This is the preferred way to run Effects in Svelte components.
 */
export const runEffectInSvelte = <A, Err>(
  effect: E.Effect<A, Err, never>,
  options?: {
    onSuccess?: (result: A) => void;
    onError?: (error: Err) => void;
    timeout?: Duration.DurationInput;
  }
): void => {
  const program = pipe(
    options?.timeout ? E.timeout(effect, options.timeout) : effect,
    E.tap((result) => options?.onSuccess ? E.sync(() => options.onSuccess!(result)) : E.void),
    E.catchAll((error) => 
      options?.onError 
        ? E.sync(() => options.onError!(error as Err)) 
        : E.logError('Effect error:', error)
    )
  );

  E.runFork(program);
};

/**
 * Creates a debounced Effect runner that's useful for reactive updates
 * in Svelte components.
 */
export const createDebouncedEffectRunner = <A, Err>(
  effect: E.Effect<A, Err, never>,
  delayMs: number = 300
) => {
  let timeoutId: NodeJS.Timeout;
  
  return (options?: { onSuccess?: (result: A) => void; onError?: (error: Err) => void }) => {
    clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      runEffectInSvelte(effect, options);
    }, delayMs);
  };
};