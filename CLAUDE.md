# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Skills Usage (Important)

Before exploring the codebase for implementation tasks, **always check if a skill matches the task** and invoke it first using the Skill tool:

- **Stores, services, or domain layers** → invoke `effect-ts-7layer-architecture`
- **Unit tests, mocks, or test setup** → invoke `testing-patterns`
- **Zome functions, entry types, or Holochain backend** → invoke `holochain-development`
- **hREA, proposals, intents, or GraphQL** → invoke `hrea-integration`
- **Deploying, releasing, or packaging** → invoke `deployment`

Skills contain verified patterns from this codebase. Load them BEFORE launching explore agents or reading reference files manually.

## Development Commands

```bash
# Environment
nix develop                    # Required for zomes - enters Nix shell (Holochain 0.6)
bun install                    # Install dependencies

# Dev servers
bun start                      # Development mode (2 agents)
AGENTS=3 bun start             # Custom number of agents
bun start:tauri                # Desktop app with Tauri

# Building
bun build:zomes                # Build Rust zomes (requires Nix)
bun build:happ                 # Build complete hApp

# Testing
bun test                       # All tests (builds zomes + runs integration tests)
nix develop --command bun test:unit   # Unit tests (requires Nix for hREA)
cd ui && bun vitest run tests/unit/path/to/file.test.ts  # Single test file

# Code quality (from ui/ directory)
cd ui && bun run lint && bun run format && bun run check
```

**Holochain 0.6 migration notes**: HDK 0.6.0, HDI 0.7.0, `LinkQuery::new()` + `GetStrategy::Local`, `delete_link()` requires `GetOptions::default()`, DNA manifest uses `path` instead of `bundled`.

## Architecture Overview

**Holochain hApp** with **SvelteKit frontend** using a **7-layer Effect-TS architecture**. Peer-to-peer bulletin board for requests and offers.

### 7-Layer Pattern
1. **Service** - Effect-native services with `Context.Tag` dependency injection
2. **Store** - Svelte 5 Runes with Effect integration and standardized helpers
3. **Schema** - `Schema.Class` validation at business boundaries
4. **Errors** - `Data.TaggedError` domain-specific errors
5. **Composables** - Component logic abstraction bridging stores and components
6. **Components** - Svelte 5 with accessibility focus
7. **Testing** - Tryorama (backend) + Vitest (frontend)

### Tech Stack
- **Backend**: Holochain (Rust) + hREA framework
- **Frontend**: SvelteKit 5 + Svelte 5 Runes + Effect-TS + TypeScript
- **Styling**: TailwindCSS + Skeleton UI
- **Testing**: Tryorama + Vitest
- **Package Manager**: Bun (Nix required for zome compilation)

### Project Structure
```
requests-and-offers/
├── dnas/requests_and_offers/     # Holochain DNA (coordinator & integrity zomes)
├── ui/                           # SvelteKit frontend
│   ├── src/lib/
│   │   ├── services/             # Effect-TS services (one per domain)
│   │   ├── stores/               # Svelte stores with Effect integration
│   │   ├── composables/          # Business logic abstraction
│   │   ├── schemas/              # Effect Schema validation
│   │   ├── errors/               # Tagged error definitions
│   │   └── utils/store-helpers/  # Shared store utility functions
│   └── src/routes/               # SvelteKit pages
├── tests/                        # Tryorama integration tests
└── documentation/                # Project docs
```

## Key Patterns

### Service Pattern (`Context.Tag` class)
Template: `ui/src/lib/services/zomes/serviceTypes.service.ts`
```typescript
export interface MyService {
  readonly myMethod: (input: MyInput) => E.Effect<Output, MyError>;
}

export class MyServiceTag extends Context.Tag('MyService')<MyServiceTag, MyService>() {}

export const MyServiceLive = Layer.effect(
  MyServiceTag,
  E.gen(function* () {
    const holochainClient = yield* HolochainClientServiceTag;

    const wrapZomeCall = <T>(zomeName: string, fnName: string, payload: unknown, context: string) =>
      wrapZomeCallWithErrorFactory(holochainClient, zomeName, fnName, payload, context, MyError.fromError);

    const myMethod = (input: MyInput) => wrapZomeCall('my_zome', 'my_fn', input, 'context');

    return MyServiceTag.of({ myMethod });
  })
);
```

### `wrapZomeCallWithErrorFactory` (from `utils/zome-helpers.ts`)
The standard way to convert Holochain's Promise-based `callZome()` into Effect-based calls. Uses `E.tryPromise` internally — calls `waitForConnection()` then `callZome()`, wrapping errors via the factory function.

### Error Pattern (`Data.TaggedError`)
Template: `ui/src/lib/errors/service-types.errors.ts`
```typescript
export class MyError extends Data.TaggedError('MyError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
}> {
  static fromError(error: unknown, context: string): MyError {
    const message = error instanceof Error ? error.message : String(error);
    return new MyError({ message: `${context}: ${message}`, cause: error, context });
  }
}
```

### Schema Pattern (`Schema.Class`)
Template: `ui/src/lib/schemas/service-types.schemas.ts`
```typescript
export class MyInput extends Schema.Class<MyInput>('MyInput')({
  name: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(100)),
  description: Schema.String.pipe(Schema.minLength(10)),
}) {}
```

### Store Helper Functions (`utils/store-helpers/`)
Key helpers used across all stores:
- **Core**: `withLoadingState`, `createErrorHandler`, `createLoadingStateSetter`
- **Cache**: `createGenericCacheSyncHelper`, `createCacheLookupFunction`, `createStatusTransitionHelper`, `processMultipleRecordCollections`
- **Records**: `createUIEntityFromRecord`, `mapRecordsToUIEntities`, `createEntityCreationHelper`
- **Events**: `createStatusAwareEventEmitters`
- **Fetching**: `createEntityFetcher`

## Domains

All 8 domains follow the 7-layer pattern. Use **Service Types** as the reference template:
- Service Types, Requests, Offers, Users, Organizations, Administration, Exchanges, Mediums of Exchange

## Testing Gotchas

- **Effect-TS inline deps**: Vitest config requires `server.deps.inline: [/@effect\/.*/, /effect/]`
- **msgpack encoding**: `createUIEntityFromRecord` uses `@msgpack/msgpack` `decode()` — mock records must use `encode()` for entry fields
- **Module-level mocks**: `administrationStore` is imported at module level in several stores — `vi.mock()` it BEFORE importing the store under test
- **Promise-based mocks**: Mock `callZome` with `mockResolvedValue`/`mockRejectedValue` (it's Promise-based, not Effect)
- **Path aliases**: `$lib` → `src/lib`, `@` → `src` (configured in `ui/vitest.config.ts`)
- **hREA service tests**: Need module mocks for `@valueflows/vf-graphql-holochain` and `@apollo/client/link/schema`

## Critical Requirements

### Nix Environment
Unit tests require Nix environment due to hREA integration:
```bash
nix develop --command bun test:unit
```

### Port Management
If port conflicts occur:
```bash
lsof -ti:8888 | xargs kill -9
lsof -ti:4444 | xargs kill -9
```

### hREA Integration
The hREA DNA is automatically downloaded to `workdir/hrea.dna` on first install.

---

- Don't run the app yourself, it breaks the manual tests of the user.
- NEVER sign the commits with your name. NEVER mention Claude in the commit messages.
