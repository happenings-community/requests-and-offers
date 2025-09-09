# Requests and Offers - Holochain Decentralized Marketplace

## Project Overview

This is a **decentralized marketplace** application built on the **Holochain** platform, enabling creators, developers, advocates, projects and organisations to post requests and offers for services, skills, and resources within the Holochain ecosystem.

### Core Functionality

- **Post Requests** for services, skills, or resources they need
- **Create Offers** to provide services, skills, or resources they can share
- **Discover opportunities** through sophisticated search and tagging systems
- **Connect and exchange** in a transparent, agent-centric network

### Key Features

1. **Tag-Based Discovery System** - Dynamic service type management with admin validation workflow
2. **Request Management** - Create detailed requests specifying what you need with service type integration
3. **Offer Management** - Create comprehensive offers detailing what you can provide with service type integration
4. **User & Organization Profiles** - Individual user profiles with skills and preferences
5. **Administrative Tools** - Full approval/rejection workflow for user-suggested service types
6. **hREA Economic Integration** - Integration with the hREA (Holochain Resource-Event-Agent) framework for economic coordination

## Technology Stack

### Backend (Holochain/Rust)

- **Holochain** - Distributed peer-to-peer application platform
- **Rust** - For zome development (backend logic)
- **Zome Architecture** - Modular coordinator/integrity pattern
  - `requests_coordinator`: Request management and lifecycle
  - `offers_coordinator`: Offer management and lifecycle
  - `service_types_coordinator`: Service type management with tag indexing
  - `users_organizations`: Profile and organization management
  - `administration`: Admin roles and verification
  - `exchanges`: Exchange proposals, agreements, and lifecycle management
  - `mediums_of_exchange`: Currency and payment method management
- **Cross-Zome Integration** - Seamless data flow between different functional areas
- **hREA Integration** - Integration with hREA DNA for economic coordination

### Frontend (SvelteKit + Effect-TS)

- **SvelteKit** - Modern web framework with server-side rendering
- **Svelte 5 Runes** - Reactive state management (`$state`, `$derived`, `$effect`)
- **Effect-TS** - Functional programming patterns for robust async operations and error handling
- **TailwindCSS + SkeletonUI** - Modern, responsive design system
- **Vite** - Build tool with environment-based optimization

### Development & Testing

- **Nix** - Reproducible development environment (for DNA/zome development)
- **Bun** - JavaScript runtime and package manager (for frontend)
- **Tryorama** - Holochain testing framework (backend tests)
- **Vitest** - Modern testing framework (frontend tests)

## Architecture Patterns

### 7-Layer Effect-TS Architecture

The application follows a standardized 7-layer pattern for consistency and maintainability:

1. **Service Layer** - Pure Effect services with Context.Tag dependency injection
2. **Store Layer** - Factory functions with Svelte 5 Runes + 9 standardized helper functions
3. **Schema Validation** - Effect Schema with strategic validation boundaries
4. **Error Handling** - Domain-specific tagged errors with centralized management
5. **Composables** - Component logic abstraction using Effect-based functions
6. **Components** - Svelte 5 + accessibility focus, using composables for business logic
7. **Testing** - Comprehensive Effect-TS coverage across all layers

### Implementation Status

- **✅ Service Types Domain**: **FULLY COMPLETED (100%)** - Complete pattern template established
- **✅ Requests Domain**: **FULLY COMPLETED (100%)** - Patterns successfully replicated
- **✅ Offers Domain**: **FULLY COMPLETED (100%)** - All 9 helper functions implemented
- **✅ Users Domain**: **FULLY COMPLETED (100%)** - Effect-TS standardization complete
- **✅ Organizations Domain**: **FULLY COMPLETED (100%)** - Effect-TS standardization complete
- **✅ Administration Domain**: **FULLY COMPLETED (100%)** - Effect-TS standardization complete
- **✅ Exchanges Domain**: **FULLY COMPLETED (100%)** - Complete Effect-TS implementation with all layers
- **✅ Mediums of Exchange Domain**: **FULLY COMPLETED (100%)** - Effect-TS standardized with store helpers

### 9 Standardized Store Helper Functions

Each domain store implements these 9 helper functions for consistency and functionality:

1. **Entity Creation Helper** - Converts Holochain records to UI entities with error recovery
2. **Record Mapping Helper** - Maps arrays with error recovery
3. **Cache Sync Helper** - Synchronizes cache with state arrays for CRUD operations
4. **Event Emission Helpers** - Standardized event broadcasting
5. **Data Fetching Helper** - Higher-order fetching with loading state management
6. **Loading State Helper** - Wraps operations with loading/error state patterns
7. **Record Creation Helper** - Processes new records and updates cache atomically
8. **Status Transition Helper** - Manages status changes with atomic updates
9. **Collection Processor** - Handles complex responses with multiple collections

## Core Data Flow

The application follows a refined data and control flow leveraging Effect TS patterns for maximum type safety and maintainability:

1. **Rust Zomes (Holochain Backend):** Execute core business logic and manage data persistence on the DHT.
2. **Effect Services (`ui/src/lib/services`):**
   - **Pure Effect-native services** with Context.Tag dependency injection
   - **Strategic schema validation** at business boundaries
   - **Domain-specific error handling** with tagged errors
   - **Composable async operations** with robust error propagation
3. **Svelte Stores (`ui/src/lib/stores`):**
   - **Factory function pattern** creating Effect-based stores
   - **Standardized helper functions** (9 core patterns) for code reduction
   - **Reactive state management** using Svelte 5 Runes (`$state`, `$derived`, `$effect`)
   - **Event Bus integration** for cross-store communication
   - **EntityCache patterns** for performance optimization
4. **Composables (`ui/src/lib/composables`):**
   - **Component Logic Abstraction Layer** extracting complex logic
   - **Effect integration** for all async operations
   - **Standard interfaces** with state/actions separation
5. **Svelte UI Components (`ui/src/lib/components`):**
   - **Use composables** for business logic and state management
   - **Focus on presentation** and user interaction
   - **Svelte 5 patterns** with proper reactive design

## Building and Running

### Prerequisites

- Nix (for Holochain development)
- Bun (for frontend development)
- Git

### Environment Setup

```bash
# Enter Nix development environment (required for zome development)
nix develop

# Install dependencies
bun install
```

### Running the Application

```bash
# Development Mode - Full dev features enabled
bun start              # Start with 2 agents + mock buttons
AGENTS=3 bun start     # Custom number of agents
bun start:tauri        # Desktop app with Tauri

# Test Mode - Alpha testing without mock buttons
bun start:test         # Test deployment simulation

# Production Mode - Clean production build
bun start:prod         # Production-ready deployment
```

### Testing

```bash
bun test               # All tests
bun test:ui            # Frontend tests
bun test:unit          # Unit tests (requires Nix)
bun test:integration   # Integration tests
```

### Building

```bash
bun build:zomes        # Build zomes
bun build:happ         # Build complete hApp
bun package            # Package for distribution
```

## Development Conventions

### Documentation-First Approach

**MANDATORY**: Always consult the documentation before starting any task:

1. **Start with [Documentation Index](documentation/DOCUMENTATION_INDEX.md)** - Find relevant docs for your task
2. **Check [Quick Reference Guide](documentation/QUICK_REFERENCE.md)** - Essential commands, patterns, and workflows
3. **Review domain-specific guidelines** - Development patterns and architectural constraints
4. **Validate against [Project Status](documentation/status.md)** - Current implementation status

### Code Organization

- **Domain-driven design** - Each feature area has its own directory
- **7-layer architecture** - Consistent pattern across all domains
- **Effect-TS patterns** - Type-safe functional programming
- **Svelte 5 Runes** - Modern reactive state management

### Testing Practices

- **Backend**: Tryorama multi-agent testing
- **Frontend**: Vitest unit testing with Effect TS testing utilities
- **Integration**: Cross-domain workflow validation
- **Use Standard Test Commands**: Always use `bun test:domain-name` rather than running tests directly

### Contribution Guidelines

- **Follow the 7-layer Effect-TS architecture pattern**
- **Maintain type safety with Effect Schema validation**
- **Write comprehensive tests for new features**
- **Use the development features system for dev-only functionality**
- **Ensure production builds are clean through tree-shaking**
- **Use Service Types as Template**: The service-types domain is 100% complete and serves as the architectural template for all new implementations

### Core Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User

### Effect-TS Guidelines

- **Effect.gen vs .pipe**:
  - **Effect.gen**: Injecting dependencies, conditional logic, sequential operations
  - **.pipe**: Error handling, tracing, layer building, simple transforms
- **Service Layer Pattern**: Pure Effect services with Context.Tag dependency injection
- **Error Handling**: Domain-specific tagged errors with centralized contexts
- **When to Use Effect.gen vs .pipe**
  - **Effect.gen**: Use for injecting dependencies, conditional logic, and sequential operations
  - **.pipe**: Use for error handling, tracing, layer building, and simple transforms

## Development Features System

The project includes a comprehensive development features system with three distinct modes:

### 🧑‍💻 Development Mode

- **Purpose**: Full development experience with all debugging tools
- **Features**: Mock data buttons, development utilities, debug panels
- **Command**: `bun start`
- **Environment**: Uses `.env.development` with all dev features enabled

### 🧪 Test Mode (Alpha)

- **Purpose**: Alpha testing environment simulating production
- **Features**: Limited dev features, no mock buttons, realistic testing
- **Command**: `bun start:test`
- **Environment**: Uses `.env.test` with selective feature enablement

### 🚀 Production Mode

- **Purpose**: Clean production deployment
- **Features**: All development code tree-shaken out, optimized builds
- **Command**: `bun start:prod`
- **Environment**: Uses `.env.production` with zero dev features

### Environment Variables

The system uses Vite environment variables for build-time optimization:

```bash
# Core configuration
VITE_APP_ENV=development|test|production
VITE_DEV_FEATURES_ENABLED=true|false
VITE_MOCK_BUTTONS_ENABLED=true|false
```

**Tree-Shaking**: Development features are completely removed from production builds through Vite's build-time optimization, ensuring zero overhead in production deployments.

## Project Structure

```bash
requests-and-offers/
├── dnas/requests_and_offers/    # Holochain DNA with coordinator/integrity zomes
│   ├── zomes/
│   │   ├── coordinator/         # Business logic zomes
│   │   └── integrity/           # Data validation zomes
│   └── utils/                   # Shared utilities
├── ui/                          # SvelteKit frontend with 7-layer Effect-TS architecture
│   ├── src/lib/
│   │   ├── components/          # UI components (organized by feature)
│   │   ├── services/             # Service layer (Holochain, hREA)
│   │   ├── stores/               # Svelte stores (state management)
│   │   ├── composables/          # Component logic abstraction
│   │   ├── schemas/              # Effect Schema validation
│   │   ├── errors/               # Centralized error handling
│   │   └── utils/                # Utility functions
│   └── src/routes/              # SvelteKit routes/pages
├── tests/                       # Tryorama integration tests
└── documentation/               # Comprehensive project documentation
```

## Memory Notes

- **Design & UI**:
  - In dark mode (admin panel), use the color primary-400 or less instead of primary-500

## Test Approach

**MANDATORY**: ALWAYS use the standard test commands defined in package.json. These commands handle proper environment setup and avoid timeout issues.

- **Use package.json commands**: `bun test:administration`, `bun test:users`, etc.
- **Never run tests directly** with `bun test` in the tests directory
- Don't try to start the happ yourself, just do tests.

**Correct Test Commands**:

```bash
# Administration tests
bun test:administration

# Other domain tests
bun test:users
bun test:organizations
bun test:requests
bun test:offers
bun test:service-types
bun test:mediums-of-exchange
bun test:exchanges
```

These commands automatically:

- Build zomes with proper environment
- Package the hApp correctly
- Run tests with proper workspace configuration
- Avoid timeout issues that occur with direct test execution

## Lint Errors

Run `bun check` regularly to fix lint errors.

## Important Instruction Reminders

### Core Rules

- Do what has been asked; nothing more, nothing less.
- NEVER create files unless they're absolutely necessary for achieving your goal.
- ALWAYS prefer editing an existing file to creating a new one.
- NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.

### Documentation-First Approach

- **MANDATORY**: Always consult the [Documentation Index](documentation/DOCUMENTATION_INDEX.md) before starting any task.
- Check [Quick Reference Guide](documentation/QUICK_REFERENCE.md) for essential patterns and commands.
- Validate implementation against established architectural patterns and guidelines.
- Use Service Types domain as the reference implementation template.

### Effect-TS Compliance

- All new development must follow the established 7-layer Effect-TS architecture.
- Use the 9 standardized store helper functions from the store-helpers API.
- Follow dependency injection patterns with Context.Tag and Layer.
- Implement proper error handling with domain-specific tagged errors.

### Development Patterns

#### Error Handling

- Use domain-specific tagged errors (e.g., `ServiceTypeError`, `RequestError`)
- Centralized error contexts in `ui/src/lib/errors/error-contexts.ts`
- Consistent error transformation: `Error.fromError(error, context)`

#### Cache Management

- Use module-level cache with TTL (default: 5 minutes)
- Implement cache sync helpers for state management
- Clear cache on mutations to ensure data freshness

## Development Workflow

**MANDATORY**: Always start with [Documentation Index](documentation/DOCUMENTATION_INDEX.md) to find relevant documentation for your task.

### Implementation Process

When implementing new domains, follow the standardized 7-layer implementation order:

1. **Zome Layer** (Backend) → 2. **Service Layer** → 3. **Store Layer** → 4. **Composable Layer** → 5. **Component Layer** → 6. **Error Handling** → 7. **Testing**

**Use Service Types as Template**: The service-types domain is 100% complete and serves as the architectural template for all new implementations.

### Required Documentation Consultation

Before starting work, consult these documentation sources:

1. **[Development Guidelines](documentation/ai/rules/development-guidelines.md)** - Effect-TS patterns, Svelte 5 standards, schema validation, and component architecture
2. **[Architecture Patterns](documentation/ai/rules/architecture-patterns.md)** - 7-layer architecture, service patterns, store management, and event-driven communication
3. **[Testing Framework](documentation/ai/rules/testing-framework.md)** - Comprehensive testing strategy across backend (Tryorama) and frontend (Vitest/Testing Library)
4. **[Domain Implementation](documentation/ai/rules/domain-implementation.md)** - Administration patterns, error management, guard composables, and utility patterns
5. **[Development Guidelines](documentation/ai/rules/development-guidelines.md)** - Continuation strategies, cleanup processes, planning methodologies, and changelog maintenance
6. **[Environment Setup](documentation/ai/rules/environment-setup.md)** - Nix configuration, development environment, and documentation standards

### Domain Implementation Checklist

- [ ] **Documentation reviewed** - Consulted relevant docs before starting
- [ ] **Zome implemented** with coordinator/integrity pattern
- [ ] **Service layer** with Effect-TS and dependency injection
- [ ] **Store layer** with all 9 helper functions from store-helpers API
- [ ] **Composable layer** abstracting business logic
- [ ] **Component layer** using composables
- [ ] **Error handling** with domain-specific errors and contexts
- [ ] **Tests** covering all layers (backend and frontend)
- [ ] **Documentation** updated with new domain

## Core Development Principles

### 1. Effect-Native Services

All domain services are built entirely with Effect TS:

- Context.Tag dependency injection for clean service composition
- Strategic schema validation at business boundaries
- Comprehensive error handling with domain-specific tagged errors
- Composable async operations with robust error propagation

### 2. Svelte 5 Runes + Effect Stores

Stores combine Svelte 5 Runes with Effect-TS:

- Factory functions returning Effects with Svelte 5 Runes
- 9 standardized helper functions for massive code reduction
- Module-level cache with TTL for performance optimization
- Event bus integration for cross-store communication

### 3. Effect Schema Validation

Strategic validation boundaries:

- Input validation at service boundaries
- Business logic validation within services
- UI transformation validation at component boundaries
- Schema.Class for complex entity validation

### 4. Tagged Error System

Domain-specific error hierarchies:

- Service → Store → Composable error separation
- Meaningful error contexts and recovery patterns
- Centralized error export through ui/src/lib/errors/index.ts
- Consistent error messaging and fallback handling

### 5. Component Logic Abstraction

Extract business logic into reusable Effect-based functions:

- Bridge Svelte components with Effect stores/services
- Standard state/actions separation with typed interfaces
- Prevent infinite reactive loops, enhance testability
- Abstract complex business logic from UI components

### 6. Svelte 5 + Accessibility

Use composables for business logic, focus on presentation:

- Svelte 5 Runes with proper reactive patterns ($state, $derived, $effect)
- WCAG-compliant interfaces with keyboard navigation
- Performance-optimized with $derived.by and proper effect management
- Accessible markup with proper ARIA attributes

### 7. Comprehensive Testing

Effect-TS coverage across all layers:

- Backend Tryorama multi-agent testing
- Frontend unit testing with Effect TS testing utilities
- Integration testing across components and stores
- End-to-end testing with Playwright

## Error Management Patterns

### Domain-Specific Tagged Errors

```typescript
// Domain error hierarchy
export class ServiceTypeError extends Data.TaggedError("ServiceTypeError")<{
  message: string;
  cause?: unknown;
  context?: string;
  serviceTypeId?: string;
  operation?: string;
}> {}

export class RequestError extends Data.TaggedError("RequestError")<{
  message: string;
  cause?: unknown;
  context?: string;
  requestId?: string;
  validationErrors?: ValidationError[];
}> {}

export class AccessDeniedError extends Data.TaggedError("AccessDeniedError")<{
  message: string;
  requiredRole?: UserRole;
  userRoles?: UserRole[];
  resource?: string;
}> {}
```

### Error Context Management

```typescript
// Centralized error contexts for consistent error handling
export const ErrorContexts = {
  SERVICE_TYPE_CREATION: "ServiceType.Creation",
  SERVICE_TYPE_VALIDATION: "ServiceType.Validation",
  SERVICE_TYPE_RETRIEVAL: "ServiceType.Retrieval",
  REQUEST_CREATION: "Request.Creation",
  REQUEST_VALIDATION: "Request.Validation",
  USER_AUTHENTICATION: "User.Authentication",
  USER_AUTHORIZATION: "User.Authorization",
  HOLOCHAIN_COMMUNICATION: "Holochain.Communication",
  SCHEMA_VALIDATION: "Schema.Validation",
} as const;

// Error context transformation
export const transformErrorWithContext =
  <TError extends Data.TaggedError<any, any>>(context: string) =>
  (error: unknown): TError => {
    if (error instanceof Data.TaggedError) {
      return new (error.constructor as any)({
        ...error,
        context,
        originalContext: error.context,
      });
    }

    return new ServiceTypeError({
      message: error instanceof Error ? error.message : "Unknown error",
      cause: error,
      context,
    }) as TError;
  };
```

## Store Helper Functions Pattern

The 9 Standardized Store Helper Functions provide consistency across all domain stores:

### 1. Entity Creation Helper

```typescript
const createUIEntity = (record: Record): UIEntity | null => {
  try {
    const decoded = decode(record.entry);
    return {
      hash: record.signed_action.hashed.hash,
      ...decoded,
      createdAt: new Date(record.signed_action.hashed.content.timestamp / 1000),
    };
  } catch (error) {
    console.error("Failed to create UI entity:", error);
    return null;
  }
};
```

### 2. Record Mapping Helper

```typescript
const mapRecordsToUIEntities = (records: Record[]): UIEntity[] =>
  records
    .map(createUIEntity)
    .filter((entity): entity is UIEntity => entity !== null);
```

### 3. Cache Sync Helper

```typescript
const createCacheSyncHelper = () => {
  const syncCache = (newEntities: UIEntity[]) => {
    entities = newEntities;
    error = null;
  };

  const addToCache = (entity: UIEntity) => {
    entities = [...entities, entity];
  };

  const updateInCache = (id: string, updates: Partial<UIEntity>) => {
    entities = entities.map((e) => (e.id === id ? { ...e, ...updates } : e));
  };

  const removeFromCache = (id: string) => {
    entities = entities.filter((e) => e.id !== id);
  };

  return { syncCache, addToCache, updateInCache, removeFromCache };
};
```

### 4. Event Emission Helpers

```typescript
const createEventEmitters = <T>(domain: string) => {
  const emitEntityCreated = (entity: T) =>
    eventBus.emit(`${domain}:entity:created`, entity);

  const emitEntityUpdated = (entity: T) =>
    eventBus.emit(`${domain}:entity:updated`, entity);

  const emitEntityDeleted = (id: string) =>
    eventBus.emit(`${domain}:entity:deleted`, { id });

  return { emitEntityCreated, emitEntityUpdated, emitEntityDeleted };
};
```

### 5. Data Fetching Helper

```typescript
const createEntityFetcher = <T, E>(
  fetchOperation: Effect.Effect<T[], E>,
  processingFn: (records: any[]) => T[],
) => {
  const fetchWithState = Effect.gen(function* () {
    isLoading = true;
    error = null;

    try {
      const records = yield* fetchOperation;
      const uiEntities = processingFn(records);
      entities = uiEntities;
      return uiEntities;
    } catch (err) {
      error = err.message;
      throw err;
    } finally {
      isLoading = false;
    }
  });

  return { fetchWithState };
};
```

### 6. Loading State Helper

```typescript
const withLoadingState = <T, E>(operation: Effect.Effect<T, E>) =>
  Effect.gen(function* () {
    isLoading = true;
    error = null;

    try {
      const result = yield* operation;
      isLoading = false;
      return result;
    } catch (err) {
      error = err.message;
      isLoading = false;
      throw err;
    }
  });
```

### 7. Record Creation Helper

```typescript
const createRecordCreationHelper = () => {
  const handleNewRecord = (newEntity: UIEntity) => {
    entities = [...entities, newEntity];
    cache.set(newEntity.hash, newEntity);
    eventEmitters.emitEntityCreated(newEntity);
  };

  const handleUpdatedRecord = (updatedEntity: UIEntity) => {
    const index = entities.findIndex((e) => e.hash === updatedEntity.hash);
    if (index !== -1) {
      entities[index] = updatedEntity;
      cache.set(updatedEntity.hash, updatedEntity);
      eventEmitters.emitEntityUpdated(updatedEntity);
    }
  };

  return { handleNewRecord, handleUpdatedRecord };
};
```

### 8. Status Transition Helper

```typescript
const createStatusTransitionHelper = () => {
  const updateEntityStatus = (hash: ActionHash, newStatus: EntityStatus) => {
    const index = entities.findIndex((e) => e.hash === hash);
    if (index !== -1) {
      const updatedEntity = { ...entities[index], status: newStatus };
      entities[index] = updatedEntity;
      cache.set(hash, updatedEntity);
      eventEmitters.emitEntityUpdated(updatedEntity);
    }
  };

  return { updateEntityStatus };
};
```

### 9. Collection Processor

```typescript
const processMultipleRecordCollections = (response: ComplexResponse) => {
  const processCollections = (collections: Record<string, Record[]>) => {
    const processed: Record<string, UIEntity[]> = {};

    for (const [key, records] of Object.entries(collections)) {
      processed[key] = mapRecordsToUIEntities(records);
    }

    return processed;
  };

  const mergeCollections = (
    primary: UIEntity[],
    related: Record<string, UIEntity[]>
  ) => {
    // Merge related entities into primary entities
    return primary.map(entity => ({
      ...entity,
      ...Object.keys(related).reduce((acc, key) => ({
        ...acc,
        [key]: related[key].filter(relatedEntity =>
          /* relationship logic based on domain */
        )
      }), {})
    }));
  };

  return { processCollections, mergeCollections };
};
```

## Event Bus Architecture

### Event-Driven Communication Pattern

```typescript
// Centralized event bus service
export const EventBusService =
  Context.GenericTag<EventBusService>("EventBusService");

export const makeEventBusService = Effect.gen(function* () {
  const subscribers = new Map<string, Set<(data: any) => void>>();

  const emit = <TData>(event: string, data: TData) =>
    Effect.gen(function* () {
      const eventSubscribers = subscribers.get(event);
      if (eventSubscribers) {
        for (const callback of eventSubscribers) {
          yield* Effect.sync(() => callback(data));
        }
      }
    }).pipe(
      Effect.catchAll((error) =>
        Effect.logError(`Event emission failed: ${event}`, error),
      ),
    );

  const subscribe = <TData>(event: string, callback: (data: TData) => void) =>
    Effect.gen(function* () {
      if (!subscribers.has(event)) {
        subscribers.set(event, new Set());
      }
      subscribers.get(event)!.add(callback);

      // Return unsubscribe function
      return () => {
        const eventSubscribers = subscribers.get(event);
        if (eventSubscribers) {
          eventSubscribers.delete(callback);
          if (eventSubscribers.size === 0) {
            subscribers.delete(event);
          }
        }
      };
    });

  return { emit, subscribe };
});
```

### Cross-Domain Event Patterns

```typescript
// Domain-specific event definitions
export type ServiceTypeEvents = {
  "serviceType.created": ServiceType;
  "serviceType.updated": ServiceType;
  "serviceType.deleted": { id: string };
  "serviceType.ui.created": UIServiceType;
  "serviceType.ui.updated": UIServiceType;
  "serviceType.ui.deleted": { id: string };
};

// Type-safe event emission
export const emitServiceTypeEvent = <K extends keyof ServiceTypeEvents>(
  eventBus: EventBusService,
  event: K,
  data: ServiceTypeEvents[K],
) => eventBus.emit(event, data);
```

## Testing Strategy

### Backend Testing (Tryorama)

```rust
#[tokio::test(flavor = "multi_thread")]
async fn test_entity_creation() -> anyhow::Result<()> {
  let (conductor, _agent, cell) = setup_conductor_test().await?;

  let input = CreateEntityInput {
    name: "Test Entity".to_string(),
    // ... other fields
  };

  let hash: ActionHash = conductor
    .call(&cell.zome("coordinator"), "create_entity", input)
    .await?;

  assert!(!hash.get_raw_39().is_empty());
  Ok(())
}
```

### Frontend Testing (Vitest)

```typescript
describe("EntityService", () => {
  it("should create entity successfully", async () => {
    const program = Effect.gen(function* () {
      const service = yield* EntityService;
      return yield* service.createEntity(testInput);
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestServiceLayer)),
    );

    expect(result.name).toBe("Test Entity");
  });
});
```

## Development Environment

### Nix Development Environment

The project uses Nix for reproducible development environments, particularly for Holochain development:

```nix
# flake.nix - Development environment specification
{
  description = "Requests and Offers hApp Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    holochain-flake.url = "github:holochain/holochain";
    holochain-flake.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { self, nixpkgs, holochain-flake }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          holochain = holochain-flake.packages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              // Holochain development tools
              holochain.holochain
              holochain.lair-keystore
              holochain.hc

              // Rust toolchain
              rustc
              cargo
              rustfmt
              clippy

              // Node.js ecosystem
              nodejs_20
              bun

              // Development utilities
              git
              jq
              curl
              which
            ];

            shellHook = ''
              echo "🧬 Holochain Development Environment Ready"
              echo "📦 Available tools:"
              echo "  - holochain: $(holochain --version)"
              echo "  - hc: $(hc --version)"
              echo "  - rustc: $(rustc --version)"
              echo "  - node: $(node --version)"
              echo "  - bun: $(bun --version)"

              // Set environment variables
              export RUST_LOG=warn
              export HC_APP_PORT=8888
              export ADMIN_PORT=4444

              // Create necessary directories
              mkdir -p .hc
              mkdir -p logs

              echo "🚀 Run 'bun start' to begin development"
            '';
          };
        });
    };
}
```

### Environment Variables

```bash
# .env.development - Development environment variables
# Holochain Configuration
HC_APP_PORT=8888
ADMIN_PORT=4444
BOOTSTRAP_URL=https://bootstrap.holo.host
SIGNALING_URL=wss://signal.holo.host

# Application Configuration
NODE_ENV=development
VITE_APP_TITLE="Requests and Offers - Development"
VITE_HOLOCHAIN_APP_PORT=8888
VITE_HOLOCHAIN_ADMIN_PORT=4444

# Development Features
VITE_DEV_FEATURES_ENABLED=true
VITE_MOCK_DATA_ENABLED=true
VITE_DEBUG_MODE=true

# Logging
RUST_LOG=warn
VITE_LOG_LEVEL=debug
```

## Performance Optimization

### Cache Management Patterns

```typescript
// Cache configuration
const cache = createModuleCache<ActionHash, UIEntity>(
  "domainName", // Cache namespace
  5 * 60 * 1000, // TTL: 5 minutes
);

// Cache strategies
const getCachedEntity = (hash: ActionHash): UIEntity | null => {
  return cache.get(hash) || null;
};

const setCachedEntity = (entity: UIEntity): void => {
  cache.set(entity.hash, entity);
};

const invalidateCache = (hash?: ActionHash): void => {
  if (hash) {
    cache.delete(hash);
  } else {
    cache.clear();
  }
};
```

### Loading State Management

```typescript
// Loading state patterns
const withLoadingState = <T, E>(operation: Effect.Effect<T, E>) =>
  Effect.gen(function* () {
    isLoading = true;
    error = null;

    try {
      const result = yield* operation;
      isLoading = false;
      return result;
    } catch (err) {
      error = err.message;
      isLoading = false;
      throw err;
    }
  });
```

## Security Considerations

### Authentication and Authorization

- **User Authentication**: Agent-centric authentication using Holochain's cryptographic keys
- **Role-Based Access Control**: Fine-grained permissions based on user roles (admin, moderator, creator, advocate)
- **Profile Recovery System**: Secure identity recovery mechanisms with multi-agent verification
- **Data Validation**: Comprehensive input validation using Effect TS Schema validation
- **Secure Communications**: End-to-end encrypted messaging between users

### Data Protection

- **Data Sovereignty**: Users control their own data with no central authority
- **Privacy by Design**: Data is only shared with explicit consent
- **Audit Logging**: Comprehensive activity logging for security monitoring
- **Secure Data Storage**: Holochain's DHT ensures data integrity and availability

## Scalability Considerations

### Distributed Architecture Benefits

- **Linear Scalability**: Performance scales linearly with network size
- **Zero Processing Fees**: No transaction fees or platform charges
- **Instant Transaction Finality**: No mining or block confirmation delays
- **Energy Efficiency**: Peer-to-peer validation without mining overhead

### Performance Optimizations

- **Module-Level Caching**: TTL-based caching with intelligent invalidation
- **Reactive State Management**: Svelte 5 Runes for fine-grained reactivity
- **Efficient Data Structures**: Optimized data structures for fast lookups
- **Lazy Loading**: On-demand loading of large datasets with pagination support

## Troubleshooting Guide

### Common Issues and Solutions

#### Environment Setup Issues

**Issue**: Nix environment not activating properly

```bash
# Error: command not found: holochain
```

**Solutions**:

```bash
# 1. Ensure you're in the project root
cd requests-and-offers

# 2. Activate Nix environment manually
nix develop

# 3. Verify tools are available
which holochain && which hc && which rustc
```

#### Port Conflicts

**Issue**: Port conflicts when starting development

```bash
# Error: Port 8888 is already in use
```

**Solutions**:

```bash
# 1. Kill processes using the ports
lsof -ti:8888 | xargs kill -9    # Kill process on port 8888
lsof -ti:4444 | xargs kill -9    # Kill process on port 4444
```

#### Zome Compilation Failures

**Issue**: Zome compilation failures

```bash
# Error: failed to compile Rust zomes
```

**Solutions**:

```bash
# 1. Ensure you're in Nix environment
nix develop

# 2. Clean build artifacts
rm -rf target/
rm -rf dnas/requests_and_offers/target/

# 3. Rebuild zomes
bun build:zomes
```

### Testing Troubleshooting

#### Unit Tests Failing with hREA Integration Errors

**Issue**: Unit tests failing with hREA integration errors

```bash
# Error: Cannot find hREA DNA
```

**Solutions**:

```bash
# 1. Use autonomous test execution (RECOMMENDED)
nix develop --command bun test:unit

# 2. Ensure hREA DNA is downloaded
bun run download-hrea

# 3. Verify Nix environment is active
echo $IN_NIX_SHELL    # Should output "1" or "impure"

# 4. Check hREA DNA location
ls -la dnas/hrea/     # Should contain DNA files
```

## Future Enhancements

### Planned Features

1. **Exchange Completion Workflows**: Full exchange lifecycle with commitment fulfillment and economic event creation
2. **Advanced Analytics**: Usage statistics, trend analysis, and reporting dashboards
3. **Mobile Application**: React Native or Flutter mobile app
4. **Advanced Recommendation Algorithms**: Machine learning-based matching and recommendation
5. **Reputation and Rating Systems**: Quality assurance through user ratings and feedback
6. **Community Governance**: Decentralized governance mechanisms for community decision-making
7. **Cross-Platform Integration**: Integration with external platforms and services
8. **Advanced Search**: Full-text search, filtering, and sophisticated discovery

### Technical Improvements

1. **Performance Optimization**: Further optimization of data structures and algorithms
2. **Advanced Caching**: Implementation of advanced caching strategies for improved performance
3. **Microservices Architecture**: Potential migration to microservices for better scalability
4. **AI Integration**: Integration of artificial intelligence for enhanced user experience
5. **Blockchain Integration**: Potential integration with other blockchain networks
6. **IoT Integration**: Integration with Internet of Things devices
7. **Voice Interface**: Voice-controlled interface for accessibility
8. **Augmented Reality**: AR features for enhanced user experience

## Community and Support

### Communication Channels

- **Community**: [hAppenings Community](https://happenings.community/)
- **Discord**: [Join our Discord](https://discord.gg/happening)
- **GitHub**: [GitHub Issues](https://github.com/happenings-community/requests-and-offers/issues)
- **Documentation**: [Project Documentation](documentation/DOCUMENTATION_INDEX.md)
- **Contributing**: [Contributing Guide](documentation/guides/contributing.md)

### Getting Involved

We welcome contributions from the community! Whether you're a developer, designer, tester, or user, there are many ways to contribute:

1. **Report Issues**: Help us identify and fix bugs
2. **Contribute Code**: Help us improve the codebase
3. **Documentation**: Help us improve our documentation
4. **Testing**: Help us test new features and report issues
5. **Translation**: Help us translate the application into other languages
6. **Design**: Help us improve the user interface and user experience
7. **Community Support**: Help new users get started with the application

### Code of Conduct

Please follow our [Code of Conduct](documentation/guides/contributing.md#code-of-conduct) to maintain a welcoming and inclusive environment for all contributors.

## License and Copyright

This project is licensed under the [Cryptographic Autonomy License v1.0](LICENSE.md) (CAL-1.0) - see the LICENSE file for details.

Copyright (c) 2025 hAppenings Community

The Cryptographic Autonomy License (CAL) is a copyleft license that protects user autonomy and privacy while ensuring that derivative works remain open. Key features include:

1. **User Autonomy Protection**: Guarantees that users have complete control over their data and keys
2. **Privacy Protection**: Prohibits any form of surveillance or data collection without explicit user consent
3. **Copyleft**: Ensures that derivative works remain open and protect user rights
4. **Commercial Use**: Allows commercial use while protecting user rights
5. **Patent Grant**: Provides patent protection for contributors and users

For more information about the CAL license, visit [cryptographicautonomylicense.com](https://cryptographicautonomylicense.com/)

## Acknowledgements

We would like to thank the following individuals and organizations for their contributions to this project:

1. **Holochain Team**: For creating the amazing Holochain platform
2. **hAppenings Community**: For their continuous support and feedback
3. **Contributors**: All the amazing people who have contributed to this project
4. **Open Source Community**: For the incredible tools and libraries that make this project possible

This project stands on the shoulders of giants, built upon years of research and development in distributed systems, cryptography, and decentralized technologies.

## Conclusion

The Requests and Offers project represents a significant step towards a more decentralized and equitable internet. By leveraging the power of Holochain and the principles of the hREA framework, we're creating a platform that puts users in control of their data and interactions while enabling efficient resource coordination.

We believe that the future of the internet lies in decentralized, agent-centric platforms that prioritize user autonomy, privacy, and community cooperation. This project is our contribution to that vision, and we hope it inspires others to explore new possibilities in decentralized application development.

As we continue to develop and improve this platform, we remain committed to our core principles of openness, transparency, and user empowerment. We invite you to join us on this journey and help build a better, more decentralized future for everyone.

Thank you for your interest in this project!
