# Backend Integration API

Integration patterns for hREA and external system connectivity.

## hREA Integration

The application integrates with hREA (Holochain Resource-Event-Agent) for economic resource management.

### ResourceSpecification Mapping

Service types automatically map to hREA ResourceSpecifications when approved:

```rust
// Automatic mapping on service type approval
pub fn approve_service_type(service_type_hash: ActionHash) -> ExternResult<Record> {
    // Update service type status
    let updated_record = update_service_type_status(service_type_hash, ServiceTypeStatus::Approved)?;
    
    // Create corresponding ResourceSpecification in hREA
    let resource_spec_input = CreateResourceSpecificationInput {
        name: service_type.name.clone(),
        resource_classified_as: vec![service_type.name.clone()],
        default_unit_of_effort: Some("hour".to_string()),
        // ... other mappings
    };
    
    call_hrea_zome("create_resource_specification", resource_spec_input)?;
    
    Ok(updated_record)
}
```

### Intent/Proposal Mapping

Requests and offers map to hREA Intents and Proposals:

- **Requests** → hREA **Intents** (expressions of need)
- **Offers** → hREA **Proposals** (expressions of availability)

### Event Recording

Exchange completions create hREA Economic Events for resource flow tracking.

## External System Integration

### GraphQL API

The application exposes a GraphQL API for external system integration:

```graphql
type Query {
  serviceTypes: [ServiceType]
  requests: [Request]
  offers: [Offer]
  users: [UserProfile]
  organizations: [Organization]
}

type Mutation {
  createRequest(input: CreateRequestInput!): Request
  createOffer(input: CreateOfferInput!): Offer
  # ... other mutations
}
```

### Webhook System

Configurable webhooks for external system notifications:

```rust
// Webhook configuration
pub struct WebhookConfig {
    pub url: String,
    pub events: Vec<String>,
    pub authentication: Option<String>,
}

// Webhook trigger on events
pub fn trigger_webhook(event: &str, payload: serde_json::Value) -> ExternResult<()> {
    // Send HTTP request to configured webhooks
    // Handle authentication and retries
}
```

## Cross-DNA Communication

### DNA Bridging

Communication between the main DNA and hREA DNA through bridging:

```rust
// Bridge configuration
pub fn setup_hrea_bridge() -> ExternResult<()> {
    let bridge_config = BridgeConfig {
        dna_hash: hrea_dna_hash(),
        zome_name: "resource_specification".to_string(),
    };
    
    create_bridge(bridge_config)?;
    Ok(())
}

// Cross-DNA function calls
pub fn call_hrea_zome<I, O>(function_name: &str, input: I) -> ExternResult<O>
where
    I: Serialize,
    O: for<'de> Deserialize<'de>,
{
    let result = call(
        CallTargetCell::OtherRole("hrea".into()),
        ZomeName::from("resource_specification"),
        FunctionName::from(function_name),
        None,
        input,
    )?;
    
    Ok(result)
}
```

### Signal Handling

Cross-DNA communication through signals:

```rust
#[derive(Serialize, Deserialize, Debug)]
pub enum CrossDNASignal {
    ServiceTypeApproved {
        service_type_hash: ActionHash,
        resource_spec_id: String,
    },
    RequestCreated {
        request_hash: ActionHash,
        intent_id: String,
    },
    OfferCreated {
        offer_hash: ActionHash,
        proposal_id: String,
    },
}

// Signal emission
pub fn emit_service_type_approved_signal(
    service_type_hash: ActionHash,
    resource_spec_id: String,
) -> ExternResult<()> {
    let signal = CrossDNASignal::ServiceTypeApproved {
        service_type_hash,
        resource_spec_id,
    };
    
    emit_signal(&signal)?;
    Ok(())
}
```

## API Versioning

### Version Management

```rust
#[derive(Serialize, Deserialize)]
pub struct APIVersion {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

pub const CURRENT_API_VERSION: APIVersion = APIVersion {
    major: 1,
    minor: 0,
    patch: 0,
};

// Version compatibility checking
pub fn check_api_compatibility(client_version: APIVersion) -> bool {
    // Semantic versioning compatibility rules
    client_version.major == CURRENT_API_VERSION.major
}
```

### Backward Compatibility

Maintaining backward compatibility through versioned entry types and migration functions.

## Security and Authentication

### Cross-System Authentication

```rust
// JWT token validation for external API access
pub fn validate_external_token(token: &str) -> ExternResult<AgentPubKey> {
    // Validate JWT token
    // Extract agent information
    // Return authenticated agent
}

// API key management
pub struct APIKey {
    pub key: String,
    pub permissions: Vec<String>,
    pub expires_at: Option<Timestamp>,
}
```

### Permission Management

Role-based access control for external integrations with granular permissions for different API endpoints and operations.

This integration API enables the application to work seamlessly with external systems while maintaining security and data integrity.