# hREA v0.3.2 Installation Plan

Modernizing hREA integration in the Requests and Offers application by updating from the legacy GraphQL approach to the modern Apollo Client + Svelte 5 approach recommended for hREA v0.3.2.

## Completed Tasks

### Phase 1: Dependencies and Configuration Updates
- [x] **1.1: Update Package Dependencies**: Updated to `@valueflows/vf-graphql-holochain`, added `@apollo/client`, and removed deprecated packages.
- [x] **1.2: Download and Configure hREA v0.3.2 DNA**: Added a `download-hrea` script to `package.json` to fetch the DNA and added it to `postinstall`.
- [x] **1.3: Update hApp Configuration**: Updated `workdir/happ.yaml` to use the new `hrea.dna` with the correct role name.
- [x] **1.4: Update HolochainClientService for hREA Support**: Updated `RoleName` type in `HolochainClientService.svelte.ts` and `holochainClient.service.ts` to `'hrea'`.

### Phase 2: Effect-Based hREA Service Architecture
- [x] **2.1: Create hREA Effect Service**: Created `ui/src/lib/services/zomes/hrea.service.ts` following the established Effect Service pattern. The service initializes an Apollo Client instance for hREA.
- [x] **2.2: Create hREA Store**: Created `ui/src/lib/stores/hrea.store.svelte.ts` to manage the hREA service's state. The store uses Svelte 5 runes and provides an `initialize` method.

### Phase 3: Integration with Existing Application
- [x] **3.1: Update Application Layout**: Updated `ui/src/routes/(app)/+layout.svelte` to use `hreaStore.initialize()` on mount to connect to the hREA DNA.
- [x] **3.2: Create hREA Test Interface**: Created `ui/src/lib/components/hrea/HREATestInterface.svelte` with a form to create "Person" agents and display the results from the store.
- [x] **3.3: Add hREA Admin Test Page**: Created `ui/src/routes/admin/hrea-test/+page.svelte` and added a link to it in the `AdminSideBar.svelte` component.

### Phase 4: Schema Validation and Type Safety
- [x] **4.1: Create hREA Schema Definitions**: Created `ui/src/lib/schemas/hrea.schemas.ts` and defined `AgentSchema` for validation.
- [x] **4.2: Update Type Definitions**: Created `ui/src/lib/types/hrea.ts` and defined the `Agent` type from the schema.
- [x] **4.3: Integrate Schema into Service**: Refactored `hrea.service.ts` to be stateful and use `AgentSchema` to validate the response when creating a person.

### Phase 6: Documentation and Cleanup
- [x] **6.2: Code Cleanup**: Verified that the obsolete `hREAService.ts` file was already removed.

## In Progress Tasks

### Phase 5: Finalizing Installation with Testing

**Priority: High - Quality Assurance**

This final phase focuses on ensuring the stability and correctness of the hREA integration through comprehensive testing of the service and store layers. UI component testing is excluded from this plan.

#### 5.1: Unit Tests for hREA Service
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

## Implementation Plan

### Modern Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│               SvelteKit Application                 │
├─────────────────────────────────────────────────────┤
│      hrea.service.ts      │   other services...     │
│      (Apollo Client)      │   (Effect Services)     │
├─────────────────────────────────────────────────────┤
│           Effect TS Service Layer                   │
├─────────────────────────────────────────────────────┤
│         Svelte 5 Stores + EntityCache               │
├─────────────────────────────────────────────────────┤
│         HolochainClientService (WebSocket)          │
├─────────────────────────────────────────────────────┤
│        hREA DNA v0.3.2    │    Custom DNA           │
│      (ValueFlows)         │  (App Logic)            │
└─────────────────────────────────────────────────────┘
```

### Key Technical Decisions

1. **Effect-Based Service**: The hREA integration will be managed by a pure Effect TS service (`hrea.service.ts`), not a Svelte component. This aligns with our existing architecture.

2. **Apollo Client Integration**: The `hrea.service.ts` will encapsulate the `ApolloClient` instance, created using utilities from `@valueflows/vf-graphql-holochain`.

3. **Effect TS Preservation**: Maintain existing Effect TS patterns in service layer. The `hrea.service.ts` will depend on `HolochainClientService` via Effect's dependency injection.

4. **Svelte 5 Runes**: Use modern Svelte 5 reactive patterns in the `hrea.store.svelte.ts` for optimal state management.

5. **Gradual Migration**: Preserve existing service patterns while adding hREA as an additional, consistent service layer.

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

1. **Service Layer**: New `hrea.service.ts` will integrate Apollo Client and depend on `HolochainClientService`.
2. **Store Layer**: New `hrea.store.svelte.ts` will follow existing store patterns with Svelte 5 runes and depend on `HREAService`.
3. **Component Layer**: Test components will use the store/composables, not Svelte context.
4. **Type System**: New types and schemas will integrate with existing validation patterns.
5. **Testing**: New tests will follow existing patterns with Effect TS and Vitest

### Risk Mitigation

1. **Backward Compatibility**: Existing functionality remains unchanged during hREA integration
2. **Incremental Testing**: Each phase includes comprehensive testing before proceeding
3. **Rollback Strategy**: Old hREA service is preserved until new implementation is verified
4. **Performance Monitoring**: Bundle size and runtime performance tracked throughout

## Relevant Files

### Files to Create

**Core hREA Integration:**
- `ui/src/lib/services/zomes/hrea.service.ts` ✅ - Effect TS service layer for hREA
- `ui/src/lib/stores/hrea.store.svelte.ts` ✅ - Svelte 5 store with EntityCache

**Type System:**
- `ui/src/lib/types/hrea.ts` ✅ - TypeScript interfaces for hREA entities
- `ui/src/lib/schemas/hrea.schemas.ts` ✅ - Effect TS schemas for validation
- `ui/src/lib/utils/hrea.ts` - Helper utilities and mappers

**UI Components:**
- `ui/src/lib/components/hrea/HREATestInterface.svelte` ✅ - Testing interface
- `ui/src/routes/admin/hrea-test/+page.svelte` ✅ - Admin test page

**Testing:**
- `ui/tests/unit/services/hrea.service.test.ts` - Service tests
- `ui/tests/unit/stores/hrea.store.test.ts` - Store tests  
- `ui/tests/integration/hrea-integration.test.ts` - Integration tests

**Configuration:**
- `HREA_INSTALLATION_PLAN.md` ✅ - This plan document

### Files to Modify

**Package Configuration:**
- `ui/package.json` ✅ - Update dependencies and add download script
- `workdir/happ.yaml` ✅ - Uncomment and update hREA role configuration

**Core Services:**
- `ui/src/lib/services/HolochainClientService.svelte.ts` ✅ - Update role names
- `ui/src/routes/(app)/+layout.svelte` ✅ - Use hrea.store/composable to manage connection

**Legacy Cleanup:**
- `ui/src/lib/services/hREAService.ts` ✅ - Replace with modern implementation

### Success Metrics

- [x] hREA v0.3.2 DNA successfully integrated and running
- [x] Apollo Client connected to hREA GraphQL schema
- [x] Basic hREA operations (create agents, intents) working in test interface
- [ ] All existing functionality preserved and working
- [ ] No performance degradation in application startup
- [ ] Comprehensive test coverage for hREA integration
- [ ] Clean separation between hREA and custom application logic 