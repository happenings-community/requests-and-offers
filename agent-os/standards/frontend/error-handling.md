# Frontend Error Handling Patterns

This document outlines the comprehensive error handling patterns used throughout the SvelteKit frontend, integrating Effect-TS error management with user-friendly error boundaries and recovery strategies.

## Technology Stack

- **SvelteKit 2**: Modern full-stack framework with file-based routing
- **Skeleton UI v2**: Component library (https://v2.skeleton.dev/)
- **TailwindCSS v3**: Utility-first CSS framework (https://v3.tailwindcss.com/docs/installation)
- **Effect-TS**: Functional programming with powerful error handling
- **Svelte 5 Runes**: Fine-grained reactivity with `$state`, `$derived`, and `$effect`

## Error Handling Architecture

### 7-Layer Error Integration

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 6: Components (Svelte 5 + Error Boundaries)          │
│   - Error boundary components with fallback UI              │
│   - User-friendly error messages and recovery actions      │
│   - Loading states and retry mechanisms                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Composables (Error Orchestration)                 │
│   - Error aggregation and transformation                   │
│   - User notification management                          │
│   - Recovery strategy orchestration                       │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Error Handling (Tagged Errors)                   │
│   - Domain-specific error types with context               │
│   - Error recovery patterns and retry logic               │
│   - Error boundary implementation                          │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Schema Validation (Effect Schema)                 │
│   - Input validation errors at boundaries                  │
│   - Type-safe error transformation                        │
│   - Validation error reporting                            │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Store Layer (Effect Integration)                  │
│   - Effect error propagation to UI                         │
│   - Error state management with $state                    │
│   - Error event emission                                  │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Service Layer (Effect-TS)                         │
│   - Holochain client error handling                        │
│   - Context.Tag dependency injection                       │
│   - Error retry and recovery logic                        │
└─────────────────────────────────────────────────────────────┘
```

## Domain-Specific Error Types

### Error Type Structure
```typescript
// src/lib/errors/service-types.error.ts
import { Data, TaggedError, Context, Effect } from 'effect';
import { HolochainError } from './holochain.error';

// Domain-specific error tag
export const ServiceTypeError = Context.GenericTag<ServiceTypeError>('ServiceTypeError');

// Error type definitions
export class ValidationError extends TaggedError<ServiceTypeError> {
  readonly _tag = 'ValidationError';
  constructor(
    public readonly message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super();
  }
}

export class NotFoundError extends TaggedError<ServiceTypeError> {
  readonly _tag = 'NotFoundError';
  constructor(
    public readonly entity: string,
    public readonly id: string
  ) {
    super();
  }
}

export class UnauthorizedError extends TaggedError<ServiceTypeError> {
  readonly _tag = 'UnauthorizedError';
  constructor(
    public readonly action: string,
    public readonly resource: string
  ) {
    super();
  }
}

export class NetworkError extends TaggedError<ServiceTypeError> {
  readonly _tag = 'NetworkError';
  constructor(
    public readonly cause: HolochainError,
    public readonly retryable: boolean = true
  ) {
    super();
  }
}

export class BusinessRuleError extends TaggedError<ServiceTypeError> {
  readonly _tag = 'BusinessRuleError';
  constructor(
    public readonly rule: string,
    public readonly context: Record<string, unknown>
  ) {
    super();
  }
}

// Union type for all service type errors
export type ServiceTypeError =
  | ValidationError
  | NotFoundError
  | UnauthorizedError
  | NetworkError
  | BusinessRuleError;

// Error to user-friendly message mapping
export const errorToUserMessage = (error: ServiceTypeError): string => {
  switch (error._tag) {
    case 'ValidationError':
      return error.field
        ? `Invalid ${error.field}: ${error.message}`
        : error.message;

    case 'NotFoundError':
      return `The ${error.entity} you're looking for could not be found.`;

    case 'UnauthorizedError':
      return `You don't have permission to ${error.action} this ${error.resource}.`;

    case 'NetworkError':
      return error.retryable
        ? 'Connection issue. Please check your network and try again.'
        : 'Unable to connect to the service. Please try again later.';

    case 'BusinessRuleError':
      return error.context.userMessage || error.rule;

    default:
      return 'An unexpected error occurred. Please try again.';
  }
};
```

### Error Context Management
```typescript
// src/lib/errors/error-context.ts
import { Effect, Context, Layer, Fiber } from 'effect';
import { ToastService } from '../services/toast.service';

export interface ErrorContext {
  readonly showToast: (message: string, type: 'error' | 'warning' | 'info') => Effect.Effect<void>;
  readonly logError: (error: Error, context?: Record<string, unknown>) => Effect.Effect<void>;
  readonly trackError: (error: Error, context: Record<string, unknown>) => Effect.Effect<void>;
}

export const ErrorContext = Context.GenericTag<ErrorContext>('ErrorContext');

export const ErrorContextLive = Layer.effect(
  ErrorContext,
  Effect.gen(function* () {
    const toast = yield* ToastService;

    return {
      showToast: (message: string, type: 'error' | 'warning' | 'info') =>
        toast.show({ message, type, duration: 5000 }),

      logError: (error: Error, context = {}) =>
        Effect.sync(() => {
          console.error('[Error]', error, context);
          // Add logging service integration here
        }),

      trackError: (error: Error, context: Record<string, unknown>) =>
        Effect.sync(() => {
          // Add error tracking service integration here
          console.warn('[Error Tracking]', { error: error.message, context });
        })
    };
  })
);
```

## Component-Level Error Handling

### Error Boundary Component
```svelte
<!-- src/lib/components/shared/ErrorBoundary.svelte -->
<script lang="ts">
  import { setError } from '$app/stores';
  import { Button } from '@skeletonlabs/skeleton';
  import { errorContext } from '$lib/errors/error-context';

  export let error: Error;
  export let reset: () => void;

  $: errorContext = errorContext(error);

  const handleReport = () => {
    // Report error to monitoring service
    console.error('User reported error:', error);
  };

  const handleReset = () => {
    setError(null);
    reset();
  };
</script>

<div class="card bg-error-50-900-token border border-error-200-700-token p-6 rounded-container-token">
  <div class="flex items-start gap-4">
    <div class="flex-shrink-0">
      <svg class="w-6 h-6 text-error-600-400-token" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>

    <div class="flex-1">
      <h3 class="text-lg font-semibold text-error-900-100-token mb-2">
        Something went wrong
      </h3>

      <p class="text-error-700-200-token mb-4">
        {errorContext.userMessage}
      </p>

      {#if errorContext.details}
        <details class="mb-4">
          <summary class="text-sm text-error-600-300-token cursor-pointer hover:text-error-700-200-token">
            Technical Details
          </summary>
          <pre class="mt-2 text-xs text-error-600-300-token bg-error-100-800-token p-2 rounded-container-token overflow-x-auto">
            {errorContext.details}
          </pre>
        </details>
      {/if}

      <div class="flex gap-3">
        <Button variant="filled" onclick={handleReset}>
          Try Again
        </Button>

        {#if errorContext.reportable}
          <Button variant="outline" onclick={handleReport}>
            Report Issue
          </Button>
        {/if}
      </div>
    </div>
  </div>
</div>
```

### Loading and Error States
```svelte
<!-- src/lib/components/shared/AsyncContent.svelte -->
<script lang="ts">
  import { Button } from '@skeletonlabs/skeleton';
  import { LoadingSpinner } from './LoadingSpinner.svelte';

  export let loading = false;
  export let error: Error | null = null;
  export let retry: () => void = () => {};
  export let empty: boolean = false;
  export let emptyMessage = 'No data available';

  $: hasError = error != null;
  $: hasContent = !loading && !hasError && !empty;
</script>

{#if loading}
  <div class="flex items-center justify-center p-8">
    <LoadingSpinner size="md" />
    <span class="ml-3 text-surface-600-400-token">Loading...</span>
  </div>
{:else if hasError}
  <div class="card p-6">
    <div class="text-center">
      <svg class="w-12 h-12 text-error-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>

      <h3 class="text-lg font-semibold text-surface-900-100-token mb-2">
        Unable to load content
      </h3>

      <p class="text-surface-600-400-token mb-4">
        {error?.message || 'An unexpected error occurred'}
      </p>

      <Button variant="filled" onclick={retry}>
        Retry
      </Button>
    </div>
  </div>
{:else if empty}
  <div class="text-center p-8">
    <svg class="w-12 h-12 text-surface-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>

    <p class="text-surface-600-400-token">{emptyMessage}</p>
  </div>
{:else}
  <slot />
{/if}
```

## Store-Level Error Handling

### Effect Integration with Svelte 5 Runes
```typescript
// src/lib/stores/service-types.store.ts
import { Effect, pipe, Option, Either } from 'effect';
import { ServiceTypeService } from '../services/service-types.service';
import { ServiceTypeError, errorToUserMessage } from '../errors/service-types.error';
import { ErrorContext } from '../errors/error-context';

export type ServiceType = {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
};

export const createServiceTypesStore = () => {
  // Reactive state with Svelte 5 runes
  const serviceTypes = $state<ServiceType[]>([]);
  const loading = $state(false);
  const error = $state<ServiceTypeError | null>(null);

  // Load service types with error handling
  const loadServiceTypes = Effect.gen(function* () {
    loading.value = true;
    error.value = null;

    const service = yield* ServiceTypeService;
    const errorContext = yield* ErrorContext;

    return yield* pipe(
      service.getAllServiceTypes(),
      Effect.mapError((e) => {
        // Transform error for UI
        const uiError = e instanceof ServiceTypeError ? e : new NetworkError(e);
        error.value = uiError;

        // Show user-friendly message
        yield* errorContext.showToast(errorToUserMessage(uiError), 'error');

        return uiError;
      }),
      Effect.map((records) => {
        serviceTypes.value = records.map(recordToServiceType);
      }),
      Effect.finally(() => {
        loading.value = false;
      })
    );
  });

  // Create service type with validation error handling
  const createServiceType = (input: { name: string; description?: string }) =>
    Effect.gen(function* () {
      loading.value = true;
      error.value = null;

      const service = yield* ServiceTypeService;
      const errorContext = yield* ErrorContext;

      // Validate input first
      if (!input.name.trim()) {
        const validationError = new ValidationError('Name is required', 'name', input.name);
        error.value = validationError;
        yield* errorContext.showToast(errorToUserMessage(validationError), 'error');
        loading.value = false;
        return;
      }

      return yield* pipe(
        service.createServiceType(input),
        Effect.mapError((e) => {
          const uiError = e instanceof ServiceTypeError ? e : new NetworkError(e);
          error.value = uiError;
          yield* errorContext.showToast(errorToUserMessage(uiError), 'error');
          return uiError;
        }),
        Effect.map((record) => {
          const newServiceType = recordToServiceType(record);
          serviceTypes.value = [...serviceTypes.value, newServiceType];
          return newServiceType;
        }),
        Effect.tap(() =>
          errorContext.showToast('Service type created successfully', 'info')
        ),
        Effect.finally(() => {
          loading.value = false;
        })
      );
    });

  return {
    // Reactive state
    get serviceTypes() { return serviceTypes; },
    get loading() { return loading; },
    get error() { return error; },

    // Actions
    loadServiceTypes: Effect.runPromise(loadServiceTypes),
    createServiceType: (input: { name: string; description?: string }) =>
      Effect.runPromise(createServiceType(input)),

    // Clear error
    clearError: () => { error.value = null; }
  };
};

// Helper function to transform Holochain record to UI model
const recordToServiceType = (record: any): ServiceType => ({
  id: record.signed_action.hashed.hash.toString(),
  name: record.entry.name,
  description: record.entry.description,
  status: record.entry.status,
  createdAt: new Date(record.action().timestamp()),
  updatedAt: new Date(record.action().timestamp())
});
```

## Composable Error Handling

### Error Composable Pattern
```typescript
// src/lib/composables/useErrorHandler.ts
import { Effect, pipe, Option } from 'effect';
import { ErrorContext } from '../errors/error-context';

export interface ErrorHandler {
  handleError: (error: Error, context?: Record<string, unknown>) => void;
  showToast: (message: string, type: 'error' | 'warning' | 'info') => void;
  withErrorHandling: <T>(effect: Effect.Effect<T>) => Promise<Option.Option<T>>;
}

export const useErrorHandler = (): ErrorHandler => {
  const handleError = (error: Error, context = {}) => {
    console.error('[Composable Error]', error, context);

    // Run error context effects
    Effect.runPromise(
      pipe(
        ErrorContext,
        Effect.map(ctx => ctx.logError(error, context))
      )
    );
  };

  const showToast = (message: string, type: 'error' | 'warning' | 'info') => {
    Effect.runPromise(
      pipe(
        ErrorContext,
        Effect.map(ctx => ctx.showToast(message, type))
      )
    );
  };

  const withErrorHandling = async <T>(effect: Effect.Effect<T>) => {
    const result = await Effect.runPromise(
      pipe(
        effect,
        Effect.option,
        Effect.catchAll((error) => {
          handleError(error);
          return Effect.succeed(Option.none());
        })
      )
    );

    return result;
  };

  return {
    handleError,
    showToast,
    withErrorHandling
  };
};
```

### Form Error Handling Composable
```typescript
// src/lib/composables/useFormErrors.ts
import { writable, type Writable } from 'svelte/store';
import { ValidationError } from '../errors/service-types.error';

export interface FormErrors {
  [field: string]: string;
}

export const useFormErrors = () => {
  const errors: Writable<FormErrors> = writable({});

  const setError = (field: string, message: string) => {
    errors.update(current => ({
      ...current,
      [field]: message
    }));
  };

  const clearError = (field: string) => {
    errors.update(current => {
      const { [field]: _, ...rest } = current;
      return rest;
    });
  };

  const clearAllErrors = () => {
    errors.set({});
  };

  const setErrorsFromValidation = (validationErrors: ValidationError[]) => {
    const newErrors: FormErrors = {};
    validationErrors.forEach(error => {
      if (error.field) {
        newErrors[error.field] = error.message;
      }
    });
    errors.set(newErrors);
  };

  const hasErrors = () => {
    let hasAnyErrors = false;
    errors.subscribe(value => {
      hasAnyErrors = Object.keys(value).length > 0;
    })();
    return hasAnyErrors;
  };

  return {
    errors,
    setError,
    clearError,
    clearAllErrors,
    setErrorsFromValidation,
    hasErrors
  };
};
```

## Page-Level Error Handling

### Error Page with Recovery
```svelte
<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { Button } from '@skeletonlabs/skeleton';
  import { onMount } from 'svelte';

  let errorDetails: string | null = null;
  let showDetails = false;

  onMount(() => {
    // Log error for debugging
    console.error('[Page Error]', $page.error);

    // Extract error details for development
    if ($page.error instanceof Error) {
      errorDetails = $page.error.stack || $page.error.message;
    } else {
      errorDetails = JSON.stringify($page.error, null, 2);
    }
  });

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };
</script>

<div class="min-h-screen bg-surface-50-900-token flex items-center justify-center p-4">
  <div class="max-w-md w-full">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-16 h-16 bg-error-100-900-token rounded-full mb-4">
        <svg class="w-8 h-8 text-error-600-400-token" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>

      <h1 class="text-3xl font-bold text-surface-900-100-token mb-2">
        Application Error
      </h1>

      <p class="text-surface-600-400-token">
        Something went wrong while loading this page.
      </p>
    </div>

    <div class="card bg-white dark:bg-surface-800 p-6 rounded-container-token shadow-lg">
      <div class="space-y-4">
        {#if $page.error}
          <div class="bg-error-50-900-token border border-error-200-700-token p-4 rounded-container-token">
            <p class="text-error-800-200-token text-sm">
              {$page.error?.message || 'An unexpected error occurred'}
            </p>
          </div>
        {/if}

        <div class="flex gap-3">
          <Button variant="filled" onclick={handleReload}>
            Reload Page
          </Button>

          <Button variant="outline" onclick={handleGoHome}>
            Go Home
          </Button>
        </div>

        {#if errorDetails}
          <div class="border-t pt-4">
            <button
              class="text-sm text-surface-600-400-token hover:text-surface-900-100-token flex items-center gap-2"
              onclick={() => showDetails = !showDetails}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </button>

            {#if showDetails}
              <div class="mt-4">
                <pre class="text-xs bg-surface-100-800-token p-3 rounded-container-token overflow-x-auto text-surface-700-300-token">
                  {errorDetails}
                </pre>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
```

## Best Practices

### Error Handling Guidelines

#### ✅ **DO:**
- Use domain-specific error types with clear context
- Implement graceful degradation with fallback UI
- Provide clear, actionable error messages to users
- Log errors for debugging and monitoring
- Offer retry mechanisms for transient errors
- Use error boundaries to prevent cascading failures
- Validate input at service boundaries

#### ❌ **DON'T:**
- Show raw error messages to end users
- Swallow errors without proper handling
- Use generic error types without context
- Ignore network errors and retry automatically
- Expose sensitive information in error messages
- Mix business logic with error handling
- Assume all operations will succeed

### Recovery Strategies

1. **Retry Logic**: For transient network errors
2. **Fallback Data**: For failed data fetching
3. **Alternative Flows**: For business rule violations
4. **User Guidance**: For validation errors
5. **Graceful Degradation**: For component failures

### Error Monitoring Integration

```typescript
// src/lib/errors/monitoring.ts
export const setupErrorMonitoring = () => {
  // Global error handler for unhandled errors
  window.addEventListener('error', (event) => {
    console.error('[Global Error]', event.error);
    // Send to monitoring service
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
    // Send to monitoring service
  });
};
```

This comprehensive error handling system ensures robust user experience while maintaining the architectural integrity of the 7-layer Effect-TS pattern with SvelteKit 2, Skeleton UI v2, and TailwindCSS v3.
