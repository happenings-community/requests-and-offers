# Service Types Zome (`service_types_integrity`, `service_types_coordinator`)

## 1. Overview

-   **Purpose**: Manages the lifecycle of `ServiceType` entries. These entries define the categories or types of services, skills, or resources that can be requested or offered within the application. This zome is crucial for classifying and discovering requests and offers.
-   **Status**: Full validation workflow, tag-based discovery, and cross-zome integration operational
-   **Validation Workflow**: Implements a moderation process for `ServiceType` entries, involving user suggestions, admin review, and approval/rejection states (`pending`, `approved`, `rejected`). Only `approved` service types can be actively used in new requests and offers.
-   **Tag-Based Discovery**: Comprehensive tagging system with path anchor indexing for efficient search, filtering, and cross-entity discovery
-   **Cross-Zome Integration**: Full integration with `requests_coordinator` and `offers_coordinator` for tag-based discovery
-   **Zome Structure**:
    -   `service_types_integrity`: Handles data validation, entry definitions, and link type rules.
    -   `service_types_coordinator`: Provides externally callable functions for business logic, interacting with the integrity zome and managing data flows.

## 2. Integrity Zome (`service_types_integrity`)

### 2.1. Entry Types

#### `ServiceType`

The `ServiceType` entry defines a specific type of service or skill.

```rust
#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct ServiceType {
    pub name: String,        // E.g., "Web Development", "Graphic Design", "Childcare"
    pub description: String, // A brief explanation of the service type
    pub tags: Vec<String>,   // Associated keywords for searchability, e.g., ["svelte", "rust", "holochain"]
    // pub category: Option<String>, // Optional: A broader category, e.g., "Technology", "Creative Arts"
                                  // Decision: Currently not implemented, tags provide flexibility.
}
```

### 2.2. Validation Rules

-   **`ServiceType` Entry:**
    -   `name`: Must not be empty. Max length (e.g., 100 chars) can be enforced.
    -   `description`: Must not be empty. Max length (e.g., 500 chars) can be enforced.
    -   `tags`: Vector can be empty. Individual tags should not be empty strings and could be normalized (e.g., lowercase, trimmed). Duplicate tags within the vector might be disallowed or ignored during processing.
-   **Updates/Deletes**: Standard Holochain author validation (original author or agent with specific capabilities can update/delete).

### 2.3. Link Types

-   **`ServiceTypeStatusAnchorToServiceType`**
    -   **Base**: `Path` anchor (e.g., `service_types.status.pending`).
    -   **Target**: `ActionHash` of a `ServiceType` entry.
    -   **Link Tag**: `ActionHash` of the `ServiceType` (for easy retrieval/deduplication) or a `Timestamp` for ordering.
    -   **Purpose**: Connects `ServiceType` entries to their current validation status (`pending`, `approved`, `rejected`).

-   **`TagAnchorToServiceType`**
    -   **Base**: `Path` anchor for a specific tag (e.g., `service_types.tags.programming`).
    -   **Target**: `ActionHash` of an *approved* `ServiceType` entry.
    -   **Link Tag**: `ActionHash` of the `ServiceType`.
    -   **Purpose**: Enables finding approved service types by specific tags.

-   **`AllTagsAnchorToTagString`**
    -   **Base**: `Path` anchor (e.g., `service_types.all_tags`).
    -   **Target**: Can be a lightweight entry representing the tag string or the tag string itself encoded in the link tag if direct string targets are not preferred.
    -   **Link Tag**: The unique `Tag String` (e.g., `b"programming"`).
    -   **Purpose**: Maintains a list of all unique tags currently associated with *approved* service types.

-   **(Implicit) `ServiceTypeUpdates`**
    -   Holochain automatically links original entry actions to their updates.

(Note: `RequestToServiceType` and `OfferToServiceType` links are defined in their respective zomes but are crucial for understanding how `ServiceTypes` are consumed. These links should only target *approved* `ServiceType` entries.)

## 3. Coordinator Zome (`service_types_coordinator`)

### 3.1. Path Anchors Used

-   **Status Anchors (Static Paths):**
    -   `service_types.status.pending`: For `ServiceType` entries awaiting admin review.
    -   `service_types.status.approved`: For `ServiceType` entries approved by an admin and usable in requests/offers.
    -   `service_types.status.rejected`: For `ServiceType` entries rejected by an admin.
-   **Tag Anchors (Dynamic Paths based on tag content):**
    -   `service_types.tags.{url_encoded_tag_string}`: (e.g., `service_types.tags.programming`) For indexing approved service types by individual tags.
-   **All Tags Anchor (Static Path):**
    -   `service_types.all_tags`: For listing all unique tags associated with approved service types.

### 3.2. Key Functions

Input/Output structs (e.g., `SuggestServiceTypeInput`) are defined in Rust for clarity.

#### User-Facing Functions

-   **`suggest_service_type(input: ServiceType) -> ExternResult<Record>`**
    -   **Description**: Allows any authenticated user to suggest a new `ServiceType`.
    -   **Actions**:
        1.  Creates a new `ServiceType` entry with the provided `name`, `description`, and `tags`.
        2.  Links the new `ServiceType` entry's `ActionHash` to the `service_types.status.pending` anchor.
    -   **Access Control**: Any valid, authenticated agent.
    -   **Returns**: The `Record` of the newly created `ServiceType` entry.

#### Admin-Facing Functions

(Admin role is determined by a separate mechanism, e.g., membership in an admin group or a capability grant.)

    -   **`admin_create_service_type(input: ServiceType) -> ExternResult<Record>`**
    -   **Description**: Allows an administrator to directly create and approve a `ServiceType`.
    -   **Actions**:
        1.  Creates a new `ServiceType` entry.
        2.  Links the `ServiceType`'s `ActionHash` to the `service_types.status.approved` anchor.
        3.  For each tag in `input.tags`:
            -   Links the `ServiceType`'s `ActionHash` from the corresponding `service_types.tags.{tag}` anchor.
            -   If the tag is new, links the tag string from the `service_types.all_tags` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: The `Record` of the newly created and approved `ServiceType` entry.

-   **`approve_service_type(service_type_ah: ActionHash) -> ExternResult<ActionHash>`**
    -   **Description**: Allows an administrator to approve a `ServiceType` that is currently `pending` (or `rejected`).
    -   **Actions**:
        1.  Validates that `service_type_ah` points to an existing `ServiceType` entry.
        2.  Removes any existing links from `service_types.status.pending` or `service_types.status.rejected` to `service_type_ah`.
        3.  Creates a link from `service_types.status.approved` to `service_type_ah`.
        4.  Fetches the `ServiceType` entry to get its tags.
        5.  For each tag:
            -   Links `service_type_ah` from the `service_types.tags.{tag}` anchor.
            -   If the tag is new (not yet in `all_tags`), links the tag string from the `service_types.all_tags` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: The `ActionHash` of the approved `ServiceType`.

-   **`reject_service_type(service_type_ah: ActionHash, reason: Option<String>) -> ExternResult<ActionHash>`**
    -   **Description**: Allows an administrator to reject a `ServiceType` (whether `pending` or `approved`).
    -   `reason` is optional and currently not stored directly on DHT, but could be logged or emitted as a signal.
    -   **Actions**:
        1.  Validates `service_type_ah`.
        2.  Removes links from `service_types.status.pending` or `service_types.status.approved` to `service_type_ah`.
        3.  Creates a link from `service_types.status.rejected` to `service_type_ah`.
        4.  If the `ServiceType` was previously approved:
            -   Fetches the `ServiceType` entry to get its tags.
            -   Removes links from `service_types.tags.{tag}` anchors to `service_type_ah` for all its tags.
            -   Checks if any tags are now orphaned; if so, removes them from `service_types.all_tags` anchor.
            -   **Crucially**: Triggers cross-zome calls or signals to `requests_coordinator` and `offers_coordinator` to handle cleanup of links from existing `Request` and `Offer` entries that referenced this `service_type_ah`. (Requires granted capabilities).
    -   **Access Control**: Admin only.
    -   **Returns**: The `ActionHash` of the rejected `ServiceType`.

-   **`admin_update_service_type(original_action_hash: ActionHash, updated_input: ServiceType) -> ExternResult<Record>`**
    -   **Description**: Allows an administrator to update an existing `ServiceType`.
    -   **Actions**:
        1.  Creates an update for the `ServiceType` entry pointed to by `original_action_hash`.
        2.  The status of the `ServiceType` (e.g., `approved`) is generally maintained unless explicitly changed by a separate call to `approve_service_type` or `reject_service_type`.
        3.  If the `ServiceType` is `approved`:
            -   Compares old and new tags.
            -   Removes links from tag anchors for any removed tags.
            -   Adds links to tag anchors for any new tags.
            -   Updates `all_tags` anchor if unique tags have changed.
    -   **Access Control**: Admin only.
    -   **Returns**: The `Record` of the updated `ServiceType` entry (new ActionHash, same EntryHash).

-   **`admin_delete_service_type(original_action_hash: ActionHash) -> ExternResult<ActionHash>`**
    -   **Description**: Allows an administrator to delete a `ServiceType` entry.
    -   **Actions**:
        1.  Creates a delete action for the entry identified by `original_action_hash`.
        2.  Removes all links from status anchors (`pending`, `approved`, `rejected`) to this `ServiceType`'s ActionHash(es).
        3.  If the `ServiceType` was `approved` or had tags associated while `pending`:
            -   Removes all links from `service_types.tags.{tag}` anchors.
            -   Updates `service_types.all_tags` anchor if unique tags have changed.
            -   Triggers cross-zome calls/signals for `Request`/`Offer` link cleanup if it was `approved`.
    -   **Access Control**: Admin only.
    -   **Returns**: The `ActionHash` of the delete action.

#### Getter Functions

-   **`get_service_type(service_type_ah: ActionHash) -> ExternResult<Option<Record>>`**
    -   **Description**: Retrieves a specific `ServiceType` entry by its `ActionHash`.
    -   **Access Control**: Public.
    -   **Returns**: `Some(Record)` if found, `None` otherwise.

-   **`get_pending_service_types() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.pending` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: A vector of `Record`s.

-   **`get_approved_service_types() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.approved` anchor.
    -   **Access Control**: Public (essential for UI selectors, general browsing).
    -   **Returns**: A vector of `Record`s.

-   **`get_rejected_service_types() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries currently linked to the `service_types.status.rejected` anchor.
    -   **Access Control**: Admin only.
    -   **Returns**: A vector of `Record`s.

-   **`get_all_service_types_admin() -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all `ServiceType` entries regardless of status (combines pending, approved, rejected, or fetches all known entries).
    -   **Access Control**: Admin only.
    -   **Returns**: A vector of `Record`s.

#### Tag-Based Discovery Functions

-   **`get_service_types_by_tag(tag: String) -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all *approved* `ServiceType` entries linked to a specific tag anchor (`service_types.tags.{tag}`).
    -   **Access Control**: Public.
    -   **Returns**: A vector of `Record`s.

-   **`get_service_types_by_tags(tags: Vec<String>) -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves all *approved* `ServiceType` entries that match ALL provided tags (AND logic).
    -   **Access Control**: Public.
    -   **Returns**: A vector of `Record`s representing the intersection of service types for all tags.

-   **`search_service_types_by_tag_prefix(prefix: String) -> ExternResult<Vec<Record>>`**
    -   **Description**: Retrieves service types with tags matching the provided prefix for autocomplete functionality.
    -   **Access Control**: Public.
    -   **Returns**: A vector of `Record`s.

-   **`get_tag_statistics() -> ExternResult<Vec<(String, u32)>>`**
    -   **Description**: Returns usage statistics for each tag (tag name and count of associated approved service types).
    -   **Access Control**: Public.
    -   **Returns**: A vector of tuples containing tag name and usage count.

-   **`get_all_service_type_tags() -> ExternResult<Vec<String>>`**
    -   **Description**: Retrieves all unique tag strings linked from the `service_types.all_tags` anchor.
    -   **Access Control**: Public.
    -   **Returns**: A vector of `String` tags.

#### Cross-Entity Discovery Functions

-   **`get_requests_by_tag(tag: String) -> ExternResult<Vec<Record>>`**
    -   **Description**: Discovers requests associated with service types that have the specified tag.
    -   **Implementation**: Calls `get_service_types_by_tag` then finds all requests linked to those service types.
    -   **Access Control**: Public.
    -   **Returns**: A vector of Request `Record`s.

-   **`get_offers_by_tag(tag: String) -> ExternResult<Vec<Record>>`**
    -   **Description**: Discovers offers associated with service types that have the specified tag.
    -   **Implementation**: Calls `get_service_types_by_tag` then finds all offers linked to those service types.
    -   **Access Control**: Public.
    -   **Returns**: A vector of Offer `Record`s.

### 3.3. Cross-Zome Interactions

-   **Called by `requests_coordinator` and `offers_coordinator`:**
    -   To validate that `ServiceType` ActionHashes provided during `Request`/`Offer` creation/update correspond to *approved* `ServiceType`s. This is typically done by calling `get_service_type` and then checking its linkage to the `service_types.status.approved` anchor, or by ensuring the `ActionHash` is part of the list returned by `get_approved_service_types`.

-   **Calls to `requests_coordinator` and `offers_coordinator`:**
    -   During `reject_service_type` or `admin_delete_service_type`, cross-zome calls are made to clean up links from existing `Request` and `Offer` entries that referenced the affected `ServiceType`.
    -   Tag-based discovery functions coordinate with both coordinators to provide cross-entity discovery.

## 4. Testing Status

### Backend Tests (Tryorama)
- ✅ Tag indexing and basic retrieval
- ✅ Multi-tag search with intersection logic  
- ✅ Tag prefix search for autocomplete
- ✅ Tag usage statistics
- ✅ Tag cleanup on service type deletion
- ✅ Tag functionality edge cases
- ✅ Request/Offer tag-based discovery

### Frontend Integration
- ✅ **Effect-TS Service Layer**: Complete with all zome functions exposed
- ✅ **Reactive Svelte Store**: Full state management with caching and event bus
- ✅ **UI Components**: Complete component suite for service type management and tag discovery
- ✅ **Cross-Store Integration**: Requests and offers stores enhanced with tag-based discovery methods
- ✅ **Test Coverage**: 17/17 service tests passing, full integration test coverage

## 5. Implementation Notes

### Performance Considerations
- Path anchor indexing provides efficient tag-based queries
- Caching implemented at service and store levels
- Lazy loading and pagination patterns available for large datasets

### Data Integrity
- Only approved service types can be linked to requests/offers
- Tag cleanup on service type deletion/rejection
- Cross-zome validation ensures consistency

### User Experience
- Intuitive admin workflow for service type moderation
- Tag autocomplete and discovery throughout application
- Clickable tags for easy navigation between related content
- Tag cloud visualization for popular discovery paths
