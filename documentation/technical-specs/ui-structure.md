# UI Structure Documentation

This document provides a comprehensive overview of the UI structure for the Requests and Offers application.

## Project Structure

The UI is built with:

- SvelteKit as the framework
- TailwindCSS for styling
- SkeletonUI for UI components
- Svelte 5 features (runes and native HTML events)
- **Effect TS (effect)** for functional error handling and asynchronous operations

> **🏆 MAJOR UPDATE**: **Unified Effect TS Integration** has been implemented with complete 7-layer standardization achieved in the Service Types domain. This architecture serves as the template for all other domains, ensuring consistent patterns, robust error handling, and maintainable code across the entire application.

## 🏆 Effect TS Architecture Implementation Status

### ✅ **Service Types Domain - FULLY STANDARDIZED (100%)**
- **Complete 7-Layer Pattern**: Service + Store + Schema + Error + Composables + Components + Testing
- **Pattern Template Established**: Ready for replication across all domains
- **Code Quality Revolution**: 9 standardized helper functions, massive duplication reduction
- **Type Safety Excellence**: 100% Effect dependency resolution
- **Documentation Complete**: Comprehensive pattern documentation for domain replication

### 🔄 **Current Focus: Requests Domain Standardization**
- **Goal**: Apply ALL established patterns from Service Types domain
- **Progress**: Service layer refactoring in progress
- **Target**: Complete 7-layer standardization following established template

### 📋 **Planned Implementation**
- **Offers Domain**: Apply refined patterns from Service Types + Requests domains
- **Non-Effect Domain Conversion**: 
  - Users/Organizations/Administration: Convert from Promise-based to Effect architecture
  - Apply standardized patterns across all 7 layers

### **Domain-by-Domain Progress Overview**

| Domain | Service | Store | Schema | Error | Composables | Components | Testing |
|--------|---------|--------|--------|-------|-------------|------------|---------|
| Service Types | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% | ✅ 100% |
| Requests | 🔄 In Progress | 📋 Planned | 📋 Planned | 📋 Planned | 📋 Planned | 📋 Planned | 📋 Planned |
| Offers | 📋 Planned | 📋 Planned | 📋 Planned | 📋 Planned | 📋 Planned | 📋 Planned | 📋 Planned |
| Users | ❌ Promise-based | ❌ Promise-based | ❌ Basic | ❌ Basic | ❌ Basic | ❌ Basic | ❌ Basic |
| Organizations | ❌ Promise-based | ❌ Promise-based | ❌ Basic | ❌ Basic | ❌ Basic | ❌ Basic | ❌ Basic |
| Administration | ❌ Promise-based | ❌ Promise-based | ❌ Basic | ❌ Basic | ❌ Basic | ❌ Basic | ❌ Basic |

Main directories:

- `/src/routes`: Application routes and pages
- `/src/lib`: Reusable components and utilities
- `/src/services`: **Effect-native service layer** for backend communication
- `/src/stores`: **Standardized Effect-integrated** Svelte stores for state management
- `/src/lib/composables`: **Component Logic Abstraction Layer** with Effect integration
- `/src/types`: TypeScript type definitions
- `/src/utils`: Utility functions
- `/src/lib/errors`: **Centralized tagged error management**
- `/src/lib/schemas`: **Strategic Effect Schema validation**

## Routes

The application uses SvelteKit's file-based routing system with two main sections:

### Main Application Routes (`/src/routes/(app)/`)

Contains the main application routes that are accessible to regular users:

- `/`: Home page (`+page.svelte`)
- `/service-types`: Service Types management and discovery
  - `/service-types`: Service types listing and search
  - `/service-types/create`: Suggest new service type
  - `/service-types/[id]`: Single service type view
- `/requests`: Request management
  - `/requests`: Requests listing
  - `/requests/create`: New request creation
  - `/requests/[id]`: Single request view
  - `/requests/[id]/edit`: Edit request
- `/offers`: Offer management
  - `/offers`: Offers listing
  - `/offers/create`: New offer creation
  - `/offers/[id]`: Single offer view
  - `/offers/[id]/edit`: Edit offer
- `/tags`: Tag-based discovery system
  - `/tags`: Browse all tags
  - `/tags/[tag]`: View content by specific tag (requests, offers, service types)
- `/organizations`: Organization management
  - `/organizations`: Organizations listing
  - `/organizations/create`: Create new organization
  - `/organizations/[id]`: Single organization view
  - `/organizations/[id]/edit`: Edit organization
- `/user`: User profile and settings
  - `/user`: User profile
  - `/user/create`: Create new user
  - `/user/edit`: Edit user profile
- `/users`: User directory
  - `/users`: User directory listing
  - `/users/[id]`: Single user view

Layout:

- `(app)/+layout.svelte`: Layout for main application routes

### Admin Routes (`/src/routes/admin/`)

Contains administrative routes and functionalities:

- `/admin`: Admin dashboard (`+page.svelte`)
- `/admin/service-types`: Service Types administration
  - Service type approval/rejection workflow
  - Manage suggested service types (pending → approved/rejected)
  - Tag analytics and management
- `/admin/administrators`: Administrator management
- `/admin/requests`: Request administration
- `/admin/offers`: Offer administration
- `/admin/organizations`: Organization administration
- `/admin/users`: User administration

Layout:

- `admin/+layout.svelte`: Layout for admin routes

### Root Layout

- `+layout.svelte`: The root layout component that wraps all routes
- `+layout.ts`: Layout load function for initialization
- `+error.svelte`: Global error handling component

## Services - **EFFECT TS ARCHITECTURE**

Located in `/src/services`, handling **all** communication with the Holochain backend using **unified Effect TS patterns**.

### 🏆 Standardized Effect Service Pattern

All services follow the **7-Layer Effect Service Pattern**:

#### 1. **Service Interface Definition**
```typescript
export interface DomainService {
  readonly createEntity: (entity: EntityInput) => E.Effect<Record, DomainError>;
  readonly getEntity: (hash: ActionHash) => E.Effect<Record | null, DomainError>;
  readonly getAllEntities: () => E.Effect<Record[], DomainError>;
  // ... domain-specific methods
}
```

#### 2. **Context Tag for Dependency Injection**
```typescript
export class DomainServiceTag extends Context.Tag('DomainService')<
  DomainServiceTag,
  DomainService
>() {}
```

#### 3. **Effect Layer Implementation**
```typescript
export const DomainServiceLive: Layer.Layer<
  DomainServiceTag,
  never,
  HolochainClientServiceTag
> = Layer.effect(DomainServiceTag, implementation);
```

### Implementation Status by Domain:

- **✅ `HolochainClientService`**: **Complete Effect-native** - Foundation service with schema validation
- **✅ `serviceTypes.service.ts`**: **FULLY STANDARDIZED** - Complete Effect patterns with dependency injection
- **🔄 `requests.service.ts`**: **In Standardization** - Applying Service Types patterns  
- **🔄 `offers.service.ts`**: **In Standardization** - Applying Service Types patterns
- **📋 `users.service.ts`**: **Needs Effect Conversion** - Convert from Promise-based
- **📋 `organizations.service.ts`**: **Needs Effect Conversion** - Convert from Promise-based  
- **📋 `administration.service.ts`**: **Needs Effect Conversion** - Convert from Promise-based

### Service Architecture Features:

- **Pure Effect-Native**: No Promise mixing, complete Effect ecosystem integration
- **Strategic Schema Usage**: `callZomeRawEffect` for Holochain pass-through, `callZomeEffect` for business logic
- **Domain-Specific Errors**: Tagged error system with meaningful context
- **Dependency Injection**: Clean Context.Tag/Layer pattern for composability

## Stores - **STANDARDIZED EFFECT PATTERNS**

Located in `/src/lib/stores`, implementing **factory function pattern** with **Effect integration**.

### 🏆 Standardized Store Architecture

#### The 9-Helper Function Pattern:
1. **`createUIEntity()`** - Entity creation from Holochain records
2. **`mapRecordsToUIEntities()`** - Consistent record mapping with error handling
3. **`createCacheSyncHelper()`** - Cache-to-state synchronization
4. **`createEventEmitters()`** - Standardized event emission patterns
5. **`createEntitiesFetcher()`** - Data fetching with state updates
6. **`withLoadingState()`** - Loading state wrapper for consistent UX
7. **`createRecordCreationHelper()`** - Record creation operation patterns
8. **`createStatusTransitionHelper()`** - Status transition management
9. **`processMultipleRecordCollections()`** - Complex collection processing

#### Store Factory Pattern:
```typescript
export const createDomainStore = (): E.Effect<
  DomainStore,
  never,
  DomainServiceTag | CacheServiceTag
> => E.gen(function* () {
  // Standardized implementation using 9 helper functions
});
```

### Implementation Status by Domain:

- **✅ `serviceTypes.store.svelte.ts`**: **FULLY STANDARDIZED** - Complete helper function architecture
- **🔄 `requests.store.svelte.ts`**: **In Standardization** - Applying established patterns
- **🔄 `offers.store.svelte.ts`**: **In Standardization** - Applying established patterns  
- **📋 `users.store.svelte.ts`**: **Needs Standardization** - Apply 9-helper pattern
- **📋 `organizations.store.svelte.ts`**: **Needs Standardization** - Apply 9-helper pattern
- **📋 `administration.store.svelte.ts`**: **Needs Standardization** - Apply 9-helper pattern

### Store Architecture Features:

- **Lazy Initialization**: Proxy pattern for safe module-level creation
- **Svelte 5 Runes**: `$state`, `$derived`, `$effect` with proper reactivity
- **EntityCache Integration**: Performance optimization with expiration
- **Event Bus Communication**: Cross-store coordination
- **Effect Error Handling**: Comprehensive error management with context

## Composables - **COMPONENT LOGIC ABSTRACTION LAYER**

Located in `/src/lib/composables`, providing **Effect-integrated component logic**.

### Standardized Composable Architecture:

#### File Organization:
```
/composables/
├── domain/           # Domain-specific business logic
│   ├── useServiceTypesManagement.svelte.ts  ✅ STANDARDIZED
│   ├── useRequestsManagement.svelte.ts      🔄 IN PROGRESS
│   └── useOffersManagement.svelte.ts        📋 PLANNED
├── search/           # Search and filtering functionality
│   ├── useServiceTypeSearch.svelte.ts       ✅ STANDARDIZED
│   └── useEntitySearch.svelte.ts           📋 PLANNED
├── ui/               # UI state management
│   ├── useModal.svelte.ts                  📋 PLANNED
│   └── usePagination.svelte.ts             📋 PLANNED
└── utils/            # Utility composables
    ├── useUrlParams.svelte.ts              📋 PLANNED
    └── useDebounce.svelte.ts               📋 PLANNED
```

#### Standard Interface Pattern:
```typescript
export interface UseComposableReturn<TState, TActions> {
  state: TState;           // Derived state for reactivity
  actions: TActions;       // Effect-based action functions
  cleanup?: () => void;    // Resource cleanup
}
```

### Composable Features:

- **Effect Integration**: All async operations use Effect TS patterns
- **Standard Interfaces**: Consistent state/actions separation
- **Error Management**: Domain-specific error transformation
- **Performance**: Prevent infinite reactive loops through proper encapsulation

## Components - **SVELTE 5 + EFFECT INTEGRATION**

### Feature-Based Organization:

Components are organized by domain with complete Effect integration support:

#### Service Types Components - ✅ FULLY STANDARDIZED:
- **`ServiceTypeCard.svelte`**: Complete integration with standardized composables
- **`ServiceTypeSelector.svelte`**: Multi-select with Effect-based search
- **`ServiceTypeSuggestionForm.svelte`**: Form with Effect validation
- **`TagAutocomplete.svelte`**: Real-time suggestions with Effect debouncing
- **`TagCloud.svelte`**: Statistical visualization with Effect data fetching
- **Admin Interface Components**: Complete moderation workflow integration

#### Request/Offer Components - 🔄 IN STANDARDIZATION:
- Updating to use standardized composable patterns
- Integration with Effect-based state management
- Consistent error handling and loading states

#### Shared Components - 📋 NEEDS UPDATES:
- Updating to support standardized patterns across domains
- Enhanced error display with tagged error support
- Consistent loading state management

### Component Architecture Features:

- **Composable Integration**: Business logic delegated to Effect-based composables
- **Presentation Focus**: Components handle user interaction and display
- **Svelte 5 Patterns**: Proper use of `$props`, `$state`, `$derived`, `$effect`
- **Accessibility**: WCAG-compliant with keyboard navigation
- **Error Handling**: Graceful error display with user-friendly messages

## Error Management - **CENTRALIZED TAGGED ERROR SYSTEM**

Located in `/src/lib/errors`, implementing **comprehensive error architecture**.

### Error Architecture:

#### Domain-Specific Error Hierarchies:
```typescript
// Service Layer
DomainError

// Store Layer  
DomainStoreError  

// Composable Layer
DomainManagementError
```

#### Implementation Status:
- **✅ Service Types**: Complete error hierarchy implemented
- **🔄 Requests/Offers**: Applying Service Types error patterns
- **📋 Users/Organizations/Administration**: Need error system implementation

### Error Features:

- **Tagged Errors**: `Data.TaggedError` for type-safe error handling
- **Meaningful Context**: Rich error information with operation context
- **Centralized Export**: Single import point through `errors/index.ts`
- **Recovery Patterns**: Standardized error recovery and user messaging

## Schema Validation - **STRATEGIC EFFECT SCHEMA USAGE**

Located in `/src/lib/schemas`, implementing **pragmatic validation strategy**.

### Schema Strategy:

#### Validation Boundaries:
- **Input Validation**: Form data, user inputs, search parameters
- **Business Logic**: Complex transformations, API responses
- **Cross-Service Communication**: Service-to-service data exchange

#### Implementation Status:
- **✅ Service Types**: Complete schema consolidation and validation strategy
- **🔄 Requests/Offers**: Applying schema patterns
- **📋 Other Domains**: Need schema implementation

### Schema Features:

- **Branded Types**: Domain-specific type safety (`ActionHash`, `ServiceTypeName`)
- **Class-Based Schemas**: `Schema.Class` for complex entities
- **Strategic Application**: Avoid over-validation, focus on value-adding boundaries
- **Centralized Export**: Single import point through `schemas/index.ts`

## Testing - **COMPREHENSIVE EFFECT TS COVERAGE**

### Testing Strategy:

#### 3-Layer Testing Approach:
1. **Backend Tests** (`tests/`): Tryorama multi-agent testing
2. **Unit Tests** (`ui/tests/unit/`): Service/store isolation with Effect utilities  
3. **Integration Tests** (`ui/tests/integration/`): End-to-end workflow validation

#### Implementation Status:
- **✅ Service Types**: Complete testing coverage across all layers
- **🔄 Requests/Offers**: Applying testing patterns
- **📋 Other Domains**: Need comprehensive test coverage

### Testing Features:

- **Effect Testing Utilities**: Specialized helpers for Effect-based code
- **Service Isolation**: Clean dependency injection for unit testing
- **Workflow Validation**: End-to-end user journey testing
- **Performance Standards**: Defined execution time targets

---

> **🎯 IMPLEMENTATION ROADMAP**: The Service Types domain serves as the **complete pattern template** for all other domains. The systematic application of these patterns ensures consistent, maintainable, and robust code across the entire application.
