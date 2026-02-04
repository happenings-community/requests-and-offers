# hREA Entity Mapping Plan

Roadmap for completing hREA (Holochain Resource-Event-Agent) integration in the Requests and Offers application. This plan covers the remaining work needed to achieve a full ValueFlows economic lifecycle.

**Architecture**: Dual-DNA hybrid — a custom `requests_and_offers` DNA (rich domain model, admin workflows) bridged to the pre-built `hrea.dna` via a frontend event-driven mapping layer (`hrea.store.svelte.ts` + `hrea.service.ts`). This approach was validated through comparative analysis with the Carbon Farm Network (CFN), a production hREA implementation.

## Completed Work Summary

The foundational entity mapping pipeline code is in place, but has critical wiring issues (see Phase 1):

- **Users → Person Agents** — Event-driven mapping via `storeEventBus`, action hash reference system. *Issue: `user:accepted` event never emitted by administration store — agents not auto-created on approval.*
- **Organizations → Organization Agents** — Same pattern with retroactive mapping support. *Same issue.*
- **Service Types → Resource Specifications** — Status-aware mapping (only approved types), event-driven ✅
- **Mediums of Exchange → Resource Specifications** — Distinct classification, status-aware mapping ✅
- **Requests → Proposals + Intents** — Two-intent reciprocal pattern (service intent + payment intent). *Issue: `publishes` shorthand may not create ProposedIntent links; reciprocal flag not set.*
- **Offers → Proposals + Intents** — Same pattern with provider/receiver role reversal. *Same issue.*
- **Event-driven bridge architecture** — `storeEventBus` decouples domain stores from hREA logic ✅
- **Action hash reference system** — `ref:entityType:actionHash` in note fields for independent updates ✅
- **GraphQL infrastructure** — Apollo + SchemaLink with full CRUD for Agents, ResourceSpecs, Proposals, Intents ✅
- **UI visualization** — hREA test interface with tabbed entity managers, sync controls, and analytics ✅
- **Comprehensive test suite** — Agent mappings, action hash references, and manual sync operations ✅

All 268 unit tests passing. See `ui/tests/unit/stores/hrea.store.test.ts` for coverage.

## Known Bug: Missing hREA DNA Zome Functions

**Status**: Upstream bug in hREA `happ-0.3.4-beta`

The GraphQL schema layer expects `get_all_intents` and `get_all_commitments` zome functions that **do not exist** in the hREA DNA. This affects direct queries for these entity types.

| Zome Function | Status |
|---|---|
| `get_all_proposals` | Working |
| `get_all_intents` | **MISSING** — breaks `GET_INTENTS_QUERY()` |
| `get_all_commitments` | **MISSING** — will break commitment queries |
| `get_all_agents`, `get_all_economic_events`, `get_all_agreements` | Working |

**Workaround**: Use proposals as the primary access pattern for intents (via `publishes` and `reciprocal` fields). This aligns with ValueFlows best practices. The same pattern will apply to commitments — access them through their parent `Agreement`.

**Long-term**: Report upstream, consider building hREA from source to add missing functions, or monitor for new releases.

## Remaining Work

### Phase 1: Make Proposal Mapping Functional End-to-End

**Status**: In Progress — required before exchange process work

**Goal**: Wire the event-driven bridge so that the full lifecycle works: user acceptance → agent creation → request/offer creation → proposal + intent creation (with proper reciprocal flags) → proposal cleanup on delete/update. Also implement conditional organization deletion with `Archived` status.

#### Critical Issues Discovered

1. **Acceptance events never emitted**: The hREA store subscribes to `user:accepted` / `organization:accepted`, but the administration store only emits `user:status:updated` / `organization:status:updated`. Agents are never auto-created on approval.
2. **Proposal-intent linking may be broken**: `createProposal` passes `publishes: [intentIds]` as a param, but `publishes` is a relationship field that may be silently dropped by hREA's `ProposalCreateParams`. CFN uses explicit `proposeIntent` calls. Additionally, the `PROPOSE_INTENT_MUTATION` is missing the `reciprocal` parameter.
3. **No deletion/update handlers for proposals**: `request:deleted`, `offer:deleted`, `request:updated`, `offer:updated` events are emitted but hREA store doesn't listen. Results in orphaned or stale proposals.
4. **Stale user object emitted on approval**: `approveUser` emits the original user object (pre-approval status), not the updated one.

#### 1.1: Fix Acceptance Event Emission

- [ ] Add `emitUserAccepted` / `emitOrganizationAccepted` helpers to `createEventEmitters()` in `administration.store.svelte.ts`
- [ ] Call both from `approveUser` / `approveOrganization` alongside existing `emitUserStatusUpdated` / `emitOrganizationStatusUpdated`
- [ ] Fix stale object bug: construct updated entity with `status_type: 'accepted'` before emitting

**File**: `ui/src/lib/stores/administration.store.svelte.ts`

#### 1.2: Switch to Explicit `proposeIntent` with Reciprocal Flag (CFN Pattern)

Adopt CFN's production pattern: create proposal → create intents → link each intent to proposal via `proposeIntent(reciprocal)`.

- [ ] Update `PROPOSE_INTENT_MUTATION` to include `reciprocal: Boolean` parameter
- [ ] Update `hrea.service.ts` `proposeIntent` to accept and pass `reciprocal` flag
- [ ] Update mapper return types to include `isReciprocal` metadata on each intent (service intents → `false`, payment intent → `true`)
- [ ] Refactor `createProposalFromRequest` and `createProposalFromOffer` in hREA store:
  - Old flow: create intents → create proposal with `publishes: [intentIds]`
  - New flow: create proposal (name + note only) → create intents → `proposeIntent(proposalId, intentId, reciprocal)` for each

**Files**:
- `ui/src/lib/graphql/mutations/intent.mutations.ts`
- `ui/src/lib/services/hrea.service.ts`
- `ui/src/lib/services/mappers/request-proposal.mapper.ts`
- `ui/src/lib/services/mappers/offer-proposal.mapper.ts`
- `ui/src/lib/types/hrea.ts`
- `ui/src/lib/stores/hrea.store.svelte.ts`

#### 1.3: Proposal Cleanup on Request/Offer Deletion

- [ ] Create `deleteProposalForRequest(requestHash)` and `deleteProposalForOffer(offerHash)` in hREA store
  - Lookup proposal from mapping → get linked intents → delete intents → delete proposal → remove from state
  - Fallback: use locally tracked intent IDs if `getIntentsByProposal` fails (known hREA bug)
- [ ] Add `handleRequestDeleted` / `handleOfferDeleted` event handlers
- [ ] Subscribe to `request:deleted` / `offer:deleted` in `createEventSubscriptions`
- [ ] Expose delete methods on public interface for manual use

**File**: `ui/src/lib/stores/hrea.store.svelte.ts`

#### 1.4: Proposal Update Handling (Delete + Recreate)

- [ ] Create `handleRequestUpdated` / `handleOfferUpdated` event handlers (delete old proposal via 1.3, then create new one)
- [ ] Subscribe to `request:updated` / `offer:updated` in `createEventSubscriptions`

**File**: `ui/src/lib/stores/hrea.store.svelte.ts`

#### 1.5: Add `Archived` Status + Conditional Organization Deletion

**Decision**: Add persistent `Archived` variant to the Rust `StatusType` enum (requires Nix + zome rebuild).

**Rust zome changes** (requires `nix develop`):
- [ ] Add `Archived` to `StatusType` enum in `dnas/.../integrity/administration/src/status.rs`
- [ ] Add `"archived"` to `FromStr::from_str` match + add `Status::archive()` convenience method
- [ ] In coordinator `update_status`: when transitioning to `"archived"`, delete `AcceptedEntity` link (so archived orgs don't appear in accepted queries)

**Frontend type/schema updates**:
- [ ] Add `'archived'` to `StatusType` in `ui/src/lib/types/holochain.ts`
- [ ] Add `Schema.Literal('archived')` to `StatusTypeSchema` in `ui/src/lib/schemas/administration.schemas.ts`

**Conditional deletion in organization store**:
- [ ] Modify `deleteOrganization` in `organizations.store.svelte.ts`:
  - **Pending orgs**: hard delete (existing behavior)
  - **Accepted/post-acceptance orgs**: update status to `'archived'` instead of deleting, then remove from local UI state
- [ ] Update confirmation messages in `useOrganizationsManagement.svelte.ts`:
  - Pending: "Delete this organization? This cannot be undone."
  - Accepted+: "Archive this organization? It will be hidden but its economic history will be preserved."
- [ ] In hREA store: add handler for archived organizations — Agent persists, no cleanup needed

**Note**: Users don't have a `deleteUser` function — no user-side changes needed.

**Files**:
- `dnas/requests_and_offers/zomes/integrity/administration/src/status.rs`
- `dnas/requests_and_offers/zomes/coordinator/administration/src/status.rs`
- `ui/src/lib/types/holochain.ts`
- `ui/src/lib/schemas/administration.schemas.ts`
- `ui/src/lib/stores/organizations.store.svelte.ts`
- `ui/src/lib/composables/domain/organizations/useOrganizationsManagement.svelte.ts`
- `ui/src/lib/stores/hrea.store.svelte.ts`

#### 1.6: Retroactive Proposal Creation When Agent Is Created

- [ ] Create `createRetroactiveProposalMappings(requests, offers)` following the pattern of `createRetroactiveMappings`
  - For each request/offer without a proposal mapping: skip if creator has no agent mapping, otherwise call `createProposalFromRequest`/`createProposalFromOffer`
- [ ] Add to `HreaStore` type interface and public return object
- [ ] Call from test-page components or app initialization (following existing `PersonAgentManager.svelte` / `OrganizationAgentManager.svelte` pattern)

**File**: `ui/src/lib/stores/hrea.store.svelte.ts`

#### 1.7: Intent ID Tracking (Safety Measure)

As a fallback for the known `get_all_intents` bug:
- [ ] Add `requestProposalIntentMappings` and `offerProposalIntentMappings` (`Map<string, string[]>`) to store state
- [ ] Populate when creating proposals (1.2)
- [ ] Use as fallback in deletion (1.3) if `getIntentsByProposal` fails

**File**: `ui/src/lib/stores/hrea.store.svelte.ts`

#### Phase 1 Verification

1. Build zomes: `nix develop --command bun build:zomes`
2. Unit tests: `nix develop --command bun test:unit` (268 existing + new tests)
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

**Status**: Partially complete — foundational tests done, economic flow tests remain

- [ ] Unit tests for remaining entity mappings
  - [ ] Service Type → Resource Specification mapping accuracy
  - [ ] Request → Proposal + Intent mapping and metadata preservation
  - [ ] Offer → Proposal + Intent mapping and metadata preservation
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

**Explicit ProposedIntent Linking**: CFN creates proposal-intent links explicitly via `createProposedIntent(reciprocal, publishedIn, publishes)` rather than relying on a `publishes` shorthand in `ProposalCreateParams`. The `reciprocal` flag distinguishes service intents from payment intents. Our Phase 1 adopts this pattern.

**Data Transformation Pipeline**: CFN implemented comprehensive data transformers between raw hREA zome responses and UI-ready objects. Our mapper services (`request-proposal.mapper.ts`, `offer-proposal.mapper.ts`) follow a similar pattern.

**GraphQL-to-Zome-Call Migration**: CFN's entire GraphQL layer became dead code after migrating to direct zome calls. The direct approach is simpler and avoids Apollo overhead. Worth considering once our economic flow is more mature.

## Relevant Files

### Core hREA Infrastructure (existing)

- `ui/src/lib/stores/hrea.store.svelte.ts` — Central bridge store with event-driven mapping
- `ui/src/lib/services/hrea.service.ts` — GraphQL operations for all hREA entity types
- `ui/src/lib/services/mappers/request-proposal.mapper.ts` — Request → Proposal + Intents mapping
- `ui/src/lib/services/mappers/offer-proposal.mapper.ts` — Offer → Proposal + Intents mapping
- `ui/src/lib/schemas/hrea.schemas.ts` — Effect Schema validation for hREA entities
- `ui/src/lib/types/hrea.ts` — TypeScript type definitions for hREA entities
- `ui/src/lib/stores/storeEvents.ts` — Event bus definitions for domain events

### Phase 1 Key Files (to modify)

- `ui/src/lib/stores/administration.store.svelte.ts` — Emit `user:accepted` / `organization:accepted`, fix stale user object
- `ui/src/lib/graphql/mutations/intent.mutations.ts` — Add `reciprocal` param to `PROPOSE_INTENT_MUTATION`
- `ui/src/lib/types/holochain.ts` — Add `'archived'` to `StatusType`
- `ui/src/lib/schemas/administration.schemas.ts` — Add `Schema.Literal('archived')` to `StatusTypeSchema`
- `ui/src/lib/stores/organizations.store.svelte.ts` — Conditional deletion (hard delete vs archive)
- `ui/src/lib/composables/domain/organizations/useOrganizationsManagement.svelte.ts` — Update delete confirmation messages
- `dnas/requests_and_offers/zomes/integrity/administration/src/status.rs` — Add `Archived` variant to `StatusType`
- `dnas/requests_and_offers/zomes/coordinator/administration/src/status.rs` — Handle `archived` status transition
- `ui/tests/unit/stores/hrea.store.test.ts` — Tests for Phase 1 behaviors

### GraphQL Layer (existing)

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
