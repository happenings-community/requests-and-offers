## Holochain Development Patterns

This project uses Holochain as the backend framework with hREA integration. These patterns ensure consistency and reliability across all DNA and zome development.

### DNA Architecture Patterns

#### Domain-Based DNA Structure
```
dnas/
└── requests_and_offers/
    ├── zomes/
    │   ├── coordinator/          # Business logic and orchestration
    │   │   ├── requests/
    │   │   ├── offers/
    │   │   ├── service_types/
    │   │   └── ...
    │   └── integrity/           # Validation rules and constraints
    │       ├── requests_integrity/
    │       ├── offers_integrity/
    │       └── ...
    └── DNA.yaml                # DNA configuration
```

#### Zome Organization Standards
- **Coordinator Zomes**: Business logic, external API functions, orchestration
- **Integrity Zomes**: Validation rules, entry definitions, link constraints
- **One-to-One Mapping**: Each coordinator zome has corresponding integrity zome
- **Domain Separation**: Each business domain gets its own zome pair

### Entry Type Patterns

#### Structured Entry Definition
```rust
// Define entry structure with validation
// Note: Timestamps are NOT stored in the entry - they come from Action headers
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceType {
    pub name: String,
    pub description: Option<String>,
    pub status: ServiceTypeStatus,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ServiceTypeStatus {
    Pending,
    Approved,
    Rejected,
}

// Entry type definition with validation
entry_def!(ServiceType EntryDef {
    required_validations: [],
    required_permissions: [],
    fields: [
        name::<String>(Required),
        description::<String>(Optional),
        status::<ServiceTypeStatus>(Required)
    ]
});
```

#### Important: Holochain Timestamp and Relationship Handling

**Timestamps**:
- `created_at` and `updated_at` are **NOT stored in entry data**
- They are automatically provided by Holochain Action headers
- Access timestamps via `record.action().timestamp()` for creation time
- Update timestamps are handled by subsequent Action headers

**Relationships**:
- **Do NOT store foreign keys or relationship IDs in entry data**
- Use Holochain's built-in **link system** for all relationships
- Links provide referential integrity and efficient querying
- Relationships are maintained through `create_link()` and `get_links()`

#### Validation Functions Pattern
```rust
// Integrity zome validation
#[hdk_extern]
pub fn validate_create_entry_service_type(validate_data: ValidateCreateEntryData) -> ExternResult<ValidateCallbackResult> {
    let entry = match ServiceType::try_from(&validate_data.app_entry) {
        Ok(entry) => entry,
        Err(e) => return Ok(ValidateCallbackResult::Invalid(e.to_string())),
    };

    // Business logic validation
    if entry.name.is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Name cannot be empty".to_string()));
    }

    Ok(ValidateCallbackResult::Valid)
}
```

### Zome Function Patterns

#### Create Function Standard
```rust
// Coordinator zome create function
#[hdk_extern]
pub fn create_service_type(service_type: ServiceType) -> ExternResult<Record> {
    // Note: No timestamp handling needed in entry data
    // Holochain automatically provides timestamps in Action headers

    // Create entry (no manual timestamp creation)
    create_entry(&EntryTypesApp::ServiceType(service_type.clone()))?;

    // Create record - Holochain handles timestamps automatically
    let record = create_record(
        &Postulate {
            entry_type: EntryTypesApp::ServiceType,
            entry: service_type,
        }
    )?;

    Ok(record)
}
```

#### Accessing Timestamps from Action Headers
```rust
// Function to extract timestamps from record metadata
pub fn get_service_type_with_timestamps(record: Record) -> ExternResult<ServiceTypeWithTimestamps> {
    let service_type = ServiceType::try_from(record.entry().as_option()
        .ok_or("Entry not found")?)?;

    // Extract timestamps from Action headers instead of entry data
    let created_at = record.action().timestamp();

    // For updated_at, check if this is an update and get original timestamp
    let updated_at = match record.action() {
        Action::Update(update_action) => update_action.timestamp,
        _ => created_at, // For creates, updated_at = created_at
    };

    Ok(ServiceTypeWithTimestamps {
        service_type,
        created_at,
        updated_at,
        action_hash: record.signed_action.hashed.hash,
    })
}

// UI helper structure that includes timestamps
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeWithTimestamps {
    pub service_type: ServiceType,
    pub created_at: u64,
    pub updated_at: u64,
    pub action_hash: ActionHash,
}
```

#### Read Function Standard
```rust
#[hdk_extern]
pub fn get_service_type(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
    let record = get_latest_record(original_action_hash)?;
    Ok(record)
}
```

#### Update Function Standard
```rust
#[hdk_extern]
pub fn update_service_type(
    original_action_hash: ActionHash,
    previous_action_hash: ActionHash,
    updated_service_type: ServiceType,
) -> ExternResult<Record> {
    let updated_record = update_record(
        original_action_hash,
        previous_action_hash,
        &EntryTypesApp::ServiceType(updated_service_type),
    )?;

    Ok(updated_record)
}
```

#### Delete Function Standard
```rust
#[hdk_extern]
pub fn delete_service_type(original_action_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_record(original_action_hash)?;
    Ok(original_action_hash)
}
```

### Relationship Management Using Holochain Links

#### Why Links Instead of Foreign Keys?
- **Referential Integrity**: Links maintain consistency when entries are deleted
- **Efficient Querying**: Link-based queries are optimized for DHT performance
- **Temporal Awareness**: Links track when relationships were created
- **Bi-directional**: Links can be queried in both directions efficiently
- **Metadata Support**: Links can carry additional context about relationships

#### Link Creation Standard
```rust
#[hdk_extern]
pub fn link_service_type_to_request(
    service_type_hash: ActionHash,
    request_hash: ActionHash,
) -> ExternResult<()> {
    // Create link from service type to request
    create_link(
        service_type_hash,
        request_hash,
        &LinkTypes::ServiceTypeToRequest,
        LinkTag::new(()), // Empty tag for simple relationships
    )?;

    // Optional: Create reverse link for bi-directional querying
    create_link(
        request_hash,
        service_type_hash,
        &LinkTypes::RequestToServiceType,
        LinkTag::new(()),
    )?;

    Ok(())
}
```

#### Link with Metadata
```rust
#[hdk_extern]
pub fn link_user_to_organization(
    user_hash: ActionHash,
    organization_hash: ActionHash,
    role: String,
) -> ExternResult<()> {
    // Encode role information in link tag
    let role_tag = LinkTag::new(role.as_bytes().to_vec());

    create_link(
        user_hash,
        organization_hash,
        &LinkTypes::UserToOrganization,
        role_tag,
    )?;

    Ok(())
}
```

#### Link Querying Standard
```rust
#[hdk_extern]
pub fn get_requests_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<Record>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToRequest)?
            .build(),
    )?;

    let records: Result<Vec<_>, _> = links
        .into_iter()
        .filter_map(|link| get_latest_record(link.target).ok())
        .collect();

    Ok(records.unwrap_or_default())
}

#[hdk_extern]
pub fn get_users_for_organization_with_role(
    organization_hash: ActionHash,
    role_filter: Option<String>,
) -> ExternResult<Vec<(Record, String)>> {
    let links = get_links(
        GetLinksInputBuilder::try_new(organization_hash, LinkTypes::OrganizationToUser)?
            .build(),
    )?;

    let mut results = Vec::new();

    for link in links {
        // Extract role from link tag
        let role = String::from_utf8(link.tag.to_vec()).unwrap_or_default();

        // Apply role filter if provided
        if let Some(ref filter) = role_filter {
            if role != *filter {
                continue;
            }
        }

        // Get the user record
        if let Ok(Some(user_record)) = get_latest_record(link.target) {
            results.push((user_record, role));
        }
    }

    Ok(results)
}
```

#### Link Removal and Update
```rust
#[hdk_extern]
pub fn unlink_service_type_from_request(
    service_type_hash: ActionHash,
    request_hash: ActionHash,
) -> ExternResult<()> {
    // Get all links from service type to request
    let links = get_links(
        GetLinksInputBuilder::try_new(service_type_hash, LinkTypes::ServiceTypeToRequest)?
            .build(),
    )?;

    // Remove matching links
    for link in links {
        if link.target == request_hash {
            delete_link(link.create_link_hash)?;
        }
    }

    // Also remove reverse links
    let reverse_links = get_links(
        GetLinksInputBuilder::try_new(request_hash, LinkTypes::RequestToServiceType)?
            .build(),
    )?;

    for link in reverse_links {
        if link.target == service_type_hash {
            delete_link(link.create_link_hash)?;
        }
    }

    Ok(())
}
```

### Status Management Patterns

#### Status Workflow Implementation
```rust
// Status transition functions
#[hdk_extern]
pub fn suggest_service_type(service_type: ServiceType) -> ExternResult<Record> {
    let mut pending_service_type = service_type;
    pending_service_type.status = ServiceTypeStatus::Pending;

    create_service_type_internal(pending_service_type)
}

#[hdk_extern]
pub fn approve_service_type(service_type_hash: ActionHash) -> ExternResult<()> {
    update_service_type_status(service_type_hash, ServiceTypeStatus::Approved)
}

#[hdk_extern]
pub fn reject_service_type(service_type_hash: ActionHash) -> ExternResult<()> {
    update_service_type_status(service_type_hash, ServiceTypeStatus::Rejected)
}

// Internal status update helper
fn update_service_type_status(
    action_hash: ActionHash,
    new_status: ServiceTypeStatus
) -> ExternResult<()> {
    let record = get_latest_record(action_hash)?;
    let entry = record.entry().as_option().ok_or("Record not found")?;

    if let EntryTypesApp::ServiceType(mut service_type) = ServiceType::try_from(entry)? {
        service_type.status = new_status;

        update_record(
            action_hash,
            record.signed_action.hashed.hash,
            &EntryTypesApp::ServiceType(service_type),
        )?;
    }

    Ok(())
}
```

### Error Handling Patterns

#### Consistent Error Types
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ServiceTypeError {
    EntryNotFound(String),
    ValidationError(String),
    UnauthorizedAccess(String),
    SerializationError(String),
}

impl std::fmt::Display for ServiceTypeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServiceTypeError::EntryNotFound(msg) => write!(f, "Entry not found: {}", msg),
            ServiceTypeError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            ServiceTypeError::UnauthorizedAccess(msg) => write!(f, "Unauthorized access: {}", msg),
            ServiceTypeError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
        }
    }
}
```

#### Error Propagation Pattern
```rust
pub fn create_service_type_with_validation(service_type: ServiceType) -> ExternResult<Record> {
    // Validate input
    if service_type.name.is_empty() {
        return Err(WasmError::Guest(ServiceTypeError::ValidationError(
            "Service type name cannot be empty".to_string()
        ).into()));
    }

    // Attempt creation with proper error handling
    match create_service_type(service_type) {
        Ok(record) => Ok(record),
        Err(e) => Err(WasmError::Guest(ServiceTypeError::ValidationError(
            format!("Failed to create service type: {}", e)
        ).into())),
    }
}
```

### hREA Integration Patterns

#### Economic Resource Modeling
```rust
use hdk::prelude::*;
use holo_hash::*;
use hrea_entities::*;

// Integration with hREA economic events
#[hdk_extern]
pub fn create_service_as_economic_resource(
    service_type: ServiceType,
    resource_specification_hash: ActionHash,
) -> ExternResult<Record> {
    // Create service type entry
    let service_record = create_service_type(service_type)?;

    // Link to hREA resource specification
    create_link(
        service_record.signed_action.hashed.hash,
        resource_specification_hash,
        &LinkTypes::ServiceTypeToResourceSpec,
        "resource_spec".into(),
    )?;

    Ok(service_record)
}
```

### Testing Patterns

#### Tryorama Test Structure
```typescript
import { AppAgent, AgentPubKey, Record, ActionHash } from '@holochain/tryorama';
import { ServiceType, createServiceType, getServiceType } from '../../dnas/requests_and_offers/zomes/coordinator/service_types';

export async function testServiceTypeCreation() {
  const alice = await AppAgent.fromAgent(
    new AgentPubKey('alice_agent'),
    'requests_and_offers.happ'
  );

  // Note: No created_at field needed - Holochain handles timestamps
  const serviceType: ServiceType = {
    name: 'Test Service',
    description: 'A test service type',
    status: 'Approved'
  };

  const record = await alice.callZome({
    zome_name: 'service_types',
    fn_name: 'create_service_type',
    payload: serviceType,
  });

  expect(record).toBeDefined();
  expect(record.entry.type).toBe('ServiceType');

  // Verify retrieval with timestamp extraction
  const retrieved = await alice.callZome({
    zome_name: 'service_types',
    fn_name: 'get_service_type_with_timestamps',
    payload: record.signed_action.hashed.hash,
  });

  expect(retrieved.entry.type).toBe('ServiceType');
  expect(retrieved.created_at).toBeDefined();
  expect(retrieved.updated_at).toBeDefined();
}

export async function testLinkBasedRelationships() {
  const alice = await AppAgent.fromAgent(
    new AgentPubKey('alice_agent'),
    'requests_and_offers.happ'
  );

  // Create service type
  const serviceTypeRecord = await alice.callZome({
    zome_name: 'service_types',
    fn_name: 'create_service_type',
    payload: { name: 'Test Service', status: 'Approved' },
  });

  // Create request
  const requestRecord = await alice.callZome({
    zome_name: 'requests',
    fn_name: 'create_request',
    payload: { title: 'Test Request', description: 'A test request' },
  });

  // Link them together (instead of storing foreign keys)
  await alice.callZome({
    zome_name: 'requests',
    fn_name: 'link_request_to_service_type',
    payload: {
      request_hash: requestRecord.signed_action.hashed.hash,
      service_type_hash: serviceTypeRecord.signed_action.hashed.hash,
    },
  });

  // Query through links
  const linkedRequests = await alice.callZome({
    zome_name: 'service_types',
    fn_name: 'get_requests_for_service_type',
    payload: serviceTypeRecord.signed_action.hashed.hash,
  });

  expect(linkedRequests).toHaveLength(1);
  expect(linkedRequests[0].entry.type).toBe('Request');
}
```

### Performance Considerations

#### Efficient Querying
- Use link queries for relationships instead of scanning all entries
- Implement pagination for large datasets
- Cache frequently accessed data using link-based indexes
- Batch operations where possible to reduce DHT calls

#### DHT Optimization
- Structure entry types for efficient querying
- Use appropriate link types and tags for relationships
- Consider access patterns when designing entry structures
- Minimize data transfer in remote calls

### Development Workflow

#### Local Development
```bash
# Use Nix environment for zome compilation
nix develop

# Build zomes
bun run build:zomes

# Run with multiple agents for testing
AGENTS=3 bun start
```

#### Testing Workflow
```bash
# Run backend tests
bun test:service-types

# Run all tests with zome build
bun test

# Test specific scenarios
bun test:service-types:status
```

These patterns ensure consistency, reliability, and maintainability across all Holochain development in the project.
