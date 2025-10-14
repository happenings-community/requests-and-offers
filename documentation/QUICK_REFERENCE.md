# Quick Reference Guide

Essential commands, patterns, and workflows for efficient development in the Requests and Offers project.

## 🚀 Getting Started

### Initial Setup

```bash
# Clone with submodules and enter project
git clone --recurse-submodules https://github.com/happening-community/requests-and-offers.git
cd requests-and-offers

# Setup environment
nix develop                    # Enter Nix shell (required for zomes)
bun install                    # Install dependencies
git submodule update --init --recursive  # Initialize submodules
bun start                      # Start development (2 agents)
```

### Development Commands

```bash
# Development servers
bun start                      # 2 agents (default)
AGENTS=3 bun start            # Custom number of agents
bun start:test                # Test mode (dev features, no mock buttons)
bun start:prod                # Production mode (all dev features disabled)

# Building
bun build:zomes               # Build Rust zomes
bun build:happ                # Build complete hApp
bun package                   # Package for distribution

# Testing
bun test                      # All tests
bun test:ui                   # Frontend tests only
bun test:unit                 # Unit tests (requires Nix)
nix develop --command bun test:unit  # Autonomous unit test execution
bun test:integration          # Integration tests
cd tests && bun test          # Backend Tryorama tests

# Code quality
cd ui && bun run lint         # Lint frontend code
cd ui && bun run format       # Format frontend code
cd ui && bun run check        # TypeScript check

# Submodule management
git submodule update --remote kangaroo-electron    # Update desktop app
git submodule update --remote homebrew               # Update homebrew formula
cd deployment/kangaroo-electron && npm run tauri dev   # Desktop app development
cd deployment/kangaroo-electron && npm run tauri build  # Build desktop app

# Deployment automation
./deployment/scripts/deploy.sh deploy 0.1.X          # Full deployment
./deployment/scripts/deploy.sh status               # Check deployment status
```

## 🏗️ Architecture Quick Reference

### 7-Layer Effect-TS Architecture

```
1. Service Layer      → Effect-native services with Context.Tag DI
2. Store Layer        → Svelte 5 Runes + Effect integration
3. Schema Validation  → Effect Schema at business boundaries
4. Error Handling     → Domain-specific tagged errors
5. Composables        → Component logic abstraction
6. Components         → Svelte 5 + accessibility focus
7. Testing            → Comprehensive Effect-TS coverage
```

### Project Structure

```
requests-and-offers/
├── dnas/requests_and_offers/     # Holochain DNA
│   └── zomes/                    # Coordinator & integrity zomes
├── ui/                           # SvelteKit frontend
│   ├── src/lib/
│   │   ├── components/           # Feature-organized components
│   │   ├── services/             # Effect-TS services
│   │   ├── stores/               # Svelte stores with Effect
│   │   ├── composables/          # Business logic abstraction
│   │   ├── schemas/              # Effect Schema validation
│   │   └── errors/               # Tagged error definitions
│   └── src/routes/               # SvelteKit pages
├── deployment/                   # Deployment repositories as submodules
│   ├── kangaroo-electron/        # Desktop app (Tauri) submodule
│   ├── homebrew/                 # Homebrew formula submodule
│   └── scripts/                  # Deployment automation scripts
├── tests/                        # Tryorama integration tests
└── documentation/                # Comprehensive docs
```

## 💻 Development Patterns

### Effect-TS Service Pattern

```typescript
// Service definition with dependency injection
export const MyService = Context.GenericTag<MyService>("MyService");

export const makeMyService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createEntity = (input: CreateInput) =>
    Effect.gen(function* () {
      const validated = yield* Schema.decodeUnknown(InputSchema)(input);
      const result = yield* client.callZome({
        zome_name: "my_zome",
        fn_name: "create_entity",
        payload: validated,
      });
      return yield* Schema.decodeUnknown(EntitySchema)(result);
    }).pipe(Effect.mapError((error) => new MyDomainError({ cause: error })));

  return { createEntity };
});
```

### Svelte Store Pattern

```typescript
// Store factory with Svelte 5 Runes + Effect
export const createEntitiesStore = () => {
  let entities = $state<UIEntity[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  const service = yield * MyService;

  const fetchAll = Effect.gen(function* () {
    loading = true;
    error = null;
    try {
      const records = yield* service.getAllEntities();
      entities = mapRecordsToUIEntities(records);
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  return {
    entities: () => entities,
    loading: () => loading,
    fetchAll,
  };
};
```

### Component Pattern

```svelte
<script lang="ts">
  // Props with defaults
  const {
    data = [],
    loading = false,
    onAction = () => {}
  }: ComponentProps = $props();

  // Reactive state
  let localState = $state({ filter: '' });

  // Derived values
  const filteredData = $derived(
    data.filter(item => item.name.includes(localState.filter))
  );

  // Composable for business logic
  const entityManager = useEntityManager();
</script>

<div role="main" aria-label="Entity list">
  <!-- Accessible markup -->
</div>
```

## 🧪 Testing Patterns

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

## 🔧 Common Workflows

### Adding a New Domain

1. **Backend**: Create coordinator & integrity zomes
2. **Service**: Implement Effect-TS service with Context.Tag
3. **Store**: Create store with 9 standardized helper functions
4. **Composable**: Extract business logic
5. **Components**: Build UI with accessibility focus
6. **Errors**: Define domain-specific tagged errors
7. **Tests**: Add backend (Tryorama) + frontend (Vitest) tests

### Domain Implementation Checklist

- [ ] Zome implemented (coordinator/integrity pattern)
- [ ] Service layer with Effect-TS and dependency injection
- [ ] Store layer with all 9 helper functions
- [ ] Composable layer for business logic abstraction
- [ ] Component layer using composables
- [ ] Error handling with domain-specific errors
- [ ] Tests covering all layers
- [ ] Documentation updated

### The 9 Standardized Store Helper Functions

1. **Entity Creation Helper** - Converts records to UI entities
2. **Record Mapping Helper** - Maps arrays with error recovery
3. **Cache Sync Helper** - Synchronizes cache with state arrays
4. **Event Emission Helpers** - Standardized event broadcasting
5. **Data Fetching Helper** - Higher-order fetching with loading states
6. **Loading State Helper** - Wraps operations with loading patterns
7. **Record Creation Helper** - Processes new records and updates cache
8. **Status Transition Helper** - Manages status changes atomically
9. **Collection Processor** - Handles complex multi-collection responses

## 🖥️ Desktop Application Development

### Kangaroo Desktop App Workflow

```bash
# Desktop app development (in submodule)
cd deployment/kangaroo-electron
npm run tauri dev                    # Start desktop app in dev mode

# Build desktop applications
npm run tauri build                  # Build for all platforms
npm run tauri build --target x64   # Build specific platform

# Update kangaroo submodule
git submodule update --remote kangaroo-electron
cd deployment/kangaroo-electron
npm install  # Install any new dependencies
```

### Deployment Automation

```bash
# Full automated deployment (webapp + desktop + homebrew)
./deployment/scripts/deploy.sh deploy 0.1.0

# Dry run to preview actions
./deployment/scripts/deploy.sh deploy 0.1.0 --dry-run

# Check deployment status
./deployment/scripts/deploy.sh status

# Validate completed deployment
./deployment/scripts/deploy.sh validate 0.1.0
```

### Platform-Specific Builds

The kangaroo desktop app supports:
- **Windows**: `.exe` installer with code signing
- **macOS**: DMG packages (Intel + Apple Silicon)
- **Linux**: AppImage and .deb packages

## 🔍 Troubleshooting

### Common Issues

**Unit tests failing with hREA errors:**

```bash
nix develop --command bun test:unit  # Use autonomous execution
```

**Port conflicts:**

```bash
lsof -ti:8888 | xargs kill -9     # Kill process on port 8888
lsof -ti:4444 | xargs kill -9     # Kill process on port 4444
```

**Nix environment issues:**

```bash
nix develop --command which holochain  # Verify Nix tools
direnv allow                            # If using direnv
```

**Zome build failures:**

```bash
nix develop                    # Ensure in Nix shell
bun build:zomes               # Rebuild zomes
```

### Development Features System

The project includes a comprehensive system for managing development-only features through environment variables:

**Three Deployment Modes:**

```bash
# Development Mode - Full dev experience with mock buttons
bun start              # Uses .env.development, all features enabled

# Test Mode - Alpha testing simulation without mock buttons
bun start:test         # Uses .env.test, limited dev features

# Production Mode - Clean production build with zero dev overhead
bun start:prod         # Uses .env.production, all dev features tree-shaken
```

**Service Integration:**

```typescript
// Service-based feature checking
import { DevFeaturesServiceTag } from '$lib/services/devFeatures.service';

const devFeatures = yield* DevFeaturesServiceTag;
if (devFeatures.mockButtonsEnabled) {
  // Show mock data button
}

// Convenience functions for components
import { shouldShowMockButtons } from '$lib/services/devFeatures.service';
{#if shouldShowMockButtons()}
  <button onclick={createMockData}>Create Mock Data</button>
{/if}
```

**Environment Variables:**

```bash
VITE_APP_ENV=development|test|production       # Core environment setting
VITE_DEV_FEATURES_ENABLED=true|false          # Master dev features toggle
VITE_MOCK_BUTTONS_ENABLED=true|false          # Form mock buttons
```

**Benefits:**

- **Tree-Shaking**: Development code is completely removed from production builds
- **Zero Overhead**: Production builds contain no development features
- **Flexible Testing**: Different modes for various deployment scenarios
- **Developer Experience**: Mock data buttons accelerate development workflow

See [Development Features System](technical-specs/development-features-system.md) for complete documentation.

## 📚 Key Documentation

### Essential Reading

- [📋 Project Overview](documentation/project-overview.md) - Complete project introduction
- [🏗️ Architecture](documentation/architecture.md) - System design and patterns
- [🔧 Developer Guide](documentation/guides/getting-started.md) - Setup and workflow
- [📖 Full Documentation Index](documentation/DOCUMENTATION_INDEX.md) - Complete catalog

### API References

- [Frontend Services API](documentation/technical-specs/api/frontend/services.md)
- [Store Helpers API](documentation/technical-specs/api/frontend/store-helpers.md)
- [Backend Zome Functions](documentation/technical-specs/api/backend/zome-functions.md)
- [Error Handling API](documentation/technical-specs/api/frontend/errors.md)

### Development Guidelines

- [Development Guidelines](documentation/ai/rules/development-guidelines.md) - Effect-TS and Svelte patterns
- [Architecture Patterns](documentation/ai/rules/architecture-patterns.md) - 7-layer architecture
- [Testing Framework](documentation/ai/rules/testing-framework.md) - Comprehensive testing strategy
- [Domain Implementation](documentation/ai/rules/domain-implementation.md) - Domain patterns and utilities

## 🤝 Community

- **Discord**: [Join our community](https://discord.gg/happening)
- **Website**: [hAppenings.community](https://happenings.community/)
- **Contributing**: [Contributing Guide](documentation/guides/contributing.md)
- **Issues**: [GitHub Issues](https://github.com/Happening-Community/requests-and-offers/issues)

---

> **💡 Pro Tip**: Use Service Types domain as the implementation template - it's 100% complete and follows all established patterns.

> **⚠️ Important**: Unit tests require Nix environment due to hREA integration. Always use `nix develop --command bun test:unit` for autonomous execution.
