# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Environment Setup
```bash
nix develop                    # Required for zomes - enters Nix shell (Holochain 0.6)
bun install                    # Install dependencies
```

**Note**: This project has been migrated to **Holochain 0.6**. Key changes include:
- HDK updated from 0.5.3 to 0.6.0
- HDI updated from 0.6.3 to 0.7.0
- Link API migrated to use `LinkQuery::new()` and `GetStrategy::Local`
- All `delete_link()` calls now require `GetOptions::default()`
- DNA manifest uses `path` field instead of `bundled`

### Development Servers
```bash
bun start                      # Development mode (2 agents, mock buttons enabled)
AGENTS=3 bun start            # Custom number of agents
bun start:test                # Test mode (limited dev features, no mock buttons)
bun start:prod                # Production mode (all dev features disabled)
bun start:tauri               # Desktop app with Tauri
```

### Building
```bash
bun build:zomes               # Build Rust zomes (requires Nix)
bun build:happ                # Build complete hApp
bun package                   # Package for distribution
```

### Testing
```bash
bun test                      # All tests (builds zomes + runs tests)
bun test:ui                   # Frontend tests only
bun test:unit                 # Unit tests (requires Nix environment)
nix develop --command bun test:unit  # Autonomous unit test execution
bun test:integration          # Integration tests
```

### Code Quality (from ui/ directory)
```bash
cd ui && bun run lint         # Lint frontend code
cd ui && bun run format       # Format frontend code
cd ui && bun run check        # TypeScript check
```

### Deployment & Release
```bash
bun deploy                    # Full deployment across all repositories
bun deploy:dry-run            # Preview deployment without executing
bun deploy:status             # Check deployment status
bun deploy:validate           # Validate completed deployment
bun deploy:rollback           # Rollback failed deployment
```

## Architecture Overview

This is a **Holochain hApp** with a **SvelteKit frontend** using a **7-layer Effect-TS architecture**. The project is a peer-to-peer bulletin board for requests and offers.

### Core Architecture: 7-Layer Effect-TS Pattern

All domains follow this standardized structure:
1. **Service Layer** - Effect-native services with Context.Tag dependency injection
2. **Store Layer** - Svelte 5 Runes with Effect integration and 9 standardized helper functions
3. **Schema Validation** - Effect Schema at business boundaries with branded types
4. **Error Handling** - Domain-specific tagged errors with meaningful contexts
5. **Composables** - Component logic abstraction bridging stores and components
6. **Components** - Svelte 5 with accessibility focus (WCAG compliance)
7. **Testing** - Comprehensive Effect-TS coverage (Tryorama + Vitest)

### Tech Stack
- **Backend**: Holochain (Rust) with hREA framework integration
- **Frontend**: SvelteKit 5 + Svelte 5 Runes + Effect-TS + TypeScript
- **Styling**: TailwindCSS with Skeleton UI
- **Testing**: Tryorama (backend) + Vitest (frontend) with comprehensive CI/CD
- **Package Manager**: Bun (requires Nix for zome compilation)
- **Desktop Apps**: Tauri-based Kangaroo desktop applications
- **Deployment**: Multi-repository deployment with automated releases

### Project Structure
```
requests-and-offers/
├── dnas/requests_and_offers/     # Holochain DNA (coordinator & integrity zomes)
├── ui/                           # SvelteKit frontend with Effect-TS architecture
│   ├── src/lib/
│   │   ├── services/             # Effect-TS services (one per domain)
│   │   ├── stores/               # Svelte stores with Effect integration
│   │   ├── composables/          # Business logic abstraction
│   │   ├── schemas/              # Effect Schema validation
│   │   └── errors/               # Tagged error definitions
│   └── src/routes/               # SvelteKit pages
├── deployment/                   # Deployment repositories as git submodules
│   ├── kangaroo-electron/        # Desktop app (Electron/Tauri) repository
│   └── homebrew/                 # Homebrew formula repository
│   └── scripts                   # Deployment automation scripts
├── tests/                        # Tryorama integration tests
└── documentation/                # Comprehensive project docs
```

## Development Features System

The project uses atomic environment-based feature management where each development feature can be controlled independently:

### Atomic Environment Variables

**Development Features:**
- `VITE_MOCK_BUTTONS_ENABLED` - Controls mock data buttons in forms (for testing data entry)
- `VITE_PEERS_DISPLAY_ENABLED` - Controls network peers display in test mode (shows all agents)

### Development Mode (`bun start`)
- Uses `.env`
- Mock buttons typically enabled for testing
- Full debugging experience

This atomic approach allows fine-grained control over development features without a master switch, making testing and development more flexible.

## Domain Implementation Pattern

All 8 domains are fully standardized with the 7-layer Effect-TS architecture:
- Service Types (template domain - 100% complete)
- Requests (100% complete)
- Offers (100% complete)
- Users (100% complete)
- Organizations (100% complete)
- Administration (100% complete)
- Exchanges (100% complete)
- Mediums of Exchange (100% complete)

When implementing new features, follow the established patterns using Service Types domain as the reference template.

## Key Development Patterns

### Effect-TS Service Pattern
```typescript
export const MyService = Context.GenericTag<MyService>("MyService");

export const makeMyService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createEntity = (input: CreateInput) =>
    client.callZome({
      zome_name: "my_zome",
      fn_name: "create_entity",
      payload: yield* Schema.decodeUnknown(InputSchema)(input),
    }).pipe(
      Effect.mapError((error) => new MyDomainError({ cause: error }))
    );

  return { createEntity };
});
```

### Store Pattern with 9 Standardized Helper Functions
Each store implements these helpers for consistency:
- `createUIEntity()` - Entity creation from Holochain records
- `mapRecordsToUIEntities()` - Consistent record mapping with null safety
- `createCacheSyncHelper()` - Cache-to-state synchronization
- `createStatusAwareEventEmitters()` - Type-safe event emission with status support
- `createEntitiesFetcher()` - Data fetching with loading state
- `withLoadingState()` - Consistent loading/error state management
- `createRecordCreationHelper()` - Standardized entity creation with validation
- `createStatusTransitionHelper()` - Atomic status updates (pending/approved/rejected)
- `processMultipleRecordCollections()` - Complex response handling with multiple collections

### Service Types Domain Template
The **Service Types** domain serves as the complete architectural template:
- Location: `ui/src/lib/services/zomes/serviceTypes.service.ts`
- Implements all 9 helper functions with comprehensive documentation
- Includes status management (pending/approved/rejected workflow)
- Provides error boundaries and recovery patterns
- Use this as the reference for implementing new domains

## Critical Requirements

### Nix Environment
Unit tests require Nix environment due to hREA integration. Always use:
```bash
nix develop --command bun test:unit
```

### Port Management
The project uses dynamic port allocation. If conflicts occur:
```bash
lsof -ti:8888 | xargs kill -9
lsof -ti:4444 | xargs kill -9
```

### hREA Integration
The project depends on hREA framework. The hREA DNA is automatically downloaded to `workdir/hrea.dna` on first install.

### Git Submodules
The project uses git submodules for unified deployment repository management:

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/happenings-community/requests-and-offers.git

# Initialize submodules in existing clone
git submodule update --init --recursive

# Update submodules to latest
git submodule update --remote

# Switch to specific submodule for development
cd deployment/kangaroo-electron  # Desktop app development
cd deployment/homebrew          # Homebrew formula development
```

The deployment system automatically initializes and validates submodules during deployment.

## Testing Strategy

### Backend Testing (Tryorama)
- Multi-agent testing scenarios
- Located in `tests/` directory
- Run with `bun test` (includes zome build)

### Frontend Testing (Vitest)
- Unit tests: `cd ui && bun run test:unit`
- Integration tests: `cd ui && bun run test:integration`
- E2E tests: Playwright with various configurations

### Test Execution
```bash
# All tests with zome build
bun test

# Frontend only (requires pre-built zomes)
cd ui && bun test

# Specific backend test categories
bun test:requests
bun test:offers
bun test:service-types
# ... etc for each domain
```

## Common Workflows

### Adding New Domain
1. Create coordinator & integrity zomes in `dnas/`
2. Implement Effect-TS service in `ui/src/lib/services/`
3. Create store with all 9 helper functions in `ui/src/lib/stores/`
4. Add composables in `ui/src/lib/composables/`
5. Build components using established patterns
6. Define domain-specific errors in `ui/src/lib/errors/`
7. Add comprehensive tests for all layers

### Development Debugging
- Run `bun check` regularly for type safety
- Use development mode for mock data buttons
- Check browser console for Effect-TS error traces
- Use Holochain playground for debugging backend
- Consult comprehensive documentation in `documentation/`

## Documentation

Essential documentation is available in the `documentation/` directory:
- [Architecture Overview](documentation/architecture.md) - Detailed 7-layer architecture
- [Quick Reference](documentation/QUICK_REFERENCE.md) - Commands and patterns
- [Project Overview](documentation/project-overview.md) - Complete project introduction
- [Developer Guide](documentation/guides/getting-started.md) - Setup and workflow
- [Full Documentation Index](documentation/DOCUMENTATION_INDEX.md) - Complete catalog

The project includes comprehensive pattern documentation in `documentation/ai/rules/` covering all aspects of the 7-layer architecture.

## Advanced Development Features

### Deployment System
Comprehensive unified deployment with git submodules:
- **WebApp**: Holochain application build and GitHub release
- **Kangaroo**: Cross-platform desktop applications (Windows, macOS, Linux)
- **Homebrew**: Automatic formula updates with checksums
- **Submodule Management**: Automatic initialization and validation of deployment repositories
- **Validation**: Post-deployment testing and rollback capabilities

### Testing Infrastructure
- **268 Unit Tests**: All passing with Effect-TS integration
- **Multi-Agent Testing**: Tryorama for Holochain scenarios
- **Integration Testing**: Vitest with comprehensive coverage
- **CI/CD Pipeline**: Automated testing and validation
- **Test Modes**: Development, test, and production configurations

### Error Handling & Debugging
- **Domain-Specific Errors**: Tagged errors with meaningful contexts
- **Error Boundaries**: Comprehensive error recovery patterns
- **Health Check Scripts**: Environment validation utilities
- **Debug Logging**: RUST_LOG and VITE_LOG_LEVEL support
- **Troubleshooting Guide**: Comprehensive `documentation/TROUBLESHOOTING.md`

### Performance Optimization
- **Caching**: EntityCache with configurable expiry
- **Tree-Shaking**: Development code removed from production builds
- **Lazy Loading**: On-demand data fetching with loading states
- **Bundle Optimization**: Vite-based build optimization
- **Resource Management**: Intelligent cache invalidation


- Don't run the app yourself, it break the manual testing of the user.
