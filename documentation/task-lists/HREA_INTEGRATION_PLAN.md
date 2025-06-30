# hREA Entity Mapping Plan

Implementation plan for mapping existing entities in the Requests and Offers application with hREA (Holochain Resource-Event-Agent). This focuses on the foundational setup needed before implementing exchange processes.

## Completed Tasks

- [x] Created comprehensive hREA integration documentation (`ui/hREA-intallation.md`)
- [x] Analyzed existing entity mapping to hREA structures
- [x] Defined entity mapping strategy for Users, Organizations, Service Types, Requests, and Offers
- [x] Researched hREA dependencies and GraphQL implementation patterns
- [x] Created hREA Integration Tutorial with admin test page
- [x] Established basic hREA service (`hrea.service.ts`) and store (`hrea.store.svelte.ts`) patterns
- [x] Implemented foundational hREA GraphQL client setup (`initialize` method in service)
- [x] Implemented basic `createPerson` mutation in service and store
- [x] Created initial hREA test interface (`HREATestInterface.svelte`) for creating Person agents
- [x] **Implemented Event-Driven User-to-Agent Mapping**:
  - [x] Defined `user:created` and `user:updated` events in `storeEvents.ts`.
  - [x] Implemented event listeners in `hrea.store.svelte.ts` to subscribe to user events and trigger agent creation/updates.
  - [x] Implemented `createPersonFromUser` and `updatePersonFromUser` logic in `hrea.store.svelte.ts`.
  - [x] Established GraphQL structure with queries and mutations for `Agent` (`agent.queries.ts`, `agent.mutations.ts`).
  - [x] Added `getAgent(id)` and `getAllAgents()` to `hrea.service.ts`.
  - [x] Implemented robust race condition protection in `hrea.store.svelte.ts` to prevent duplicate agent creation, using an atomic singleton pattern and duplicate subscription guards.

## Primary Strategy: Event-Driven, Automated Mapping

Our core strategy is to create a real-time, one-way synchronization from our application's entities to hREA entities. This process will be automated and triggered by domain events, ensuring that hREA accurately reflects the state of our application without manual intervention.

The flow is as follows:
1.  **Domain Store Action**: A user performs an action (e.g., creating a profile) that is processed by a domain store (e.g., `users.store.svelte.ts`).
2.  **Event Emission**: Upon successful creation or update, the domain store emits a specific event (e.g., `user:created`) via the central `storeEventBus`. The domain store has no direct knowledge of hREA.
3.  **hREA Store Subscription**: The `hrea.store.svelte.ts` subscribes to these events.
4.  **Trigger hREA Service**: When the `hrea.store` receives an event, it invokes the corresponding method in the `hrea.service.ts` (e.g., `createPerson`), passing along the necessary data from the event payload.
5.  **GraphQL Mutation**: The `hrea.service` executes the appropriate GraphQL mutation to create or update the entity in the hREA DNA.
6.  **UI Visualization**: The admin test page (`HREATestInterface.svelte`) will primarily be used to *visualize* the results of these automated mappings, serving as a dashboard to monitor the health of the synchronization.

This event-driven architecture decouples our domains, centralizes hREA logic, and creates a robust, scalable mapping system.

## In Progress Tasks

- [ ] **Implement Event-Driven Mapping for Organizations and Service Types**:
  - [ ] **Flesh out hREA Service**:
    - [ ] Add `createOrganization` mutation.
    - [ ] Add `createResourceSpecification` mutation.
  - [ ] **Implement Event Listeners**: In `hrea.store.svelte.ts`, subscribe to `organization:*` and `serviceType:*` events.
- [ ] **Refine hREA Visualization Page**: Enhance the admin test page to serve as a comprehensive dashboard for *displaying* the automatically mapped hREA entities.
  - [ ] Refactor `HREATestInterface.svelte` to use modular components for each entity type.
  - [ ] Implement query logic in the manager components (e.g., `PersonAgentManager.svelte`) to fetch and display data from the hREA service.

## Future Tasks

### Phase 1: Foundation Entity Mapping

**Priority: Critical for MVP foundation**

This phase implements the core entity mappings that form the foundation of our hREA integration, following the economic flow model: `Agent -> Proposal -> Intent -> Resource`.

#### 1.1: Individual Users → Person Agents

- [x] Create User-Agent mapping infrastructure
  - [x] Implement agent creation from user profile data (hook into user creation flow via events).
  - [x] Create in-memory `userToAgentMap` for mapping user hashes to agent IDs.
- [x] Implement User → Person Agent service
  - [x] Create `createPersonFromUser` mutation wrapper in `hrea.store.svelte.ts` triggered by `user:created` event.
  - [x] Map user profile fields to hREA Person agent properties.
  - [x] Handle user avatar/image mapping to agent profile.
  - [x] Implement error handling and race-condition protection for agent creation.
- [x] User-Agent synchronization (one-way)
  - [x] Create user profile update → agent profile sync via `user:updated` event.
  - [x] Create agent query by user hash functionality (`getUserAgent`).
- [ ] Implement backend persistence and bidirectional sync
  - [ ] Add `hrea_agent_id` field to existing user records in the `users` zome.
  - [ ] Implement agent profile update → user profile sync.
  - [ ] Add conflict resolution for profile discrepancies.

#### 1.2: Organizations → Organization Agents

- [ ] Create Organization-Agent mapping infrastructure
  - [ ] Design organization-agent relationship data structure
  - [ ] Add `hrea_agent_id` field to existing organization records
  - [ ] Create bidirectional mapping utilities (Organization ↔ Agent)
  - [ ] Implement agent creation from organization profile data

- [ ] Implement Organization → Organization Agent service
  - [ ] Create `createOrganizationAgentFromOrg()` mutation wrapper
  - [ ] Map organization fields to hREA Organization agent properties
  - [ ] Handle organization logo/branding mapping to agent profile
  - [ ] Implement member relationship mapping (organization members → agent relationships)

- [ ] Organization-Agent synchronization
  - [ ] Create organization update → agent profile sync
  - [ ] Implement agent profile update → organization sync
  - [ ] Handle organization member changes in hREA context
  - [ ] Create agent query by organization ID functionality

#### 1.3: Service Types → Resource Specifications

- [ ] Create Service Type-Resource Specification mapping infrastructure
  - [ ] Design service type-resource spec relationship data structure
  - [ ] Add `hrea_resource_spec_id` field to existing service type records
  - [ ] Create bidirectional mapping utilities (ServiceType ↔ ResourceSpec)
  - [ ] Implement resource specification creation from service type data

- [ ] Implement Service Type → Resource Specification service
  - [ ] Create `createResourceSpecFromServiceType()` mutation wrapper
  - [ ] Map service type properties to hREA ResourceSpecification properties
  - [ ] Handle service type tags as resource classifications
  - [ ] Implement skill/capability mapping to resource specifications

- [ ] Service Type-Resource Specification synchronization
  - [ ] Create service type update → resource spec sync
  - [ ] Implement resource spec update → service type sync
  - [ ] Handle tag/classification changes across systems
  - [ ] Create resource spec query by service type ID functionality

### Phase 2: Advanced Economic Flow Mapping

**Priority: High for complete economic model**

This phase implements the sophisticated economic flow: `Proposals → Intents → Agreements → Commitments`.

#### 2.1: Requests/Offers → Proposals and Intents

Based on the economic flow model, Requests and Offers should map to **Proposals** that bundle **Intents**, not directly to Intents.

- [ ] Create Request → Proposal + Intent mapping infrastructure
  - [ ] Design request-proposal-intent relationship data structure
  - [ ] Add `hrea_proposal_id` and `hrea_intent_id` fields to request records
  - [ ] Create bidirectional mapping utilities (Request ↔ Proposal ↔ Intent)
  - [ ] Implement proposal creation from request data

- [ ] Implement Request → Proposal + Intent service
  - [ ] Create `createProposalFromRequest()` mutation wrapper
  - [ ] Map request to hREA Proposal with bundled Intent (action: 'work', provider: null)
  - [ ] Link request service types to resource specifications in intents
  - [ ] Handle request metadata (location, timeframe) in proposal context

- [ ] Create Offer → Proposal + Intent mapping infrastructure
  - [ ] Design offer-proposal-intent relationship data structure
  - [ ] Add `hrea_proposal_id` and `hrea_intent_id` fields to offer records
  - [ ] Create bidirectional mapping utilities (Offer ↔ Proposal ↔ Intent)
  - [ ] Implement proposal creation from offer data

- [ ] Implement Offer → Proposal + Intent service
  - [ ] Create `createProposalFromOffer()` mutation wrapper
  - [ ] Map offer to hREA Proposal with bundled Intent (action: 'work', receiver: null)
  - [ ] Link offer service types to resource specifications in intents
  - [ ] Handle offer metadata (availability, pricing) in proposal context

#### 2.2: Agreement and Commitment Mapping

- [ ] Create Agreement formation from matched Requests/Offers
  - [ ] Implement agreement creation when request-offer match occurs
  - [ ] Bundle complementary intents into agreements
  - [ ] Create commitment generation from agreements
  - [ ] Implement commitment tracking and progress monitoring

#### 2.3: Feedback-Driven Economic Events

- [ ] Implement feedback process integration
  - [ ] Create feedback data structures and workflows
  - [ ] Implement conditional economic event creation (based on positive feedback)
  - [ ] Create feedback request mechanisms for service providers
  - [ ] Implement quality assurance and dispute resolution processes

### Phase 3: Data Migration and Synchronization

**Priority: Medium for MVP, Critical for production**

- [ ] Create comprehensive data migration utilities
  - [ ] Build migration script for existing users → person agents (bulk operation)
  - [ ] Build migration script for existing organizations → organization agents (bulk operation)
  - [ ] Build migration script for existing service types → resource specifications (bulk operation)
  - [ ] Build migration script for existing requests → proposals + intents (complex mapping)
  - [ ] Build migration script for existing offers → proposals + intents (complex mapping)

- [ ] Implement real-time synchronization mechanisms
  - [ ] Create user creation/update → automatic agent creation/sync
  - [ ] Create organization creation/update → automatic agent creation/sync
  - [ ] Create service type creation/update → automatic resource spec creation/sync
  - [ ] Create request creation → automatic proposal + intent creation
  - [ ] Create offer creation → automatic proposal + intent creation

- [ ] Data integrity and conflict resolution
  - [ ] Implement bidirectional sync conflict resolution
  - [ ] Create data consistency validation tools
  - [ ] Implement rollback mechanisms for failed mappings
  - [ ] Create monitoring for sync failures and inconsistencies

### Phase 4: Testing and Validation

**Priority: High for production readiness**

- [ ] Create comprehensive unit tests for entity mapping
  - [ ] Test User → Person Agent mapping accuracy and data integrity
  - [ ] Test Organization → Organization Agent mapping accuracy and relationships
  - [ ] Test Service Type → Resource Specification mapping and tag handling
  - [ ] Test Request → Proposal + Intent mapping and metadata preservation
  - [ ] Test Offer → Proposal + Intent mapping and metadata preservation

- [ ] Create integration tests for economic flow
  - [ ] Test complete request-offer matching → agreement → commitment flow
  - [ ] Test feedback process integration and economic event creation
  - [ ] Test data migration scripts with real data sets
  - [ ] Test synchronization mechanisms under various scenarios
  - [ ] Test error handling and edge cases across all mappings

- [ ] Validate hREA compliance and performance
  - [ ] Verify all mapped entities follow hREA ValueFlows standards
  - [ ] Test GraphQL schema compatibility and query performance
  - [ ] Validate data integrity across all entity mappings
  - [ ] Performance testing with large datasets
  - [ ] Compliance testing with hREA specification requirements

### Phase 5: Advanced Features and Optimization

**Priority: Low for MVP, High for production excellence**

- [ ] Implement advanced economic flow features
  - [ ] Create sophisticated matching algorithms (quality-weighted, reputation-based)
  - [ ] Implement multi-party agreements and complex resource exchanges
  - [ ] Create resource flow tracking and analytics
  - [ ] Implement time-based commitments and scheduling

- [ ] Quality assurance and reputation systems
  - [ ] Create comprehensive feedback analytics and reputation scoring
  - [ ] Implement predictive quality scoring using historical data
  - [ ] Create automated dispute resolution workflows
  - [ ] Implement trust network analysis and recommendations

- [ ] Performance optimization and scaling
  - [ ] Optimize GraphQL queries and implement caching strategies
  - [ ] Create efficient indexing for large-scale agent and resource discovery
  - [ ] Implement batch operations for bulk data processing
  - [ ] Create performance monitoring and optimization tools

## Implementation Plan (Updated)

### Primary Technical Approach: Event-Driven Synchronization

Our implementation will be guided by the event-driven architecture described in the **Primary Strategy** section. This decouples the hREA logic from the core application domains.

1.  **Event-Driven Service Layer**: The `storeEventBus` is the backbone. Domain stores emit events, and the `hrea.store` consumes them to trigger GraphQL mutations via the `hrea.service`.
2.  **Structured GraphQL Definitions**: Centralize all GraphQL fragments, queries, and mutations in a dedicated `ui/src/lib/graphql/` directory, organized by domain and operation type for maintainability and reusability.
3.  **Visualization, Not Manual Creation**: The UI's role is to display the state of the hREA mapping, not to create entries manually. The test page becomes a real-time dashboard.
4.  **Service Layer Integration**: Extend existing Effect TS service patterns to include hREA operations with proper error handling and dependency injection.
5.  **Bidirectional Data Mapping**: Create sophisticated mapping utilities that maintain consistency between our entities and hREA structures.
6.  **Economic Flow Orchestration**: Implement the complete flow from proposals through feedback-driven economic events.
7.  **Quality Assurance Integration**: Build feedback mechanisms into the economic flow for reputation and trust management.

### Key Dependencies

- `@valueflows/vf-graphql-holochain@^0.0.3-alpha.10` - hREA v0.3.2 GraphQL integration
- `@apollo/client@^3.13.8` - GraphQL client for hREA operations
- `graphql@^16.8.0` - Core GraphQL library for schema operations
- hREA DNA (happ-0.3.2-beta) - Core hREA Holochain DNA (Holochain 0.5.x compatible)

### Implementation Phases (Updated for Event-Driven Flow)

1.  **Event-Driven Foundation**: Implement the core event-driven mapping for foundational entities (Users→Agents, Organizations→Agents, ServiceTypes→ResourceSpecs).
2.  **Economic Flow Mapping**: Implement sophisticated Requests/Offers→Proposals+Intents mapping, also triggered by domain events.
3.  **Data Migration & Sync**: Create comprehensive migration tools and real-time synchronization mechanisms
4.  **Testing & Validation**: Extensive testing of entity mappings, economic flows, and performance with real datasets
5.  **Advanced Features**: Implement reputation systems, quality assurance, and sophisticated matching algorithms

### Relevant Files

#### New Files to Create (Post-Installation Focus)

**GraphQL Structure:**
- `ui/src/lib/graphql/fragments/agent.fragments.ts` - Fragments for Agent entity
- `ui/src/lib/graphql/fragments/resourceSpecification.fragments.ts` - Fragments for ResourceSpecification entity
- `ui/src/lib/graphql/fragments/intent.fragments.ts` - Fragments for Intent entity
- `ui/src/lib/graphql/queries/agent.queries.ts` - Queries for Agent entity
- `ui/src/lib/graphql/queries/resourceSpecification.queries.ts` - Queries for ResourceSpecification entity
- `ui/src/lib/graphql/mutations/agent.mutations.ts` - Mutations for Agent entity
- `ui/src/lib/graphql/mutations/resourceSpecification.mutations.ts` - Mutations for ResourceSpecification entity
- `ui/src/lib/graphql/index.ts` - Barrel file for easy exports

**UI Components for Visualization Dashboard:**
- `ui/src/lib/components/hrea/test-page/PersonAgentManager.svelte` - Component to *display* Person Agents on the test page.
- `ui/src/lib/components/hrea/test-page/OrganizationAgentManager.svelte` - Component to *display* Org Agents on the test page.
- `ui/src/lib/components/hrea/test-page/ResourceSpecManager.svelte` - Component to *display* Resource Specs on the test page.

**Entity Mapping Services:**
- `ui/src/lib/services/zomes/hrea.service.ts` - Core hREA GraphQL service (created)
- `ui/src/lib/services/mappers/agent-mapping.service.ts` - User/Organization → Agent mapping
- `ui/src/lib/services/mappers/resource-spec-mapping.service.ts` - ServiceType → ResourceSpec mapping
- `ui/src/lib/services/mappers/proposal-mapping.service.ts` - Request/Offer → Proposal + Intent mapping
- `ui/src/lib/services/mappers/economic-flow.service.ts` - Agreement, Commitment, and Event orchestration

**Store Extensions:**
- `ui/src/lib/stores/hrea.store.svelte.ts` - Core hREA state management (created)
- `ui/src/lib/stores/entity-sync.store.svelte.ts` - Real-time synchronization state
- `ui/src/lib/stores/economic-flow.store.svelte.ts` - Economic flow state management

**Data Structures and Schemas:**
- `ui/src/lib/types/hrea-mappings.ts` - Mapping relationship types
- `ui/src/lib/schemas/hrea-entities.schemas.ts` - hREA entity validation schemas
- `ui/src/lib/utils/mapping-utilities.ts` - Bidirectional mapping helper functions

**Migration and Sync:**
- `scripts/migrate-existing-data.ts` - Bulk migration of existing entities
- `ui/src/lib/utils/real-time-sync.ts` - Event-driven synchronization utilities

**Testing:**
- `tests/src/requests_and_offers/hrea/agent-mapping.test.ts` - Agent mapping tests
- `tests/src/requests_and_offers/hrea/economic-flow.test.ts` - Economic flow tests
- `tests/src/requests_and_offers/hrea/data-migration.test.ts` - Migration validation tests

#### Files to Modify (Post-Installation Focus)

**Core hREA files:**
- `ui/src/lib/services/zomes/hrea.service.ts` - Add new queries and mutations.
- `ui/src/lib/stores/hrea.store.svelte.ts` - Expose new service methods to the UI.
- `ui/src/lib/components/hrea/HREATestInterface.svelte` - Refactor to use new modular components.
- `ui/src/routes/admin/hrea-test/+page.svelte` - Update layout if necessary.

**Existing Entity Extensions:**
- `dnas/requests_and_offers/zomes/coordinator/users_organizations/src/users.rs` - Add hREA agent ID fields
- `dnas/requests_and_offers/zomes/coordinator/service_types/src/service_types.rs` - Add resource spec ID fields
- `dnas/requests_and_offers/zomes/coordinator/requests/src/requests.rs` - Add proposal/intent ID fields
- `dnas/requests_and_offers/zomes/coordinator/offers/src/offers.rs` - Add proposal/intent ID fields

**UI Type Extensions:**
- `ui/src/lib/types/holochain.ts` - Add hREA ID fields to existing types
- `ui/src/lib/types/ui.ts` - Add hREA mapping status to UI types

**Store Integration (Event-Driven):**
- `ui/src/lib/stores/storeEvents.ts` - **[PRIORITY]** Add `user:*`, `organization:*`, `serviceType:*`, `request:*`, `offer:*` events.
- `ui/src/lib/stores/users.store.svelte.ts` - **[PRIORITY]** Emit `user:created` and `user:updated` events.
- `ui/src/lib/stores/organizations.store.svelte.ts` - **[PRIORITY]** Emit `organization:created` and `organization:updated` events.
- `ui/src/lib/stores/hrea.store.svelte.ts` - **[PRIORITY]** Subscribe to domain events to trigger agent/entity creation.
- `ui/src/lib/stores/serviceTypes.store.svelte.ts` - Emit `serviceType:created` to trigger resource spec creation.
- `ui/src/lib/stores/requests.store.svelte.ts` - Emit `request:created` to trigger proposal creation.
- `ui/src/lib/stores/offers.store.svelte.ts` - Emit `offer:created` to trigger proposal creation.

#### Documentation Files
- `documentation/task-lists/HREA_INTEGRATION_TUTORIAL.md` - Installation tutorial (created)
- `documentation/architecture/hrea-integration.md` - Economic flow architecture (exists)
- `documentation/technical-specs/entity-mapping-specification.md` - Detailed mapping specifications
- `documentation/technical-specs/feedback-process-specification.md` - Feedback and quality assurance specs

### Success Metrics

- All existing users successfully mapped to hREA agents
- All existing organizations successfully mapped to hREA agents
- All existing service types successfully mapped to resource specifications
- All existing requests successfully mapped to hREA intents
- All existing offers successfully mapped to hREA intents
- Real-time synchronization working for new entities
- Data integrity maintained across all mappings
- Performance impact minimal (< 10% overhead)
- Comprehensive test coverage for all entity mappings
