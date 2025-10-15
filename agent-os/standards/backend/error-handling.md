# Backend Error Handling Standards

This document defines the standards and patterns for error handling in Holochain backend implementations, including integrity zomes, coordinator zomes, and Effect-TS service layers.

## Core Principles

### Centralized Error Management
- **Single Source of Truth**: All error types are centralized in `@dnas/requests_and_offers/utils/src/errors.rs`
- **WasmError Conversion**: All domain-specific errors implement `From<T> for WasmError` conversion
- **thiserror Integration**: Use `thiserror` crate for idiomatic error handling with proper display formatting
- **Consistent Pattern**: Follow the established pattern of domain-specific error enums with WasmError conversion

### Holochain-Specific Error Handling
- **ZomeCallResponse**: Use Holochain's native response types for consistent error communication
- **ActionHash Context**: Include relevant ActionHashes in error context for debugging
- **Link Context**: Provide link information when relationship-related errors occur
- **DHT Awareness**: Consider DHT availability and network conditions in error scenarios

### Error Classification Strategy
- **Common Errors**: Shared technical errors (serialization, network, DHT, etc.)
- **Domain-Specific Errors**: Business logic errors for each domain (Users, Organizations, etc.)
- **Validation Errors**: Input validation and business rule violations
- **Authorization Errors**: Permission and access control issues
- **System Errors**: Unexpected failures and resource limitations

## Error Type Definitions (Centralized Pattern)

### File Location and Structure
All error types MUST be defined in `@dnas/requests_and_offers/utils/src/errors.rs` following this pattern:

```rust
use hdk::prelude::{wasm_error, HoloHashError, SerializedBytesError, WasmError, WasmErrorInner};
use thiserror::Error;

// Common errors shared across all domains
#[derive(Debug, Error)]
pub enum CommonError {
    #[error("Memory error")]
    Memory,

    #[error("Serialization error: {0}")]
    Serialize(SerializedBytesError),

    #[error("Deserialization error")]
    Deserialize(Vec<u8>),

    #[error("HoloHash error: {0}")]
    HoloHash(HoloHashError),

    #[error("DHT error: {0}")]
    DhtError(String),

    #[error("Not a record")]
    NotRecord,

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Timeout error: {0}")]
    TimeoutError(String),

    #[error("Entry not found: {0}")]
    EntryNotFound(String),

    #[error("Record not found: {0}")]
    RecordNotFound(String),

    #[error("Entry operation failed: {0}")]
    EntryOperationFailed(String),

    #[error("Link error: {0}")]
    LinkError(String),

    #[error("Link not found: {0}")]
    LinkNotFound(String),

    #[error("External error: {0}")]
    External(String),

    #[error("Path error: {0}")]
    PathError(String),

    #[error("Invalid data: {0}")]
    InvalidData(String),

    #[error("Action hash not found: {0}")]
    ActionHashNotFound(String),
}

// Domain-specific errors (example for Service Types)
#[derive(Debug, Error)]
pub enum ServiceTypeError {
    #[error("Service type name cannot be empty")]
    EmptyName,

    #[error("Service type name too long: {length} characters (max: {max})")]
    NameTooLong { length: usize, max: usize },

    #[error("Technical service types must include 'service' in the name")]
    TechnicalNamingViolation,

    #[error("Invalid service type status transition")]
    InvalidStatusTransition,

    #[error("Service type already approved")]
    AlreadyApproved,

    #[error("Service type cannot be deleted while linked to requests")]
    CannotDeleteLinked,

    #[error("Invalid service type category")]
    InvalidCategory,
}

// Additional domain errors for reference
#[derive(Debug, Error)]
pub enum UsersError {
    #[error("User already exists")]
    UserAlreadyExists,

    #[error("User profile required")]
    UserProfileRequired,

    #[error("Not the author")]
    NotAuthor,
}

#[derive(Debug, Error)]
pub enum OrganizationsError {
    #[error("Organization already exists")]
    OrganizationAlreadyExists,

    #[error("Already a member")]
    AlreadyMember,

    #[error("Already a coordinator")]
    AlreadyCoordinator,

    #[error("Not a member")]
    NotMember,

    #[error("Not a coordinator")]
    NotCoordinator,

    #[error("Cannot remove last member")]
    LastMember,

    #[error("Cannot remove last coordinator")]
    LastCoordinator,
}
```

### WasmError Conversion Implementation
ALL error types MUST implement `From<T> for WasmError` conversion:

```rust
impl From<CommonError> for WasmError {
    fn from(err: CommonError) -> Self {
        match err {
            CommonError::Memory => wasm_error!(WasmErrorInner::Memory),
            CommonError::Serialize(e) => wasm_error!(WasmErrorInner::Serialize(e)),
            CommonError::Deserialize(e) => wasm_error!(WasmErrorInner::Deserialize(e)),
            CommonError::HoloHash(e) => wasm_error!(WasmErrorInner::Guest(e.to_string())),
            CommonError::DhtError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::RecordNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            err @ CommonError::NotRecord => wasm_error!(WasmErrorInner::Guest(err.to_string())),
            CommonError::NetworkError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::TimeoutError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::EntryNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::EntryOperationFailed(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::LinkError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::LinkNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::External(msg) => wasm_error!(WasmErrorInner::Host(msg)),
            CommonError::PathError(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::InvalidData(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
            CommonError::ActionHashNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
        }
    }
}

impl From<ServiceTypeError> for WasmError {
    fn from(err: ServiceTypeError) -> Self {
        wasm_error!(WasmErrorInner::Guest(err.to_string()))
    }
}

// Implement for all domain errors
impl From<UsersError> for WasmError {
    fn from(err: UsersError) -> Self {
        wasm_error!(WasmErrorInner::Guest(err.to_string()))
    }
}

impl From<OrganizationsError> for WasmError {
    fn from(err: OrganizationsError) -> Self {
        wasm_error!(WasmErrorInner::Guest(err.to_string()))
    }
}
```

## Usage Patterns in Zome Functions

### Import Pattern
All zome functions must import errors from the centralized location:

```rust
use crate::utils::errors::{CommonError, ServiceTypeError, UsersError, OrganizationsError};
use hdk::prelude::*;
```

### Error Handling in Coordinator Zomes
```rust
#[hdk_extern]
pub fn create_service_type(service_type_input: ServiceTypeInput) -> ExternResult<ActionHash> {
    // Validation using centralized errors
    let service_type = validate_service_type_input(service_type_input)
        .map_err(|e| -> WasmError { ServiceTypeError::EmptyName.into() })?;

    // Create entry using centralized error handling
    create_entry(&EntryTypes::ServiceType(service_type.clone()))?;

    let record_hash = create_record(&Postulate {
        entry_type: EntryTypes::ServiceType(service_type),
        entry: service_type,
    })?.signed_action.hashed.hash;

    // Link creation with proper error handling
    create_link(
        agent_info()?.agent_initial_pubkey,
        record_hash.clone(),
        &LinkTypes::AgentToServiceType,
        LinkTag::new(()),
    ).map_err(|e| CommonError::LinkError(e.to_string()))?;

    Ok(record_hash)
}

// Example validation function using centralized errors
fn validate_service_type_input(input: ServiceTypeInput) -> Result<ServiceType, ServiceTypeError> {
    if input.name.trim().is_empty() {
        return Err(ServiceTypeError::EmptyName);
    }

    if input.name.len() > 100 {
        return Err(ServiceTypeError::NameTooLong {
            length: input.name.len(),
            max: 100,
        });
    }

    // Category-specific validation
    if input.category == ServiceTypeCategory::Technical
        && !input.name.to_lowercase().contains("service") {
        return Err(ServiceTypeError::TechnicalNamingViolation);
    }

    // Convert input to domain model
    Ok(ServiceType {
        name: input.name,
        description: input.description,
        status: input.status.unwrap_or(ServiceTypeStatus::Pending),
        category: input.category,
        technical: input.technical.unwrap_or(false),
    })
}
```

### Error Handling in Integrity Zomes
```rust
#[hdk_extern]
pub fn validate_create_entry_service_type(validate_data: ValidateCreateEntryData) -> ExternResult<ValidateCallbackResult> {
    let service_type = match ServiceType::try_from(&validate_data.entry) {
        Ok(service_type) => service_type,
        Err(_) => {
            return Ok(ValidateCallbackResult::Invalid(
                "Invalid ServiceType entry format".to_string()
            ));
        }
    };

    // Business rule validation using centralized errors
    if let Err(validation_err) = validate_service_type_business_rules(&service_type) {
        return Ok(ValidateCallbackResult::Invalid(validation_err.to_string()));
    }

    Ok(ValidateCallbackResult::Valid)
}

fn validate_service_type_business_rules(service_type: &ServiceType) -> Result<(), ServiceTypeError> {
    // Name validation
    if service_type.name.trim().is_empty() {
        return Err(ServiceTypeError::EmptyName);
    }

    // Category-specific validation
    match service_type.category {
        ServiceTypeCategory::Technical => {
            if !service_type.name.to_lowercase().contains("service") {
                return Err(ServiceTypeError::TechnicalNamingViolation);
            }
        },
        _ => {} // Other categories have their own validation rules
    }

    Ok(())
}
```

### Effect-TS Service Error Pattern
```typescript
import { Context, Effect, Layer } from "effect";

// Frontend error types that map to backend WasmErrors
export class ServiceTypeError extends taggedError("ServiceTypeError")<{
  readonly _tag: "ServiceTypeError";
  readonly type: "ValidationError" | "NetworkError" | "SystemError";
  readonly message: string;
  readonly code: string;
  readonly context?: Record<string, unknown>;
}> {}

// Map backend error messages to frontend error types
export const mapBackendError = (error: string): ServiceTypeError => {
  if (error.includes("Service type name cannot be empty")) {
    return ServiceTypeError.validation("Service type name cannot be empty", {
      field: "name",
      code: "EMPTY_NAME",
    });
  }

  if (error.includes("Technical service types must include 'service'")) {
    return ServiceTypeError.validation(
      "Technical service types must include 'service' in the name",
      {
        field: "name",
        code: "TECHNICAL_NAMING_VIOLATION",
      }
    );
  }

  if (error.includes("Invalid service type status transition")) {
    return ServiceTypeError.validation(
      "Invalid status transition for this service type",
      {
        field: "status",
        code: "INVALID_STATUS_TRANSITION",
      }
    );
  }

  // Handle common errors
  if (error.includes("Network error")) {
    return ServiceTypeError.network("Network connectivity issue", {
      code: "NETWORK_ERROR",
    });
  }

  // Default to system error
  return ServiceTypeError.system(error, {
    code: "UNKNOWN_ERROR",
  });
};

// Error constructors
export const ServiceTypeError = {
  validation: (message: string, context: { field?: string; code: string }) =>
    new ServiceTypeError({
      _tag: "ServiceTypeError",
      type: "ValidationError",
      message,
      code: context.code,
      context,
    }),

  network: (message: string, context: { code: string }) =>
    new ServiceTypeError({
      _tag: "ServiceTypeError",
      type: "NetworkError",
      message,
      code: context.code,
      context,
    }),

  system: (message: string, context: { code: string }) =>
    new ServiceTypeError({
      _tag: "ServiceTypeError",
      type: "SystemError",
      message,
      code: context.code,
      context,
    }),
};
```

## Integrity Zome Error Handling

### Validation Error Patterns
```rust
// integrity zome validation
#[hdk_extern]
pub fn validate_create_entry_service_type(validate_data: ValidateCreateEntryData) -> ExternResult<ValidateCallbackResult> {
    let service_type = match ServiceType::try_from(&validate_data.entry) {
        Ok(service_type) => service_type,
        Err(err) => {
            return Ok(ValidateCallbackResult::Invalid(
                format!("Invalid ServiceType entry: {}", err)
            ));
        }
    };

    // Business rule validation
    if let Err(validation_err) = validate_service_type_business_rules(&service_type) {
        return Ok(ValidateCallbackResult::Invalid(validation_err.to_string()));
    }

    // Link validation if creating relationships
    if let Some(link_types) = extract_link_dependencies(&validate_data) {
        if let Err(link_err) = validate_link_dependencies(&link_types) {
            return Ok(ValidateCallbackResult::Invalid(
                format!("Link validation failed: {}", link_err)
            ));
        }
    }

    Ok(ValidateCallbackResult::Valid)
}

fn validate_service_type_business_rules(service_type: &ServiceType) -> Result<(), ServiceTypeError> {
    // Name validation
    if service_type.name.trim().is_empty() {
        return Err(ServiceTypeError::validation_error(
            "Service type name cannot be empty",
            ValidationContext {
                field: Some("name".to_string()),
                value: Some(service_type.name.clone()),
                rule: "required".to_string(),
                entry_hash: None,
            }
        ));
    }

    // Category-specific validation
    match service_type.category {
        ServiceTypeCategory::Technical => {
            if !service_type.name.to_lowercase().contains("service") {
                return Err(ServiceTypeError::validation_error(
                    "Technical service types must include 'service' in the name",
                    ValidationContext {
                        field: Some("name".to_string()),
                        value: Some(service_type.name.clone()),
                        rule: "technical_naming".to_string(),
                        entry_hash: None,
                    }
                ));
            }
        },
        _ => {} // Other categories have their own validation rules
    }

    Ok(())
}
```

### Link Validation Error Handling
```rust
fn validate_link_dependencies(link_types: &[LinkType]) -> Result<(), ServiceTypeError> {
    for link_type in link_types {
        match link_type {
            LinkType::ServiceTypeToRequest => {
                // Validate that service type can be linked to requests
                if !is_valid_service_type_for_requests(&link_type.base)? {
                    return Err(ServiceTypeError::integrity_error(
                        "Service type is not approved for requests",
                        vec![link_type.base.clone()],
                    ));
                }
            },
            LinkType::RequestToServiceType => {
                // Validate that request can link to service type
                if !is_valid_request_for_service_type(&link_type.target)? {
                    return Err(ServiceTypeError::integrity_error(
                        "Request status does not allow service type linking",
                        vec![link_type.target.clone()],
                    ));
                }
            },
            _ => {} // Other link types
        }
    }
    Ok(())
}
```

## Coordinator Zome Error Handling

### Zome Function Error Mapping
```rust
#[hdk_extern]
pub fn create_service_type(service_type_input: ServiceTypeInput) -> ExternResult<ZomeCallResponse> {
    match create_service_type_internal(service_type_input) {
        Ok(action_hash) => Ok(ZomeCallResponse::Ok(action_hash)),
        Err(ServiceTypeError::ValidationError { message, context }) => {
            Ok(ZomeCallResponse::Unauthorized(format!("Validation failed: {}", message)))
        },
        Err(ServiceTypeError::AuthorizationError { reason, .. }) => {
            Ok(ZomeCallResponse::Unauthorized(format!("Access denied: {}", reason)))
        },
        Err(ServiceTypeError::IntegrityError { details, .. }) => {
            Ok(ZomeCallResponse::Unauthorized(format!("Integrity violation: {}", details)))
        },
        Err(ServiceTypeError::NetworkError { details, retry_count }) => {
            let error_msg = if retry_count >= 3 {
                format!("Network unavailable after {} attempts: {}", retry_count, details)
            } else {
                format!("Temporary network issue: {}. Please try again.", details)
            };
            Ok(ZomeCallResponse::NetworkError(error_msg))
        },
        Err(ServiceTypeError::SystemError { message, source }) => {
            error!("System error in create_service_type: {} - {}", message, source);
            Ok(ZomeCallResponse::InternalError("Internal system error".to_string()))
        }
    }
}

fn create_service_type_internal(input: ServiceTypeInput) -> Result<ActionHash, ServiceTypeError> {
    // Authorization check
    let agent_info = agent_info()?;
    if !is_authorized_to_create_service_types(&agent_info)? {
        return Err(ServiceTypeError::authorization_error(
            "Agent not authorized to create service types",
            vec!["service_type:create".to_string()],
        ));
    }

    // Input validation
    let validation_context = ValidationContext {
        field: None,
        value: None,
        rule: "input_validation".to_string(),
        entry_hash: None,
    };

    let service_type = ServiceType::try_from(input)
        .map_err(|e| ServiceTypeError::validation_error(&e.to_string(), validation_context))?;

    // Create entry
    create_entry(&EntryTypes::ServiceType(service_type.clone()))
        .map_err(|e| ServiceTypeError::system_error("Failed to create entry", &e.to_string()))?;

    // Link to creator
    let record_hash = create_record(&Postulate {
        entry_type: EntryTypes::ServiceType(service_type),
        entry: service_type,
    })?.signed_action.hashed.hash;

    create_link(
        agent_info.agent_initial_pubkey,
        record_hash.clone(),
        &LinkTypes::AgentToServiceType,
        LinkTag::new(()),
    ).map_err(|e| ServiceTypeError::system_error("Failed to create creator link", &e.to_string()))?;

    Ok(record_hash)
}
```

## Effect-TS Service Layer Error Handling

### Service Error Transformation
```typescript
import { Effect } from "effect";
import { HolochainClientService } from "./holochain-client.js";
import { ServiceTypeError } from "./service-types-errors.js";

export const ServiceTypeService = Context.GenericTag<ServiceTypeService>("ServiceTypeService");

export interface ServiceTypeService {
  readonly createServiceType: (input: CreateServiceTypeInput) => Effect.Effect<
    string, // ActionHash as string
    ServiceTypeError,
    HolochainClientService
  >;
  readonly getServiceType: (hash: string) => Effect.Effect<
    ServiceType,
    ServiceTypeError,
    HolochainClientService
  >;
}

export const makeServiceTypeService = Effect.gen(function* () {
  const client = yield* HolochainClientService;

  const createServiceType = (input: CreateServiceTypeInput) =>
    client.callZome({
      cellId: client.cellId,
      zomeName: "service_types",
      fnName: "create_service_type",
      payload: input,
    }).pipe(
      Effect.mapError((error) => {
        if (error.kind === "Unauthorized") {
          return ServiceTypeError.validation(error.message, {
            rule: "authorization",
            field: undefined,
            value: input,
            entryHash: undefined,
          });
        }
        if (error.kind === "NetworkError") {
          return ServiceTypeError.network(error.message, 1, 3);
        }
        return ServiceTypeError.system(error.message, error);
      }),
      Effect.flatMap((response) => {
        if (response.type === "success") {
          return Effect.succeed(response.data as string);
        }
        return Effect.fail(
          ServiceTypeError.validation(response.data as string, {
            rule: "response_validation",
            field: undefined,
            value: response,
            entryHash: undefined,
          })
        );
      })
    );

  const getServiceType = (hash: string) =>
    client.callZome({
      cellId: client.cellId,
      zomeName: "service_types",
      fnName: "get_service_type",
      payload: hash,
    }).pipe(
      Effect.mapError((error) => ServiceTypeError.network(
        `Failed to fetch service type: ${error.message}`,
        1,
        3
      )),
      Effect.flatMap((response) => {
        if (response.type === "success") {
          return Effect.succeed(response.data as ServiceType);
        }
        return Effect.fail(
          ServiceTypeError.validation(
            `Service type not found or invalid: ${hash}`,
            {
              rule: "existence_check",
              field: "hash",
              value: hash,
              entryHash: hash,
            }
          )
        );
      })
    );

  return { createServiceType, getServiceType } as ServiceTypeService;
});

export const ServiceTypeServiceLive = Layer.effect(
  ServiceTypeService,
  makeServiceTypeService
);
```

### Error Recovery and Retry Logic
```typescript
import { Effect, Schedule, Duration } from "effect";

// Retry configuration for network operations
const networkRetrySchedule = Schedule.exponential(Duration.millis(500)).pipe(
  Schedule.intersect(Schedule.recurs(3)) // Max 3 retries
);

export const withNetworkRetry = <A, E>(
  effect: Effect.Effect<A, E, never>,
  operation: string
) =>
  effect.pipe(
    Effect.retry(networkRetrySchedule),
    Effect.catchAll((error) =>
      Effect.logError(`Network operation failed after retries: ${operation}`)
        .pipe(Effect.map(() => error))
    )
  );

// Usage in service
export const createServiceTypeWithRetry = (input: CreateServiceTypeInput) =>
  Effect.gen(function* () {
    const service = yield* ServiceTypeService;

    return yield* service.createServiceType(input).pipe(
      withNetworkRetry("create_service_type"),
      Effect.catchTag("NetworkError", (error) =>
        error.context.retryCount < 3
          ? Effect.fail(error) // Will trigger retry
          : Effect.fail(ServiceTypeError.system(
            "Service type creation failed after network retries",
            error
          ))
      )
    );
  });
```

## Error Context and Logging

### Structured Error Logging
```rust
use tracing::{error, warn, info, debug};

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorContext {
    pub timestamp: u64,
    pub agent_pubkey: AgentPubKey,
    pub function_name: String,
    pub operation: String,
    pub parameters: serde_json::Value,
    pub error_type: String,
    pub error_details: String,
    pub related_entries: Vec<ActionHash>,
    pub stack_trace: Option<String>,
}

impl ErrorContext {
    pub fn from_zome_call(
        agent_pubkey: AgentPubKey,
        function_name: &str,
        operation: &str,
        parameters: serde_json::Value,
        error: &ServiceTypeError,
    ) -> Self {
        Self {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            agent_pubkey,
            function_name: function_name.to_string(),
            operation: operation.to_string(),
            parameters,
            error_type: error.error_type(),
            error_details: error.to_string(),
            related_entries: error.related_entries(),
            stack_trace: std::backtrace::Backtrace::capture().to_string().into(),
        }
    }
}

// Logging macros for consistent error reporting
macro_rules! log_zome_error {
    ($context:expr) => {
        error!(
            agent = ?$context.agent_pubkey,
            function = %$context.function_name,
            operation = %$context.operation,
            error_type = %$context.error_type,
            details = %$context.error_details,
            related_entries = ?$context.related_entries,
            "Zome operation failed"
        );
    };
    ($context:expr, $level:ident) => {
        $level!(
            agent = ?$context.agent_pubkey,
            function = %$context.function_name,
            operation = %$context.operation,
            error_type = %$context.error_type,
            details = %$context.error_details,
            "Zome operation"
        );
    };
}

// Usage in zome functions
#[hdk_extern]
pub fn update_service_type(input: UpdateServiceTypeInput) -> ExternResult<ZomeCallResponse> {
    let agent_info = agent_info()?;
    let result = update_service_type_internal(input);

    if let Err(ref error) = result {
        let context = ErrorContext::from_zome_call(
            agent_info.agent_initial_pubkey,
            "update_service_type",
            "update",
            serde_json::to_value(&input).unwrap_or_default(),
            error,
        );

        match error {
            ServiceTypeError::ValidationError { .. } => {
                warn!(context = ?context, "Validation error in update_service_type");
            },
            ServiceTypeError::AuthorizationError { .. } => {
                warn!(context = ?context, "Authorization error in update_service_type");
            },
            ServiceTypeError::IntegrityError { .. } => {
                error!(context = ?context, "Integrity error in update_service_type");
            },
            ServiceTypeError::NetworkError { .. } => {
                info!(context = ?context, "Network error in update_service_type");
            },
            ServiceTypeError::SystemError { .. } => {
                error!(context = ?context, "System error in update_service_type");
            }
        }
    }

    result.map(|action_hash| ZomeCallResponse::Ok(action_hash))
        .map_err(|_| ZomeCallResponse::InternalError("Operation failed".to_string()))
}
```

## Error Response Standards

### Consistent Response Format
```typescript
// Frontend-compatible error response format
export interface ServiceOperationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly type: string;
    readonly message: string;
    readonly context?: Record<string, unknown>;
    readonly retryable: boolean;
    readonly code: string;
  };
}

export const mapServiceErrorToResult = <T>(
  effect: Effect.Effect<T, ServiceTypeError, never>
): Effect.Effect<ServiceOperationResult<T>, never, never> =>
  effect.pipe(
    Effect.map((data) => ({
      success: true as const,
      data,
    })),
    Effect.catchAll((error) =>
      Effect.succeed({
        success: false as const,
        error: {
          type: error.type,
          message: error.message,
          context: error.context,
          retryable: error.type === "NetworkError" &&
                    (error.context?.retryCount ?? 0) < (error.context?.maxRetries ?? 3),
          code: error.code,
        },
      })
    )
  );
```

### Error Code Standards
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorCode {
    // Validation Errors (1000-1999)
    InvalidInput = 1001,
    MissingRequiredField = 1002,
    InvalidFormat = 1003,
    BusinessRuleViolation = 1004,

    // Authorization Errors (2000-2999)
    Unauthorized = 2001,
    InsufficientPermissions = 2002,
    AccessDenied = 2003,

    // Integrity Errors (3000-3999)
    DataCorruption = 3001,
    ReferentialIntegrityViolation = 3002,
    ConstraintViolation = 3003,

    // Network Errors (4000-4999)
    NetworkUnavailable = 4001,
    TimeoutError = 4002,
    ConnectionLost = 4003,

    // System Errors (5000-5999)
    InternalError = 5001,
    ResourceExhausted = 5002,
    ServiceUnavailable = 5003,
}

impl ServiceTypeError {
    pub fn code(&self) -> ErrorCode {
        match self {
            Self::ValidationError { .. } => ErrorCode::InvalidInput,
            Self::AuthorizationError { .. } => ErrorCode::Unauthorized,
            Self::IntegrityError { .. } => ErrorCode::ReferentialIntegrityViolation,
            Self::NetworkError { .. } => ErrorCode::NetworkUnavailable,
            Self::SystemError { .. } => ErrorCode::InternalError,
        }
    }
}
```

## Best Practices Summary

### ✅ **DO:**
- Use typed errors with clear categorization
- Provide rich context for debugging (entry hashes, link info, agent details)
- Implement structured logging with consistent format
- Create retry logic for transient network errors
- Map backend errors to frontend-compatible formats
- Validate inputs at multiple layers (coordinator and integrity)
- Log errors with appropriate severity levels

### ❌ **DON'T:**
- Return generic error messages without context
- Expose sensitive system information in error messages
- Ignore error context from Holochain responses
- Create infinite retry loops
- Mix validation errors with system errors
- Skip logging for authorization and integrity violations
- Expose internal implementation details in error responses

### **Error Recovery Patterns:**
- Validation errors → Return immediately with user guidance
- Authorization errors → Log and return with permission requirements
- Network errors → Retry with exponential backoff
- Integrity errors → Fail fast with detailed context
- System errors → Log extensively and return generic message

These patterns ensure robust, maintainable error handling that provides clear feedback to users while maintaining system security and debugging capabilities.