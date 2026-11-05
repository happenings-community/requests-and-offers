# Administration Zome Specification

## Overview

The Administration Zome manages system-wide administrative functions, including user verification, status management, and administrative access control. It consists of two parts:

1. Integrity Zome: Defines entry and link types, validation rules
2. Coordinator Zome: Implements business logic and external functions

## Progenitor Pattern

The first agent to call `create_user` after installing the DNA is the **network progenitor**. Their public key is embedded in the DNA properties at install time via `progenitor_pubkey`. When the progenitor creates their user profile, they are automatically registered as the first network administrator — no explicit administrator registration call is required.

Key properties:
- The progenitor pubkey is fixed at DNA install time (in `workdir/happ.yaml` and at test setup via `rolesSettings`).
- Auto-registration happens inside `create_user` via a cross-zome call to `add_administrator` in the `administration` coordinator.
- In **production** (progenitor key configured): ONLY the progenitor is auto-registered. Any user who creates a profile before the progenitor receives standard pending status — they are NOT made admin.
- In **dev mode** (no `progenitor_pubkey` set): the first user to call `create_user` becomes admin automatically as a convenience bootstrap.
- The progenitor still receives "pending" status like any other user after `create_user`.
- The progenitor is **revocable** — they can be removed from the administrator list by any other administrator.

### Progenitor Externs

One public function is available in the `administration` coordinator for checking progenitor status:

```rust
// Check if the current calling agent is the network progenitor
pub fn is_progenitor(_: ()) -> ExternResult<bool>
```

> **Note:** `check_if_agent_is_progenitor(agent: AgentPubKey)` was removed in favour of
> `is_progenitor()`. Callers that previously checked another agent's progenitor status
> should use `is_progenitor` from the target agent's own conductor context.

### Administrator Registration

The first administrator is registered automatically when the progenitor calls `create_user` (production mode). In dev mode (no progenitor key configured), the first user to call `create_user` is registered instead. Subsequent administrators are added explicitly via `add_administrator` (which requires an existing administrator or the progenitor to call it).

## Technical Implementation

### 1. Entry Types

#### Status Entry

```rust
pub struct Status {
    pub status_type: String,
    pub reason: Option<String>,
    pub suspended_until: Option<String>,
}
```

Status types are defined through an enumeration:

```rust
pub enum StatusType {
    Pending,
    Accepted,
    Rejected,
    SuspendedIndefinitely,
    SuspendedTemporarily,
}
```

### 2. Link Types

```rust
pub enum LinkTypes {
    AllAdministrators,     // Links administrators to entities
    AgentAdministrators,   // Links agents to administrator roles
    StatusUpdates,         // Links status updates
    AllStatuses,          // Global status index
    EntityStatus,         // Links entities to their status
    AcceptedEntity,       // Links accepted entities
}
```

### 3. Administrator Management

#### Core Functions

##### `add_administrator`

```rust
pub fn add_administrator(input: EntityActionHashAgents) -> ExternResult<bool>
```

The sole public extern for administrator registration. Callers must be either an existing administrator **or** the network progenitor. It writes the new administrator's admin grant (see *The chain of grants* below) and the two roster links, and is idempotent (returns `false` without error if the entity is already an administrator).

- Requires caller to be the progenitor or an existing administrator
- Idempotent: safe to call when already an administrator
- Returns `true` when a new admin link was created, `false` when already admin

##### `remove_administrator`

```rust
pub fn remove_administrator(input: EntityActionHashAgents) -> ExternResult<bool>
```

- Verifies caller is administrator
- Ensures at least one administrator remains
- Removes administrator links
- Returns success boolean

#### Query Functions

##### `get_all_administrators_links`

```rust
pub fn get_all_administrators_links(entity: String) -> ExternResult<Vec<Link>>
```

- Retrieves all administrator links for entity
- Returns vector of links

##### `check_if_entity_is_administrator`

```rust
pub fn check_if_entity_is_administrator(input: EntityActionHash) -> ExternResult<bool>
```

- Verifies if entity is administrator
- Checks administrator links
- Returns boolean status

##### `check_if_agent_is_administrator`

```rust
pub fn check_if_agent_is_administrator(input: EntityAgent) -> ExternResult<bool>
```

- Verifies if agent is administrator
- Checks agent administrator links
- Returns boolean status

### 4. Status Management

#### Core Functions

##### `create_status`

```rust
pub fn create_status(input: EntityActionHash) -> ExternResult<Record>
```

- Creates pending status for entity
- Verifies no existing status
- Creates status links
- Returns status record

##### `update_entity_status`

```rust
pub fn update_entity_status(input: UpdateEntityActionHash) -> ExternResult<Record>
```

- Updates entity's status
- Creates status update links
- Handles accepted status links
- Returns updated record

#### Status Query Functions

##### `get_entity_status_link`

```rust
pub fn get_entity_status_link(input: EntityActionHash) -> ExternResult<Link>
```

- Retrieves status link for entity
- Returns link or error

##### `get_latest_status_record`

```rust
pub fn get_latest_status_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

- Gets most recent status record
- Returns optional record

##### `get_latest_status`

```rust
pub fn get_latest_status(original_action_hash: ActionHash) -> ExternResult<Option<Status>>
```

- Gets most recent status entry
- Returns optional status

##### `get_latest_status_record_for_entity`

```rust
pub fn get_latest_status_record_for_entity(input: EntityActionHash) -> ExternResult<Option<Record>>
```

- Gets entity's latest status record
- Returns optional record

##### `get_latest_status_for_entity`

```rust
pub fn get_latest_status_for_entity(input: EntityActionHash) -> ExternResult<Option<Status>>
```

- Gets entity's latest status entry
- Returns optional status

#### Status Management Functions

##### `suspend_entity_temporarily`

```rust
pub fn suspend_entity_temporarily(input: SuspendEntityInput) -> ExternResult<bool>
```

- Temporarily suspends entity
- Sets suspension duration
- Returns success boolean

##### `suspend_entity_indefinitely`

```rust
pub fn suspend_entity_indefinitely(input: SuspendEntityInput) -> ExternResult<bool>
```

- Indefinitely suspends entity
- Returns success boolean

##### `unsuspend_entity_if_time_passed`

```rust
pub fn unsuspend_entity_if_time_passed(input: UpdateInput) -> ExternResult<bool>
```

- Checks suspension duration
- Auto-unsuspends if time passed
- Returns success boolean

##### `unsuspend_entity`

```rust
pub fn unsuspend_entity(input: UpdateInput) -> ExternResult<bool>
```

- Manually unsuspends entity
- Returns success boolean

#### Accepted Entity Management

##### `create_accepted_entity_link`

```rust
pub fn create_accepted_entity_link(input: EntityActionHash) -> ExternResult<bool>
```

- Creates link for accepted entity
- Returns success boolean

##### `delete_accepted_entity_link`

```rust
pub fn delete_accepted_entity_link(input: EntityActionHash) -> ExternResult<bool>
```

- Removes accepted entity link
- Returns success boolean

##### `get_accepted_entities`

```rust
pub fn get_accepted_entities(entity: String) -> ExternResult<Vec<Link>>
```

- Retrieves all accepted entities
- Returns vector of links

##### `check_if_entity_is_accepted`

```rust
pub fn check_if_entity_is_accepted(input: EntityActionHash) -> ExternResult<bool>
```

- Verifies if entity is accepted
- Returns boolean status

### 5. Access Control

- Administrator functions require administrator privileges
- Status management restricted to administrators
- Status queries available to all users
- Entity acceptance management restricted to administrators

## The chain of grants

Every act of authority on the network is a **role act**: a record that names the grant its author holds for it, written only by that holder. The grants form a chain that validation walks one step up with `must_get_valid_record`, so every peer reaches the same verdict.

### Entries

- **`RoleGrant`** `{ role, holder, scope, authority }`. `role` is `admin`, `member`, `coordinator` (scoped to an organisation) or `steward` (only on a network with the stewarding module). `authority` is either `Progenitor { signature }` — the progenitor key's signature over the grant's body, admitted for `admin` only — or `Grant(hash)`: a grant above it whose holder wrote this one and whose role may grant this role in this scope (`utils::grants::may_grant`).
- **`RoleRevocation`** `{ grant, authority, reason }`: withdraws a grant. Written by the holder of a grant that could have given the role. The grant stands as a record; `can` treats it as withdrawn.

Grants and revocations are records: never updated, never deleted. The only way to end a grant is a revocation.

### Index links

| Link | From → to | Rule |
|---|---|---|
| `AgentGrants` | holder's key → grant | written by the granter; tag carries the grant's hash |
| `AllGrants` | `grants.{role}` path → grant | written by the granter; tag carries the grant's hash |
| `GrantRevocations` | grant → revocation | written by the revoker |

These three are what `can` reads, and **none of them is ever tombstoned**: a tombstone on a holder's index would hide their grant from every reader, and one on a revocation link would bring a revoked grant back. No coordinator tombstones them. (The administrator roster links `AllAdministrators` / `AgentAdministrators` are tombstoned by `remove_administrator`; who may write that tombstone is still open, and `can` does not read them.)

### Reading authority

`can(agent, ability, scope)` returns the agent's live grant that covers the ability, or none: it reads the holder's `AgentGrants` index, drops any grant with a `GrantRevocations` link, and checks `grant_covers`. Coordinators call `require_grant` before a write and put the grant on the record; integrity checks the record with `check_act`, which reloads the grant and confirms its holder is the author and its role covers the ability. Revocation is checked on the read side only: a record written while a grant was live stays valid after the grant is revoked.

### The root

With a `progenitor_pubkey` in the DNA properties, a root (`Authority::Progenitor`) grant is accepted only when its author **is** the progenitor and the signature verifies against the progenitor key — both, because the signature covers only the body, and a signed body written again by someone else would be a second grant that no revocation names. With no key configured (development, Sweettest, and the alpha 2 release, whose manifest carries `null`), the root is accepted from any author: a network without a key is a different network from one with it, since the properties are part of the DNA hash. On such a network the chain of grants records who did what; it does not stop a modified client from writing itself a root.

## Integrity Validation

The integrity zome's `validate` callback dispatches every `FlatOp` for the zome's entries and links. Authorisation is checked **in validation**, not only in the coordinator: a status past `pending`, a grant, a revocation and each roster link carry the grant they rest on, and `check_act` walks it with `must_get_valid_record`.

### Design note: HDI vs HDK

Integrity zomes use `hdi::prelude::*`, which exposes `must_get_*` but not `get_links`. That is why authority is carried **on the record** as a grant hash rather than looked up: validation can `must_get_valid_record` a hash it is given, deterministically on every peer, but cannot ask "is this agent an administrator right now?". The coordinator still checks `require_grant` first, so an honest client gets a clear refusal before writing; the validator is what a modified client meets.

### What the integrity zome validates

| Operation | Integrity guarantee |
|-----------|---------------------|
| Create `Status` past `pending`, or update any `Status` | carries a grant covering `ChangeStatus`, held by the author |
| Delete `Status` | refused |
| Create `RoleGrant` | role available on this network; scope fits the role; authority is a valid root or a grant above it held by the author that may grant this role |
| Create `RoleRevocation` | names a grant held by the author that may grant the revoked role |
| Update or delete `RoleGrant` / `RoleRevocation` | refused |
| Create `AgentGrants` / `AllGrants` | written by the granter, from the right base, tag names the grant |
| Create `GrantRevocations` | written by the revoker |
| Delete `AgentGrants` / `AllGrants` / `GrantRevocations` | refused |
| Create `AllAdministrators` / `AgentAdministrators` | tag carries an admin grant held by the link's author |
| Create `EntityStatus` | written by the author of the status it points at |
| Create `AcceptedEntity` | tag carries a `ChangeStatus` grant (admin or steward) held by the author |
| Create `StatusUpdates` | both ends are statuses (the chain rule is on #400's list) |

Forged-client coverage of these rules lives in `tests/sweettest/tests/grants.rs`, where one conductor carries the `forge` zome and writes past the coordinator.

### Status Entry Validation

`validate_status` enforces that:
- Status type must be one of the defined `StatusType` variants.
- Suspended statuses must include a reason.
- Temporarily suspended statuses must include a `suspended_until` timestamp; indefinitely suspended ones must not.
- Any status other than the author's own initial `pending`, and every update, carries a `ChangeStatus` grant held by its author.

## Usage Examples

### Administrator Management

```rust
// Register first administrator (progenitor auto-registration via create_user)
// or add a new administrator (requires caller to be admin or progenitor)
let input = EntityActionHashAgents {
    entity: "network".to_string(),
    entity_original_action_hash: hash,
    agent_pubkeys: vec![agent_key],
};
add_administrator(input)?; // idempotent — safe to call even if already admin
```

### Status Management

```rust
// Create entity status
let status = create_status(entity_hash)?;

// Suspend temporarily
let suspend_input = SuspendEntityInput {
    entity,
    entity_original_action_hash: hash,
    status_original_action_hash: status_hash,
    status_previous_action_hash: prev_hash,
    reason: "Violation".to_string(),
    duration: Some(Duration::days(7)),
};
suspend_entity_temporarily(suspend_input)?;

// Check and unsuspend
unsuspend_entity_if_time_passed(update_input)?;
```
