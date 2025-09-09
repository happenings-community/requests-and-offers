# Service Types Zome (`service_types_integrity`, `service_types_coordinator`)

## 1. Overview

- **Purpose**: Manages the lifecycle of `ServiceType` entries. These entries define the categories or types of services, skills, or resources that can be requested or offered within the application. This zome is crucial for classifying and discovering requests and offers.
- **Status**: Full validation workflow, tag-based discovery, and cross-zome integration operational
- **Validation Workflow**: Implements a moderation process for `ServiceType` entries, involving user suggestions, admin review, and approval/rejection states (`pending`, `approved`, `rejected`). Only `approved` service types can be actively used in new requests and offers.
- **Tag-Based Discovery**: Comprehensive tagging system with path anchor indexing for efficient search, filtering, and cross-entity discovery
- **Cross-Zome Integration**: Full integration with `requests_coordinator` and `offers_coordinator` for tag-based discovery
- **Zome Structure**:
  - `service_types_integrity`: Handles data validation, entry definitions, and link type rules.
  - `service_types_coordinator`: Provides externally callable functions for business logic, interacting with the integrity zome and managing data flows.

## 2. Integrity Zome (`service_types_integrity`)

### 2.1. Entry Types

#### `ServiceType`

The `ServiceType` entry defines a specific type of service or skill with technical classification.

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
    pub name: String,        // E.g., "Web Development", "Graphic Design", "Childcare"
    pub description: String, // A brief explanation of the service type
    pub technical: bool,     // Technical vs non-technical classification
    // REMOVED: pub tags: Vec<String> - Tags functionality has been removed as per issue #49
    // pub category: Option<String>, // Optional: A broader category, e.g., "Technology", "Creative Arts"
                                  // Decision: Currently not implemented, technical field provides classification.
}
```

### 2.2. Validation Rules

- **`ServiceType` Entry:**
  - `name`: Must not be empty. Max length (e.g., 100 chars) can be enforced.
  - `description`: Must not be empty. Max length (e.g., 500 chars) can be enforced.
  - `technical`: Boolean field for technical classification (no validation needed).
- **Updates/Deletes**: Standard Holochain author validation (original author or agent with specific capabilities can update/delete).

### 2.3. Link Types

- **`ServiceTypeStatusAnchorToServiceType`**
  - **Base**: `Path` anchor (e.g., `service_types.status.pending`).
  - **Target**: `ActionHash` of a `ServiceType` entry.
  - **Link Tag**: `ActionHash` of the `ServiceType` (for easy retrieval/deduplication) or a `Timestamp` for ordering.
  - **Purpose**: Connects `ServiceType` entries to their current validation status (`pending`, `approved`, `rejected`).

- **`TechnicalClassificationAnchorToServiceType`** (NEW)
  - **Base**: `Path` anchor (e.g., `service_types.classification.technical` or `service_types.classification.non_technical`).
  - **Target**: `ActionHash` of an _approved_ `ServiceType` entry.
  - **Link Tag**: `ActionHash` of the `ServiceType`.
  - **Purpose**: Enables filtering approved service types by technical classification.

- **(Implicit) `ServiceTypeUpdates`**
  - Holochain automatically links original entry actions to their updates.

**REMOVED LINK TYPES :**

- ~~`TagAnchorToServiceType`~~ - Tags functionality completely removed
- ~~`AllTagsAnchorToTagString`~~ - Tags functionality completely removed

(Note: `RequestToServiceType` and `OfferToServiceType` links are defined in their respective zomes but are crucial for understanding how `ServiceTypes` are consumed. These links should only target _approved_ `ServiceType` entries.)

## 3. Coordinator Zome (`service_types_coordinator`)

### 3.1. Path Anchors Used

- **Status Anchors (Static Paths):**
  - `service_types.status.pending`: For `ServiceType` entries awaiting admin review.
  - `service_types.status.approved`: For `ServiceType` entries approved by an admin and usable in requests/offers.
  - `service_types.status.rejected`: For `ServiceType` entries rejected by an admin.
- **Technical Classification Anchors (Static Paths - NEW):**
  - `service_types.classification.technical`: For indexing technical service types.
  - `service_types.classification.non_technical`: For indexing non-technical service types.

**REMOVED ANCHORS :**

- ~~`service_types.tags.{url_encoded_tag_string}`~~ - Tags functionality completely removed
- ~~`service_types.all_tags`~~ - Tags functionality completely removed

### 3.2. Key Functions

Input/Output structs (e.g., `SuggestServiceTypeInput`) are defined in Rust for clarity.

#### User-Facing Functions

- **`suggest_service_type(input: ServiceType) -> ExternResult<Record>`**
  - **Description**: Allows any authenticated user to suggest a new `ServiceType`.
  - **Actions**:
    1.  Creates a new `ServiceType` entry with the provided `name`, `description`, and `tags`.
    2.  Links the new `ServiceType` entry's `ActionHash` to the `service_types.status.pending` anchor.
  - **Access Control**: Any valid, authenticated agent.
  - **Returns**: The `Record` of the newly created `ServiceType` entry.

#### Admin-Facing Functions

(Admin role is determined by a separate mechanism, e.g., membership in an admin group or a capability grant.)

    -   **`admin_create_service_type(input: ServiceType) -> ExternResult<Record>`**
    -   **Description**: Allows an administrator to directly create and approve a `ServiceType`.
    -   **Actions**:
        1.  Creates a new `ServiceType` entry.
        2.  Links the `ServiceType`'s `ActionHash` to the `service_types.status.approved` anchor.
        3.  Links the `ServiceType`'s `ActionHash` to the appropriate technical classification anchor:
            -   `service_types.classification.technical` if `input.technical` is true
            -   `service_types.classification.non_technical` if `input.technical` is false
    -   **Access Control**: Admin only.
    -   **Returns**: The `Record` of the newly created and approved `ServiceType` entry.

- **`approve_service_type(service_type_ah: ActionHash) -> ExternResult<ActionHash>`**
  - **Description**: Allows an administrator to approve a `ServiceType` that is currently `pending` (or `rejected`).
  - **Actions**:
    1.  Validates that `service_type_ah` points to an existing `ServiceType` entry.
    2.  Removes any existing links from `service_types.status.pending` or `service_types.status.rejected` to `service_type_ah`.
    3.  Creates a link from `service_types.status.approved` to `service_type_ah`.
    4.  Fetches the `ServiceType` entry to get its technical classification.
    5.  Links `service_type_ah` from the appropriate technical classification anchor:
        - `service_types.classification.technical` if `technical` is true
        - `service_types.classification.non_technical` if `technical` is false
  - **Access Control**: Admin only.
  - **Returns**: The `ActionHash` of the approved `ServiceType`.

- **`reject_service_type(service_type_ah: ActionHash, reason: Option<String>) -> ExternResult<ActionHash>`**
  - **Description**: Allows an administrator to reject a `ServiceType` (whether `pending` or `approved`).
  - `reason` is optional and currently not stored directly on DHT, but could be logged or emitted as a signal.
  - **Actions**:
    1.  Validates `service_type_ah`.
    2.  Removes links from `service_types.status.pending` or `service_types.status.approved` to `service_type_ah`.
    3.  Creates a link from `service_types.status.rejected` to `service_type_ah`.
    4.  If the `ServiceType` was previously approved:
        - Fetches the `ServiceType` entry to get its technical classification.
        - Removes links from appropriate technical classification anchors to `service_type_ah`.
        - **Crucially**: Triggers cross-zome calls or signals to `requests_coordinator` and `offers_coordinator` to handle cleanup of links from existing `Request` and `Offer` entries that referenced this `service_type_ah`. (Requires granted capabilities).
  - **Access Control**: Admin only.
  - **Returns**: The `ActionHash` of the rejected `ServiceType`.

- **`admin_update_service_type(original_action_hash: ActionHash, updated_input: ServiceType) -> ExternResult<Record>`**
  - **Description**: Allows an administrator to update an existing `ServiceType`.
  - **Actions**:
    1.  Creates an update for the `ServiceType` entry pointed to by `original_action_hash`.
    2.  The status of the `ServiceType` (e.g., `approved`) is generally maintained unless explicitly changed by a separate call to `approve_service_type` or `reject_service_type`.
    3.  If the `ServiceType` is `approved` and technical classification has changed:
        - Removes links from the old technical classification anchor.
        - Adds links to the new technical classification anchor based on `updated_input.technical`.
  - **Access Control**: Admin only.
  - **Returns**: The `Record` of the updated `ServiceType` entry (new ActionHash, same EntryHash).

- **`admin_delete_service_type(original_action_hash: ActionHash) -> ExternResult<ActionHash>`**
  - **Description**: Allows an administrator to delete a `ServiceType` entry.
  - **Actions**:
    1.  Creates a delete action for the entry identified by `original_action_hash`.
    2.  Removes all links from status anchors (`pending`, `approved`, `rejected`) to this `ServiceType`'s ActionHash(es).
    3.  If the `ServiceType` was `approved`:
        - Removes all links from technical classification anchors.
        - Triggers cross-zome calls/signals for `Request`/`Offer` link cleanup if it was `approved`.
  - **Access Control**: Admin only.
  - **Returns**: The `ActionHash` of the delete action.

#### Getter Functions

- **`get_service_type(service_type_ah: ActionHash) -> ExternResult<Option<Record>>`**
  - **Description**: Retrieves a specific `ServiceType` entry by its `ActionHash`.
  - **Access Control**: Public.
  - **Returns**: `Some(Record)` if found, `None` otherwise.

- **`get_pending_service_types() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.pending` anchor.
  - **Access Control**: Admin only.
  - **Returns**: A vector of `Record`s.

  - **`get_approved_service_types() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.approved` anchor.
  - **Access Control**: Public (essential for UI selectors, general browsing).
  - **Returns**: A vector of `Record`s.

  - **`get_rejected_service_types() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.rejected` anchor.
  - **Access Control**: Admin only.
  - **Returns**: A vector of `Record`s.

  - **`get_all_service_types_admin() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all `ServiceType` entries regardless of status (combines pending, approved, rejected, or fetches all known entries).
  - **Access Control**: Admin only.
  - **Returns**: A vector of `Record`s.

#### Technical Classification Functions

- **`get_technical_service_types() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all _approved_ `ServiceType` entries that are classified as technical.
  - **Access Control**: Public.
  - **Returns**: A vector of `Record`s.

- **`get_non_technical_service_types() -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all _approved_ `ServiceType` entries that are classified as non-technical.
  - **Access Control**: Public.
  - **Returns**: A vector of `Record`s.

- **`get_service_types_by_classification(technical: bool) -> ExternResult<Vec<Record>>`**
  - **Description**: Retrieves all _approved_ `ServiceType` entries filtered by technical classification.
  - **Access Control**: Public.
  - **Returns**: A vector of `Record`s.

- **`get_classification_statistics() -> ExternResult<(u32, u32)>`**
  - **Description**: Returns count statistics for technical vs non-technical service types.
  - **Access Control**: Public.
  - **Returns**: A tuple containing (technical_count, non_technical_count).

**REMOVED FUNCTIONS :**

- ~~`get_service_types_by_tag`~~ - Tags functionality completely removed
- ~~`get_service_types_by_tags`~~ - Tags functionality completely removed
- ~~`search_service_types_by_tag_prefix`~~ - Tags functionality completely removed
- ~~`get_tag_statistics`~~ - Tags functionality completely removed
- ~~`get_all_service_type_tags`~~ - Tags functionality completely removed

#### Cross-Entity Discovery Functions

- **`get_requests_by_classification(technical: bool) -> ExternResult<Vec<Record>>`** (NEW)
  - **Description**: Discovers requests associated with service types that match the technical classification.
  - **Implementation**: Calls `get_service_types_by_classification` then finds all requests linked to those service types.
  - **Access Control**: Public.
  - **Returns**: A vector of Request `Record`s.

- **`get_offers_by_classification(technical: bool) -> ExternResult<Vec<Record>>`** (NEW)
  - **Description**: Discovers offers associated with service types that match the technical classification.
  - **Implementation**: Calls `get_service_types_by_classification` then finds all offers linked to those service types.
  - **Access Control**: Public.
  - **Returns**: A vector of Offer `Record`s.

**REMOVED FUNCTIONS :**

- ~~`get_requests_by_tag`~~ - Tags functionality completely removed
- ~~`get_offers_by_tag`~~ - Tags functionality completely removed

### 3.3. Cross-Zome Interactions

- **Called by `requests_coordinator` and `offers_coordinator`:**
  - To validate that `ServiceType` ActionHashes provided during `Request`/`Offer` creation/update correspond to _approved_ `ServiceType`s. This is typically done by calling `get_service_type` and then checking its linkage to the `service_types.status.approved` anchor, or by ensuring the `ActionHash` is part of the list returned by `get_approved_service_types`.

- **Calls to `requests_coordinator` and `offers_coordinator`:**
  - During `reject_service_type` or `admin_delete_service_type`, cross-zome calls are made to clean up links from existing `Request` and `Offer` entries that referenced the affected `ServiceType`.
  - Tag-based discovery functions coordinate with both coordinators to provide cross-entity discovery.

## 4. Testing Status

### Backend Tests (Tryorama)

- ✅ Service type CRUD operations and status management
- ✅ Technical classification filtering and indexing
- ✅ Classification statistics and counting
- ✅ Cross-entity discovery by technical classification
- ✅ Admin workflow (suggest, approve, reject)
- ✅ Permission validation and access control

### Frontend Integration

- ✅ **Effect-TS Service Layer**: Complete with all zome functions exposed
- ✅ **Reactive Svelte Store**: Full state management with caching and event bus
- ✅ **UI Components**: Complete table layout implementation (ServiceTypesTable.svelte)
- ✅ **Technical Classification**: Filter and sort controls for technical vs non-technical
- ✅ **Admin Interface**: Table-based management replacing card layout
- ✅ **Cross-Store Integration**: Requests and offers stores enhanced with classification-based discovery
- ✅ **Test Coverage**: All unit tests passing (part of 268 total test suite)

## 5. Implementation Notes

### Performance Considerations

- Path anchor indexing provides efficient classification-based queries
- Table layout improves data density and scanning ability
- Caching implemented at service and store levels
- Lazy loading and pagination patterns available for large datasets

### Data Integrity

- Only approved service types can be linked to requests/offers
- Technical classification cleanup on service type deletion/rejection
- Cross-zome validation ensures consistency

### User Experience

- **Table Layout**: Improved data density and administrative efficiency
- **Technical Classification**: Clear filtering between technical and non-technical services
- **Responsive Design**: Table works correctly on mobile devices
- **Intuitive Admin Workflow**: Streamlined service type moderation interface
- **Performance**: Maintained good performance with table display
- **Accessibility**: Standards maintained in new table implementation

### UI/UX Improvements

- **Card to Table Conversion**: Enhanced administrative interface with better data scanning
- **Filter/Sort Controls**: Technical classification filtering for better organization
- **Mobile Responsiveness**: Table adapts correctly to different screen sizes
- **Action Integration**: Edit, delete, and view actions seamlessly integrated into table
