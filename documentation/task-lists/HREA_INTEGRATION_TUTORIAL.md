# hREA Integration Tutorial: Requests and Offers Application

A comprehensive guide to integrate hREA (Holochain Resource-Event-Agent) v0.3.2 into the existing Requests and Offers application, following established architecture patterns.

## Overview

This tutorial integrates hREA into our existing Svelte 5 + Holochain application that uses:
- **Architecture**: Effect TS service layer, Svelte 5 runes, TailwindCSS + SkeletonUI
- **Existing domains**: Users, Organizations, Service Types, Requests, Offers, Administration
- **Patterns**: Service layer → Stores → Composables → Components

## Prerequisites

✅ Existing Requests and Offers application running
✅ Nix development environment set up
✅ Familiar with existing codebase patterns

## Step 1: Add hREA Dependencies

Update `ui/package.json` to add hREA-specific dependencies:

```bash
cd ui
bun add @apollo/client@^3.13.8 @valueflows/vf-graphql-holochain@^0.0.3-alpha.10 graphql@^16.8.0
```

## Step 2: Download and Configure hREA DNA

### 2.1 Download hREA DNA

Add download script to `ui/package.json`:

```json
{
  "scripts": {
    "postinstall": "bun run download-hrea",
    "download-hrea": "[ ! -f \"../workdir/hrea_combined.dna\" ] && curl -L --output ../workdir/hrea_combined.dna https://github.com/h-REA/hREA/releases/download/happ-0.3.2-beta/hrea_combined.dna; exit 0"
  }
}
```

Run the download:
```bash
bun install
```

### 2.2 Configure hREA Role

Uncomment and verify the hREA role in `workdir/happ.yaml`:

```yaml
roles:
  - name: requests_and_offers
    # ... existing role ...
  - name: hrea
    provisioning:
      strategy: create
      deferred: false
    dna:
      bundled: "./hrea_combined.dna"
      modifiers:
        network_seed: ~
        properties: ~
        origin_time: ~
        quantum_time: ~
      installed_hash: ~
      clone_limit: 0
```

## Step 3: Create hREA Service Layer

### 3.1 Create hREA Service Interface

Create `ui/src/lib/services/zomes/hrea.service.ts`:

```typescript
import { ApolloClient, InMemoryCache } from "@apollo/client/core";
import { SchemaLink } from "@apollo/client/link/schema";
import { createHolochainSchema } from "@valueflows/vf-graphql-holochain";
import { Effect as E, Context, Layer, pipe } from "effect";
import { HREAError } from "$lib/errors";
import { HolochainClientServiceTag } from "../holochainClient.service";

// hREA Service Interface
export interface HREAService {
  readonly initializeSchema: () => E.Effect<void, HREAError>;
  readonly getApolloClient: () => E.Effect<ApolloClient<any>, HREAError>;
  readonly isInitialized: () => E.Effect<boolean, never>;
}

// Context tag for hREA service
export class HREAServiceTag extends Context.Tag('HREAService')<
  HREAServiceTag,
  HREAService
>() {}

// hREA Service Implementation
const createHREAService = (): E.Effect<HREAService, never> =>
  E.gen(function* () {
    let apolloClient: ApolloClient<any> | null = null;

    const initializeSchema = (): E.Effect<void, HREAError> =>
      E.gen(function* () {
        const holochainService = yield* HolochainClientServiceTag;
        const client = yield* holochainService.getClientEffect();

        if (!client) {
          return yield* E.fail(HREAError.create("Holochain client not available"));
        }

        try {
          console.log("🔧 Initializing hREA GraphQL schema...");

          const schema = createHolochainSchema({
            appWebSocket: client,
            roleName: "hrea",
          });

          apolloClient = new ApolloClient({
            cache: new InMemoryCache(),
            link: new SchemaLink({ schema }),
            defaultOptions: {
              query: { fetchPolicy: "cache-first" },
              mutate: { fetchPolicy: "no-cache" },
            },
          });

          console.log("✅ hREA schema initialized successfully");
        } catch (error) {
          return yield* E.fail(
            HREAError.create("Failed to initialize hREA schema", error)
          );
        }
      });

    const getApolloClient = (): E.Effect<ApolloClient<any>, HREAError> =>
      apolloClient
        ? E.succeed(apolloClient)
        : E.fail(HREAError.create("hREA Apollo client not initialized"));

    const isInitialized = (): E.Effect<boolean, never> =>
      E.succeed(apolloClient !== null);

    return {
      initializeSchema,
      getApolloClient,
      isInitialized,
    };
  });

// Live layer for hREA service
export const HREAServiceLive: Layer.Layer<HREAServiceTag, never, HolochainClientServiceTag> =
  Layer.effect(HREAServiceTag, createHREAService());
```

### 3.2 Add hREA Error Types

Add to `ui/src/lib/errors/hrea.errors.ts`:

```typescript
import { Data } from "effect";

export class HREAError extends Data.TaggedError("HREAError")<{
  readonly message: string;
  readonly cause?: unknown;
  readonly operation?: string;
}> {
  static create(message: string, cause?: unknown, operation?: string) {
    return new HREAError({ message, cause, operation });
  }
}
```

Update `ui/src/lib/errors/index.ts`:

```typescript
// ... existing exports ...
export * from './hrea.errors';
```

## Step 4: Create hREA Store

Create `ui/src/lib/stores/hrea.store.svelte.ts`:

```typescript
import { Effect as E, pipe } from "effect";
import { HREAServiceTag, type HREAService } from "$lib/services/zomes/hrea.service";
import { HolochainClientLive } from "$lib/services/holochainClient.service";
import { HREAServiceLive } from "$lib/services/zomes/hrea.service";
import { HREAError } from "$lib/errors";
import { gql } from "graphql-tag";

// Store state interface
interface HREAStoreState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  agents: any[];
  resourceSpecifications: any[];
}

// Store factory function following the established pattern
function createHREAStore() {
  // State using Svelte 5 runes
  const state = $state<HREAStoreState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    agents: [],
    resourceSpecifications: [],
  });

  // Effect runtime with dependencies
  const runtime = pipe(
    HolochainClientLive,
    E.provide(HREAServiceLive),
    E.runSync
  );

  // Initialize hREA
  const initialize = () => {
    state.isLoading = true;
    state.error = null;

    const effect = E.gen(function* () {
      const hreaService = yield* HREAServiceTag;
      yield* hreaService.initializeSchema();
      state.isInitialized = true;
    });

    pipe(
      effect,
      E.provide(runtime),
      E.runPromise
    ).then(() => {
      state.isLoading = false;
    }).catch((error) => {
      state.isLoading = false;
      state.error = error instanceof HREAError ? error.message : "Unknown error";
    });
  };

  // Create Person Agent
  const createPersonAgent = (name: string, note?: string) => {
    const effect = E.gen(function* () {
      const hreaService = yield* HREAServiceTag;
      const apolloClient = yield* hreaService.getApolloClient();

      const result = yield* E.tryPromise({
        try: () => apolloClient.mutate({
          mutation: gql`
            mutation CreatePerson($person: AgentCreateParams!) {
              createPerson(person: $person) {
                agent {
                  id
                  name
                  note
                }
              }
            }
          `,
          variables: {
            person: { name, note: note || `Person created at ${new Date().toISOString()}` }
          }
        }),
        catch: (error) => HREAError.create("Failed to create person agent", error)
      });

      const agent = result.data.createPerson.agent;
      state.agents.push(agent);
      return agent;
    });

    return pipe(effect, E.provide(runtime), E.runPromise);
  };

  // Create Organization Agent
  const createOrganizationAgent = (name: string, note?: string) => {
    const effect = E.gen(function* () {
      const hreaService = yield* HREAServiceTag;
      const apolloClient = yield* hreaService.getApolloClient();

      const result = yield* E.tryPromise({
        try: () => apolloClient.mutate({
          mutation: gql`
            mutation CreateOrganization($organization: OrganizationCreateParams!) {
              createOrganization(organization: $organization) {
                agent {
                  id
                  name
                  note
                }
              }
            }
          `,
          variables: {
            organization: { name, note: note || `Organization created at ${new Date().toISOString()}` }
          }
        }),
        catch: (error) => HREAError.create("Failed to create organization agent", error)
      });

      const agent = result.data.createOrganization.agent;
      state.agents.push(agent);
      return agent;
    });

    return pipe(effect, E.provide(runtime), E.runPromise);
  };

  // Fetch All Agents
  const fetchAgents = () => {
    const effect = E.gen(function* () {
      const hreaService = yield* HREAServiceTag;
      const apolloClient = yield* hreaService.getApolloClient();

      const result = yield* E.tryPromise({
        try: () => apolloClient.query({
          query: gql`
            query GetAgents {
              agents {
                edges {
                  node {
                    id
                    name
                    note
                  }
                }
              }
            }
          `,
          fetchPolicy: "network-only"
        }),
        catch: (error) => HREAError.create("Failed to fetch agents", error)
      });

      const agents = result.data?.agents?.edges?.map((edge: any) => edge.node) || [];
      state.agents = agents;
      return agents;
    });

    return pipe(effect, E.provide(runtime), E.runPromise);
  };

  // Create Resource Specification
  const createResourceSpecification = (name: string, note?: string) => {
    const effect = E.gen(function* () {
      const hreaService = yield* HREAServiceTag;
      const apolloClient = yield* hreaService.getApolloClient();

      const result = yield* E.tryPromise({
        try: () => apolloClient.mutate({
          mutation: gql`
            mutation CreateResourceSpecification($resourceSpecification: ResourceSpecificationCreateParams!) {
              createResourceSpecification(resourceSpecification: $resourceSpecification) {
                resourceSpecification {
                  id
                  name
                  note
                }
              }
            }
          `,
          variables: {
            resourceSpecification: { 
              name, 
              note: note || `Resource specification created at ${new Date().toISOString()}` 
            }
          }
        }),
        catch: (error) => HREAError.create("Failed to create resource specification", error)
      });

      const spec = result.data.createResourceSpecification.resourceSpecification;
      state.resourceSpecifications.push(spec);
      return spec;
    });

    return pipe(effect, E.provide(runtime), E.runPromise);
  };

  return {
    // State (readonly via getters)
    get isInitialized() { return state.isInitialized; },
    get isLoading() { return state.isLoading; },
    get error() { return state.error; },
    get agents() { return state.agents; },
    get resourceSpecifications() { return state.resourceSpecifications; },

    // Actions
    initialize,
    createPersonAgent,
    createOrganizationAgent,
    fetchAgents,
    createResourceSpecification,
  };
}

// Export singleton store instance
const hreaStore = createHREAStore();
export default hreaStore;
```

## Step 5: Create Admin hREA Test Page

### 5.1 Add hREA Navigation to Admin Sidebar

Update `ui/src/lib/components/users/AdminSideBar.svelte`:

```svelte
<!-- ... existing content ... -->

  <div class="flex flex-col gap-3">
    <MenuLink
      href="/admin/service-types"
      className="variant-filled-secondary sm:variant-filled-primary"
    >
      Service Types
    </MenuLink>
    <MenuLink href="/admin/requests" className="variant-filled-secondary sm:variant-filled-primary">
      Requests
    </MenuLink>
    <MenuLink href="/admin/offers" className="variant-filled-secondary sm:variant-filled-primary">
      Offers
    </MenuLink>
  </div>

  <!-- Add hREA section -->
  <div class="flex flex-col gap-3">
    <MenuLink
      href="/admin/hrea"
      className="variant-filled-tertiary sm:variant-filled-tertiary"
    >
      hREA Testing
    </MenuLink>
  </div>

<!-- ... rest of existing content ... -->
```

### 5.2 Create Admin hREA Page

Create `ui/src/routes/admin/hrea/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import hreaStore from '$lib/stores/hrea.store.svelte';

  let personName = $state('');
  let organizationName = $state('');
  let resourceName = $state('');
  let actionResults = $state<string[]>([]);

  // Auto-initialize hREA on page load
  onMount(() => {
    if (!hreaStore.isInitialized && !hreaStore.isLoading) {
      hreaStore.initialize();
    }
  });

  // Helper to add result message
  function addResult(message: string) {
    actionResults.push(`[${new Date().toLocaleTimeString()}] ${message}`);
    actionResults = [...actionResults]; // Trigger reactivity
  }

  // Create Person Agent
  async function handleCreatePerson() {
    if (!personName.trim()) {
      addResult('❌ Person name is required');
      return;
    }

    try {
      addResult(`🔧 Creating person: ${personName}...`);
      const agent = await hreaStore.createPersonAgent(personName);
      addResult(`✅ Person created: ${agent.name} (ID: ${agent.id})`);
      personName = '';
    } catch (error) {
      addResult(`❌ Failed to create person: ${(error as Error).message}`);
    }
  }

  // Create Organization Agent
  async function handleCreateOrganization() {
    if (!organizationName.trim()) {
      addResult('❌ Organization name is required');
      return;
    }

    try {
      addResult(`🔧 Creating organization: ${organizationName}...`);
      const agent = await hreaStore.createOrganizationAgent(organizationName);
      addResult(`✅ Organization created: ${agent.name} (ID: ${agent.id})`);
      organizationName = '';
    } catch (error) {
      addResult(`❌ Failed to create organization: ${(error as Error).message}`);
    }
  }

  // Create Resource Specification
  async function handleCreateResourceSpec() {
    if (!resourceName.trim()) {
      addResult('❌ Resource specification name is required');
      return;
    }

    try {
      addResult(`🔧 Creating resource specification: ${resourceName}...`);
      const spec = await hreaStore.createResourceSpecification(resourceName);
      addResult(`✅ Resource specification created: ${spec.name} (ID: ${spec.id})`);
      resourceName = '';
    } catch (error) {
      addResult(`❌ Failed to create resource specification: ${(error as Error).message}`);
    }
  }

  // Fetch All Agents
  async function handleFetchAgents() {
    try {
      addResult('🔧 Fetching all agents...');
      const agents = await hreaStore.fetchAgents();
      addResult(`✅ Found ${agents.length} agents:`);
      agents.forEach((agent: any, index: number) => {
        addResult(`  ${index + 1}. ${agent.name} (${agent.id})`);
      });
    } catch (error) {
      addResult(`❌ Failed to fetch agents: ${(error as Error).message}`);
    }
  }

  // Clear Results
  function clearResults() {
    actionResults = [];
  }

  // Initialize hREA
  function handleInitialize() {
    addResult('🔧 Initializing hREA...');
    hreaStore.initialize();
  }
</script>

<div class="container mx-auto p-6">
  <div class="mb-8">
    <h1 class="h1 mb-4">hREA Integration Testing</h1>
    <p class="text-surface-400 mb-6">
      Test basic hREA operations in the Requests and Offers application. 
      This page demonstrates the integration between our existing system and hREA ValueFlows concepts.
    </p>

    <!-- Connection Status -->
    <div class="card p-4 mb-6" class:variant-filled-success={hreaStore.isInitialized} 
         class:variant-filled-warning={hreaStore.isLoading} 
         class:variant-filled-error={hreaStore.error}>
      <div class="flex items-center gap-3">
        {#if hreaStore.isLoading}
          <div class="animate-spin">⚙️</div>
          <span>Initializing hREA...</span>
        {:else if hreaStore.error}
          <span>❌</span>
          <span>hREA Error: {hreaStore.error}</span>
          <button class="btn variant-filled ml-4" onclick={handleInitialize}>
            Retry Initialization
          </button>
        {:else if hreaStore.isInitialized}
          <span>✅</span>
          <span>hREA Connected Successfully</span>
        {:else}
          <span>⏳</span>
          <span>hREA Not Initialized</span>
          <button class="btn variant-filled ml-4" onclick={handleInitialize}>
            Initialize hREA
          </button>
        {/if}
      </div>
    </div>
  </div>

  {#if hreaStore.isInitialized}
    <!-- Agent Management Section -->
    <section class="mb-8">
      <h2 class="h2 mb-4">👤 Agent Management</h2>
      <p class="text-surface-400 mb-4">
        Agents are people, organizations, or groups that participate in economic activities.
      </p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <!-- Create Person -->
        <div class="card p-6">
          <h3 class="h3 mb-4">Create Person Agent</h3>
          <div class="input-group input-group-divider grid-cols-[1fr_auto] mb-4">
            <input 
              class="input" 
              type="text" 
              bind:value={personName}
              placeholder="Enter person name..."
            />
            <button class="btn variant-filled-primary" onclick={handleCreatePerson}>
              Create Person
            </button>
          </div>
        </div>

        <!-- Create Organization -->
        <div class="card p-6">
          <h3 class="h3 mb-4">Create Organization Agent</h3>
          <div class="input-group input-group-divider grid-cols-[1fr_auto] mb-4">
            <input 
              class="input" 
              type="text" 
              bind:value={organizationName}
              placeholder="Enter organization name..."
            />
            <button class="btn variant-filled-primary" onclick={handleCreateOrganization}>
              Create Organization
            </button>
          </div>
        </div>
      </div>

      <!-- Query Agents -->
      <div class="card p-6 mb-6">
        <h3 class="h3 mb-4">Query Agents</h3>
        <button class="btn variant-filled-secondary" onclick={handleFetchAgents}>
          Fetch All Agents
        </button>
        
        {#if hreaStore.agents.length > 0}
          <div class="mt-4">
            <h4 class="h4 mb-2">Current Agents ({hreaStore.agents.length}):</h4>
            <div class="grid gap-2">
              {#each hreaStore.agents as agent}
                <div class="card p-3 variant-glass-surface">
                  <div class="font-semibold">{agent.name}</div>
                  <div class="text-sm text-surface-400">{agent.note}</div>
                  <div class="text-xs text-surface-500">ID: {agent.id}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- Resource Specifications Section -->
    <section class="mb-8">
      <h2 class="h2 mb-4">📦 Resource Specifications</h2>
      <p class="text-surface-400 mb-4">
        Resource specifications define types of resources that can be used, consumed, or produced.
      </p>

      <div class="card p-6">
        <h3 class="h3 mb-4">Create Resource Specification</h3>
        <div class="input-group input-group-divider grid-cols-[1fr_auto] mb-4">
          <input 
            class="input" 
            type="text" 
            bind:value={resourceName}
            placeholder="Enter resource specification name..."
          />
          <button class="btn variant-filled-tertiary" onclick={handleCreateResourceSpec}>
            Create Resource Spec
          </button>
        </div>

        {#if hreaStore.resourceSpecifications.length > 0}
          <div class="mt-4">
            <h4 class="h4 mb-2">Resource Specifications ({hreaStore.resourceSpecifications.length}):</h4>
            <div class="grid gap-2">
              {#each hreaStore.resourceSpecifications as spec}
                <div class="card p-3 variant-glass-primary">
                  <div class="font-semibold">{spec.name}</div>
                  <div class="text-sm text-surface-400">{spec.note}</div>
                  <div class="text-xs text-surface-500">ID: {spec.id}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- Action Results Section -->
    <section>
      <div class="card p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="h3">Action Results</h3>
          <button class="btn variant-ringed-surface" onclick={clearResults}>
            Clear Results
          </button>
        </div>
        
        <div class="bg-surface-900 p-4 rounded-lg max-h-96 overflow-y-auto">
          {#if actionResults.length === 0}
            <p class="text-surface-400 italic">No actions performed yet. Try creating some agents or resource specifications!</p>
          {:else}
            {#each actionResults as result}
              <div class="font-mono text-sm mb-1 text-surface-200">{result}</div>
            {/each}
          {/if}
        </div>
      </div>
    </section>
  {/if}
</div>
```

## Step 6: Update Holochain Client Service

Update `ui/src/lib/services/holochainClient.service.ts` to include the hREA role name:

```typescript
export type RoleName = 'requests_and_offers' | 'hrea';
```

## Step 7: Test the Integration

### 7.1 Start the Application

```bash
# From project root
bun start
```

### 7.2 Navigate to hREA Test Page

1. Open your browser to the admin section
2. Navigate to **Admin Panel** → **hREA Testing**
3. Wait for hREA to initialize (you should see "✅ hREA Connected Successfully")

### 7.3 Test Basic Operations

Try these operations in order:

1. **Create Person Agent**: Enter a name like "Alice Developer" and click "Create Person"
2. **Create Organization Agent**: Enter a name like "Tech Cooperative" and click "Create Organization"  
3. **Create Resource Specification**: Enter a name like "Software Development" and click "Create Resource Spec"
4. **Fetch All Agents**: Click "Fetch All Agents" to see all created agents

Watch the "Action Results" section for real-time feedback on all operations.

## Next Steps

Once the basic integration is working:

1. **Entity Mapping**: Implement mapping between existing entities (Users → Agents, Service Types → Resource Specifications)
2. **Exchange Processes**: Create hREA Intents from Requests and Offers
3. **Data Migration**: Build utilities to migrate existing data to hREA format
4. **Production Integration**: Integrate hREA operations into the main application flow

## Troubleshooting

### Common Issues

1. **"hREA DNA not found"**: Ensure `hrea_combined.dna` was downloaded to `workdir/`
2. **Connection timeout**: Check that Holochain is running and the hREA role is properly configured
3. **GraphQL errors**: Verify the hREA DNA version matches the expected schema

### Debug Mode

Enable verbose logging:
```bash
RUST_LOG=debug bun start
```

### Clean Reset

If persistent issues occur:
```bash
hc sandbox clean
cargo clean
bun install
```

## Architecture Integration

This integration follows the established patterns:

- **Service Layer**: `hrea.service.ts` wraps GraphQL operations using Effect TS
- **Store Layer**: `hrea.store.svelte.ts` manages state using Svelte 5 runes  
- **UI Layer**: Admin page uses existing SkeletonUI components and patterns
- **Error Handling**: Uses established error patterns with `HREAError`

The hREA integration is designed to work alongside existing functionality while providing a foundation for future ValueFlows-based features. 