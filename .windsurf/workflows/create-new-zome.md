---
description: How to create a new zome in the Requests and Offers project
---

# Creating a New Zome in Requests and Offers

This workflow guides you through creating a new zome in the Requests and Offers Holochain project by referencing existing zomes as templates.

## 1. Create Directory Structure

```bash
# Create integrity zome directories
mkdir -p dnas/requests_and_offers/zomes/integrity/your_zome_name/src

# Create coordinator zome directories
mkdir -p dnas/requests_and_offers/zomes/coordinator/your_zome_name/src
```

## 2. Create Cargo.toml Files

### Integrity Zome Cargo.toml

Use the `requests_integrity` Cargo.toml as a template:

```bash
cp dnas/requests_and_offers/zomes/integrity/requests/Cargo.toml dnas/requests_and_offers/zomes/integrity/your_zome_name/Cargo.toml
```

Then edit the file to update the package name and lib name to `your_zome_name_integrity`.

### Coordinator Zome Cargo.toml

Use the `requests` Cargo.toml as a template:

```bash
cp dnas/requests_and_offers/zomes/coordinator/requests/Cargo.toml dnas/requests_and_offers/zomes/coordinator/your_zome_name/Cargo.toml
```

Then edit the file to update:

- Package name to `your_zome_name`
- Lib name to `your_zome_name`
- Change dependency from `service_types_integrity` to `your_zome_name_integrity`

## 3. Update Root Cargo.toml

Add your zomes to the workspace dependencies in the root Cargo.toml:

```toml
[workspace.dependencies.your_zome_name]
path = "dnas/requests_and_offers/zomes/coordinator/your_zome_name"

[workspace.dependencies.your_zome_name_integrity]
path = "dnas/requests_and_offers/zomes/integrity/your_zome_name"
```

## 4. Create Integrity Zome Files

### Entry Type File

Create a file for your main entry type:

```bash
touch dnas/requests_and_offers/zomes/integrity/your_zome_name/src/your_entry_type.rs
```

Use `service_types_integrity/src/service_type.rs` as a reference for structure. Key components:

- Entry struct with `#[hdk_entry_helper]` attribute
- Validation functions for create/update/delete operations
- Link validation functions if needed

### Integrity Zome Main File

Create the main lib.rs file:

```bash
touch dnas/requests_and_offers/zomes/integrity/your_zome_name/src/lib.rs
```

Use `service_types_integrity/src/lib.rs` as a reference. Key components:

- Import your entry type module
- Define `EntryTypes` enum with your entry types
- Define `LinkTypes` enum with your link types
- Implement validation callbacks

## 5. Create Coordinator Zome Files

### External Calls File

Create a file for external zome calls:

```bash
touch dnas/requests_and_offers/zomes/coordinator/your_zome_name/src/external_calls.rs
```

Use `requests/src/external_calls.rs` as a reference. Typically includes:

- Functions to call other zomes (e.g., checking if an agent is an administrator)

### Entry Type Business Logic File

Create a file for your entry type's business logic:

```bash
touch dnas/requests_and_offers/zomes/coordinator/your_zome_name/src/your_entry_type.rs
```

Use `requests/src/requests.rs` as a reference. Typically includes:

- CRUD functions with `#[hdk_extern]` attribute
- Input structs for create/update operations
- Link management
- Permission checks

### Coordinator Zome Main File

Create the main lib.rs file:

```bash
touch dnas/requests_and_offers/zomes/coordinator/your_zome_name/src/lib.rs
```

Use `requests/src/lib.rs` as a reference. Key components:

- Import your modules
- Define the `Signal` enum for notifications
- Implement `post_commit` function for signaling
- Helper functions for signal handling

## 6. Add Error Types

Add error types to `utils/src/errors.rs`:

```rust
#[derive(Debug, Error)]
pub enum YourZomeError {
  #[error("Your entry type not found: {0}")]
  YourEntryTypeNotFound(String),
  // Add more error types as needed
}

impl From<YourZomeError> for WasmError {
  fn from(err: YourZomeError) -> Self {
    wasm_error!(WasmErrorInner::Guest(err.to_string()))
  }
}
```

## 7. Update DNA Configuration

Update both dna.yaml files (in `dnas/requests_and_offers/workdir/` and `workdir/`):

1. Add integrity zome to the integrity section:

```yaml
- name: your_zome_name_integrity
  hash: ~
  bundled: "../target/wasm32-unknown-unknown/release/your_zome_name_integrity.wasm"
  dependencies: ~
  dylib: ~
```

2. Add coordinator zome to the coordinator section:

```yaml
- name: your_zome_name
  hash: ~
  bundled: "../target/wasm32-unknown-unknown/release/your_zome_name.wasm"
  dependencies:
    - name: your_zome_name_integrity
  dylib: ~
```

## 8. Build the Zomes

```bash
nix develop --command bun run build:zomes
```

## Example References

For real-world examples, refer to these existing zomes:

1. **Service Types Zome**:

   - Integrity: `dnas/requests_and_offers/zomes/integrity/service_types/`
   - Coordinator: `dnas/requests_and_offers/zomes/coordinator/service_types/`

2. **Requests Zome**:

   - Integrity: `dnas/requests_and_offers/zomes/integrity/requests/`
   - Coordinator: `dnas/requests_and_offers/zomes/coordinator/requests/`

3. **Offers Zome**:
   - Integrity: `dnas/requests_and_offers/zomes/integrity/offers/`
   - Coordinator: `dnas/requests_and_offers/zomes/coordinator/offers/`

These examples demonstrate the standard patterns for entry types, link types, CRUD operations, and signal handling in the project.
