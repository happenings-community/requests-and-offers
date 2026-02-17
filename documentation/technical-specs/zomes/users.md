# Users Organizations Zome Specification

## Overview

The Users Organizations Zome manages user profiles, agent relationships, and profile status within the system. It consists of two parts:

1. Integrity Zome: Defines entry and link types, validation rules
2. Coordinator Zome: Implements business logic and external functions

## Technical Implementation

### 1. Entry Types

#### User Entry

```rust
#[hdk_entry_helper]
pub struct User {
    /// The full name of the user
    pub name: String,

    /// Display name for the user
    pub nickname: String,

    /// User's biographical information (supports markdown, rendered on frontend with `marked` + `DOMPurify`)
    pub bio: String,

    /// Optional profile picture (serialized)
    pub picture: Option<SerializedBytes>,

    /// User type: 'advocate' or 'creator'
    pub user_type: String,

    /// User's skills
    pub skills: Vec<String>,

    /// Contact information
    pub email: String,
    pub phone: Option<String>,

    /// Location details
    pub time_zone: String,
    pub location: String,
}
```

### 2. Link Types

```rust
pub enum LinkTypes {
    UserUpdates,    // Links user profile updates
    AllUsers,       // Global user index
    MyUser,         // Agent to user profile link
    UserStatus,     // User to status link
    UserAgents,     // User to agent link
}
```

### 3. Profile Management

#### Core Functions

##### `create_user`

```rust
pub fn create_user(user: User) -> ExternResult<Record>
```

- Creates new user profile
- Verifies no existing profile for agent
- Creates necessary links:
  - AllUsers link for global index
  - MyUser link from agent to profile
  - UserAgents link from profile to agent
  - UserStatus link to initial status
- Returns created profile record

##### `update_user`

```rust
pub fn update_user(input: UpdateUserInput) -> ExternResult<Record>
```

- Updates existing user profile
- Verifies update permissions
- Creates update links
- Returns updated profile record

#### Profile Retrieval

##### `get_latest_user_record`

```rust
pub fn get_latest_user_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

- Retrieves most recent profile record
- Follows update links
- Returns optional record

##### `get_latest_user`

```rust
pub fn get_latest_user(original_action_hash: ActionHash) -> ExternResult<User>
```

- Retrieves most recent profile entry
- Returns user data or error

##### `get_agent_user`

```rust
pub fn get_agent_user(author: AgentPubKey) -> ExternResult<Vec<Link>>
```

- Retrieves user profile links for agent
- Returns vector of MyUser links

##### `get_user_agents`

```rust
pub fn get_user_agents(user_original_action_hash: ActionHash) -> ExternResult<Vec<AgentPubKey>>
```

- Retrieves agents associated with profile
- Returns vector of agent public keys

### 4. Validation Rules

#### Profile Validation

```rust
pub fn validate_user(user: User) -> ExternResult<ValidateCallbackResult>
```

- Validates user type ('advocate' or 'creator')
- Verifies picture format if present
- Validates email address format

#### Update Validation

```rust
pub fn validate_update_user(
    _action: Update,
    _user: User,
    _original_action: EntryCreationAction,
    _original_user: User,
) -> ExternResult<ValidateCallbackResult>
```

- Currently allows all valid updates
- Maintains base validation rules

#### Delete Prevention

```rust
pub fn validate_delete_user(
    _action: Delete,
    _original_action: EntryCreationAction,
    _original_user: User,
) -> ExternResult<ValidateCallbackResult>
```

- Prevents profile deletion
- Returns Invalid result

### 5. Access Control

- Profile creation limited to one per agent
- Profile updates restricted to profile owner
- Profile queries available to all users
- Profile deletion not allowed

### 6. Integration Points

#### With Administration Zome

- Status management
- Profile verification
- Administrative actions

#### With Organization Management

- Organization membership
- Project participation
- Resource association

## Usage Examples

### Profile Creation

```rust
let user = User {
    name: "John Doe".to_string(),
    nickname: "JD".to_string(),
    bio: "Holochain Developer".to_string(),
    picture: None,
    user_type: "creator".to_string(),
    skills: vec!["Rust".to_string(), "Holochain".to_string()],
    email: "john@example.com".to_string(),
    phone: None,
    time_zone: "UTC+0".to_string(),
    location: "Global".to_string(),
};
let record = create_user(user)?;
```

### Profile Update

```rust
let input = UpdateUserInput {
    original_action_hash: original_hash,
    previous_action_hash: previous_hash,
    updated_user: updated_profile,
};
let new_record = update_user(input)?;
```

### Profile Retrieval

```rust
// Get agent's profile
let links = get_agent_user(agent_key)?;
if let Some(link) = links.first() {
    let user = get_latest_user(link.target.clone().into())?;
}

// Get profile's agents
let agents = get_user_agents(profile_hash)?;
```
