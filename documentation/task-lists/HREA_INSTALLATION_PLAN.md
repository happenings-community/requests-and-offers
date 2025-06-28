# hREA v0.3.2 Installation Plan

Modernizing hREA integration in the Requests and Offers application by updating from the legacy GraphQL approach to the modern Apollo Client + Svelte 5 approach recommended for hREA v0.3.2.

## Completed Tasks

*Initial analysis and planning phase*

## In Progress Tasks

*Ready to begin implementation*

## Future Tasks

### Phase 1: Dependencies and Configuration Updates

**Priority: Critical - Foundation Setup**

#### 1.1: Update Package Dependencies

- [ ] Update hREA-related dependencies to v0.3.2 compatible versions
  - [ ] Replace `@leosprograms/vf-graphql-holochain` with `@valueflows/vf-graphql-holochain@^0.0.3-alpha.10`
  - [ ] Replace `@leosprograms/vf-graphql` with `@valueflows/vf-graphql@^0.9.0-alpha.10`
  - [ ] Add `@apollo/client@^3.13.8` for modern GraphQL client
  - [ ] Update `graphql` to `^16.8.0` (currently atyes please ^15.10.1)
  - [ ] Remove deprecated `@leosprograms/*` packages
  - [ ] Remove `graphql-tag` dependency (Apollo Client includes this)

#### 1.2: Download and Configure hREA v0.3.2 DNA

- [ ] Add hREA v0.3.2 DNA download script to package.json
  - [ ] Create `download-hrea` script targeting hREA v0.3.2 beta release
  - [ ] Download to `workdir/hrea.dna` (not `hrea_combined.dna`)
  - [ ] Add to `postinstall` script for automatic setup

#### 1.3: Update hApp Configuration

- [ ] Update `workdir/happ.yaml` configuration
  - [ ] Uncomment and update hREA role configuration
  - [ ] Change bundled DNA path from `hrea_combined.dna` to `hrea.dna`
  - [ ] Update role name from `hrea_combined` to `hrea` (standard convention)
  - [ ] Ensure proper provisioning strategy and modifiers

#### 1.4: Update HolochainClientService for hREA Support

- [ ] Update `ui/src/lib/services/HolochainClientService.svelte.ts`
  - [ ] Change `RoleName` type to use `'hrea'` instead of `'hrea_combined'`
  - [ ] Ensure service supports the new hREA role name
  - [ ] Verify Effect TS integration remains intact

### Phase 2: Modern hREA Service Architecture

**Priority: High - Core Integration Layer**

#### 2.1: Create Modern hREA Context System

- [ ] Create `ui/src/lib/contexts/hrea.svelte.ts`
  - [ ] Implement `HolochainClientState` class using Svelte 5 runes
  - [ ] Implement `HREAClientState` class using Svelte 5 runes
  - [ ] Create context factories and getters
  - [ ] Integrate with `createHolochainSchema` from `@valueflows/vf-graphql-holochain`
  - [ ] Use Apollo Client with SchemaLink for proper schema integration

#### 2.2: Create ClientProvider Component

- [ ] Create `ui/src/lib/components/providers/HREAClientProvider.svelte`
  - [ ] Manage connection states with Svelte 5 runes
  - [ ] Handle sequential initialization (Holochain → hREA)
  - [ ] Provide loading, error, and success states
  - [ ] Use Svelte contexts to provide clients to child components
  - [ ] Follow existing UI patterns (SkeletonUI, styling)

#### 2.3: Modernize hREA Service Layer

- [ ] Replace `ui/src/lib/services/hREAService.ts` with modern approach
  - [ ] Create `ui/src/lib/services/zomes/hrea.service.ts` following Effect TS pattern
  - [ ] Implement `HREAService` interface with Effect TS integration
  - [ ] Create `HREAServiceTag` and `HREAServiceLive` layer
  - [ ] Use Apollo Client for GraphQL operations instead of direct zome calls
  - [ ] Integrate with existing error handling patterns (`Data.TaggedError`)

#### 2.4: Create hREA Store

- [ ] Create `ui/src/lib/stores/hrea.store.svelte.ts`
  - [ ] Follow existing store patterns (Svelte 5 runes, Effect TS integration)
  - [ ] Implement state management for agents, resources, intents, proposals
  - [ ] Use `EntityCache` pattern for caching hREA entities
  - [ ] Integrate with `storeEventBus` for cross-store communication
  - [ ] Handle loading states and error management

### Phase 3: Integration with Existing Application

**Priority: Medium - Application Integration**

#### 3.1: Update Application Layout

- [ ] Update `ui/src/routes/(app)/+layout.svelte`
  - [ ] Wrap with `HREAClientProvider` component
  - [ ] Update connection status display to include hREA status
  - [ ] Maintain existing `HolochainClientService` integration
  - [ ] Preserve current styling and UX patterns

#### 3.2: Create hREA Test Interface

- [ ] Create `ui/src/lib/components/hrea/HREATestInterface.svelte`
  - [ ] Implement basic hREA operations (create agents, resource specs, intents)
  - [ ] Follow tutorial examples but adapt to existing UI patterns
  - [ ] Use SkeletonUI components for consistency
  - [ ] Add proper error handling and loading states
  - [ ] Include results display and operation history

#### 3.3: Add hREA Admin Test Page

- [ ] Create `ui/src/routes/admin/hrea-test/+page.svelte`
  - [ ] Include `HREATestInterface` component
  - [ ] Add navigation to admin sidebar
  - [ ] Follow existing admin page patterns
  - [ ] Include comprehensive testing interface for all hREA operations
  - [ ] Add debugging and diagnostics features

### Phase 4: Schema Validation and Type Safety

**Priority: Medium - Robustness**

#### 4.1: Create hREA Schema Definitions

- [ ] Create `ui/src/lib/schemas/hrea.schemas.ts`
  - [ ] Define Effect TS schemas for hREA entities (Agent, Intent, Proposal, etc.)
  - [ ] Follow existing schema patterns in the codebase
  - [ ] Ensure compatibility with GraphQL responses
  - [ ] Include validation for business logic constraints

#### 4.2: Update Type Definitions

- [ ] Create `ui/src/lib/types/hrea.ts`
  - [ ] Define TypeScript interfaces for hREA entities
  - [ ] Include UI-specific types (loading states, error types)
  - [ ] Ensure compatibility with existing type patterns
  - [ ] Add mapper types for entity relationships

#### 4.3: Create hREA Utilities

- [ ] Create `ui/src/lib/utils/hrea.ts`
  - [ ] Entity mapping utilities (requests ↔ intents, offers ↔ proposals)
  - [ ] Data transformation helpers
  - [ ] GraphQL response processing utilities
  - [ ] Integration with existing `sanitizeForSerialization` patterns

### Phase 5: Testing and Validation

**Priority: High - Quality Assurance**

#### 5.1: Unit Tests for hREA Components

- [ ] Create `ui/tests/unit/services/hrea.service.test.ts`
  - [ ] Test hREA service operations
  - [ ] Mock Apollo Client responses
  - [ ] Test error handling scenarios
  - [ ] Follow existing test patterns with Effect TS

#### 5.2: Integration Tests

- [ ] Create `ui/tests/integration/hrea-integration.test.ts`
  - [ ] Test full hREA connection flow
  - [ ] Test GraphQL operations end-to-end
  - [ ] Test schema validation
  - [ ] Validate against running hREA DNA

#### 5.3: Store Tests

- [ ] Create `ui/tests/unit/stores/hrea.store.test.ts`
  - [ ] Test store state management
  - [ ] Test reactive updates
  - [ ] Test cache behavior
  - [ ] Test event bus integration

### Phase 6: Documentation and Cleanup

**Priority: Low - Maintenance**

#### 6.1: Update Documentation

- [ ] Update `documentation/task-lists/HREA_INTEGRATION_PLAN.md`
  - [ ] Mark installation as completed
  - [ ] Update with actual implementation details
  - [ ] Document new architecture patterns

#### 6.2: Code Cleanup

- [ ] Remove deprecated dependencies
- [ ] Clean up old hREA service file
- [ ] Update imports throughout codebase
- [ ] Remove commented-out code sections

#### 6.3: Performance Testing

- [ ] Test application startup with hREA
- [ ] Validate GraphQL query performance
- [ ] Test with multiple concurrent users
- [ ] Optimize bundle size impact

## Implementation Plan

### Modern Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│               SvelteKit Application                 │
├─────────────────────────────────────────────────────┤
│         HREAClientProvider (Context)                │
├─────────────────────────────────────────────────────┤
│    Apollo Client + SchemaLink (GraphQL)             │
├─────────────────────────────────────────────────────┤
│           Effect TS Service Layer                   │
├─────────────────────────────────────────────────────┤
│         Svelte 5 Stores + EntityCache               │
├─────────────────────────────────────────────────────┤
│           Holochain Client (WebSocket)              │
├─────────────────────────────────────────────────────┤
│        hREA DNA v0.3.2    │    Custom DNA           │
│      (ValueFlows)         │  (App Logic)            │
└─────────────────────────────────────────────────────┘
```

### Key Technical Decisions

1. **Apollo Client Integration**: Use `@apollo/client` with `SchemaLink` and `createHolochainSchema` from `@valueflows/vf-graphql-holochain` for modern GraphQL operations

2. **Effect TS Preservation**: Maintain existing Effect TS patterns in service layer while integrating Apollo Client for hREA operations

3. **Svelte 5 Runes**: Use modern Svelte 5 reactive patterns throughout the hREA integration for optimal performance

4. **Context-Based Architecture**: Use Svelte contexts for dependency injection of Apollo Client, following the tutorial pattern but adapted to existing application structure

5. **Gradual Migration**: Preserve existing service patterns while adding hREA as an additional service layer, minimizing disruption

### Dependencies Update Strategy

**Remove (Legacy Packages):**
- `@leosprograms/graphql-client-holochain` 
- `@leosprograms/vf-graphql`
- `@leosprograms/vf-graphql-holochain`
- `@vf-ui/graphql-client-holochain`
- `@vf-ui/graphql-client-mock`
- `graphql-tag` (included in Apollo Client)

**Add (Modern Packages):**
- `@apollo/client@^3.13.8`
- `@valueflows/vf-graphql-holochain@^0.0.3-alpha.10`

**Update (Version Bumps):**
- `graphql` from `^15.10.1` to `^16.8.0`
- `@valueflows/vf-graphql` from `^0.9.0-alpha.10` to latest compatible

### Integration Points

1. **Service Layer**: New `hrea.service.ts` will integrate Apollo Client with existing Effect TS patterns
2. **Store Layer**: New `hrea.store.svelte.ts` will follow existing store patterns with Svelte 5 runes
3. **Component Layer**: New provider component will manage hREA connection state
4. **Type System**: New types and schemas will integrate with existing validation patterns
5. **Testing**: New tests will follow existing patterns with Effect TS and Vitest

### Risk Mitigation

1. **Backward Compatibility**: Existing functionality remains unchanged during hREA integration
2. **Incremental Testing**: Each phase includes comprehensive testing before proceeding
3. **Rollback Strategy**: Old hREA service is preserved until new implementation is verified
4. **Performance Monitoring**: Bundle size and runtime performance tracked throughout

## Relevant Files

### Files to Create

**Core hREA Integration:**
- `ui/src/lib/contexts/hrea.svelte.ts` - Modern context management with Svelte 5 runes
- `ui/src/lib/components/providers/HREAClientProvider.svelte` - Connection state management
- `ui/src/lib/services/zomes/hrea.service.ts` - Effect TS service layer for hREA
- `ui/src/lib/stores/hrea.store.svelte.ts` - Svelte 5 store with EntityCache

**Type System:**
- `ui/src/lib/types/hrea.ts` - TypeScript interfaces for hREA entities
- `ui/src/lib/schemas/hrea.schemas.ts` - Effect TS schemas for validation
- `ui/src/lib/utils/hrea.ts` - Helper utilities and mappers

**UI Components:**
- `ui/src/lib/components/hrea/HREATestInterface.svelte` - Testing interface
- `ui/src/routes/admin/hrea-test/+page.svelte` - Admin test page

**Testing:**
- `ui/tests/unit/services/hrea.service.test.ts` - Service tests
- `ui/tests/unit/stores/hrea.store.test.ts` - Store tests  
- `ui/tests/integration/hrea-integration.test.ts` - Integration tests

**Configuration:**
- `HREA_INSTALLATION_PLAN.md` ✅ - This plan document

### Files to Modify

**Package Configuration:**
- `ui/package.json` - Update dependencies and add download script
- `workdir/happ.yaml` - Uncomment and update hREA role configuration

**Core Services:**
- `ui/src/lib/services/HolochainClientService.svelte.ts` - Update role names
- `ui/src/routes/(app)/+layout.svelte` - Add HREAClientProvider

**Legacy Cleanup:**
- `ui/src/lib/services/hREAService.ts` - Replace with modern implementation

### Success Metrics

- [ ] hREA v0.3.2 DNA successfully integrated and running
- [ ] Apollo Client connected to hREA GraphQL schema
- [ ] Basic hREA operations (create agents, intents) working in test interface
- [ ] All existing functionality preserved and working
- [ ] No performance degradation in application startup
- [ ] Comprehensive test coverage for hREA integration
- [ ] Clean separation between hREA and custom application logic 