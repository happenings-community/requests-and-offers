# hREA Installation and Entity Mapping Plan

Implementation plan for installing hREA (Holochain Resource-Event-Agent) and mapping existing entities in the Requests and Offers application. This focuses on the foundational setup needed before implementing exchange processes.

## Completed Tasks

- [x] Created comprehensive hREA integration documentation (`ui/hREA-intallation.md`)
- [x] Analyzed existing entity mapping to hREA structures
- [x] Defined entity mapping strategy for Users, Organizations, Service Types, Requests, and Offers
- [x] Researched hREA dependencies and GraphQL implementation patterns

## In Progress Tasks

*Currently no tasks in progress*

## Future Tasks

### Phase 1: hREA Dependencies and Installation

- [ ] Install hREA dependencies
  - [ ] Add `@valueflows/vf-graphql-holochain` package to ui/package.json
  - [ ] Add `@apollo/client` v3.8.0+ for GraphQL client
  - [ ] Add `svelte-apollo` for Svelte integration
  - [ ] Update package.json with all hREA-specific dependencies

- [ ] Integrate hREA DNA into Holochain application
  - [ ] Download hREA DNA from official release (happ-0.3.1-beta)
  - [ ] Configure external zome integration in DNA configuration
  - [ ] Update workdir/happ.yaml to include hREA DNA
  - [ ] Test DNA integration with existing zomes
  - [ ] Verify hREA DNA is accessible from existing zomes

### Phase 2: Apollo Client and GraphQL Setup

- [ ] Setup Apollo Client with hREA schema
  - [ ] Create hREA service wrapper (`ui/src/lib/services/hREAService.ts`)
  - [ ] Configure Apollo Client with Holochain schema integration
  - [ ] Implement schema linking for hREA GraphQL operations
  - [ ] Create Svelte Apollo client configuration
  - [ ] Add GraphQL query/mutation utilities following Effect TS patterns

- [ ] Create hREA GraphQL foundations
  - [ ] Set up basic GraphQL query structure
  - [ ] Create GraphQL error handling with Effect TS
  - [ ] Implement GraphQL response mapping utilities
  - [ ] Add GraphQL client state management

### Phase 3: Agent Mapping Implementation

- [ ] Map Users to hREA Agents
  - [ ] Create User → Agent mapping service
  - [ ] Implement agent creation from user profiles
  - [ ] Add agent ID storage to user records
  - [ ] Create agent profile synchronization

- [ ] Map Organizations to hREA Agents
  - [ ] Create Organization → Agent mapping service
  - [ ] Implement agent creation from organization profiles
  - [ ] Add agent ID storage to organization records
  - [ ] Handle organization member relationships in hREA context

- [ ] Implement Agent management operations
  - [ ] Create agent registration flow
  - [ ] Implement agent profile updates
  - [ ] Add agent query operations
  - [ ] Create agent relationship management

### Phase 4: Resource Specifications Mapping

- [ ] Map Service Types to hREA Resource Specifications
  - [ ] Create Service Type → Resource Specification mapping service
  - [ ] Implement resource specification creation from service types
  - [ ] Add resource specification ID storage to service type records
  - [ ] Handle service type tags as resource classifications

- [ ] Implement Resource Specification operations
  - [ ] Create resource specification CRUD operations
  - [ ] Implement resource specification search and discovery
  - [ ] Add resource specification classification system
  - [ ] Create resource specification validation

### Phase 5: Intent Mapping (Requests and Offers)

- [ ] Map Requests to hREA Intents
  - [ ] Create Request → Intent mapping service (action: 'work', provider: null)
  - [ ] Implement intent creation from request data
  - [ ] Add intent ID storage to request records
  - [ ] Link requests to resource specifications

- [ ] Map Offers to hREA Intents
  - [ ] Create Offer → Intent mapping service (action: 'work', receiver: null)
  - [ ] Implement intent creation from offer data
  - [ ] Add intent ID storage to offer records
  - [ ] Link offers to resource specifications

- [ ] Implement Intent management operations
  - [ ] Create intent CRUD operations
  - [ ] Implement intent query and filtering
  - [ ] Add intent validation and error handling
  - [ ] Create intent-resource specification relationships

### Phase 6: Data Migration and Synchronization

- [ ] Create data migration utilities
  - [ ] Build migration scripts for existing users to agents
  - [ ] Build migration scripts for existing organizations to agents
  - [ ] Build migration scripts for existing service types to resource specifications
  - [ ] Build migration scripts for existing requests/offers to intents

- [ ] Implement synchronization mechanisms
  - [ ] Create real-time sync for new user → agent creation
  - [ ] Create real-time sync for new organization → agent creation
  - [ ] Create real-time sync for new service type → resource specification creation
  - [ ] Create real-time sync for new request/offer → intent creation

### Phase 7: Testing and Validation

- [ ] Create unit tests for entity mapping
  - [ ] Test user to agent mapping accuracy
  - [ ] Test organization to agent mapping accuracy
  - [ ] Test service type to resource specification mapping accuracy
  - [ ] Test request/offer to intent mapping accuracy

- [ ] Create integration tests
  - [ ] Test hREA GraphQL operations
  - [ ] Test data migration scripts
  - [ ] Test synchronization mechanisms
  - [ ] Test error handling and edge cases

- [ ] Validate hREA compliance
  - [ ] Verify all mapped entities follow hREA standards
  - [ ] Test GraphQL schema compatibility
  - [ ] Validate data integrity across mappings

## Implementation Plan

### Entity Mapping Strategy

This plan focuses on mapping our existing entities to hREA structures as foundational work:

```
Current Entities → hREA Entities
================   =============
Users           → Agents
Organizations   → Agents  
Service Types   → Resource Specifications
Requests        → Intents (action: 'work', provider: null)
Offers          → Intents (action: 'work', receiver: null)
```

### Core Entity Mappings

- **Users → hREA Agents**: Individual users become hREA agents with profile information
- **Organizations → hREA Agents**: Organizations become hREA agents with organizational details
- **Service Types → Resource Specifications**: Service categories become resource specifications with tags as classifications
- **Requests → Intents**: Service requests become intents representing work needed
- **Offers → Intents**: Service offers become intents representing work provided

### Technical Implementation Approach

1. **Service Layer**: Create hREA service wrapper using Effect TS patterns following system architecture
2. **GraphQL Integration**: Use Apollo Client with hREA schema for all operations
3. **Data Migration**: Create migration scripts to convert existing data to hREA format
4. **Synchronization**: Implement real-time sync for new entities
5. **Testing Strategy**: Focus on entity mapping accuracy and data integrity

### Key Dependencies

- `@valueflows/vf-graphql-holochain` - Core hREA GraphQL integration
- `@apollo/client` v3.8.0+ - GraphQL client for hREA operations
- `svelte-apollo` - Svelte bindings for Apollo Client
- hREA DNA (happ-0.3.1-beta) - Core hREA Holochain DNA

### Implementation Phases

1. **Installation**: Set up hREA dependencies and DNA integration
2. **GraphQL Setup**: Configure Apollo Client with hREA schema
3. **Agent Mapping**: Map users and organizations to hREA agents
4. **Resource Specifications**: Map service types to resource specifications
5. **Intent Mapping**: Map requests and offers to hREA intents
6. **Migration & Sync**: Create data migration and synchronization mechanisms
7. **Testing**: Validate entity mappings and data integrity

### Relevant Files

#### New Files to Create
- `ui/src/lib/services/hREAService.ts` - Main hREA service wrapper
- `ui/src/lib/services/zomes/hrea.service.ts` - hREA zome service integration
- `ui/src/lib/types/hrea.ts` - hREA TypeScript types
- `ui/src/lib/schemas/hrea.schemas.ts` - hREA data schemas
- `ui/src/lib/utils/hrea-mappers.ts` - Entity mapping utilities
- `scripts/migrate-to-hrea.ts` - Data migration scripts
- `tests/src/requests_and_offers/hrea/` - hREA mapping tests

#### Files to Modify
- `ui/package.json` - Add hREA dependencies
- `workdir/happ.yaml` - Include hREA DNA configuration
- `ui/src/lib/services/HolochainClientService.svelte.ts` - Add hREA client support
- `ui/src/lib/types/entities.ts` - Add hREA ID fields to existing entities
- Database schemas - Add hREA ID fields to existing entities

#### Documentation Files
- `ui/hREA-intallation.md` ✅ - Comprehensive integration guide
- `documentation/architecture/hrea-integration.md` ✅ - Architecture documentation
- `documentation/technical-specs/hrea-entity-mapping.md` - Entity mapping specifications

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