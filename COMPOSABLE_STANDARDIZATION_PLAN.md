# Composable Standardization Implementation Plan

Implementation plan for standardizing composables across the Requests and Offers project to improve maintainability, reusability, and testing capabilities.

## Completed Tasks

### Phase 1: Infrastructure & Organization ✅
- [x] Analyze existing composables (`useServiceTypesManagement`, `useServiceTypeSearch`)
- [x] Create standardization documentation (`documentation/ai/rules/composable-patterns.md`)
- [x] Define architectural role and patterns for composables
- [x] Create new composables directory structure
- [x] Create base composable interfaces and types (moved to `ui/src/lib/types/ui.ts`)
- [x] Create barrel export file (`ui/src/lib/composables/index.ts`)
- [x] Create first utility composable (`useDebounce` - moved to `ui/src/lib/utils/index.ts`)
- [x] Create modal management composable (moved to `ui/src/lib/utils/composables.ts`)
- [x] Create toast notifications composable (moved to `ui/src/lib/utils/composables.ts`)
- [x] **Architecture Integration**: Moved all types and utilities to main folders
- [x] **Enhanced Effect Utils**: Added composable-specific utilities to `ui/src/lib/utils/effect.ts`

### Phase 2: Standardize Existing Composables ✅
- [x] Refactor `useServiceTypesManagement` to follow standard patterns
- [x] Refactor `useServiceTypeSearch` to follow standard patterns
- [x] Update components using existing composables
- [x] Move composables to proper domain/search folders
- [x] Update import paths in components

### Phase 3: Create Domain-Specific Composables ✅ (COMPLETED)

**Current Analysis** (2024-12-19):
- ✅ Service Types: Already using composables (`useServiceTypesManagement`, `useServiceTypeSearch`)
- ✅ Offers: Pages now using `useOffersManagement` composable
- ✅ Requests: Pages now using `useRequestsManagement` composable  
- ✅ Organizations: Pages now using `useOrganizationsManagement` composable
- ✅ Users: Admin pages now using `useUsersManagement` composable

**Next Steps**:
- [x] Create `useOffersManagement` composable
- [x] Create `useRequestsManagement` composable
- [x] Create `useOrganizationsManagement` composable
- [x] Create `useUsersManagement` composable
- [x] Update pages to use new composables

## Current Tasks (Phase 3 Continuation)

- This phase is complete. All domain management composables have been created and integrated.

## Future Tasks

### Phase 4: Create Generic UI Composables (IN PROGRESS)
- [x] **`useModal`**: Confirmed `useModal` composable exists in `ui/src/lib/utils/composables.ts`.
- [x] **`useToast`**: Confirmed `useToast` composable exists in `ui/src/lib/utils/composables.ts`.
- [x] **`usePagination`**: Created `usePagination` composable and integrated into admin pages.
- [x] **`useFormValidation`**: Created `useFormValidation` composable using `Effect.Schema` and refactored `ServiceTypeForm`.

### Phase 5: Widespread Integration
- **Priority 1: `usePagination` Integration (Public Pages)**
  - [ ] Refactor `ui/src/routes/(app)/offers/+page.svelte` to use pagination.
  - [ ] Refactor `ui/src/routes/(app)/requests/+page.svelte` to use pagination.
  - [ ] Refactor `ui/src/routes/(app)/organizations/+page.svelte` to use pagination.

- **Priority 2: `useFormValidation` Integration**
  - [ ] Create `ui/src/lib/schemas/offer.schemas.ts`.
  - [ ] Refactor `ui/src/lib/components/offers/OfferForm.svelte` to use `useFormValidation`.
  - [ ] Create `ui/src/lib/schemas/request.schemas.ts`.
  - [ ] Refactor `ui/src/lib/components/requests/RequestForm.svelte` to use `useFormValidation`.
  - [ ] Audit and refactor other forms (e.g., Organization create, User profile).

### Phase 6: Testing & Documentation
- [ ] Add unit tests for all composables
- [ ] Update component integration tests
- [ ] Create usage examples and documentation

## Implementation Plan

### Architecture Overview

The composable standardization will create a **Component Logic Abstraction Layer** that:
- Extracts complex component logic into reusable functions
- Provides consistent interfaces for common patterns (CRUD, search, filtering)
- Bridges Svelte components with Effect-based stores/services
- Enables better testing through isolated business logic
- Prevents infinite reactive loops through proper state encapsulation

### Directory Structure

```
ui/src/lib/composables/
├── domain/
│   ├── useServiceTypesManagement.svelte.ts
│   ├── useOffersManagement.svelte.ts
│   ├── useRequestsManagement.svelte.ts
│   ├── useOrganizationsManagement.svelte.ts
│   └── useUsersManagement.svelte.ts
├── search/
│   ├── useEntitySearch.svelte.ts (generic base)
│   ├── useServiceTypeSearch.svelte.ts
│   ├── useOfferSearch.svelte.ts
│   ├── useRequestSearch.svelte.ts
│   └── useTagSearch.svelte.ts
├── ui/
│   ├── useModal.svelte.ts
│   ├── useToast.svelte.ts
│   ├── usePagination.svelte.ts
│   └── useFormValidation.svelte.ts
├── utils/
│   ├── useUrlParams.svelte.ts
│   ├── useDebounce.svelte.ts
│   └── useLocalStorage.svelte.ts
└── index.ts (barrel exports)
```

### Standard Patterns

1. **Consistent Interface Pattern**:
   ```typescript
   export interface UseComposableOptions<TState = {}> {
     initialState?: Partial<TState>;
     onStateChange?: (state: TState) => void;
     dependencies?: Record<string, unknown>;
   }

   export interface UseComposableReturn<TState, TActions> {
     state: TState;
     computed?: Record<string, unknown>;
     actions: TActions;
     cleanup?: () => void;
   }
   ```

2. **Effect TS Integration**: All async operations wrapped in Effect pipelines
3. **Error Handling**: Using `Data.TaggedError` for typed errors
4. **Svelte 5 Runes**: Proper usage of `$state`, `$derived`, `$effect`

### Data Flow

```
Component → Composable → Store/Service → Holochain Zome
    ↑                        ↓
    ←―――――― Effect Pipeline ←――――――
```

## Relevant Files

### New Files to Create
- `ui/src/lib/composables/index.ts` - Barrel exports ✅
- **MOVED** to `ui/src/lib/types/ui.ts` - Base types and interfaces ✅
- **MOVED** to `ui/src/lib/utils/index.ts` - Debounce utility ✅ 
- **MOVED** to `ui/src/lib/utils/composables.ts` - UI composables ✅
- `ui/src/lib/utils/effect.ts` - Enhanced Effect utilities ✅
- `ui/src/lib/composables/utils/useUrlParams.svelte.ts` - URL params management 🔄
- `ui/src/lib/composables/search/useEntitySearch.svelte.ts` - Generic search base 🔄
- `ui/src/lib/composables/domain/useOffersManagement.svelte.ts` - Offers CRUD 🔄
- `ui/src/lib/composables/domain/useRequestsManagement.svelte.ts` - Requests CRUD 🔄

### Files to Modify
- `ui/src/lib/composables/useServiceTypesManagement.svelte.ts` - Refactor to standard ✅
- `ui/src/lib/composables/useServiceTypeSearch.svelte.ts` - Refactor to standard ✅
- `ui/src/routes/admin/service-types/+page.svelte` - Update composable usage ✅
- `ui/src/routes/(app)/service-types/+page.svelte` - Update composable usage ✅
- Components using existing composables - Update to new APIs ✅

### Test Files to Create
- `ui/tests/unit/composables/` directory structure ✅
- Unit tests for each composable ✅
- Integration tests for composable interactions ✅
- Mock utilities for composable testing ✅

### Technical Implementation Details

1. **Migration Strategy**: 
   - Phase-by-phase implementation to avoid breaking changes
   - Maintain backward compatibility during transition
   - Update components incrementally

2. **Testing Strategy**:
   - Unit tests for each composable in isolation
   - Integration tests for composable-store interactions
   - Mock stores and services for testing

3. **Performance Considerations**:
   - Lazy loading of composables
   - Proper cleanup to prevent memory leaks
   - Optimized reactive updates

4. **Error Recovery**:
   - Graceful error handling in all composables
   - Error boundary patterns for component protection
   - Consistent error reporting and logging

## Dependencies

- Effect TS (`effect`) - For async operations and error handling
- Svelte 5 - For reactive state management with runes
- Vitest - For unit testing composables
- Existing stores and services - For data integration

## Success Criteria

1. All existing composables follow the standard patterns
2. New composables can be created quickly using templates
3. Components have cleaner, more focused code
4. Testing coverage for all composable logic
5. Consistent error handling across all composables
6. Improved code reusability and maintainability

## Risk Mitigation

1. **Breaking Changes**: Implement backward compatibility during migration
2. **Performance Impact**: Profile reactive updates and optimize where needed
3. **Complexity**: Keep composables focused on single responsibilities
4. **Testing Gaps**: Ensure comprehensive test coverage before deployment 