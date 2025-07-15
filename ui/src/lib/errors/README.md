# Enhanced Error Management System

This document provides guidance on using the enhanced error management system that leverages your existing Error-TS utilities more effectively.

## Overview

The enhanced system provides:

- **useErrorBoundary composable**: Effect-TS integration with automatic retry, logging, and fallback
- **Standardized error contexts**: Consistent error messaging across domains
- **ErrorDisplay component**: Unified error UI with retry/dismiss actions
- **Toast middleware**: Automatic success/error notifications with UIErrorHandling integration
- **Enhanced composables**: Systematic error handling patterns

## Components

### 1. useErrorBoundary Composable

The error boundary composable provides centralized error handling with Effect-TS integration.

```typescript
import { useErrorBoundary } from '$lib/composables';
import { SERVICE_TYPE_CONTEXTS } from '$lib/errors';

const errorBoundary = useErrorBoundary({
  context: SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE,
  enableLogging: true,
  enableToast: false, // Handle toasts manually
  enableFallback: true,
  maxRetries: 3,
  retryDelay: 1000,
  timeoutMs: 5000
});

// Execute with error handling
const result = await errorBoundary.execute(
  myEffect,
  fallbackValue // optional fallback
);

// Execute with retry
const result = await errorBoundary.executeWithRetry(myEffect);

// Manual retry
await errorBoundary.retry(myEffect);

// Clear errors
errorBoundary.clearError();
```

### 2. Standardized Error Contexts

Use predefined error contexts for consistent messaging:

```typescript
import {
  SERVICE_TYPE_CONTEXTS,
  REQUEST_CONTEXTS,
  USER_CONTEXTS,
  ADMINISTRATION_CONTEXTS
} from '$lib/errors';

// Instead of raw strings, use standardized contexts
const context = SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE;
const context = REQUEST_CONTEXTS.GET_ALL_REQUESTS;
const context = USER_CONTEXTS.UPDATE_USER;
```

### 3. ErrorDisplay Component

Unified error display with consistent UI:

```svelte
<script>
  import ErrorDisplay from '$lib/components/shared/ErrorDisplay.svelte';
</script>

<!-- Basic error display -->
<ErrorDisplay
  error={errorBoundary.state.error}
  showRetry={true}
  onretry={() => retryOperation()}
  ondismiss={() => errorBoundary.clearError()}
/>

<!-- Inline variant with context -->
<ErrorDisplay
  {error}
  context="Loading service types"
  variant="inline"
  size="sm"
  showRetry={true}
  showDismiss={true}
/>

<!-- Banner variant for critical errors -->
<ErrorDisplay {error} variant="banner" size="lg" retryDisabled={isLoading} />
```

### 4. Toast Middleware

Automatic toast notifications with Effect-TS integration:

```typescript
import {
  withToastNotification,
  withErrorToast,
  withSuccessAndErrorToast,
  withFormToast
} from '$lib/utils/errorToastMiddleware';

// Basic error toast
const effect = pipe(myOperation, withErrorToast('Failed to load data'));

// Success and error toasts
const effect = pipe(
  myOperation,
  withSuccessAndErrorToast('Data loaded successfully', 'Failed to load data')
);

// Form operation toasts
const effect = pipe(
  serviceTypesStore.createServiceType(data),
  withFormToast('create', 'Service type')
);

// Custom toast handling
const effect = pipe(
  myOperation,
  withCustomToast({
    onSuccess: (result) => `Created ${result.name} successfully`,
    onError: (error) => `Creation failed: ${error.message}`,
    variant: 'filled',
    duration: 5000
  })
);
```

## Usage Patterns

### In Composables

Enhanced composables should expose error boundaries and use standardized error handling:

```typescript
export function useServiceTypesManagement() {
  // Create error boundaries for different operations
  const loadingErrorBoundary = useErrorBoundary({
    context: SERVICE_TYPE_CONTEXTS.FETCH_SERVICE_TYPES,
    enableLogging: true,
    enableFallback: true,
    maxRetries: 2
  });

  const deleteErrorBoundary = useErrorBoundary({
    context: SERVICE_TYPE_CONTEXTS.DELETE_SERVICE_TYPE,
    enableLogging: true,
    maxRetries: 1
  });

  // Enhanced operations with error handling
  async function loadServiceTypes() {
    const result = await loadingErrorBoundary.execute(
      pipe(
        serviceTypesStore.getApprovedServiceTypes(),
        ErrorHandling.withLogging,
        ErrorHandling.withRetry
      ),
      [] // fallback to empty array
    );

    // Handle error state
    if (loadingErrorBoundary.state.error) {
      state.error = loadingErrorBoundary.state.error.message;
    }
  }

  async function deleteServiceType(hash: ActionHash) {
    await deleteErrorBoundary.execute(
      pipe(
        serviceTypesStore.deleteServiceType(hash),
        withFormToast('delete', 'Service type'),
        ErrorHandling.withLogging
      )
    );
  }

  return {
    // ... other properties
    loadingErrorBoundary,
    deleteErrorBoundary,
    loadServiceTypes,
    deleteServiceType
  };
}
```

### In Components

Components can access error boundaries from composables and display errors:

```svelte
<script>
  import { useServiceTypesManagement } from '$lib/composables';
  import ErrorDisplay from '$lib/components/shared/ErrorDisplay.svelte';

  const {
    serviceTypes,
    loadServiceTypes,
    deleteServiceType,
    loadingErrorBoundary,
    deleteErrorBoundary
  } = useServiceTypesManagement();

  // Handle loading errors
  $effect(() => {
    if (loadingErrorBoundary.state.error) {
      console.error('Service types loading failed:', loadingErrorBoundary.state.error);
    }
  });
</script>

<!-- Error displays for different operations -->
{#if loadingErrorBoundary.state.error}
  <ErrorDisplay
    error={loadingErrorBoundary.state.error}
    context="Loading service types"
    variant="inline"
    showRetry={true}
    onretry={() => loadServiceTypes()}
    ondismiss={() => loadingErrorBoundary.clearError()}
  />
{/if}

{#if deleteErrorBoundary.state.error}
  <ErrorDisplay
    error={deleteErrorBoundary.state.error}
    context="Delete operation"
    variant="inline"
    size="sm"
    ondismiss={() => deleteErrorBoundary.clearError()}
  />
{/if}
```

### Direct Effect Usage

For direct Effect-TS usage without composables:

```typescript
import { ErrorHandling, ErrorRecovery, UIErrorHandling, SERVICE_TYPE_CONTEXTS } from '$lib/errors';

// Enhanced effect with full error handling
const enhancedEffect = pipe(
  myEffect,
  ErrorHandling.withLogging(SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE),
  ErrorHandling.withRetry(3),
  ErrorHandling.withTimeout(5000),
  ErrorRecovery.withFallback(defaultValue),
  withErrorToast('Operation failed')
);

// Execute with proper error handling
const result = await E.runPromise(enhancedEffect);
```

## Best Practices

### 1. Error Boundary Organization

- Create specific error boundaries for different operation types (loading, CRUD operations, etc.)
- Use descriptive contexts from the standardized constants
- Enable appropriate options (logging, toast, fallback) based on operation criticality

### 2. Error Context Usage

- Always use standardized error contexts instead of raw strings
- Create domain-specific contexts for new features
- Use the `createContext()` helper for dynamic contexts

### 3. Error Display Strategy

- Use `ErrorDisplay` component for consistent error UI
- Choose appropriate variants:
  - `inline`: For form and operation errors
  - `banner`: For critical system errors
  - `toast`: For temporary notifications (via middleware)
  - `modal`: For blocking error states

### 4. Fallback Values

- Provide sensible fallback values for non-critical operations
- Use empty arrays/objects for list operations
- Use null for single entity operations where absence is meaningful

### 5. Error Recovery

- Implement retry functionality for network operations
- Provide manual retry options for user-initiated actions
- Clear errors after successful operations

## Migration Guide

### From Raw E.runPromise()

**Before:**

```typescript
try {
  const result = await E.runPromise(myEffect);
  // handle success
} catch (error) {
  console.error('Operation failed:', error);
  toastStore.trigger({
    message: 'Operation failed',
    background: 'variant-filled-error'
  });
}
```

**After:**

```typescript
const errorBoundary = useErrorBoundary({
  context: OPERATION_CONTEXTS.MY_OPERATION,
  enableLogging: true,
  enableToast: false
});

const result = await errorBoundary.execute(pipe(myEffect, withErrorToast('Operation failed')));
```

### From Manual Error Handling

**Before:**

```typescript
let error: string | null = null;
let isLoading = false;

async function loadData() {
  isLoading = true;
  error = null;
  try {
    const data = await E.runPromise(loadEffect);
    // handle success
  } catch (err) {
    error = String(err);
    console.error('Load failed:', err);
  } finally {
    isLoading = false;
  }
}
```

**After:**

```typescript
const loadingErrorBoundary = useErrorBoundary({
  context: DATA_CONTEXTS.LOAD_DATA,
  enableLogging: true,
  maxRetries: 2
});

async function loadData() {
  await loadingErrorBoundary.execute(loadEffect);
}

// Access state via: loadingErrorBoundary.state
```

This enhanced error management system provides a robust, consistent, and user-friendly approach to handling errors throughout your application while leveraging your existing Effect-TS architecture.
