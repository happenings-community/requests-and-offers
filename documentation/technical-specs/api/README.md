# API Documentation

Comprehensive API documentation for the Requests & Offers application, covering both frontend and backend interfaces.

## Documentation Structure

### Frontend APIs
- **[Services](./frontend/services.md)**: Effect-TS service layer APIs for all domains
- **[Stores](./frontend/stores.md)**: Svelte store APIs with 9 standardized helper functions
- **[Composables](./frontend/composables.md)**: Business logic composable APIs
- **[Error Handling](./frontend/errors.md)**: Tagged error system and error contexts
- **[Schema Validation](./frontend/schemas.md)**: Effect Schema validation APIs
- **[Event System](./frontend/events.md)**: Cross-domain event bus APIs

### Backend APIs
- **[Zome Functions](./backend/zome-functions.md)**: Complete Holochain zome function reference
- **[Entry Types](./backend/entry-types.md)**: Data structure definitions and validation
- **[Link Types](./backend/link-types.md)**: Relationship and indexing patterns
- **[Integration](./backend/integration.md)**: hREA and external system integration APIs

## API Categories

### Domain APIs
Each domain provides a complete set of APIs following the 7-layer architecture:

| Domain | Service API | Store API | Status |
|--------|-------------|-----------|---------|
| **Service Types** | ✅ Complete | ✅ Complete | Reference Implementation |
| **Requests** | ✅ Complete | ✅ Complete | Full Implementation |
| **Offers** | ✅ Complete | ✅ Complete | Full Implementation |
| **Users** | ✅ Complete | ✅ Complete | Full Implementation |
| **Organizations** | ✅ Complete | ✅ Complete | Full Implementation |
| **Administration** | ✅ Complete | ✅ Complete | Full Implementation |

### Cross-Domain APIs
- **Event Bus**: Cross-domain communication and state synchronization
- **Cache Management**: Module-level caching with TTL and synchronization
- **Error Boundaries**: Composable error handling with retry logic
- **Schema Validation**: Strategic validation boundaries with Effect Schema

## Usage Patterns

### Service Layer Usage
```typescript
// Dependency injection pattern
const result = await Effect.runPromise(
  Effect.gen(function* () {
    const service = yield* ServiceTypeService;
    return yield* service.getAllServiceTypes();
  }).pipe(
    Effect.provide(ServiceTypeServiceLive)
  )
);
```

### Store Layer Usage
```typescript
// Factory pattern with reactive state
const store = createServiceTypesStore();

// Access reactive state
const entities = store.entities();
const isLoading = store.isLoading();

// Execute operations
await Effect.runPromise(store.fetchEntities);
```

### Composable Usage
```typescript
// Business logic abstraction
const { state, operations } = useServiceTypesManagement();

// React to state changes
$effect(() => {
  console.log('Entities updated:', state.entities());
});

// Execute business operations
await operations.createEntity(input);
```

## Architecture Integration

### 7-Layer Integration
All APIs follow the standardized 7-layer architecture:

1. **Service Layer**: Effect-native APIs with dependency injection
2. **Store Layer**: Reactive state management with standardized helpers
3. **Schema Layer**: Validation boundaries with Effect Schema
4. **Error Layer**: Domain-specific tagged errors
5. **Composable Layer**: Business logic abstraction
6. **Component Layer**: UI integration points
7. **Testing Layer**: Comprehensive test coverage

### Development Patterns
- **Effect.gen vs .pipe**: Clear guidelines for when to use each pattern
- **Error Handling**: Standardized error transformation and context
- **Cache Management**: Consistent caching strategies across domains
- **Event Communication**: Cross-domain event patterns

## Getting Started

1. **Explore by Layer**: Start with [Services](./frontend/services.md) for core API patterns
2. **Follow Domain Examples**: Use Service Types as the reference implementation
3. **Understand Patterns**: Study the 9 standardized helper functions
4. **Practice Integration**: Follow the [Development Workflow Guide](../../guides/development-workflow.md)

## Reference Implementation

The **Service Types** domain serves as the complete reference implementation, demonstrating all patterns and APIs in their fully realized form. Use this domain as the template for understanding API usage across all layers.

For implementation guidance, see:
- [Development Workflow](../../guides/development-workflow.md)
- [Architectural Patterns](../../guides/architectural-patterns.md)
- [Domain Implementation Guide](../../guides/domain-implementation.md)