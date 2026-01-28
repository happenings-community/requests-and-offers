# R&O Moss Integration - Architecture & Design Decisions

This document describes the architectural patterns and design decisions made to integrate Requests & Offers as a Weave Tool for Moss 0.15+.

## Overview

R&O can now run in two modes:
1. **Standalone** - Direct connection via AppWebsocket
2. **Moss Tool** - Integrated via WeaveClient within a Moss group

The app detects its context at startup and adapts accordingly.

---

## 1. Weave/Moss Context Detection

**Pattern:** Automatic environment detection at startup

**Flow:**
1. `+layout.svelte` initializes before the app renders
2. Calls `isWeaveContext()` from `@theweave/api` to detect Moss
3. If Moss detected → connect via `WeaveClient.connect()`
4. If standalone → connect via `AppWebsocket.connect()`
5. Connection includes retry logic with exponential backoff (3 attempts)

**Decision:** We detect context once at startup rather than checking repeatedly. The app then uses the appropriate client throughout its lifecycle.

**Key file:** `ui/src/lib/services/HolochainClientService.svelte.ts`

---

## 2. Hybrid Profile System

**Pattern:** Abstraction layer that unifies two profile sources

**The problem:** In Moss, users already have a profile managed by the group's ProfilesClient. In standalone mode, R&O manages its own profiles. We needed R&O to work seamlessly in both contexts without duplicating profile data.

**Solution - ProfileDisplayService:**
- When in Moss → fetches profile from `weaveClient.renderInfo.profilesClient`
- When standalone → uses R&O's internal profile system
- Components call the same service methods regardless of context

**Flow for profile display:**
1. Component requests profile for an agent
2. ProfileDisplayService checks `isWeaveContext`
3. Routes to appropriate profile source
4. Returns unified profile format to component

**Decision:** We prioritize Moss profiles when available. This means users see consistent identities across all tools in their Moss group.

**Key files:** 
- `ui/src/lib/services/profileDisplay.service.ts`
- `ui/src/lib/components/users/UserForm.svelte`

---

## 3. Group Progenitor (Admin) Detection

**Pattern:** Derive admin status from Moss group membership data

**The problem:** R&O has admin features (like creating service types). In standalone mode, we use an explicit admin system. In Moss, we needed a way to determine who has admin rights without duplicating governance.

**Solution:** The group "progenitor" (creator) is treated as admin when running in Moss.

**Flow:**
1. `isGroupProgenitor()` called when admin features are accessed
2. Gets current agent's public key from `appInfo()`
3. Compares against `weaveClient.renderInfo.groupProfiles`
4. First profile in the array is assumed to be the group creator
5. Returns `true` if current agent matches

**Decision:** We use group creator as a proxy for admin rights. This is a simplification - future versions could integrate with Moss's permission system more deeply. For alpha testing, this gives us a working admin model.

**Fallback:** When not in Moss context, returns `false` and the existing R&O admin system takes over.

**Key files:**
- `ui/src/lib/services/HolochainClientService.svelte.ts` (`isGroupProgenitor()`)
- `ui/src/lib/stores/administration.store.svelte.ts`

---

## 4. Network Peer Discovery

**Pattern:** Direct conductor queries for peer visibility

**The problem:** We wanted to show users who else is connected to the R&O network - useful for understanding DHT health and community presence.

**Solution:** Query the conductor's `agentInfo` method to get connected peers.

**Flow:**
1. `getNetworkPeers()` calls `client.agentInfo({ dna_hashes: null })`
2. Parses response (handles multiple response formats)
3. Extracts agent public keys
4. Returns deduplicated list of peer identifiers

**Technical note:** The `agentInfo` and `peerMetaInfo` methods aren't in the TypeScript type definitions for `AppClient`, but exist at runtime. We use type assertions (`client as any`) to access them. This is a known gap in the Holochain client types.

**Key file:** `ui/src/lib/services/HolochainClientService.svelte.ts`

---

## 5. Custom Network Infrastructure Support

**Pattern:** Configurable bootstrap and signal servers

**The problem:** hAppenings runs its own network infrastructure. R&O needs to connect to hAppenings' bootstrap and signal servers rather than defaults.

**Solution:** Network configuration is read from DNA modifiers, allowing different deployments to use different infrastructure.

**Configuration points:**
- `.kitsune2_bootstrap_srv` - Bootstrap server endpoint
- Network seed in DNA modifiers
- Signal server configuration

**Decision:** Infrastructure configuration lives in the DNA/happ level, not hardcoded in the UI. This allows the same UI code to work with different network deployments.

---

## 6. Connection Management

**Pattern:** Resilient connection with graceful degradation

**Flow:**
1. Initial connection attempt
2. On failure → exponential backoff (1s, 2s, 4s delays)
3. Maximum 3 retry attempts
4. Connection state tracked via reactive variables (`isConnected`, `isConnecting`)
5. Components can await `waitForConnection()` before making calls

**Decision:** We fail gracefully rather than crashing. If connection fails after retries, the app shows appropriate error state rather than blank screen.

---

## Data Flow Summary
```
User opens R&O in Moss
         │
         ▼
   +layout.svelte
         │
         ▼
   isWeaveContext()? ──── No ───► AppWebsocket.connect()
         │                              │
        Yes                             │
         │                              │
         ▼                              │
   WeaveClient.connect()                │
         │                              │
         ▼                              ▼
   Store client reference ◄─────────────┘
         │
         ▼
   App renders with appropriate context
         │
         ├─► Profile requests → ProfileDisplayService → Moss or R&O profiles
         │
         ├─► Admin checks → isGroupProgenitor() → Moss group data or R&O admin
         │
         └─► Network calls → HolochainClientService → Conductor
```

---

## Files Changed

| Category | Files | Purpose |
|----------|-------|---------|
| **Moss Integration** | `HolochainClientService.svelte.ts` | WeaveClient detection, group progenitor check, peer discovery |
| **Profile Handling** | `profileDisplay.service.ts`, `UserForm.svelte` | Hybrid Moss/standalone profile support |
| **Admin Features** | `administration.store.svelte.ts` | Group progenitor-based admin detection |
| **Layout** | `+layout.svelte` | Weave context initialization |
| **Weave Config** | `weave.dev.config.json`, `weave/config.ts` | Dev/production Weave configuration |
| **Deployment** | `tool-list-0.15.json`, `curations-0.15.json` | Moss tool list files |
| **Build Fixes** | 6 test files | Added `isGroupProgenitor` to mocks |

---

## Future Considerations

1. **Deeper Moss permissions integration** - Currently we only check progenitor status. Moss may offer richer permission models we could leverage.

2. **Profile sync** - Currently profiles are read-only from Moss. Could explore bidirectional sync if R&O profile has fields Moss doesn't.

3. **Cross-group views** - Currently throws error for cross-group contexts. Could be supported in future.

4. **Type definitions** - Upstream PR to `@holochain/client` to add `agentInfo`/`peerMetaInfo` types would remove need for type assertions.

---

## Testing

Before merging, test the following:

- [ ] App loads in Moss group without errors
- [ ] Profile displays correctly (from Moss profiles)
- [ ] Admin features available to group progenitor
- [ ] Network peers visible
- [ ] DHT propagation between multiple peers
- [ ] Standalone mode still works (regression test)
