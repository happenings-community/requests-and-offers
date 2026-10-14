# Organization Contact Person

## Overview

Each organization can designate a single **contact person** — a coordinator who serves as the public-facing representative. The contact person is stored as an `OrganizationContacts` link with the role/title encoded in the link tag.

### Key Concepts

- **Single contact per organization**: Setting a new contact automatically replaces the previous one
- **Coordinator-only**: Only organization coordinators can be designated as contact person
- **Role/title**: A free-text field (e.g. "Director", "President", "Contact Person") stored in the link tag
- **Auto-cleanup**: Contact links are automatically removed when the contact person leaves, is removed from the organization, or the organization is deleted

## Backend API

### Link Type

```rust
// In dnas/requests_and_offers/zomes/integrity/users_organizations/src/lib.rs
pub enum LinkTypes {
    // ... existing link types ...
    OrganizationContacts,  // Organization → User (tag = role string)
}
```

The `OrganizationContacts` link connects an organization's `ActionHash` to a user's `ActionHash`, with the role/title encoded as the link tag bytes.

### New Types

```rust
// In dnas/requests_and_offers/utils/src/types.rs

/// Input for setting an organization contact with a role
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OrganizationContactInput {
    pub organization_original_action_hash: ActionHash,
    pub user_original_action_hash: ActionHash,
    pub role: String,
}
```

The existing `OrganizationUser` type was renamed to `OrganizationUserInput` for clarity.

### New Errors

```rust
// In dnas/requests_and_offers/utils/src/errors.rs (OrganizationsError enum)
AlreadyContact,  // User is already the contact person
NotContact,      // No contact person exists (when trying to remove)
```

### Zome Functions

All functions are in the `users_organizations` coordinator zome (`organization.rs`).

#### `get_organization_contacts_links`

```rust
pub fn get_organization_contacts_links(
    organization_original_action_hash: ActionHash
) -> ExternResult<Vec<Link>>
```

Returns all `OrganizationContacts` links for an organization. In practice, there should be at most one (single contact enforcement).

#### `get_organization_contact`

```rust
pub fn get_organization_contact(
    organization_original_action_hash: ActionHash
) -> ExternResult<Option<(User, String)>>
```

Returns the contact person's `User` entry and their role string, or `None` if no contact is set.

#### `set_organization_contact`

```rust
pub fn set_organization_contact(
    input: OrganizationContactInput
) -> ExternResult<bool>
```

Sets the contact person for an organization.

**Preconditions**:
- Caller must be a coordinator of the organization
- Target user must be a coordinator of the organization

**Behavior**:
- Removes any existing contact link (single contact enforcement)
- Creates a new `OrganizationContacts` link with the role as the tag

#### `remove_organization_contact`

```rust
pub fn remove_organization_contact(
    organization_original_action_hash: ActionHash
) -> ExternResult<bool>
```

Removes the contact person from an organization.

**Preconditions**:
- Caller must be a coordinator of the organization
- A contact must exist (returns `NotContact` error otherwise)

#### `is_organization_contact`

```rust
pub fn is_organization_contact(
    input: OrganizationUserInput
) -> ExternResult<bool>
```

Checks whether a specific user is the contact person for the organization.

### Cleanup Behavior

Contact links are automatically cleaned up in these existing functions:

- **`leave_organization`**: If the leaving member is the contact, their contact link is removed
- **`remove_organization_member`**: If the removed member is the contact, their contact link is removed
- **`delete_organization`**: All contact links are deleted as part of organization cleanup

## Frontend Service

**File**: `ui/src/lib/services/zomes/organizations.service.ts`

Three new methods on the `OrganizationsService` interface:

```typescript
readonly getOrganizationContactsLinks: (
    organization_original_action_hash: ActionHash
) => E.Effect<Link[], OrganizationError>;

readonly setOrganizationContact: (
    organization_original_action_hash: ActionHash,
    user_original_action_hash: ActionHash,
    role: string
) => E.Effect<boolean, OrganizationError>;

readonly removeOrganizationContact: (
    organization_original_action_hash: ActionHash
) => E.Effect<boolean, OrganizationError>;
```

### Error Contexts

```typescript
// In ui/src/lib/errors/error-contexts.ts (ORGANIZATION_CONTEXTS)
SET_ORGANIZATION_CONTACT: 'Failed to set organization contact',
REMOVE_ORGANIZATION_CONTACT: 'Failed to remove organization contact',
GET_ORGANIZATION_CONTACTS: 'Failed to get organization contacts'
```

## Frontend Store

**File**: `ui/src/lib/stores/organizations.store.svelte.ts`

### New State

```typescript
readonly currentContact: { user_hash: ActionHash; role: string } | null;
```

Derived from `currentOrganization?.contact || null`.

### New Methods

```typescript
setContact: (
    orgHash: ActionHash,
    userHash: ActionHash,
    role: string
) => E.Effect<boolean, OrganizationError>;

removeContact: (
    orgHash: ActionHash
) => E.Effect<boolean, OrganizationError>;
```

Both methods invalidate the organization cache after successful operation.

### Organization Loading

The `getLatestOrganization` function fetches contact links alongside member and coordinator links, then transforms the first contact link into a `{ user_hash, role }` object stored on the `UIOrganization`.

## UI Type

**File**: `ui/src/lib/types/ui.ts`

```typescript
export type UIOrganization = OrganizationInDHT & {
    members: ActionHash[];
    coordinators: ActionHash[];
    contact?: { user_hash: ActionHash; role: string };
    status?: UIStatus;
    original_action_hash?: ActionHash;
    previous_action_hash?: ActionHash;
};
```

## UI Components

### OrganizationDetailsModal

Displays the contact person's name (resolved via `usersStore.getUserByActionHash`) and role in the "Contact Information" section. The contact name links to the user's profile page.

### OrganizationCoordinatorsTable

Adds an `isContact()` helper to check if a coordinator is the current contact person. Used to display a visual indicator next to the contact coordinator.

### OrganizationForm

Unchanged for contact management (contact is managed separately from the organization form).

### UserOrganizationsTable

Shows contact information when displaying organizations a user belongs to.

### Organization Detail Page (`/organizations/[id]`)

Displays the contact person with name, profile link, and role in the "Contact" section alongside other organization details (legal name, email, location).

### Organization Edit Page (`/organizations/[id]/edit`)

Provides a full contact management UI:
- Displays current contact person (if any) with a "Remove Contact" button
- Coordinator dropdown to select a new contact
- Role/title text input field
- "Set Contact" / "Change Contact" button

### Organization Create Page (`/organizations/create`)

Allows the creator to optionally designate themselves as contact during organization creation:
- "I am the contact person for this organization" checkbox
- Role/title input (shown when checked)
- Contact is set after organization creation via `setCreatorAsContact()`

## Business Rules

1. **Coordinator-only**: Only coordinators can be designated as contact person. The backend enforces this by checking `is_organization_coordinator` before setting the contact.
2. **Single contact**: Each organization has at most one contact person. Setting a new contact replaces the previous one by deleting existing contact links first.
3. **Auto-removal on leave/remove**: When a member leaves or is removed from the organization, if they are the contact person, their contact link is automatically cleaned up.
4. **Auto-removal on delete**: When an organization is deleted, all contact links are removed as part of the cleanup process.
5. **Optional during creation**: The organization creator can optionally set themselves as the contact person during creation. This is handled as a post-creation step (separate from the `create_organization` call).
6. **Role flexibility**: The role/title is a free-text string, allowing organizations to use whatever title is appropriate (Director, President, Secretary, Contact Person, etc.).
