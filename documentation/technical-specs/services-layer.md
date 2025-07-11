# Services Layer Documentation

This document provides a comprehensive overview of the services layer in the Requests and Offers application, which
handles all communication with the Holochain backend.

## Services Architecture

The services layer is built on Effect TS for robust error handling, dependency injection, and asynchronous operations.
It follows a standardized 7-layer pattern that ensures consistency across all domain services.

### Service Organization

```
/services/
├── holochainClient.service.ts           # Base Holochain client service
├── HolochainClientService.svelte.ts     # Svelte integration for Holochain client
├── hrea.service.ts                      # hREA integration service
└── zomes/                               # Domain-specific zome services
    ├── serviceTypes.service.ts          # Service types functionality
    ├── requests.service.ts              # Requests functionality
    ├── offers.service.ts                # Offers functionality
    ├── users.service.ts                 # Users functionality
    ├── organizations.service.ts         # Organizations functionality
    ├── administration.service.ts        # Admin functionality
    ├── mediums-of-exchange.service.ts   # Medium of exchange functionality
    └── projects.service.ts              # Projects functionality
```

## The 7-Layer Effect Service Pattern

All services follow a standardized 7-layer pattern for consistency and maintainability:

### 1. Service Interface Definition

Clearly defines the contract for each service:

```typescript
export interface ServiceTypeService {
    readonly createServiceType: (input: ServiceTypeInput) => E.Effect<Record, ServiceTypeError>;
    readonly getServiceType: (hash: ActionHash) => E.Effect<Record | null, ServiceTypeError>;
    readonly getAllServiceTypes: () => E.Effect<Record[], ServiceTypeError>;
    readonly searchServiceTypes: (query: string) => E.Effect<Record[], ServiceTypeError>;
    readonly approveServiceType: (hash: ActionHash) => E.Effect<Record, ServiceTypeError>;
    readonly rejectServiceType: (hash: ActionHash) => E.Effect<Record, ServiceTypeError>;
    // Other service-specific methods
}
```

### 2. Context Tag for Dependency Injection

Enables clean dependency injection:

```typescript
export class ServiceTypeServiceTag extends Context.Tag('ServiceTypeService')<
    ServiceTypeServiceTag,
    ServiceTypeService
>() {
}
```

### 3. Error Type Definition

Tagged error types with detailed context:

```typescript
export type ServiceTypeError =
    | ServiceTypeNotFoundError
    | ServiceTypeCreationError
    | ServiceTypeApprovalError
    | ServiceTypeRejectionError
    | ServiceTypeSearchError
    | HolochainError;

export class ServiceTypeNotFoundError extends TaggedError<{
    readonly _tag: 'ServiceTypeNotFoundError';
    readonly hash: string;
}>() {
    get message() {
        return `Service type with hash ${this.hash} not found`;
    }
}

// Other error types...
```

### 4. Schema Validation

Rigorous input/output validation:

```typescript
export const ServiceTypeSchema = S.struct({
    name: S.string,
    description: S.string,
    tags: S.array(S.string),
    status: S.enums(['pending', 'approved', 'rejected']),
    createdAt: S.number
});

export type ServiceType = S.Schema.To<typeof ServiceTypeSchema>;
```

### 5. Service Implementation

Concrete implementation using Effect TS:

```typescript
const makeServiceTypeService = (
    client: HolochainClientService
): ServiceTypeService => ({
    createServiceType: (input) =>
        pipe(
            // Validate input
            S.decode(ServiceTypeInputSchema)(input),
            E.mapError(() => new ServiceTypeCreationError({input})),
            E.flatMap(validInput =>
                client.callZomeEffect(
                    'requests_and_offers',
                    'service_types',
                    'create_service_type',
                    validInput
                )
            ),
            E.mapError(err =>
                err instanceof HolochainError
                    ? err
                    : new ServiceTypeCreationError({input, cause: err})
            )
        ),
    // Other methods implementation...
});
```

### 6. Effect Layer Definition

Layer for dependency injection:

```typescript
export const ServiceTypeServiceLive: Layer.Layer<
    ServiceTypeServiceTag,
    never,
    HolochainClientServiceTag
> = Layer.effect(
    ServiceTypeServiceTag,
    Context.get(HolochainClientServiceTag).pipe(
        E.map(client => makeServiceTypeService(client))
    )
);
```

### 7. Unit Tests

Comprehensive testing with mock implementations:

```typescript
describe('ServiceTypeService', () => {
    const mockClient = {
        callZomeEffect: vi.fn()
    } as unknown as HolochainClientService;

    const service = makeServiceTypeService(mockClient);

    beforeEach(() => {
        vi.resetAllMocks();
    });

    test('createServiceType should call the correct zome function', async () => {
        // Test implementation
    });

    // Other tests...
});
```

## Holochain Client Service

The foundation for all zome services is the `HolochainClientService`, which provides standardized methods for
interacting with the Holochain conductor:

```typescript
export interface HolochainClientService {
    readonly callZomeRawEffect: <I, O>(
        dnaName: string,
        zomeName: string,
        fnName: string,
        payload: I
    ) => E.Effect<O, HolochainError>;

    readonly callZomeEffect: <I, O>(
        dnaName: string,
        zomeName: string,
        fnName: string,
        payload: I
    ) => E.Effect<O, HolochainError>;

    // Other utility methods
}
```

Key differences between call methods:

- `callZomeRawEffect`: Direct pass-through to Holochain without schema validation
- `callZomeEffect`: Includes schema validation, error handling, and logging

## Integration with hREA

The application integrates with hREA (Holochain Resource Event Agent) through the `hrea.service.ts` service:

```typescript
export interface HreaService {
    readonly getResourceSpecifications: () => E.Effect<Record[], HreaError>;
    readonly createResourceSpecification: (input: any) => E.Effect<Record, HreaError>;
    // Other hREA-specific methods
}
```

This service provides a standardized interface for working with economic resources, events, and agents in the Holochain
ecosystem.

## Implementation Status

| Service                | Implementation Status | Notes                                     |
|------------------------|-----------------------|-------------------------------------------|
| HolochainClientService | ✅ Complete            | Foundation service with schema validation |
| serviceTypes.service   | ✅ Complete            | Fully standardized with 7-layer pattern   |
| requests.service       | ✅ Complete            | Fully standardized with 7-layer pattern   |
| offers.service         | 🔄 In Progress        | Being updated to 7-layer pattern          |
| users.service          | 📋 Planned            | Needs conversion to Effect architecture   |
| organizations.service  | 📋 Planned            | Needs conversion to Effect architecture   |
| administration.service | 📋 Planned            | Needs conversion to Effect architecture   |

## Best Practices

1. **Effect TS for all async operations**: Avoid mixing Promises and Effects
2. **Tagged errors with context**: Provide meaningful error messages and context
3. **Schema validation**: Validate all inputs and outputs
4. **Clean dependency injection**: Use Context.Tag and Layer pattern
5. **Comprehensive testing**: Test all service methods
6. **Documentation**: Document all service interfaces
7. **Error handling**: Properly map and transform errors

## Working with Services

### Service Usage in Stores

Services are consumed by stores using the Effect TS dependency injection system:

```typescript
export const createServiceTypeStore = (): E.Effect<
    ServiceTypeStore,
    never,
    ServiceTypeServiceTag
> => E.gen(function* () {
    const service = yield* Context.get(ServiceTypeServiceTag);

    // Use service methods to implement store functionality
});
```

### Service Usage in Components

Components should never directly use services. Instead, they should use stores which internally use services:

```typescript
// In a Svelte component
import {serviceTypeStore} from '$lib/stores/serviceTypes.store.svelte';

function handleCreateServiceType(input) {
    serviceTypeStore.createServiceType(input);
}
```

### Adding a New Service Method

To add a new method to a service:

1. Add the method signature to the service interface
2. Implement the method in the service implementation
3. Add appropriate error types
4. Add schema validation if needed
5. Write tests for the new method
6. Update the store to use the new method

### Service Error Handling

All service errors should be properly typed and mapped:

```typescript
export const getAllServiceTypes = (): E.Effect<Record[], ServiceTypeError> =>
    pipe(
        client.callZomeEffect(
            'requests_and_offers',
            'service_types',
            'get_all_service_types',
            null
        ),
        E.mapError(err =>
            err instanceof HolochainError
                ? err
                : new ServiceTypeGetAllError({cause: err})
        )
    );
```
