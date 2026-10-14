# Moss/Weave Integration

This document describes how Requests & Offers integrates with the Weave/Moss ecosystem as a Moss Tool. It covers architecture, design decisions, and development setup.

## Overview

R&O runs in two modes:

1. **Standalone** -- Direct connection via `AppWebsocket`
2. **Moss Tool** -- Integrated via `WeaveClient` within a Moss group

The app detects its context once at startup and adapts connection, profile handling, and admin detection accordingly. Weave-specific concerns are isolated in a dedicated `WeaveService` + `weaveStore` layer, keeping `HolochainClientService` focused on core Holochain connectivity.

---

## 1. Context Detection

Context detection uses a two-stage approach coordinated between `+layout.svelte` and the Weave layer.

**Stage 1 -- Hot-reload setup and detection** (`+layout.svelte` onMount):

```typescript
// +layout.svelte — onMount
onMount(async () => {
  // Sets up window.__WEAVE_API__ which isWeaveContext() checks.
  // MUST run before Weave context detection.
  try {
    await initializeHotReload();
  } catch {
    // Expected to fail in non-Weave environments and production webhapps
  }

  // Detect Weave context AFTER hot-reload has set up the environment
  weaveStore.detectWeaveContext();
  // ...
});
```

**Stage 2 -- Connection delegation** (`HolochainClientService.connectClient()`):

```typescript
// HolochainClientService.svelte.ts — connectClient()
if (weaveStore.isWeaveContext) {
  console.log('🧶 Detected Weave context, connecting via WeaveClient...');
  const result = await weaveStore.connect();
  client = result.appClient;
} else {
  console.log('📡 Standalone mode, connecting via AppWebsocket...');
  client = await AppWebsocket.connect();
}
```

The `WeaveService` lazily detects the Weave context by calling `isWeaveContext()` from `@theweave/api`. This lazy detection is necessary because in `weave dev` mode, `initializeHotReload()` must set up `window.__WEAVE_API__` before `isWeaveContext()` can detect the environment.

Cross-group views (`renderInfo.type !== 'applet-view'`) are not yet supported and result in a `WeaveError`.

**Key files:**
- `ui/src/lib/stores/weave.store.svelte.ts`
- `ui/src/lib/services/weave.service.ts`
- `ui/src/lib/services/HolochainClientService.svelte.ts`

---

## 2. Connection Management

Both modes share the same retry logic in `HolochainClientService`:

- **Max retries:** 3 attempts
- **Backoff:** Exponential -- 2s, 4s, 8s delays (`Math.pow(2, retryCount) * 1000`)
- **State tracking:** Reactive `isConnected` / `isConnecting` flags
- **Concurrent guard:** If a connection attempt is already in progress, callers wait via polling

In Weave context, `HolochainClientService.connectClient()` delegates to `weaveStore.connect()`, which internally runs `WeaveService.connect()` via Effect. This returns a `WeaveConnectionResult` containing the `appClient`, `weaveClient`, and `profilesClient`. In standalone mode, `AppWebsocket.connect()` is called directly. The retry/backoff/state-tracking logic remains in `HolochainClientService` for both paths.

Components can call `waitForConnection()` to block until the client is ready, or use `verifyConnection()` to test connectivity (attempts `client.appInfo()` as a health check).

On WebSocket or connection errors during `callZome()`, the service marks itself as disconnected and nulls the client, forcing reconnection on the next call.

---

## 3. Hybrid Profile System

In Moss, users already have a profile (nickname + avatar) managed by the group's `ProfilesClient`. R&O stores additional professional data (bio, email, skills, location). The `weaveStore` manages profile fetching, avatar conversion, and enrichment of R&O users with Moss identity data.

### WeaveStore Profile Management

The `weaveStore` provides methods and reactive state for Moss profile handling:

**Methods:**

| Method | Purpose |
|--------|---------|
| `initialize(agentPubKey)` | Fetch Moss profile via `profilesClient.getAgentProfile()`, populate reactive state |
| `refreshMossProfile(agentPubKey)` | Re-fetch Moss profile (e.g., after profile update) |
| `enrichWithMossProfile(raoUser, agentPubKey)` | Merge Moss identity onto an R&O `UIUser` (Effect-based) |

**Reactive state:**

| Property | Type | Description |
|----------|------|-------------|
| `mossProfile` | `MossProfile \| null` | Current Moss profile (nickname + avatar) |
| `mossAvatarBlob` | `Blob \| null` | Decoded avatar as a `Blob` for direct display |
| `hasMossNickname` | `boolean` | Derived: in Weave context and profile has nickname |
| `hasMossAvatar` | `boolean` | Derived: in Weave context and avatar blob exists |
| `mossNickname` | `string \| null` | Derived: the Moss nickname or null |

After connection, the layout initializes the Weave store profile state:

```typescript
// +layout.svelte — initialization orchestrator
if (weaveStore.isWeaveContext) {
  const appInfo = await hc.getAppInfo();
  if (appInfo?.agent_pub_key) {
    await weaveStore.initialize(appInfo.agent_pub_key as AgentPubKey);
  }
}
```

**Enrichment behavior:**
- Moss context: `enrichWithMossProfile` returns a `UIUser` with `nickname` and `picture` from Moss, all other fields from R&O, and `identitySource: 'moss'`
- Standalone: Returns the R&O user as-is with `identitySource: 'standalone'`
- If a Moss profile exists but no R&O user record yet (new user in Moss), a minimal `UIUser` is returned with Moss identity fields and empty R&O fields

### Component Integration

Components import `weaveStore` directly to access Moss profile data. For example, `UserForm.svelte` uses the store to pre-fill the nickname and avatar when creating a new user in Moss context:

- `weaveStore.mossNickname` -- Pre-fills the nickname field
- `weaveStore.hasMossNickname` -- Controls whether nickname is editable
- `weaveStore.hasMossAvatar` -- Controls avatar display/editing
- `weaveStore.mossAvatarBlob` -- Provides the avatar for preview

### Error Handling

`WeaveError` is a tagged error (`Data.TaggedError('WeaveError')`) with fields for `message`, `cause`, `context`, `agentPubKey`, and `operation`. Error contexts are defined in `WEAVE_CONTEXTS`:

- `DETECT_CONTEXT` -- Detecting Weave environment
- `CONNECT` -- Connecting to Weave
- `GET_MOSS_PROFILE` -- Fetching from Moss `profilesClient`
- `ENRICH_WITH_MOSS_PROFILE` -- Merging Moss data onto R&O profile
- `CHECK_PROGENITOR` -- Checking tool installer status
- `AVATAR_CONVERSION` -- Converting base64 avatar to binary

**Key files:**
- `ui/src/lib/services/weave.service.ts`
- `ui/src/lib/stores/weave.store.svelte.ts`
- `ui/src/lib/errors/weave.errors.ts`
- `ui/src/lib/errors/error-contexts.ts`
- `ui/src/lib/types/ui.ts` (`identitySource` field on `UIUser`)

---

## 4. Progenitor Detection (Admin)

In Moss, the group "progenitor" (the agent who installed the tool) gets admin rights automatically.

### Working approach: `toolInstaller()` + pubkey comparison

The `weaveStore.checkProgenitor(myPubKey)` method handles progenitor detection:

```typescript
// weave.store.svelte.ts — checkProgenitor()
async function checkProgenitor(myPubKey: AgentPubKey): Promise<boolean> {
  if (!isWeaveContext || !weaveClient) {
    isProgenitor = false;
    return false;
  }

  const renderInfo = weaveClient.renderInfo;
  if (renderInfo.type !== 'applet-view') {
    isProgenitor = false;
    return false;
  }

  const appletHash = renderInfo.appletHash;
  const installerPubKey = await weaveClient.toolInstaller(appletHash);
  if (!installerPubKey) {
    isProgenitor = false;
    return false;
  }

  const installerB64 = encodeHashToBase64(installerPubKey);
  const myB64 = encodeHashToBase64(myPubKey);
  isProgenitor = installerB64 === myB64;
  return isProgenitor;
}
```

`toolInstaller(appletHash)` returns the `AgentPubKey` of whoever installed the R&O tool in this Moss group. Comparing it with the current agent's pubkey gives cryptographic proof of installer identity. The result is stored as reactive `isProgenitor` state.

### Failed approach: `myAccountabilitiesPerGroup()`

An earlier attempt used `weaveClient.myAccountabilitiesPerGroup()` to check for a "Progenitor" role. This doesn't work because the API returns group role *definitions* to all agents, not filtered by who holds them. Both the progenitor and regular members receive identical data showing "Progenitor role exists."

### Standalone fallback

When not in Moss context, `checkProgenitor()` sets `isProgenitor = false` and returns immediately. The existing R&O admin system (explicit `registerNetworkAdministrator` / `addNetworkAdministrator`) handles admin rights.

**Key file:** `ui/src/lib/stores/weave.store.svelte.ts`

---

## 5. Auto-Admin Registration

The `+layout.svelte` initialization orchestrator runs `autoRegisterProgenitorAdminStep` after connection, hREA init, network verification, Weave store initialization, and user data loading:

1. Check `weaveStore.isWeaveContext` -- skip if standalone
2. Get agent pubkey from `hc.getAppInfo()`
3. Call `weaveStore.checkProgenitor(agentPubKey)` -- skip if not progenitor
4. Call `administrationStore.hasAnyAdministrators()` -- skip if admins already exist
5. Check `usersStore.currentUser` exists with an `original_action_hash`
6. Call `administrationStore.registerNetworkAdministrator(userHash, [pubKey])`

This is wrapped in `E.catchAll` so failures are non-critical -- the app continues normally.

In standalone mode, first-admin registration is triggered via `Ctrl+Shift+A` keyboard shortcut, which shows a confirmation modal. This shortcut is blocked in Weave context since progenitor auto-admin handles it.

**Key files:**
- `ui/src/routes/+layout.svelte`
- `ui/src/lib/stores/weave.store.svelte.ts`

---

## 6. Network Peer Discovery

`getNetworkPeers()` queries the conductor for connected peers:

1. Checks `client instanceof AppWebsocket` (method not available on the generic `AppClient` interface used in Moss)
2. Calls `client.agentInfo({ dna_hashes: null })`
3. Handles multiple response formats (object with `agent_pub_key`, JSON strings, nested `agentInfo.agent`)
4. Returns a deduplicated array of agent public key strings

Similarly, `getPeerMetaInfo()` collects metadata from peers by calling `client.peerMetaInfo()` for each discovered agent URL.

**Limitation:** In Weave context, the client is an `AppClient` (not `AppWebsocket`), so `agentInfo` / `peerMetaInfo` are not available. These methods return empty results. A future upstream PR to `@holochain/client` could add these to the `AppClient` interface.

**Key file:** `ui/src/lib/services/HolochainClientService.svelte.ts`

---

## 7. Data Flow

```
User opens R&O
       │
       ▼
 +layout.svelte (onMount)
       │
       ├──► initializeHotReload()
       │
       ▼
 weaveStore.detectWeaveContext()
       │
       ▼
 connectToHolochain()
       │
       ├── Weave? → weaveStore.connect() → WeaveService.connect() → WeaveClient
       │                                          │
       └── Standalone? → AppWebsocket.connect()   │
                │                                  │
                ▼                                  ▼
       Store client reference ◄────────────────────┘
       │
       ▼
 Initialize hREA, verify network, load user data
       │
       ▼
 weaveStore.initialize(agentPubKey)  (Weave only — fetch Moss profile)
       │
       ▼
 autoRegisterProgenitorAdminStep
       │    └── weaveStore.checkProgenitor(pubKey)
       │
       ▼
 App renders
       │
       ├──► Profile display → weaveStore → Moss or R&O profiles
       │
       ├──► Admin checks → weaveStore.isProgenitor → Moss group data or R&O admin system
       │
       └──► Zome calls → HolochainClientService → Holochain conductor
```

---

## 8. Development Setup

### Directory structure

```
weave/
├── applet-dev.sh           # Multi-agent launch script
├── curations-0.15.json     # Tool curation metadata for Moss registry
├── tool-list-0.15.json     # Tool registry (versions, hashes, download URLs)
└── weave.dev.config.json   # Dev sandbox config (groups, agents, applets)
```

### Running in Weave dev mode

```bash
bun run applet-dev          # Launches with 2 agents by default
AGENTS=3 bun run applet-dev # Custom number of agents (1-10)
```

The `applet-dev.sh` script:
1. Starts the UI dev server on port 8888
2. Launches agent 1 with `weave --agent-idx 1 --dev-config ./weave/weave.dev.config.json`
3. Launches additional agents with staggered delays (5s between each) and `--sync-time 20000`
4. Uses `concurrently` to run all processes

### Dev sandbox config (`weave.dev.config.json`)

Defines a test group ("R&O Dev Group") with:
- `networkSeed: "ro-dev-test-2026"` for isolated test networks
- Agent 1 as the creating agent (becomes progenitor)
- The `requests_and_offers` applet sourced from `localhost` (hApp from `./workdir/requests_and_offers.happ`, UI from port 8888)

### Tool registry (`tool-list-0.15.json`)

Contains the developer collective metadata and tool versions for the Moss tool directory:
- Developer: hAppenings Community CIC
- Tool ID: `requests-and-offers`
- Version branch: `0.3.x`
- Includes hApp, WebHapp, and UI SHA256 hashes for integrity verification

### Curations (`curations-0.15.json`)

Points Moss to the tool list URL for discovery in the Moss tool directory.

---

## 9. Weave API Reference

Key methods used from `@theweave/api`:

| Method | Purpose | Returns |
|--------|---------|---------|
| `isWeaveContext()` | Detect if running inside Moss | `boolean` |
| `WeaveClient.connect()` | Establish connection in Moss context | `WeaveClient` |
| `initializeHotReload()` | Enable dev hot-reload in Moss | `void` |
| `weaveClient.renderInfo` | Get applet view info, client, profiles client | `RenderInfo` |
| `weaveClient.toolInstaller(appletHash)` | Get pubkey of tool installer | `AgentPubKey \| undefined` |
| `weaveClient.renderInfo.appletClient` | Holochain `AppClient` for zome calls | `AppClient` |
| `weaveClient.renderInfo.profilesClient` | Profiles service for Moss identities | `ProfilesClient` |
| `weaveClient.renderInfo.appletHash` | Hash identifying this tool installation | `AppletHash` |

---

## 10. Version Compatibility

| Package | Version |
|---------|---------|
| `@theweave/api` | 0.6.3 |
| `@theweave/cli` | 0.15.10 |
| Moss | 0.15.x |
| Holochain | 0.6.x |
| R&O | 0.3.0 |

---

## 11. Files Reference

| Category | File | Purpose |
|----------|------|---------|
| **Weave Service** | `ui/src/lib/services/weave.service.ts` | Effect-TS service for context detection + WeaveClient connection |
| **Weave Store** | `ui/src/lib/stores/weave.store.svelte.ts` | Reactive store: profile state, avatar, progenitor check, enrichment |
| **Connection** | `ui/src/lib/services/HolochainClientService.svelte.ts` | Delegates to weaveStore for Weave connection, peer discovery |
| **Connection Utils** | `ui/src/lib/utils/holochain-client.utils.ts` | Simple connection/status helpers used by layout |
| **Errors** | `ui/src/lib/errors/weave.errors.ts` | `WeaveError` tagged error |
| **Error Contexts** | `ui/src/lib/errors/error-contexts.ts` | `WEAVE_CONTEXTS` |
| **Types** | `ui/src/lib/types/ui.ts` | `identitySource` field on `UIUser` |
| **Admin Store** | `ui/src/lib/stores/administration.store.svelte.ts` | Admin detection, progenitor auto-registration |
| **Layout** | `ui/src/routes/+layout.svelte` | Initialization orchestrator, auto-admin step |
| **User Form** | `ui/src/lib/components/users/UserForm.svelte` | Moss profile pre-fill via weaveStore |
| **Weave Config** | `weave/weave.dev.config.json` | Dev sandbox configuration |
| **Tool Registry** | `weave/tool-list-0.15.json` | Moss tool directory metadata |
| **Curations** | `weave/curations-0.15.json` | Moss tool curation entry |
| **Dev Script** | `weave/applet-dev.sh` | Multi-agent Weave dev launcher |

---

## 12. Testing Checklist

- [ ] App loads in Moss group without errors
- [ ] Profile displays correctly (nickname + avatar from Moss)
- [ ] User creation form pre-fills with Moss profile data
- [ ] Group progenitor is auto-registered as admin
- [ ] Non-progenitor agents do not get auto-admin
- [ ] Admin features available to progenitor
- [ ] Network peers visible in standalone mode
- [ ] Standalone mode still works (regression test)
- [ ] DHT propagation between multiple agents in Weave dev mode
- [ ] `Ctrl+Shift+A` blocked in Weave context

---

## 13. Future Considerations

1. **Deeper Moss permissions** -- Currently only progenitor status is checked. Moss may offer richer permission models that could map to R&O roles.

2. **Profile sync** -- Profiles are read-only from Moss. Bidirectional sync could be explored if R&O has fields that should flow back to Moss.

3. **Cross-group views** -- Currently unsupported (`renderInfo.type !== 'applet-view'` returns a `WeaveError`). Could enable multi-group visibility in future.

4. **`AppClient` interface** -- Upstream PR to `@holochain/client` to add `agentInfo` / `peerMetaInfo` to `AppClient` would allow peer discovery in Moss context.
