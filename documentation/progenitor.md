# The Progenitor Pattern

The progenitor pattern is the network bootstrap mechanism for this hApp. It designates a trusted founding agent whose identity is embedded in the DNA itself, ensuring that the very first administrator is known before anyone joins the network.

## Why It Exists

Holochain networks have no central server to assign roles. Anyone who installs the same DNA hash joins the same peer-to-peer network. Without a bootstrap mechanism, whichever agent happens to call `create_user` first would become admin — an unpredictable race condition in production.

The progenitor pattern solves this by fixing the identity of the first admin at DNA installation time. The founding agent's public key is written into the DNA properties before any agent joins, so the network recognizes exactly who the legitimate first administrator is regardless of join order.

## How It Works

### Step 1: Embedding the progenitor key

Before installing the hApp, the network creator's agent public key is written into `workdir/happ.yaml` under `progenitor_pubkey`. This is a manual step today: the Kangaroo (Electron) desktop app installs the hApp with the properties `happ.yaml` carries and does not set the key (see Production below).

```yaml
# workdir/happ.yaml
properties:
  progenitor_pubkey: uhCAk...  # base64-encoded AgentPubKey, or ~ for dev mode
```

### Step 2: The first administrator

When any agent calls `create_user`, the `users_organizations` coordinator zome registers it as network administrator only if it is the configured progenitor:

```rust
// users_organizations::user.rs, simplified
if check_if_progenitor()? {   // false when no key is configured
    register_as_network_administrator(user_hash)?;   // administration::add_administrator
}
```

On a network with no key, nobody becomes administrator by creating a profile (#600).
The first administrator is a deliberate act: the profile form shows an unticked "I am creating this network" box while `can_claim_first_administrator` is true, and the store calls `claim_first_administrator` after the profile exists when it is ticked.
`claim_first_administrator` refuses on a keyed network, once an administrator is visible (asked of the grants, through `administration::is_there_an_administrator`), and before the caller has a profile.

### Step 3: Progenitor bypass in add_administrator

The `add_administrator` function in the `administration` coordinator zome writes an admin grant for each agent key that does not already hold one. What the grant rests on is settled by `authority_for` (`grants.rs`):

```rust
// administration::grants.rs — simplified
if let Some(grant) = can_local(&me, &Ability::Grant(Role::Admin), &None)? {
    return Ok(Authority::Grant(grant));           // an existing administrator
}
let bootstrap = !progenitor_configured && live_administrators()?.is_empty();
if check_if_progenitor()? || bootstrap {
    return Ok(Authority::Progenitor { signature }); // the root
}
Err(AdministrationError::Unauthorized.into())
```

So the progenitor can make themselves the first administrator before any administrator exists, and on a network with no key any caller can, while no agent holds a live admin grant; the app reaches that path only through `claim_first_administrator`. Both questions are asked of the grants, not of the roster links.

## Two Deployment Modes

### Production mode (progenitor key configured)

`progenitor_pubkey` is set to the network creator's actual key.

- Only the progenitor is auto-registered as admin when they call `create_user`.
- Any other agent who creates a profile first receives standard `Pending` status — not admin.
- After auto-registration the progenitor can add further administrators via `add_administrator`.

### Dev mode (no progenitor key)

`progenitor_pubkey` is `~` (null) in `workdir/happ.yaml`.

- Nobody becomes admin by creating a profile: the first administrator ticks "I am creating this network" on the profile form (`claim_first_administrator`, #600).
- Every user, the first administrator included, starts with `Pending` status.
- Useful for local development and integration tests where pre-generating a key adds friction.
- **It is the mode of a build with no key**, which every desktop release was until releases were keyed with the steward key (see [Release builds](#release-builds-the-steward-key)), so on a network without one the creator installs first, creates the first profile with the box ticked, and appoints two or three further administrators on separate devices before the link goes to anyone else. The first admin's only unique power is that first grant; once others hold admin, the chain of grants carries on without them.
- **What it does not protect.** The "no admins yet" check is a DHT read, not a lock: two people who both tick the box before either's administrator grant has reached the other can both become admin.
  Before #600 the check ran on every first profile, so a joiner whose node had not synced took the seat without asking (the 22 November rehearsal); now it runs only for someone who says they are creating the network.
  That check and `add_administrator`'s refusal of a non-admin caller run in the coordinator zome, which is the member's own code.
  Without a key, validation accepts a root administrator grant from any author (`root_is_valid` returns no verdict, and the Sweettest `without_a_progenitor_key_the_root_is_accepted` pins it), so a member running a modified client can write themselves a root grant at any time.
  The key is what would give validation an anchor; without one, the practice above is the protection, and it holds on an invited network where the creator installs alone.
  Every grant, honest or not, is a signed record on its author's chain, so who did what stays visible.

## Key Properties

- **Removable as an administrator, not as the root**: any other administrator can call `remove_administrator` to remove the progenitor's administrator grant. The key itself keeps its power: `authority_for` lets the progenitor key sign a root admin grant whenever it holds none, and validation checks only the signature and the author, so a removed progenitor can grant itself, or anyone, administrator again. On a keyed network the key is the network's root for good, which is why the steward's lair keystore must be guarded like a root credential (#601 review).
- **Idempotent**: Calling `add_administrator` for an agent who is already an admin returns `false` without error and creates no duplicate links.
- **Last-admin protection**: `remove_administrator` rejects the call if it would remove the final administrator from the network (`LastAdminError`).
- **Network-enforced from #377**: Every administrator act carries the grant it rests on, and validation checks that grant one step up through `must_get_valid_record`.
  The roster links (`AllAdministrators`, `AgentAdministrators`) carry a grant in their tag, which validation checks.
  Their tombstones, written by `remove_administrator`, carry no grant, and validation accepts one from any agent (see `architecture/validation.md`).
  With a key configured, the root grant must be signed by the progenitor key and written by it.
  What validation cannot check is an absence: it has no `get_links`, so it cannot prove that no administrator exists yet, or that no revocation names a grant (see `architecture/validation.md`).

## Configuration

### Development (default)

```yaml
# workdir/happ.yaml
properties:
  progenitor_pubkey: ~
```

The first administrator ticks "I am creating this network" when creating their profile. No key management needed.

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

The Kangaroo desktop app cannot reach this mode as built. Its install ([`installHappIfNecessary`](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/blob/8bcec07d/src/main/holochainManager.ts#L176-L190), kangaroo-electron #10 at `8bcec07d`; unchanged at `fcd0821`) generates a fresh agent key with `generateAgentPubKey()` and passes no role settings to `installApp`, so the creator's key does not exist until the build that would have to contain it has been installed, and the install keeps the bundle's own `progenitor_pubkey`, null unless set before the build. The recipe above therefore works only for a conductor the creator drives through its admin API (generate the key, write it into `happ.yaml`, build, `installApp` with that `agent_key`), which is what the Sweettests do. A release reaches this mode by being built with a key held elsewhere, the steward's (see [Release builds: the steward key](#release-builds-the-steward-key)), until the Create Network branch of the joining flow (#95) binds the device's own key as `progenitor_pubkey` at install, with no rebuild and no key handled by a person.

## Release builds: the steward key

A desktop install generates its own agent key, so no desktop install can be the progenitor, and a release built with `progenitor_pubkey: ~` lets a joining member become network administrator (#600).
So a release is keyed with a key that exists before the build: the key of a headless **steward** conductor.
On a network with no key, a user becomes the first administrator only by ticking the first-administrator box when creating a profile (`claim_first_administrator`).

### Who holds the key

The steward is a conductor with no UI and no member behind it, run on Sam's homelab.
Its agent key is the progenitor.
The key lives in that conductor's lair keystore: back the keystore up, because only the progenitor can write a network's root administrator grant.
Administrators the steward has granted can grant others, so losing the keystore later does not lock an existing network, but it ends the progenitor.

The public half goes in the repository variable `PROGENITOR_PUBKEY` (Settings, Secrets and variables, Actions, Variables).
It is public by nature: it is written into the DNA properties of every build, so a variable and not a secret.

### What the build does

The release workflow runs `scripts/release-progenitor.ts` before it packs the hApp.
It writes `$PROGENITOR_PUBKEY` into the `requests_and_offers` role's `modifiers.properties.progenitor_pubkey` of `workdir/happ.yaml`, and changes nothing else in the file.
The key must be an AgentPubKey in base64: 53 characters, `uhCAk` and 48 more, ending with the location checksum of its core, which the script checks: a key with a typo would ship a network on which every profile and every grant fails.
A tag push fails at that step when the variable is empty or malformed.
A manual dispatch fails the same way unless **allow_dev_mode** is ticked, which keeps `~` and prints a warning: it exists for dry runs before the key does, and a build made that way is never published.
The file in the repository keeps `~`, so local development is unchanged.

The key is part of the DNA properties, so it changes the installed DNA hash.
`release-manifest.json` records it as `network.progenitorPubkey` (`null` for a development build), and its `desktop.installedDnaHashes` are computed with it.

### The headless conductor

The steward conductor must reach the same network as the desktop installs, so it takes the wrapper's bootstrap and relay.
Read them from the release's `release-manifest.json` (`desktop.bootstrapUrl`, `desktop.relayUrl`) rather than from memory; at alpha 2 both are `https://dev-test-bootstrap2.holochain.org/`.

From a clone of this repository, in the Nix shell (it provides `hc` and Holochain 0.7):

```bash
nix develop
mkdir -p ~/stw
cd ~/stw
printf '%s' "$STEWARD_PASSPHRASE" | hc sandbox --piped create --root ~/stw -d conductor network -b https://dev-test-bootstrap2.holochain.org/ quic https://dev-test-bootstrap2.holochain.org/
printf '%s' "$STEWARD_PASSPHRASE" | hc sandbox --piped -f 4444 run 0
```

Keep `~/stw` short.
Lair listens on a unix socket inside it, and a path over the socket length limit makes the conductor crash at start with `path must be shorter than SUN_LEN`.
`hc sandbox` keeps its list of sandboxes in a `.hc` file in the directory it was run from, so run `run` from the same directory as `create`.
`-f 4444` fixes the admin port, which the steward commands default to; `--admin-port` or `HC_ADMIN_PORT` says another.
For a service, keep the `run` command in the unit and give the passphrase to stdin from a root-only file.

### The steward commands

They run on the conductor's machine, from the repository, after `bun install` (`@holochain/client` is the UI workspace's dependency, hoisted to the root).

| Command | What it does |
| --- | --- |
| `bun scripts/progenitor-steward.ts keygen` | Prints a new agent key in base64. Once, before the first keyed release. |
| `bun scripts/progenitor-steward.ts install --happ requests_and_offers.happ --agent-key <key> --network-seed <seed>` | Refuses a `.happ` that is not keyed for `<key>`, then installs it under that key and seed, enables it, and attaches an app interface. |
| `bun scripts/progenitor-steward.ts grant` | Creates the steward's profile if it has none: as the progenitor it is registered as the first administrator. |
| `bun scripts/progenitor-steward.ts grant --agent <key> [--agent <key> ...]` | The same, then makes each agent an administrator. Waits up to `--wait` seconds for the agent's profile to reach the steward. |
| `bun scripts/progenitor-steward.ts status [--agent <key> ...]` | App state, whether this agent is the progenitor, and every profile the steward sees with its agent keys and administrator state. |

`--dry-run` on any of them prints what it would do and connects to nothing.
The seed to pass to `install` is `desktop.networkSeed` in the release's `release-manifest.json`: the same one the wrapper passes at install.
`install` answers when the conductor has finished genesis for both DNAs, which took about half a minute on a development machine: wait for it.
After `install`, compare the DNA hashes it prints with `desktop.installedDnaHashes` in the manifest: they must be equal.

A network seed override keeps the keyed properties.
`installApp`'s global `network_seed` ("will override the network seed value for all DNAs in the bundle") sets only the seed of each role; the role's `properties` are not part of that override.
In Holochain 0.7.0, the version of this repository's Nix shell, `AppManifestV0::set_network_seed` assigns `role.dna.modifiers.network_seed` and nothing else (`holochain_types` 0.7.0, `app/app_manifest/app_manifest_v0.rs`).
0.7.1 does the same through `DnaModifiersOpt::update`, which keeps every field the override leaves `None`.
The steward's `install` also reads the bundle itself and refuses one whose `progenitor_pubkey` is not the key it installs under, so a mismatch stops before the conductor sees it.

### The order

1. **Once:** the steward conductor starts, and `keygen` prints its key. Set `PROGENITOR_PUBKEY` to it.
2. **Before the tag:** dispatch the release as a dry run. The build is keyed. The steward installs the dry run's `.happ` with `install`, then runs `grant` with no agent: its profile makes it the network's first administrator.
3. **Each team member** installs the desktop build and creates a profile. Their profile is pending, and administration is closed to them.
4. **The steward** runs `status` to read each member's agent key, then `grant --agent <key>` for each member who is to be an administrator.
5. **Then** the link goes out. Two or three administrators on separate devices before it does, as for any network.

The tag's build uses the same key, so its DNA hash should equal the dry run's; release checklist step 4 compares them. If they differ, the steward runs `install` again with the tag's `.happ` and `grant` again for each team member: no desktop install can take the seat on a keyed network.
A grant counts once the member's own app shows them as administrator, not when the steward's `status` does: the steward stays online until each member sees it, since peers need the steward's grant to validate the member's acts.

**Moss is out of scope for this release.** Moss installs the same webhapp once per group, with its own network seed; a seed override keeps the properties, so every Moss group would be keyed to the steward, whom no group contains, and the first-administrator box is hidden on a keyed network. A Moss group would get no administrator. Moss builds stay unkeyed until the group's own progenitor can be bound (#95).

### Checking a release

On the release or dogfood network, a second person who is not the steward installs on a fresh device, opens the app for the first time and creates a profile at once.
Their profile must be pending, and the administration area must be closed to them.
That check is in `RELEASE_CHECKLIST.md`.

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
