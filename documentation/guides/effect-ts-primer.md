# Effect-TS Primer for Requests & Offers

This guide explains how Effect-TS is used throughout the Requests & Offers project, providing practical patterns and examples specific to our architecture.

## What is Effect-TS?

Effect-TS is a powerful TypeScript library for managing async operations, errors, and dependencies in a functional, composable way. In our project, it serves as the backbone for:

- **Type-safe async operations** across all service layers
- **Dependency injection** for services and contexts
- **Comprehensive error handling** with tagged errors
- **Composable business logic** that's easy to test and maintain

## Why Effect-TS in This Project?

### Before Effect-TS (Traditional Approach)
```typescript
// ❌ Traditional async/await with manual error handling
async function createServiceType(input: CreateServiceTypeInput): Promise<UIServiceType> {
  try {
    const client = await getHolochainClient();
    const record = await client.callZome({
      zome_name: 'service_types',
      fn_name: 'create_service_type',
      payload: input
    });
    
    return createUIServiceType(record);
  } catch (error) {
    console.error('Failed to create service type:', error);
    throw new ServiceTypeError('Failed to create service type', error);
  }
}
```

### With Effect-TS (Our Approach)
```typescript
// ✅ Effect-TS with composable error handling and dependency injection
const createServiceType = (input: CreateServiceTypeInput) =>
  Effect.gen(function* () {
    const client = yield* HolochainClientService;
    const record = yield* client.callZome({
      zome_name: 'service_types', 
      fn_name: 'create_service_type',
      payload: input
    });
    
    return createUIServiceType(record);
  }).pipe(
    Effect.mapError((error) => ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE)),
    Effect.withSpan('ServiceTypeService.createServiceType')
  );
```

**Benefits of Effect-TS approach**:
- **Dependency injection**: Services automatically get their dependencies
- **Composable error handling**: Errors are transformed consistently
- **Type safety**: Full type inference and safety
- **Testability**: Easy to mock dependencies and test logic
- **Observability**: Built-in tracing and telemetry

## Core Effect-TS Patterns in Our Project

### 1. Effect.gen vs .pipe - When to Use Each

#### Use Effect.gen for:

**Dependency Injection**:
```typescript
const serviceOperation = Effect.gen(function* () {
  // Inject dependencies
  const holochainClient = yield* HolochainClientService;
  const serviceTypeService = yield* ServiceTypeService;
  
  // Use services
  const result = yield* serviceTypeService.getAllServiceTypes();
  return result;
});
```

**Sequential Operations with Conditional Logic**:
```typescript
const complexOperation = Effect.gen(function* () {
  const user = yield* getCurrentUser();
  
  if (user.role === 'admin') {
    const adminData = yield* getAdminData();
    return yield* processAdminData(adminData);
  } else {
    const userData = yield* getUserData(user.id);
    return yield* processUserData(userData);
  }
});
```

**Error Handling Within Operations**:
```typescript
const resilientOperation = Effect.gen(function* () {
  const primaryResult = yield* primaryOperation().pipe(
    Effect.catchAll(() => fallbackOperation())
  );
  
  const processed = yield* processResult(primaryResult);
  return processed;
});
```

#### Use .pipe for:

**Error Transformation**:
```typescript
const withErrorHandling = operation.pipe(
  Effect.mapError((error) => ServiceTypeError.fromError(error, context)),
  Effect.catchAll((error) => Effect.succeed(defaultValue))
);
```

**Operation Composition**:
```typescript
const composedOperation = baseOperation.pipe(
  Effect.map(result => transformResult(result)),
  Effect.flatMap(transformed => validateResult(transformed)),
  Effect.withSpan('composedOperation'),
  Effect.timeout('10 seconds')
);
```

**Layer Building**:
```typescript
const ServiceTypeServiceLive = Layer.effect(
  ServiceTypeService,
  makeServiceTypeService
).pipe(
  Layer.provide(HolochainClientServiceLive)
);
```

### 2. Service Layer Pattern with Dependency Injection

Our services use Effect's Context system for dependency injection:

```typescript
// 1. Define the service interface
export interface ServiceTypeService {
  readonly createServiceType: (input: CreateServiceTypeInput) => Effect.Effect<UIServiceType, ServiceTypeError>;
  readonly getAllServiceTypes: () => Effect.Effect<UIServiceType[], ServiceTypeError>;
  readonly updateServiceType: (hash: ActionHash, input: UpdateServiceTypeInput) => Effect.Effect<UIServiceType, ServiceTypeError>;
  readonly deleteServiceType: (hash: ActionHash) => Effect.Effect<void, ServiceTypeError>;
}

// 2. Create the service tag for dependency injection
export const ServiceTypeService = Context.GenericTag<ServiceTypeService>("ServiceTypeService");

// 3. Implement the service with dependencies
export const makeServiceTypeService = Effect.gen(function* () {
  // Inject HolochainClient dependency
  const client = yield* HolochainClientService;

  const createServiceType = (input: CreateServiceTypeInput) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'service_types',
        fn_name: 'create_service_type', 
        payload: input
      });
      
      return createUIServiceType(record);
    }).pipe(
      Effect.mapError((error) => ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE)),
      Effect.withSpan('ServiceTypeService.createServiceType')
    );

  const getAllServiceTypes = () =>
    Effect.gen(function* () {
      const records = yield* client.callZome({
        zome_name: 'service_types',
        fn_name: 'get_all_service_types',
        payload: null
      });
      
      return records
        .map(createUIServiceType)
        .filter((serviceType): serviceType is UIServiceType => serviceType !== null);
    }).pipe(
      Effect.mapError((error) => ServiceTypeError.fromError(error, SERVICE_TYPE_CONTEXTS.GET_ALL_SERVICE_TYPES)),
      Effect.withSpan('ServiceTypeService.getAllServiceTypes')
    );

  return { createServiceType, getAllServiceTypes, updateServiceType, deleteServiceType };
});

// 4. Create the service layer for dependency injection
export const ServiceTypeServiceLive = Layer.effect(
  ServiceTypeService,
  makeServiceTypeService
).pipe(
  Layer.provide(HolochainClientServiceLive)
);
```

### 3. Store Integration with Svelte 5 Runes

Our stores combine Effect-TS operations with Svelte 5 Runes for reactivity:

```typescript
// ui/src/lib/stores/serviceTypes.store.svelte.ts
export const createServiceTypesStore = () => {
  // Svelte 5 Runes for reactive state
  let entities = $state<UIServiceType[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Effect-TS operations that update reactive state
  const fetchEntities = Effect.gen(function* () {
    const serviceTypeService = yield* ServiceTypeService;
    
    isLoading = true;
    error = null;
    
    const result = yield* serviceTypeService.getAllServiceTypes();
    entities = mapRecordsToUIEntities(result);
    
    isLoading = false;
    return entities;
  }).pipe(
    Effect.catchAll((err) => Effect.sync(() => {
      error = err.message;
      isLoading = false;
      return [];
    }))
  );

  const createEntity = (input: CreateServiceTypeInput) =>
    Effect.gen(function* () {
      const serviceTypeService = yield* ServiceTypeService;
      
      isLoading = true;
      error = null;
      
      const newEntity = yield* serviceTypeService.createServiceType(input);
      entities = [...entities, newEntity];
      
      isLoading = false;
      return newEntity;
    }).pipe(
      Effect.catchAll((err) => Effect.sync(() => {
        error = err.message;
        isLoading = false;
        throw err;
      }))
    );

  return {
    // Reactive state accessors
    entities: () => entities,
    isLoading: () => isLoading,
    error: () => error,
    
    // Effect operations
    fetchEntities,
    createEntity
  };
};
```

### 4. Error Handling with Tagged Errors

Our error handling uses Effect's tagged error system:

```typescript
// Domain-specific error class
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly serviceTypeId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    serviceTypeId?: string,
    operation?: string
  ): ServiceTypeError {
    const message = error instanceof Error ? error.message : String(error);
    return new ServiceTypeError({
      message,
      cause: error,
      context,
      serviceTypeId,
      operation
    });
  }
}

// Usage in service operations
const createServiceType = (input: CreateServiceTypeInput) =>
  Effect.gen(function* () {
    // ... operation logic
  }).pipe(
    Effect.mapError((error) => ServiceTypeError.fromError(
      error, 
      SERVICE_TYPE_CONTEXTS.CREATE_SERVICE_TYPE,
      undefined,
      'create'
    )),
    Effect.withSpan('ServiceTypeService.createServiceType')
  );
```

### 5. Effect Execution in Svelte Components

Components execute Effects through composables:

```typescript
// ui/src/lib/composables/domain/service-types/useServiceTypesManagement.svelte.ts
export function useServiceTypesManagement() {
  const store = createServiceTypesStore();
  
  const errorBoundary = useErrorBoundary({
    context: SERVICE_TYPE_CONTEXTS.FETCH_SERVICE_TYPES,
    enableLogging: true,
    maxRetries: 2
  });

  // Execute Effect operations with error boundary
  const loadServiceTypes = async () => {
    await errorBoundary.execute(store.fetchEntities, []);
  };

  const createServiceType = async (input: CreateServiceTypeInput) => {
    await errorBoundary.execute(store.createEntity(input));
  };

  return {
    // Reactive state
    serviceTypes: store.entities,
    isLoading: store.isLoading,
    error: store.error,
    
    // Actions
    loadServiceTypes,
    createServiceType,
    
    // Error boundary
    errorBoundary
  };
}
```

```svelte
<!-- Components use composables to access Effect operations -->
<script>
  import { useServiceTypesManagement } from '$lib/composables';
  
  const {
    serviceTypes,
    isLoading,
    loadServiceTypes,
    createServiceType,
    errorBoundary
  } = useServiceTypesManagement();

  // Execute Effect on mount
  $effect(() => {
    loadServiceTypes();
  });
  
  async function handleCreate(input) {
    await createServiceType(input);
  }
</script>
```

## Advanced Effect-TS Patterns

### 1. Effect Composition and Pipelines

```typescript
// Complex operation pipeline
const processServiceTypeWithValidation = (input: CreateServiceTypeInput) =>
  Effect.gen(function* () {
    // Step 1: Validate input
    const validatedInput = yield* validateServiceTypeInput(input);
    
    // Step 2: Check for duplicates
    const existingTypes = yield* serviceTypeService.getAllServiceTypes();
    const isDuplicate = existingTypes.some(st => st.name === validatedInput.name);
    
    if (isDuplicate) {
      yield* Effect.fail(ServiceTypeError.create('Service type name already exists'));
    }
    
    // Step 3: Create service type
    const newServiceType = yield* serviceTypeService.createServiceType(validatedInput);
    
    // Step 4: Update cache
    yield* updateServiceTypeCache(newServiceType);
    
    return newServiceType;
  }).pipe(
    Effect.withSpan('processServiceTypeWithValidation'),
    Effect.timeout('30 seconds')
  );
```

### 2. Retry and Resilience Patterns

```typescript
// Operation with retry and fallback
const resilientFetch = Effect.gen(function* () {
  const serviceTypeService = yield* ServiceTypeService;
  return yield* serviceTypeService.getAllServiceTypes();
}).pipe(
  // Retry with exponential backoff
  Effect.retry(
    pipe(
      Schedule.exponential('500 millis'),
      Schedule.intersect(Schedule.recurs(3))
    )
  ),
  // Fallback to cached data
  Effect.catchAll(() => getCachedServiceTypes()),
  // Final fallback to empty array
  Effect.catchAll(() => Effect.succeed([]))
);
```

### 3. Concurrent Operations

```typescript
// Run multiple operations concurrently
const loadAllDomainData = Effect.gen(function* () {
  const [serviceTypes, requests, offers] = yield* Effect.all([
    serviceTypeService.getAllServiceTypes(),
    requestService.getAllRequests(), 
    offerService.getAllOffers()
  ], { concurrency: 3 });

  return { serviceTypes, requests, offers };
}).pipe(
  Effect.withSpan('loadAllDomainData')
);
```

### 4. Resource Management

```typescript
// Automatic resource cleanup
const withDatabaseConnection = <T>(
  operation: (connection: DatabaseConnection) => Effect.Effect<T, DatabaseError>
) =>
  Effect.acquireUseRelease(
    openDatabaseConnection(),
    operation,
    (connection) => closeDatabaseConnection(connection)
  );
```

## Testing with Effect-TS

Our testing approach leverages Effect's testing utilities:

```typescript
// ui/tests/unit/services/serviceTypes.service.test.ts
import { describe, it, expect } from 'vitest';
import { Effect, Layer, TestServices } from 'effect';
import { makeServiceTypeService, ServiceTypeService } from '$lib/services';

describe('ServiceTypeService', () => {
  it('should create service type successfully', async () => {
    // Create mock layer
    const MockHolochainClientService = Layer.succeed(
      HolochainClientService,
      {
        callZome: () => Effect.succeed(mockRecord)
      }
    );

    // Create test layer with mock dependencies
    const TestServiceTypeServiceLive = Layer.provide(
      ServiceTypeServiceLive,
      MockHolochainClientService
    );

    // Run test
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ServiceTypeService;
        return yield* service.createServiceType(mockInput);
      }).pipe(
        Effect.provide(TestServiceTypeServiceLive)
      )
    );

    expect(result.name).toBe(mockInput.name);
  });
});
```

## Performance Considerations

### 1. Effect Caching

```typescript
// Cache expensive operations
const getCachedServiceTypes = Effect.gen(function* () {
  const cache = yield* CacheService;
  const cached = yield* cache.get('service-types');
  
  if (cached) {
    return cached;
  }
  
  const serviceTypes = yield* serviceTypeService.getAllServiceTypes();
  yield* cache.set('service-types', serviceTypes, '5 minutes');
  
  return serviceTypes;
});
```

### 2. Lazy Evaluation

```typescript
// Lazy service creation
const lazyServiceTypeService = Effect.lazy(() =>
  Effect.gen(function* () {
    const client = yield* HolochainClientService;
    return makeServiceTypeService(client);
  })
);
```

## Best Practices

### 1. Service Design
- **Single Responsibility**: Each service handles one domain
- **Dependency Injection**: Use Context.Tag for all dependencies
- **Error Consistency**: Transform all errors to domain-specific types
- **Telemetry**: Add spans for observability

### 2. Store Integration
- **Reactive State**: Use Svelte 5 Runes for component reactivity
- **Effect Operations**: Keep async logic in Effect operations
- **Error Handling**: Provide loading and error states
- **Cache Management**: Implement TTL-based caching

### 3. Component Usage
- **Composables**: Use composables to abstract Effect operations
- **Error Boundaries**: Implement proper error boundaries
- **Loading States**: Always provide loading feedback
- **Clean Architecture**: Keep Effect logic out of components

### 4. Testing
- **Mock Dependencies**: Use Layer.succeed for mocking
- **Test Isolation**: Each test should have independent state
- **Error Testing**: Test both success and failure scenarios
- **Integration Testing**: Test service interactions

## Common Patterns Reference

### Service Creation Pattern
```typescript
export const makeMyService = Effect.gen(function* () {
  const dependency = yield* DependencyService;
  
  const operation = (input: Input) =>
    Effect.gen(function* () {
      // Implementation
    }).pipe(
      Effect.mapError(error => MyError.fromError(error, context)),
      Effect.withSpan('MyService.operation')
    );
    
  return { operation };
});
```

### Store Operation Pattern
```typescript
const storeOperation = Effect.gen(function* () {
  const service = yield* MyService;
  
  isLoading = true;
  error = null;
  
  const result = yield* service.operation(input);
  entities = processResult(result);
  
  isLoading = false;
  return result;
}).pipe(
  Effect.catchAll((err) => Effect.sync(() => {
    error = err.message;
    isLoading = false;
    throw err;
  }))
);
```

### Error Handling Pattern
```typescript
const operation = Effect.gen(function* () {
  // Operation logic
}).pipe(
  Effect.mapError(error => DomainError.fromError(error, context)),
  Effect.retry(Schedule.exponential('1 second')),
  Effect.catchAll(error => Effect.succeed(fallbackValue)),
  Effect.withSpan('operation-name')
);
```

## Next Steps

1. **Study Examples**: Examine service-types, requests, and offers services for complete examples
2. **Practice Patterns**: Try implementing a simple service following these patterns
3. **Read Effect Docs**: Visit [effect.website](https://effect.website) for comprehensive documentation
4. **Join Community**: Connect with Effect-TS community for advanced patterns

This primer provides the foundation for working with Effect-TS in our project. The patterns shown here are used consistently across all domains to ensure maintainable, type-safe, and composable code.