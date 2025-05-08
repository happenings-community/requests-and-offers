---
trigger: model_decision
description: Coding patterns for Effect TS
globs: src/**/*.ts, src/**/*.svelte
--- 
# Effect Patterns

## Sequential Operations

```typescript
E.gen(function* ($) {
  const a = yield* $(operationA());
  const b = yield* $(operationB(a));
  return b;
});
```

## Parallel Operations

```typescript
E.gen(function* ($) {
  const [resultA, resultB] = yield* $(
    E.all([operationA(), operationB()])
  );
  return combineResults(resultA, resultB);
});
```

## Error Handling

Define structured, tagged errors using `Data.TaggedError` and handle specific error types using `E.catchTag` or `E.catchTags`.

```typescript
import { Data, Effect as E, pipe } from 'effect';
    
// Define tagged errors
// Custom error types using Effect's Data.TaggedError
import { Data } from 'effect';

// Example: Error originating from a Service call
export class RequestError extends Data.TaggedError('RequestError')<{
  readonly message: string;
  readonly cause?: unknown; // Optional underlying cause (e.g., the raw Holochain error)
}> {
  // Optional: Static helper for common error scenarios
  static creationFailure(cause?: unknown) {
    return new RequestError({ message: 'Failed to create request', cause });
  }
  static fetchFailure(id: string, cause?: unknown) {
    return new RequestError({ message: `Failed to fetch request ${id}`, cause });
  }
}

// Example: Error originating from within a Store
export class RequestStoreError extends Data.TaggedError('RequestStoreError')<{
  readonly message: string;
  readonly context?: string; // Optional context where the error occurred
  readonly cause?: unknown;  // Optional underlying cause (could be a RequestError)
}> {
  // Optional: Static helper for adapting other errors
  static fromError(error: unknown, context: string) {
    const message = error instanceof Error ? error.message : String(error);
    // If the cause is already a TaggedError, we might not need to wrap it again,
    // or we might want to preserve its structure. This depends on desired granularity.
    return new RequestStoreError({
      message: `${context}: ${message}`,
      context,
      cause: error
    });
  }
}
type OperationError = NetworkError | ValidationError; // Union of possible errors

// Example operation that might fail
declare function operation(): E.Effect<string, OperationError, never>;

// Handling specific errors
pipe(
  operation(),
  E.catchTag('NetworkError', (error) => {
    console.error(`Network failed with status: ${error.status}`);
    return E.fail(new Error('Network operation failed')); // Or recover with E.succeed
  }),
  E.catchTag('ValidationError', (error) => {
    console.error(`Validation failed for field: ${error.field}`);
    return E.fail(new Error('Invalid input data')); // Or recover
  }),
  // Optional: Catch any remaining/unhandled errors (if OperationError wasn't exhaustive or for mapping)
  E.catchAll((unhandledError) => {
    console.error("An unexpected error occurred:", unhandledError);
    return E.fail(new Error('Operation failed unexpectedly'));
  })
);
```

## State Management

```typescript
function createStore<T, E>() {
  return {
    state: $state(initial),
    operation: (): Effect<never, E, T> =>
      pipe(
        E.gen(function* ($) {
          // operations
        }),
        E.catchAll(handleError),
        E.tap(updateState)
      )
  };
}
```

## Context and Layer (Dependency Injection)

```typescript
// Define a service interface
export interface MyService {
  readonly operation: () => E.Effect<ResultType, ErrorType, never>;
}

// Create a tag for the service
export const MyServiceTag = Context.GenericTag<MyService>("MyService");

// Create a live implementation
export const MyServiceLive = Layer.effect(
  MyServiceTag,
  E.gen(function* ($) {
    // Setup dependencies and state
    const dependency = yield* $(DependencyTag);
    
    // Return implementation
    return MyServiceTag.of({
      operation: () => implementOperation(dependency)
    });
  })
);

// Use the service with dependency injection
const program = E.gen(function* ($) {
  const service = yield* $(MyServiceTag);
  const result = yield* $(service.operation());
  return result;
});

// Provide the implementation
const runtime = pipe(
  program,
  E.provide(MyServiceLive)
);
```

## Event Bus Pattern

```typescript
// 1. Define event map
export type Events = {
  'entity:created': { entity: Entity };
  'entity:updated': { entity: Entity };
  'entity:deleted': { id: string };
};

// 2. Create tag and layer
const EventBusTag = createEventBusTag<Events>('EventBus');
const EventBusLive = createEventBusLiveLayer(EventBusTag);

// 3. Emit events
const createEntity = (): E.Effect<Entity, ErrorType, EventBusService<Events>> =>
  pipe(
    createEntityOperation(),
    E.tap((entity) => 
      E.gen(function* () {
        const eventBus = yield* EventBusTag;
        yield* eventBus.emit('entity:created', { entity });
      })
    ),
    E.provide(EventBusLive)
  );

// 4. Subscribe to events
const setupSubscription = E.gen(function* ($) {
  const eventBus = yield* $(EventBusTag);
  const unsubscribe = yield* $(
    eventBus.on('entity:created', (payload) => {
      handleEntityCreated(payload.entity);
    })
  );
  
  // Return unsubscribe effect for cleanup
  return unsubscribe;
});
```

## Best Practices

- Use `E.gen` for sequential operations
- Use `pipe` for function composition
- Use `E.all` for parallel operations
- Handle errors with `E.catchAll`
- Use `E.tap` for side effects
- Structure operations in clear, linear steps with comments
- Use Context/Layer pattern for dependency injection
- Use the event bus pattern for decoupled communication

## Anti-patterns to Avoid

- Mixing async/await with Effect
- Nested promise chains
- Direct exception throwing
- Mixing different error handling patterns
- Manual dependency tracking instead of using Context/Layer
