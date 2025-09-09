# Mediums of Exchange Zome (`mediums_of_exchange_integrity`, `mediums_of_exchange_coordinator`)

## 1. Overview

- **Purpose**: Manages the lifecycle of `MediumOfExchange` entries, which define various payment methods and value exchange mechanisms within the requests and offers ecosystem. Supports both traditional currencies (USD, EUR) and alternative exchange systems (Pay It Forward, Local Exchange Trading Systems, Time Banking, etc.).
- **Status**: Complete implementation with approval workflow, entity linking, and cross-zome integration operational
- **Approval Workflow**: Implements a moderation process for `MediumOfExchange` entries, involving user suggestions, admin review, and approval/rejection states (`pending`, `approved`, `rejected`). Only `approved` mediums can be actively used in requests and offers.
- **Exchange Type Classification**: Supports two types of mediums - "base" categories (foundational exchange systems) and "currency" types (specific monetary units)
- **Cross-Zome Integration**: Full integration with `requests_coordinator` and `offers_coordinator` for bidirectional linking
- **Zome Structure**:
  - `mediums_of_exchange_integrity`: Handles data validation, entry definitions, and validation rules.
  - `mediums_of_exchange_coordinator`: Provides externally callable functions for business logic, interacting with the integrity zome and managing data flows.

## 2. Integrity Zome (`mediums_of_exchange_integrity`)

### 2.1. Entry Types

#### `MediumOfExchange`

The `MediumOfExchange` entry defines a specific payment method or value exchange mechanism.

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct MediumOfExchange {
  /// Unique identifier (e.g., 'EUR', 'USD', 'TIME', 'LOCAL')
  pub code: String,
  /// Human-readable name (e.g., 'Euro', 'US Dollar', 'Time Banking', 'Local Currency')
  pub name: String,
  /// Detailed description of the medium of exchange
  pub description: Option<String>,
  /// Exchange type: "base" (foundational categories) or "currency" (specific monetary units)
  pub exchange_type: String,
  /// ID of corresponding hREA ResourceSpecification (only for approved)
  pub resource_spec_hrea_id: Option<String>,
}
```

### 2.2. Validation Rules

- **`MediumOfExchange` Entry:**
  - `code`: Must not be empty. Serves as unique identifier.
  - `name`: Must not be empty. Human-readable display name.
  - `description`: Optional field for detailed explanation.
  - `exchange_type`: Must be either "base" or "currency". Validated strictly.
  - `resource_spec_hrea_id`: Optional initially (for suggested state), set during approval.
- **Updates/Deletes**: Only original author can update/delete entries (author validation enforced).

### 2.3. Link Types

- **`AllMediumsOfExchange`**
  - **Base**: `Path` anchor (e.g., `mediums_of_exchange`).
  - **Target**: `ActionHash` of a `MediumOfExchange` entry.
  - **Purpose**: Links all medium of exchange entries for global access.

- **`MediumOfExchangeUpdates`**
  - **Base**: `ActionHash` of original `MediumOfExchange` entry.
  - **Target**: `ActionHash` of updated `MediumOfExchange` entry.
  - **Purpose**: Links original entries to their updates for version tracking.

- **`MediumOfExchangeToRequest`**
  - **Base**: `ActionHash` of a `MediumOfExchange` entry.
  - **Target**: `ActionHash` of a `Request` entry.
  - **Purpose**: Links approved mediums to requests that accept them.

- **`RequestToMediumOfExchange`**
  - **Base**: `ActionHash` of a `Request` entry.
  - **Target**: `ActionHash` of a `MediumOfExchange` entry.
  - **Purpose**: Bidirectional link from requests to their accepted mediums.

- **`MediumOfExchangeToOffer`**
  - **Base**: `ActionHash` of a `MediumOfExchange` entry.
  - **Target**: `ActionHash` of an `Offer` entry.
  - **Purpose**: Links approved mediums to offers that provide them.

- **`OfferToMediumOfExchange`**
  - **Base**: `ActionHash` of an `Offer` entry.
  - **Target**: `ActionHash` of a `MediumOfExchange` entry.
  - **Purpose**: Bidirectional link from offers to their provided mediums.

## 3. Coordinator Zome (`mediums_of_exchange_coordinator`)

### 3.1. Path Anchors Used

- **Global Anchor (Static Path):**
  - `mediums_of_exchange`: For linking all medium of exchange entries.
- **Status Anchors (Static Paths):**
  - `mediums_of_exchange.status.pending`: For `MediumOfExchange` entries awaiting admin review.
  - `mediums_of_exchange.status.approved`: For `MediumOfExchange` entries approved by an admin and usable in requests/offers.
  - `mediums_of_exchange.status.rejected`: For `MediumOfExchange` entries rejected by an admin.

### 3.2. Key Functions

Input/Output structs are defined in Rust for type safety and clarity.

#### User-Facing Functions

- **`suggest_medium_of_exchange(input: MediumOfExchangeInput) -> ExternResult<Record>`**
  - **Description**: Allows accepted users to suggest new `MediumOfExchange` entries. Non-admin users can only suggest "currency" types.
  - **Actions**:
    1.  Validates user is accepted or administrator.
    2.  Ensures non-admin users can only suggest "currency" exchange types.
    3.  Creates a new `MediumOfExchange` entry with `resource_spec_hrea_id` set to None.
    4.  Links the entry to the global `mediums_of_exchange` anchor.
    5.  Links the entry to the `mediums_of_exchange.status.pending` anchor.
  - **Access Control**: Accepted users and administrators.
  - **Returns**: The `Record` of the newly created `MediumOfExchange` entry.

#### Administrative Functions

- **`create_medium_of_exchange(input: MediumOfExchangeInput) -> ExternResult<Record>`**
  - **Description**: Allows administrators to directly create and approve `MediumOfExchange` entries of any type.
  - **Actions**:
    1.  Creates a new `MediumOfExchange` entry.
    2.  Links the entry to the global `mediums_of_exchange` anchor.
    3.  Links the entry directly to the `mediums_of_exchange.status.approved` anchor.
  - **Access Control**: Admin only.
  - **Returns**: The `Record` of the newly created and approved `MediumOfExchange` entry.

- **`approve_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()>`**
  - **Description**: Allows an administrator to approve a `MediumOfExchange` that is currently `pending`.
  - **Actions**:
    1.  Validates that `medium_of_exchange_hash` points to an existing `MediumOfExchange` entry.
    2.  Creates placeholder hREA ResourceSpecification ID (format: `hrea_resource_spec_{code}`).
    3.  Updates the entry with the hREA ResourceSpecification ID.
    4.  Removes from all status paths and links to `mediums_of_exchange.status.approved`.
  - **Access Control**: Admin only.
  - **Returns**: Success confirmation.

- **`reject_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()>`**
  - **Description**: Allows an administrator to reject a `MediumOfExchange`.
  - **Actions**:
    1.  Validates `medium_of_exchange_hash`.
    2.  Removes from all status paths.
    3.  Links to `mediums_of_exchange.status.rejected`.
  - **Access Control**: Admin only.
  - **Returns**: Success confirmation.

- **`update_medium_of_exchange(input: UpdateMediumOfExchangeInput) -> ExternResult<Record>`**
  - **Description**: Allows an administrator to update an existing `MediumOfExchange`.
  - **Actions**:
    1.  Validates admin permissions and entry existence.
    2.  Creates update entry.
    3.  Creates update link for version tracking.
  - **Access Control**: Admin only.
  - **Returns**: The `Record` of the updated `MediumOfExchange` entry.

- **`delete_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<()>`**
  - **Description**: Allows an administrator to delete a `MediumOfExchange` entry.
  - **Actions**:
    1.  Validates admin permissions and entry existence.
    2.  Removes from all status paths.
    3.  Deletes the entry.
  - **Access Control**: Admin only.
  - **Returns**: Success confirmation.

#### Getter Functions

- **`get_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<Option<Record>>`**
  - **Description**: Retrieves a specific `MediumOfExchange` entry by its `ActionHash`.
  - **Access Control**: Public.
  - **Returns**: `Some(Record)` if found, `None` otherwise.

- **`get_latest_medium_of_exchange_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>`**
  - **Description**: Gets the latest version of a medium of exchange given the original action hash.
  - **Access Control**: Public.
  - **Returns**: Latest version `Record` or original if no updates.

- **`get_all_mediums_of_exchange() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `MediumOfExchange` entries regardless of status.
  - **Access Control**: Public.
  - **Returns**: A vector of `Record`s.

- **`get_pending_mediums_of_exchange() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `MediumOfExchange` entries currently linked to the `mediums_of_exchange.status.pending` anchor.
  - **Access Control**: Admin only.
  - **Returns**: A vector of `Record`s.

- **`get_approved_mediums_of_exchange() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `MediumOfExchange` entries currently linked to the `mediums_of_exchange.status.approved` anchor.
  - **Access Control**: Public (essential for UI selectors).
  - **Returns**: A vector of `Record`s.

- **`get_rejected_mediums_of_exchange() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `MediumOfExchange` entries currently linked to the `mediums_of_exchange.status.rejected` anchor.
  - **Access Control**: Admin only.
  - **Returns**: A vector of `Record`s.

#### Entity Linking Functions

- **`link_to_medium_of_exchange(input: MediumOfExchangeLinkInput) -> ExternResult<()>`**
  - **Description**: Creates bidirectional links between an approved medium of exchange and a request or offer.
  - **Validation**: Verifies the medium of exchange is approved before linking.
  - **Access Control**: Public (for linking approved mediums).
  - **Returns**: Success confirmation.

- **`unlink_from_medium_of_exchange(input: MediumOfExchangeLinkInput) -> ExternResult<()>`**
  - **Description**: Removes bidirectional links between a medium of exchange and a request or offer.
  - **Access Control**: Public.
  - **Returns**: Success confirmation.

- **`update_medium_of_exchange_links(input: UpdateMediumOfExchangeLinksInput) -> ExternResult<()>`**
  - **Description**: Updates all medium of exchange links for a request or offer, efficiently adding new links and removing outdated ones.
  - **Access Control**: Public.
  - **Returns**: Success confirmation.

- **`get_mediums_of_exchange_for_entity(input: GetMediumOfExchangeForEntityInput) -> ExternResult<Vec<ActionHash>>`**
  - **Description**: Gets all medium of exchange hashes linked to a request or offer.
  - **Access Control**: Public.
  - **Returns**: Vector of `ActionHash`es.

- **`delete_all_medium_of_exchange_links_for_entity(input: GetMediumOfExchangeForEntityInput) -> ExternResult<()>`**
  - **Description**: Deletes all medium of exchange links for a request or offer (used when deleting the entity).
  - **Access Control**: Public.
  - **Returns**: Success confirmation.

#### Cross-Entity Discovery Functions

- **`get_requests_for_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all requests linked to a specific medium of exchange.
  - **Access Control**: Public.
  - **Returns**: A vector of Request `Record`s.

- **`get_offers_for_medium_of_exchange(medium_of_exchange_hash: ActionHash) -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all offers linked to a specific medium of exchange.
  - **Access Control**: Public.
  - **Returns**: A vector of Offer `Record`s.

#### Utility Functions

- **`is_medium_of_exchange_approved(medium_of_exchange_hash: ActionHash) -> ExternResult<bool>`**
  - **Description**: Checks if a medium of exchange is approved (for internal use and validation).
  - **Access Control**: Public.
  - **Returns**: Boolean indicating approval status.

### 3.3. Cross-Zome Interactions

- **Called by `requests_coordinator` and `offers_coordinator`:**
  - To validate that `MediumOfExchange` ActionHashes provided during `Request`/`Offer` creation/update correspond to _approved_ `MediumOfExchange`s.
  - Entity linking operations to associate requests/offers with their accepted/provided mediums.

- **Integration with `administration` zome:**
  - Uses admin validation functions to check permissions for approval/rejection operations.
  - Leverages user acceptance status for suggestion permissions.

## 4. Testing Status

### Backend Tests (Tryorama)

- ✅ Medium of exchange CRUD operations and status management
- ✅ Exchange type validation ("base" vs "currency")
- ✅ Approval workflow (suggest, approve, reject)
- ✅ Entity linking with requests and offers
- ✅ Bidirectional link management and cleanup
- ✅ Admin permission validation and access control
- ✅ Cross-entity discovery functionality
- ✅ Update and version tracking

### Frontend Integration

- ✅ **Effect-TS Service Layer**: Complete with all zome functions exposed
- ✅ **Reactive Svelte Store**: Full state management with caching and event bus
- ✅ **UI Components**: Enhanced form and selector components with categorization
- ✅ **Cross-Store Integration**: Requests and offers stores enhanced with medium linking
- ✅ **Test Coverage**: All unit tests passing (part of 268 total test suite)

## 5. Implementation Notes

### Performance Considerations

- Path anchor indexing provides efficient status-based queries
- Bidirectional linking enables fast cross-entity discovery
- Caching implemented at service and store levels
- Status transition operations optimized to remove from all paths before setting new status

### Data Integrity

- Only approved medium of exchange entries can be linked to requests/offers
- Exchange type validation ensures consistency ("base" vs "currency")
- Author validation prevents unauthorized updates/deletes
- Cross-zome validation ensures link consistency

### User Experience

- **Exchange Type Classification**: Clear distinction between foundational categories and specific currencies
- **Suggestion Workflow**: Users can contribute new mediums for community approval
- **Permission-Based Access**: Different capabilities for users vs administrators
- **Visual Categorization**: Enhanced UI with base categories (📂) and currencies (💰)

### hREA Integration

- Placeholder hREA ResourceSpecification ID generation during approval
- Ready for full hREA integration when available
- Resource specification mapping for economic coordination

### Exchange Type System

- **"base"**: Foundational exchange categories (Pay It Forward, LETS, Time Banking)
- **"currency"**: Specific monetary units (USD, EUR, Bitcoin, Local Currency)
- **User Restrictions**: Non-admin users can only suggest "currency" types
- **Admin Capabilities**: Full access to create both "base" and "currency" types

## 6. Security Considerations

### Access Control Matrix

| Operation               | User | Accepted User | Administrator |
| ----------------------- | ---- | ------------- | ------------- |
| Suggest Currency        | ❌   | ✅            | ✅            |
| Suggest Base Type       | ❌   | ❌            | ✅            |
| Create Direct           | ❌   | ❌            | ✅            |
| View Approved           | ✅   | ✅            | ✅            |
| View Pending            | ❌   | ❌            | ✅            |
| Approve/Reject          | ❌   | ❌            | ✅            |
| Update/Delete           | ❌   | ❌            | ✅            |
| Link to Requests/Offers | ❌   | ✅            | ✅            |

### Validation Layers

- **Entry Validation**: Field presence and format validation
- **Permission Validation**: User role and acceptance status checks
- **Business Logic Validation**: Exchange type restrictions and approval status verification
- **Link Validation**: Only approved mediums can be linked to entities

This comprehensive documentation provides complete technical coverage of the Mediums of Exchange zome, from backend Rust implementation through validation rules and cross-zome integration patterns.
