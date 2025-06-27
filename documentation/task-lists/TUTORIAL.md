# hREA Integration Tutorial: Svelte + Holochain

A step-by-step guide to integrating **hREA v0.3.2** into your **scaffolded** Svelte Holochain application.

> **⚠️ Version Compatibilxity Notice**:
> - **hREA v0.3.2** is compatible with **Holochain 0.5.x**
> - **hREA v0.3.1** is compatible with **Holochain 0.4.x**
>
> This tutorial is specifically designed for **hREA version 0.3.2**. Different versions may require different integration steps.


## Prerequisites

This tutorial assumes you're working with a **scaffolded Holochain application** created using the official Holochain scaffolding tool. If you haven't created your Holochain app yet, follow these steps first:

### 1. Install Holochain Development Environment

Follow the official Holochain installation guide:
**[Installing Holochain Development Environment](https://developer.holochain.org/get-started/#2-installing-holochain-development-environment)**

This will install:
- Nix package manager
- Holochain development tools
- All required dependencies

### 2. Create a Scaffolded Holochain Web App

Once the development environment is installed, create a new Holochain web application:

```bash
# Navigate to your projects directory
cd ~/your-projects-directory

# Create a scaffolded Holochain web app
nix run "github:/holochain/holonix?ref=main-0.5#hc-scaffold" -- web-app
```

**During scaffolding, choose:**
- UI Framework: **Svelte**
- App name: Your preferred name (e.g., `my_hrea_app`)
- Holonix environment: **Yes (recommended)**
- Package manager: Your preference (npm, bun, pnpm, or yarn)
- Initial DNA: **Yes**
- DNA name: Your preferred name (e.g., `main`)

For detailed scaffolding instructions, see the official tutorial:
**[Forum App Tutorial - Scaffolding Steps](https://developer.holochain.org/get-started/3-forum-app-tutorial/)**

> **📝 Note on Svelte 5**: The scaffolded templates may use older Svelte patterns. This tutorial uses modern Svelte 5 runes for better performance and developer experience. See the [Svelte 5 Migration Guide](./SVELTE_5_MIGRATION.md) for details on the benefits and patterns used.

## Integration Steps

Now that you have a scaffolded Holochain app, you can integrate hREA:

### Step 1: Ensure Basic DNA Structure

**⚠️ Important**: Before integrating hREA, your hApp must have at least one basic DNA with a zome to compile properly. If you followed the scaffolding process and chose to create an initial DNA, you should already have this. If not, you'll need to scaffold a basic DNA first.

**Verify your DNA structure:**
```bash
# Check that you have a basic DNA structure
ls dnas/
# Should show at least one DNA directory (e.g., your_main_dna/)

# Check that your DNA has at least one zome
ls dnas/your_main_dna/zomes/
# Should show integrity/ and coordinator/ directories with zomes
```

**If you don't have a basic DNA structure**, scaffold one:
```bash
# Enter the Nix development environment
nix develop

# Scaffold a basic DNA (if you don't already have one)
hc scaffold dna

# Scaffold basic zomes for the DNA
hc scaffold zome
```

**Your basic hApp configuration should look like this** in `workdir/happ.yaml`:
```yaml
manifest_version: "1"
name: your_app_name
roles:
  - name: your_main_dna    # Your basic DNA role
    dna:
      bundled: ../dnas/your_main_dna/workdir/your_main_dna.dna
    # ... other DNA configuration
```

**Build and test your basic hApp first:**
```bash
# Build the basic hApp to ensure it compiles
npm run build:happ

# If successful, you'll see your DNA file created
ls dnas/your_main_dna/workdir/
# Should show your_main_dna.dna
```

Once you have a working basic hApp structure, you can proceed with hREA integration.

### Step 2: Add hREA Configuration

Navigate to your scaffolded app directory and add the hREA role to your hApp configuration.

**Edit `workdir/happ.yaml`:**
```yaml
# ... existing content ...
roles:
  - name: your_main_dna    # Your existing DNA role
    dna:
      bundled: ../dnas/your_dna/workdir/your_dna.dna
      # ... existing content ...
  # Add hREA role
  - name: hrea
      provisioning:
        strategy: create
        deferred: false
      dna:
        bundled: ./hrea.dna
        modifiers:
          network_seed: null
          properties: null
        installed_hash: null
        clone_limit: 0
```

**Edit `workdir/web-happ.yaml`:**
```yaml
# ... existing content ...
# Add hREA role here too if needed for web deployment
```

### Step 3: Download hREA DNA

**Edit your `package.json`** to add hREA v0.3.2 DNA download:
```json
{
  "scripts": {
    "postinstall": "bun run download-hrea",
    // other scripts...
    "download-hrea": "[ ! -f \"workdir/hrea.dna\" ] && curl -L --output workdir/hrea.dna https://github.com/h-REA/hREA/releases/download/happ-0.3.2-beta/hrea.dna; exit 0"
  }
}
```

Then run:
```bash
npm install  # or your chosen package manager
```

### Step 4: Add hREA Dependencies

**Add to your UI `package.json`** (compatible with hREA v0.3.2):
```json
{
  "dependencies": {
    "@apollo/client": "^3.13.8",
    "@valueflows/vf-graphql-holochain": "^0.0.3-alpha.10",
    "graphql": "^16.8.0"
  }
}
```

**Key dependencies explained (for hREA v0.3.2):**
- `@apollo/client` - GraphQL client for React/Svelte integration (includes SchemaLink)
- `@holochain/client` - Official Holochain client for WebSocket connections
- `@msgpack/msgpack` - MessagePack serialization (required by Holochain client)
- `@valueflows/vf-graphql-holochain` - hREA v0.3.2 GraphQL schema and utilities (version 0.0.3-alpha.10) - provides `createHolochainSchema`
- `graphql` - Core GraphQL library

Install the dependencies:
```bash
cd ui
npm install  # or your chosen package manager
```

### Step 5: Copy and Adjust DNA Manifest

Before integrating hREA, you need to copy your custom DNA manifest to the root `workdir` folder and adjust the relative paths for proper bundling.

**Copy your DNA manifest:**
```bash
# From your project root directory
cp dnas/your_dna_name/dna.yaml workdir/dna.yaml
```

**Edit `workdir/dna.yaml`** to adjust the relative paths from `../../../` to `../`:

```yaml
manifest_version: "1"
name: your_dna_name
integrity:
  network_seed: null
  properties: null
  zomes:
    - name: your_zome_integrity
      hash: null
      bundled: ../target/wasm32-unknown-unknown/release/your_zome_integrity.wasm  # Changed from ../../../
      dependencies: null
      dylib: null
coordinator:
  zomes:
    - name: your_zome
      hash: null
      bundled: ../target/wasm32-unknown-unknown/release/your_zome.wasm  # Changed from ../../../
      dependencies:
        - name: your_zome_integrity
      dylib: null
```

> **📝 Note**: Replace `your_dna_name`, `your_zome_integrity`, and `your_zome` with your actual DNA and zome names from your scaffolded application.

This step ensures that both your custom DNA and the hREA DNA can be properly bundled together in the final application.

### Step 6: Modify Integration Files

The scaffolded Holochain application already includes basic files that we need to modify for hREA integration. We'll update these files to use modern Svelte 5 runes for optimal performance and developer experience.

#### 6.1. Replace `ui/src/contexts.ts` with `ui/src/contexts.svelte.ts`

First, delete the existing `ui/src/contexts.ts` file and create `ui/src/contexts.svelte.ts` with Svelte 5 rune-based state management:

```bash
# Delete the old file
rm ui/src/contexts.ts

# Create the new file (content below)
touch ui/src/contexts.svelte.ts
```

This file manages the connection between Svelte, Holochain, and hREA using Svelte 5 runes:
**Content for `ui/src/contexts.svelte.ts`:**

```typescript
// hREA Integration Context - Svelte 5 Runes
// This file manages the connection between Svelte, Holochain, and hREA using modern runes

import { ApolloClient, InMemoryCache } from "@apollo/client/core";
import { SchemaLink } from "@apollo/client/link/schema";
import type { AppClient, HolochainError } from "@holochain/client";
import { AppWebsocket } from "@holochain/client";
import { createHolochainSchema } from "@valueflows/vf-graphql-holochain";
import { getContext, setContext } from "svelte";

// Context keys for Svelte contexts
export const CLIENT_CONTEXT_KEY = Symbol("holochain-client");
export const APOLLO_CLIENT_CONTEXT_KEY = Symbol("apollo-client");

// Holochain client state class using runes
export class HolochainClientState {
  client = $state<AppClient | undefined>(undefined);
  error = $state<HolochainError | undefined>(undefined);
  loading = $state(false);

  async connect() {
    this.loading = true;
    this.error = undefined;

    try {
      this.client = await AppWebsocket.connect();
      console.log("✅ Connected to Holochain");
    } catch (e) {
      console.error("❌ Failed to connect to Holochain:", e);
      this.error = e as HolochainError;
    } finally {
      this.loading = false;
    }
  }

  getClient() {
    if (!this.client) {
      throw new Error("Holochain client not initialized");
    }
    return this.client;
  }
}

// hREA GraphQL client state class using runes
export class HREAClientState {
  client = $state<ApolloClient<any> | undefined>(undefined);
  error = $state<string | undefined>(undefined);
  loading = $state(false);

  async initialize(holochainClient: AppClient) {
    this.loading = true;
    this.error = undefined;

    try {
      console.log("🔧 Initializing hREA with GraphQL schema...");

      // Create GraphQL schema from hREA DNA
      const schema = createHolochainSchema({
        appWebSocket: holochainClient,
        roleName: "hrea", // This matches the role name in happ.yaml
      });

      // Create Apollo Client with hREA schema
      this.client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new SchemaLink({ schema }),
        defaultOptions: {
          query: {
            fetchPolicy: "cache-first",
          },
          mutate: {
            fetchPolicy: "no-cache",
          },
        },
      });

      console.log("✅ hREA initialized successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to initialize hREA";
      console.error("❌ hREA initialization failed:", error);
      this.error = errorMessage;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  getClient() {
    if (!this.client) {
      throw new Error("hREA client not initialized");
    }
    return this.client;
  }
}

// Factory functions for creating state instances
export function createHolochainClientState() {
  return new HolochainClientState();
}

export function createHREAClientState() {
  return new HREAClientState();
}

// Context getters
export function getHolochainClient(): HolochainClientState {
  const clientState = getContext<HolochainClientState>(CLIENT_CONTEXT_KEY);
  if (!clientState) {
    throw new Error("Holochain client state not found in context");
  }
  return clientState;
}

export function getHREAClient(): HREAClientState {
  const hreaState = getContext<HREAClientState>(APOLLO_CLIENT_CONTEXT_KEY);
  if (!hreaState) {
    throw new Error("hREA client state not found in context");
  }
  return hreaState;
}

// Convenience function to get the Apollo client directly
export function getApolloClient(): ApolloClient<any> {
  const hreaState = getHREAClient();
  return hreaState.getClient();
}
```

#### 6.2. Create or Replace `ui/src/ClientProvider.svelte`

If this file doesn't exist in your scaffolded app, create it. If it exists, replace its content with the following. This component manages connection states and provides clients to child components:

```svelte
<script lang="ts">
  import { onMount, setContext } from "svelte";
  import {
    CLIENT_CONTEXT_KEY,
    APOLLO_CLIENT_CONTEXT_KEY,
    createHolochainClientState,
    createHREAClientState,
  } from "./contexts.svelte";

  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();

  // Create state instances using runes
  const holochainState = createHolochainClientState();
  const hreaState = createHREAClientState();

  // Make state available to child components via context
  setContext(CLIENT_CONTEXT_KEY, holochainState);
  setContext(APOLLO_CLIENT_CONTEXT_KEY, hreaState);

  // Connect to Holochain when component mounts
  onMount(() => {
    holochainState.connect();
  });

  // Initialize hREA when Holochain client is ready
  $effect(() => {
    if (
      holochainState.client &&
      !hreaState.client &&
      !hreaState.error &&
      !hreaState.loading
    ) {
      hreaState.initialize(holochainState.client);
    }
  });
</script>

<!-- Connection Status and Content -->
{#if holochainState.loading}
  <div class="status connecting">
    <div class="spinner"></div>
    <p>Connecting to Holochain...</p>
  </div>
{:else if holochainState.error}
  <div class="status error">
    <h3>❌ Connection Failed</h3>
    <p>Unable to connect to Holochain: {holochainState.error.message}</p>
    <p class="help">
      Make sure Holochain is running and try refreshing the page.
    </p>
  </div>
{:else if holochainState.client && hreaState.error}
  <div class="status error">
    <h3>⚠️ hREA Initialization Failed</h3>
    <p>Holochain connected, but hREA setup failed: {hreaState.error}</p>
    <p class="help">Check that the hREA DNA is properly configured.</p>
  </div>
{:else if holochainState.client && hreaState.loading}
  <div class="status connecting">
    <div class="spinner"></div>
    <p>Initializing hREA...</p>
  </div>
{:else if holochainState.client && hreaState.client}
  <!-- Everything is ready - show the app -->
  {@render children?.()}
{:else}
  <div class="status connecting">
    <div class="spinner"></div>
    <p>Setting up connections...</p>
  </div>
{/if}

<style>
  .status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 40px 20px;
    text-align: center;
  }

  .connecting {
    color: #ccc;
  }

  .error {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 8px;
    margin: 20px;
  }

  .error h3 {
    margin: 0 0 10px 0;
    font-size: 1.2em;
  }

  .error p {
    margin: 8px 0;
    max-width: 500px;
  }

  .help {
    font-size: 0.9em;
    opacity: 0.8;
    font-style: italic;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid #007acc;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  p {
    margin: 0;
    font-size: 16px;
  }
</style>
```

#### 6.3. Create `ui/src/HREATest.svelte`

This is a new component that demonstrates basic hREA operations. Create this file in your scaffolded app:

```svelte
<script lang="ts">
  import { getHREAClient } from "./contexts.svelte";
  import { gql } from "@apollo/client/core";

  let results: string[] = $state([]);
  let isLoading = $state(false);

  // Get hREA client state to check connection status
  const hreaState = getHREAClient();

  // Reactive derived value for Apollo client
  let apolloClient = $derived(hreaState.client);

  // Add connection status to results when client becomes available
  $effect(() => {
    if (apolloClient && results.length === 0) {
      results.push("✅ Connected to hREA successfully");
    }
  });

  // Example 1: Create a Person Agent
  async function createPerson() {
    if (!apolloClient) {
      results.push("❌ hREA not connected");
      return;
    }

    isLoading = true;
    results.push("🔧 Creating a person agent...");

    try {
      const result = await apolloClient.mutate({
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
          person: {
            name: `Person ${Date.now()}`,
            note: "Created via hREA basic example",
          },
        },
      });

      const agent = result.data.createPerson.agent;
      results.push(`✅ Person created: ${agent.name} (ID: ${agent.id})`);
    } catch (error) {
      results.push(`❌ Failed to create person: ${(error as Error).message}`);
    } finally {
      isLoading = false;
    }
  }

  // Example 2: Create an Organization Agent
  async function createOrganization() {
    if (!apolloClient) {
      results.push("❌ hREA not connected");
      return;
    }

    isLoading = true;
    results.push("🔧 Creating an organization agent...");

    try {
      const result = await apolloClient.mutate({
        mutation: gql`
          mutation CreateOrganization(
            $organization: OrganizationCreateParams!
          ) {
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
          organization: {
            name: `Organization ${Date.now()}`,
            note: "Created via hREA basic example",
          },
        },
      });

      const agent = result.data.createOrganization.agent;
      results.push(`✅ Organization created: ${agent.name} (ID: ${agent.id})`);
    } catch (error) {
      results.push(
        `❌ Failed to create organization: ${(error as Error).message}`
      );
    } finally {
      isLoading = false;
    }
  }

  // Example 3: Create a Resource Specification
  async function createResourceSpec() {
    if (!apolloClient) {
      results.push("❌ hREA not connected");
      return;
    }

    isLoading = true;
    results.push("🔧 Creating a resource specification...");

    try {
      const result = await apolloClient.mutate({
        mutation: gql`
          mutation CreateResourceSpecification(
            $resourceSpecification: ResourceSpecificationCreateParams!
          ) {
            createResourceSpecification(
              resourceSpecification: $resourceSpecification
            ) {
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
            name: `Resource Spec ${Date.now()}`,
            note: "A basic resource specification example",
          },
        },
      });

      const spec =
        result.data.createResourceSpecification.resourceSpecification;
      results.push(
        `✅ Resource specification created: ${spec.name} (ID: ${spec.id})`
      );
    } catch (error) {
      results.push(
        `❌ Failed to create resource specification: ${(error as Error).message}`
      );
    } finally {
      isLoading = false;
    }
  }

  // Example 4: Query All Agents
  async function queryAgents() {
    if (!apolloClient) {
      results.push("❌ hREA not connected");
      return;
    }

    isLoading = true;
    results.push("🔧 Querying all agents...");

    try {
      const result = await apolloClient.query({
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
        fetchPolicy: "network-only",
      });

      const agents = result.data?.agents?.edges || [];
      if (agents.length === 0) {
        results.push("ℹ️ No agents found. Create some agents first!");
      } else {
        results.push(`📋 Found ${agents.length} agents:`);
        agents.forEach((edge: any, index: number) => {
          const agent = edge.node;
          results.push(`  ${index + 1}. ${agent.name} (${agent.id})`);
        });
      }
    } catch (error) {
      results.push(`❌ Failed to query agents: ${(error as Error).message}`);
    } finally {
      isLoading = false;
    }
  }

  function clearResults() {
    results = [];
  }
</script>

<div class="hrea-example">
  <h2>hREA Basic Example</h2>
  <p>This demonstrates core hREA operations using the ValueFlows ontology:</p>

  <div class="examples">
    <div class="example-section">
      <h3>👤 Agents</h3>
      <p>
        Agents are people, organizations, or groups that participate in economic
        activities.
      </p>
      <div class="buttons">
        <button onclick={createPerson} disabled={isLoading}>
          Create Person
        </button>
        <button onclick={createOrganization} disabled={isLoading}>
          Create Organization
        </button>
        <button onclick={queryAgents} disabled={isLoading}>
          List All Agents
        </button>
      </div>
    </div>

    <div class="example-section">
      <h3>📦 Resources</h3>
      <p>
        Resources are physical or digital assets that can be used, consumed, or
        produced.
      </p>
      <div class="buttons">
        <button onclick={createResourceSpec} disabled={isLoading}>
          Create Resource Specification
        </button>
      </div>
    </div>

    <div class="actions">
      <button onclick={clearResults} class="clear-button">
        Clear Results
      </button>
    </div>
  </div>

  <div class="results">
    <h3>Results:</h3>
    <div class="results-container">
      {#each results as result}
        <div class="result-line">{result}</div>
      {/each}
      {#if results.length === 0}
        <p class="no-results">
          Click the buttons above to try hREA operations!
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  .hrea-example {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }

  h2 {
    color: #fff;
    margin-bottom: 10px;
  }

  h3 {
    color: #fff;
    font-size: 1.2em;
    margin-bottom: 8px;
  }

  p {
    color: #ccc;
    margin-bottom: 15px;
    line-height: 1.4;
  }

  .examples {
    margin-bottom: 30px;
  }

  .example-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  button {
    padding: 10px 16px;
    background: #007acc;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }

  button:hover:not(:disabled) {
    background: #005999;
  }

  button:disabled {
    background: #666;
    cursor: not-allowed;
  }

  .clear-button {
    background: #666;
  }

  .clear-button:hover:not(:disabled) {
    background: #888;
  }

  .actions {
    text-align: center;
    margin-bottom: 20px;
  }

  .results {
    border: 1px solid #444;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
  }

  .results h3 {
    margin: 0;
    padding: 15px 20px 10px;
    border-bottom: 1px solid #444;
  }

  .results-container {
    padding: 15px 20px 20px;
    max-height: 400px;
    overflow-y: auto;
  }

  .result-line {
    color: #fff;
    font-family: "Courier New", monospace;
    font-size: 13px;
    margin: 4px 0;
    padding: 2px 0;
    line-height: 1.3;
  }

  .no-results {
    color: #888;
    font-style: italic;
    text-align: center;
    margin: 20px 0;
  }
</style>
```

### Step 7: Update Your Main App Component

The scaffolded application already includes an `ui/src/App.svelte` file. **Replace its content** with the following to include the hREA integration:

```svelte
<script lang="ts">
  import logo from "./assets/holochainLogo.svg";
  import ClientProvider from "./ClientProvider.svelte";
  import HREATest from "./HREATest.svelte";
</script>

<ClientProvider>
  <div>
    <div>
      <a href="https://developer.holochain.org/get-started/" target="_blank">
        <img src={logo} class="logo holochain" alt="holochain logo" />
      </a>
    </div>
    <h1>Holochain Svelte hApp</h1>
    <div>
      <div class="card">
        <p>Welcome to the hREA Basic Example!</p>
        <p>
          This demonstrates how to integrate hREA with Holochain using Svelte 5
          runes.
        </p>
      </div>

      <!-- hREA Basic Example -->
      <HREATest />
    </div>
  </div>
</ClientProvider>

<style>
  .logo {
    height: 15em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
    width: auto;
  }

  .logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
  }

  .logo.holochain:hover {
    filter: drop-shadow(0 0 2em #61dafbaa);
  }

  .card {
    padding: 2em;
  }

  .card p {
    color: #ccc;
    margin: 8px 0;
    line-height: 1.4;
  }
</style>
```

**What this does:**
- Wraps your app with `ClientProvider` to manage Holochain and hREA connections
- Includes the Holochain logo and branding from the scaffolded template
- Includes the `HREATest` component to demonstrate basic hREA operations
- Provides a clean UI foundation with proper styling for your hREA-enabled application

## Quick Start (10 Minutes)

Now you can start your integrated application:

```bash
# From your app root directory
npm start  # or your chosen package manager
```

**What this command does:**
1. Builds the Rust zomes (WebAssembly modules)
2. Packages the Holochain DNA and hApp (including hREA)
3. Starts the Svelte development server
4. Launches Holochain with 2 agents
5. Opens Holochain Playground for debugging

**Expected output:**
```
✓ Built Rust zomes
✓ Packaged hApp with hREA integration
✓ Started Svelte dev server on http://localhost:5173
✓ Launched Holochain with 2 agents
✓ Holochain Playground available at http://localhost:8888
```

## Try the Basic Example

1. Open your browser to http://localhost:5173
2. Wait for "Connected to hREA successfully" message
3. Try the example operations:
   - Click "Create Person" to create a person agent
   - Click "Create Organization" to create an organization agent
   - Click "List All Agents" to query all agents
   - Click "Create Resource Specification" to create a resource spec

## Understanding the Integration

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│               Svelte Frontend                   │
├─────────────────────────────────────────────────┤
│    Apollo Client + GraphQL (ValueFlows)         │
├─────────────────────────────────────────────────┤
│           Holochain Client (WebSocket)          │
├─────────────────────────────────────────────────┤
│        hREA DNA      │      Custom DNA          │
│   (Economic Logic)   │  (App-specific Logic)    │
└─────────────────────────────────────────────────┘
```

### Key Files and Their Purpose

#### 1. `ui/src/contexts.svelte.ts` - Integration Logic
This file manages the connection between Svelte, Holochain, and hREA using Svelte 5 runes and contexts:

```typescript
// Holochain client state with runes
export class HolochainClientState {
  client = $state<AppClient | undefined>(undefined);
  // Connect to Holochain WebSocket
  async connect() { /* ... */ }
}

// hREA GraphQL client state with runes
export class HREAClientState {
  client = $state<ApolloClient<any> | undefined>(undefined);
  // Initialize with createHolochainSchema and SchemaLink
  async initialize(holochainClient: AppClient) { /* ... */ }
}

// Context providers for Svelte components
export function getHolochainClient() { /* ... */ }
export function getHREAClient() { /* ... */ }
```

#### 2. `ui/src/ClientProvider.svelte` - Context Provider
Manages connection state and makes clients available to child components using Svelte contexts:

```svelte
<script lang="ts">
  // Create state instances and set them in context
  const holochainState = createHolochainClientState();
  const hreaState = createHREAClientState();

  setContext(CLIENT_CONTEXT_KEY, holochainState);
  setContext(APOLLO_CLIENT_CONTEXT_KEY, hreaState);

  // Initialize hREA when Holochain is ready
  $effect(() => {
    if (holochainState.client && !hreaState.client) {
      hreaState.initialize(holochainState.client);
    }
  });
</script>

<!-- Handles connection states -->
{#if holochainState.loading}
  <div class="status connecting">Connecting...</div>
{:else if holochainState.client && hreaState.client}
  <!-- App content when everything is ready -->
  {@render children?.()}
{/if}
```

#### 3. `ui/src/HREATest.svelte` - Basic Example
Demonstrates core hREA operations using Svelte 5 runes and context:

```typescript
<script lang="ts">
  import { getHREAClient } from "./contexts.svelte";
  import { gql } from "@apollo/client/core";

  // Get hREA client state from context
  const hreaState = getHREAClient();

  // Reactive derived value for Apollo client
  let apolloClient = $derived(hreaState.client);

  // Example: Create a person agent
  async function createPerson() {
    if (!apolloClient) return;

    const result = await apolloClient.mutate({
      mutation: gql`
        mutation CreatePerson($person: AgentCreateParams!) {
          createPerson(person: $person) {
            agent { id name note }
          }
        }
      `,
      variables: {
        person: {
          name: `Person ${Date.now()}`,
          note: "Created via hREA basic example"
        }
      }
    });
  }
</script>
```

#### 4. `workdir/happ.yaml` - App Configuration
Defines the Holochain application structure:

```yaml
roles:
  - name: hc_test      # Your custom DNA
    dna:
      bundled: ../dnas/hc_test/workdir/hc_test.dna
  - name: hrea         # hREA DNA for economic logic
    dna:
      bundled: ./hrea.dna
```

## ValueFlows Concepts

### Agents
Entities that participate in economic activities:
- **Person**: Individual human agents
- **Organization**: Collective agents (companies, cooperatives, etc.)

### Resources
Assets that can be used, consumed, or produced:
- **Resource Specification**: Definition of a type of resource
- **Resource**: Actual instances of resources

### Events
Economic activities that affect resources:
- **Transfer**: Moving resources between agents
- **Transform**: Converting resources into other resources
- **Consume**: Using up resources
- **Produce**: Creating new resources

## Common Operations

### Creating Agents

```typescript
// Create a person
const createPerson = async () => {
  const result = await apolloClient.mutate({
    mutation: gql`
      mutation CreatePerson($person: AgentCreateParams!) {
        createPerson(person: $person) {
          agent { id name note }
        }
      }
    `,
    variables: {
      person: {
        name: "Alice Smith",
        note: "Software developer"
      }
    }
  });
};

// Create an organization
const createOrganization = async () => {
  const result = await apolloClient.mutate({
    mutation: gql`
      mutation CreateOrganization($organization: OrganizationCreateParams!) {
        createOrganization(organization: $organization) {
          agent { id name note }
        }
      }
    `,
    variables: {
      organization: {
        name: "Tech Cooperative",
        note: "Worker-owned software company"
      }
    }
  });
};
```

### Querying Data

```typescript
// Get all agents
const queryAgents = async () => {
  const result = await apolloClient.query({
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
    `
  });

  const agents = result.data.agents.edges;
  return agents.map(edge => edge.node);
};
```

### Creating Resources

```typescript
// Create a resource specification
const createResourceSpec = async () => {
  const result = await apolloClient.mutate({
    mutation: gql`
      mutation CreateResourceSpecification($resourceSpecification: ResourceSpecificationCreateParams!) {
        createResourceSpecification(resourceSpecification: $resourceSpecification) {
          resourceSpecification { id name note }
        }
      }
    `,
    variables: {
      resourceSpecification: {
        name: "Software License",
        note: "Digital software license"
      }
    }
  });
};
```

## Troubleshooting

### Common Issues

#### 1. "can't find crate for `core`" Error
**Problem**: WebAssembly target not installed
**Solution**:
```bash
rustup target add wasm32-unknown-unknown
```

#### 2. "hREA DNA not found" Error
**Problem**: hREA v0.3.2 DNA not downloaded
**Solution**:
```bash
# Download hREA v0.3.2 DNA manually
curl -L https://github.com/h-REA/hREA/releases/download/v0.3.2/hrea.dna -o workdir/hrea.dna

# Or run the postinstall script
npm run postinstall
```

#### 3. Connection Timeout
**Problem**: Holochain conductor not responding
**Solution**:
```bash
# Clean and restart
hc sandbox clean
bun start
```

#### 4. Port Already in Use
**Problem**: Default ports are occupied
**Solution**:
```bash
# Use different ports
UI_PORT=3000 BOOTSTRAP_PORT=9000 bun start
```

### Debug Mode

Enable verbose logging for troubleshooting:
```bash
RUST_LOG=debug bun start
```

### Clean Reset

If you encounter persistent issues:
```bash
# Clean Holochain sandbox
hc sandbox clean

# Clean Rust build artifacts
cargo clean

# Reinstall dependencies
rm -rf node_modules
bun install
```

## Next Steps

Once you have the basic example working:

1. **Explore the Code**: Study `ui/src/HREATest.svelte` to understand the integration patterns
2. **Add More Operations**: Implement resource creation, economic events, and processes
3. **Customize the UI**: Modify the interface for your specific use case
4. **Add Custom Logic**: Extend the custom DNA with app-specific functionality
5. **Deploy**: Package for production deployment

## Resources

- [hREA Documentation](https://github.com/h-REA/hREA) (this tutorial uses v0.3.2)
- [hREA v0.3.2 Release](https://github.com/h-REA/hREA/releases/tag/v0.3.2)
- [ValueFlows Specification](https://www.valueflo.ws/)
- [Holochain Developer Docs](https://developer.holochain.org/)
- [Svelte Documentation](https://svelte.dev/docs)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)

## Alternative Implementation: Using svelte-apollo

For a more Svelte-idiomatic approach, you could use `svelte-apollo` instead of direct Apollo Client. Here's how the code would look with hREA v0.3.2:

### Additional Dependency
```json
{
  "dependencies": {
    "svelte-apollo": "^0.5.0"
  }
}
```

> **📝 Note**: This alternative approach still uses the same `@valueflows/vf-graphql-holochain": "^0.0.3-alpha.10"` version that corresponds to hREA v0.3.2.

### Updated `contexts.svelte.ts` with svelte-apollo
```typescript
import { ApolloClient, InMemoryCache, from } from "@apollo/client/core";
import { AppWebsocket, InstalledCell, type AppInfo } from "@holochain/client";
import { HolochainLink } from "@valueflows/vf-graphql-holochain";
import { setClient } from "svelte-apollo";

// Holochain client state (same as before)
export class HolochainClientState {
  client = $state<AppWebsocket | null>(null);
  loading = $state(true);
  error = $state<string | null>(null);
  appInfo = $state<AppInfo | null>(null);

  // ... same connection logic as before ...
}

// hREA client state with svelte-apollo integration
export class HREAClientState {
  apolloClient = $state<ApolloClient<any> | null>(null);
  loading = $state(true);
  error = $state<string | null>(null);

  constructor(private holochainState: HolochainClientState) {
    $effect(() => {
      if (this.holochainState.client && this.holochainState.appInfo) {
        this.initializeHREA();
      }
    });
  }

  private async initializeHREA() {
    try {
      this.loading = true;
      this.error = null;

      const hreaCell = this.holochainState.appInfo!.installed_cells.find(
        (cell: InstalledCell) => cell.role_name === "hrea"
      );

      if (!hreaCell) {
        throw new Error("hREA cell not found in app");
      }

      const authToken = Buffer.from(
        `${hreaCell.cell_id[0]}:${hreaCell.cell_id[1]}`
      ).toString("base64");

      const link = new HolochainLink({
        uri: "ws://localhost:8888",
        wsClient: this.holochainState.client!,
        authToken,
      });

      this.apolloClient = new ApolloClient({
        link: from([link]),
        cache: new InMemoryCache(),
      });

      // Set the client globally for svelte-apollo
      setClient(this.apolloClient);

      this.loading = false;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "Failed to initialize hREA";
      this.loading = false;
    }
  }
}

// Global state instances
export const holochainClientState = new HolochainClientState();
export const hreaClientState = new HREAClientState(holochainClientState);

// Helper functions for getting states
export function getHolochainClient() {
  return holochainClientState;
}

export function getHREAClient() {
  return hreaClientState;
}
```

### Updated `HREATest.svelte` with svelte-apollo
```svelte
<script lang="ts">
  import { query, mutation } from "svelte-apollo";
  import { gql } from "@apollo/client/core";
  import { getHREAClient } from "./contexts.svelte";

  const hreaClient = getHREAClient();

  // Using svelte-apollo stores for queries
  const agentsQuery = query(gql`
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
  `);

  // Using svelte-apollo stores for mutations
  const createPersonMutation = mutation(gql`
    mutation CreatePerson($person: AgentCreateParams!) {
      createPerson(person: $person) {
        agent {
          id
          name
          note
        }
      }
    }
  `);

  const createOrgMutation = mutation(gql`
    mutation CreateOrganization($organization: OrganizationCreateParams!) {
      createOrganization(organization: $organization) {
        agent {
          id
          name
          note
        }
      }
    }
  `);

  // Reactive agents list from the query store using Svelte 5 runes
  let agents = $state([]);

  $effect(() => {
    agents = $agentsQuery.data?.agents?.edges?.map(edge => edge.node) || [];
  });

  // Event handlers using the mutation stores
  async function handleCreatePerson() {
    try {
      await createPersonMutation({
        variables: {
          person: {
            name: `Person ${Date.now()}`,
            note: "Created via svelte-apollo"
          }
        }
      });
      // Refetch agents automatically handled by svelte-apollo
      agentsQuery.refetch();
    } catch (error) {
      console.error("Error creating person:", error);
    }
  }

  async function handleCreateOrganization() {
    try {
      await createOrgMutation({
        variables: {
          organization: {
            name: `Organization ${Date.now()}`,
            note: "Created via svelte-apollo"
          }
        }
      });
      agentsQuery.refetch();
    } catch (error) {
      console.error("Error creating organization:", error);
    }
  }

  function handleRefreshAgents() {
    agentsQuery.refetch();
  }
</script>

{#if hreaClient.loading}
  <div class="status connecting">
    <div class="spinner"></div>
    Connecting to hREA...
  </div>
{:else if hreaClient.error}
  <div class="status error">
    <strong>Connection Error:</strong> {hreaClient.error}
  </div>
{:else if hreaClient.apolloClient}
  <div class="status success">
    ✅ Connected to hREA successfully
  </div>

  <div class="demo-section">
    <h2>🏢 Agent Management</h2>
    <p>Create and manage economic agents (people and organizations)</p>

    <div class="button-group">
      <button on:click={handleCreatePerson} disabled={$createPersonMutation.loading}>
        {$createPersonMutation.loading ? "Creating..." : "Create Person"}
      </button>

      <button on:click={handleCreateOrganization} disabled={$createOrgMutation.loading}>
        {$createOrgMutation.loading ? "Creating..." : "Create Organization"}
      </button>

      <button on:click={handleRefreshAgents} disabled={$agentsQuery.loading}>
        {$agentsQuery.loading ? "Loading..." : "Refresh Agents"}
      </button>
    </div>

    <!-- Query loading and error states -->
    {#if $agentsQuery.loading}
      <div class="loading">Loading agents...</div>
    {:else if $agentsQuery.error}
      <div class="error">Error loading agents: {$agentsQuery.error.message}</div>
    {:else}
      <div class="agents-list">
        <h3>Current Agents ({agents.length})</h3>
        {#each agents as agent (agent.id)}
          <div class="agent-card">
            <strong>{agent.name}</strong>
            {#if agent.note}
              <p>{agent.note}</p>
            {/if}
            <small>ID: {agent.id}</small>
          </div>
        {:else}
          <p>No agents created yet. Try creating a person or organization!</p>
        {/each}
      </div>
    {/if}

    <!-- Mutation error states -->
    {#if $createPersonMutation.error}
      <div class="error">Error creating person: {$createPersonMutation.error.message}</div>
    {/if}

    {#if $createOrgMutation.error}
      <div class="error">Error creating organization: {$createOrgMutation.error.message}</div>
    {/if}
  </div>
{/if}

<!-- Same styles as before -->
<style>
  /* ... same styles ... */
</style>
```

### Key Benefits of svelte-apollo Approach

1. **Reactive Stores**: Queries and mutations are Svelte stores that automatically update components
2. **Built-in Loading States**: `$query.loading`, `$mutation.loading` are automatically managed
3. **Error Handling**: `$query.error`, `$mutation.error` provide reactive error states
4. **Automatic Refetching**: Less manual cache management needed
5. **Cleaner Code**: Less boilerplate, more declarative
6. **Better TypeScript**: Better type inference with Svelte stores

### Trade-offs

**Direct Apollo Client (Current)**:
- ✅ More explicit control
- ✅ Better for learning GraphQL concepts
- ✅ Smaller bundle size
- ❌ More boilerplate code
- ❌ Manual state management

**svelte-apollo**:
- ✅ More reactive and Svelte-idiomatic
- ✅ Less boilerplate
- ✅ Built-in loading/error states
- ✅ Automatic subscription management
- ❌ Additional dependency
- ❌ Less explicit control over caching

For tutorials, the direct Apollo Client approach is probably better for educational purposes, but for production apps, `svelte-apollo` would provide a better developer experience.
