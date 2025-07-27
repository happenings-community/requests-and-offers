# Frontend Event System API

Cross-domain event bus for coordinated state management and domain communication.

## Event Architecture

Standardized event system enabling loose coupling between domains while maintaining data consistency.

### Event Type Definitions

```typescript
// Domain event types
type ServiceTypeEvents = {
  'service-types:entity:created': UIServiceType;
  'service-types:entity:updated': UIServiceType;
  'service-types:entity:deleted': ActionHash;
  'service-types:entities:loaded': UIServiceType[];
  'service-types:status:changed': { hash: ActionHash; status: ServiceTypeStatus };
};

type RequestEvents = {
  'requests:entity:created': UIRequest;
  'requests:entity:updated': UIRequest;
  'requests:entity:deleted': ActionHash;
  'requests:entities:loaded': UIRequest[];
  'requests:status:changed': { hash: ActionHash; status: RequestStatus };
};
```

### Event Emission

```typescript
// Store event emission
const eventEmitters = createEventEmitters<UIServiceType>('serviceTypes');

// Usage in store operations
const createEntity = (input: CreateServiceTypeInput) =>
  withLoadingState(
    Effect.gen(function* () {
      const service = yield* ServiceTypeService;
      const newEntity = yield* service.createServiceType(input);
      handleNewRecord(newEntity);
      eventEmitters.entityCreated(newEntity); // Event emission
      return newEntity;
    })
  );
```

### Event Listening

```typescript
// Cross-domain event listening
$effect(() => {
  const unsubscribe = eventBus.on('service-types:entity:updated', (serviceType) => {
    // Update requests that reference this service type
    updateServiceTypeReferences(serviceType);
  });

  return unsubscribe;
});
```

## Event Bus Implementation

**File**: `ui/src/lib/utils/eventBus.effect.ts`

```typescript
export const createEventEmitters = <T>(domain: string) => {
  const entityCreated = (entity: T) => {
    eventBus.emit(`${domain}:entity:created`, entity);
  };
  
  const entityUpdated = (entity: T) => {
    eventBus.emit(`${domain}:entity:updated`, entity);
  };
  
  const entityDeleted = (hash: ActionHash) => {
    eventBus.emit(`${domain}:entity:deleted`, hash);
  };
  
  const entitiesLoaded = (entities: T[]) => {
    eventBus.emit(`${domain}:entities:loaded`, entities);
  };
  
  return { entityCreated, entityUpdated, entityDeleted, entitiesLoaded };
};
```

## Cross-Domain Communication Patterns

### Service Type → Request Synchronization

When service types are updated, requests that reference them are automatically synchronized.

### Request → Offer Coordination

Request and offer lifecycle events coordinate to maintain system consistency.

This event system enables reactive, loosely-coupled domain interactions while maintaining data integrity.