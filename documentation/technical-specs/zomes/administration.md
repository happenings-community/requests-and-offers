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
- The progenitor still receives "pending" status like any other user after `create_user`.
- The progenitor is **revocable** — they can be removed from the administrator list by any other administrator.

### Progenitor Externs

Two new public functions are available in the `administration` coordinator:

```rust
// Check if a specific agent is the network progenitor
pub fn check_if_agent_is_progenitor(agent: AgentPubKey) -> ExternResult<bool>

// Check if the current calling agent is the network progenitor
pub fn is_progenitor(_: ()) -> ExternResult<bool>
```

### Administrator Registration

The first administrator is registered automatically when the progenitor calls `create_user`. Subsequent administrators are added explicitly via `add_administrator` (which requires an existing administrator to call it).

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

The sole public extern for administrator registration. Callers must be either an existing administrator **or** the network progenitor. Internally calls the private `register_administrator` helper, which is idempotent (returns `false` without error if the entity is already an administrator).

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

## Integrity Validation

The integrity zome adds a `validate` callback that dispatches `FlatOp` variants for `AllAdministrators` and `AgentAdministrators` link types. Its primary guarantee is the **progenitor bootstrap**: only the network progenitor can write the very first admin links without any pre-existing authority.

### Design note: HDI vs HDK

Integrity zomes use `hdi::prelude::*`. The HDI crate does **not** expose `get_links`, `LinkQuery`, or `GetStrategy` — only `must_get_*` variants (which require a known action hash). Dynamic "is this agent currently an administrator?" checks therefore cannot be performed inside integrity validation. That authorization is enforced by the coordinator layer (`check_if_agent_is_administrator` / `check_if_entity_is_administrator`) on every mutating call.

### What the integrity zome validates

| Operation | Integrity guarantee |
|-----------|---------------------|
| Create `AllAdministrators` link by the progenitor | Cryptographically verified (deterministic DNA property comparison) |
| Create `AllAdministrators` link by any other agent | Default-allow; coordinator enforces admin-membership check |
| Delete `AllAdministrators` link | Default-allow; coordinator enforces admin-membership check |
| Create `AgentAdministrators` link by the progenitor | Cryptographically verified |
| Create `AgentAdministrators` link by any other agent | Default-allow; coordinator enforces admin-membership check |
| Delete `AgentAdministrators` link | Default-allow; coordinator enforces admin-membership check |

### Validation Helper

One private helper is used inside the `validate` callback:

```rust
// Deterministic: compares agent to the DNA progenitor_pubkey property
fn is_progenitor(agent: &AgentPubKey) -> ExternResult<bool>
```

The `validate` extern uses `op.flattened::<EntryTypes, LinkTypes>()` to dispatch each `FlatOp` variant to the appropriate validation function. All unrecognised ops return `ValidateCallbackResult::Valid` (default-allow pattern).

### Status Entry Validation

The existing `validate_status` function continues to enforce that:
- Status type must be one of the defined `StatusType` variants.
- Suspended statuses must include a reason.
- Temporarily suspended statuses must include a `suspended_until` timestamp.

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
