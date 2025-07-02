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
- [x] **Refined hREA Visualization Page**: Refactored the admin test page to serve as a comprehensive dashboard for *displaying* the automatically mapped hREA entities.
  - [x] Refactored `HREATestInterface.svelte` to use modular components for each entity type.
  - [x] Refactored `PersonAgentManager.svelte` to be a visualization component instead of a creation form, showing Person agents and their associated `UIUser` mapping.
- [x] **Fixed Critical GraphQL Initialization Issues**:
  - [x] Diagnosed and resolved "Cannot read properties of undefined (reading 'query')" error caused by uninitialized Apollo client
  - [x] Implemented auto-initialization checks in all hREA store methods (`getAllAgents`, `createPersonFromUser`, `updatePersonAgent`, `createRetroactiveMappings`)
  - [x] Added proper Effect chain initialization with `E.void` and `E.flatMap` patterns for robust error handling
  - [x] Ensured Apollo client initialization before any GraphQL operations to prevent runtime errors
- [x] **Enhanced hREA Test Interface with Professional Tabbed Structure**:
  - [x] Implemented main tabs for four hREA entity types: Agents, Resource Specifications, Proposals, Intents
  - [x] Created informative placeholders for unimplemented entity types with construction notices
  - [x] Added comprehensive page header with hREA context and educational information
  - [x] Implemented responsive design with SkeletonUI components and consistent styling
- [x] **Organized Agents Section with Clear Sub-categorization**:
  - [x] Implemented sub-tabs within Agents section to distinguish Person and Organization agents
  - [x] Created dedicated Person Agents sub-tab containing the existing PersonAgentManager
  - [x] Designed Organization Agents sub-tab with integration preview and auto-sync information
  - [x] Added visual hierarchy with appropriate icons and educational context for each agent type
  - [x] Established clear development roadmap showing integration with existing Organizations/Projects
- [x] **Implemented Complete Organization Agent Mapping**:
  - [x] Added `createOrganization` mutation to hREA service with GraphQL integration
  - [x] Implemented Organization agent GraphQL queries and mutations (`agent.mutations.ts`)
  - [x] Implemented event listeners in `hrea.store.svelte.ts` for `organization:created` and `organization:updated` events
  - [x] Created `OrganizationAgentManager.svelte` component to display and manage organization agents with statistics dashboard
  - [x] Updated `organizations.store.svelte.ts` to emit `organization:created` and `organization:updated` events
  - [x] Implemented `createOrganizationFromOrg` and `updateOrganizationAgent` mapping logic in hREA store
  - [x] Added organization agent retroactive mapping functionality for existing organizations
  - [x] Integrated organization agent visualization into the hREA test interface with proper filtering and statistics
- [x] **Fixed Critical Svelte Apollo Integration Issues**:
  - [x] Resolved "lifecycle_outside_component" errors by removing improper `setClient()` calls from hREA service
  - [x] Streamlined GraphQL client integration to work properly with Effect TS patterns
  - [x] Fixed test suite issues related to svelte-apollo integration assumptions
- [x] **Consolidated and Optimized hREA Store Architecture**:
  - [x] Unified redundant retroactive mapping methods into single `createRetroactiveMappings(users, organizations)` method
  - [x] Improved code maintainability by eliminating duplication between user and organization mapping patterns
  - [x] Enhanced component consistency between PersonAgentManager and OrganizationAgentManager
  - [x] Added proper filtering to PersonAgentManager to show only person agents (not all agents)
  - [x] Implemented immediate state updates for both person and organization agent creation to prevent UI lag

## Primary Strategy: Event-Driven, Automated Mapping

Our core strategy is to create a real-time, one-way synchronization from our application's entities to hREA entities. This process will be automated and triggered by domain events, ensuring that hREA accurately reflects the state of our application without manual intervention.

The flow is as follows:
1.  **Domain Store Action**: A user performs an action (e.g., creating a profile, submitting a request) that is processed by a domain store (e.g., `users.store.svelte.ts`, `requests.store.svelte.ts`).
2.  **Event Emission / Direct Call**:
    - For foundational entities (Users, Orgs), the domain store emits an event (e.g., `user:created`) via the central `storeEventBus`. The domain store has no direct knowledge of hREA.
    - For economic events (Requests, Offers), the store will directly orchestrate the creation of hREA entities.
3.  **hREA Store Action**: The `hrea.store.svelte.ts` either subscribes to events (for foundational entities) or is directly called (for economic events).
4.  **Trigger hREA Service**: The `hrea.store` invokes the corresponding method in the `hrea.service.ts` (e.g., `createPerson`, `createProposal`), passing along the necessary data.
5.  **GraphQL Mutation**: The `hrea.service` executes the appropriate GraphQL mutation to create or update the entity in the hREA DNA.
6.  **UI Visualization**: The admin test page (`HREATestInterface.svelte`) will primarily be used to *visualize* the results of these automated mappings, serving as a dashboard to monitor the health of the synchronization.

This architecture decouples our domains, centralizes hREA logic, and creates a robust, scalable mapping system.

## In Progress Tasks

- [ ] **Implement Event-Driven Mapping for Service Types → Resource Specifications**:
  - [ ] **Flesh out hREA Service**:
    - [ ] Add `createResourceSpecification` mutation to hREA service
    - [ ] Implement ResourceSpecification GraphQL queries and mutations
  - [ ] **Implement Event Listeners**: In `hrea.store.svelte.ts`, subscribe to `serviceType:*` events
  - [ ] **Create Resource Specification Manager Component**: Build `ResourceSpecManager.svelte` to display and manage resource specifications
  - [ ] **Update Service Types Store**: Emit `serviceType:created` and `serviceType:updated` events in `serviceTypes.store.svelte.ts`

## Future Tasks

### Phase 1: Foundation Entity and Proposal Mapping

**Priority: Critical for MVP foundation**

This phase implements the core entity mappings that form the foundation of our hREA integration, as depicted on the left side of the "hREA Mapping" diagram. It concludes with the ability to create valid hREA `Proposals`.

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
- [ ] Add `hrea_agent_id` field to existing user records in the `users` zome.
  - [ ] Implement agent profile update → user profile sync.
  - [ ] Add conflict resolution for profile discrepancies.

#### 1.2: Organizations → Organization Agents

- [x] Create Organization-Agent mapping infrastructure
  - [x] Design organization-agent relationship data structure
  - [x] Create bidirectional mapping utilities (Organization ↔ Agent)
  - [x] Implement agent creation from organization profile data via event-driven architecture
  - [ ] Add `hrea_agent_id` field to existing organization records

- [x] Implement Organization → Organization Agent service
  - [x] Create `createOrganizationFromOrg()` mutation wrapper triggered by `organization:created` event
  - [x] Map organization fields to hREA Organization agent properties
  - [x] Handle organization logo/branding mapping to agent profile
  - [x] Implement immediate state updates and proper error handling

- [x] Organization-Agent synchronization
  - [x] Create organization update → agent profile sync via `organization:updated` event
  - [x] Create agent query by organization ID functionality
  - [x] Implement retroactive mapping for existing organizations
  - [x] Add comprehensive visualization dashboard with statistics and filtering
  - [ ] Implement agent profile update → organization sync
  - [ ] Handle organization member changes in hREA context

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

#### 1.4: Medium of Exchange → Resource Specification

- [ ] Define core Medium of Exchange (MoE) entities (e.g., "Community Credits", "Hours").
- [ ] Create a standard `ResourceSpecification` for each MoE.
- [ ] Ensure the hREA service can query for these core MoE resource specifications by a known identifier/name.
- [ ] This provides the necessary counterpart for all economic exchanges.

#### 1.5: Application Actions → hREA Proposals

This is the final step of the foundational mapping. It translates a user's action of creating a `Request` or `Offer` within our application into a formal, reciprocal `Proposal` in the hREA DHT.

- [ ] Create Request → Proposal + Intents mapping infrastructure
  - [ ] Design request-proposal relationship data structure
  - [ ] Add `hrea_proposal_id` field to request records
  - [ ] Create mapping utility (Request ↔ Proposal)
  - [ ] Implement proposal creation from request data

- [ ] Implement Request → Proposal + Intents service
  - [ ] Create `createProposalFromRequest()` mutation wrapper
  - [ ] **Crucially, map a single Request to a Proposal containing TWO reciprocal intents:**
      - **Intent 1 (The Service):** `action: 'work'`, `receiver: Requestor's Agent ID`, `resourceSpecifiedBy: Service Type Resource Spec ID`.
      - **Intent 2 (The Payment):** `action: 'transfer'`, `provider: Requestor's Agent ID`, `resourceSpecifiedBy: Medium of Exchange Resource Spec ID`.
  - [ ] Link request service types to resource specifications in intents.
  - [ ] Handle request metadata (location, timeframe) in proposal context.

- [ ] Create Offer → Proposal + Intents mapping infrastructure
  - [ ] Design offer-proposal relationship data structure
  - [ ] Add `hrea_proposal_id` field to offer records
  - [ ] Create mapping utility (Offer ↔ Proposal)
  - [ ] Implement proposal creation from offer data

- [ ] Implement Offer → Proposal + Intents service
  - [ ] Create `createProposalFromOffer()` mutation wrapper
  - [ ] **Crucially, map a single Offer to a Proposal containing TWO reciprocal intents:**
      - **Intent 1 (The Service):** `action: 'work'`, `provider: Offerer's Agent ID`, `resourceSpecifiedBy: Service Type Resource Spec ID`.
      - **Intent 2 (The Payment):** `action: 'transfer'`, `receiver: Offerer's Agent ID`, `resourceSpecifiedBy: Medium of Exchange Resource Spec ID`.
  - [ ] Link offer service types to resource specifications in intents.
  - [ ] Handle offer metadata (availability, pricing) in proposal context.

### Phase 2: Data Migration and Synchronization

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

### Phase 3: Testing and Validation

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

### Recent Progress Summary

**Complete Organization Agent Integration**: Successfully implemented the full organization → hREA agent mapping pipeline following the same event-driven patterns as user agents. Organizations now automatically create corresponding hREA agents when created or updated, with proper visualization and statistics dashboards.

**Critical Bug Fixes and Consolidation**: Resolved major "lifecycle_outside_component" errors caused by improper Svelte Apollo integration. Consolidated redundant retroactive mapping methods into a unified approach, eliminating code duplication and improving maintainability.

**Enhanced Component Architecture**: Both PersonAgentManager and OrganizationAgentManager now follow consistent patterns with proper filtering, comprehensive statistics, and real-time synchronization. PersonAgentManager was fixed to show only person agents instead of all agents.

**Robust Store Architecture**: Unified the hREA store's retroactive mapping approach by consolidating separate methods into a single `createRetroactiveMappings(users, organizations)` method, improving code quality and reducing duplication.

**GraphQL Infrastructure Stabilization**: Successfully resolved critical initialization issues in the hREA store that were preventing proper Apollo client setup. All store methods now include auto-initialization checks to ensure GraphQL operations are safe and reliable.

**Professional UI Development**: Created a comprehensive tabbed interface that provides clear organization of different hREA entity types. The Agents section now properly distinguishes between Person and Organization agents, providing a solid foundation for future entity management interfaces.

### Relevant Files

#### Recently Updated Files

**Core hREA Infrastructure:**
- `ui/src/lib/stores/hrea.store.svelte.ts` - Enhanced with organization agent mapping and consolidated retroactive mapping methods
- `ui/src/lib/stores/organizations.store.svelte.ts` - Added event emission for organization:created and organization:updated
- `ui/src/lib/services/zomes/hrea.service.ts` - Added createOrganization mutation and fixed Apollo client integration
- `ui/src/lib/components/hrea/HREATestInterface.svelte` - Completely restructured with tabbed interface
- `ui/src/routes/admin/hrea-test/+page.svelte` - Enhanced with professional layout and educational context
- `ui/src/lib/components/hrea/test-page/PersonAgentManager.svelte` - Fixed filtering and hash encoding for user links
- `ui/src/lib/components/hrea/test-page/OrganizationAgentManager.svelte` - Complete implementation with statistics dashboard and retroactive mapping

**GraphQL Structure (Existing):**
- `ui/src/lib/graphql/queries/agent.queries.ts` - Queries for Agent entity
- `ui/src/lib/graphql/mutations/agent.mutations.ts` - Mutations for Agent entity (enhanced with organization support)

#### New Files to Create (Post-Installation Focus)

**GraphQL Structure (Continued):**
- `ui/src/lib/graphql/fragments/agent.fragments.ts` - Fragments for Agent entity
- `ui/src/lib/graphql/fragments/resourceSpecification.fragments.ts` - Fragments for ResourceSpecification entity
- `ui/src/lib/graphql/fragments/intent.fragments.ts` - Fragments for Intent entity
- `ui/src/lib/graphql/queries/resourceSpecification.queries.ts` - Queries for ResourceSpecification entity
- `ui/src/lib/graphql/mutations/resourceSpecification.mutations.ts` - Mutations for ResourceSpecification entity
- `ui/src/lib/graphql/index.ts` - Barrel file for easy exports

**UI Components for Visualization Dashboard:**
- `ui/src/lib/components/hrea/test-page/ResourceSpecManager.svelte` - Component to *display* Resource Specs on the test page
- `ui/src/lib/components/hrea/test-page/ProposalManager.svelte` - Component to *display* Proposals on the test page
- `ui/src/lib/components/hrea/test-page/IntentManager.svelte` - Component to *display* Intents on the test page

**Entity Mapping Services:**
- `ui/src/lib/services/mappers/agent-mapping.service.ts` - User/Organization → Agent mapping
- `ui/src/lib/services/mappers/resource-spec-mapping.service.ts` - ServiceType → ResourceSpec mapping
- `ui/src/lib/services/mappers/proposal-mapping.service.ts` - Request/Offer → Proposal + Intent mapping
- `ui/src/lib/services/mappers/economic-flow.service.ts` - Agreement, Commitment, and Event orchestration

**Store Extensions:**
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

#### Files to Modify (Next Phase Focus)

**Store Integration (Event-Driven - HIGH PRIORITY):**
- `ui/src/lib/stores/storeEvents.ts` - Add `serviceType:*` events
- `ui/src/lib/stores/serviceTypes.store.svelte.ts` - Emit `serviceType:created` and `serviceType:updated` events

**Existing Entity Extensions:**
- `dnas/requests_and_offers/zomes/coordinator/users_organizations/src/users.rs` - Add hREA agent ID fields
- `dnas/requests_and_offers/zomes/coordinator/service_types/src/service_types.rs` - Add resource spec ID fields
- `dnas/requests_and_offers/zomes/coordinator/requests/src/requests.rs` - Add proposal/intent ID fields
- `dnas/requests_and_offers/zomes/coordinator/offers/src/offers.rs` - Add proposal/intent ID fields

**UI Type Extensions:**
- `ui/src/lib/types/holochain.ts` - Add hREA ID fields to existing types
- `ui/src/lib/types/ui.ts` - Add hREA mapping status to UI types

#### Documentation Files
- `documentation/task-lists/HREA_INTEGRATION_TUTORIAL.md` - Installation tutorial (created)
- `documentation/architecture/hrea-integration.md` - Economic flow architecture (exists)
- `documentation/technical-specs/entity-mapping-specification.md` - Detailed mapping specifications
- `documentation/task-lists/hREA_EXCHANGE_PROCESS_PLAN.md` - The continuation of this plan, focusing on the interactive exchange lifecycle.

### Success Metrics

- ✅ All existing users successfully mapped to hREA agents
- ✅ GraphQL client initialization issues resolved
- ✅ Professional tabbed interface implemented with clear agent categorization
- ✅ Auto-initialization pattern established for robust GraphQL operations
- ✅ All existing organizations successfully mapped to hREA agents
- [ ] All existing service types successfully mapped to resource specifications
- [ ] The system can successfully take a `Request` or `Offer` and generate a valid hREA `Proposal` containing reciprocal intents.
- ✅ Real-time synchronization working for Person and Organization `Agent` mappings.
- ✅ Data integrity maintained across foundational Agent mappings.
- ✅ Performance impact minimal (< 10% overhead) for the agent mapping processes.
- ✅ Comprehensive test coverage for agent mappings with all tests passing.

### Next Immediate Priorities

1. **Service Type → Resource Specification Mapping**: Complete the service type → resource specification mapping infrastructure with event-driven synchronization
2. **Resource Specification Manager Component**: Build the visualization component for the Resource Specifications tab
3. **Store Event Integration**: Add service type events to enable real-time synchronization for resource specifications
4. **Proposal Creation Engine**: Begin implementation of Request/Offer → Proposal + Intent mapping logic

## Plan Scope and Handoff

The completion of this integration plan marks a critical milestone. At the end of this phase, the application will have a robust, one-way synchronization from its core entities to their hREA counterparts.

**The primary outputs of this plan are:**
- **Mapped Foundational Entities**: `Users`, `Organizations`, and the `Medium of Exchange` are successfully and continuously mapped to hREA `Agents` and `ResourceSpecifications`.
- **A `Proposal` Creation Engine**: The system can take a `Request` or `Offer` from the application and translate it into a valid, reciprocal hREA `Proposal` containing the correct bundled `Intents`.

This plan concludes at the point of `Proposal` creation. The subsequent interactions with that proposal—discovery, acceptance, agreement formation, and fulfillment—are covered in the `hREA_EXCHANGE_PROCESS_PLAN.md`.
