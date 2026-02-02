# hREA Entity Mapping Plan

Roadmap for completing hREA (Holochain Resource-Event-Agent) integration in the Requests and Offers application. This plan covers the remaining work needed to achieve a full ValueFlows economic lifecycle.

**Architecture**: Dual-DNA hybrid — a custom `requests_and_offers` DNA (rich domain model, admin workflows) bridged to the pre-built `hrea.dna` via a frontend event-driven mapping layer (`hrea.store.svelte.ts` + `hrea.service.ts`). This approach was validated through comparative analysis with the Carbon Farm Network (CFN), a production hREA implementation.

## Completed Work Summary

The foundational entity mapping pipeline is fully operational:

- **Users → Person Agents** — Event-driven mapping via `storeEventBus`, action hash reference system
- **Organizations → Organization Agents** — Same pattern with retroactive mapping support
- **Service Types → Resource Specifications** — Status-aware mapping (only approved types), event-driven
- **Mediums of Exchange → Resource Specifications** — Distinct classification, status-aware mapping
- **Requests → Proposals + Intents** — Two-intent reciprocal pattern (service intent + payment intent)
- **Offers → Proposals + Intents** — Same pattern with provider/receiver role reversal
- **Event-driven bridge architecture** — `storeEventBus` decouples domain stores from hREA logic
- **Action hash reference system** — `ref:entityType:actionHash` in note fields for independent updates
- **GraphQL infrastructure** — Apollo + SchemaLink with full CRUD for Agents, ResourceSpecs, Proposals, Intents
- **UI visualization** — hREA test interface with tabbed entity managers, sync controls, and analytics
- **Comprehensive test suite** — Agent mappings, action hash references, and manual sync operations

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

### Phase 1: Agent Mapping Refinement

**Status**: In Progress — required before exchange process work

- [ ] **Refactor User → Agent mapping**: Change trigger from `user:created` to `user:accepted`
- [ ] **Refactor Organization → Agent mapping**: Change trigger from `organization:created` to `organization:accepted`
- [ ] **Enforce Agent Immutability**: Remove `handleOrganizationDeleted` logic — once an Agent is created, it must persist to preserve economic history
- [ ] **Update domain stores**: Ensure `users.store.svelte.ts` and `organizations.store.svelte.ts` emit `accepted` status events

**Relevant files**:
- `ui/src/lib/stores/hrea.store.svelte.ts` — Event listeners to update
- `ui/src/lib/stores/users.store.svelte.ts` — Add `user:accepted` event emission
- `ui/src/lib/stores/organizations.store.svelte.ts` — Add `organization:accepted` event emission

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
