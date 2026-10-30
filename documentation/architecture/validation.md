# Validation: what the network enforces, and its known limits

In Holochain the network's rules are the integrity zomes. Every peer runs them on every op it is asked to hold. Coordinator code is the app's own behaviour, and a modified client can skip it. So this page lists only what integrity validation enforces, what it does not yet enforce, and the work that will close each gap.

It describes `dev`. A PR that changes what validation enforces updates this page in the same PR.

## Words

- **Tombstone.** Nothing on a DHT is deleted. Holochain's `Delete` and `DeleteLink` actions write a tombstone: a signed record telling readers to treat the original as removed. The original stays on every peer that holds it, and in its author's chain.
- **Retire, reject, withdraw, remove.** An update that moves an entry's status on. Unlike a tombstone, it can carry who did it, their grant, and why.
- **Coordinator-only.** A check the honest app makes before writing, which validation does not repeat. It protects members using the app, not the network.

## The intended shape

- **Every op has a rule:** entry creates and updates on both the entry op and the record op, links, and tombstones.
- **Validation is deterministic.** It reads only the op and what the op names, through `must_get_*`. It never uses `get`, `get_links` or the clock.
- **Role acts carry a grant.** An entry written by a role holder names the grant it rests on, and validation checks it.
- **State lives in entries, and status moves forward.** Links are indexes of entries, and only their author tombstones them.
- **Shared things are never tombstoned.** Service types, mediums of exchange, organisations, statuses and grants are retired or rejected by a role holder, by status, never tombstoned by their author or anyone else.
- **The membrane decides who joins.** Agents who are not members never reach the network.

## Known limits on `dev`, and what closes them

| Limit | Effect | Closed by |
|---|---|---|
| In `exchanges`, entry create rules run on the entry op only, not the record op (the other six integrity zomes run them on both since #348) | An exchange step refused by the entry authorities can still read as valid wherever a rule reaches it with `must_get_valid_record` | #343 |
| Role rules (administrator, coordinator, member) are coordinator-only | A modified client can write entries that only a role holder should write | the grants stack: #377, #378, #379 |
| `service_types`, `offers`, `requests` and `mediums_of_exchange` validate no link type, and `users_organizations` validates few | Any agent can write those links, with any base, any target and up to a kilobyte of tag, including approving a service type or medium of exchange through its status-path link | #400 (#234 phase 1), on the grants stack; the approval link carries the administrator's grant |
| Tombstones of entries are unchecked in most zomes | Any agent can tombstone an approved service type or medium of exchange, another member's listing, or another member's organisation | #400 for listings (only the creator tombstones), service types and mediums of exchange (never tombstoned; retired by status); #406 for organisations (never tombstoned; retired by an entry carrying a coordinator's or administrator's grant) |
| Status-path links are tombstoned by role holders whenever a status moves | Until status is held in entries, these tombstones cannot be checked; a modified client could hide an item from a status list | #400: a decision is a status entry carrying the grant, and the status-path links are never tombstoned |
| Membership links are tombstoned when someone leaves or is removed, and a tombstone carries no grant | Any agent can end anyone's membership or coordinator role | #407: membership links are never tombstoned; a `MembershipEnd` names the links it closes and carries the remover's grant (none when members leave themselves), and readers skip closed links |
| Links from a listing to its service types and mediums of exchange, and `UserOrganizations` and `OrganizationContacts`, have a shape rule but an open writer and tombstone rule | A modified client can write or tombstone them; each is marked open in its zome's `links.rs` with the reason | #408 (#257) for service types, and the same shape for mediums next; #407 for `UserOrganizations` (the user, or a grant in the tag; never tombstoned); `OrganizationContacts` after alpha 2, since its tag carries text the interface reads |
| A listing's service type is held in links only | A modified client can relink a listing to another service type | #408 (#257) |
| `genesis_self_check` accepts every agent | An applicant joins the network before acceptance, and can write anything the rules above leave open | the membrane proof from the joining service, which also lets each network run its own invite process (`MEMBRANE_MANAGEMENT_OFF_DHT.md`), alpha 3 |
| The release carries no progenitor key | With the grants stack, the chain of grants accepts whoever registers first as its root administrator | a progenitor key in the release, with the membrane, alpha 3; alpha 1 and 2 are internal networks |
| An agreement names its listing's original record, not the revision agreed | A listing edited after an agreement shows the other member text they did not agree to; the agreed terms themselves are copied into the agreement and do not change | #404 (#399) |

## Limits that remain once these land

- **A listing posted for an organisation** proves membership by naming a member link. Validation cannot see a later end of that membership, as it cannot see a later revoked grant, so a removed member's earlier listings stay valid; readers and the interface follow the end.
- **Catalogue state is ordered by time.** A service type's or medium's state is its latest decision by timestamp. A reader that has not yet received the newest decision reads the one before, and a decision made on a clock that runs behind loses to the one before it. #400 removes the missed fetch and the tie, not the clock.

## What already holds

- **Exchanges:**
  - each step names the record it answers, and its author must be the party allowed to write it;
  - records are append-only: no updates, and no tombstones except a member withdrawing their own interest;
  - its links are checked, and tombstones of them are refused.
- **Administration:**
  - its link types are routed to rules;
  - with the grants stack, every grant is checked back to its root.
- **Field rules on every entry type** (lengths, required fields, allowed values) run on the record op as well as the entry op in six zomes (#348), and in `exchanges` once #343 merges.
