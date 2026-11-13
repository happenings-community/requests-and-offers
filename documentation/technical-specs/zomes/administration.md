# Administration Zome Specification

## Overview

The Administration Zome manages system-wide administrative functions, including user verification, status management, and administrative access control. It consists of two parts:

1. Integrity Zome: Defines entry and link types, validation rules
2. Coordinator Zome: Implements business logic and external functions

## Progenitor Pattern

The **network progenitor** is the agent whose public key is embedded in the DNA properties at install time via `progenitor_pubkey`. When the progenitor creates their user profile, they are automatically registered as the first network administrator — no explicit administrator registration call is required.

Key properties:
- The progenitor pubkey is fixed at DNA install time (in `workdir/happ.yaml` and at test setup via `rolesSettings`).
- Auto-registration happens inside `create_user` via a cross-zome call to `add_administrator` in the `administration` coordinator.
- In **production** (progenitor key configured): ONLY the progenitor is auto-registered. Any user who creates a profile before the progenitor receives standard pending status — they are NOT made admin.
- In **dev mode** (no `progenitor_pubkey` set): the first user to call `create_user` becomes admin automatically as a convenience bootstrap.
- The progenitor still receives "pending" status like any other user after `create_user`.
- The progenitor's admin grant can be revoked by another administrator like any other. That removes it from the app's reading of who administers; it does not stop the progenitor key signing a fresh root, which validation accepts. On a keyed network the key is the last word, which is why it is kept offline (`MEMBRANE_MANAGEMENT_OFF_DHT.md`).

### Progenitor Externs

One public function is available in the `administration` coordinator for checking progenitor status:

```rust
// Check if the current calling agent is the network progenitor
pub fn is_progenitor(_: ()) -> ExternResult<bool>
```

> **Note:** `check_if_agent_is_progenitor(agent: AgentPubKey)` was removed in favour of
> `is_progenitor()`. Callers that previously checked another agent's progenitor status
> should use `is_progenitor` from the target agent's own conductor context.

### Administrator Registration

The first administrator is registered automatically when the progenitor calls `create_user` (production mode). In dev mode (no progenitor key configured), the first user to call `create_user` is registered instead. Subsequent administrators are added explicitly via `add_administrator` (which requires an existing administrator or the progenitor to call it).

## Technical Implementation

### 1. Entry Types

#### Status Entry

```rust
pub struct Status {
    pub status_type: String,
    pub reason: Option<String>,
    pub suspended_until: Option<String>,
    /// The admin or steward grant the change rests on. Absent only on the
    /// "pending" status an entity's own author writes at creation.
    pub grant: Option<ActionHash>,
}
```

Status types are defined through an enumeration:

```rust
pub enum StatusType {
    Pending,
    Accepted,
    Rejected,
    SuspendedIndefinitely,
    SuspendedTemporarily,
}
```

### 2. Link Types

```rust
pub enum LinkTypes {
    AllAdministrators,     // Links administrators to entities
    AgentAdministrators,   // Links agents to administrator roles
    StatusUpdates,         // Links status updates
    AllStatuses,          // Global status index
    EntityStatus,         // Links entities to their status
    AcceptedEntity,       // Links accepted entities
    AgentGrants,          // A holder's key to each grant they hold
    AllGrants,            // A role's path to every grant of that role
    GrantRevocations,     // A grant to the revocation that withdraws it
}
```

### 3. Administrator Management

#### Core Functions

##### `add_administrator`

```rust
pub fn add_administrator(input: EntityActionHashAgents) -> ExternResult<bool>
```

The sole public extern for administrator registration. To write a grant the caller must hold an admin grant, or be the network progenitor, or, on a network with no progenitor key, be the first user while no agent holds a live admin grant. It writes an admin grant (see *The chain of grants* below) and the roster links for each agent key that does not already hold one, and is idempotent key by key: called for keys that all hold a live admin grant, it writes nothing and returns `true` to any caller.

- To write a grant, requires the caller to be an administrator, the progenitor, or the first user on a keyless network (above)
- Idempotent: safe to call when already an administrator
- Asks the grants, key by key: a key that already holds a live admin grant is left as it is, and a grant is written for each key that does not (so an administrator revoked through `revoke_role`, whom the roster still lists, can be appointed again)
- Returns `true` when every key holds a live admin grant afterwards, whether or not this call wrote one

##### `remove_administrator`

```rust
pub fn remove_administrator(input: EntityActionHashAgents) -> ExternResult<bool>
```

- Requires a grant that may give the admin role
- Ensures at least one administrator remains, counted from the live admin grants and not from the roster links (`revoke_role` ends a role without touching the roster, so the two can differ). `revoke_role` applies the same rule to the last live admin grant, so neither call, on its own and from an honest client, leaves the network with none. Two administrators removing each other at the same moment, and a revocation forged by a removed administrator, still can (see *Not closed here*)
- Revokes each agent's admin grant first, which is what ends the role
- Then removes the roster links; one that is already gone is not an error
- Returns success boolean

#### Query Functions

##### `is_there_an_administrator`

```rust
pub fn is_there_an_administrator(_: ()) -> ExternResult<bool>
```

- Whether any agent holds a live network administrator grant, read from the grants
- `create_user` asks it before offering the first user the root on a network with no progenitor key, so it and `add_administrator` decide "first" from the same source

##### `get_all_administrators_links`

```rust
pub fn get_all_administrators_links(entity: String) -> ExternResult<Vec<Link>>
```

- Retrieves all administrator links for entity
- Returns vector of links

##### `check_if_entity_is_administrator`

```rust
pub fn check_if_entity_is_administrator(input: EntityActionHash) -> ExternResult<bool>
```

- Reports whether the entity is on the administrator roster, which is a listing: it stays true after `revoke_role`. Whether an agent administers is `check_if_agent_is_administrator`
- Checks administrator links
- Returns boolean status

##### `check_if_agent_is_administrator`

```rust
pub fn check_if_agent_is_administrator(input: EntityAgent) -> ExternResult<bool>
```

- Whether the agent administers the network now
- Answered from the chain of grants, by `can(agent, Administer, network)`, not from the `AgentAdministrators` roster link: one reader for one question. The roster is an index for listing administrators; a roster link is valid whenever its tag carries an admin grant written by the link's author, so read as a permission it could be forged by a removed administrator
- `input.entity` is not read: `"network"` is the only entity administrators have

### 4. Status Management

#### Core Functions

##### `create_status`

```rust
pub fn create_status(input: EntityActionHash) -> ExternResult<Record>
```

- Creates pending status for entity
- Verifies no existing status
- Creates status links
- Returns status record

##### `update_entity_status`

```rust
pub fn update_entity_status(input: UpdateEntityActionHash) -> ExternResult<Record>
```

- Updates entity's status
- Creates status update links
- Handles accepted status links
- Returns updated record

#### Status Query Functions

##### `get_entity_status_link`

```rust
pub fn get_entity_status_link(input: EntityActionHash) -> ExternResult<Link>
```

- Retrieves status link for entity
- Returns link or error

##### `get_latest_status_record`

```rust
pub fn get_latest_status_record(original_action_hash: ActionHash) -> ExternResult<Option<Record>>
```

- Gets most recent status record
- Returns optional record

##### `get_latest_status`

```rust
pub fn get_latest_status(original_action_hash: ActionHash) -> ExternResult<Option<Status>>
```

- Gets most recent status entry
- Returns optional status

##### `get_latest_status_record_for_entity`

```rust
pub fn get_latest_status_record_for_entity(input: EntityActionHash) -> ExternResult<Option<Record>>
```

- Gets entity's latest status record
- Returns optional record

##### `get_latest_status_for_entity`

```rust
pub fn get_latest_status_for_entity(input: EntityActionHash) -> ExternResult<Option<Status>>
```

- Gets entity's latest status entry
- Returns optional status

#### Status Management Functions

##### `suspend_entity_temporarily`

```rust
pub fn suspend_entity_temporarily(input: SuspendEntityInput) -> ExternResult<bool>
```

- Temporarily suspends entity
- Sets suspension duration
- Returns success boolean

##### `suspend_entity_indefinitely`

```rust
pub fn suspend_entity_indefinitely(input: SuspendEntityInput) -> ExternResult<bool>
```

- Indefinitely suspends entity
- Returns success boolean

##### `unsuspend_entity_if_time_passed`

```rust
pub fn unsuspend_entity_if_time_passed(input: UpdateInput) -> ExternResult<bool>
```

- Checks suspension duration
- Auto-unsuspends if time passed
- Returns success boolean

##### `unsuspend_entity`

```rust
pub fn unsuspend_entity(input: UpdateInput) -> ExternResult<bool>
```

- Manually unsuspends entity
- Returns success boolean

#### Accepted Entity Management

##### `create_accepted_entity_link`

```rust
pub fn create_accepted_entity_link(input: EntityActionHash) -> ExternResult<bool>
```

- Creates link for accepted entity
- Returns success boolean

##### `delete_accepted_entity_link`

```rust
pub fn delete_accepted_entity_link(input: EntityActionHash) -> ExternResult<bool>
```

- Removes accepted entity link
- Returns success boolean

##### `get_accepted_entities`

```rust
pub fn get_accepted_entities(entity: String) -> ExternResult<Vec<Link>>
```

- Retrieves all accepted entities
- Returns vector of links

##### `check_if_entity_is_accepted`

```rust
pub fn check_if_entity_is_accepted(input: EntityActionHash) -> ExternResult<bool>
```

- Verifies if entity is accepted
- Returns boolean status

### 5. Access Control

- Administrator functions require administrator privileges
- Status management restricted to administrators
- Status queries available to all users
- Entity acceptance management restricted to administrators

## The chain of grants

An act of authority in this zome is a **role act**: a record that names the grant its author holds for it, written only by that holder. Listings, service types, mediums of exchange, organisation edits, membership links, interests and agreements are role acts too, checked by their own zomes against the same grants (see each zome's page). The grants form a chain that validation walks one step up with `must_get_valid_record`, so every peer reaches the same verdict.

### Entries

- **`RoleGrant`** `{ role, holder, scope, authority }`. `role` is `admin`, `member`, `org_coordinator` (scoped to an organisation) or `steward` (only on a network with the stewarding module). `authority` is either `Progenitor { signature }` — the progenitor key's signature over the grant's body, admitted for `admin` only — or `Grant(hash)`: a grant above it whose holder wrote this one and whose role may grant this role in this scope (`utils::grants::may_grant`).
- **`RoleRevocation`** `{ grant, authority, reason }`: withdraws a grant. Written by the holder of a grant that could have given the role. The grant stands as a record; `can` treats it as withdrawn.

Grants and revocations are records: never updated, never deleted. The only way to end a grant is a revocation.

### Index links

| Link | From → to | Rule |
|---|---|---|
| `AgentGrants` | holder's key → grant | written by the granter; tag carries the grant's hash |
| `AllGrants` | `grants.{role}` path → grant | written by the granter; tag carries the grant's hash |
| `GrantRevocations` | grant → revocation | written by the revoker; the target is a `RoleRevocation` entry of this zome, checked by entry type and not by shape, and names the grant the link starts at |

`can` reads `AgentGrants` and `GrantRevocations`; `AllGrants` is the register by role, read to count the live administrators and to list a role's grants. **None of the three is ever tombstoned**: a tombstone on a holder's index would hide their grant from every reader, and one on a revocation link would bring a revoked grant back. No coordinator tombstones them. (The administrator roster links `AllAdministrators` / `AgentAdministrators` are tombstoned by `remove_administrator`; who may write that tombstone is still open, and `can` does not read them.)

### Reading authority

`can(agent, ability, scope)` returns the agent's live grant that covers the ability, or none: it reads the holder's `AgentGrants` index, leaves out any grant that has been revoked, and checks `grant_covers`. Coordinators call `require` before a write and put the grant on the record; integrity checks the record with `check_act`, which reloads the grant and confirms its holder is the author and its role covers the ability.

**Revocation is checked on the read side only, and it is a record, not a wall.** Validation can prove a grant exists; it cannot prove that no revocation names it. So a record written while a grant was live stays valid after the grant is revoked, and a holder whose grant has been revoked can still, with a modified client, write records that pass validation. `can` leaves out a grant that has itself been revoked, which is what an honest client asks before every gated write. It does not ask whether the grant *beneath* a grant was revoked: what a holder gave while they held a role stands when they lose it (removing a role never undoes past acts), and by the same reading a grant they write afterwards with a modified client, resting on their revoked one, is valid and is returned once they index it. A revocation records who was removed, by whom and when, for every honest reader and for the people who run the network; it does not stop a modified client. The case `a_removed_administrator_with_a_modified_client` shows the limit, so it is seen and not discovered.

The remedy for a removed holder who goes on acting is with people, not with this zome: the graduated response of the stewarding module, where removal needs a second signature, and the founder's key as the last resort (alpha 3).

A record `can` needs and cannot fetch is an error, not a refusal: the caller hears that the question could not be answered. The same holds for `is_there_an_administrator`, and so for `create_user` on a network with no key: a newcomer whose node can see an admin grant's index link and not yet the grant itself is told to try again, where the roster count it replaces fetched nothing.

**Not closed here, and open for alpha 3** (they matter on a network with a progenitor key; without one a modified client can write itself a root and needs none of them):

- **A revocation is believed whoever wrote it.** `can` treats any valid `GrantRevocations` link as a revocation, and a revocation is valid whenever its author holds a grant record that could have given the role, live or not. So an administrator who has been removed can still, with a modified client, revoke another administrator's grant. Two administrators who each claim to have removed the other first cannot be ordered from the records alone; it needs a rule for who may remove whom (a second signature, or the founder's key as arbiter).
- **Status and acceptance are read from their links,** not from the grants: `check_if_entity_is_accepted` and the status readers follow `AcceptedEntity` and `EntityStatus`, so a status change forged by a removed administrator is honoured on read until those readers ask whether the grant on the status stood.

### The root

With a `progenitor_pubkey` in the DNA properties, a root (`Authority::Progenitor`) grant is accepted only when its author **is** the progenitor and the signature verifies against the progenitor key — both, because the signature covers only the body, and a signed body written again by someone else would be a second grant that no revocation names. With no key configured (development, Sweettest, and the alpha 2 release, whose manifest carries `null`), the root is accepted from any author: a network without a key is a different network from one with it, since the properties are part of the DNA hash. On such a network the chain of grants records who did what; it does not stop a modified client from writing itself a root.

## Integrity Validation

The integrity zome's `validate` callback dispatches every `FlatOp` for the zome's entries and links. Authorisation is checked **in validation**, not only in the coordinator: a status past `pending`, a grant, a revocation and each roster link carry the grant they rest on, read with `must_get_valid_record`: `check_act` for a status and an `AcceptedEntity` link, `load_grant` for the others.

### Design note: HDI vs HDK

Integrity zomes use `hdi::prelude::*`, which exposes `must_get_*` but not `get_links`. That is why authority is carried **on the record** as a grant hash rather than looked up: validation can `must_get_valid_record` a hash it is given, deterministically on every peer, but cannot ask "is this agent an administrator right now?". The coordinator still checks `require` first, so an honest client gets a clear refusal before writing; the validator is what a modified client meets.

### What the integrity zome validates

| Operation | Integrity guarantee |
|-----------|---------------------|
| Create `Status` past `pending`, or update any `Status` | carries a grant covering `ChangeStatus`, held by the author |
| Delete `Status` | refused |
| Create `RoleGrant` | role available on this network; scope fits the role; authority is a valid root or a grant above it held by the author that may grant this role |
| Create `RoleRevocation` | names a grant held by the author that may grant the revoked role |
| Update or delete `RoleGrant` / `RoleRevocation` | refused, on the record op and on the op the original's authorities receive |
| Create `AgentGrants` / `AllGrants` | written by the granter; tag names the grant, which is also the target; an `AgentGrants` link starts at the grant's holder (the base of an `AllGrants` link is not checked) |
| Create `GrantRevocations` | written by the revoker; target is a `RoleRevocation` by entry type; base is the grant it names |
| Delete `AgentGrants` / `AllGrants` / `GrantRevocations` | refused |
| Create `AllAdministrators` / `AgentAdministrators` | tag carries an admin grant written by the link's author; an `AgentAdministrators` link starts at that grant's holder |
| Create `EntityStatus` | written by the author of the status it points at |
| Create `AcceptedEntity` | tag carries a `ChangeStatus` grant (admin or steward) held by the author |
| Create `StatusUpdates` | both ends are statuses (the chain rule is on #400's list) |

Forged-client coverage lives in `tests/sweettest/tests/grants.rs`, where one conductor carries the `forge` zome and writes past the coordinator. It covers: a status is never deleted; the root on a keyed and a keyless network; a steward grant without the stewarding module; the grant indexes are never tombstoned; a grant is never updated, by its holder or its issuer; a status change carries a grant its author holds; a revocation link points at a real revocation; the create rules of the grant indexes and the administrator roster (written by the granter, from the holder, tag and target the same grant, the right role); the four rules for who may write a grant (borrowed authority, a member granting, a scope on an admin grant, the progenitor's signature on anything but an admin grant); a forged roster link gives no permission, and, in the same case, the stated limit: a removed administrator's fresh grant is returned by `can`; the last administrator, counted from the grants, by both calls that could remove one; removal with the roster link gone; a second appointment after `revoke_role`; a new user registering after the roster has been emptied by a forged tombstone; and, through the honest calls, an administrator removing the one who appointed them. From #378, in the same file: a request, an offer and an interest carry the member grant their author holds; a listing is changed by its author or an administrator; approval makes the creator coordinator, of that organisation only, and once; an organisation is deleted by a coordinator alone and by nobody outside it; an update link is never deleted and points at a real update by its author. An agreement's grant is in `exchanges_attacks.rs`, through the exchanges probe. The ops an update or a delete sends to the original's authorities, and a delete of an entry that is not this zome's, are unit tests in `administration_integrity` (`record_op_tests`), because a conductor refuses its own commit on the record op first and a Sweettest never reaches the other. Not covered by any test, honest or forged: the refusals inside `validate_role_revocation` (the revoker does not hold the authority, may not revoke), the two refusals of `validate_grant_revocation_link` about its author and its base, and forged creates of `AllAdministrators`, `AcceptedEntity` and `EntityStatus`.

### What a status change issues

`update_entity_status` writes more than the status:

- **A member accepted**: a `member` grant for each of the member's agents that does not hold a live one, resting on the approver's grant. Any other status revokes them.
- **An organisation approved for the first time**: an `org_coordinator` grant for its creator, scoped to the organisation and resting on the approver's grant, then the member and coordinator links, each carrying the approver's grant in its tag. The role is issued by the administrator or steward who approves; nobody holds it before.

  Once only. A later move to accepted, such as the return from a suspension, writes nothing if the creator was ever granted the role for that organisation, by a grant still live or one since revoked. A creator who stood down or was removed stays out until a coordinator adds them again. Suspending an organisation does not revoke its coordinators' grants.

  "Ever granted" is the whole test, so an administrator who gives the creator the role with `grant_role` before approving leaves approval nothing to do, links included; the creator then adds themselves with `add_coordinator_to_organization`.

### Status Entry Validation

`validate_status` enforces that:
- Status type must be one of the defined `StatusType` variants.
- Suspended statuses must include a reason.
- Temporarily suspended statuses must include a `suspended_until` timestamp; indefinitely suspended ones must not.
- Any status other than the author's own initial `pending`, and every update, carries a `ChangeStatus` grant held by its author.

## Usage Examples

### Administrator Management

```rust
// Register first administrator (progenitor auto-registration via create_user)
// or add a new administrator (requires caller to be admin or progenitor)
let input = EntityActionHashAgents {
    entity: "network".to_string(),
    entity_original_action_hash: hash,
    agent_pubkeys: vec![agent_key],
};
add_administrator(input)?; // idempotent — safe to call even if already admin
```

### Status Management

```rust
// Create entity status
let status = create_status(entity_hash)?;

// Suspend temporarily
let suspend_input = SuspendEntityInput {
    entity,
    entity_original_action_hash: hash,
    status_original_action_hash: status_hash,
    status_previous_action_hash: prev_hash,
    reason: "Violation".to_string(),
    duration: Some(Duration::days(7)),
};
suspend_entity_temporarily(suspend_input)?;

// Check and unsuspend
unsuspend_entity_if_time_passed(update_input)?;
```
