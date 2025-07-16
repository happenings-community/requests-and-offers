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
- [x] **Implemented Action Hash Reference System for Independent Updates**:
  - [x] Redesigned hREA store to use action hash references in note fields instead of automatic updates
  - [x] Implemented `ref:user:{actionHash}`, `ref:organization:{actionHash}`, `ref:serviceType:{actionHash}` reference format
  - [x] Added utility functions for extracting and looking up entities by action hash references
  - [x] Implemented manual synchronization methods for independent control over hREA entity updates
  - [x] Added organization deletion event handler to properly clean up corresponding hREA agents
  - [x] Created comprehensive test suite for action hash reference system and manual sync functionality
- [x] **Implemented Complete Service Types → Resource Specifications Mapping**:
  - [x] **Implemented hREA Service Resource Specification Operations**:
    - [x] Added `createResourceSpecification` and `updateResourceSpecification` mutations to hREA service
    - [x] Implemented corresponding GraphQL queries and mutations for ResourceSpecification entity
    - [x] Fixed GraphQL schema compatibility issues by removing unsupported `classifiedAs` field
    - [x] Established proper Effect TS patterns for resource specification operations
  - [x] **Implemented Event-Driven Service Type Mapping**:
    - [x] Added event listeners in `hrea.store.svelte.ts` for `serviceType:created`, `serviceType:approved`, `serviceType:rejected`, and `serviceType:deleted` events
    - [x] Implemented conditional mapping logic that only creates resource specifications for approved service types
    - [x] Added automatic deletion of resource specifications when service types are rejected or deleted
    - [x] Implemented action hash reference system for independent service type ↔ resource specification relationships
  - [x] **Created Resource Specification Manager Component**:
    - [x] Built `ResourceSpecManager.svelte` as a focused, single-purpose component for displaying resource specifications
    - [x] Removed complex tabbed interface in favor of clean, streamlined design focused on resource specifications only
    - [x] Implemented clickable resource specification cards with navigation to associated service type detail pages
    - [x] Added proper action hash conversion for navigation (comma-separated to base64 format)
    - [x] Integrated comprehensive sync status dashboard with manual sync controls for users, organizations, and service types
    - [x] Added real-time event listening for automatic sync status updates
  - [x] **Enhanced Service Types Store Integration**:
    - [x] Ensured `serviceTypes.store.svelte.ts` correctly emits all necessary status-based events
    - [x] Implemented retroactive mapping for existing approved service types
    - [x] Added proper error handling and user feedback for resource specification operations

## Primary Strategy: Event-Driven, Automated, and Conditional Mapping

Our core strategy is to create a real-time, one-way synchronization from our application's entities to hREA entities. This process will be automated and triggered by domain events, ensuring that hREA accurately reflects the state of our application without manual intervention.

The flow is as follows:
1.  **Domain Store Action**: A user performs an action (e.g., creating a profile, submitting a request) that is processed by a domain store (e.g., `users.store.svelte.ts`, `requests.store.svelte.ts`).
2.  **Event Emission / Direct Call**:
    - For foundational entities (Users, Orgs, Service Types), the domain store emits a status-aware event (e.g., `user:accepted`, `organization:accepted`, `serviceType:approved`) via the central `storeEventBus`. The domain store has no direct knowledge of hREA.
    - For economic events (Requests, Offers), the store will directly orchestrate the creation of hREA entities.
3.  **hREA Store Action**: The `hrea.store.svelte.ts` either subscribes to events (for foundational entities) or is directly called (for economic events).
4.  **Conditional Logic & Immutability**: The hREA store applies business logic.
    - It will only map a `User` or `Organization` to an `Agent` upon receiving an **'accepted'** status event.
    - It will only map a `ServiceType` to a `ResourceSpecification` upon receiving a `serviceType:approved` event.
    - **Agent Immutability**: Once an `Agent` is created, it is considered immutable and will **not** be deleted, even if the source entity is later removed or banned. This ensures the integrity of their economic history. The `organization:deleted` event handler will be removed to enforce this rule.
5.  **Trigger hREA Service**: The `hrea.store` invokes the corresponding method in the `hrea.service.ts` (e.g., `createPerson`, `createResourceSpecification`), passing along the necessary data.
6.  **GraphQL Mutation**: The `hrea.service` executes the appropriate GraphQL mutation to create, update, or delete the entity in the hREA DNA.
7.  **UI Visualization**: The admin test interface (`HREATestInterface.svelte`) will primarily be used to *visualize* the results of these automated mappings, serving as a dashboard to monitor the health of the synchronization. It will include filters or tabs to distinguish between different entity types (e.g., Person vs. Organization Agents, Service vs. Medium of Exchange Specifications).

This architecture decouples our domains, centralizes hREA logic, and creates a robust, scalable, and business-aware mapping system.

## In Progress Tasks

- [ ] **Refactor Agent Mapping for 'Accepted' Status**:
  - [ ] **Refactor User → Agent Mapping**: Modify the event listener in `hrea.store.svelte.ts` to trigger on `user:accepted` instead of `user:created`.
  - [ ] **Refactor Organization → Agent Mapping**: Modify the event listener in `hrea.store.svelte.ts` to trigger on `organization:accepted` instead of `organization:created`.
  - [ ] **Enforce Agent Immutability**: Remove the `handleOrganizationDeleted` logic and event subscription from `hrea.store.svelte.ts` to ensure agents are not deleted.
  - [ ] **Update Domain Stores**: Ensure `users.store.svelte.ts` and `organizations.store.svelte.ts` emit `accepted` status events.

## Future Tasks

### Phase 1: Foundation Entity and Proposal Mapping

**Priority: Critical for MVP foundation**

This phase implements the core entity mappings that form the foundation of our hREA integration, as depicted on the left side of the "hREA Mapping" diagram. It concludes with the ability to create valid hREA `Proposals`.

#### 1.1: Individual Users → Person Agents ✅ COMPLETED

- [ ] **Refactor**: Agent creation must be triggered by a `user:accepted` event, not `user:created`.
- [x] Create User-Agent mapping infrastructure
- [x] Implement User → Person Agent service
- [x] User-Agent synchronization (one-way)
- [ ] Add `hrea_agent_id` field to existing user records in the `users` zome
- [ ] Implement agent profile update → user profile sync
- [ ] Add conflict resolution for profile discrepancies

#### 1.2: Organizations → Organization Agents ✅ COMPLETED

- [ ] **Refactor**: Agent creation must be triggered by an `organization:accepted` event, not `organization:created`.
- [ ] **Refactor**: The `organization:deleted` event handler must be removed to ensure agent immutability.
- [x] Create Organization-Agent mapping infrastructure
- [x] Implement Organization → Organization Agent service
- [x] Organization-Agent synchronization
- [ ] Add `hrea_agent_id` field to existing organization records
  - [ ] Implement agent profile update → organization sync
  - [ ] Handle organization member changes in hREA context

#### 1.3: Service Types → Service Resource Specifications ✅ COMPLETED

**Logic: Only approved service types are mapped to hREA.**

- [x] Create Service Type-Resource Specification mapping infrastructure
- [x] Implement Service Type → Resource Specification service
- [x] Service Type-Resource Specification synchronization
- [ ] Add `hrea_resource_spec_id` field to existing service type records for bidirectional linking

#### 1.4: Medium of Exchange → MoE Resource Specification ✅ COMPLETED

**Logic: Only approved mediums of exchange are mapped to hREA ResourceSpecifications with distinct classification.**

- [x] Create Medium of Exchange-Resource Specification mapping infrastructure
- [x] Implement Medium of Exchange → Resource Specification service
- [x] Medium of Exchange-Resource Specification synchronization
- [x] Event-driven mapping (mediumOfExchange:approved/rejected/deleted events)
- [x] Filtering methods to distinguish Service Type vs Medium of Exchange resource specifications
- [x] Manual sync functionality for retroactive mapping
- [x] Complete MediumOfExchangeResourceSpecManager component integration
- [x] Action hash reference system (`ref:mediumOfExchange:${actionHash}` pattern)

**Please refer to the detailed plan for all implementation details: [Medium of Exchange (MoE) Implementation Plan](MEDIUM_OF_EXCHANGE_PLAN.md)**

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
  - [x] Create user creation/update → automatic agent creation/sync
  - [x] Create organization creation/update → automatic agent creation/sync
  - [x] Create service type creation/update → automatic resource spec creation/sync
  - [ ] Create request creation → automatic proposal + intent creation
  - [ ] Create offer creation → automatic proposal + intent creation

- [ ] Data integrity and conflict resolution
  - [ ] Implement bidirectional sync conflict resolution
  - [ ] Create data consistency validation tools
  - [ ] Implement rollback mechanisms for failed mappings
  - [ ] Create monitoring for sync failures and inconsistencies

### Phase 3: Testing and Validation

**Priority: High for production readiness**

- [x] Create comprehensive unit tests for entity mapping
  - [x] Test User → Person Agent mapping accuracy and data integrity
  - [x] Test Organization → Organization Agent mapping accuracy and relationships
  - [x] Test Action Hash Reference System functionality and manual sync operations
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
  - [x] Verify all mapped entities follow hREA ValueFlows standards
  - [x] Test GraphQL schema compatibility and query performance
  - [x] Validate data integrity across all entity mappings
  - [ ] Performance testing with large datasets
  - [ ] Compliance testing with hREA specification requirements

### Key Dependencies

- `@valueflows/vf-graphql-holochain@^0.0.3-alpha.10` - hREA v0.3.2 GraphQL integration
- `@apollo/client@^3.13.8` - GraphQL client for hREA operations
- `graphql@^16.8.0` - Core GraphQL library for schema operations
- hREA DNA (happ-0.3.2-beta) - Core hREA Holochain DNA (Holochain 0.5.x compatible)

### Implementation Phases (Updated for Event-Driven Flow)

1.  ✅ **Event-Driven Foundation**: Implement the core event-driven mapping for foundational entities (Users→Agents, Organizations→Agents, ServiceTypes→ResourceSpecs).
2.  **Economic Flow Mapping**: Implement sophisticated Requests/Offers→Proposals+Intents mapping, also triggered by domain events.
3.  **Data Migration & Sync**: Create comprehensive migration tools and real-time synchronization mechanisms
4.  **Testing & Validation**: Extensive testing of entity mappings, economic flows, and performance with real datasets
5.  **Advanced Features**: Implement reputation systems, quality assurance, and sophisticated matching algorithms

### Recent Progress Summary

**Complete Service Types → Resource Specifications Integration**: Successfully implemented the full service types → hREA resource specifications mapping pipeline following the established event-driven patterns. Service types now automatically create corresponding hREA resource specifications when approved, with proper action hash reference system for independent updates.

**Action Hash Reference System**: Implemented a sophisticated reference system using note fields (`ref:entityType:actionHash`) that allows independent updates between main DNA entities and their hREA counterparts. This decouples the systems while maintaining relationships through action hash references.

**Enhanced Resource Specification Management**: Created a focused ResourceSpecManager component that provides comprehensive visualization and management of hREA resource specifications with clickable navigation to associated service type detail pages.

**GraphQL Schema Compatibility**: Resolved critical GraphQL schema issues by removing unsupported fields (like `classifiedAs`) from resource specification mutations, ensuring compatibility with the hREA API.

**Comprehensive Event Integration**: Successfully integrated service type status events (`serviceType:created`, `serviceType:approved`, `serviceType:rejected`, `serviceType:deleted`) with automatic hREA synchronization, ensuring only approved service types are mapped to resource specifications.

**Manual Sync Controls**: Implemented comprehensive manual synchronization controls for users, organizations, and service types, providing explicit control over when hREA entities are created or updated.

### Relevant Files

#### Recently Updated Files

**Core hREA Infrastructure:**
- `ui/src/lib/stores/hrea.store.svelte.ts` - Enhanced with complete service types mapping, action hash reference system, and organization deletion handling
- `ui/src/lib/services/hrea.service.ts` - Added resource specification CRUD operations and fixed GraphQL schema compatibility
- `ui/src/lib/components/hrea/test-page/ResourceSpecManager.svelte` - Complete implementation focused on resource specifications with clickable navigation
- `ui/tests/unit/stores/hrea.store.test.ts` - Comprehensive test suite for action hash reference system and manual sync functionality

**GraphQL Structure:**
- `ui/src/lib/graphql/queries/agent.queries.ts` - Queries for Agent entity
- `ui/src/lib/graphql/mutations/agent.mutations.ts` - Mutations for Agent entity
- `ui/src/lib/graphql/mutations/resourceSpecification.mutations.ts` - Mutations for ResourceSpecification entity

**Store Integration:**
- `ui/src/lib/stores/organizations.store.svelte.ts` - Added event emission for organization lifecycle events
- `ui/src/lib/stores/serviceTypes.store.svelte.ts` - Enhanced with proper event emission for all service type status changes

#### Files to Create (Next Phase Focus)

**GraphQL Structure (Continued):**
- `ui/src/lib/graphql/fragments/agent.fragments.ts` - Fragments for Agent entity
- `ui/src/lib/graphql/fragments/resourceSpecification.fragments.ts` - Fragments for ResourceSpecification entity
- `ui/src/lib/graphql/fragments/intent.fragments.ts` - Fragments for Intent entity
- `ui/src/lib/graphql/fragments/proposal.fragments.ts` - Fragments for Proposal entity
- `ui/src/lib/graphql/queries/resourceSpecification.queries.ts` - Queries for ResourceSpecification entity
- `ui/src/lib/graphql/queries/proposal.queries.ts` - Queries for Proposal entity
- `ui/src/lib/graphql/mutations/proposal.mutations.ts` - Mutations for Proposal entity
- `ui/src/lib/graphql/mutations/intent.mutations.ts` - Mutations for Intent entity
- `ui/src/lib/graphql/index.ts` - Barrel file for easy exports

**UI Components for Visualization Dashboard:**
- `ui/src/lib/components/hrea/test-page/ProposalManager.svelte` - Component to display Proposals on the test page
- `ui/src/lib/components/hrea/test-page/IntentManager.svelte` - Component to display Intents on the test page

**Entity Mapping Services:**
- `ui/src/lib/services/mappers/proposal-mapping.service.ts` - Request/Offer → Proposal + Intent mapping
- `ui/src/lib/services/mappers/economic-flow.service.ts` - Agreement, Commitment, and Event orchestration

**Store Extensions:**
- `ui/src/lib/stores/economic-flow.store.svelte.ts` - Economic flow state management

**Data Structures and Schemas:**
- `ui/src/lib/types/hrea-mappings.ts` - Mapping relationship types
- `ui/src/lib/schemas/hrea-entities.schemas.ts` - hREA entity validation schemas

**Migration and Sync:**
- `scripts/migrate-existing-data.ts` - Bulk migration of existing entities

**Testing:**
- `tests/src/requests_and_offers/hrea/proposal-mapping.test.ts` - Proposal mapping tests
- `tests/src/requests_and_offers/hrea/economic-flow.test.ts` - Economic flow tests
- `tests/src/requests_and_offers/hrea/data-migration.test.ts` - Migration validation tests

#### Files to Modify (Next Phase Focus)

**Existing Entity Extensions:**
- `dnas/requests_and_offers/zomes/coordinator/users_organizations/src/users.rs` - Add hREA agent ID fields
- `dnas/requests_and_offers/zomes/coordinator/users_organizations/src/organizations.rs` - Add hREA agent ID fields
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
- `documentation/task-lists/hREA_EXCHANGE_PROCESS_PLAN.md` - The continuation of this plan, focusing on the interactive exchange lifecycle

### Success Metrics

- ✅ All existing users successfully mapped to hREA agents
- ✅ GraphQL client initialization issues resolved
- ✅ Professional tabbed interface implemented with clear agent categorization
- ✅ Auto-initialization pattern established for robust GraphQL operations
- ✅ All existing organizations successfully mapped to hREA agents
- ✅ All existing **approved** service types successfully mapped to resource specifications
- ✅ All existing **approved** mediums of exchange successfully mapped to resource specifications with distinct classification
- ✅ Action hash reference system implemented for independent entity updates (users, organizations, service types, mediums of exchange)
- ✅ Organization deletion properly handled with hREA agent cleanup
- ✅ Resource specification navigation working with proper action hash conversion
- ✅ Service Type and Medium of Exchange resource specifications are distinctly queryable and manageable
- [ ] The system can successfully take a `Request` or `Offer` and generate a valid hREA `Proposal` containing reciprocal intents
- ✅ Real-time synchronization working for Person and Organization `Agent` mappings
- ✅ Real-time, status-aware synchronization working for Service Type → Resource Specification mappings
- ✅ Real-time, status-aware synchronization working for Medium of Exchange → Resource Specification mappings
- ✅ Data integrity maintained across foundational Agent mappings
- ✅ Performance impact minimal (< 10% overhead) for the agent mapping processes
- ✅ Comprehensive test coverage for agent mappings and action hash reference system with all tests passing

### Next Immediate Priorities

1.  **Refactor Agent Mapping to 'Accepted' Status**: Implement the new conditional mapping logic for users and organizations and enforce agent immutability.
2.  **Request → Proposal + Intents Mapping**: Begin implementation of the economic flow mapping from application requests to hREA proposals
4.  **Offer → Proposal + Intents Mapping**: Implement the counterpart mapping for offers to hREA proposals
5.  **Proposal Manager Component**: Build the visualization component for the Proposals tab in the hREA test interface
6.  **Economic Flow Store**: Create dedicated store for managing economic flow state and orchestration

## Plan Scope and Handoff

The completion of this integration plan marks a critical milestone. At the end of this phase, the application will have a robust, one-way synchronization from its core entities to their hREA counterparts.

**The primary outputs of this plan are:**
- ✅ **Mapped Foundational Entities**: `Users`, `Organizations`, and `Service Types` are successfully and continuously mapped to hREA `Agents` and `ResourceSpecifications`
- ✅ **Action Hash Reference System**: Independent update capability between main DNA entities and hREA entities through action hash references
- [ ] **Medium of Exchange Specifications**: Core MoE entities properly defined as ResourceSpecifications
- [ ] **A `Proposal` Creation Engine**: The system can take a `Request` or `Offer` from the application and translate it into a valid, reciprocal hREA `Proposal` containing the correct bundled `Intents`

This plan concludes at the point of `Proposal` creation. The subsequent interactions with that proposal—discovery, acceptance, agreement formation, and fulfillment—are covered in the `hREA_EXCHANGE_PROCESS_PLAN.md`.
