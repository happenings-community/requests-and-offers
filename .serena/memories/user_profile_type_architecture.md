# User Profile Type Architecture Analysis

## Overview
There are TWO separate user profile type systems in the codebase:
1. **UIUser** - The primary user entity type used throughout the application
2. **DisplayProfile** - A newly created type in profileDisplay.service.ts that is NOT YET INTEGRATED

## UIUser Type (Primary, Integrated)

### Definition Location
- **ui/src/lib/types/ui.ts** (line 33)
- **ui/src/lib/schemas/users.schemas.ts** (line 87-102) - Effect Schema version

### Fields
```typescript
UIUser = UserInDHT & {
  // Core fields from UserInDHT:
  name: string
  nickname: string
  bio?: string
  picture?: Uint8Array
  user_type: 'creator' | 'advocate'
  email: string
  phone?: string
  time_zone?: string
  location?: string

  // UI-specific fields:
  agents?: AgentPubKey[]
  remaining_time?: number
  original_action_hash?: ActionHash
  previous_action_hash?: ActionHash
  status?: UIStatus
  status_history?: Revision[]
  organizations?: ActionHash[]
  role?: OrganizationRole
  is_test_peer?: boolean  // For test mode
}
```

### Usage Locations (18 files)
- **Stores**: users.store.svelte.ts, administration.store.svelte.ts, hrea.store.svelte.ts
- **Composables**: useUserSearch.svelte.ts, useUsersManagement.svelte.ts, useUserAccessGuard.svelte.ts, useRequestDetails.svelte.ts, useRequestsManagement.svelte.ts, useOffersManagement.svelte.ts
- **Utilities**: index.ts, userAccessGuard.ts
- **Tests**: Multiple test files
- **Type System**: types/ui.ts, schemas/users.schemas.ts

### Usage Pattern
UIUser is used throughout the application for:
- User management and display
- Access control and permissions
- Request/Offer creator information
- Organization membership tracking
- Status management and history
- Test mode peer display

---

## DisplayProfile Type (New, Isolated)

### Definition Location
- **ui/src/lib/services/profileDisplay.service.ts** (line 14-25)

### Fields
```typescript
DisplayProfile {
  nickname: string
  picture?: Uint8Array
  name?: string
  bio?: string
  email?: string
  phone?: string
  time_zone?: string
  location?: string
  user_type?: 'creator' | 'advocate'
  identitySource: 'moss' | 'standalone'  // KEY DIFFERENTIATOR
}
```

### Companion Types
```typescript
MossProfile {
  nickname: string
  avatar?: string
}
```

### Current Usage Status
- **DEFINED**: In profileDisplay.service.ts
- **EXPORTED**: Yes, exported from profileDisplay.service.ts
- **INTEGRATED**: NO - Not used anywhere else in codebase
- **IMPORTED**: 0 files (except the definition file itself)

---

## Key Architectural Differences

| Aspect | UIUser | DisplayProfile |
|--------|--------|-----------------|
| **Purpose** | Core user entity, system-wide | Display profile (Weave/Moss integration) |
| **Identity Source** | Not tracked | Explicitly tracked (moss/standalone) |
| **Moss Integration** | Not considered | Direct Moss profile support |
| **Status Tracking** | Full status + history | No status tracking |
| **Agent Keys** | Array of AgentPubKey | Not included |
| **Organization** | Organizations + role | Not included |
| **Permissions** | Used for access control | Display only |
| **Integration State** | Fully integrated | Isolated in profileDisplay service |

---

## The identitySource Field

- **Location**: DisplayProfile only (profileDisplay.service.ts, line 24)
- **Values**: 'moss' | 'standalone'
- **Purpose**: Track whether the profile comes from:
  - **'moss'**: Weave/Moss network profile (from profilesClient)
  - **'standalone'**: Local R&O standalone profile (from usersStore)
- **Used In**: Line 117 (moss) and Line 139 (standalone)
- **Not In UIUser**: UIUser has no identity source field

---

## ProfileDisplayService Implementation

### getMossProfile Function
- Fetches profile from Moss/Weave network (if available)
- Returns: `MossProfile | null`
- Source: hc.profilesClient (Holochain Profiles module)

### getDisplayProfile Function
1. Fetches R&O user from usersStore
2. If Weave context:
   - Try getMossProfile
   - If found, merge Moss identity + R&O data, mark as 'moss'
3. If no Moss profile or not Weave context:
   - Use R&O user data, mark as 'standalone'
4. Returns: `DisplayProfile | null`

### Merging Logic (Lines 88-141)
```
In Weave context:
  IF getMossProfile found:
    return {
      nickname: from Moss
      picture: from Moss (base64 decoded)
      name, bio, email, phone, time_zone, location, user_type: from R&O
      identitySource: 'moss'
    }

IF no Moss profile or not Weave:
  IF R&O user exists:
    return {
      all fields: from R&O
      identitySource: 'standalone'
    }

ELSE:
  return null
```

---

## Integration Status

### Why DisplayProfile Is Not Integrated
1. Service is defined but not injected into dependency graph
2. Not imported in any composables or stores
3. No store uses it for caching/state
4. No components reference it

### What Would Integration Look Like
```typescript
// Currently: Not imported anywhere
// To integrate would need:
- Import ProfileDisplayServiceTag in stores/composables
- Use getDisplayProfile in ProfileDisplayService
- Cache results in a display profile store
- Export from types/index.ts
- Use in UI components for Weave integration
```

### Architectural Gap
DisplayProfile exists as an isolated service but has no integration layer connecting it to:
- The user store
- Display components
- Request/Offer creator display
- Any UI consumption layer

---

## Conclusion

**Two Separate Systems Currently:**
1. **UIUser**: Full-featured, integrated system for all user operations
2. **DisplayProfile**: Newly created Weave/Moss integration service, not yet integrated

**Merging Strategy Would Need:**
- Extend UIUser to include identitySource field
- Move Moss integration logic into users service
- Create composable to use ProfileDisplayService for display profiles
- Decide on caching strategy (store vs on-demand)
- Update all display components to use merged type

**Current State**: No conflict because they're in separate systems (no overlap in usage).
