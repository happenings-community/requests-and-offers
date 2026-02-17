---
name: Holochain Development
description: This skill should be used when developing Holochain zomes, modifying zome functions, adding entry types or link types, setting up Holochain dev environment, or debugging Holochain-related issues
---

# Holochain Development Skill

Patterns for developing Holochain 0.6 hApps with HDI 0.7 integrity zomes and HDK 0.6 coordinator zomes.

## Environment

This project uses **Nix flakes** (`flake.nix`), not `shell.nix`:

```bash
nix develop                           # Enter dev shell
nix develop --command bun test:unit   # Run unit tests in Nix
bun build:zomes                       # Build Rust zomes
bun build:happ                        # Build complete hApp
```

## Key Reference Files

- **Integrity zome**: `dnas/requests_and_offers/zomes/integrity/service_types/src/lib.rs`
- **Coordinator zome**: `dnas/requests_and_offers/zomes/coordinator/requests/src/lib.rs`
- **Coordinator CRUD**: `dnas/requests_and_offers/zomes/coordinator/requests/src/request.rs`
- **Entry types**: `dnas/requests_and_offers/zomes/integrity/requests/src/request.rs`
- **Shared utils**: `dnas/requests_and_offers/zomes/coordinator/utils/`
- **Tryorama tests**: `tests/src/requests_and_offers/`

## Holochain 0.6 Key Patterns

### Integrity Zome (HDI 0.7)

Uses `hdi::prelude::*` (NOT `hdk`):

```rust
use hdi::prelude::*;

#[derive(Serialize, Deserialize)]
#[serde(tag = "type")]
#[hdk_entry_types]
#[unit_enum(UnitEntryTypes)]
pub enum EntryTypes {
  MyEntry(MyEntry),
}

#[hdk_entry_helper]
#[derive(Clone, PartialEq)]
pub struct MyEntry {
  pub name: String,
  pub description: String,
}

#[derive(Serialize, Deserialize)]
#[hdk_link_types]
pub enum LinkTypes {
  MyEntryUpdates,
  AllMyEntries,
}

#[hdk_extern]
pub fn validate(op: Op) -> ExternResult<ValidateCallbackResult> {
  match op.flattened::<EntryTypes, LinkTypes>()? {
    FlatOp::StoreEntry(store_entry) => match store_entry {
      OpEntry::CreateEntry { app_entry, .. } |
      OpEntry::UpdateEntry { app_entry, .. } => match app_entry {
        EntryTypes::MyEntry(entry) => validate_my_entry(entry),
      },
      _ => Ok(ValidateCallbackResult::Valid),
    },
    _ => Ok(ValidateCallbackResult::Valid),
  }
}
```

### Coordinator Zome (HDK 0.6)

Uses `hdk::prelude::*`:

```rust
use hdk::prelude::*;
use my_integrity::*;

// Create: create_entry + get + create_link to path
#[hdk_extern]
pub fn create_my_entry(input: MyEntryInput) -> ExternResult<Record> {
  let hash = create_entry(&EntryTypes::MyEntry(input.entry))?;
  let record = get(hash.clone(), GetOptions::default())?
    .ok_or(wasm_error!(WasmErrorInner::Guest("Entry not found".into())))?;
  let path = Path::from("my_entries.active");
  create_link(path.path_entry_hash()?, hash, LinkTypes::AllMyEntries, ())?;
  Ok(record)
}

// Read: get with GetOptions::default()
#[hdk_extern]
pub fn get_my_entry(hash: ActionHash) -> ExternResult<Option<Record>> {
  get(hash, GetOptions::default())
}

// List: LinkQuery::new() with GetStrategy
#[hdk_extern]
pub fn get_all_my_entries() -> ExternResult<Vec<Record>> {
  let path = Path::from("my_entries.active");
  let link_filter = LinkTypes::AllMyEntries.try_into_filter()
    .map_err(|e| wasm_error!(WasmErrorInner::Guest(e.to_string())))?;
  let links = get_links(LinkQuery::new(path.path_entry_hash()?, link_filter)
    .get_options(GetStrategy::Local))?;
  let get_input: Vec<GetInput> = links.into_iter()
    .filter_map(|link| link.target.into_action_hash())
    .map(|hash| GetInput::new(hash.into(), GetOptions::default()))
    .collect();
  let records: Vec<Record> = HDK.with(|hdk| hdk.borrow().get(get_input))?
    .into_iter().flatten().collect();
  Ok(records)
}

// Update: update_entry + create tracking link
#[hdk_extern]
pub fn update_my_entry(input: UpdateInput) -> ExternResult<Record> {
  update_entry(input.previous_hash, &input.updated_entry)?;
  // ... get and return updated record
}

// Delete link: requires GetOptions::default()
delete_link(create_link_hash, GetOptions::default())?;
```

### Signals & Post-Commit

See `coordinator-zome.template.rs` for Signal enum and `post_commit` pattern.

## Project Structure

Integrity zomes (`hdi`) define types + validation; coordinator zomes (`hdk`) implement business logic.
DNA manifest at `dnas/requests_and_offers/workdir/dna/dna.yaml` uses `path` field (not `bundled`).

## Common Tasks

- **Add entry type**: Create struct with `#[hdk_entry_helper]` in integrity, add to `EntryTypes` enum
- **Add link type**: Add variant to `LinkTypes` enum in integrity, use in coordinator
- **Add zome function**: Add `#[hdk_extern]` function in coordinator, call from frontend service
- **Path indexing**: Use `Path::from("entity.status")` for collection queries
- **Batch get**: Use `HDK.with(|hdk| hdk.borrow().get(get_input))?` for efficient multi-get

## Troubleshooting

- **Build failures**: Ensure `nix develop` shell is active
- **DHT sync in tests**: Add `dhtSync()` calls between agent operations
- **Link queries**: Use `GetStrategy::Local` for reading own data, `GetStrategy::Network` for others
- **Permission errors**: Check `agent_info()?.agent_initial_pubkey` matches expected author
