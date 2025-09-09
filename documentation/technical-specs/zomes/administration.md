# Administration Zome Specification

## Overview

The Administration Zome manages system-wide administrative functions, including user verification, status management, and administrative access control. It consists of two parts:

1. Integrity Zome: Defines entry and link types, validation rules
2. Coordinator Zome: Implements business logic and external functions

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

##### `register_administrator`

```rust
pub fn register_administrator(input: EntityActionHashAgents) -> ExternResult<bool>
```

- Creates initial administrator entry
- Verifies no existing administrator
- Creates administrator links for entity and agents
- Returns success boolean

##### `add_administrator`

```rust
pub fn add_administrator(input: EntityActionHashAgents) -> ExternResult<bool>
```

- Requires existing administrator privileges
- Calls register_administrator
- Returns success boolean

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

## Usage Examples

### Administrator Management

```rust
// Register first administrator
let input = EntityActionHashAgents {
    entity: "users".to_string(),
    entity_original_action_hash: hash,
    agent_pubkeys: vec![agent_key],
};
register_administrator(input)?;

// Add new administrator
if check_if_entity_is_administrator(entity_hash)? {
    add_administrator(new_admin_input)?;
}
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
