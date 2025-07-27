# Requests & Offers Frontend

SvelteKit frontend for the Requests & Offers Holochain application, built with a sophisticated 7-layer Effect-TS architecture.

## Architecture Overview

### Technology Stack
- **SvelteKit 2.16.1** with **Svelte 5.19.2** (Runes)
- **Effect-TS 3.14.18** for functional programming
- **TailwindCSS + SkeletonUI** for styling
- **Vite** for build tooling
- **Vitest** for testing

### 7-Layer Architecture

The frontend follows a standardized 7-layer pattern ensuring consistency across all domains:

```
7. Testing Layer     ← Comprehensive coverage (268 tests passing)
6. Component Layer   ← Svelte 5 components using composables  
5. Composable Layer  ← Business logic abstraction
4. Error Layer       ← Domain-specific tagged error handling
3. Schema Layer      ← Effect Schema validation boundaries
2. Store Layer       ← Svelte 5 Runes + Effect-TS + 9 helper functions
1. Service Layer     ← Effect-native services with dependency injection
```

## Domain Implementation

### Completed Domains (100% Standardized)
- **Service Types** (Reference Implementation)
- **Requests** 
- **Offers**
- **Users**
- **Organizations** 
- **Administration**

Each domain implements:
- ✅ **Service Layer**: Effect-TS with Context.Tag dependency injection
- ✅ **Store Layer**: Factory functions with 9 standardized helper functions
- ✅ **Error Handling**: Domain-specific tagged errors
- ✅ **Schema Validation**: Effect Schema with strategic boundaries
- ✅ **Composables**: Business logic abstraction
- ✅ **Components**: Svelte 5 components using composables
- ✅ **Testing**: Comprehensive test coverage

## Development

### Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Start with specific port
bun run dev -- --port 3000
```

### Commands

```bash
# Development
bun run dev           # Start dev server
bun run build         # Production build
bun run preview       # Preview build

# Code Quality
bun run check         # TypeScript check
bun run lint          # ESLint
bun run format        # Prettier

# Testing
bun run test          # All tests
bun run test:unit     # Unit tests
bun run test:integration  # Integration tests
bun run test:e2e      # E2E tests
bun run test:e2e:holochain  # E2E with Holochain
```

## Project Structure

```
ui/
├── src/
│   ├── lib/
│   │   ├── components/          # UI components by domain
│   │   │   ├── service-types/   # Service types components
│   │   │   ├── requests/        # Request components
│   │   │   ├── offers/          # Offer components
│   │   │   ├── users/           # User components
│   │   │   ├── organizations/   # Organization components
│   │   │   ├── administration/  # Admin components
│   │   │   └── shared/          # Shared components
│   │   ├── services/            # Service layer (Effect-TS)
│   │   │   ├── zomes/           # Domain-specific services
│   │   │   ├── HolochainClientService.svelte.ts
│   │   │   └── hrea.service.ts
│   │   ├── stores/              # Store layer (Svelte 5 + Effect-TS)
│   │   │   ├── serviceTypes.store.svelte.ts
│   │   │   ├── requests.store.svelte.ts
│   │   │   ├── offers.store.svelte.ts
│   │   │   ├── users.store.svelte.ts
│   │   │   ├── organizations.store.svelte.ts
│   │   │   └── administration.store.svelte.ts
│   │   ├── composables/         # Business logic abstraction
│   │   │   └── domain/          # Domain-specific composables
│   │   ├── schemas/             # Effect Schema validation
│   │   │   ├── service-type.schemas.ts
│   │   │   ├── request.schemas.ts
│   │   │   └── common.schemas.ts
│   │   ├── errors/              # Error handling system
│   │   │   ├── service-type.errors.ts
│   │   │   ├── request.errors.ts
│   │   │   └── error-contexts.ts
│   │   ├── types/               # TypeScript type definitions
│   │   └── utils/               # Utility functions
│   └── routes/                  # SvelteKit routes
├── tests/                       # Test files
│   ├── unit/                    # Unit tests
│   ├── integration/             # Integration tests
│   └── e2e/                     # E2E tests
└── static/                      # Static assets
```

## Key Patterns

### Service Layer Pattern

```typescript
// Service with dependency injection
export const ServiceTypeService = Context.GenericTag<ServiceTypeService>("ServiceTypeService");

export const makeServiceTypeService = Effect.gen(function* () {
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
      Effect.mapError((error) => ServiceTypeError.fromError(error, context)),
      Effect.withSpan('ServiceTypeService.createServiceType')
    );

  return { createServiceType /* ... */ };
});
```

### Store Layer Pattern

```typescript
// Factory function with Svelte 5 Runes + Effect-TS
export const createServiceTypesStore = () => {
  let entities = $state<UIServiceType[]>([]);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Implement all 9 helper functions
  const createUIEntity = (record: Record): UIServiceType | null => { /* */ };
  const mapRecordsToUIEntities = (records: Record[]): UIServiceType[] => { /* */ };
  // ... 7 more helper functions

  const fetchEntities = Effect.gen(function* () {
    const service = yield* ServiceTypeService;
    const result = yield* service.getAllServiceTypes();
    entities = mapRecordsToUIEntities(result);
    return entities;
  });

  return {
    entities: () => entities,
    isLoading: () => isLoading,
    fetchEntities,
    createUIEntity, // Exposed for composables
    // ... other operations and helpers
  };
};
```

### Component Pattern

```svelte
<!-- Components use composables, never direct store access -->
<script>
  import { useServiceTypesManagement } from '$lib/composables';

  const { state, operations, loadingErrorBoundary } = useServiceTypesManagement();

  let showCreateForm = $state(false);
</script>

{#if state.loadingError()}
  <ErrorDisplay 
    error={state.loadingError()}
    onretry={() => operations.loadEntities()}
  />
{/if}

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each state.entities() as entity (entity.hash)}
    <ServiceTypeCard 
      {entity} 
      onupdate={(input) => operations.updateEntity(entity.hash, input)}
    />
  {/each}
</div>
```

## The 9 Standardized Helper Functions

Every store implements these functions for consistency:

1. **createUIEntity** - Convert Holochain Record to UI entity
2. **mapRecordsToUIEntities** - Map arrays with null safety  
3. **createCacheSyncHelper** - Synchronize cache with state
4. **createEventEmitters** - Standardized event broadcasting
5. **createEntityFetcher** - Higher-order fetching with loading
6. **withLoadingState** - Consistent loading/error patterns
7. **createRecordCreationHelper** - Process new records
8. **createStatusTransitionHelper** - Atomic status updates
9. **processMultipleRecordCollections** - Complex response handling

## Error Handling

### Tagged Error System

```typescript
// Domain-specific errors
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly entityId?: string;
}> {
  static fromError(error: unknown, context: string): ServiceTypeError {
    return new ServiceTypeError({
      message: error instanceof Error ? error.message : String(error),
      cause: error,
      context
    });
  }
}

// Error contexts
export const SERVICE_TYPE_CONTEXTS = {
  CREATE_SERVICE_TYPE: 'Failed to create service type',
  GET_ALL_SERVICE_TYPES: 'Failed to fetch service types',
  // ... other contexts
} as const;
```

### Error Boundaries

```typescript
// Composable error boundaries
export function useErrorBoundary(config: ErrorBoundaryConfig) {
  let state = $state({
    error: null as DomainError | null,
    isRetrying: false,
    retryCount: 0
  });

  const execute = async <T>(operation: Effect.Effect<T, DomainError>) => {
    try {
      const result = await Effect.runPromise(operation);
      state.error = null;
      return result;
    } catch (error) {
      state.error = error;
      throw error;
    }
  };

  return { state, execute, clearError: () => state.error = null };
}
```

## Testing

### Current Status
- **✅ All 268 unit tests passing** with no unhandled Effect errors
- **Unit Tests**: Vitest + @effect/vitest for Effect-TS testing
- **Integration Tests**: Component and store integration  
- **E2E Tests**: Playwright with Holochain integration

### Running Tests

```bash
# All tests
bun test

# Specific test types  
bun test:unit
bun test:integration
bun test:e2e

# With coverage
bun test -- --coverage
```

## Configuration

### Key Config Files
- **`vite.config.ts`** - Vite build configuration
- **`vitest.config.ts`** - Test configuration 
- **`tailwind.config.ts`** - TailwindCSS configuration
- **`eslint.config.js`** - ESLint configuration
- **`playwright.config.ts`** - E2E test configuration

### Environment Variables
- **Development**: Uses default Holochain ports
- **Testing**: Configured for test environments
- **Production**: Optimized build settings

## Integration

### Holochain Integration
- **HolochainClientService**: WebSocket connection management
- **Effect-TS Integration**: All Holochain calls wrapped in Effects
- **Error Handling**: Holochain errors transformed to domain errors
- **Dependency Injection**: Services injected via Context.Tag

### hREA Integration  
- **ResourceSpecifications**: Service types mapping
- **Intents/Proposals**: Requests/offers mapping
- **GraphQL**: hREA API integration
- **Event Synchronization**: Cross-DNA communication

## Performance

### Optimization Features
- **Module-level caching**: TTL-based with synchronization
- **Lazy loading**: Components and routes
- **Bundle splitting**: Automatic code splitting
- **Tree shaking**: Dead code elimination
- **Effect-TS**: Efficient async operations

### Monitoring
- **Error tracking**: Comprehensive error boundaries
- **Performance metrics**: Core Web Vitals
- **Bundle analysis**: Build size monitoring

## Documentation

For comprehensive documentation, see:
- **[Getting Started Guide](../documentation/guides/getting-started.md)** - Architecture overview and first steps
- **[Development Workflow](../documentation/guides/development-workflow.md)** - Feature implementation patterns
- **[Architectural Patterns](../documentation/guides/architectural-patterns.md)** - Detailed pattern documentation
- **[API Documentation](../documentation/technical-specs/api/)** - Complete API reference

## Contributing

1. Follow the 7-layer architecture pattern
2. Implement all 9 helper functions in stores
3. Use Effect-TS for all async operations
4. Add comprehensive tests for new features
5. Follow existing error handling patterns

This frontend provides a sophisticated, maintainable foundation for the Requests & Offers application with consistent patterns across all domains.