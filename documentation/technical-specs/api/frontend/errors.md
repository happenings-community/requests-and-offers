# Frontend Error Handling API

Comprehensive error handling system using Effect-TS tagged errors with domain-specific contexts.

## Error Architecture

The application uses a standardized tagged error system with domain-specific error types and centralized error contexts.

### Base Error Pattern

```typescript
import { Data } from 'effect';

export class DomainError extends Data.TaggedError('DomainError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly entityId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    entityId?: string,
    operation?: string
  ): DomainError {
    const message = error instanceof Error ? error.message : String(error);
    return new DomainError({
      message,
      cause: error,
      context,
      entityId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    entityId?: string,
    operation?: string
  ): DomainError {
    return new DomainError({
      message,
      context,
      entityId,
      operation
    });
  }
}
```

## Domain-Specific Errors

### Service Type Errors

**File**: `ui/src/lib/errors/service-type.errors.ts`

```typescript
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly entityId?: string;
  readonly operation?: string;
}> { /* Implementation */ }

export const SERVICE_TYPE_CONTEXTS = {
  CREATE_SERVICE_TYPE: 'Failed to create service type',
  GET_SERVICE_TYPE: 'Failed to get service type',
  UPDATE_SERVICE_TYPE: 'Failed to update service type',
  DELETE_SERVICE_TYPE: 'Failed to delete service type',
  GET_ALL_SERVICE_TYPES: 'Failed to fetch service types',
  APPROVE_SERVICE_TYPE: 'Failed to approve service type',
  REJECT_SERVICE_TYPE: 'Failed to reject service type',
  SEARCH_SERVICE_TYPES: 'Failed to search service types'
} as const;
```

### Request Errors

Similar pattern for request-specific error handling with appropriate contexts.

### Error Context Management

**File**: `ui/src/lib/errors/error-contexts.ts`

Centralized error contexts for consistent error messaging across the application.

## Error Boundary System

### Composable Error Boundaries

```typescript
export function useErrorBoundary(config: ErrorBoundaryConfig) {
  let state = $state({
    error: null as DomainError | null,
    isRetrying: false,
    retryCount: 0
  });

  const execute = async <T>(operation: Effect.Effect<T, DomainError>) => {
    // Error handling implementation with retry logic
  };

  return { state, execute, clearError, retry };
}
```

### Component Error Display

Error boundaries integrate with UI components for consistent error display and user feedback.

This error handling system ensures robust error management across all layers of the application.