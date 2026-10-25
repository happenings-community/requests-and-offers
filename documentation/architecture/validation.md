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
| In every integrity zome, entry create and update rules run on the entry op only, not the record op | A write refused by the entry authorities can still read as valid wherever a rule reaches it with `must_get_valid_record` | #348 (approved) for six zomes; #343 for exchanges |
| Role rules (administrator, coordinator, member) are coordinator-only | A modified client can write entries that only a role holder should write | the grants stack: #377, #378, #379 |
| `service_types`, `offers`, `requests` and `mediums_of_exchange` validate no link type, and `users_organizations` validates few | Any agent can write those links, with any base, any target and up to a kilobyte of tag, including approving a service type or medium of exchange through its status-path link | #234, phase 1 and the grants stack |
| Tombstones of entries are unchecked in most zomes | Any agent can tombstone an approved service type or medium of exchange, or another member's organisation | #234, phase 1 |
| Status-path links are tombstoned by role holders whenever a status moves | Until status is held in entries, these tombstones cannot be checked; a modified client could hide an item from a status list | #234, phase 2 |
| A listing's service type is held in links only | A modified client can relink a listing to another service type | #257 |
| `genesis_self_check` accepts every agent | An applicant joins the network before acceptance, and can write anything the rules above leave open | the membrane proof from the joining service, which also lets each network run its own invite process (`MEMBRANE_MANAGEMENT_OFF_DHT.md`), alpha 3 |
| The release carries no progenitor key | With the grants stack, the chain of grants accepts whoever registers first as its root administrator | a progenitor key in the release, with the membrane, alpha 3; alpha 1 and 2 are internal networks |
| An agreement names its listing's original record, not the revision agreed | A listing edited after an agreement shows the other member text they did not agree to; the agreed terms themselves are copied into the agreement and do not change | issue on pinning the listing revision |

## What already holds

- **Exchanges:**
  - each step names the record it answers, and its author must be the party allowed to write it;
  - records are append-only: no updates, and no tombstones except a member withdrawing their own interest;
  - its links are checked, and tombstones of them are refused.
- **Administration:**
  - its link types are routed to rules;
  - with the grants stack, every grant is checked back to its root.
- **Field rules on every entry type** (lengths, required fields, allowed values) run on the entry op today, and on the record op too once #348 and #343 merge.
