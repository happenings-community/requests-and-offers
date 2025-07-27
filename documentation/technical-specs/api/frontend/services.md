# Frontend Services API

Complete API reference for Effect-TS service layer implementations across all domains.

## Service Architecture

All services follow the standardized Effect-TS pattern with dependency injection using Context.Tag.

### Base Service Interface Pattern

```typescript
export interface DomainService {
  readonly createEntity: (input: CreateEntityInput) => Effect.Effect<UIEntity, DomainError>;
  readonly getAllEntities: () => Effect.Effect<UIEntity[], DomainError>;
  readonly getEntity: (hash: ActionHash) => Effect.Effect<UIEntity | null, DomainError>;
  readonly updateEntity: (hash: ActionHash, input: UpdateEntityInput) => Effect.Effect<UIEntity, DomainError>;
  readonly deleteEntity: (hash: ActionHash) => Effect.Effect<void, DomainError>;
}
```

### Service Implementation Pattern

```typescript
export const makeDomainService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createEntity = (input: CreateEntityInput) =>
    Effect.gen(function* () {
      const record = yield* client.callZome({
        zome_name: 'domain',
        fn_name: 'create_entity',
        payload: input
      });
      
      const entity = createUIEntity(record);
      if (!entity) {
        yield* Effect.fail(DomainError.create('Failed to create UI entity from record'));
      }
      
      return entity;
    }).pipe(
      Effect.mapError((error) => DomainError.fromError(error, DOMAIN_CONTEXTS.CREATE_ENTITY)),
      Effect.withSpan('DomainService.createEntity')
    );

  return { createEntity /* ... other methods */ };
});
```

## Domain Services

### Service Types Service

**File**: `ui/src/lib/services/zomes/serviceTypes.service.ts`

#### Interface
```typescript
export interface ServiceTypeService {
  readonly createServiceType: (input: CreateServiceTypeInput) => Effect.Effect<UIServiceType, ServiceTypeError>;
  readonly getAllServiceTypes: () => Effect.Effect<UIServiceType[], ServiceTypeError>;
  readonly getServiceType: (hash: ActionHash) => Effect.Effect<UIServiceType | null, ServiceTypeError>;
  readonly updateServiceType: (hash: ActionHash, input: UpdateServiceTypeInput) => Effect.Effect<UIServiceType, ServiceTypeError>;
  readonly deleteServiceType: (hash: ActionHash) => Effect.Effect<void, ServiceTypeError>;
  readonly approveServiceType: (hash: ActionHash) => Effect.Effect<UIServiceType, ServiceTypeError>;
  readonly rejectServiceType: (hash: ActionHash) => Effect.Effect<UIServiceType, ServiceTypeError>;
  readonly searchServiceTypes: (query: string) => Effect.Effect<UIServiceType[], ServiceTypeError>;
  readonly getServiceTypesByTag: (tag: string) => Effect.Effect<UIServiceType[], ServiceTypeError>;
}
```

#### Usage
```typescript
// Dependency injection
export const ServiceTypeService = Context.GenericTag<ServiceTypeService>("ServiceTypeService");

// Layer definition
export const ServiceTypeServiceLive = Layer.effect(
  ServiceTypeService,
  makeServiceTypeService
).pipe(
  Layer.provide(HolochainClientServiceLive)
);

// Usage in stores or composables
const serviceTypes = await Effect.runPromise(
  Effect.gen(function* () {
    const service = yield* ServiceTypeService;
    return yield* service.getAllServiceTypes();
  }).pipe(
    Effect.provide(ServiceTypeServiceLive)
  )
);
```

### Requests Service

**File**: `ui/src/lib/services/zomes/requests.service.ts`

#### Interface
```typescript
export interface RequestService {
  readonly createRequest: (input: CreateRequestInput) => Effect.Effect<UIRequest, RequestError>;
  readonly getAllRequests: () => Effect.Effect<UIRequest[], RequestError>;
  readonly getRequest: (hash: ActionHash) => Effect.Effect<UIRequest | null, RequestError>;
  readonly updateRequest: (hash: ActionHash, input: UpdateRequestInput) => Effect.Effect<UIRequest, RequestError>;
  readonly deleteRequest: (hash: ActionHash) => Effect.Effect<void, RequestError>;
  readonly fulfillRequest: (hash: ActionHash) => Effect.Effect<UIRequest, RequestError>;
  readonly closeRequest: (hash: ActionHash) => Effect.Effect<UIRequest, RequestError>;
  readonly searchRequests: (query: string) => Effect.Effect<UIRequest[], RequestError>;
  readonly getRequestsByServiceType: (serviceTypeHash: ActionHash) => Effect.Effect<UIRequest[], RequestError>;
}
```

### Offers Service

**File**: `ui/src/lib/services/zomes/offers.service.ts`

#### Interface
```typescript
export interface OfferService {
  readonly createOffer: (input: CreateOfferInput) => Effect.Effect<UIOffer, OfferError>;
  readonly getAllOffers: () => Effect.Effect<UIOffer[], OfferError>;
  readonly getOffer: (hash: ActionHash) => Effect.Effect<UIOffer | null, OfferError>;
  readonly updateOffer: (hash: ActionHash, input: UpdateOfferInput) => Effect.Effect<UIOffer, OfferError>;
  readonly deleteOffer: (hash: ActionHash) => Effect.Effect<void, OfferError>;
  readonly acceptOffer: (hash: ActionHash) => Effect.Effect<UIOffer, OfferError>;
  readonly closeOffer: (hash: ActionHash) => Effect.Effect<UIOffer, OfferError>;
  readonly searchOffers: (query: string) => Effect.Effect<UIOffer[], OfferError>;
  readonly getOffersByServiceType: (serviceTypeHash: ActionHash) => Effect.Effect<UIOffer[], OfferError>;
}
```

### Users Service

**File**: `ui/src/lib/services/zomes/users.service.ts`

#### Interface
```typescript
export interface UsersService {
  readonly createUser: (input: CreateUserInput) => Effect.Effect<UIUser, UserError>;
  readonly getAllUsers: () => Effect.Effect<UIUser[], UserError>;
  readonly getUser: (hash: ActionHash) => Effect.Effect<UIUser | null, UserError>;
  readonly updateUser: (hash: ActionHash, input: UpdateUserInput) => Effect.Effect<UIUser, UserError>;
  readonly deleteUser: (hash: ActionHash) => Effect.Effect<void, UserError>;
  readonly getUserProfile: (agentHash: AgentPubKey) => Effect.Effect<UIUser | null, UserError>;
  readonly searchUsers: (query: string) => Effect.Effect<UIUser[], UserError>;
}
```

### Organizations Service

**File**: `ui/src/lib/services/zomes/organizations.service.ts`

#### Interface
```typescript
export interface OrganizationService {
  readonly createOrganization: (input: CreateOrganizationInput) => Effect.Effect<UIOrganization, OrganizationError>;
  readonly getAllOrganizations: () => Effect.Effect<UIOrganization[], OrganizationError>;
  readonly getOrganization: (hash: ActionHash) => Effect.Effect<UIOrganization | null, OrganizationError>;
  readonly updateOrganization: (hash: ActionHash, input: UpdateOrganizationInput) => Effect.Effect<UIOrganization, OrganizationError>;
  readonly deleteOrganization: (hash: ActionHash) => Effect.Effect<void, OrganizationError>;
  readonly addMember: (orgHash: ActionHash, userHash: ActionHash) => Effect.Effect<void, OrganizationError>;
  readonly removeMember: (orgHash: ActionHash, userHash: ActionHash) => Effect.Effect<void, OrganizationError>;
  readonly searchOrganizations: (query: string) => Effect.Effect<UIOrganization[], OrganizationError>;
}
```

### Administration Service

**File**: `ui/src/lib/services/zomes/administration.service.ts`

#### Interface
```typescript
export interface AdministrationService {
  readonly promoteToAdmin: (userHash: ActionHash) => Effect.Effect<void, AdministrationError>;
  readonly demoteFromAdmin: (userHash: ActionHash) => Effect.Effect<void, AdministrationError>;
  readonly promoteToModerator: (userHash: ActionHash) => Effect.Effect<void, AdministrationError>;
  readonly demoteFromModerator: (userHash: ActionHash) => Effect.Effect<void, AdministrationError>;
  readonly suspendUser: (userHash: ActionHash, reason: string) => Effect.Effect<void, AdministrationError>;
  readonly unsuspendUser: (userHash: ActionHash) => Effect.Effect<void, AdministrationError>;
  readonly getAllAdmins: () => Effect.Effect<UIUser[], AdministrationError>;
  readonly getAllModerators: () => Effect.Effect<UIUser[], AdministrationError>;
  readonly getAllSuspendedUsers: () => Effect.Effect<UIUser[], AdministrationError>;
}
```

## Base Services

### Holochain Client Service

**File**: `ui/src/lib/services/HolochainClientService.svelte.ts`

#### Interface
```typescript
export interface HolochainClientService {
  readonly callZome: <T>(args: CallZomeRequest) => Effect.Effect<T, HolochainError>;
  readonly callZomeRaw: <T>(args: CallZomeRequest) => Effect.Effect<T, HolochainError>;
  readonly adminClient: () => AdminWebsocket;
  readonly appClient: () => AppWebsocket;
  readonly isConnected: () => boolean;
  readonly disconnect: () => Effect.Effect<void, never>;
  readonly reconnect: () => Effect.Effect<void, HolochainError>;
}
```

#### Usage
```typescript
export const HolochainClientService = Context.GenericTag<HolochainClientService>("HolochainClientService");

// Usage in domain services
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* HolochainClientService;
    return yield* client.callZome({
      zome_name: 'service_types',
      fn_name: 'get_all_service_types',
      payload: null
    });
  }).pipe(
    Effect.provide(HolochainClientServiceLive)
  )
);
```

### hREA Service

**File**: `ui/src/lib/services/hrea.service.ts`

#### Interface
```typescript
export interface HreaService {
  readonly getResourceSpecifications: () => Effect.Effect<ResourceSpecification[], HreaError>;
  readonly createResourceSpecification: (input: CreateResourceSpecificationInput) => Effect.Effect<ResourceSpecification, HreaError>;
  readonly updateResourceSpecification: (id: string, input: UpdateResourceSpecificationInput) => Effect.Effect<ResourceSpecification, HreaError>;
  readonly deleteResourceSpecification: (id: string) => Effect.Effect<void, HreaError>;
  readonly getIntents: () => Effect.Effect<Intent[], HreaError>;
  readonly createIntent: (input: CreateIntentInput) => Effect.Effect<Intent, HreaError>;
}
```

## Error Handling

All services use domain-specific tagged errors following the pattern:

```typescript
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
}
```

## Common Patterns

### Effect.gen vs .pipe Usage

**Use Effect.gen for**:
- Dependency injection
- Sequential operations
- Conditional logic
- Complex business logic

**Use .pipe for**:
- Error handling and transformation
- Adding spans and tracing
- Simple transformations
- Layer composition

### Service Composition

```typescript
// Composing multiple services
const complexOperation = Effect.gen(function* () {
  const serviceTypeService = yield* ServiceTypeService;
  const requestService = yield* RequestService;
  
  const serviceType = yield* serviceTypeService.getServiceType(serviceTypeHash);
  if (!serviceType) {
    yield* Effect.fail(DomainError.create('Service type not found'));
  }
  
  return yield* requestService.createRequest({
    ...requestInput,
    serviceTypeHash
  });
});
```

### Error Context Usage

```typescript
// Using standardized error contexts
export const DOMAIN_CONTEXTS = {
  CREATE_ENTITY: 'Failed to create entity',
  GET_ENTITY: 'Failed to get entity',
  UPDATE_ENTITY: 'Failed to update entity',
  DELETE_ENTITY: 'Failed to delete entity',
  GET_ALL_ENTITIES: 'Failed to fetch entities'
} as const;

// Apply in service methods
const result = operation.pipe(
  Effect.mapError((error) => DomainError.fromError(error, DOMAIN_CONTEXTS.CREATE_ENTITY, input.id)),
  Effect.withSpan('DomainService.createEntity')
);
```

## Testing Services

```typescript
describe('DomainService', () => {
  it('should create entity with proper error handling', async () => {
    const MockHolochainClient = Layer.succeed(HolochainClientService, {
      callZome: () => Effect.succeed(mockRecord)
    });

    const TestDomainServiceLive = Layer.provide(
      DomainServiceLive,
      MockHolochainClient
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* DomainService;
        return yield* service.createEntity(mockInput);
      }).pipe(Effect.provide(TestDomainServiceLive))
    );

    expect(result.name).toBe(mockInput.name);
  });
});
```

This service layer provides the foundation for all data operations in the application, with consistent patterns for error handling, dependency injection, and Effect-TS integration.