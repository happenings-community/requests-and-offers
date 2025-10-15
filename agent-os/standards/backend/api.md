## Holochain Zome API Standards and Conventions

This project uses Holochain zomes as the backend API rather than traditional REST endpoints. These patterns ensure consistency and reliability across all zome implementations.

### Zome Architecture Standards

#### Zome Organization
```
dnas/requests_and_offers/zomes/
├── coordinator/           # Business logic and external API
│   ├── service_types/     # Service type management zome
│   ├── requests/          # Request management zome
│   ├── offers/            # Offer management zome
│   └── users/             # User management zome
└── integrity/            # Validation rules and constraints
    ├── service_types_integrity/
    ├── requests_integrity/
    └── offers_integrity/
```

#### Function Naming Conventions
```rust
// ✅ Preferred: Clear, action-based names
fn create_service_type(service_type: ServiceType) -> ExternResult<Record>
fn get_service_type(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
fn update_service_type(original_action_hash: ActionHash, previous_action_hash: ActionHash, updated_service_type: ServiceType) -> ExternResult<Record>
fn delete_service_type(original_action_hash: ActionHash) -> ExternResult<()>
fn get_all_service_types() -> ExternResult<ServiceTypeResponse>

// ❌ Avoid: Unclear or inconsistent naming
fn service_type_create(data: ServiceType) -> ExternResult<Record>
fn get_service(service_hash: ActionHash) -> ExternResult<Option<Record>>
fn update_st(original: ActionHash, updated: ServiceType) -> ExternResult<Record>
```

### CRUD Operations Standards

#### Create Operations
```rust
#[hdk_extern]
pub fn create_service_type(service_type: ServiceType) -> ExternResult<Record> {
    // Validate input
    if service_type.name.is_empty() {
        return Err(WasmError::Guest("Service type name cannot be empty".to_string()));
    }

    // Auto-generate metadata
    let mut service_type_with_metadata = service_type;
    service_type_with_metadata.created_at = sys_time()?;

    // Create entry
    create_entry(&EntryTypesApp::ServiceType(service_type_with_metadata.clone()))?;

    // Create and return record
    let record = create_record(&Postulate {
        entry_type: EntryTypesApp::ServiceType,
        entry: service_type_with_metadata,
    })?;

    Ok(record)
}
```

#### Read Operations
```rust
#[hdk_extern]
pub fn get_service_type(original_action_hash: ActionHash) -> ExternResult<Option<Record>> {
    get_latest_record(original_action_hash)
}

#[hdk_extern]
pub fn get_all_service_types() -> ExternResult<ServiceTypeResponse> {
    // Get all links from root
    let links = get_links(GetLinksInputBuilder::try_new(
        EntryHash::from(dna_info()?.dna_hash),
        LinkTypes::AllServiceTypes
    )?.build())?;

    // Collect all records
    let service_types: Result<Vec<_>, _> = links
        .into_iter()
        .filter_map(|link| get_latest_record(link.target).ok())
        .collect();

    // Organize by status
    let mut response = ServiceTypeResponse::default();
    for record in service_types.unwrap_or_default() {
        if let Some(service_type) = record.entry().as_option() {
            if let Ok(parsed) = ServiceType::try_from(service_type) {
                match parsed.status {
                    ServiceTypeStatus::Pending => response.pending.push(record.clone()),
                    ServiceTypeStatus::Approved => response.approved.push(record.clone()),
                    ServiceTypeStatus::Rejected => response.rejected.push(record.clone()),
                }
            }
        }
    }

    Ok(response)
}
```

#### Update Operations
```rust
#[hdk_extern]
pub fn update_service_type(
    original_action_hash: ActionHash,
    previous_action_hash: ActionHash,
    updated_service_type: ServiceType,
) -> ExternResult<Record> {
    // Validate original exists
    let _original_record = get_latest_record(original_action_hash)?
        .ok_or("Original record not found")?;

    // Validate input
    if updated_service_type.name.is_empty() {
        return Err(WasmError::Guest("Service type name cannot be empty".to_string()));
    }

    // Update metadata
    let mut service_type_with_metadata = updated_service_type;
    service_type_with_metadata.updated_at = Some(sys_time()?);

    // Update entry
    let updated_record = update_record(
        original_action_hash,
        previous_action_hash,
        &EntryTypesApp::ServiceType(service_type_with_metadata),
    )?;

    Ok(updated_record)
}
```

#### Delete Operations
```rust
#[hdk_extern]
pub fn delete_service_type(original_action_hash: ActionHash) -> ExternResult<ActionHash> {
    // Validate exists
    let _record = get_latest_record(original_action_hash)?
        .ok_or("Record not found")?;

    // Delete the record
    delete_record(original_action_hash)?;

    Ok(original_action_hash)
}
```

### Status Management Patterns

#### Status Workflow Functions
```rust
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

// Internal helper for status updates
fn update_service_type_status(
    action_hash: ActionHash,
    new_status: ServiceTypeStatus
) -> ExternResult<()> {
    let record = get_latest_record(action_hash)?
        .ok_or("Record not found")?;

    let entry = record.entry().as_option()
        .ok_or("Entry not found")?;

    if let Ok(mut service_type) = ServiceType::try_from(entry) {
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

### Link Management Standards

#### Link Creation Patterns
```rust
#[hdk_extern]
pub fn link_service_types_to_entity(
    base_action_hash: ActionHash,
    target_action_hash: ActionHash,
    link_type: String,
) -> ExternResult<()> {
    create_link(
        base_action_hash,
        target_action_hash,
        &LinkTypes::ServiceTypeToEntity,
        link_type.as_str().into(),
    )?;

    Ok(())
}

#[hdk_extern]
pub fn unlink_service_type_from_entity(
    base_action_hash: ActionHash,
    target_action_hash: ActionHash,
) -> ExternResult<()> {
    let links = get_links(GetLinksInputBuilder::try_new(
        base_action_hash,
        LinkTypes::ServiceTypeToEntity
    )?.build())?;

    for link in links {
        if link.target == target_action_hash {
            delete_link(link.create_link_hash)?;
        }
    }

    Ok(())
}
```

#### Link Querying Patterns
```rust
#[hdk_extern]
pub fn get_service_types_for_entity(entity_hash: ActionHash) -> ExternResult<Vec<Record>> {
    let links = get_links(GetLinksInputBuilder::try_new(
        entity_hash,
        LinkTypes::ServiceTypeToEntity
    )?.build())?;

    let records: Result<Vec<_>, _> = links
        .into_iter()
        .filter_map(|link| get_latest_record(link.target).ok())
        .collect();

    Ok(records.unwrap_or_default())
}

#[hdk_extern]
pub fn get_entities_for_service_type(service_type_hash: ActionHash) -> ExternResult<Vec<ActionHash>> {
    let links = get_links(GetLinksInputBuilder::try_new(
        service_type_hash,
        LinkTypes::EntityToServiceType
    )?.build())?;

    Ok(links.into_iter().map(|link| link.target).collect())
}
```

### Error Handling Standards

#### Consistent Error Types
```rust
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum ServiceTypeError {
    EntryNotFound(String),
    ValidationError(String),
    UnauthorizedAccess(String),
    SerializationError(String),
    LinkNotFound(String),
}

impl std::fmt::Display for ServiceTypeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ServiceTypeError::EntryNotFound(msg) => write!(f, "Entry not found: {}", msg),
            ServiceTypeError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            ServiceTypeError::UnauthorizedAccess(msg) => write!(f, "Unauthorized access: {}", msg),
            ServiceTypeError::SerializationError(msg) => write!(f, "Serialization error: {}", msg),
            ServiceTypeError::LinkNotFound(msg) => write!(f, "Link not found: {}", msg),
        }
    }
}

impl std::error::Error for ServiceTypeError {}
```

#### Error Return Patterns
```rust
// ✅ Preferred: Specific error types with context
fn create_service_type_with_validation(service_type: ServiceType) -> ExternResult<Record> {
    if service_type.name.is_empty() {
        return Err(WasmError::Guest(ServiceTypeError::ValidationError(
            "Service type name cannot be empty".to_string()
        ).into()));
    }

    create_service_type(service_type).map_err(|e|
        WasmError::Guest(ServiceTypeError::ValidationError(
            format!("Failed to create service type: {}", e)
        ).into())
    )
}

// ❌ Avoid: Generic error messages
fn create_service_type_with_validation(service_type: ServiceType) -> ExternResult<Record> {
    if service_type.name.is_empty() {
        return Err(WasmError::Guest("Error".to_string()));
    }

    create_service_type(service_type)
}
```

### Input Validation Standards

#### Validation in Integrity Zomes
```rust
#[hdk_extern]
pub fn validate_create_entry_service_type(validate_data: ValidateCreateEntryData) -> ExternResult<ValidateCallbackResult> {
    let entry = match ServiceType::try_from(&validate_data.app_entry) {
        Ok(entry) => entry,
        Err(e) => return Ok(ValidateCallbackResult::Invalid(e.to_string())),
    };

    // Name validation
    if entry.name.is_empty() {
        return Ok(ValidateCallbackResult::Invalid("Name cannot be empty".to_string()));
    }

    if entry.name.len() > 100 {
        return Ok(ValidateCallbackResult::Invalid("Name too long (max 100 characters)".to_string()));
    }

    // Description validation
    if let Some(ref description) = entry.description {
        if description.len() > 500 {
            return Ok(ValidateCallbackResult::Invalid("Description too long (max 500 characters)".to_string()));
        }
    }

    Ok(ValidateCallbackResult::Valid)
}

#[hdk_extern]
pub fn validate_update_entry_service_type(validate_data: ValidateUpdateEntryData) -> ExternResult<ValidateCallbackResult> {
    // Run create validation first
    let create_result = validate_create_entry_service_type(ValidateCreateEntryData {
        app_entry: validate_data.app_entry.clone(),
        action: validate_data.action.clone(),
    })?;

    if let ValidateCallbackResult::Invalid(reason) = create_result {
        return Ok(ValidateCallbackResult::Invalid(reason));
    }

    // Additional update-specific validation
    // ... validation logic here

    Ok(ValidateCallbackResult::Valid)
}
```

### Response Structure Standards

#### Standard Response Types
```rust
#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ServiceTypeResponse {
    pub pending: Vec<Record>,
    pub approved: Vec<Record>,
    pub rejected: Vec<Record>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeQueryResponse {
    pub service_types: Vec<Record>,
    pub total_count: usize,
    pub has_more: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ServiceTypeOperationResult {
    pub success: bool,
    pub record: Option<Record>,
    pub message: Option<String>,
}
```

### Frontend Integration Patterns

#### TypeScript Service Integration
```typescript
// Service layer integration with zome calls
const callZome = <T>(zomeName: string, fnName: string, payload: unknown): E.Effect<T, ServiceTypeError> =>
  pipe(
    Effect.tryPromise({
      try: () => holochainClient.callZome(zomeName, fnName, payload) as Promise<T>,
      catch: (error) => new ServiceTypeError({
        cause: error,
        context: `${zomeName}.${fnName}`
      })
    })
  );

const createServiceType = (input: CreateServiceTypeInput): E.Effect<Record, ServiceTypeError> =>
  pipe(
    callZome<Record>('service_types', 'create_service_type', input),
    E.mapError((error) => new ServiceTypeError({
      cause: error,
      context: 'create_service_type'
    }))
  );
```

### Testing Standards

#### Tryorama Testing Patterns
```typescript
import { AppAgent, ActionHash } from '@holochain/tryorama';

describe('Service Types Zome', () => {
  let alice: AppAgent;

  beforeAll(async () => {
    alice = await AppAgent.fromAgent(
      new AgentPubKey('alice_agent'),
      'requests_and_offers.happ'
    );
  });

  it('should create service type successfully', async () => {
    const serviceType = {
      name: 'Test Service',
      description: 'A test service type',
      created_at: Date.now(),
      status: 'Approved'
    };

    const record = await alice.callZome({
      zome_name: 'service_types',
      fn_name: 'create_service_type',
      payload: serviceType,
    });

    expect(record).toBeDefined();
    expect(record.entry.type).toBe('ServiceType');
  });

  it('should reject empty service type name', async () => {
    const invalidServiceType = {
      name: '',
      description: 'Invalid service type',
      created_at: Date.now(),
      status: 'Approved'
    };

    await expect(
      alice.callZome({
        zome_name: 'service_types',
        fn_name: 'create_service_type',
        payload: invalidServiceType,
      })
    ).rejects.toThrow();
  });
});
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

### Versioning and Compatibility

#### Zome Versioning
```rust
// zome_version.rs
pub const ZOME_VERSION: &str = "1.0.0";

#[hdk_extern]
pub fn get_zome_info() -> ExternResult<ZomeInfo> {
    Ok(ZomeInfo {
        name: "service_types".to_string(),
        version: ZOME_VERSION.to_string(),
        functions: vec![
            "create_service_type".to_string(),
            "get_service_type".to_string(),
            "update_service_type".to_string(),
            "delete_service_type".to_string(),
        ],
    })
}
```

By following these Holochain zome API standards, we ensure consistency, reliability, and maintainability across all backend development in the project.
