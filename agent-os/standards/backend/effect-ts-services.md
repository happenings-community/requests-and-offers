## Effect-TS Service Layer Patterns

This project uses Effect-TS for building robust, type-safe service layers with functional programming patterns. The service layer sits between the Holochain client and the UI stores, providing business logic and error handling.

### Service Architecture Overview

The 7-layer Effect-TS architecture provides:
1. **Service Layer** - Effect-native services with Context.Tag dependency injection
2. **Store Layer** - Svelte 5 Runes with Effect integration
3. **Schema Validation** - Effect Schema at business boundaries
4. **Error Handling** - Domain-specific tagged errors with meaningful contexts
5. **Composables** - Component logic abstraction
6. **Components** - Svelte 5 with accessibility focus
7. **Testing** - Comprehensive Effect-TS coverage

### Service Definition Patterns

#### Context.Tag Service Definition
```typescript
import type { ActionHash, Record } from '@holochain/client';
import { Context, Layer } from 'effect';
import { Effect as E } from 'effect';

// Define the service interface
export interface ServiceTypesService {
  readonly createServiceType: (input: CreateServiceTypeInput) => E.Effect<Record, ServiceTypeError>;
  readonly getServiceType: (hash: ActionHash) => E.Effect<Record | null, ServiceTypeError>;
  readonly updateServiceType: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedServiceType: UpdateServiceTypeInput
  ) => E.Effect<Record, ServiceTypeError>;
  readonly deleteServiceType: (hash: ActionHash) => E.Effect<void, ServiceTypeError>;
  readonly getAllServiceTypes: () => E.Effect<ServiceTypeResponse, ServiceTypeError>;
}

// Create Context.Tag for dependency injection
export class ServiceTypesServiceTag extends Context.Tag('ServiceTypesService')<
  ServiceTypesServiceTag,
  ServiceTypesService
>() {}
```

#### Service Implementation with Dependencies
```typescript
import { HolochainClientServiceTag } from '$lib/services/HolochainClientService.svelte';

export const makeServiceTypesService = E.gen(function* () {
  // Dependency injection through Context.Tag
  const holochainClient = yield* HolochainClientServiceTag;

  // Helper function for zome calls
  const callZome = <T>(zomeName: string, fnName: string, payload: unknown): E.Effect<T, ServiceTypeError> =>
    E.tryPromise({
      try: () => holochainClient.callZome(zomeName, fnName, payload) as Promise<T>,
      catch: (error) => new ServiceTypeError({
        cause: error,
        context: 'zome_call',
        zomeName,
        fnName
      })
    });

  // Business logic methods
  const createServiceType = (input: CreateServiceTypeInput): E.Effect<Record, ServiceTypeError> =>
    pipe(
      callZome<Record>('service_types', 'create_service_type', input),
      E.mapError((error) => new ServiceTypeError({
        cause: error,
        context: 'create_service_type'
      }))
    );

  const getServiceType = (hash: ActionHash): E.Effect<Record | null, ServiceTypeError> =>
    pipe(
      callZome<Record | null>('service_types', 'get_service_type', hash),
      E.mapError((error) => new ServiceTypeError({
        cause: error,
        context: 'get_service_type'
      }))
    );

  const updateServiceType = (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedServiceType: UpdateServiceTypeInput
  ): E.Effect<Record, ServiceTypeError> =>
    pipe(
      callZome<Record>('service_types', 'update_service_type', {
        original_action_hash: originalActionHash,
        previous_action_hash: previousActionHash,
        updated_service_type: updatedServiceType
      }),
      E.mapError((error) => new ServiceTypeError({
        cause: error,
        context: 'update_service_type'
      }))
    );

  const deleteServiceType = (hash: ActionHash): E.Effect<void, ServiceTypeError> =>
    pipe(
      callZome<void>('service_types', 'delete_service_type', hash),
      E.mapError((error) => new ServiceTypeError({
        cause: error,
        context: 'delete_service_type'
      }))
    );

  const getAllServiceTypes = (): E.Effect<ServiceTypeResponse, ServiceTypeError> =>
    pipe(
      callZome<ServiceTypeResponse>('service_types', 'get_all_service_types', null),
      E.mapError((error) => new ServiceTypeError({
        cause: error,
        context: 'get_all_service_types'
      }))
    );

  return {
    createServiceType,
    getServiceType,
    updateServiceType,
    deleteServiceType,
    getAllServiceTypes
  };
});
```

### Layer Creation and Dependency Management

#### Service Layer Definition
```typescript
// Create the service layer with dependencies
export const ServiceTypesServiceLive = Layer.effect(
  ServiceTypesServiceTag,
  makeServiceTypesService
);

// Compose layers for the application
export const ServiceLayers = Layer.merge(
  ServiceTypesServiceLive,
  // Add other service layers here
  OffersServiceLive.pipe(
    Layer.provide(HolochainClientServiceLive)
  )
);
```

#### Layer Composition Pattern
```typescript
// Main application layer composition
export const AppLayer = Layer.mergeAll(
  // Core services
  HolochainClientServiceLive,
  CacheServiceLive,

  // Domain services
  ServiceTypesServiceLive,
  OffersServiceLive,
  RequestsServiceLive,
  UsersServiceLive,

  // Cross-cutting concerns
  LoggingServiceLive,
  ErrorHandlingServiceLive
);
```

### Error Handling Patterns

#### Domain-Specific Error Types
```typescript
import { Data, Effect } from 'effect';

// Base error structure
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  readonly cause: unknown;
  readonly context: string;
  readonly zomeName?: string;
  readonly fnName?: string;
  readonly timestamp: number;
}> {
  constructor(args: {
    cause: unknown;
    context: string;
    zomeName?: string;
    fnName?: string;
  }) {
    super({
      ...args,
      timestamp: Date.now()
    });
  }

  static fromError(error: unknown, context: string, zomeName?: string, fnName?: string): ServiceTypeError {
    return new ServiceTypeError({
      cause: error,
      context,
      zomeName,
      fnName
    });
  }
}

// Error context constants
export const SERVICE_TYPE_CONTEXTS = {
  CREATE_SERVICE_TYPE: 'create_service_type',
  GET_SERVICE_TYPE: 'get_service_type',
  UPDATE_SERVICE_TYPE: 'update_service_type',
  DELETE_SERVICE_TYPE: 'delete_service_type',
  GET_ALL_SERVICE_TYPES: 'get_all_service_types',
  DECODE_SERVICE_TYPES: 'decode_service_types'
} as const;
```

#### Error Mapping and Recovery
```typescript
const createServiceTypeWithErrorHandling = (input: CreateServiceTypeInput): E.Effect<Record, ServiceTypeError> =>
  pipe(
    createServiceType(input),
    E.catchTag('ServiceTypeError', (error) =>
      // Log error and attempt recovery
      pipe(
        Effect.logError(`Service type creation failed: ${error.context}`),
        E.andThen(Effect.fail(error))
      )
    ),
    E.catchAll((unknownError) =>
      Effect.fail(new ServiceTypeError({
        cause: unknownError,
        context: 'create_service_type'
      }))
    )
  );
```

### Schema Validation Patterns

#### Input/Output Schema Definition
```typescript
import { Schema } from 'effect';

// Input schemas
export const CreateServiceTypeInputSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  status: Schema.Literal('Pending', 'Approved', 'Rejected')
});

export const UpdateServiceTypeInputSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
  status: Schema.Literal('Pending', 'Approved', 'Rejected')
});

// Output schemas
export const ServiceTypeRecordSchema = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  created_at: Schema.Number,
  updated_at: Schema.Number,
  status: Schema.Literal('Pending', 'Approved', 'Rejected'),
  original_action_hash: Schema.String,
  previous_action_hash: Schema.String
});

// Response schemas
export const ServiceTypeResponseSchema = Schema.Struct({
  pending: Schema.Array(ServiceTypeRecordSchema),
  approved: Schema.Array(ServiceTypeRecordSchema),
  rejected: Schema.Array(ServiceTypeRecordSchema)
});

// Type inference from schemas
export type CreateServiceTypeInput = typeof CreateServiceTypeInputSchema.Type;
export type UpdateServiceTypeInput = typeof UpdateServiceTypeInputSchema.Type;
export type ServiceTypeRecord = typeof ServiceTypeRecordSchema.Type;
export type ServiceTypeResponse = typeof ServiceTypeResponseSchema.Type;
```

#### Schema Integration in Services
```typescript
const createValidatedServiceType = (input: unknown): E.Effect<Record, ServiceTypeError> =>
  pipe(
    // Decode input using schema
    Schema.decodeUnknown(CreateServiceTypeInputSchema)(input),
    E.mapError((error) => new ServiceTypeError({
      cause: error,
      context: 'input_validation'
    })),
    // Call service with validated input
    E.andThen((validatedInput) => createServiceType(validatedInput))
  );
```

### Async Operations and Concurrency

#### Batch Operations
```typescript
import { Effect, Array } from 'effect';

const createMultipleServiceTypes = (
  inputs: CreateServiceTypeInput[]
): E.Effect<Record[], ServiceTypeError> =>
  pipe(
    inputs,
    Array.forEach((input) => createServiceType(input)),
    Effect.mapError((error) => new ServiceTypeError({
      cause: error,
      context: 'batch_create_service_types'
    }))
  );
```

#### Concurrent Operations
```typescript
import { Effect } from 'effect';

const getServiceTypesWithDetails = (
  hashes: ActionHash[]
): E.Effect<ServiceTypeRecord[], ServiceTypeError> =>
  pipe(
    hashes,
    Effect.forEachConcurrently((hash) => getServiceType(hash)),
    Effect.map((records) => records.filter(Boolean) as ServiceTypeRecord[]),
    Effect.mapError((error) => new ServiceTypeError({
      cause: error,
      context: 'concurrent_get_service_types'
    }))
  );
```

### Caching and Performance

#### Service-Level Caching
```typescript
import { Effect, Ref } from 'effect';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

const createCachedServiceType = (
  cacheRef: Ref.Ref<Map<string, CacheEntry<ServiceTypeRecord>>>
) => {
  const getServiceTypeCached = (hash: ActionHash): E.Effect<ServiceTypeRecord | null, ServiceTypeError> =>
    pipe(
      Effect.gen(function* () {
        const hashString = hash.toString();
        const cache = yield* cacheRef.get();
        const cached = cache.get(hashString);

        // Check cache validity
        if (cached && cached.expiry > Date.now()) {
          return cached.data;
        }

        // Cache miss or expired - fetch from service
        const result = yield* getServiceType(hash);

        if (result) {
          // Update cache
          const cacheEntry: CacheEntry<ServiceTypeRecord> = {
            data: result,
            timestamp: Date.now(),
            expiry: Date.now() + (5 * 60 * 1000) // 5 minutes
          };

          yield* pipe(
            cacheRef,
            Ref.update((cache) => {
              cache.set(hashString, cacheEntry);
              return cache;
            })
          );
        }

        return result;
      })
    );

  return {
    getServiceTypeCached,
    createServiceType: (input: CreateServiceTypeInput): E.Effect<Record, ServiceTypeError> =>
      pipe(
        createServiceType(input),
        Effect.tap((record) =>
          // Invalidate cache on creation
          Effect.sync(() => {
            // Cache invalidation logic
          })
        )
      )
  };
};
```

### Testing Patterns

#### Service Testing with Mocks
```typescript
import { Effect, Layer } from 'effect';
import { describe, it, expect } from 'vitest';

// Mock service implementation
const makeMockServiceTypesService = E.succeed<ServiceTypesService>({
  createServiceType: (input) => Effect.succeed(mockRecord),
  getServiceType: (hash) => Effect.succeed(mockRecord),
  updateServiceType: (original, previous, updated) => Effect.succeed(mockRecord),
  deleteServiceType: (hash) => Effect.void,
  getAllServiceTypes: () => Effect.succeed(mockResponse)
});

// Test layer
const MockServiceTypesServiceLive = Layer.effect(
  ServiceTypesServiceTag,
  makeMockServiceTypesService
);

describe('ServiceTypesService', () => {
  it('should create service type successfully', async () => {
    const result = await pipe(
      E.getServiceTypeWithDependencies((service) =>
        service.createServiceType(mockInput)
      ),
      E.provide(MockServiceTypesServiceLive),
      E.runPromise
    );

    expect(result).toBeDefined();
    expect(result.entry.type).toBe('ServiceType');
  });
});
```

#### Integration Testing
```typescript
describe('Service Integration', () => {
  it('should integrate with Holochain client', async () => {
    const result = await pipe(
      E.getServiceTypeWithDependencies((service) =>
        service.createServiceType(validInput)
      ),
      E.provide(ServiceTypesServiceLive),
      E.provide(HolochainClientServiceLive),
      E.runPromise
    );

    expect(result).toBeDefined();
    // Verify actual Holochain integration
  });
});
```

### Best Practices

#### Service Design Principles
1. **Pure Functions**: Keep service methods pure and side-effect free
2. **Error as Data**: Model errors explicitly using Data.TaggedError
3. **Type Safety**: Use Schema validation at service boundaries
4. **Dependency Injection**: Use Context.Tag for all external dependencies
5. **Composability**: Design services to be composable and reusable
6. **Testing**: Write tests at service level with appropriate mocks

#### Performance Considerations
1. **Batching**: Batch operations where possible to reduce network calls
2. **Caching**: Implement appropriate caching strategies at service level
3. **Concurrency**: Use Effect.forEachConcurrently for independent operations
4. **Resource Management**: Use Effect.acquireRelease for resource cleanup

#### Error Handling Guidelines
1. **Specific Error Types**: Create specific error types for each domain
2. **Error Context**: Include contextual information in errors
3. **Error Recovery**: Implement appropriate error recovery strategies
4. **Logging**: Log errors appropriately for debugging and monitoring

These patterns ensure consistent, robust, and maintainable service layer development using Effect-TS in the project.