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

    /// The grant an update rests on, held by its author: a coordinator grant for
    /// this organisation, or an admin grant. Absent on creation and on an update
    /// by the organisation's creator. Set by the coordinator zome, never taken
    /// from the client.
    #[serde(default)]
    pub grant: Option<ActionHash>,
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
  - UserOrganizations link from creator, so the applicant finds their proposal while it is pending
- Writes no member or coordinator link. An organisation is a proposal until it is approved, and approval is what makes its creator a member and its coordinator (see "Roles and grants" below)
- Returns created organization record

##### `update_organization`

```rust
pub fn update_organization(input: UpdateOrganizationInput) -> ExternResult<Record>
```

- Updates existing organization profile
- Its creator edits it with no grant, pending or approved. Anyone else needs a coordinator grant for it or an admin grant, which the zome writes into the update's `grant` field
- Creates update links
- Returns updated organization record

##### `delete_organization`

```rust
pub fn delete_organization(organization_original_action_hash: ActionHash) -> ExternResult<ActionHash>
```

- Deletes organization profile
- Open to two callers, and nobody else:
  - a coordinator of the organisation, on their own grant. One is enough: an organisation may run with a single coordinator, and the last one cannot leave, so this is their way out
  - its creator, while it has no coordinator, which means a proposal never approved
- An administrator's or a steward's grant does not cover it (`Ability::Dissolve`)
- Removes all associated links (members, coordinators, contacts, status, the creator's own pointer)
- Revokes every coordinator grant for the organisation, the caller's own last
- Returns the hash of the delete action

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
- Needs a coordinator grant for the organisation or an admin grant, and an accepted organisation
- Creates member links; the `OrganizationMembers` link carries the caller's grant in its tag
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

- Promotes member to coordinator (adding them as a member first if they are not one)
- Needs a coordinator grant for the organisation or an admin grant, an accepted organisation and an accepted user
- Writes an `org_coordinator` grant, scoped to the organisation, for each of the user's agents, resting on the caller's grant
- Creates the coordinator link, carrying the caller's grant in its tag
- Returns success boolean

##### `remove_organization_coordinator`

```rust
pub fn remove_organization_coordinator(input: OrganizationUserInput) -> ExternResult<bool>
```

- Removes coordinator role
- Needs a coordinator grant for the organisation or an admin grant, and an accepted organisation
- Refuses to remove the last coordinator
- Revokes the user's coordinator grants for the organisation, then removes the coordinator link. What they did as coordinator stands
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

### Roles and grants

A coordinator is whoever holds a live `org_coordinator` grant scoped to the organisation (see [administration](administration.md), "The chain of grants"). The `OrganizationCoordinators` link is the listing the interface reads; permission is the grant.

**How the role is given.** The first coordinator is the creator, and the grant is issued by the administrator or steward who approves the organisation, on the first approval only. After that a coordinator gives the role to another member with `add_coordinator_to_organization`. An administrator may give it too.

**What validation enforces** (`users_organizations_integrity`):

| Op | Rule |
|---|---|
| Update `Organization` | the author is the organisation's creator, or the `grant` field names a coordinator grant for this organisation or an admin grant, held by the author. Run on the entry op, the record op and the op the original's authorities receive |
| Create `OrganizationMembers` / `OrganizationCoordinators` | from an organisation to a user, by declared entry type; the tag carries a grant held by the link's author: a coordinator grant for this organisation, or a network grant that may change a status (admin, or steward with the stewarding module) |
| Create `UserUpdates` / `OrganizationUpdates` | both ends are records of that type, by declared entry type |
| Delete `UserUpdates` / `OrganizationUpdates` | refused |

**What it does not**, each listed in `documentation/architecture/validation.md`:

- The network-grant branch of the membership rule is there for approval, and the rule cannot tell an approval from any other moment. An administrator or a steward may write a membership link at any time; the app does so only on approval.
- A tombstone of an organisation, or of a membership link, is unchecked. Who may delete an organisation, and the last-coordinator rule, are the app's checks.
- Revocation is read-side, as for every grant: a removed coordinator with a modified client can still write an edit that validates. An honest client asks `can` and does not show it as theirs to make.
- An administrator can give themselves a coordinator grant for any organisation, and with it delete the organisation. Doing so leaves the grant as a record of who did it.

**Tests.** `tests/sweettest/tests/grants.rs`: `approval_makes_the_creator_coordinator_and_only_of_that_organisation`, `approval_makes_the_creator_coordinator_once`, `an_organisation_is_deleted_by_a_coordinator_alone_and_by_nobody_outside_it`, `an_update_link_is_never_deleted_and_joins_records_of_its_own_type`. Each names, in its doc comment, the change that turns it red. The update op the original's authorities receive is a unit test in `users_organizations_integrity` (`record_op_tests`).

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
