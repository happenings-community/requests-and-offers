# hREA  Entity Mapping Plan

Implementation plan for mapping existing entities in the Requests and Offers application with hREA (Holochain Resource-Event-Agent). This focuses on the foundational setup needed before implementing exchange processes.

## Completed Tasks

- [x] Created comprehensive hREA integration documentation (`ui/hREA-intallation.md`)
- [x] Analyzed existing entity mapping to hREA structures
- [x] Defined entity mapping strategy for Users, Organizations, Service Types, Requests, and Offers
- [x] Researched hREA dependencies and GraphQL implementation patterns
- [x] Created hREA Integration Tutorial with admin test page
- [x] Established basic hREA service and store patterns
- [x] Implemented foundational hREA GraphQL client setup

## In Progress Tasks

*Ready to begin post-installation entity mapping implementation*

## Future Tasks

### Phase 1: Foundation Entity Mapping

**Priority: Critical for MVP foundation**

This phase implements the core entity mappings that form the foundation of our hREA integration, following the economic flow model: `Agent -> Proposal -> Intent -> Resource`.

#### 1.1: Individual Users → Person Agents

- [ ] Create User-Agent mapping infrastructure
  - [ ] Design user-agent relationship data structure
  - [ ] Add `hrea_agent_id` field to existing user records
  - [ ] Create bidirectional mapping utilities (User ↔ Agent)
  - [ ] Implement agent creation from user profile data

- [ ] Implement User → Person Agent service
  - [ ] Create `createPersonAgentFromUser()` mutation wrapper
  - [ ] Map user profile fields to hREA Person agent properties
  - [ ] Handle user avatar/image mapping to agent profile
  - [ ] Implement error handling for agent creation failures

- [ ] User-Agent synchronization
  - [ ] Create user profile update → agent profile sync
  - [ ] Implement agent profile update → user profile sync
  - [ ] Add conflict resolution for profile discrepancies
  - [ ] Create agent query by user ID functionality

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

## Implementation Plan

### Enhanced Entity Mapping Strategy

Based on the sophisticated economic flow model from `hrea-integration.md`, our mapping strategy follows the complete ValueFlows pattern:

```
Current Entities → hREA Entities (Sophisticated Mapping)
================   ===========================================
Users           → Person Agents (individual economic actors)
Organizations   → Organization Agents (collective economic actors)
Service Types   → Resource Specifications (standardized service definitions)
Requests        → Proposals bundling Intents (action: 'work', provider: null)
Offers          → Proposals bundling Intents (action: 'work', receiver: null)

Economic Flow Integration:
==========================
Request Match   → Agreements (bundling complementary commitments)
Work Completion → Feedback Process (quality assurance gate)
Positive Feedback → Economic Events (conditional fulfillment)
```

### Core Entity Mappings (Updated for Economic Flow)

- **Users → Person Agents**: Individual users become hREA Person agents with full profile integration and relationship tracking
- **Organizations → Organization Agents**: Organizations become hREA Organization agents with member relationships and collective capabilities
- **Service Types → Resource Specifications**: Service categories become standardized resource specifications with skill taxonomies and quality metrics
- **Requests → Proposals + Intents**: Service requests become hREA Proposals that bundle Intents expressing need to receive work/services
- **Offers → Proposals + Intents**: Service offers become hREA Proposals that bundle Intents expressing willingness to provide work/services
- **Request-Offer Matches → Agreements**: Successful matches generate hREA Agreements bundling complementary commitments
- **Work Completion → Feedback → Economic Events**: Completed work triggers feedback processes that conditionally create economic events upon positive feedback

### Technical Implementation Approach

1. **Service Layer Integration**: Extend existing Effect TS service patterns to include hREA operations with proper error handling and dependency injection
2. **GraphQL Apollo Client**: Use established Apollo Client pattern with hREA schema for ValueFlows operations
3. **Bidirectional Data Mapping**: Create sophisticated mapping utilities that maintain consistency between our entities and hREA structures
4. **Real-time Synchronization**: Implement event-driven sync mechanisms that automatically maintain hREA entities when our entities change
5. **Economic Flow Orchestration**: Implement the complete flow from proposals through feedback-driven economic events
6. **Quality Assurance Integration**: Build feedback mechanisms into the economic flow for reputation and trust management

### Key Dependencies (Updated)

- `@valueflows/vf-graphql-holochain@^0.0.3-alpha.10` - hREA v0.3.2 GraphQL integration
- `@apollo/client@^3.13.8` - GraphQL client for hREA operations
- `graphql@^16.8.0` - Core GraphQL library for schema operations
- hREA DNA (happ-0.3.2-beta) - Core hREA Holochain DNA (Holochain 0.5.x compatible)

### Implementation Phases (Updated for Economic Flow)

1. **Foundation Mapping**: Map core entities (Users→Agents, Organizations→Agents, ServiceTypes→ResourceSpecs) with bidirectional sync
2. **Economic Flow Mapping**: Implement sophisticated Requests/Offers→Proposals+Intents mapping with agreement formation capabilities
3. **Data Migration & Sync**: Create comprehensive migration tools and real-time synchronization mechanisms
4. **Testing & Validation**: Extensive testing of entity mappings, economic flows, and performance with real datasets
5. **Advanced Features**: Implement reputation systems, quality assurance, and sophisticated matching algorithms

### Relevant Files

#### New Files to Create (Post-Installation Focus)

**Entity Mapping Services:**
- `ui/src/lib/services/zomes/hrea.service.ts` ✅ - Core hREA GraphQL service (created)
- `ui/src/lib/services/mappers/agent-mapping.service.ts` - User/Organization → Agent mapping
- `ui/src/lib/services/mappers/resource-spec-mapping.service.ts` - ServiceType → ResourceSpec mapping
- `ui/src/lib/services/mappers/proposal-mapping.service.ts` - Request/Offer → Proposal + Intent mapping
- `ui/src/lib/services/mappers/economic-flow.service.ts` - Agreement, Commitment, and Event orchestration

**Store Extensions:**
- `ui/src/lib/stores/hrea.store.svelte.ts` ✅ - Core hREA state management (created)
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

**Existing Entity Extensions:**
- `dnas/requests_and_offers/zomes/coordinator/users_organizations/src/users.rs` - Add hREA agent ID fields
- `dnas/requests_and_offers/zomes/coordinator/service_types/src/service_types.rs` - Add resource spec ID fields
- `dnas/requests_and_offers/zomes/coordinator/requests/src/requests.rs` - Add proposal/intent ID fields
- `dnas/requests_and_offers/zomes/coordinator/offers/src/offers.rs` - Add proposal/intent ID fields

**UI Type Extensions:**
- `ui/src/lib/types/holochain.ts` - Add hREA ID fields to existing types
- `ui/src/lib/types/ui.ts` - Add hREA mapping status to UI types

**Store Integration:**
- `ui/src/lib/stores/users.store.svelte.ts` - Integrate agent mapping
- `ui/src/lib/stores/organizations.store.svelte.ts` - Integrate agent mapping
- `ui/src/lib/stores/serviceTypes.store.svelte.ts` - Integrate resource spec mapping
- `ui/src/lib/stores/requests.store.svelte.ts` - Integrate proposal mapping
- `ui/src/lib/stores/offers.store.svelte.ts` - Integrate proposal mapping

#### Documentation Files
- `documentation/task-lists/HREA_INTEGRATION_TUTORIAL.md` ✅ - Installation tutorial (created)
- `documentation/architecture/hrea-integration.md` ✅ - Economic flow architecture (exists)
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