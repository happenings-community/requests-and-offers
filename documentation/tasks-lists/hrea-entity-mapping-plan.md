# hREA Entity Mapping Plan

Roadmap for completing hREA (Holochain Resource-Event-Agent) integration in the Requests and Offers application. This plan covers the remaining work needed to achieve a full ValueFlows economic lifecycle.

**Architecture**: Dual-DNA hybrid — a custom `requests_and_offers` DNA (rich domain model, admin workflows) bridged to the pre-built `hrea.dna` via a frontend event-driven mapping layer (`hrea.store.svelte.ts` + `hrea.service.ts`). This approach was validated through comparative analysis with the Carbon Farm Network (CFN), a production hREA implementation.

## Completed Work Summary

The foundational entity mapping pipeline code is in place. Phase 1 code is complete but proposal creation is not yet working end-to-end at runtime (see Phase 1 status below).

- **Users → Person Agents** — Event-driven mapping via `storeEventBus`, action hash reference system ✅
- **Organizations → Organization Agents** — Same pattern with retroactive mapping support ✅
- **Service Types → Resource Specifications** — Status-aware mapping (only approved types), event-driven ✅
- **Mediums of Exchange → Resource Specifications** — Distinct classification, status-aware mapping ✅
- **Requests → Proposals + Intents** — Two-intent reciprocal pattern via explicit `proposeIntent` (CFN pattern) ✅ (code complete)
- **Offers → Proposals + Intents** — Same pattern with provider/receiver role reversal ✅ (code complete)
- **Event-driven bridge architecture** — `storeEventBus` decouples domain stores from hREA logic ✅
- **Action hash reference system** — `ref:entityType:actionHash` in note fields for independent updates ✅
- **GraphQL infrastructure** — Apollo + SchemaLink with full CRUD for Agents, ResourceSpecs, Proposals, Intents ✅
- **UI visualization** — hREA test interface with tabbed entity managers, sync controls, and analytics ✅
- **Comprehensive test suite** — Agent mappings, proposal mappings, mapper tests, action hash references, manual sync operations ✅
- **Pending queue + retry pattern** — Requests/offers queued when prerequisites missing, retried on prerequisite creation ✅ (code complete)
- **Graceful fallback for missing zome functions** — `E.catchAll` returns empty arrays instead of crashing ✅
- **Archived status** — Rust zome `Archived` variant + conditional organization deletion (pending=hard delete, accepted+=archive) ✅

All 343 unit tests passing across 20 files. See `ui/tests/unit/stores/hrea.store.test.ts` and `ui/tests/unit/services/mappers/` for coverage.

## Known Bug: Missing hREA DNA Zome Functions

**Status**: Upstream bug in hREA `happ-0.3.4-beta` — **mitigated with graceful fallbacks**

The GraphQL schema layer expects `get_all_intents` and `get_all_commitments` zome functions that **do not exist** in the hREA DNA. This affects direct queries for these entity types.

| Zome Function | Status | Mitigation |
|---|---|---|
| `get_all_proposals` | **MISSING** | `E.catchAll` returns empty array |
| `get_all_intents` | **MISSING** | `E.catchAll` returns empty array |
| `get_all_commitments` | **MISSING** — will break commitment queries | Not yet needed |
| `get_all_agents`, `get_all_economic_events`, `get_all_agreements` | Working | N/A |

**Mitigation**: Service methods (`getProposals`, `getIntents`, `getIntentsByProposal`, `getProposalsByAgent`) use `E.catchAll` to detect "doesn't exist" errors and return empty arrays with console warnings. This prevents UI crashes.

**Workaround for data access**: Use proposals as the primary access pattern for intents (via `publishes` and `reciprocal` fields). Intent IDs are also tracked locally in `requestProposalIntentMappings` / `offerProposalIntentMappings` as a fallback.

**Long-term**: Report upstream, consider building hREA from source to add missing functions, or monitor for new releases.

## GraphQL Layer Gaps (CFN Comparison)

Detailed comparison of our GraphQL fragments and mutations against CFN's production patterns revealed several concrete gaps that need to be addressed for functional hREA integration.

### Intent Fragment Gap

Our `INTENT_FRAGMENT` is severely underspecified — it only returns 3 fields, while CFN's production fragments include the full intent structure needed for proposal display and matching.

**Current** (`ui/src/lib/graphql/fragments/intent.fragments.ts`):
```graphql
fragment IntentFragment on Intent {
  id
  action        # ← string, but hREA returns { id, label, symbol }
  revisionId
}
```

**CFN production pattern** (what we need):
```graphql
fragment IntentFragment on Intent {
  id
  revisionId
  action { id label symbol }
  provider { id name }
  receiver { id name }
  resourceConformsTo { id name }
  resourceQuantity {
    hasNumericalValue
    hasUnit { id label symbol }
  }
  note
}
```

**Impact**: Intent queries and `GET_INTENTS_BY_PROPOSAL_QUERY` return nearly empty objects, making it impossible to display intent details or match proposals.

### Proposal Fragment Gap

Our `PROPOSAL_FRAGMENT` lacks nested intent arrays. CFN's proposals always include their `publishes` (primary intents) and `reciprocal` (payment intents) — this is the primary way to access intents when `get_all_intents` is missing.

**Current** (`ui/src/lib/graphql/fragments/proposal.fragments.ts`):
```graphql
fragment ProposalFragment on Proposal {
  id
  name
  note
  created
  revisionId
  # Missing: hasBeginning, hasEnd, unitBased
  # Missing: publishes[...IntentFragment], reciprocal[...IntentFragment]
}
```

**CFN production pattern**:
```graphql
fragment ProposalFragment on Proposal {
  id
  name
  note
  created
  revisionId
  hasBeginning
  hasEnd
  unitBased
  publishes {
    ...IntentFragment
  }
  reciprocal {
    ...IntentFragment
  }
}
```

**Impact**: Without nested `publishes`/`reciprocal`, there is no way to retrieve intents through proposals — which is the recommended workaround for the missing `get_all_intents` zome function.

### Delete Mutation Bug

Both `DELETE_PROPOSAL_MUTATION` and `DELETE_INTENT_MUTATION` use `$id: ID!` but the hREA API expects `$revisionId: ID!` for delete operations. This means all delete operations will fail at runtime.

**Current** (broken):
```graphql
mutation DeleteProposal($id: ID!) {
  deleteProposal(id: $id)
}

mutation DeleteIntent($id: ID!) {
  deleteIntent(id: $id)
}
```

**Correct** (hREA API):
```graphql
mutation DeleteProposal($revisionId: ID!) {
  deleteProposal(revisionId: $revisionId)
}

mutation DeleteIntent($revisionId: ID!) {
  deleteIntent(revisionId: $revisionId)
}
```

**Impact**: Proposal and intent deletion (Phase 1 tasks 1.3 and 1.4) will fail at runtime. The hREA store already tracks `revisionId` but passes it to the wrong parameter name.

### Action Type Mismatch

We treat `action` as a plain string throughout our types and fragments, but hREA's GraphQL schema returns `action` as an object with `{ id, label, symbol }`. Our `CREATE_INTENT_MUTATION` response already queries `action` as a flat field — this will either return `null` or an `[Object]` string representation.

**Our code**: `action: 'work'` (string)
**hREA reality**: `action: { id: 'work', label: 'Work', symbol: '🔨' }` (object)

**Impact**: Any code that compares `action === 'work'` or uses `action` as a string will break. Types in `hrea.ts` need updating.

### Missing Temporal Fields

Our `CREATE_PROPOSAL_MUTATION` and proposal fragments don't include `hasBeginning`, `hasEnd`, or `unitBased`. CFN uses these for:
- **`hasBeginning`**: When the proposal becomes active
- **`hasEnd`**: Availability toggle (`null` = available, `<date>` = expired/unavailable)
- **`unitBased`**: Whether the proposal is quantity-based (e.g., "10 hours of consulting")

**Impact**: Cannot implement availability management (Phase 2.3) or quantity-based proposals without these fields.

## Remaining Work

### Phase 1: Make Proposal Mapping Functional End-to-End

**Status**: Code complete for core mapping (1.1–1.7). GraphQL layer needs enrichment (1.8). NOT WORKING at runtime — requires debugging.

**Goal**: Fix GraphQL fragments/mutations to match hREA API expectations (1.8), then debug the end-to-end runtime flow.

#### Completed Subtasks (1.1–1.7)

- **1.1: Acceptance Event Emission** — Added `emitUserAccepted`/`emitOrganizationAccepted` helpers; fixed stale object bug with updated `status_type: 'accepted'` before emitting
- **1.2: Explicit `proposeIntent` with Reciprocal Flag (CFN Pattern)** — Switched from `publishes` shorthand to explicit `proposeIntent(reciprocal)` calls; mappers return `isReciprocal` metadata
- **1.3: Proposal Cleanup on Deletion** — Delete handlers for `request:deleted`/`offer:deleted` that cascade to intents → proposal; fallback to locally tracked intent IDs
- **1.4: Proposal Update Handling** — Delete-and-recreate pattern for `request:updated`/`offer:updated`
- **1.5: Archived Status + Conditional Org Deletion** — Rust `Archived` variant + frontend schema/type updates; composable uses archive for accepted orgs, hard delete for pending
- **1.6: Retroactive Proposal Creation** — `createRetroactiveProposalMappings()` exposed for manual use from test-page components
- **1.7: Intent ID Tracking + Pending Queue** — `requestProposalIntentMappings`/`offerProposalIntentMappings` for deletion fallback; `pendingRequestQueue`/`pendingOfferQueue` with `retryPendingProposals()`

#### Phase 1 Runtime Debugging (NEXT STEP)

All Phase 1 code is in place but proposals are not being created at runtime. Debugging checklist:

1. **Verify event chain**: Open browser console, look for `hREA Store:` log messages
2. **Check agent creation**: Approve user → look for "Creating Person Agent" log
3. **Check resource spec creation**: Approve service type / medium of exchange → look for "creating ResourceSpecification" log
4. **Check proposal creation**: Create request → look for "auto-creating proposal" followed by either success or "Queued" message
5. **Check retry**: After agent/resource spec created → look for "Retrying N pending requests" log
6. **Suspects**:
   - Event subscription timing (is hREA store initialized before events fire?)
   - Apollo client initialization (is `state.apolloClient` set?)
   - Note format matching in `findAgentByActionHash` (does `ref:user:` format match?)
   - Are service types and mediums of exchange actually approved?

#### 1.8: Enrich GraphQL Fragments and Fix Mutations

- [ ] Enrich `INTENT_FRAGMENT` with full fields: `provider { id name }`, `receiver { id name }`, `resourceConformsTo { id name }`, `resourceQuantity { hasNumericalValue, hasUnit { id label symbol } }`, `action` as object `{ id label symbol }`, `note`
- [ ] Enrich `INTENT_DETAILED_FRAGMENT` with same fields (currently identical to `INTENT_FRAGMENT`)
- [ ] Enrich `PROPOSAL_FRAGMENT` with `hasBeginning`, `hasEnd`, `unitBased`, nested `publishes { ...IntentFragment }`, `reciprocal { ...IntentFragment }`
- [ ] Enrich `PROPOSAL_DETAILED_FRAGMENT` with same additions (already has partial `publishedIn` but missing `reciprocal` and temporal fields)
- [ ] Fix `DELETE_PROPOSAL_MUTATION` to use `$revisionId: ID!` instead of `$id: ID!`
- [ ] Fix `DELETE_INTENT_MUTATION` to use `$revisionId: ID!` instead of `$id: ID!`
- [ ] Update `CREATE_PROPOSAL_MUTATION` to include `hasBeginning`, `hasEnd`, `unitBased` in response fields
- [ ] Update hREA service `createProposal` / `updateProposal` to accept and pass temporal fields (`hasBeginning`, `hasEnd`, `unitBased`)
- [ ] Update hREA types (`ui/src/lib/types/hrea.ts`) to reflect richer Intent structure (action as `{ id: string; label: string; symbol: string }`, add provider/receiver/resourceConformsTo/resourceQuantity fields)
- [ ] Update hREA types for Proposal to include `hasBeginning`, `hasEnd`, `unitBased`, `publishes`, `reciprocal`
- [ ] Update hREA store delete methods to pass `revisionId` instead of `id` to delete mutations

**Files**:
- `ui/src/lib/graphql/fragments/intent.fragments.ts`
- `ui/src/lib/graphql/fragments/proposal.fragments.ts`
- `ui/src/lib/graphql/mutations/proposal.mutations.ts`
- `ui/src/lib/graphql/mutations/intent.mutations.ts`
- `ui/src/lib/services/hrea.service.ts`
- `ui/src/lib/types/hrea.ts`
- `ui/src/lib/stores/hrea.store.svelte.ts`

#### Phase 1 Verification (once runtime issues fixed)

1. Build zomes: `nix develop --command bun build:zomes`
2. Unit tests: `nix develop --command bun test:unit` (343 tests across 20 files)
3. Frontend tests: `cd ui && bun run test:unit`
4. Manual E2E (`bun start`):
   - Create user → approve → verify hREA Agent created (1.1)
   - Create request as approved user → verify Proposal + Intents with reciprocal flags (1.2)
   - Create offer → verify same (1.2)
   - Delete request → verify Proposal + Intents cleaned up (1.3)
   - Update offer → verify Proposal recreated (1.4)
   - Delete pending org → verify hard delete (1.5)
   - Delete accepted org → verify archived status, UI hidden, Agent preserved (1.5)
   - Approve user with existing requests → verify retroactive proposals (1.6)
5. hREA test page: inspect entities and verify proposal-intent linkage with reciprocal flags

### Phase 2: Exchange Process — Agreement + Commitment Flow

**Status**: Not started — this is the biggest missing piece

This phase implements the downstream economic lifecycle that turns matched proposals into tracked commitments. CFN demonstrates the complete pattern.

#### 2.1: Agreement Creation on Proposal Match

When a request matches an offer, create an `Agreement` linking paired `Commitment` entities:

```
Agreement
  ├── Commitment (primary: service delivery)
  │     action='work', provider=offerer, receiver=requester
  │     resourceConformsTo=serviceTypeResourceSpec
  └── Commitment (reciprocal: payment)
        action='transfer', provider=requester, receiver=offerer
        resourceConformsTo=mediumOfExchangeResourceSpec
```

CFN uses `clauseOf` to link commitments back to their parent agreement.

- [ ] Create Agreement + Commitment GraphQL infrastructure
  - [ ] `ui/src/lib/graphql/fragments/agreement.fragments.ts`
  - [ ] `ui/src/lib/graphql/fragments/commitment.fragments.ts`
  - [ ] `ui/src/lib/graphql/queries/agreement.queries.ts`
  - [ ] `ui/src/lib/graphql/queries/commitment.queries.ts`
  - [ ] `ui/src/lib/graphql/mutations/agreement.mutations.ts`
  - [ ] `ui/src/lib/graphql/mutations/commitment.mutations.ts`
- [ ] Add Agreement and Commitment schemas to `ui/src/lib/schemas/hrea.schemas.ts`
- [ ] Add Agreement and Commitment types to `ui/src/lib/types/hrea.ts`
- [ ] Extend `ui/src/lib/services/hrea.service.ts` with Agreement/Commitment CRUD operations
- [ ] Create `ui/src/lib/services/mappers/exchange-flow.mapper.ts` — orchestrates Agreement + Commitment creation from matched proposals
- [ ] Add exchange state management to `hrea.store.svelte.ts` or create dedicated `economic-flow.store.svelte.ts`

#### 2.2: Proposal Discovery and Matching UI

- [ ] Implement proposal browsing/discovery interface for users
- [ ] Build matching logic — find compatible request/offer pairs
- [ ] Create acceptance UI flow that triggers Agreement + Commitment creation
- [ ] Implement `exchange:created` event for the bridge layer

#### 2.3: Availability Management

CFN uses `hasEnd` on Proposals to toggle availability:
- `hasEnd: null` → proposal is available
- `hasEnd: <date>` → proposal is unavailable/expired

Consider adopting this pattern as a complement to the custom `ListingStatus` field.

CFN also uses `unitBased: true` on proposals for quantity-based offerings (e.g., "10 hours of consulting").

### Phase 3: Economic Event Tracking & Fulfillment

**Status**: Not started — completes the ValueFlows economic lifecycle

CFN implements the full lifecycle from commitment through actual exchange:

```
Commitment → EconomicEvent → Fulfillment → (links back to Commitment)
                  ↓
            EconomicResource (inventory/resource tracking)
```

Our architecture adds a **feedback-conditional gate** before economic event creation — events are only created after positive feedback (see `documentation/architecture/hrea-integration.md`).

- [ ] Create Satisfaction GraphQL infrastructure (links intents → commitments)
  - [ ] `ui/src/lib/graphql/fragments/satisfaction.fragments.ts`
  - [ ] `ui/src/lib/graphql/mutations/satisfaction.mutations.ts`
- [ ] Create EconomicEvent GraphQL infrastructure
  - [ ] `ui/src/lib/graphql/fragments/economicEvent.fragments.ts`
  - [ ] `ui/src/lib/graphql/queries/economicEvent.queries.ts`
  - [ ] `ui/src/lib/graphql/mutations/economicEvent.mutations.ts`
- [ ] Create Fulfillment GraphQL infrastructure (links events → commitments)
  - [ ] `ui/src/lib/graphql/fragments/fulfillment.fragments.ts`
  - [ ] `ui/src/lib/graphql/mutations/fulfillment.mutations.ts`
- [ ] Add EconomicResource queries (read-only for now)
  - [ ] `ui/src/lib/graphql/queries/economicResource.queries.ts`
- [ ] Add schemas and types for EconomicEvent, Fulfillment, Satisfaction, EconomicResource
- [ ] Extend hREA service with event/fulfillment operations
- [ ] Implement feedback-conditional gate: positive feedback → create EconomicEvent → create Fulfillment
- [ ] Extend mapper service for the full fulfillment flow

### Phase 4: Data Migration & Sync

**Status**: Not started

- [ ] Build bulk migration scripts for existing entities
  - [ ] Users → Person Agents (accepted users only)
  - [ ] Organizations → Organization Agents (accepted orgs only)
  - [ ] Service Types → Resource Specifications (approved types only)
  - [ ] Requests → Proposals + Intents
  - [ ] Offers → Proposals + Intents
- [ ] Create data integrity validation tools
  - [ ] Verify bidirectional references between custom entities and hREA entities
  - [ ] Detect orphaned or inconsistent mappings
- [ ] Implement conflict resolution mechanisms
  - [ ] Handle failed mapping rollbacks
  - [ ] Create monitoring for sync failures

### Phase 5: Testing & Validation

**Status**: Unit tests complete for Phase 1 — integration and economic flow tests remain

Completed:
- [x] Agent mapping tests (user → person, org → organization)
- [x] Action hash reference extraction tests
- [x] Request → Proposal + Intent mapper tests (14 tests in `request-proposal.mapper.test.ts`)
- [x] Offer → Proposal + Intent mapper tests (14 tests in `offer-proposal.mapper.test.ts`)
- [x] Proposal mapping state and interface tests
- [x] Proposal deletion handling tests
- [x] Retroactive proposal creation tests
- [x] Store interface assertion tests (all public methods)

Remaining:
- [ ] Integration tests for full economic flow
  - [ ] Complete request-offer matching → agreement → commitment flow
  - [ ] Feedback process integration and economic event creation
  - [ ] Data migration scripts with real data sets
- [ ] Performance testing
  - [ ] Large dataset performance with GraphQL operations
  - [ ] Caching strategy validation

### Phase 6: Future Considerations

- [ ] **Consider migrating from GraphQL to direct zome calls** — CFN did this successfully, replacing Apollo/SchemaLink overhead with direct `@holochain/client` calls. Their entire GraphQL layer became dead code. This could simplify our data access layer significantly.
- [ ] **Process/Plan model** — For complex multi-step service delivery, CFN demonstrates Plan → Process → Commitment chains. Natural extension if services become more complex.
- [ ] **Feedback system integration** — Connect our custom feedback system to hREA economic events (see architecture doc for conditional fulfillment pattern).
- [ ] **Reputation system** — Build agent reputation scores based on feedback history and economic event completion rates.
- [ ] **Add `hrea_agent_id` / `hrea_resource_spec_id` fields to Rust zomes** — Bidirectional linking at the DNA level (currently using note-field references).

## CFN Architectural Insights

Learnings from studying the Carbon Farm Network, a production hREA Holochain application:

### CFN's Pure-hREA Approach vs Our Hybrid Approach

| Aspect | CFN (Pure hREA) | R&O (Hybrid) |
|---|---|---|
| **Backend** | Single `hrea.dna` only | Custom DNA + `hrea.dna` |
| **Custom Rust code** | None | 6 integrity + 7 coordinator zomes |
| **Domain richness** | Limited to ValueFlows fields | Rich fields: `ContactPreference`, `TimePreference`, `DateRange`, `time_estimate_hours` |
| **Admin workflows** | None | Progenitor-based pending/approved/rejected |
| **Economic lifecycle** | Full: Intent → Commitment → Event → Resource | Partial: through Proposal + Intent |
| **hREA access** | Direct zome calls (`@holochain/client`) | GraphQL via Apollo + SchemaLink |

**Conclusion**: Our dual-DNA approach is valid and provides real advantages (richer domain model, admin workflows, domain-specific validation). CFN's patterns inform what comes next in our economic lifecycle.

### CFN's Key Patterns to Adopt

**Offer vs Request Filtering**: In pure hREA, offers and requests are structurally identical Proposals. The difference is purely in which intent has a `provider` set:
- **Offer**: Primary intent has `provider` (someone providing something)
- **Request**: Reciprocal intent has `provider` (someone requesting something)

Our system already implements this pattern through the two-intent reciprocal structure, with the role assignment handled by the mapper services.

**Agreement + Commitment Pattern**: CFN's most valuable pattern we're missing. When proposals match:
1. Create `Agreement` with `clauseOf` linking commitments
2. Primary commitment (service delivery) + reciprocal commitment (payment)
3. `Fulfillment` entities link `EconomicEvent` back to `Commitment`

**Availability Toggle**: CFN uses `hasEnd` on Proposals:
- `null` = available, `<date>` = unavailable
- `unitBased: true` for quantity-based proposals

**Explicit ProposedIntent Linking**: CFN creates proposal-intent links explicitly via `createProposedIntent(reciprocal, publishedIn, publishes)` rather than relying on a `publishes` shorthand in `ProposalCreateParams`. The `reciprocal` flag distinguishes service intents from payment intents. ✅ Adopted in Phase 1.

**Data Transformation Pipeline**: CFN implemented comprehensive data transformers between raw hREA zome responses and UI-ready objects. Our mapper services (`request-proposal.mapper.ts`, `offer-proposal.mapper.ts`) follow a similar pattern.

**GraphQL Fragment Richness**: Our fragments are significantly weaker than CFN's production patterns. See the [GraphQL Layer Gaps](#graphql-layer-gaps-cfn-comparison) section above for a detailed comparison table and before/after code examples. Task 1.8 addresses all identified gaps.

**GraphQL-to-Zome-Call Migration**: CFN's entire GraphQL layer became dead code after migrating to direct zome calls. The direct approach is simpler and avoids Apollo overhead. Worth considering once our economic flow is more mature.

## Relevant Files

### Core hREA Infrastructure

- `ui/src/lib/stores/hrea.store.svelte.ts` — Central bridge store with event-driven mapping, pending queue, retry logic
- `ui/src/lib/services/hrea.service.ts` — GraphQL operations for all hREA entity types, graceful fallbacks
- `ui/src/lib/services/mappers/request-proposal.mapper.ts` — Request → Proposal + Intents mapping with `isReciprocal`
- `ui/src/lib/services/mappers/offer-proposal.mapper.ts` — Offer → Proposal + Intents mapping with `isReciprocal`
- `ui/src/lib/schemas/hrea.schemas.ts` — Effect Schema validation for hREA entities
- `ui/src/lib/types/hrea.ts` — TypeScript type definitions for hREA entities
- `ui/src/lib/stores/storeEvents.ts` — Event bus definitions for domain events

### Phase 1 Modified Files

- `ui/src/lib/stores/administration.store.svelte.ts` — Emits `user:accepted` / `organization:accepted`, fixed stale user object
- `ui/src/lib/graphql/mutations/intent.mutations.ts` — Added `reciprocal` param to `PROPOSE_INTENT_MUTATION`
- `ui/src/lib/types/holochain.ts` — Added `'archived'` to `StatusType`
- `ui/src/lib/schemas/administration.schemas.ts` — Added `Schema.Literal('archived')` to `StatusTypeSchema`
- `ui/src/lib/composables/domain/organizations/useOrganizationsManagement.svelte.ts` — Conditional deletion (hard delete vs archive) + updated confirmation messages
- `dnas/requests_and_offers/zomes/integrity/administration/src/status.rs` — Added `Archived` variant to `StatusType`

### Test Files

- `ui/tests/unit/stores/hrea.store.test.ts` — 21 tests for hREA store (agents, proposals, deletion, retroactive)
- `ui/tests/unit/services/mappers/request-proposal.mapper.test.ts` — 14 tests for request mapper
- `ui/tests/unit/services/mappers/offer-proposal.mapper.test.ts` — 14 tests for offer mapper

### GraphQL Layer

- `ui/src/lib/graphql/mutations/agent.mutations.ts`
- `ui/src/lib/graphql/mutations/resourceSpecification.mutations.ts`
- `ui/src/lib/graphql/mutations/proposal.mutations.ts`
- `ui/src/lib/graphql/mutations/intent.mutations.ts`
- `ui/src/lib/graphql/queries/agent.queries.ts`
- `ui/src/lib/graphql/queries/proposal.queries.ts`
- `ui/src/lib/graphql/queries/intent.queries.ts`

### Files to Create (next phases)

- `ui/src/lib/graphql/{fragments,queries,mutations}/agreement.*` — Agreement GraphQL layer
- `ui/src/lib/graphql/{fragments,queries,mutations}/commitment.*` — Commitment GraphQL layer
- `ui/src/lib/graphql/{fragments,queries,mutations}/satisfaction.*` — Satisfaction GraphQL layer
- `ui/src/lib/graphql/{fragments,queries,mutations}/economicEvent.*` — EconomicEvent GraphQL layer
- `ui/src/lib/graphql/{fragments,mutations}/fulfillment.*` — Fulfillment GraphQL layer
- `ui/src/lib/graphql/queries/economicResource.queries.ts` — EconomicResource queries
- `ui/src/lib/services/mappers/exchange-flow.mapper.ts` — Agreement + Commitment orchestration

### Documentation

- `documentation/architecture/hrea-integration.md` — Economic flow architecture with feedback-conditional model
- `documentation/assets/images/requests-and-offers-hrea-mapping.png` — Visual mapping diagram

### Key Dependencies

- `@valueflows/vf-graphql-holochain@^0.0.3-alpha.10` — hREA v0.3.2 GraphQL integration
- `@apollo/client@^3.13.8` — GraphQL client
- `graphql@^16.8.0` — Core GraphQL library
- hREA DNA (`happ-0.3.4-beta`) — Holochain 0.6.x compatible
