# Backend Link Types API

Complete reference for all Holochain link types and relationship patterns.

## Link Type Architecture

Link types define relationships between entries and enable efficient querying and indexing.

### Standard Link Pattern

```rust
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllEntities,           // Path -> Entity (for listing all entities)
    EntityToRelated,       // Entity -> Related Entity
    TagToEntity,           // Tag Path -> Entity (for tag-based search)
}
```

## Service Types Link Types

**File**: `dnas/requests_and_offers/zomes/integrity/service_types/src/lib.rs`

### Link Types

```rust
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllServiceTypes,              // Path("all_service_types") -> ServiceType
    ServiceTypeToTag,             // ServiceType -> Tag Path
    TagToServiceType,             // Tag Path -> ServiceType
    ApprovedServiceTypes,         // Path("approved_service_types") -> ServiceType
    PendingServiceTypes,          // Path("pending_service_types") -> ServiceType
    RejectedServiceTypes,         // Path("rejected_service_types") -> ServiceType
}
```

### Link Usage Patterns

#### All Service Types Index

```rust
// Create link when service type is created
let path = Path::from("all_service_types");
create_link(
    path.path_entry_hash()?,
    service_type_hash.clone(),
    LinkTypes::AllServiceTypes,
    ()
)?;

// Query all service types
let path = Path::from("all_service_types");
let links = get_links(path.path_entry_hash()?, LinkTypes::AllServiceTypes, None)?;
```

#### Tag-Based Indexing

```rust
// Create tag links for each tag
for tag in &service_type.tags {
    let tag_path = Path::from(format!("tag.{}", tag));
    create_link(
        tag_path.path_entry_hash()?,
        service_type_hash.clone(),
        LinkTypes::TagToServiceType,
        ()
    )?;
}

// Query by tag
let tag_path = Path::from(format!("tag.{}", search_tag));
let links = get_links(tag_path.path_entry_hash()?, LinkTypes::TagToServiceType, None)?;
```

#### Status-Based Indexing

```rust
// Create status-specific links
match service_type.status {
    ServiceTypeStatus::Approved => {
        let path = Path::from("approved_service_types");
        create_link(path.path_entry_hash()?, service_type_hash, LinkTypes::ApprovedServiceTypes, ())?;
    },
    ServiceTypeStatus::Pending => {
        let path = Path::from("pending_service_types");
        create_link(path.path_entry_hash()?, service_type_hash, LinkTypes::PendingServiceTypes, ())?;
    },
    ServiceTypeStatus::Rejected => {
        let path = Path::from("rejected_service_types");
        create_link(path.path_entry_hash()?, service_type_hash, LinkTypes::RejectedServiceTypes, ())?;
    }
}
```

## Requests Link Types

**File**: `dnas/requests_and_offers/zomes/integrity/requests/src/lib.rs`

### Link Types

```rust
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllRequests,                  // Path("all_requests") -> Request
    RequestToServiceType,         // Request -> ServiceType
    ServiceTypeToRequest,         // ServiceType -> Request
    UserToRequest,                // UserProfile -> Request
    RequestToUser,                // Request -> UserProfile
    OpenRequests,                 // Path("open_requests") -> Request
    InProgressRequests,           // Path("in_progress_requests") -> Request
    FulfilledRequests,            // Path("fulfilled_requests") -> Request
    ClosedRequests,               // Path("closed_requests") -> Request
    UrgencyToRequest,             // Path("urgency.{level}") -> Request
}
```

### Usage Examples

#### Service Type Relationships

```rust
// Link request to service type
create_link(
    request_hash.clone(),
    service_type_hash.clone(),
    LinkTypes::RequestToServiceType,
    ()
)?;

// Reverse link for querying requests by service type
create_link(
    service_type_hash.clone(),
    request_hash.clone(),
    LinkTypes::ServiceTypeToRequest,
    ()
)?;
```

#### User Ownership

```rust
// Link user to their requests
create_link(
    user_profile_hash.clone(),
    request_hash.clone(),
    LinkTypes::UserToRequest,
    ()
)?;
```

#### Status and Urgency Indexing

```rust
// Status-based indexing
let status_path = Path::from(format!("{:?}_requests", request.status).to_lowercase());
create_link(status_path.path_entry_hash()?, request_hash.clone(), /* appropriate LinkType */, ())?;

// Urgency-based indexing
let urgency_path = Path::from(format!("urgency.{:?}", request.urgency).to_lowercase());
create_link(urgency_path.path_entry_hash()?, request_hash.clone(), LinkTypes::UrgencyToRequest, ())?;
```

## Offers Link Types

**File**: `dnas/requests_and_offers/zomes/integrity/offers/src/lib.rs`

### Link Types

```rust
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllOffers,                    // Path("all_offers") -> Offer
    OfferToServiceType,           // Offer -> ServiceType
    ServiceTypeToOffer,           // ServiceType -> Offer
    UserToOffer,                  // UserProfile -> Offer
    OfferToUser,                  // Offer -> UserProfile
    AvailableOffers,              // Path("available_offers") -> Offer
    AcceptedOffers,               // Path("accepted_offers") -> Offer
    CompletedOffers,              // Path("completed_offers") -> Offer
    ClosedOffers,                 // Path("closed_offers") -> Offer
}
```

## Users Link Types

**File**: `dnas/requests_and_offers/zomes/integrity/users/src/lib.rs`

### Link Types

```rust
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllUsers,                     // Path("all_users") -> UserProfile
    AgentToProfile,               // AgentPubKey -> UserProfile
    ProfileToAgent,               // UserProfile -> AgentPubKey
    SkillToUser,                  // Path("skill.{name}") -> UserProfile
    UserToSkill,                  // UserProfile -> Path("skill.{name}")
    LocationToUser,               // Path("location.{name}") -> UserProfile
}
```

### User Indexing Patterns

#### Agent-Profile Mapping

```rust
// Map agent to their profile
create_link(
    agent_hash.clone().into(),
    profile_hash.clone(),
    LinkTypes::AgentToProfile,
    ()
)?;

// Reverse mapping
create_link(
    profile_hash.clone(),
    agent_hash.clone().into(),
    LinkTypes::ProfileToAgent,
    ()
)?;
```

#### Skill-Based Discovery

```rust
// Create skill links
for skill in &user_profile.skills {
    let skill_path = Path::from(format!("skill.{}", skill.to_lowercase()));
    create_link(
        skill_path.path_entry_hash()?,
        profile_hash.clone(),
        LinkTypes::SkillToUser,
        ()
    )?;
}
```

## Organizations Link Types

**File**: `dnas/requests_and_offers/zomes/integrity/organizations/src/lib.rs`

### Link Types

```rust
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AllOrganizations,             // Path("all_organizations") -> Organization
    OrganizationToMember,         // Organization -> UserProfile
    MemberToOrganization,         // UserProfile -> Organization
    TypeToOrganization,           // Path("type.{org_type}") -> Organization
    LocationToOrganization,       // Path("location.{location}") -> Organization
}
```

### Organization Membership

```rust
// Add member to organization
create_link(
    organization_hash.clone(),
    user_profile_hash.clone(),
    LinkTypes::OrganizationToMember,
    ()
)?;

// Reverse link for user's organizations
create_link(
    user_profile_hash.clone(),
    organization_hash.clone(),
    LinkTypes::MemberToOrganization,
    ()
)?;
```

## Administration Link Types

**File**: `dnas/requests_and_offers/zomes/integrity/administration/src/lib.rs`

### Link Types

```rust
#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
    AdminsAnchor,                 // Path("admins") -> AdminRole
    ModeratorsAnchor,             // Path("moderators") -> AdminRole
    SuspensionsAnchor,            // Path("suspensions") -> UserSuspension
    AgentToSuspension,            // AgentPubKey -> UserSuspension
}
```

### Administrative Indexing

```rust
// Add admin role to index
let admins_path = Path::from("admins");
create_link(
    admins_path.path_entry_hash()?,
    admin_role_hash,
    LinkTypes::AdminsAnchor,
    ()
)?;

// Link agent to suspension
create_link(
    suspended_agent.clone().into(),
    suspension_hash,
    LinkTypes::AgentToSuspension,
    ()
)?;
```

## Link Validation

### Link Creation Validation

```rust
pub fn validate_create_link(
    action: CreateLink,
    base_address: AnyLinkableHash,
    target_address: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    match action.link_type {
        LinkTypes::AllServiceTypes => {
            // Validate that base is the correct path
            // Validate that target is a ServiceType entry
            Ok(ValidateCallbackResult::Valid)
        },
        LinkTypes::TagToServiceType => {
            // Validate tag path format
            // Validate service type exists
            Ok(ValidateCallbackResult::Valid)
        },
        _ => Ok(ValidateCallbackResult::Valid),
    }
}
```

### Link Deletion Validation

```rust
pub fn validate_delete_link(
    action: DeleteLink,
    original_action: CreateLink,
    base: AnyLinkableHash,
    target: AnyLinkableHash,
    tag: LinkTag,
) -> ExternResult<ValidateCallbackResult> {
    // Validate that agent has permission to delete this link
    // Check if link deletion is allowed for this link type
    Ok(ValidateCallbackResult::Valid)
}
```

## Query Patterns

### Efficient Queries

```rust
// Get all entities of a type
pub fn get_all_service_types() -> ExternResult<Vec<Record>> {
    let path = Path::from("all_service_types");
    let links = get_links(path.path_entry_hash()?, LinkTypes::AllServiceTypes, None)?;

    let get_input: Vec<GetInput> = links
        .into_iter()
        .map(|link| GetInput::new(
            ActionHash::from(link.target).into(),
            GetOptions::default(),
        ))
        .collect();

    let records = HDK.with(|hdk| hdk.borrow().get(get_input))?;
    let records: Vec<Record> = records.into_iter().filter_map(|r| r).collect();

    Ok(records)
}

// Get entities by tag
pub fn get_service_types_by_tag(tag: String) -> ExternResult<Vec<Record>> {
    let tag_path = Path::from(format!("tag.{}", tag));
    let links = get_links(tag_path.path_entry_hash()?, LinkTypes::TagToServiceType, None)?;

    // Convert links to records (same pattern as above)
    // ...
}
```

## Performance Considerations

### Indexing Strategy

- Create multiple indexes for different query patterns
- Use hierarchical paths for efficient filtering
- Balance between query performance and storage overhead

### Link Management

- Clean up orphaned links when entries are deleted
- Use link tags for additional metadata when needed
- Consider link direction for optimal query patterns

This link type reference provides the complete relationship structure for the Holochain application, enabling efficient querying and data discovery.
