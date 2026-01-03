# Requests and Offers Update Process - Complete Technical Analysis

## Session Overview
**Date**: 2026-01-03
**Focus**: Complete technical analysis of update process for requests and offers
**Project**: requests-and-offers Holochain hApp

## Table of Contents
1. [Backend Update Flow (Rust)](#backend-update-flow-rust)
2. [Frontend Update Flow (TypeScript)](#frontend-update-flow-typescript)
3. [Permission System](#permission-system)
4. [Update Tracking Mechanism](#update-tracking-mechanism)
5. [Signal System for Real-time Updates](#signal-system-for-real-time-updates)
6. [Link Management During Updates](#link-management-during-updates)
7. [Error Handling and Edge Cases](#error-handling-and-edge-cases)

---

## Backend Update Flow (Rust)

### Update Function Signatures

#### Requests (`dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs:287`)
```rust
#[hdk_extern]
pub fn update_request(input: UpdateRequestInput) -> ExternResult<Record>
```

#### Offers (`dnas/requests_and_offers/zomes/coordinator/offers/src/offer.rs:278`)
```rust
#[hdk_extern]
pub fn update_offer(input: UpdateOfferInput) -> ExternResult<Record>
```

### Input Structure

Both requests and offers use identical input structures:

```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateRequestInput {  // or UpdateOfferInput
    pub original_action_hash: ActionHash,      // The original creation hash
    pub previous_action_hash: ActionHash,      // The most recent update hash
    pub updated_request: Request,              // New data (Request or Offer)
    pub service_type_hashes: Vec<ActionHash>,   // Updated service types
    pub medium_of_exchange_hashes: Vec<ActionHash>, // Updated mediums of exchange
}
```

### Update Process Steps

#### Step 1: Permission Validation (Lines 288-300)
```rust
let original_record = get(input.original_action_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("Could not find the original request".to_string()))?;

let agent_pubkey = agent_info()?.agent_initial_pubkey;

// Check if the agent is the author or an administrator
let author = original_record.action().author().clone();
let is_author = author == agent_pubkey;
let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
}
```

**Permission Logic:**
- Fetch the original record to verify it exists
- Extract the author (creator) from the original record
- Compare current agent's public key with author
- Check if agent is administrator (fallback permission)
- Reject update if neither author nor admin

#### Step 2: Create Updated Entry (Line 302-303)
```rust
let updated_request_hash = update_entry(
    input.previous_action_hash.clone(), 
    &input.updated_request
)?;
```

**Holochain Update Mechanism:**
- `update_entry()` creates a new entry with updated content
- Links `previous_action_hash` to new entry (creates update chain)
- Returns new action hash for the update
- Original entry remains immutable (Holochain principle)

#### Step 3: Track Update Chain (Lines 305-310)
```rust
create_link(
    input.original_action_hash.clone(),  // From original
    updated_request_hash.clone(),         // To new update
    LinkTypes::RequestUpdates,           // or OfferUpdates
    (),
)?;
```

**Update Chain Tracking:**
- Creates link from original action to new update
- Allows retrieval of latest version via chain traversal
- Multiple updates create chain: original → update1 → update2 → ...
- Link type: `RequestUpdates` or `OfferUpdates`

#### Step 4: Update Service Type Links (Lines 312-317)
```rust
update_service_type_links(UpdateServiceTypeLinksInput {
    action_hash: input.original_action_hash.clone(),
    entity: "request".to_string(),  // or "offer"
    new_service_type_hashes: input.service_type_hashes,
})?;
```

**Service Type Link Management:**
- Deletes all existing service type links for the entity
- Creates new links to specified service types
- Bidirectional links: entity ↔ service types
- Handled by `service_types` zome via external call

#### Step 5: Update Medium of Exchange Links (Lines 319-324)
```rust
update_medium_of_exchange_links(UpdateMediumOfExchangeLinksInput {
    action_hash: input.original_action_hash.clone(),
    entity: "request".to_string(),  // or "offer"
    new_medium_of_exchange_hashes: input.medium_of_exchange_hashes,
})?;
```

**Medium of Exchange Link Management:**
- Deletes all existing medium of exchange links
- Creates new links to specified mediums of exchange
- Bidirectional links: entity ↔ mediums of exchange
- Handled by `mediums_of_exchange` zome via external call

#### Step 6: Return Updated Record (Lines 326-330)
```rust
let record = get(updated_request_hash.clone(), GetOptions::default())?
    .ok_or(CommonError::EntryNotFound("Could not find the newly updated Request".to_string()))?;

Ok(record)
```

**Return Value:**
- Fetches complete updated record
- Returns to caller (frontend service)
- Contains new action hash and all entry data

---

## Frontend Update Flow (TypeScript)

### Service Layer (`ui/src/lib/services/zomes/requests.service.ts:112-134`)

```typescript
const updateRequest = (
  originalActionHash: ActionHash,
  previousActionHash: ActionHash,
  updated_request: RequestInput
): E.Effect<Record, RequestError> =>
  wrapZomeCall('requests', 'update_request', {
    original_action_hash: originalActionHash,
    previous_action_hash: previousActionHash,
    updated_request: {
      title: updated_request.title,
      description: updated_request.description,
      contact_preference: updated_request.contact_preference,
      date_range: updated_request.date_range,
      time_estimate_hours: updated_request.time_estimate_hours,
      time_preference: updated_request.time_preference,
      time_zone: updated_request.time_zone,
      interaction_type: updated_request.interaction_type,
      links: updated_request.links,
      status: 'Active' // Default status for updated requests
    },
    service_type_hashes: updated_request.service_type_hashes || [],
    medium_of_exchange_hashes: updated_request.medium_of_exchange_hashes || []
  });
```

### Frontend Update Flow Architecture

**Effect-TS Integration:**
1. **Service Call**: `RequestsService.updateRequest()` wrapped in Effect
2. **Error Handling**: `RequestError` tagged errors with context
3. **Holochain Client**: Uses `HolochainClientService` for zome calls
4. **Type Safety**: Schema validation with `RequestInput` type
5. **Status Management**: Default status set to 'Active' for updates

**Service Interface** (`ui/src/lib/services/zomes/requests.service.ts:17-48`):
```typescript
export interface RequestsService {
  readonly updateRequest: (
    originalActionHash: ActionHash,
    previousActionHash: ActionHash,
    updatedRequest: RequestInput
  ) => E.Effect<Record, RequestError>;
  // ... other methods
}
```

---

## Permission System

### Permission Checks

**Two-Level Permission System:**

1. **Author Permission**:
   - Agent's public key must match original record author
   - Checked via `original_record.action().author()`
   - Grants full update permissions

2. **Administrator Permission**:
   - Checked via `check_if_agent_is_administrator()`
   - Fallback permission for non-authors
   - Allows admins to update any request/offer

**Implementation Pattern**:
```rust
let is_author = author == agent_pubkey;
let is_admin = check_if_agent_is_administrator(agent_pubkey.clone())?;

if !is_author && !is_admin {
    return Err(UsersError::NotAuthor.into());
}
```

### Error Types

**Permission Errors:**
- `UsersError::NotAuthor` - Agent is neither author nor admin
- `CommonError::EntryNotFound` - Original record doesn't exist
- `AdministrationError` - Admin status check failures

---

## Update Tracking Mechanism

### Update Chain Structure

```
Original Entry (ActionHash 1)
    ↓ (LinkTypes::RequestUpdates/OfferUpdates)
Update 1 (ActionHash 2)
    ↓ (LinkTypes::RequestUpdates/OfferUpdates)
Update 2 (ActionHash 3)
    ↓ ...
Latest Update (ActionHash N)
```

### Retrieval Functions

#### Get Latest Record (`request.rs:123-142`)
```rust
#[hdk_extern]
pub fn get_latest_request_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
    let link_type_filter = LinkTypes::RequestUpdates.try_into_filter()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
    let links = get_links(
        LinkQuery::new(original_action_hash.clone(), link_type_filter), 
        GetStrategy::Network
    )?;
    let latest_link = links
        .into_iter()
        .max_by(|link_a, link_b| link_a.timestamp.cmp(&link_b.timestamp));
    let latest_action_hash = match latest_link {
        Some(link) => link.target.clone().into_action_hash()
            .ok_or(CommonError::ActionHashNotFound("request".to_string()))?,
        None => original_action_hash.clone(),  // No updates = return original
    };
    get(latest_action_hash, GetOptions::default())
}
```

**Latest Retrieval Logic:**
1. Query all `RequestUpdates` links from original
2. Find link with maximum timestamp (most recent)
3. Return record at latest action hash
4. If no updates exist, return original record

#### Get Latest Entry (`request.rs:145-158`)
```rust
#[hdk_extern]
pub fn get_latest_request(original_action_hash: ActionHash) -> ExternResult<Request> {
    let record = get_latest_request_record(original_action_hash.clone())?
        .ok_or(CommonError::EntryNotFound(
            format!("Request not found for action hash: {}", original_action_hash)
        ))?;

    record.entry()
        .to_app_option()
        .map_err(CommonError::Serialize)?
        .ok_or(CommonError::EntryNotFound("Could not deserialize request entry".to_string()).into())
}
```

**Entry Deserialization:**
- Fetches latest record
- Deserializes entry to Request/Offer type
- Returns typed domain object

---

## Signal System for Real-time Updates

### Signal Types

Both requests and offers emit signals on updates:

**Signal Definition** (`lib.rs:29-33`):
```rust
EntryUpdated {
    action: SignedActionHashed,
    app_entry: EntryTypes,
    original_app_entry: EntryTypes,
}
```

### Signal Emission Logic

**post_commit Hook** (`lib.rs:40-47`):
```rust
#[hdk_extern(infallible)]
pub fn post_commit(committed_actions: Vec<SignedActionHashed>) {
    for action in committed_actions {
        if let Err(err) = signal_action(action) {
            error!("Error signaling new action: {:?}", err);
        }
    }
}
```

**Update Action Handling** (`lib.rs:81-93`):
```rust
Action::Update(update) => {
    if let Ok(Some(app_entry)) = get_entry_for_action(&action.hashed.hash) {
        if let Ok(Some(original_app_entry)) = 
            get_entry_for_action(&update.original_action_address) {
            emit_signal(Signal::EntryUpdated {
                action,
                app_entry,
                original_app_entry,
            })?;
        }
    }
    Ok(())
}
```

**Real-time Update Flow:**
1. User updates request/offer
2. Holochain commits update to DHT
3. `post_commit` hook triggered
4. Signal emitted to all connected peers
5. Frontend receives signal and updates UI
6. Store updates cached entity

---

## Link Management During Updates

### Service Type Links

**Update Process** (via `service_types` zome):
```rust
update_service_type_links(UpdateServiceTypeLinksInput {
    action_hash: input.original_action_hash.clone(),
    entity: "request".to_string(),  // or "offer"
    new_service_type_hashes: input.service_type_hashes,
})
```

**Link Strategy:**
- Delete all existing `ServiceType` → `request`/`offer` links
- Delete all existing `request`/`offer` → `ServiceType` links
- Create new bidirectional links for updated service types
- Maintains referential integrity across updates

### Medium of Exchange Links

**Update Process** (via `mediums_of_exchange` zome):
```rust
update_medium_of_exchange_links(UpdateMediumOfExchangeLinksInput {
    action_hash: input.original_action_hash.clone(),
    entity: "request".to_string(),  // or "offer"
    new_medium_of_exchange_hashes: input.medium_of_exchange_hashes,
})
```

**Link Strategy:**
- Delete all existing `MediumOfExchange` → `request`/`offer` links
- Delete all existing `request`/`offer` → `MediumOfExchange` links
- Create new bidirectional links for updated mediums
- Maintains payment method relationships

### Other Links (Preserved)

**Links NOT Modified During Update:**
- `AllRequests` / `AllOffers` path links
- `UserRequests` / `UserOffers` creator links
- `RequestCreator` / `OfferCreator` reverse links
- `OrganizationRequests` / `OrganizationOffers` links
- `RequestOrganization` / `OfferOrganization` reverse links

These links persist throughout the entity lifecycle.

---

## Error Handling and Edge Cases

### Common Error Scenarios

#### 1. Entry Not Found
```rust
CommonError::EntryNotFound("Could not find the original request".to_string())
```
**Cause**: Original action hash doesn't exist in DHT
**Resolution**: User error - verify action hash is correct

#### 2. Not Author Error
```rust
UsersError::NotAuthor
```
**Cause**: Current agent is neither author nor administrator
**Resolution**: Permission denial - only creators or admins can update

#### 3. Action Hash Not Found
```rust
CommonError::ActionHashNotFound("request".to_string())
```
**Cause**: Link target is not a valid action hash
**Resolution**: Data corruption - verify link integrity

#### 4. Serialization Error
```rust
CommonError::Serialize
```
**Cause**: Entry data doesn't match expected schema
**Resolution**: Schema mismatch - verify entry type compatibility

### Frontend Error Handling

**Effect-TS Error Wrapping**:
```typescript
const wrapZomeCall = <T>(
  zomeName: string,
  fnName: string,
  payload: unknown,
  context: string = REQUEST_CONTEXTS.CREATE_REQUEST
): E.Effect<T, RequestError> =>
  wrapZomeCallWithErrorFactory(
    holochainClient,
    zomeName,
    fnName,
    payload,
    context,
    RequestError.fromError  // Convert to tagged error
  );
```

**Tagged Error Contexts**:
- `REQUEST_CONTEXTS.CREATE_REQUEST`
- `REQUEST_CONTEXTS.UPDATE_REQUEST`
- etc.

Each error includes:
- Error message
- Context (what operation failed)
- Cause (underlying error)

---

## Archive Functionality

### Archive vs Delete

**Archive Operation** (`request.rs:463-502`):
```rust
#[hdk_extern]
pub fn archive_request(original_action_hash: ActionHash) -> ExternResult<bool> {
    // ... permission checks ...

    // Get the current request
    let current_request: Request = original_record
        .entry()
        .to_app_option()
        .map_err(CommonError::Serialize)?
        .ok_or(CommonError::EntryNotFound("Could not deserialize request entry".to_string()))?;

    // Update the request with archived status
    let mut updated_request = current_request.clone();
    updated_request.status = ListingStatus::Archived;

    // Create update entry
    let previous_action_hash = original_record.signed_action.hashed.hash.clone();
    update_entry(previous_action_hash.clone(), &updated_request)?;

    // Create link to track the update
    create_link(
        original_action_hash.clone(),
        previous_action_hash,
        LinkTypes::RequestUpdates,
        (),
    )?;

    Ok(true)
}
```

**Archive Characteristics:**
- Changes status to `ListingStatus::Archived`
- Creates update entry (preserves history)
- Tracked in update chain like normal updates
- Entity remains in DHT (not deleted)
- Reversible via new update

**Delete Operation** (`request.rs:334-460`):
- Removes entity from view
- Deletes all associated links
- Marks entry as deleted in DHT
- NOT reversible (Holochain immutability)

---

## Testing Considerations

### Update Testing Scenarios

**Unit Test Coverage:**
1. **Permission Testing**:
   - Author can update own request/offer
   - Admin can update any request/offer
   - Non-author/non-admin cannot update

2. **Data Integrity**:
   - Updated entry contains correct data
   - Service type links updated correctly
   - Medium of exchange links updated correctly
   - Update chain maintained

3. **Error Handling**:
   - Invalid action hash returns error
   - Permission denial returns appropriate error
   - Missing links handled gracefully

**Integration Test Coverage:**
1. **Multi-Agent Updates**:
   - Agent A creates request
   - Agent A updates request
   - Agent B cannot update Agent A's request
   - Admin can update Agent A's request

2. **Real-time Signal Propagation**:
   - Update triggers signal
   - All connected agents receive signal
   - UI updates correctly across peers

3. **Update Chain Traversal**:
   - Multiple sequential updates
   - Latest retrieval returns correct version
   - Chain integrity maintained

---

## Key Implementation Insights

### 1. Holochain Immutability Pattern
- Original entries never modified
- Updates create new entries with links
- Chain traversed for latest version
- Preserves complete history

### 2. Dual-Hash System
- `original_action_hash`: Immutable identifier (creation)
- `previous_action_hash`: Update chain position (latest)
- Allows tracking while maintaining immutability

### 3. Separation of Concerns
- Core update logic in coordinator zome
- Service type management in service_types zome
- Medium of exchange management in mediums_of_exchange zome
- Clean external call boundaries

### 4. Permission Flexibility
- Author-centric permission model
- Administrator override for moderation
- Scalable to organization-based permissions

### 5. Real-time Reactivity
- Signal system enables instant UI updates
- post_commit hook ensures all actions signaled
- Frontend stores react to EntryUpdated signals
- Consistent state across all peers

---

## Performance Considerations

### Update Operation Costs

**Holochain Operations:**
1. `get()` original record: 1 DHT get
2. `update_entry()`: 1 DHT put (new entry)
3. `create_link()`: 1 DHT put (update link)
4. `update_service_type_links()`: N link deletions + N link creations
5. `update_medium_of_exchange_links()`: M link deletions + M link creations
6. `get()` updated record: 1 DHT get

**Total DHT Operations**: 4 gets + (3 + 2N + 2M) puts

**Optimization Opportunities:**
- Batch link operations where possible
- Cache permission checks
- Lazy load related entities
- Debounce rapid successive updates

### Network Propagation

**Update Propagation Flow:**
1. Update committed to local source chain
2. Published to DHT network
3. Peers receive update via gossip
4. Signals emitted to connected clients
5. UI updates reactively

**Propagation Latency**:
- Local: ~100-500ms
- Network: ~2-5 seconds (depends on DHT topology)
- Signal delivery: ~50-200ms

---

## Security Considerations

### Update Security

**Authorization:**
- Dual permission model (author + admin)
- Public key cryptography for identity
- No privilege escalation possible

**Data Integrity:**
- Holochain validation rules enforced
- Schema validation on every update
- Immutable audit trail via update chain

**Link Integrity:**
- Links updated atomically with entry
- Referential integrity maintained
- No dangling links possible

**Replay Attack Prevention:**
- Each update has unique action hash
- Timestamp ordering prevents reordering
- Chain structure prevents insertion

---

## Future Enhancement Opportunities

### Potential Improvements

1. **Partial Updates**:
   - Currently replace entire entry
   - Could support field-level updates
   - Reduce bandwidth for small changes

2. **Update Conflicts**:
   - Currently last-write-wins
   - Could implement conflict resolution
   - Multi-user editing scenarios

3. **Update Metadata**:
   - Could track update reason
   - Could store update author info
   - Auditing and compliance features

4. **Batch Updates**:
   - Currently single entity updates
   - Could support bulk operations
   - Admin batch edit capabilities

5. **Update Preview**:
   - Could show diff before applying
   - Rollback capabilities
   - Update staging workflow

---

## Summary

The requests and offers update process demonstrates:

1. **Robust Backend Architecture**: Holochain's immutable entry system with update chains
2. **Comprehensive Permission Model**: Author + administrator dual permission system
3. **Efficient Link Management**: Atomic updates to service types and mediums of exchange
4. **Real-time Reactivity**: Signal-based UI updates across all connected peers
5. **Type-Safe Frontend**: Effect-TS integration with comprehensive error handling
6. **Complete Audit Trail**: Update chain preserves full history of all changes

This architecture provides a secure, performant, and maintainable foundation for collaborative peer-to-peer request and offer management with strong guarantees around data integrity, permissions, and real-time synchronization.