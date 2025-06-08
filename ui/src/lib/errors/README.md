# Error Management System

This directory contains a centralized error management system for the Requests and Offers application, following Effect TS patterns and functional programming principles.

## Structure

The error system is organized by domain:

- `common.errors.ts` - Common errors used across the application
- `cache.errors.ts` - Errors related to cache operations
- `eventBus.errors.ts` - Errors related to event bus operations
- `requests.errors.ts` - Errors related to request operations
- `offers.errors.ts` - Errors related to offer operations
- `serviceTypes.errors.ts` - Errors related to service type operations
- `users.errors.ts` - Errors related to user operations
- `organizations.errors.ts` - Errors related to organization operations
- `status.errors.ts` - Errors related to status operations
- `utils.ts` - Utility functions for working with errors
- `index.ts` - Exports all errors for easy import

## Usage

### Importing Errors

Always import errors from the index file:

```typescript
import { NavigationError, RequestError } from '$lib/errors';
```

### Creating Tagged Errors

All errors are created using the `Data.TaggedError` pattern from Effect TS:

```typescript
import { Data } from 'effect';

class CustomError extends Data.TaggedError('CustomError')<{
  message: string;
  cause?: unknown;
}> {}
```

### Using Errors with Effect TS

```typescript
import { Effect, pipe } from 'effect';
import * as E from 'effect/Effect';
import { RequestError } from '$lib/errors';

const fetchData = () => 
  pipe(
    E.tryPromise({
      try: () => fetch('/api/data'),
      catch: (error) => 
        new RequestError({
          message: 'Failed to fetch data',
          cause: error
        })
    }),
    E.flatMap((response) => 
      E.tryPromise({
        try: () => response.json(),
        catch: (error) => 
          new RequestError({
            message: 'Failed to parse response',
            cause: error
          })
      })
    )
  );
```

### Error Handling in Components

```typescript
import { Effect, pipe } from 'effect';
import * as E from 'effect/Effect';
import * as O from 'effect/Option';
import { NavigationError, withLoadingState } from '$lib/errors';

// In a Svelte component
let isLoading = $state(false);
let error = $state<Option<NavigationError>>(O.none());
let data = $state<Option<Data>>(O.none());

const loadData = () => {
  pipe(
    fetchData(),
    withLoadingState(
      (loading) => isLoading = loading,
      (err) => error = err
    ),
    E.runPromise
  ).then((result) => {
    if (O.isSome(result)) {
      data = result;
    }
  });
};
```

### Error Utilities

The `utils.ts` file provides helpful functions:

- `toTypedError` - Converts unknown errors to typed errors
- `withUiState` - Wraps effects with UI state management
- `withLoadingState` - Manages loading state for effects
- `createRetryPolicy` - Creates retry policies for effects

## Best Practices

1. **Use Tagged Errors**: Always use the `Data.TaggedError` pattern for type safety and pattern matching.
2. **Include Context**: Include relevant context in errors (IDs, operation types).
3. **Chain with pipe**: Use `pipe` for composing operations with error handling.
4. **Handle Errors Explicitly**: Use `E.catchAll` to handle errors explicitly.
5. **Centralize Error Types**: Import errors from the central system rather than defining them in components.
6. **Use Error Utilities**: Use the provided utility functions for common error handling patterns.
