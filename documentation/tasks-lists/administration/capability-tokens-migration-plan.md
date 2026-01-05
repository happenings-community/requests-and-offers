# Capability Tokens Migration Plan

## Overview

This document outlines the migration from the current anchor-based administration system to a capability-token-based system in the Requests and Offers Holochain application.

## Current System Problems

### Anchor-Based Administration Issues

- **Performance Bottlenecks**: Slow DHT lookups for every admin verification
- **Weak Liveness**: Anchors can become stale and unreliable
- **Poor Granularity**: All-or-nothing admin privileges
- **Privacy Concerns**: Admin list publicly readable from DHT
- **Code Clutter**: Authorization logic repeated across multiple functions
- **No Expiration**: Admin privileges never expire automatically

## Capability-Based Solution Benefits

### Immediate Improvements

- **Performance**: Eliminate slow DHT anchor lookups
- **Security**: Time-limited, revocable access tokens
- **Granularity**: Function-specific and scope-specific permissions
- **Privacy**: Capabilities not publicly readable
- **Clean Code**: Authorization handled automatically by runtime

### Advanced Features

- **Delegation**: Admins can grant subset of their permissions
- **Auditing**: Track capability usage and revocation
- **Rotation**: Regularly rotate capability secrets
- **Scope Isolation**: Organization admins can't access network functions

## Migration Architecture (Holochain-Native with Admin Enumeration)

### 1. Hybrid Capability + Registry Approach

**Core Design Decision**: Use **both** capabilities and a public registry to get the best of both worlds:

1. **Capability Grants**: For fast, secure authorization (private, instant checks)
2. **Public Admin Registry**: For enumeration and UI display (public, DHT-based)

**Why Hybrid?**

- ✅ **Performance**: Authorization checks are instant (no DHT lookups)
- ✅ **Enumeration**: Can list all administrators for management UI
- ✅ **Security**: Capabilities remain private, only registry is public
- ✅ **Consistency**: Both systems stay synchronized automatically

### 2. Architecture Components

```rust
// Dual system: Capability for auth + Link for enumeration
#[hdk_extern]
pub fn grant_administrator_capability(assignee: AgentPubKey) -> ExternResult<()> {
    // 1. Create capability grant (for instant authorization)
    let cap_grant = CapGrantEntry { /* private, fast auth */ };
    create_cap_grant(cap_grant)?;

    // 2. Add to public admin registry (for enumeration)
    let admin_path = Path::from("administrators");
    create_link(admin_path.path_entry_hash()?, assignee, LinkTypes::AdminList, ())?;

    Ok(())
}

// Admin enumeration works via DHT links
#[hdk_extern]
pub fn get_all_administrators() -> ExternResult<Vec<AgentPubKey>> {
    let admin_path = Path::from("administrators");
    let links = get_links(/* query admin links */)?;
    Ok(links.into_iter().map(|link| link.target.into()).collect())
}

// Authorization uses capabilities (instant, private)
#[hdk_extern]
pub fn suspend_entity_indefinitely(entity_hash: ActionHash) -> ExternResult<Record> {
    // Holochain runtime automatically checks capability - no manual verification needed
    update_entity_status(entity_hash, StatusType::SuspendedIndefinitely)
}
```

### 3. Implementation Phases (Following GitHub Issue #45)

#### Phase 1: Introduce Capability-Based Functions

**Task 1.1: Create New Zome Functions for Granting/Revoking**

- [ ] In `dnas/requests_and_offers/zomes/coordinator/administration/src/administration.rs`:
  - [ ] `grant_administrator_capability(assignee: AgentPubKey) -> ExternResult<()>`
  - [ ] `revoke_administrator_capability(assignee: AgentPubKey) -> ExternResult<()>`
  - [ ] `get_all_administrators() -> ExternResult<Vec<AgentPubKey>>`
- [ ] **Hybrid Implementation**:
  - [ ] Create `CapGrant` entries for instant authorization
  - [ ] Create DHT links for admin enumeration (UI needs)
  - [ ] Keep both systems synchronized in grant/revoke operations
- [ ] Start with proof-of-concept granting access to `suspend_entity_indefinitely`
- [ ] Use `Assigned` `CapGrant` variant for assignee agents

**Task 1.2: Add Protection for Grant/Revoke Functions**

- [ ] Secure grant/revoke functions so only existing administrators can call them
- [ ] Initially allow DNA initializer to call it (to break circular dependency)
- [ ] Later require capability claim for the functions themselves
- [ ] Add validation to prevent unauthorized capability grants

#### Phase 2: Deprecate and Remove Anchor-Based Logic

**Task 2.1: Mark Old Functions as Deprecated**

- [ ] In `tests/src/requests_and_offers/administration/common.ts`:
  - [ ] Mark `registerNetworkAdministrator` as deprecated
  - [ ] Mark `removeAdministrator` as deprecated
  - [ ] Mark `checkIfEntityIsAdministrator` as deprecated
  - [ ] Mark `checkIfAgentIsAdministrator` as deprecated
- [ ] Add deprecation warnings to function documentation

**Task 2.2: Update Integrity Zome**

- [ ] Remove `AllAdministrators` variant from `LinkTypes` enum
- [ ] Remove `AgentAdministrators` variant from `LinkTypes` enum
- [ ] In `dnas/requests_and_offers/zomes/integrity/administration/src/lib.rs`
- [ ] Clean up any anchor-related validation logic

#### Phase 3: Update Tests

**Task 3.1: Write New Tests for Capability Functions**

- [ ] In `tests/src/requests_and_offers/administration/administration.test.ts`:
  - [ ] Test: Alice (conductor) can grant admin rights to Bob
  - [ ] Test: Bob can successfully call protected admin function
  - [ ] Test: Alice can revoke Bob's admin rights
  - [ ] Test: Bob can no longer call protected function after revocation
  - [ ] Test: Non-admin cannot grant capabilities
  - [ ] Test: Capability grants are properly scoped to specific functions

**Task 3.2: Refactor Existing Tests**

- [ ] Update all existing administration tests to use capability-based system
- [ ] Remove tests that depend on anchor-based logic
- [ ] Ensure all tests pass with new architecture
- [ ] Add integration tests for mixed old/new system during migration

#### Phase 4: Frontend Integration (Follow-up Issue)

- [ ] Update UI to call new grant/revoke functions
- [ ] Replace anchor-based admin checks in stores
- [ ] Update administration service methods
- [ ] Create simple capability management interface

## Detailed Implementation

### Backend Zome Changes

#### New Functions in `administration.rs` (Hybrid Approach)

```rust
#[hdk_extern]
pub fn grant_administrator_capability(assignee: AgentPubKey) -> ExternResult<()> {
    // Initially, allow DNA initializer to call this
    // Later, this will be protected by capability requirement

    // 1. Create capability grant for instant authorization
    let cap_grant = CapGrantEntry {
        tag: "administrator".to_string(),
        access: CapAccess::Assigned {
            secret: generate_cap_secret()?,
            assignees: BTreeSet::from([assignee.clone()]),
        },
        functions: GrantedFunctions::Listed(BTreeSet::from([
            // Start with proof-of-concept function
            (zome_info()?.name, "suspend_entity_indefinitely".to_string()),
            // Can add more admin functions here later
            (zome_info()?.name, "approve_user".to_string()),
            (zome_info()?.name, "reject_user".to_string()),
        ])),
    };
    create_cap_grant(cap_grant)?;

    // 2. Add to public admin registry for enumeration
    let admin_path = Path::from("administrators");
    create_link(
        admin_path.path_entry_hash()?,
        assignee,
        LinkTypes::AdministratorsList,
        ()
    )?;

    Ok(())
}

#[hdk_extern]
pub fn revoke_administrator_capability(assignee: AgentPubKey) -> ExternResult<()> {
    // 1. Find and delete the capability grant
    let grants = query(
        ChainQueryFilter::new()
            .entry_type(EntryType::CapGrant)
            .include_entries(true),
    )?;

    for record in grants {
        if let Some(entry) = record.entry().as_option() {
            if let Ok(cap_grant) = entry.clone().try_into() {
                let cap_grant: CapGrantEntry = cap_grant;
                if let CapAccess::Assigned { assignees, .. } = &cap_grant.access {
                    if assignees.contains(&assignee) {
                        delete_cap_grant(record.action_address().clone())?;
                        break;
                    }
                }
            }
        }
    }

    // 2. Remove from public admin registry
    let admin_path = Path::from("administrators");
    let links = get_links(
        GetLinksInputBuilder::try_new(
            admin_path.path_entry_hash()?,
            LinkTypes::AdministratorsList
        )?.build()
    )?;

    for link in links {
        if AgentPubKey::try_from(link.target).unwrap() == assignee {
            delete_link(link.create_link_hash)?;
            break;
        }
    }

    Ok(())
}

#[hdk_extern]
pub fn get_all_administrators() -> ExternResult<Vec<AgentPubKey>> {
    let admin_path = Path::from("administrators");
    let links = get_links(
        GetLinksInputBuilder::try_new(
            admin_path.path_entry_hash()?,
            LinkTypes::AdministratorsList
        )?.build()
    )?;

    let admins: Vec<AgentPubKey> = links
        .into_iter()
        .map(|link| AgentPubKey::try_from(link.target).unwrap())
        .collect();

    Ok(admins)
}

// Example of capability-protected function
#[hdk_extern]
pub fn suspend_entity_indefinitely(entity_hash: ActionHash) -> ExternResult<Record> {
    // This function is automatically protected by the capability system
    // Only agents with the appropriate capability grant can call it
    update_entity_status(entity_hash, StatusType::SuspendedIndefinitely)
}

// Existing functions can be gradually updated to require capabilities
#[hdk_extern]
pub fn approve_user(input: ApproveUserInput) -> ExternResult<Record> {
    // For now, keep existing logic while we transition
    // Later, add capability requirement
    update_user_status(input.user_hash, StatusType::Accepted)
}
```

#### Helper Functions

```rust
fn generate_cap_secret() -> ExternResult<CapSecret> {
    // Generate a random capability secret
    let random_bytes = random_bytes(32)?;
    Ok(CapSecret::from(random_bytes.to_vec()))
}

fn update_entity_status(entity_hash: ActionHash, status: StatusType) -> ExternResult<Record> {
    // Implementation for updating entity status
    // This would contain the actual business logic
    todo!("Implement status update logic")
}
```

### Frontend Service Layer

#### Updated `administration.service.ts` (Simplified)

```typescript
export interface AdministrationService {
  // Simple capability management (following issue #45)
  readonly grantAdministratorCapability: (
    assignee: AgentPubKey,
  ) => E.Effect<boolean, AdministrationError, never>;

  readonly revokeAdministratorCapability: (
    assignee: AgentPubKey,
  ) => E.Effect<boolean, AdministrationError, never>;

  // NEW: Admin enumeration for UI
  readonly getAllAdministrators: () => E.Effect<
    AgentPubKey[],
    AdministrationError,
    never
  >;

  // Keep existing admin functions - they'll be gradually protected by capabilities
  readonly approveUser: (
    input: ApproveUserInput,
  ) => E.Effect<Record, AdministrationError, never>;

  readonly rejectUser: (
    input: RejectUserInput,
  ) => E.Effect<Record, AdministrationError, never>;

  readonly suspendUser: (
    input: SuspendUserInput,
  ) => E.Effect<Record, AdministrationError, never>;

  // New capability-protected function
  readonly suspendEntityIndefinitely: (
    entityHash: ActionHash,
  ) => E.Effect<Record, AdministrationError, never>;
}

const AdministrationServiceLive = Layer.effect(
  AdministrationServiceTag,
  E.gen(function* () {
    const hcService = yield* HolochainClientServiceTag;

    const grantAdministratorCapability = (
      assignee: AgentPubKey,
    ): E.Effect<boolean, AdministrationError, never> =>
      pipe(
        hcService.callZomeEffect(
          "administration",
          "grant_administrator_capability",
          assignee,
          BooleanResponseSchema,
        ),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.GRANT_CAPABILITY,
          ),
        ),
      );

    const revokeAdministratorCapability = (
      assignee: AgentPubKey,
    ): E.Effect<boolean, AdministrationError, never> =>
      pipe(
        hcService.callZomeEffect(
          "administration",
          "revoke_administrator_capability",
          assignee,
          BooleanResponseSchema,
        ),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.REVOKE_CAPABILITY,
          ),
        ),
      );

    const getAllAdministrators = (): E.Effect<
      AgentPubKey[],
      AdministrationError,
      never
    > =>
      pipe(
        hcService.callZomeRawEffect(
          "administration",
          "get_all_administrators",
          null,
        ),
        E.map((result) => result as AgentPubKey[]),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.GET_ALL_ADMINISTRATORS,
          ),
        ),
      );

    // Existing functions remain the same during transition
    const approveUser = (
      input: ApproveUserInput,
    ): E.Effect<Record, AdministrationError, never> =>
      pipe(
        hcService.callZomeRawEffect("administration", "approve_user", input),
        E.map((result) => result as Record),
        E.mapError((error) =>
          AdministrationError.fromError(
            error,
            ADMINISTRATION_CONTEXTS.APPROVE_USER,
          ),
        ),
      );

    return AdministrationServiceTag.of({
      grantAdministratorCapability,
      revokeAdministratorCapability,
      getAllAdministrators,
      approveUser,
      suspendEntityIndefinitely,
      // ... other methods
    });
  }),
);
```

### Frontend Store Updates

#### Simplified `administration.store.svelte.ts` (Transition Approach)

```typescript
export type AdministrationStore = {
  // Keep existing state during transition
  readonly allUsers: UIUser[];
  readonly allOrganizations: UIOrganization[];
  readonly administrators: UIUser[];
  readonly agentIsAdministrator: boolean;
  readonly loading: boolean;
  readonly error: string | null;

  // Add simple capability management
  grantAdministratorCapability: (
    assignee: AgentPubKey,
  ) => E.Effect<boolean, AdministrationError>;

  revokeAdministratorCapability: (
    assignee: AgentPubKey,
  ) => E.Effect<boolean, AdministrationError>;

  // NEW: Admin enumeration for UI
  getAllAdministrators: () => E.Effect<UIUser[], AdministrationError>;

  // Keep existing functions during transition
  checkIfAgentIsAdministrator: () => E.Effect<boolean, AdministrationError>;
  approveUser: (user: UIUser) => E.Effect<HolochainRecord, AdministrationError>;
  rejectUser: (user: UIUser) => E.Effect<HolochainRecord, AdministrationError>;
  suspendUser: (
    user: UIUser,
    reason?: string,
    suspendedUntil?: string,
  ) => E.Effect<HolochainRecord, AdministrationError>;

  // New capability-protected function
  suspendEntityIndefinitely: (
    entityHash: ActionHash,
  ) => E.Effect<HolochainRecord, AdministrationError>;
};

const createAdministrationStore = (): E.Effect<AdministrationStore> =>
  E.gen(function* () {
    const administrationService = yield* AdministrationServiceTag;

    // Keep existing state variables
    const allUsers: UIUser[] = $state([]);
    const administrators: UIUser[] = $state([]);
    let agentIsAdministrator: boolean = $state(false);
    let loading: boolean = $state(false);
    let error: string | null = $state(null);

    // Add new capability management methods
    const grantAdministratorCapability = (
      assignee: AgentPubKey,
    ): E.Effect<boolean, AdministrationError> =>
      withLoadingState(() =>
        pipe(
          administrationService.grantAdministratorCapability(assignee),
          E.tap((success) => {
            if (success) {
              // Refresh admin list to include new admin
              E.runFork(getAllNetworkAdministrators());
            }
          }),
        ),
      )(setLoading, setError);

    const revokeAdministratorCapability = (
      assignee: AgentPubKey,
    ): E.Effect<boolean, AdministrationError> =>
      withLoadingState(() =>
        pipe(
          administrationService.revokeAdministratorCapability(assignee),
          E.tap((success) => {
            if (success) {
              // Refresh admin list to remove revoked admin
              E.runFork(getAllNetworkAdministrators());
            }
          }),
        ),
      )(setLoading, setError);

    const getAllAdministrators = (): E.Effect<UIUser[], AdministrationError> =>
      withLoadingState(() =>
        pipe(
          administrationService.getAllAdministrators(),
          E.flatMap((adminPubKeys) =>
            E.all(
              adminPubKeys.map((pubKey) =>
                usersStore.getUserByAgentPubKey(pubKey),
              ),
            ),
          ),
          E.map((users) => users.filter((u): u is UIUser => u !== null)),
          E.tap((admins) => {
            administrators.splice(0, administrators.length, ...admins);
          }),
        ),
      )(setLoading, setError);

    // Keep existing methods during transition period
    const checkIfAgentIsAdministrator = (): E.Effect<
      boolean,
      AdministrationError
    > =>
      // Keep current anchor-based logic for now
      // Will be replaced with capability checking later
      withLoadingState(() =>
        pipe(
          holochainClientService.getClientEffect(),
          E.flatMap((client) =>
            client
              ? E.succeed(client.myPubKey)
              : E.fail(new Error("Client not connected")),
          ),
          E.flatMap((agentPubKey) =>
            administrationService.checkIfAgentIsAdministrator({
              entity: AdministrationEntity.Network,
              agent_pubkey: agentPubKey,
            }),
          ),
          E.tap((isAdmin) => {
            agentIsAdministrator = isAdmin;
          }),
        ),
      )(setLoading, setError);

    return {
      get allUsers() {
        return allUsers;
      },
      get administrators() {
        return administrators;
      },
      get agentIsAdministrator() {
        return agentIsAdministrator;
      },
      get loading() {
        return loading;
      },
      get error() {
        return error;
      },

      grantAdministratorCapability,
      revokeAdministratorCapability,
      getAllAdministrators,
      checkIfAgentIsAdministrator,
      approveUser,
      suspendEntityIndefinitely,
      // ... other existing methods
    };
  });
```

### UI Components (Simplified Approach)

#### Simple Admin Management Interface

```svelte
<!-- AdminCapabilityManager.svelte (Simplified) -->
<script lang="ts">
import { administrationStore } from '$lib/stores/administration.store.svelte';
import { runEffect } from '$lib/utils/effect';
import type { AgentPubKey } from '@holochain/client';

let assigneeAgent: string = '';
let showGrantForm: boolean = false;
let showRevokeForm: boolean = false;

const grantAdministratorCapability = async () => {
  if (!assigneeAgent.trim()) return;

  try {
    const pubKey = new Uint8Array(Buffer.from(assigneeAgent, 'hex'));
    const result = await runEffect(
      administrationStore.grantAdministratorCapability(pubKey as AgentPubKey)
    );

    if (result._tag === 'Right') {
      showNotification('Administrator capability granted successfully!', 'success');
      assigneeAgent = '';
      showGrantForm = false;
    } else {
      showNotification('Failed to grant capability: ' + result.left, 'error');
    }
  } catch (error) {
    showNotification('Invalid agent public key format', 'error');
  }
};

const revokeAdministratorCapability = async () => {
  if (!assigneeAgent.trim()) return;

  try {
    const pubKey = new Uint8Array(Buffer.from(assigneeAgent, 'hex'));
    const result = await runEffect(
      administrationStore.revokeAdministratorCapability(pubKey as AgentPubKey)
    );

    if (result._tag === 'Right') {
      showNotification('Administrator capability revoked successfully!', 'success');
      assigneeAgent = '';
      showRevokeForm = false;
    } else {
      showNotification('Failed to revoke capability: ' + result.left, 'error');
    }
  } catch (error) {
    showNotification('Invalid agent public key format', 'error');
  }
};
</script>

<div class="admin-capability-manager">
  <h3>Administrator Capability Management</h3>

  <div class="actions">
    <button
      class="btn variant-filled-primary"
      on:click={() => showGrantForm = !showGrantForm}>
      Grant Administrator Capability
    </button>

    <button
      class="btn variant-filled-warning"
      on:click={() => showRevokeForm = !showRevokeForm}>
      Revoke Administrator Capability
    </button>
  </div>

  {#if showGrantForm}
    <div class="form-section">
      <h4>Grant Administrator Capability</h4>
      <label>Agent Public Key (hex):</label>
      <input
        type="text"
        bind:value={assigneeAgent}
        placeholder="Enter agent public key in hex format"
        class="input">
      <button
        class="btn variant-filled-primary"
        on:click={grantAdministratorCapability}
        disabled={!assigneeAgent.trim()}>
        Grant Capability
      </button>
      <button
        class="btn variant-soft"
        on:click={() => showGrantForm = false}>
        Cancel
      </button>
    </div>
  {/if}

  {#if showRevokeForm}
    <div class="form-section">
      <h4>Revoke Administrator Capability</h4>
      <label>Agent Public Key (hex):</label>
      <input
        type="text"
        bind:value={assigneeAgent}
        placeholder="Enter agent public key in hex format"
        class="input">
      <button
        class="btn variant-filled-warning"
        on:click={revokeAdministratorCapability}
        disabled={!assigneeAgent.trim()}>
        Revoke Capability
      </button>
      <button
        class="btn variant-soft"
        on:click={() => showRevokeForm = false}>
        Cancel
      </button>
    </div>
  {/if}

  <div class="info-section">
    <h4>About Capability-Based Administration</h4>
    <p>
      This system uses Holochain's native capability grants for secure, performant administrator access control.
      Capabilities are automatically managed by the Holochain runtime and provide instant authorization checks.
    </p>
    <ul>
      <li>✅ Instant authorization (no DHT lookups)</li>
      <li>✅ Immediate revocation capability</li>
      <li>✅ Function-specific permissions</li>
      <li>✅ Enhanced privacy (grants not public)</li>
    </ul>
  </div>
</div>

<style>
  .admin-capability-manager {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-section {
    background: var(--color-surface-200);
    padding: 1.5rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }

  .form-section h4 {
    margin-bottom: 1rem;
  }

  .form-section label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .input {
    width: 100%;
    margin-bottom: 1rem;
    padding: 0.5rem;
    border: 1px solid var(--color-surface-400);
    border-radius: 0.25rem;
  }

  .info-section {
    background: var(--color-surface-100);
    padding: 1.5rem;
    border-radius: 0.5rem;
    margin-top: 2rem;
  }

  .info-section ul {
    margin-top: 1rem;
  }

  .info-section li {
    margin-bottom: 0.5rem;
  }
</style>
```

## Migration Timeline (Aligned with Issue #45)

### Week 1-2: Phase 1 - Introduce Capability Functions

- [ ] **Task 1.1**: Create new zome functions
  - [ ] Implement `grant_administrator_capability(assignee: AgentPubKey)`
  - [ ] Implement `revoke_administrator_capability(assignee: AgentPubKey)`
  - [ ] Start with proof-of-concept granting access to `suspend_entity_indefinitely`
- [ ] **Task 1.2**: Add protection for grant/revoke functions
  - [ ] Allow DNA initializer to call functions initially
  - [ ] Add validation to prevent unauthorized grants

### Week 3: Phase 2 - Deprecate Anchor-Based Logic

- [ ] **Task 2.1**: Mark old functions as deprecated
  - [ ] Update `tests/src/requests_and_offers/administration/common.ts`
  - [ ] Add deprecation warnings to function documentation
- [ ] **Task 2.2**: Update integrity zome
  - [ ] Remove `AllAdministrators` and `AgentAdministrators` from `LinkTypes`
  - [ ] Clean up anchor-related validation logic

### Week 4: Phase 3 - Update Tests

- [ ] **Task 3.1**: Write new capability tests
  - [ ] Test: Alice can grant admin rights to Bob
  - [ ] Test: Bob can call protected function
  - [ ] Test: Alice can revoke Bob's rights
  - [ ] Test: Bob cannot call function after revocation
  - [ ] Test: Non-admin cannot grant capabilities
- [ ] **Task 3.2**: Refactor existing tests
  - [ ] Update all administration tests for capability system
  - [ ] Ensure all tests pass with new architecture

### Week 5: Phase 4 - Frontend Integration (Follow-up)

- [ ] Update administration service with new methods
- [ ] Add capability management to administration store
- [ ] Create simple capability management UI
- [ ] Replace anchor-based admin checks where appropriate

### Week 6: Validation and Documentation

- [ ] Comprehensive testing of capability flows
- [ ] Performance benchmarking (compare to anchor system)
- [ ] Update documentation and acceptance criteria
- [ ] Prepare for deployment and monitoring

## Risk Mitigation

### Technical Risks

- **Capability Loss**: Implement backup admin capabilities and recovery procedures
- **Performance Impact**: Benchmark capability verification vs anchor lookups
- **Complexity**: Provide clear documentation and training materials

### Security Risks

- **Secret Leakage**: Implement capability rotation and revocation procedures
- **Privilege Escalation**: Audit all capability grant scenarios
- **Denial of Service**: Rate limit capability grant/revoke operations

### Operational Risks

- **Admin Lockout**: Maintain emergency access procedures
- **Migration Failure**: Implement rollback procedures to anchor system
- **User Confusion**: Provide clear migration communication and training

## Acceptance Criteria (From Issue #45)

- [ ] All administration functions are secured by capability grants
- [ ] The old anchor-based role system is completely removed from the codebase
- [ ] All administration tests are passing and reflect the new capability-based architecture
- [ ] The UI is updated to call the new grant/revoke functions (follow-up issue)

## Success Metrics

### Performance Improvements

- [ ] Instant admin verification (no DHT lookups)
- [ ] 100% reduction in DHT network calls for authorization
- [ ] Sub-10ms response time for admin authorization checks

### Security Enhancements

- [ ] Instant revocation capability implemented
- [ ] Function-specific permission granularity
- [ ] Private capability grants (not publicly readable)
- [ ] Zero unauthorized admin access incidents

### Operational Excellence

- [ ] Smooth migration from anchor-based to capability-based system
- [ ] All existing admin functionality preserved during transition
- [ ] Complete test coverage for capability system
- [ ] Clear documentation for capability management

## Post-Migration Monitoring

### Continuous Monitoring

- [ ] Capability usage analytics
- [ ] Performance metrics tracking
- [ ] Security incident monitoring
- [ ] User satisfaction surveys

### Maintenance Tasks

- [ ] Regular capability rotation (monthly)
- [ ] Security audit reviews (quarterly)
- [ ] Performance optimization reviews
- [ ] Documentation updates and training

## Conclusion

This migration from anchor-based to capability-based administration will significantly improve the security, performance, and maintainability of the Requests and Offers platform. The phased approach ensures minimal disruption while delivering substantial benefits to both administrators and end users.
