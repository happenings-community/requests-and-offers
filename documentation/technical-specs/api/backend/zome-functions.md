# Backend Zome Functions API

Complete reference for all Holochain zome functions across all domains.

## Zome Function Architecture

All zome functions follow consistent patterns for input validation, error handling, and return types.

### Standard Function Pattern

```rust
#[hdk_extern]
pub fn create_entity(input: CreateEntityInput) -> ExternResult<Record> {
    let entity_hash = create_entry(&EntryTypes::Entity(input.clone()))?;
    
    let record = get(entity_hash.clone(), GetOptions::default())?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Could not find the just created Entity"))))?;
        
    let path = Path::from("all_entities");
    create_link(path.path_entry_hash()?, entity_hash.clone(), LinkTypes::AllEntities, ())?;
    
    Ok(record)
}
```

## Service Types Zome

**DNA**: `requests_and_offers`  
**Zome**: `service_types`

### Functions

#### `create_service_type(input: CreateServiceTypeInput) -> ExternResult<Record>`
Creates a new service type with pending status.

**Input**:
```rust
pub struct CreateServiceTypeInput {
    pub name: String,
    pub description: String,
    pub tags: Vec<String>,
}
```

**Output**: Record containing the created service type entry

#### `get_all_service_types() -> ExternResult<Vec<Record>>`
Retrieves all service types from the DHT.

**Output**: Vector of all service type records

#### `get_service_type(service_type_hash: ActionHash) -> ExternResult<Option<Record>>`
Retrieves a specific service type by hash.

#### `approve_service_type(service_type_hash: ActionHash) -> ExternResult<Record>`
Updates service type status to approved.

#### `reject_service_type(service_type_hash: ActionHash) -> ExternResult<Record>`
Updates service type status to rejected.

#### `search_service_types_by_tag(tag: String) -> ExternResult<Vec<Record>>`
Searches service types by tag.

## Requests Zome

**DNA**: `requests_and_offers`  
**Zome**: `requests`

### Functions

#### `create_request(input: CreateRequestInput) -> ExternResult<Record>`
Creates a new request.

**Input**:
```rust
pub struct CreateRequestInput {
    pub title: String,
    pub description: String,
    pub service_type_hash: ActionHash,
    pub urgency: UrgencyLevel,
    pub time_preference: TimePreference,
    pub interaction_type: InteractionType,
}
```

#### `get_all_requests() -> ExternResult<Vec<Record>>`
Retrieves all requests.

#### `update_request(input: UpdateRequestInput) -> ExternResult<Record>`
Updates an existing request.

#### `fulfill_request(request_hash: ActionHash) -> ExternResult<Record>`
Marks a request as fulfilled.

#### `close_request(request_hash: ActionHash) -> ExternResult<Record>`
Closes a request.

## Offers Zome

**DNA**: `requests_and_offers`  
**Zome**: `offers`

### Functions

#### `create_offer(input: CreateOfferInput) -> ExternResult<Record>`
Creates a new offer.

#### `get_all_offers() -> ExternResult<Vec<Record>>`
Retrieves all offers.

#### `accept_offer(offer_hash: ActionHash) -> ExternResult<Record>`
Accepts an offer.

#### `close_offer(offer_hash: ActionHash) -> ExternResult<Record>`
Closes an offer.

## Users Zome

**DNA**: `requests_and_offers`  
**Zome**: `users`

### Functions

#### `create_user_profile(input: CreateUserProfileInput) -> ExternResult<Record>`
Creates a user profile.

#### `get_all_user_profiles() -> ExternResult<Vec<Record>>`
Retrieves all user profiles.

#### `get_user_profile(agent_hash: AgentPubKey) -> ExternResult<Option<Record>>`
Gets a specific user profile by agent hash.

#### `update_user_profile(input: UpdateUserProfileInput) -> ExternResult<Record>`
Updates a user profile.

## Organizations Zome

**DNA**: `requests_and_offers`  
**Zome**: `organizations`

### Functions

#### `create_organization(input: CreateOrganizationInput) -> ExternResult<Record>`
Creates a new organization.

#### `get_all_organizations() -> ExternResult<Vec<Record>>`
Retrieves all organizations.

#### `add_organization_member(input: AddMemberInput) -> ExternResult<()>`
Adds a member to an organization.

#### `remove_organization_member(input: RemoveMemberInput) -> ExternResult<()>`
Removes a member from an organization.

## Administration Zome

**DNA**: `requests_and_offers`  
**Zome**: `administration`

### Functions

#### `promote_to_admin(agent_hash: AgentPubKey) -> ExternResult<()>`
Promotes a user to administrator.

#### `demote_from_admin(agent_hash: AgentPubKey) -> ExternResult<()>`
Demotes an administrator.

#### `promote_to_moderator(agent_hash: AgentPubKey) -> ExternResult<()>`
Promotes a user to moderator.

#### `suspend_user(input: SuspendUserInput) -> ExternResult<()>`
Suspends a user with reason.

#### `get_all_admins() -> ExternResult<Vec<AgentPubKey>>`
Retrieves all administrators.

## Error Handling

All zome functions use consistent error handling patterns:

```rust
// Standard error pattern
pub fn example_function() -> ExternResult<Record> {
    let result = some_operation()
        .map_err(|e| wasm_error!(WasmErrorInner::Guest(format!("Operation failed: {}", e))))?;
    
    Ok(result)
}
```

## Validation Rules

### Input Validation
- All string inputs are validated for minimum length
- Required fields are checked for presence
- Enum values are validated against allowed options

### Entry Validation
- All entries must pass integrity validation
- References to other entries are verified
- Status transitions follow defined workflows

### Link Validation
- Link creation follows proper authorization
- Link targets are validated for existence
- Link types are checked for correctness

## Integration Points

### hREA Integration
Service types can be automatically mapped to hREA ResourceSpecifications when approved.

### Cross-Zome Communication
Zomes communicate through links and shared entry types for maintaining consistency.

This zome function reference provides the complete backend API for the Holochain application.