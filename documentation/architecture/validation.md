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
| `service_types`, `offers`, `requests` and `mediums_of_exchange` validate no link type. In `users_organizations`, six are routed to rules: `UserAgents` and `MyUser` (#473: written only by the User's author on its original create, pointing at the author's own key, never tombstoned); `OrganizationMembers` and `OrganizationCoordinators` (#378: from an organisation to a user, the tag carrying a grant the author holds); `UserUpdates` and `OrganizationUpdates` (#378: from a record's original to an update in its chain, written by that update's author; never tombstoned). Its other six are open | Any agent can write the open links, with any base, any target and up to a kilobyte of tag, including approving a service type or medium of exchange through its status-path link | #400 (#234 phase 1), on the grants stack; the approval link carries the administrator's grant |
| Tombstones of entries are unchecked in most zomes | Any agent can tombstone an approved service type or medium of exchange, another member's listing, or another member's organisation | #400 for listings (only the creator tombstones), service types and mediums of exchange (never tombstoned; retired by status); #406 for organisations (never tombstoned; retired by an entry carrying a coordinator's or administrator's grant). Until then who may delete an organisation is the app's check: from #378, a coordinator of it, or the creator of a proposal never approved, and no network role |
| Status-path links are tombstoned by role holders whenever a status moves | Until status is held in entries, these tombstones cannot be checked; a modified client could hide an item from a status list | #400: a decision is a status entry carrying the grant, and the status-path links are never tombstoned |
| Membership links are tombstoned when someone leaves or is removed, and a tombstone carries no grant | Any agent can end anyone's membership or coordinator role | #407: membership links are never tombstoned; a `MembershipEnd` names the links it closes and carries the remover's grant (none when members leave themselves), and readers skip closed links |
| After #400: links from a listing to its service types and mediums of exchange, and `UserOrganizations` and `OrganizationContacts`, gain a shape rule but keep an open writer and tombstone rule | A modified client can still write or tombstone them; #400 marks each open in its zome's `links.rs` with the reason (on `dev` they are covered by the "no link type" row above) | #408 (#257) for service types, and the same shape for mediums next; #407 for `UserOrganizations` (the user, or a grant in the tag; never tombstoned); `OrganizationContacts` after alpha 2, since its tag carries text the interface reads |
| A listing's service type is held in links only | A modified client can relink a listing to another service type | #408 (#257) |
| `genesis_self_check` accepts every agent | An applicant joins the network before acceptance, and can write anything the rules above leave open | the membrane proof from the joining service, which also lets each network run its own invite process (`MEMBRANE_MANAGEMENT_OFF_DHT.md`), alpha 3 |
| The release carries no progenitor key | With the grants stack and no key, validation accepts a root administrator grant from any author; "the first user" is only the honest app's gate | a progenitor key in the release, with the membrane, alpha 3; alpha 1 and 2 are internal networks |
| An update of a `User` is not checked for its author | Any agent can write an update of another member's User and, being that update's author, link it as the latest revision, which readers then show. The app's `update_user` refuses anyone but the User's author | #234 |
| An organisation's creator passes the edit rule at any time | The app lets the creator edit without a grant only until the first approval; validation reads no links and cannot tell. A creator since removed as coordinator, with a modified client, can still write an edit that is valid and link it | open |
| A membership link's grant says who may write it, not when | From #378 an administrator or a steward may write a member or coordinator link for any organisation at any time; the honest app does so only when it approves one. A coordinator link gives no permission by itself: that is the coordinator grant, which `can` reads | none planned: the link is a listing, and permission does not rest on it |
| Revocation is read-side, and believed whoever wrote it | From #377: validation cannot see that a grant has been revoked. An honest client asks `can`, which leaves a revoked grant out; a removed administrator with a modified client can still write a fresh grant resting on their revoked one, or revoke another administrator's grant, and both are valid | removal by a second signature and the founder's key as arbiter, with the stewarding module, alpha 3 |
| A tombstone on an administrator roster link is anyone's to write | The roster listing can be emptied by any agent. From #377 no permission is read from it, so the effect is on the listing only | #234; the roster goes when administrators are listed from their grants |
| An agreement names its listing's original record, not the revision agreed | A listing edited after an agreement shows the other member text they did not agree to; the agreed terms themselves are copied into the agreement and do not change | #404 (#399) |

## Limits that remain once these land

- **A listing posted for an organisation** proves membership by naming a member link. Validation cannot see a later end of that membership, as it cannot see a later revoked grant, so a removed member's earlier listings stay valid; readers and the interface follow the end.
- **A message carries its author's member grant,** and validation cannot see a later revocation of it. A suspended or rejected member with a modified client can keep writing messages the network stores and gossips; no reader shows them, because the inbox drops authors who are not accepted now (`messaging.md` 6.2 and 6.4).
- **Catalogue state is ordered by time.** A service type's or medium's state is its latest decision by timestamp. A reader that has not yet received the newest decision reads the one before, and a decision made on a clock that runs behind loses to the one before it. #400 removes the missed fetch and the tie, not the clock.

## What already holds

- **Exchanges:**
  - each step names the record it answers, and its author must be the party allowed to write it;
  - records are append-only: no updates, and no tombstones except a member withdrawing their own interest;
  - its links are checked, and tombstones of them are refused.
- **Administration:**
  - its link types are routed to rules;
  - with the grants stack, every grant is checked back to its root.
- **Role acts outside administration** (#378). Each carries the grant it rests on, held by its author, and the rule runs on the entry op, the record op and, for an update, the op the original's authorities receive:
  - a request or an offer is posted on a member grant, and changed by its creator or on an admin grant;
  - a service type or a medium of exchange is created on an admin or a member grant (a member's is a suggestion), and changed on an admin grant;
  - an organisation is changed by its creator, or on a coordinator grant for it, or on an admin grant, and the link that makes the change the latest revision is written by the change's author;
  - an interest and an agreement are written on a member grant.
- **Field rules on every entry type** (lengths, required fields, allowed values) run on the record op as well as the entry op, in all seven integrity zomes.
