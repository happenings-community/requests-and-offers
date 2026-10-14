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
    /// Display name of the organization
    pub name: String,

    /// Organization's vision and mission statement (supports markdown, rendered on frontend with `marked` + `DOMPurify`)
    pub description: String,

    /// Full legal name for business registration compliance
    /// Required field for formal business entity identification
    pub full_legal_name: String,

    /// Optional organization logo (serialized)
    pub logo: Option<SerializedBytes>,

    /// Contact email for the organization
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
    OrganizationContacts,      // Links organization to contact person (tag = role)
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
- Removes all associated links (members, coordinators, contacts, status)
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
pub fn add_member_to_organization(input: OrganizationUserInput) -> ExternResult<bool>
```

- Adds member to organization
- Verifies coordinator permissions
- Creates member links
- Returns success boolean

##### `remove_organization_member`

```rust
pub fn remove_organization_member(input: OrganizationUserInput) -> ExternResult<bool>
```

- Removes member from organization
- Verifies coordinator permissions
- Removes member and coordinator links
- Removes contact link if the removed member is the contact person
- Returns success boolean

##### `leave_organization`

```rust
pub fn leave_organization(original_action_hash: ActionHash) -> ExternResult<bool>
```

- Allows member to leave organization
- Removes member and coordinator links
- Removes contact link if the leaving member is the contact person
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
pub fn is_organization_member(input: OrganizationUserInput) -> ExternResult<bool>
```

- Verifies if user is member
- Returns boolean status

### 5. Coordinator Management

#### Core Functions

##### `add_coordinator_to_organization`

```rust
pub fn add_coordinator_to_organization(input: OrganizationUserInput) -> ExternResult<bool>
```

- Promotes member to coordinator
- Verifies existing coordinator permissions
- Creates coordinator links
- Returns success boolean

##### `remove_organization_coordinator`

```rust
pub fn remove_organization_coordinator(input: OrganizationUserInput) -> ExternResult<bool>
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
pub fn is_organization_coordinator(input: OrganizationUserInput) -> ExternResult<bool>
```

- Verifies if user is coordinator
- Returns boolean status

##### `check_if_agent_is_organization_coordinator`

```rust
pub fn check_if_agent_is_organization_coordinator(organization_original_action_hash: ActionHash) -> ExternResult<bool>
```

- Verifies if current agent is coordinator
- Returns boolean status

### 6. Contact Management

#### Core Functions

##### `get_organization_contacts_links`

```rust
pub fn get_organization_contacts_links(organization_original_action_hash: ActionHash) -> ExternResult<Vec<Link>>
```

- Retrieves `OrganizationContacts` links for an organization
- Returns vector of links (at most one due to single-contact enforcement)

##### `get_organization_contact`

```rust
pub fn get_organization_contact(organization_original_action_hash: ActionHash) -> ExternResult<Option<(User, String)>>
```

- Retrieves the contact person's User entry and role string
- Returns `None` if no contact is set

##### `set_organization_contact`

```rust
pub fn set_organization_contact(input: OrganizationContactInput) -> ExternResult<bool>
```

- Sets the contact person for an organization
- Verifies caller is a coordinator
- Verifies target user is a coordinator
- Removes any existing contact link (single-contact enforcement)
- Creates `OrganizationContacts` link with role as tag
- Returns success boolean

##### `remove_organization_contact`

```rust
pub fn remove_organization_contact(organization_original_action_hash: ActionHash) -> ExternResult<bool>
```

- Removes the contact person from an organization
- Verifies coordinator permissions
- Returns `NotContact` error if no contact exists
- Returns success boolean

##### `is_organization_contact`

```rust
pub fn is_organization_contact(input: OrganizationUserInput) -> ExternResult<bool>
```

- Checks if a specific user is the contact person
- Returns boolean status

#### Cleanup Behavior

Contact links are automatically cleaned up in:
- **`leave_organization`**: Removes contact link if the leaving member is the contact
- **`remove_organization_member`**: Removes contact link if the removed member is the contact
- **`delete_organization`**: Removes all contact links as part of organization cleanup

### 7. Status Integration

#### Query Functions

##### `is_organization_accepted`

```rust
pub fn is_organization_accepted(organization_original_action_hash: &ActionHash) -> ExternResult<bool>
```

- Checks organization status
- Verifies if status is "accepted"
- Returns boolean status
