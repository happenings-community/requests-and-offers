---
description: Guidelines for Rust error handling in Holochain zomes
globs: dnas/**/*.rs
alwaysApply: false
---

# Rust Error Handling Guidelines

## Core Principles

- Use domain-specific error enums for different zomes and functionality areas
- Implement the `Error` trait from `thiserror` for all error types
- Provide clear, descriptive error messages with context
- Convert all error types to `WasmError` for Holochain compatibility
- Avoid direct usage of `wasm_error!` macro in business logic

## Error Structure

### Error Organization

- ✅ **DO:** Organize errors into domain-specific enums

  ```rust
  // Common errors shared across zomes
  pub enum CommonError { ... }

  // Domain-specific errors
  pub enum UsersError { ... }
  pub enum OrganizationsError { ... }
  pub enum AdministrationError { ... }
  ```

- ❌ **DON'T:** Use generic error strings or mix error domains
  ```rust
  // Bad: Generic error without context
  return Err(wasm_error!(Guest("Operation failed".to_string())));
  ```

### Error Definition

- Define errors using `thiserror` with descriptive messages
- Include relevant context in error variants
- Use associated data for dynamic error information

```rust
#[derive(Debug, Error)]
pub enum CommonError {
  #[error("Entry not found: {0}")]
  EntryNotFound(String),

  #[error("Action hash not found: {0}")]
  ActionHashNotFound(String),

  #[error("Serialization error: {0}")]
  Serialize(SerializedBytesError),
}
```

## Error Conversion

### Converting to WasmError

- Implement `From<YourErrorType> for WasmError` for all error types
- Use pattern matching for detailed error conversion when needed
- Provide appropriate `WasmErrorInner` variants based on error type

```rust
impl From<CommonError> for WasmError {
  fn from(err: CommonError) -> Self {
    match err {
      CommonError::Serialize(e) => wasm_error!(WasmErrorInner::Serialize(e)),
      CommonError::EntryNotFound(msg) => wasm_error!(WasmErrorInner::Guest(msg)),
      // ... other conversions
    }
  }
}

// For simpler error types, convert to string
impl From<UsersError> for WasmError {
  fn from(err: UsersError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}
```

## Error Usage

### Returning Errors

- ✅ **DO:** Use the `.into()` method to convert domain errors to `WasmError`

  ```rust
  // Good: Domain-specific error with context
  return Err(AdministrationError::Unauthorized.into());
  ```

- ✅ **DO:** Provide context in error messages

  ```rust
  // Good: Clear error with context
  return Err(CommonError::EntryNotFound("Could not find the entity's Status link".to_string()).into());
  ```

- ❌ **DON'T:** Use `wasm_error!` directly in business logic
  ```rust
  // Bad: Direct use of wasm_error! macro
  return Err(wasm_error!(Guest("User not found".to_string())));
  ```

### Error Propagation

- Use the `?` operator for error propagation
- Chain error transformations when needed
- Add context to low-level errors when propagating

```rust
// Good: Error propagation with transformation
let record = get(action_hash.clone(), GetOptions::default())?
  .ok_or(CommonError::EntryNotFound("Could not find the entity".to_string()))?;

// Good: Error transformation in method chain
record
  .entry()
  .to_app_option()
  .map_err(CommonError::Serialize)?
  .ok_or(CommonError::ActionHashNotFound("Entry not found".to_string()))?;
```

## Error Handling in Specific Contexts

### Serialization/Deserialization Errors

- Use `CommonError::Serialize` for serialization errors
- Use `CommonError::Deserialize` for deserialization errors
- Use `CommonError::HoloHashError` for hash conversion errors

```rust
// Converting SerializedBytes
.map_err(|err| CommonError::Serialize(err).into())

// Converting AgentPubKey
AgentPubKey::try_from(pubkey_string)
  .map_err(|err| CommonError::HoloHashError(err).into())
```

### Not Found Errors

- Use specific error types for different "not found" scenarios
- Include identifying information in the error message

```rust
.ok_or(CommonError::EntryNotFound("Could not find the latest entity Status".to_string()))?;

.ok_or(CommonError::ActionHashNotFound("Status not found".to_string()))?;

.ok_or(CommonError::LinkNotFound("Could not find the entity's Status link".to_string()))?;
```

### Authorization Errors

- Use domain-specific authorization errors
- Provide clear messages about permission requirements

```rust
// Unauthorized access
return Err(AdministrationError::Unauthorized.into());

// Missing prerequisites
return Err(UsersError::UserProfileRequired("You must first create a User profile".to_string()).into());
```

## Testing Error Handling

- Write tests that explicitly verify error cases
- Ensure error messages are clear and actionable
- Test error conversion and propagation

## Related Rules

- [holochain-functional-patterns.md](mdc:.cursor/rules/holochain-functional-patterns.md) - For functional programming patterns
- [nix-environment.md](mdc:.cursor/rules/nix-environment.md) - For Nix environment usage with Holochain
