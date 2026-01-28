# Weave/Moss Integration Technical Specification

## Overview

R&O can run both as a standalone Holochain application and as a Tool within the Weave/Moss ecosystem. This document covers the technical implementation of Moss integration, focusing on identity management and role detection.

## Context Detection

The application detects its runtime context at initialization:
```typescript
// HolochainClientService.svelte.ts
const inWeaveContext = isWeContext();
```

When running in Moss:
- Connection established via `WeaveClient.connect()` instead of direct `AppWebsocket`
- `profilesClient` obtained from WeaveClient for Moss-managed identity
- Additional APIs available for group and tool management

## Progenitor Detection (Admin Role)

### The Problem

In Moss, the group "progenitor" (creator) should automatically receive admin privileges in R&O. However, detecting who the progenitor is requires careful API selection.

### Failed Approach: `myAccountabilitiesPerGroup()`

Initial implementation used:
```typescript
const accountabilities = await weaveClient.myAccountabilitiesPerGroup();
// Check for 'Progenitor' role
```

**Issue:** This API returns group role *definitions* to all agents, not filtered by who holds them. Both Agent 1 (progenitor) and Agent 2 (member) receive identical data showing "Progenitor role exists."

### Working Solution: `toolInstaller()` + Pubkey Comparison
```typescript
async function isGroupProgenitor(): Promise<boolean> {
  const renderInfo = weaveClient.renderInfo;
  if (renderInfo.type !== 'applet-view') return false;

  const appletHash = renderInfo.appletHash;
  const installerPubKey = await weaveClient.toolInstaller(appletHash);
  const myPubKey = client?.myPubKey;

  const installerB64 = encodeHashToBase64(installerPubKey);
  const myB64 = encodeHashToBase64(myPubKey);

  return installerB64 === myB64;
}
```

**Why this works:**
- `toolInstaller(appletHash)` returns the specific `AgentPubKey` of whoever installed the R&O tool in this group
- Every Holochain agent has a unique cryptographic keypair
- By comparing pubkeys, we get cryptographic proof: "Did *I* install this tool?"
- Only the actual installer matches → only they get auto-admin

This follows Holochain's agent-centric model: cryptographic proof of "who performed this action" rather than querying a shared roles table.

## Weave API Reference

Key methods used from `@theweave/api`:

| Method | Purpose | Returns |
|--------|---------|---------|
| `toolInstaller(appletHash, groupHash?)` | Get pubkey of tool installer | `AgentPubKey \| undefined` |
| `myAccountabilitiesPerGroup()` | Get role definitions (not agent-specific) | `[DnaHash, MossAccountability[]][]` |
| `appletParticipants()` | Get all agents using this tool | `AgentPubKey[]` |
| `groupProfile(groupHash)` | Get group metadata | Group profile object |

## Hybrid Profile Architecture

When running in Moss:
- **Basic identity** (nickname, avatar): Managed by Moss `profilesClient`
- **Extended data** (bio, email, location, skills): Stored in R&O's own profiles zome

`ProfileDisplayService` handles pre-filling forms with Moss identity data while allowing R&O-specific fields.

## Version Compatibility

- **@theweave/api**: 0.6.3
- **@theweave/cli**: 0.15.10
- **Moss**: 0.15.x (Holochain 0.6.0)
- **R&O**: 0.3.0 (Holochain 0.6.x compatible)
