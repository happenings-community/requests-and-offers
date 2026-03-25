# Sweettest Backend Test Patterns

Holochain backend integration tests use **Sweettest** — the official in-process Rust test harness. Tests live in `tests/sweettest/` and run inside a Nix environment.

## Test Setup

Two setup helpers are available in `tests/sweettest/src/common/conductors.rs`:

- `setup_two_agents()` — basic two-agent setup, no admin
- `setup_two_agents_with_alice_as_progenitor()` — Alice's key is embedded in DNA properties as `progenitor_pubkey`; she is auto-registered as network admin on `create_user`

Use the progenitor variant for any test that calls `add_administrator`, `create_request`, `create_offer`, `add_member_to_organization`, or `suggest_medium_of_exchange`.

## Basic CRUD Test Pattern

```rust
use holochain::prelude::*;
use holochain::sweettest::*;
use requests_and_offers_sweettest::common::*;

#[tokio::test(flavor = "multi_thread")]
async fn basic_service_type_crud_operations() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Create users — Alice is auto-registered as admin via init callback
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;
    conductors[1]
        .call::<_, Record>(&bob.zome("users_organizations"), "create_user", sample_user("Bob"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Alice creates a service type (admin-only; auto-approved)
    let st_record: Record = conductors[0]
        .call(
            &alice.zome("service_types"),
            "create_service_type",
            sample_service_type("Web Development"),
        )
        .await;

    let st_hash = st_record.signed_action.hashed.hash.clone();

    await_consistency(15, [&alice, &bob]).await.unwrap();

    // Bob reads the service type
    let st_from_bob: Option<Record> = conductors[1]
        .call(&bob.zome("service_types"), "get_service_type", st_hash.clone())
        .await;
    assert!(st_from_bob.is_some());

    // Deserialize entry
    let st: ServiceType = st_from_bob
        .unwrap()
        .entry()
        .to_app_option()
        .unwrap()
        .expect("entry");
    assert_eq!(st.name, "Web Development");
}
```

## Entity Acceptance

`create_request`, `create_offer`, and organization membership operations require the caller's user profile to have `accepted` status. Use the `accept_entity()` helper:

```rust
// Get user hash from agent links
let alice_links: Vec<Link> = conductors[0]
    .call(&alice.zome("users_organizations"), "get_agent_user", alice.agent_pubkey().clone())
    .await;
let alice_user_hash = alice_links[0].target.clone().into_action_hash().unwrap();

// Accept the user profile before creating requests/offers
accept_entity(&conductors[0], &alice, ENTITY_USERS, alice_user_hash).await;

await_consistency(15, [&alice, &bob]).await.unwrap();
```

## Zome Call Patterns

```rust
// Infallible call (panics on error) — standard for most tests
let record: Record = conductors[0]
    .call(&alice.zome("zome_name"), "fn_name", input)
    .await;

// Explicit type annotation when return type can't be inferred
conductors[0]
    .call::<_, Record>(&alice.zome("zome_name"), "fn_name", input)
    .await;

// JSON input for complex update structs
let _: Record = conductors[0]
    .call(
        &alice.zome("requests"),
        "update_request",
        serde_json::json!({
            "original_action_hash": req_hash,
            "previous_action_hash": req_record.signed_action.hashed.hash,
            "updated_request": updated_data,
            "service_type_hashes": [],
            "medium_of_exchange_hashes": []
        }),
    )
    .await;
```

## Tryorama → Sweettest Migration Reference

| Tryorama (TypeScript) | Sweettest (Rust) |
|---|---|
| `runScenario(async (scenario) => {...})` | `#[tokio::test(flavor = "multi_thread")]` |
| `scenario.addPlayersWithApps([src, src])` | `setup_two_agents_with_alice_as_progenitor().await` |
| `dhtSync([alice, bob], cellId)` | `await_consistency(15, [&alice, &bob]).await.unwrap()` |
| `alice.cells[0].callZome({zome_name, fn_name, payload})` | `conductor.call(&cell.zome("name"), "fn", payload).await` |
| `scenario.shareAllAgents()` | `conductors.exchange_peer_info().await` |
| `decodeRecord<T>(record)` | `record.entry().to_app_option::<T>().unwrap()` |

## Running Tests

```bash
# All Sweettest tests (requires Nix)
nix develop --command cargo test --manifest-path tests/sweettest/Cargo.toml

# Single test file
nix develop --command cargo test --test service_types --manifest-path tests/sweettest/Cargo.toml

# Single test function
nix develop --command cargo test basic_service_type_crud_operations --manifest-path tests/sweettest/Cargo.toml
```

Tests spin up real Holochain conductors — several minutes each. Always run inside the Nix shell.
