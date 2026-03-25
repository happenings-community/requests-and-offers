# Testing: Backend with Sweettest

Backend integration tests use **Rust Sweettest** (`holochain::sweettest`), the official
in-process test harness. Tests live in `tests/sweettest/` and run natively (no WASM).

## Running Tests

```sh
# Build the hApp first (required before every test run)
bun run build:happ

# Run all Sweettest integration tests
bun run test:sweettest

# Verbose output (--nocapture)
bun run test:sweettest:verbose

# Per-domain shortcuts
bun run test:sweettest:misc
bun run test:sweettest:users
bun run test:sweettest:administration
bun run test:sweettest:organizations
bun run test:sweettest:service-types
bun run test:sweettest:service-types-status
bun run test:sweettest:requests
bun run test:sweettest:offers
bun run test:sweettest:mediums-of-exchange
```

> **Important:** use `CARGO_TARGET_DIR=target/native-tests` to avoid artifact conflicts
> with the `wasm32-unknown-unknown` build directory (already set in all npm scripts above).

## Conductor Setup

```rust
use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

// Two agents, hardcoded progenitor from happ.yaml (not Alice)
let (conductors, alice, bob) = setup_two_agents().await;

// Two agents where Alice IS the progenitor (auto-registered as admin on create_user)
let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;
```

## Calling Zome Functions

```rust
// Call that must succeed — panics on zome error
let record: Record = conductors[0]
    .call(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
    .await;

// Call that is expected to fail — returns Result, use assert!(result.is_err())
let result = conductors[1]
    .call_fallible::<_, Record>(&bob.zome("service_types"), "create_service_type", input)
    .await;
assert!(result.is_err(), "Non-admin should not create service types");
```

## DHT Consistency

Always call `await_consistency` after writes before cross-agent reads:

```rust
await_consistency(15, [&alice, &bob]).await.unwrap();
```

Use a higher timeout (e.g. `30`) for tests with many sequential operations.

## Common Helpers (`tests/sweettest/src/common/`)

| Helper | Purpose |
|--------|---------|
| `setup_two_agents()` | Two conductors, hardcoded progenitor |
| `setup_two_agents_with_alice_as_progenitor()` | Alice's key embedded as progenitor |
| `setup_two_agents_no_progenitor_configured()` | Dev-mode bootstrap (first user becomes admin) |
| `accept_entity(conductor, cell, entity, hash)` | Transition an entity to "accepted" status |
| `sample_user(name)` | Default `UserInput` fixture |
| `sample_service_type(name)` | Default `ServiceTypeInput` fixture |
| `sample_request(title)` | Default `CreateRequestInput` fixture |
| `sample_offer(title)` | Default `CreateOfferInput` fixture |
| `ENTITY_USERS` / `ENTITY_ORGANIZATIONS` / `ENTITY_NETWORK` | Entity string constants |

## Test File Structure

```
tests/sweettest/
├── Cargo.toml               # [[test]] entries for each test file
├── src/
│   └── common/
│       ├── conductors.rs    # Setup helpers + accept_entity
│       ├── fixtures.rs      # Input structs + sample data constructors
│       ├── mirrors.rs       # Mirror structs for zome output types
│       └── mod.rs
└── tests/
    ├── administration/      # Progenitor, status management, admin CRUD
    ├── service_types.rs     # CRUD, permissions, validation, linking
    ├── service_types_status.rs  # Status workflow (suggest/approve/reject)
    ├── requests.rs
    ├── offers.rs
    ├── organizations.rs
    ├── users.rs
    ├── mediums_of_exchange.rs
    └── misc.rs
```

## Porting from Tryorama

| Tryorama | Sweettest |
|----------|-----------|
| `runScenario(async (scenario) => {...})` | `#[tokio::test(flavor = "multi_thread")]` |
| `scenario.addPlayersWithApps([src, src])` | `SweetConductorBatch::from_config_rendezvous(2, ...)` |
| `dhtSync([alice, bob], cellId)` | `await_consistency(15, [&alice, &bob]).await.unwrap()` |
| `cell.callZome({zome_name, fn_name, payload})` | `conductor.call(&cell.zome("name"), "fn", payload).await` |
| `expect(...).rejects.toThrow()` | `conductor.call_fallible(...).await; assert!(result.is_err())` |
| `scenario.shareAllAgents()` | `conductors.exchange_peer_info().await` |
| `decodeRecord<T>(record)` | `record.entry().to_app_option::<T>().unwrap().expect("entry")` |
