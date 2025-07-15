# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Specific zome tests
bun test:misc           # Misc zome functionality
bun test:users          # Users functionality
bun test:administration # Administration zome
bun test:organizations  # Organizations functionality
bun test:requests       # Requests zome
bun test:offers         # Offers zome
bun test:service-types  # Service types functionality
bun test:mediums-of-exchange # Mediums of exchange

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

- **Service Types Domain**: ✅ Fully completed (100%) - serves as template
- **Requests Domain**: ✅ Fully completed (100%) - patterns successfully applied
- **Offers Domain**: 🔄 In progress - applying established patterns
- **Other Domains**: Effect-based, queued for standardization

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

### Domain Structure

Each domain (service-types, requests, offers, etc.) follows consistent patterns:

- Service layer in `ui/src/lib/services/`
- Store management in `ui/src/lib/stores/`
- Components in `ui/src/lib/components/{domain}/`
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

### Important Notes

- Unit tests require Nix environment due to hREA integration
- Use `nix develop --command bun test:unit` for autonomous test execution
- Always build zomes before running tests: `bun build:zomes`
- Use Bun as package manager (not npm/yarn)
- Follow Effect-TS patterns for all async operations and error handling
- Maintain consistency with the established 7-layer architecture pattern

## Memory Notes

- **Design & UI**:
  - In dark mode (admin panel), use the color primary-400 or less instead of primary-500 