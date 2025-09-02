# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🚨 DOCUMENTATION-FIRST APPROACH - MANDATORY

**CRITICAL RULE**: Before working on ANY task, you MUST systematically check the relevant documentation first. This project has comprehensive documentation that contains crucial context, patterns, and constraints.

### Required Documentation Check Process:

1. **Start with [📋 Documentation Index](documentation/DOCUMENTATION_INDEX.md)** - Find relevant docs for your task
2. **Check [🚀 Quick Reference Guide](documentation/QUICK_REFERENCE.md)** - Essential commands and patterns
3. **Review domain-specific guidelines** - Development patterns and architectural constraints
4. **Validate against [📊 Project Status](documentation/status.md)** - Current implementation status

### Documentation Access

**Essential Reading**:
- **[📋 Documentation Index](documentation/DOCUMENTATION_INDEX.md)** - Complete catalog of all project documentation
- **[🚀 Quick Reference Guide](documentation/QUICK_REFERENCE.md)** - Essential commands, patterns, and workflows
- **[🔧 Troubleshooting Guide](documentation/TROUBLESHOOTING.md)** - Common issues and solutions
- **[📊 Project Status](documentation/status.md)** - Current implementation status and progress

**Development Guidelines**:
- **[Development Guidelines](documentation/ai/rules/development-guidelines.md)** - Effect-TS patterns, Svelte 5 standards, schema validation
- **[Architecture Patterns](documentation/ai/rules/architecture-patterns.md)** - 7-layer architecture, service patterns, store management
- **[Testing Framework](documentation/ai/rules/testing-framework.md)** - Comprehensive testing strategy
- **[Domain Implementation](documentation/ai/rules/domain-implementation.md)** - Administration patterns, error management, utilities

**API References**:
- **[Frontend Services API](documentation/technical-specs/api/frontend/services.md)** - Effect-TS service layer APIs
- **[Store-Helpers API](documentation/technical-specs/api/frontend/store-helpers.md)** - Comprehensive store utilities
- **[Backend Zome Functions](documentation/technical-specs/api/backend/zome-functions.md)** - Holochain zome function reference

**Workflow**: Always consult documentation → understand context → implement → validate against patterns

## Development Commands

### Environment Setup

```bash
# Enter Nix development environment (required for zome development)
nix develop

# Install dependencies
bun install
```

### Running the Application

```bash
# Start with default 2 agents
bun start

# Start with custom number of agents
AGENTS=3 bun start

# Start in test mode
bun start:test

# Start in production mode
bun start:prod

# Start with Tauri desktop app
bun start:tauri
```

### Testing

```bash
# Run all tests (requires Nix environment)
bun test

# Frontend tests only
bun test:ui

# Unit tests (requires Nix environment for hREA integration)
nix develop --command bun test:unit

# Integration tests
cd ui && bun test:integration

# E2E tests
cd ui && bun test:e2e
cd ui && bun test:e2e:holochain

# Specific zome tests
bun test:misc           # Misc zome functionality
bun test:users          # Users functionality
bun test:administration # Administration zome
bun test:organizations  # Organizations functionality
bun test:requests       # Requests zome
bun test:offers         # Offers zome
bun test:service-types  # Service types functionality
bun test:mediums-of-exchange # Mediums of exchange
bun test:exchanges           # Exchanges functionality

# Backend Tryorama tests
cd tests && bun test
```

### Building

```bash
# Build zomes (requires Nix environment)
bun build:zomes

# Build complete hApp
bun build:happ

# Package for distribution
bun package

# Check TypeScript
cd ui && bun run check
```

### Code Quality

```bash
# Lint and format UI code
cd ui && bun run lint
cd ui && bun run format
```

## Architecture Overview

### Technology Stack

- **Backend**: Holochain with Rust zomes (coordinator/integrity pattern)
- **Frontend**: SvelteKit + Svelte 5 Runes + TailwindCSS + SkeletonUI
- **Runtime**: Bun for TypeScript/JavaScript
- **State Management**: Effect-TS for async operations, Svelte 5 Runes for reactivity
- **Development Environment**: Nix shell (for DNA/zome development only)

### Project Structure

```
requests-and-offers/
├── dnas/requests_and_offers/
│   ├── zomes/
│   │   ├── coordinator/     # Business logic zomes
│   │   └── integrity/       # Data validation zomes
│   └── utils/               # Shared utilities
├── ui/                      # SvelteKit frontend
│   ├── src/lib/
│   │   ├── components/      # UI components (organized by feature)
│   │   ├── services/        # Service layer (Holochain, hREA)
│   │   ├── stores/          # Svelte stores (state management)
│   │   ├── composables/     # Component logic abstraction
│   │   ├── schemas/         # Effect Schema validation
│   │   ├── errors/          # Centralized error handling
│   │   └── utils/           # Utility functions
│   └── src/routes/          # SvelteKit routes/pages
├── tests/                   # Tryorama integration tests
└── documentation/           # Comprehensive project documentation
```

### Architectural Patterns

#### 7-Layer Effect-TS Architecture

The codebase follows a standardized 7-layer pattern:

1. **Service Layer**: Effect-native services with Context.Tag dependency injection
2. **Store Layer**: Factory functions with Svelte 5 Runes + 9 standardized helper functions
3. **Schema Validation**: Effect Schema with strategic validation boundaries
4. **Error Handling**: Domain-specific tagged errors with centralized management
5. **Composables**: Component logic abstraction using Effect-based functions
6. **Components**: Svelte 5 + accessibility focus, using composables for business logic
7. **Testing**: Comprehensive Effect-TS coverage across all layers

#### Implementation Status

**✅ ALL DOMAINS CONVERTED TO EFFECT-TS (100%)**
- **Service Types Domain**: ✅ Fully completed (100%) - serves as architectural template
- **Requests Domain**: ✅ Fully completed (100%) - patterns successfully applied  
- **Offers Domain**: ✅ Fully completed (100%) - all 9 helper functions implemented
- **Users Domain**: ✅ Fully completed (100%) - Effect-TS standardization complete
- **Organizations Domain**: ✅ Fully completed (100%) - Effect-TS standardization complete
- **Administration Domain**: ✅ Fully completed (100%) - Effect-TS standardization complete
- **Exchanges Domain**: ✅ Fully completed (100%) - complete Effect-TS implementation with all layers
- **Mediums of Exchange Domain**: ✅ Fully completed (100%) - Effect-TS standardized with store helpers

**🎯 CURRENT FOCUS**: All 8 domains are now fully standardized with Effect-TS. Focusing on comprehensive documentation enhancement and pattern refinement.

### Effect-TS Guidelines

#### When to Use Effect.gen vs .pipe

- **Effect.gen**: Injecting dependencies, conditional logic, sequential operations
- **.pipe**: Error handling, tracing, layer building, simple transforms

#### Service Layer Pattern

```typescript
// Effect-native service with dependency injection
export const ServiceTypeService =
  Context.GenericTag<ServiceTypeService>("ServiceTypeService");

export const makeServiceTypeService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createServiceType = (input: CreateServiceTypeInput) =>
    Effect.gen(function* () {
      // Business logic here
    });

  return { createServiceType };
});
```

#### Store Pattern with Svelte 5 Runes

```typescript
// Factory function returning Effect-based store
export const createServiceTypesStore = () => {
  let entities = $state<UIServiceType[]>([]);

  const fetchEntities = Effect.gen(function* () {
    // Use standardized helper functions
    const records = yield* serviceTypeService.getAllServiceTypes();
    entities = mapRecordsToUIEntities(records);
  });

  return { entities: () => entities, fetchEntities };
};
```

#### The 9 Standardized Store Helper Functions

Each domain store should implement these standardized helpers organized into 5 modules:

**Core Module** (`core.ts`):
1. **Loading State Helper**: `withLoadingState` - Wraps operations with consistent loading/error patterns
2. **Error Handling**: `createErrorHandler`, `createGenericErrorHandler` - Standardized error management

**Cache Module** (`cache-helpers.ts`):
3. **Cache Sync Helper**: `createGenericCacheSyncHelper` - Synchronizes cache with state arrays for CRUD operations
4. **Status Transition Helper**: `createStatusTransitionHelper` - Manages status changes with atomic updates
5. **Collection Processor**: `processMultipleRecordCollections` - Handles complex responses with multiple collections

**Event Module** (`event-helpers.ts`):
6. **Event Emission Helpers**: `createStandardEventEmitters`, `createStatusAwareEventEmitters` - Standardized event broadcasting

**Record Module** (`record-helpers.ts`):
7. **Entity Creation Helper**: `createUIEntityFromRecord` - Converts Holochain records to UI entities with error recovery
8. **Record Mapping Helper**: `mapRecordsToUIEntities` - Maps arrays of records to UI entities with null safety

**Fetching Module** (`fetching-helpers.ts`):
9. **Data Fetching Helper**: `createEntityFetcher`, `createCacheIntegratedFetcher` - Higher-order fetching functions with loading/error state

**Complete API Reference**: See [Store-Helpers API](documentation/technical-specs/api/frontend/store-helpers.md) for comprehensive usage examples and implementation details.

### Domain Structure

Each domain (service-types, requests, offers, users, organizations, administration, exchanges, mediums-of-exchange) follows consistent patterns:

- Service layer in `ui/src/lib/services/zomes/`
- Store management in `ui/src/lib/stores/`
- Components in `ui/src/lib/components/{domain}/`
- Composables in `ui/src/lib/composables/domain/{domain}/`
- Schemas in `ui/src/lib/schemas/`
- Error definitions in `ui/src/lib/errors/`

### hREA Integration

The application integrates with hREA (Holochain Resource-Event-Agent) framework:

- Requests map to hREA Intents
- Offers map to hREA Proposals
- Service Types map to ResourceSpecifications
- Users/Organizations map to Agents
- hREA DNA is downloaded during setup: `bun run download-hrea`

### Testing Strategy

- **Backend**: Tryorama tests for multi-agent scenarios (`tests/`)
- **Frontend Unit**: Vitest with Effect-TS testing utilities (`ui/tests/unit/`)
- **Frontend Integration**: Component and store integration tests (`ui/tests/integration/`)
- **E2E**: Playwright tests with Holochain integration (`ui/tests/e2e/`)
- **Status Tests**: Dedicated Rust unit tests for status functionality

**✅ All Unit Tests Passing**: All 268 unit tests are passing with no unhandled Effect errors. Mocks have been standardized for all services and stores, ensuring test isolation.

**Testing Documentation**: See [Testing Framework](documentation/ai/rules/testing-framework.md) for comprehensive testing strategy and implementation details.

### Important Notes

- Unit tests require Nix environment due to hREA integration
- Use `nix develop --command bun test:unit` for autonomous test execution
- Always build zomes before running tests: `bun build:zomes`
- Use Bun as package manager (not npm/yarn)
- Follow Effect-TS patterns for all async operations and error handling
- Maintain consistency with the established 7-layer architecture pattern

### Development Patterns

#### Error Handling

- Use domain-specific tagged errors (e.g., `ServiceTypeError`, `RequestError`)
- Centralized error contexts in `ui/src/lib/errors/error-contexts.ts`
- Consistent error transformation: `Error.fromError(error, context)`

#### Cache Management

- Use module-level cache with TTL (default: 5 minutes)
- Implement cache sync helpers for state management
- Clear cache on mutations to ensure data freshness

## Development Features System

The project includes a comprehensive development features system for managing mock data and debug tools:

- **Development Mode**: Full features enabled (`bun start`)
- **Test Mode**: Dev features enabled, mock buttons disabled (`bun start:test`)  
- **Production Mode**: All dev features tree-shaken out (`bun start:prod`)

Use `shouldShowMockButtons()` from `$lib/services/devFeatures.service` for conditional dev features.

**Technical Details**: See [Development Features System](documentation/technical-specs/development-features-system.md) for comprehensive implementation details.

## Development Workflow

**MANDATORY**: Always start with [Documentation Index](documentation/DOCUMENTATION_INDEX.md) to find relevant documentation for your task.

### Implementation Process

When implementing new domains, follow the standardized 7-layer implementation order:

1. **Zome Layer** (Backend) → 2. **Service Layer** → 3. **Store Layer** → 4. **Composable Layer** → 5. **Component Layer** → 6. **Error Handling** → 7. **Testing**

**Use Service Types as Template**: The service-types domain is 100% complete and serves as the architectural template for all new implementations.

### Required Documentation Consultation

Before starting work, consult these documentation sources:

1. **[Development Guidelines](documentation/ai/rules/development-guidelines.md)** - Effect-TS patterns and Svelte 5 standards
2. **[Architecture Patterns](documentation/ai/rules/architecture-patterns.md)** - 7-layer architecture implementation
3. **[Domain Implementation](documentation/ai/rules/domain-implementation.md)** - Domain-specific patterns and utilities
4. **[Store-Helpers API](documentation/technical-specs/api/frontend/store-helpers.md)** - Complete utilities reference
5. **[Project Status](documentation/status.md)** - Current implementation status

### Domain Implementation Checklist

- [ ] **Documentation reviewed** - Consulted relevant docs before starting
- [ ] **Zome implemented** with coordinator/integrity pattern
- [ ] **Service layer** with Effect-TS and dependency injection
- [ ] **Store layer** with all 9 helper functions from store-helpers API
- [ ] **Composable layer** abstracting business logic
- [ ] **Component layer** using composables
- [ ] **Error handling** with domain-specific errors and contexts
- [ ] **Tests** covering all layers (backend + frontend)
- [ ] **Documentation** updated with new domain

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
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

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


- NEVER RUN THE APPLICATION YOURSELF ! YOU CAN'T AND IT DISCONNECT THE USER WHEN TESTING IT ITSELF!
