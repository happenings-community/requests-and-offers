# Getting Started with Requests & Offers

Welcome to the Requests & Offers project! This guide will help you get started with our Holochain-based platform for facilitating exchanges within the hAppenings.community.

## What Makes This Project Unique

This project implements a sophisticated **7-layer Effect-TS architecture** that provides:

- **Type-safe async operations** with Effect-TS
- **Reactive state management** with Svelte 5 Runes
- **Centralized error handling** with domain-specific errors
- **Composable business logic** abstraction
- **Comprehensive testing** across all layers

## Prerequisites

Before you begin, ensure you have:

- [Holochain Development Environment](https://developer.holochain.org/docs/install/) installed
- Basic understanding of Holochain concepts
- Bun 1.0.0 or later
- **Recommended**: Familiarity with TypeScript and functional programming concepts

## Quick Start

1. Clone the repository:

   ```bash
   git clone https://github.com/Happening-Community/requests-and-offers.git
   cd requests-and-offers
   ```

2. Enter the nix shell:

   ```bash
   nix develop
   ```

3. Install dependencies:

   ```bash
   bun install
   ```

4. Start the development environment:

   ```bash
   bun start
   ```

5. Open your browser to see multiple agent instances running

## Understanding the Architecture

### 7-Layer Effect-TS Pattern

Our codebase follows a standardized pattern across all domains:

1. **Service Layer**: Effect-native services with Context.Tag dependency injection
2. **Store Layer**: Factory functions with Svelte 5 Runes + 9 standardized helper functions
3. **Schema Validation**: Effect Schema with strategic validation boundaries
4. **Error Handling**: Domain-specific tagged errors with centralized management
5. **Composables**: Component logic abstraction using Effect-based functions
6. **Components**: Svelte 5 + accessibility focus, using composables for business logic
7. **Testing**: Comprehensive Effect-TS coverage across all layers

### Example: Service Types Domain (Fully Implemented)

The **Service Types** domain serves as the architectural template. Here's how the layers work together:

```typescript
// 1. Service Layer (Effect-native with dependency injection)
export const ServiceTypeService =
  Context.GenericTag<ServiceTypeService>("ServiceTypeService");

// 2. Store Layer (Factory function with Svelte 5 Runes)
export const createServiceTypesStore = () => {
  let entities = $state<UIServiceType[]>([]);

  const fetchEntities = Effect.gen(function* () {
    const records = yield* serviceTypeService.getAllServiceTypes();
    entities = mapRecordsToUIEntities(records); // Helper function #2
  });

  return { entities: () => entities, fetchEntities };
};

// 3. Composable (Business logic abstraction)
export function useServiceTypesManagement() {
  const store = createServiceTypesStore();
  const errorBoundary = useErrorBoundary({
    context: SERVICE_TYPE_CONTEXTS.FETCH_SERVICE_TYPES,
  });

  return { ...store, errorBoundary };
}

// 4. Component (Using composable for business logic)
// ServiceTypesGrid.svelte uses the composable
```

### The 9 Standardized Store Helper Functions

Each domain store implements these helpers for consistency:

1. **Entity Creation Helper**: `createUIEntity` - Converts Holochain records to UI entities
2. **Record Mapping Helper**: `mapRecordsToUIEntities` - Maps arrays with null safety
3. **Cache Sync Helper**: `createCacheSyncHelper` - Synchronizes cache with state arrays
4. **Event Emission Helpers**: `createEventEmitters` - Standardized event broadcasting
5. **Data Fetching Helper**: `createEntityFetcher` - Higher-order fetching with loading state
6. **Loading State Helper**: `withLoadingState` - Consistent loading/error patterns
7. **Record Creation Helper**: `createRecordCreationHelper` - Processes new records
8. **Status Transition Helper**: `createStatusTransitionHelper` - Atomic status updates
9. **Collection Processor**: `processMultipleRecordCollections` - Complex response handling

## Project Structure Deep Dive

```
requests-and-offers/
├── dnas/requests_and_offers/
│   ├── zomes/
│   │   ├── coordinator/     # Business logic zomes
│   │   │   ├── service_types/    # ✅ Complete domain template
│   │   │   ├── requests/         # ✅ Complete domain
│   │   │   ├── offers/           # ✅ Complete domain
│   │   │   └── ...
│   │   └── integrity/       # Data validation zomes
├── ui/                      # SvelteKit frontend
│   ├── src/lib/
│   │   ├── services/        # Service layer (Effect-TS services)
│   │   ├── stores/          # Store layer (Svelte 5 + Effect-TS)
│   │   ├── composables/     # Business logic abstraction
│   │   ├── components/      # UI components (by feature)
│   │   ├── schemas/         # Effect Schema validation
│   │   ├── errors/          # Domain-specific error handling
│   │   └── utils/           # Shared utilities
│   └── src/routes/          # SvelteKit pages
├── tests/                   # Tryorama integration tests
└── documentation/           # Comprehensive project docs
```

## Core Technologies in Practice

### Effect-TS Integration

- **Service Layer**: All async operations use Effect for composability
- **Error Handling**: Domain-specific tagged errors with Effect's error model
- **State Management**: Effect services integrate with Svelte stores
- **Testing**: Effect's testing utilities for reliable async tests

### Svelte 5 Runes + Effect-TS

```typescript
// Store pattern combining Svelte 5 Runes with Effect-TS
export const createServiceTypesStore = () => {
  let entities = $state<UIServiceType[]>([]);
  let isLoading = $state(false);

  const loadEntities = Effect.gen(function* () {
    isLoading = true;
    const result = yield* serviceTypeService.getAllServiceTypes();
    entities = mapRecordsToUIEntities(result);
    isLoading = false;
  });

  return {
    entities: () => entities,
    isLoading: () => isLoading,
    loadEntities,
  };
};
```

### hREA Integration

The application integrates with hREA (Holochain Resource-Event-Agent) framework:

- **Requests** map to hREA Intents
- **Offers** map to hREA Proposals
- **Service Types** map to ResourceSpecifications
- **Users/Organizations** map to Agents

## Your First Development Task

### Verification: Explore a Complete Domain

1. **Examine Service Types domain** (fully implemented):

   ```bash
   # Look at the service layer
   code ui/src/lib/services/zomes/serviceTypes.service.ts

   # Check the store implementation
   code ui/src/lib/stores/serviceTypes.store.svelte.ts

   # See the composable pattern
   code ui/src/lib/composables/domain/service-types/useServiceTypesManagement.svelte.ts

   # View the components
   code ui/src/lib/components/service-types/
   ```

2. **Run domain-specific tests**:

   ```bash
   # Backend tests
   bun test:service-types

   # Frontend tests
   cd ui && bun test:unit -- service-types
   ```

3. **See it in action**:
   - Start the app: `bun start`
   - Navigate to Service Types section
   - Try creating, editing, and managing service types

### Next: Learn the Patterns

1. **Effect-TS Primer**: Read our [Effect-TS guide](./effect-ts-primer.md) for project-specific patterns
2. **Development Workflow**: Follow [development workflow](./development-workflow.md) for implementing features
3. **Architectural Patterns**: Understand our [established patterns](./architectural-patterns.md)

## Implementation Status

- **Service Types Domain**: ✅ Fully completed (100%) - serves as template
- **Requests Domain**: ✅ Fully completed (100%) - patterns applied
- **Offers Domain**: ✅ Fully completed (100%) - all 9 helpers implemented
- **Other Domains**: Effect-based, queued for standardization

## Next Steps

1. **Deep Dive**
   - Read [Effect-TS Primer](./effect-ts-primer.md) for project patterns
   - Follow [Development Workflow](./development-workflow.md) for practical implementation
   - Study [Architectural Patterns](./architectural-patterns.md) for established conventions

2. **Development**
   - Follow the [Contributing Guide](./contributing.md) for contribution workflow
   - Use [Installation Guide](./installation.md) for detailed setup options

3. **Understanding the System**
   - Review [Technical Specifications](../technical-specs.md) for complete system details
   - Check [Feature Specifications](../requirements/features.md) for functionality overview
   - Learn [Architecture](../architecture.md) for high-level system design

## Need Help?

- **Development Questions**: Check our comprehensive [AI Development Rules](../ai/rules/README.md)
- **Community**: Join our [Discord](https://discord.gg/happening)
- **Project Info**: Visit [hAppenings Community](https://happenings.community/)
- **Issues**: Report on [GitHub](https://github.com/Happening-Community/requests-and-offers/issues)

## What Sets This Apart

This isn't just a typical SvelteKit + Holochain app. You're working with:

- **Functional programming** patterns with Effect-TS
- **Type-safe async** operations throughout
- **Standardized architecture** across all domains
- **Comprehensive error handling** with recovery strategies
- **Advanced state management** combining reactive and functional paradigms
- **Production-ready patterns** proven across multiple domains

Ready to dive deeper? Continue with our [Effect-TS Primer](./effect-ts-primer.md) to understand the core patterns that power this architecture.
