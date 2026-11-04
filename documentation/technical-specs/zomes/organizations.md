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
pub fn delete_organization(organization_original_action_hash: ActionHash) -> ExternResult<ActionHash>
```

Retires the organisation; nothing is tombstoned (#234). An organisation is shared: members, coordinators, listings and exchanges name it.
- The caller needs a `Coordinate` grant for this organisation: one of its coordinators, or an administrator. Validation checks the grant, so a modified client cannot skip it.
- Writes an `OrganizationRetirement { organization, grant }` and an `OrganizationRetirements` link to it. Both are never edited or tombstoned.
- Membership, coordinator and contact links stay, as the record of who belonged.
- `get_latest_organization_record` returns `None` for a retired organisation, and `get_user_organizations` skips it, so it leaves every list.
- `is_organization_retired` answers whether one has been retired.
- Returns the retirement's hash, or the existing one if it was already retired. The name is kept so the interface's call is unchanged.

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
pub fn remove_organization_member(input: OrganizationUserInput) -> ExternResult<ActionHash>
```

- Needs a `Coordinate` grant for the organisation, and refuses a coordinator (remove the role first) or the last member
- Writes a `MembershipEnd` naming the member's member link and user link, carrying the grant; membership links are never tombstoned (#234)
- Removes the contact link if the removed member is the contact person
- Returns the end's hash

##### `leave_organization`

```rust
pub fn leave_organization(original_action_hash: ActionHash) -> ExternResult<bool>
```

- Allows a member to leave; the last coordinator cannot
- Ends their coordinator role first if they hold one, then writes their own `MembershipEnd`, with no grant: it is their own place
- Membership links are never tombstoned, and an organisation is never retired as a side effect of someone leaving
- Removes the contact link if the leaving member is the contact person
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

- Needs a `Coordinate` grant for the organisation, and refuses to remove the last coordinator
- Revokes the coordinator's grant, and writes a `MembershipEnd` naming their coordinator link, carrying the caller's grant; they stay a member
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
- **`delete_organization`**: keeps them, as it keeps every membership link: it retires the organisation rather than removing it

#### Membership ends (#234)

Membership, coordinator and user-to-organisation links are an index, and nothing tombstones them: a tombstone carries no grant, so validation could not tell a coordinator from a stranger.
- **Ending one** writes `MembershipEnd { organization, user, links, grant }`, naming the links it closes, linked from the organisation by `MembershipEnds`. The link's tag carries those link hashes, so readers need not fetch the entry; validation checks the tag against it.
- **What an end may name:** one to four links, each an `OrganizationMembers` or `OrganizationCoordinators` link from this organisation to this member, or the member's `UserOrganizations` link to it.
- **Who may:** the member themselves, with no grant; or a coordinator or administrator, whose `Coordinate` or `ChangeStatus` grant the end carries.
- **Reading:** `get_organization_members_links`, `get_organization_coordinators_links` and `get_user_organizations_links` leave out every link an end names, so every caller follows. Leaving closes the coordinator link (through `remove_organization_coordinator`, which also revokes the grant), then the member and user links; removing the role closes only the coordinator link.
- **Rejoining** writes new links, which nothing names, so the member reads as one again. No timestamp is compared anywhere.
- **Writing a link for someone else** carries the writer's grant in the tag; a user's own link to an organisation needs none.
- **One limit, unchanged:** a listing posted for an organisation proves membership by naming a member link, and validation cannot see a later end, as it cannot see a revoked grant.

### 7. Status Integration

#### Query Functions

##### `is_organization_accepted`

```rust
pub fn is_organization_accepted(organization_original_action_hash: &ActionHash) -> ExternResult<bool>
```

- Checks organization status
- Verifies if status is "accepted"
- Returns boolean status
