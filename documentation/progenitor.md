# The Progenitor Pattern

The progenitor pattern is the network bootstrap mechanism for this hApp. It designates a trusted founding agent whose identity is embedded in the DNA itself, ensuring that the very first administrator is known before anyone joins the network.

## Why It Exists

Holochain networks have no central server to assign roles. Anyone who installs the same DNA hash joins the same peer-to-peer network. Without a bootstrap mechanism, whichever agent happens to call `create_user` first would become admin — an unpredictable race condition in production.

The progenitor pattern solves this by fixing the identity of the first admin at DNA installation time. The founding agent's public key is written into the DNA properties before any agent joins, so the network recognizes exactly who the legitimate first administrator is regardless of join order.

## How It Works

### Step 1: Embedding the progenitor key

Before installing the hApp, the network creator's agent public key is written into `workdir/happ.yaml` under `progenitor_pubkey`. In production, this is done by the Kangaroo (Electron) app, which reads the creator's key from the Holochain conductor admin API.

```yaml
# workdir/happ.yaml
properties:
  progenitor_pubkey: uhCAk...  # base64-encoded AgentPubKey, or ~ for dev mode
```

### Step 2: First profile creation triggers auto-registration

When any agent calls `create_user`, the `users_organizations` coordinator zome checks whether the caller is the progenitor:

```rust
// users_organizations::user.rs — simplified
let is_prog = check_if_progenitor()?;
let progenitor_configured = DnaProperties::get_progenitor_pubkey()?.is_some();
let should_auto_register = if progenitor_configured {
    is_prog  // production: only the progenitor auto-registers
} else {
    no_admins_yet.is_empty()  // dev mode: first user auto-registers
};

if should_auto_register {
    // cross-zome call to administration::add_administrator
}
```

### Step 3: Progenitor bypass in add_administrator

The `add_administrator` function in the `administration` coordinator zome accepts the call from any agent who is either the progenitor or an existing administrator:

```rust
// administration::administration.rs — simplified
let is_admin = get_administrators()?.contains(&caller);
let is_prog  = check_if_progenitor()?;
let no_admins = get_administrators()?.is_empty();

if !is_admin && !is_prog && !no_admins {
    return Err(wasm_error!("Unauthorized"));
}
```

This means the progenitor can add themselves (and others) to the admin list even before any admin record exists.

## Two Deployment Modes

### Production mode (progenitor key configured)

`progenitor_pubkey` is set to the network creator's actual key.

- Only the progenitor is auto-registered as admin when they call `create_user`.
- Any other agent who creates a profile first receives standard `Pending` status — not admin.
- After auto-registration the progenitor can add further administrators via `add_administrator`.

### Dev mode (no progenitor key)

`progenitor_pubkey` is `~` (null) in `workdir/happ.yaml`.

- The very first agent to call `create_user` becomes admin automatically.
- All subsequent users receive `Pending` status.
- Useful for local development and integration tests where pre-generating a key adds friction.

## Key Properties

- **Revocable**: The progenitor is a regular administrator. Any other administrator can call `remove_administrator` to remove them. They have no permanent super-admin privilege.
- **Idempotent**: Calling `add_administrator` for an agent who is already an admin returns `false` without error and creates no duplicate links.
- **Last-admin protection**: `remove_administrator` rejects the call if it would remove the final administrator from the network (`LastAdminError`).
- **Coordinator-enforced**: Authorization lives in the coordinator zome only. The integrity zome returns `Valid` unconditionally for `AllAdministrators` links because HDI 0.7.0 does not expose `get_links` inside validation callbacks.

## Configuration

### Development (default)

```yaml
# workdir/happ.yaml
properties:
  progenitor_pubkey: ~
```

The first agent to register becomes admin. No key management needed.

### Production

Obtain the progenitor's agent public key from the Holochain conductor admin API, encode it as a base64 string, and set it before building the hApp:

```yaml
# workdir/happ.yaml
properties:
  progenitor_pubkey: uhCAkXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Then rebuild:

```bash
bun build:happ
```

The Kangaroo desktop app automates this step: it reads the creator's key via the conductor admin WebSocket and injects it into DNA properties at install time.

## API Reference

### `is_progenitor() -> ExternResult<bool>` (administration coordinator)

Returns `true` if the calling agent is the network progenitor. Checks the caller's initial (genesis) agent key against the value stored in DNA properties.

```typescript
// Frontend usage via administrationService
const isProgenitor = await administrationService.isProgenitor();
```

### `add_administrator(input: EntityActionHashAgents) -> ExternResult<bool>` (administration coordinator)

Adds an agent to the administrator list. Returns `true` when a new admin link was created, `false` if already admin.

Authorization gate: caller must be the progenitor or an existing administrator.

### `check_if_progenitor() -> ExternResult<bool>` (utils lib — internal)

Private utility used inside zomes. Compares `agent_info()?.agent_initial_pubkey` against the decoded `progenitor_pubkey` from DNA properties. Not exposed as an extern.

## Writing Tests

### Choosing the right setup helper

Two conductor setup helpers exist in `tests/sweettest/src/common/conductors.rs`:

```rust
// Use when the test needs progenitor-gated behavior.
// Alice's key is pre-generated and embedded in DNA properties BEFORE install.
// Alice becomes admin automatically when she calls create_user.
let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

// Use when progenitor status is irrelevant to the test.
// A hardcoded key (HARDCODED_PROGENITOR_PUBKEY) is embedded that neither
// Alice nor Bob matches — neither is auto-registered as admin.
let (conductors, alice, bob) = setup_two_agents().await;
```

Use `setup_two_agents_with_alice_as_progenitor()` for any test that:
- Requires Alice to be an administrator
- Tests progenitor detection (`is_progenitor`)
- Tests `add_administrator` authorization

Use `setup_two_agents()` for tests where admin status should not be granted implicitly.

### Example: testing progenitor auto-registration

```rust
#[tokio::test(flavor = "multi_thread")]
async fn progenitor_auto_registered_as_admin() {
    let (conductors, alice, bob) = setup_two_agents_with_alice_as_progenitor().await;

    // Progenitor creates profile — auto-registration fires
    conductors[0]
        .call::<_, Record>(&alice.zome("users_organizations"), "create_user", sample_user("Alice"))
        .await;

    await_consistency(15, [&alice, &bob]).await.unwrap();

    let admins: Vec<AgentPubKey> = conductors[0]
        .call(&alice.zome("administration"), "get_all_administrators", ())
        .await;

    assert!(admins.contains(&alice.agent_pubkey()));
    assert!(!admins.contains(&bob.agent_pubkey()));
}
```

The dedicated test suite lives at `tests/sweettest/tests/administration/progenitor.rs`.

## Related Documentation

- [Administration Zome Specification](technical-specs/zomes/administration.md) — detailed zome API
- [Roles and Permissions](requirements/roles.md) — role assignment context
- [Backend Zome Functions API](technical-specs/api/backend/zome-functions.md) — complete function reference
- [Moss/Weave Integration](MOSS_INTEGRATION.md) — progenitor detection in the Weave context
- [Architecture Overview](architecture/README.md) — network bootstrap in the broader system design
