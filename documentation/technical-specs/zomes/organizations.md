# Organizations Zome Specification

## Overview

The Organizations Zome manages organization profiles and their relationships with users within the system. It consists of two parts:

1. Integrity Zome: Defines entry and link types, validation rules
2. Coordinator Zome: Implements business logic and external functions

## Technical Implementation

### 1. Entry Types

#### Organization Entry

```rust
#[hdk_entry_helper]
pub struct Organization {
    /// Name of the organization
    pub name: String,
    
    /// Organization's description
    pub description: String,
    
    /// Optional organization logo (serialized)
    pub logo: Option<SerializedBytes>,
    
    /// Contact email
    pub email: String,
    
    /// Related URLs (website, social media, etc.)
    pub urls: Vec<String>,
    
    /// Organization's location
    pub location: String,
}
```

### 2. Link Types

```rust
pub enum LinkTypes {
    AllOrganizations,          // Global organization index
    OrganizationStatus,        // Links organization to status
    UserOrganizations,         // Links users to organizations
    OrganizationMembers,       // Links organizations to members
    OrganizationCoordinators,  // Links organizations to coordinators
    OrganizationUpdates,       // Links organization updates
}
```

### 3. Organization Management

#### Core Functions

##### `create_organization`

```rust
pub fn create_organization(organization: Organization) -> ExternResult<Record>
```

- Creates new organization profile
- Verifies agent has user profile
- Creates necessary links:
  - AllOrganizations link for global index
  - OrganizationStatus link to initial status
  - UserOrganizations link from creator
  - OrganizationMembers link to creator
  - OrganizationCoordinators link to creator
- Returns created organization record

##### `update_organization`

```rust
pub fn update_organization(input: UpdateOrganizationInput) -> ExternResult<Record>
```

- Updates existing organization profile
- Verifies coordinator permissions
- Creates update links
- Returns updated organization record

##### `delete_organization`

```rust
pub fn delete_organization(organization_original_action_hash: ActionHash) -> ExternResult<bool>
```

- Deletes organization profile
- Verifies coordinator permissions
- Removes all associated links
- Returns success boolean

#### Organization Retrieval

##### `get_latest_organization_record`

```rust
pub fn get_latest_organization_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

- Retrieves most recent organization record
- Follows update links
- Returns optional record

##### `get_latest_organization`

```rust
pub fn get_latest_organization(original_action_hash: ActionHash) -> ExternResult<Organization>
```

- Retrieves most recent organization entry
- Returns organization data or error

### 4. Member Management

#### Core Functions

##### `add_member_to_organization`

```rust
pub fn add_member_to_organization(input: OrganizationUser) -> ExternResult<bool>
```

- Adds member to organization
- Verifies coordinator permissions
- Creates member links
- Returns success boolean

##### `remove_organization_member`

```rust
pub fn remove_organization_member(input: OrganizationUser) -> ExternResult<bool>
```

- Removes member from organization
- Verifies coordinator permissions
- Removes member links
- Returns success boolean

##### `leave_organization`

```rust
pub fn leave_organization(original_action_hash: ActionHash) -> ExternResult<bool>
```

- Allows member to leave organization
- Removes member links
- Returns success boolean

#### Query Functions

##### `get_organization_members`

```rust
pub fn get_organization_members(organization_original_action_hash: ActionHash) -> ExternResult<Vec<User>>
```

- Retrieves all organization members
- Returns vector of user entries

##### `get_user_organizations`

```rust
pub fn get_user_organizations(user_original_action_hash: ActionHash) -> ExternResult<Vec<Organization>>
```

- Retrieves all organizations for user
- Returns vector of organization entries

##### `is_organization_member`

```rust
pub fn is_organization_member(input: OrganizationUser) -> ExternResult<bool>
```

- Verifies if user is member
- Returns boolean status

### 5. Coordinator Management

#### Core Functions

##### `add_coordinator_to_organization`

```rust
pub fn add_coordinator_to_organization(input: OrganizationUser) -> ExternResult<bool>
```

- Promotes member to coordinator
- Verifies existing coordinator permissions
- Creates coordinator links
- Returns success boolean

##### `remove_organization_coordinator`

```rust
pub fn remove_organization_coordinator(input: OrganizationUser) -> ExternResult<bool>
```

- Removes coordinator role
- Verifies coordinator permissions
- Removes coordinator links
- Returns success boolean

#### Query Functions

##### `get_organization_coordinators`

```rust
pub fn get_organization_coordinators(organization_original_action_hash: ActionHash) -> ExternResult<Vec<User>>
```

- Retrieves all organization coordinators
- Returns vector of user entries

##### `is_organization_coordinator`

```rust
pub fn is_organization_coordinator(input: OrganizationUser) -> ExternResult<bool>
```

- Verifies if user is coordinator
- Returns boolean status

##### `check_if_agent_is_organization_coordinator`

```rust
pub fn check_if_agent_is_organization_coordinator(organization_original_action_hash: ActionHash) -> ExternResult<bool>
```

- Verifies if current agent is coordinator
- Returns boolean status

### 6. Status Integration

#### Query Functions

##### `is_organization_accepted`

```rust
pub fn is_organization_accepted(organization_original_action_hash: &ActionHash) -> ExternResult<bool>
```

- Checks organization status
- Verifies if status is "accepted"
- Returns boolean status
