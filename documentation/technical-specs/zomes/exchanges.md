# Exchanges Zome (`exchanges_integrity`, `exchanges_coordinator`)

## 1. Overview

- **Purpose**: Records what two members agreed and what happened, as six append-only entry types. An exchange starts when a member registers interest in a listing, becomes an agreement when either party writes the terms up, and accumulates a response, two completions, two reviews or a cancellation as it runs.
- **Status**: Shipped in v0.6.0-alpha.1 (#239) as the interim record. The hREA mirror (#250, #255) maps it onto Valueflows commitments and events; the mirror replaces the storage, not the meaning.
- **Status is derived, never stored**: no entry carries a state field. `derive_status` reads the entries present and returns one of seven states, so two agents reading the same DHT data reach the same answer with no write to disagree about.
- **Append-only**: updates are refused outright, and only an `Interest` may be deleted, by its own author. The rules live in validation rather than in the coordinator, so a hand-rolled client cannot bypass them.
- **Zome structure**:
  - `exchanges_integrity`: entry and link definitions, and every validation rule.
  - `exchanges_coordinator`: the callable surface, the party derivation, and the read model.

The reasoning behind the six-entry shape: [`documentation/architecture/EXCHANGE_RECORD.md`](../../architecture/EXCHANGE_RECORD.md).

## 2. Integrity Zome (`exchanges_integrity`)

### 2.1. Entry Types

```rust
pub struct Interest {
  pub listing: ActionHash,      // Create of an Offer or a Request
  pub listing_type: ListingType,
  pub user: ActionHash,         // the interested member's user Create
}

pub struct Agreement {
  pub listing: ActionHash,
  pub listing_type: ListingType,
  pub interest: ActionHash,
  pub counterparty: ActionHash, // the party who owes the answer
  pub provider: ActionHash,
  pub receiver: ActionHash,
  pub primary: ExchangeTerm,    // the service provided
  pub reciprocal: ExchangeTerm, // what the provider receives
  pub medium: String,
  pub terms: String,
  pub delivery_timeframe: String,
}

pub struct Response { pub agreement: ActionHash, pub accepted: bool, pub note: String }
pub struct Completion { pub agreement: ActionHash }
pub struct Review { pub agreement: ActionHash, pub rating: u8, pub on_time: bool, pub as_agreed: bool, pub comment: String }
pub struct Cancellation { pub agreement: ActionHash, pub note: String }
```

`ExchangeTerm` carries a `direction` (`Provide` / `Receive`), a `resource_conforms_to` string, a `resource_kind` (`Service` / `Currency` / `Gift` / `Tbd`) and an optional `Quantity { value: f64, unit: String }`.

### 2.2. Validation Rules

Validation may read only what the entry names, through `must_get_valid_record`; it reads no links and no live state. Every referenced hash must resolve to a **Create**, so no entry can hang off an update or a delete.

| Entry | Who may write it | What must hold |
|---|---|---|
| `Interest` | the member the `user` hash resolves to | the listing is a Create; the interest names its own author's user |
| `Agreement` | either party | provider, receiver and counterparty agree with the listing type and its parties; primary is `Provide` + `Service`; reciprocal is `Receive`; both terms pass the kind rule; `medium` is not blank |
| `Response` | the agreement's `counterparty` only | the agreement is a Create |
| `Completion` | either party | the agreement is a Create |
| `Review` | either party | `rating` is 0 to 5 (a `u8`, so negatives cannot be expressed) |
| `Cancellation` | either party | the agreement is a Create |

**The kind rule** (`validate_term`): a `Gift` or `Tbd` term names no resource and carries no quantity; a `Service` or `Currency` term names the specification it conforms to. Any quantity present must be finite, greater than zero, and carry a unit.

**Refused outright**: every update (`StoreRecord` update ops are invalid for all six types), every link delete, and every entry delete except an `Interest` deleted by its author.

### 2.3. Link Types

| Link | Base | Target | Purpose |
|---|---|---|---|
| `ListingInterests` | listing Create | `Interest` | who is interested in this listing |
| `UserInterests` | user Create | `Interest` | the member's own interests |
| `ListingAgreements` | listing Create | `Agreement` | agreements written against this listing |
| `UserAgreements` | user Create | `Agreement` | written for both parties, so either can list their exchanges |
| `AgreementResponses` | agreement Create | `Response` | the single answer |
| `AgreementCompletions` | agreement Create | `Completion` | one per party |
| `AgreementReviews` | agreement Create | `Review` | one per party |
| `AgreementCancellations` | agreement Create | `Cancellation` | the cancellation, if any |

## 3. Coordinator Zome (`exchanges_coordinator`)

### 3.1. Derived state

`derive_status` reads the entries and returns, in this order:

| Condition | Status |
|---|---|
| a cancellation exists | `Cancelled` |
| no response yet | `Proposed` |
| response is not accepted | `Declined` |
| both parties completed, both reviewed | `Reviewed` |
| both parties completed | `Complete` |
| the provider completed | `ProviderDelivered` |
| otherwise | `Agreed` |

A cancellation written before any response reads as *withdrawn* rather than *cancelled* in the UI; the record does not distinguish them, the read does (`statusLabel` in `ui/src/lib/utils/exchange-ui.ts`).

> The `ProviderDelivered` row is the one being changed by #259, so that either party may mark their part done first. Update this table when it lands.

### 3.2. Functions

| Function | Input | Returns | Notes |
|---|---|---|---|
| `create_interest` | `CreateInterestInput` | `Record` | refuses a member's interest in their own listing |
| `withdraw_interest` | `ActionHash` | `ActionHash` | deletes the interest; the only delete the zome allows |
| `get_interests_for_listing` | `ActionHash` | `Vec<Record>` | |
| `get_my_interests` | `()` | `Vec<Record>` | |
| `create_agreement` | `CreateAgreementInput` | `Record` | parties derived here and re-derived in validation |
| `respond_to_agreement` | `RespondInput` | `Record` | the counterparty accepts or declines |
| `complete_agreement` | `ActionHash` | `Record` | one completion per party |
| `review_agreement` | `ReviewInput` | `Record` | |
| `cancel_agreement` | `CancelInput` | `Record` | |
| `get_exchange` | `ActionHash` | `Exchange` | the read model: agreement, children, derived status |
| `get_my_exchanges` | `()` | `Vec<Exchange>` | both roles, through `UserAgreements` |
| `get_exchanges_for_listing` | `ActionHash` | `Vec<Exchange>` | |

**The caller never names the parties.** `create_agreement` takes the listing, the interest and the terms; it reads the listing's author and the interest's author, decides provider, receiver and counterparty from the listing type, and writes them into the entry. Validation derives them again from the same records and refuses a mismatch, so a client that lies about who provides is refused rather than trusted.

### 3.3. Cross-zome interactions

`exchanges_coordinator` declares only `utils`, `hdk`, `serde` and `exchanges_integrity`, and calls exactly two other coordinators:

- `users_organizations`: `get_agent_user`, to resolve the acting agent to an accepted user.
- `administration`: `check_if_entity_is_accepted`, so a suspended member cannot write.

It has no dependency on messaging, and it should keep none: conversations arrive in alpha.2 beside the exchange process as a module, not under it.

## 4. Frontend layers

The domain follows the seven-layer architecture described in `CLAUDE.md`:

| Layer | Where |
|---|---|
| Service | `ui/src/lib/services/zomes/exchanges.service.ts` |
| Store | `ui/src/lib/stores/exchanges.store.svelte.ts` |
| Schema | `ui/src/lib/schemas/exchanges.schemas.ts` |
| Errors | `ui/src/lib/errors/exchanges.errors.ts` |
| Composables | `ui/src/lib/composables/domain/exchanges/` |
| Components | `ui/src/lib/components/exchanges/`, `ui/src/routes/(public)/exchanges/` |
| Testing | `tests/sweettest/tests/exchanges.rs`, `ui/tests/unit/**`, `ui/tests/e2e/specs/09-exchanges.spec.ts` |

Two decisions worth knowing before changing this code:

- **The schema layer mirrors the integrity zome, rule for rule, and is enforced at the store boundary** rather than in each form. A write the DHT would refuse is refused in the browser with a message a member can act on, and a new surface cannot forget to validate. Nothing in the schema file is stricter than the zome; a rule the zome does not enforce belongs in the composable that owns the form.
- **The store holds no cache.** Every read model is mutable by the counterparty from another agent, and the whole surface turns on whose move it is, so a cached read would tell a member the exchange is waiting on someone it is not. Revisit when signals replace the poll (#51, #213).

## 5. Testing status

- **Sweettest** (`tests/sweettest/tests/exchanges.rs`): the two-agent walk through the whole lifecycle, asserting the derived status from the other conductor at each step. Run with `--test-threads=1`: four tests in parallel is eight conductors on one machine and the consistency waits time out.
- **Unit**: the schema rules, the store's refusal to call the zome with an input the DHT would refuse, and the pure predicates behind the list and the detail page.
- **E2E** (`09-exchanges.spec.ts`): the interest and proposal path. The accept and complete transitions are the named gap.

## 6. Known gaps

| Gap | Where it is tracked |
|---|---|
| The zome's own `derive_status` unit tests | #258 |
| Either party marking their part done first | #259 |
| One service type per listing, enforced in the entry | #256, #257 |
| The hREA mirror of this record | #250, #255 |
| `get_agent_user` is the fifth copy of one shape across coordinators | #222 |
| The propose form's composable, and `UIExchange` moving into the schema file | after #256 lands |
