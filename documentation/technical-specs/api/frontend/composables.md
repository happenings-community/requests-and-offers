# Frontend Composables API

API reference for business logic composables that abstract domain operations and provide component-ready interfaces.

## Composable Architecture

Composables sit between components and stores, providing business logic abstraction and error boundary management.

### Base Composable Pattern

```typescript
export function useDomainManagement() {
  // Create domain store
  const store = createDomainStore();
  
  // Error boundaries for different operations
  const loadingErrorBoundary = useErrorBoundary({
    context: DOMAIN_CONTEXTS.GET_ALL_ENTITIES,
    enableLogging: true,
    enableFallback: true,
    maxRetries: 2,
    retryDelay: 1000
  });

  // Reactive state for components
  let state = $state({
    entities: store.entities,
    isLoading: store.isLoading,
    error: store.error,
    
    // Derived state
    approvedEntities: () => store.entities().filter(e => e.status === 'approved'),
    pendingEntities: () => store.entities().filter(e => e.status === 'pending'),
  });

  // Business operations with error handling
  const operations = {
    async loadEntities() {
      await loadingErrorBoundary.execute(store.fetchEntities, []);
    },

    async createEntity(input: CreateEntityInput) {
      return await createErrorBoundary.execute(store.createEntity(input));
    }
  };

  // Lifecycle management
  $effect(() => {
    operations.loadEntities();
  });

  return {
    state,
    operations,
    loadingErrorBoundary
  };
}
```

## Domain Composables

### Service Types Management

**File**: `ui/src/lib/composables/domain/service-types/useServiceTypesManagement.svelte.ts`

```typescript
export function useServiceTypesManagement() {
  const store = createServiceTypesStore();
  
  const { 
    loadingErrorBoundary, 
    createErrorBoundary, 
    updateErrorBoundary 
  } = useServiceTypeErrorBoundaries();

  const state = $state({
    entities: store.entities,
    isLoading: store.isLoading,
    error: store.error,
    approvedServiceTypes: () => store.entities().filter(st => st.status === 'approved'),
    pendingServiceTypes: () => store.entities().filter(st => st.status === 'pending'),
    rejectedServiceTypes: () => store.entities().filter(st => st.status === 'rejected')
  });

  const operations = {
    async loadServiceTypes() { /* Implementation */ },
    async createServiceType(input: CreateServiceTypeInput) { /* Implementation */ },
    async approveServiceType(hash: ActionHash) { /* Implementation */ },
    async rejectServiceType(hash: ActionHash) { /* Implementation */ },
    async searchServiceTypes(query: string) { /* Implementation */ }
  };

  return { state, operations, loadingErrorBoundary, createErrorBoundary, updateErrorBoundary };
}
```

### Service Type Sorting ✨

**File**: `ui/src/lib/composables/search/useServiceTypeSorting.svelte.ts`

**Purpose**: Provides multi-field sorting functionality for service types with intelligent defaults and state management.

```typescript
export interface ServiceTypeSortReturn {
  sortState: ServiceTypeSortState;
  sortServiceTypes: (serviceTypes: UIServiceType[]) => UIServiceType[];
  updateSort: (field: ServiceTypeSortField, direction?: ServiceTypeSortDirection) => void;
  toggleSort: (field: ServiceTypeSortField) => void;
  getSortIcon: (field: ServiceTypeSortField) => string;
  isSortedBy: (field: ServiceTypeSortField) => boolean;
}

export function useServiceTypeSorting(
  initialField: ServiceTypeSortField = 'type',
  initialDirection: ServiceTypeSortDirection = 'asc'
): ServiceTypeSortReturn {
  const state = $state<ServiceTypeSortState>({
    field: initialField,
    direction: initialDirection
  });

  const sortServiceTypes = (serviceTypes: UIServiceType[]): UIServiceType[] => {
    return [...serviceTypes].sort((a, b) => {
      let result = 0;

      switch (state.field) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'type':
          // Non-technical first, then by name as secondary sort
          if (a.technical === b.technical) {
            result = a.name.localeCompare(b.name);
          } else {
            result = a.technical ? 1 : -1;
          }
          break;
        case 'created_at':
          result = (a.created_at || 0) - (b.created_at || 0);
          break;
        case 'updated_at':
          result = (a.updated_at || 0) - (b.updated_at || 0);
          break;
      }

      return state.direction === 'desc' ? -result : result;
    });
  };

  return {
    sortState: state,
    sortServiceTypes,
    updateSort: (field, direction) => { /* Implementation */ },
    toggleSort: (field) => { /* Implementation */ },
    getSortIcon: (field) => { /* Implementation */ },
    isSortedBy: (field) => state.field === field
  };
}
```

**Key Features**:
- **Multi-field Sorting**: Supports name, type, created_at, updated_at
- **Secondary Sort**: Automatic fallback to name sorting for type field
- **Smart Defaults**: Type field defaults to 'asc' (non-technical first), others to 'desc'
- **Icon Management**: Dynamic sort direction indicators (↑, ↓, ↕️)
- **State Persistence**: Maintains sort preferences within component lifecycle

### Requests Management

**File**: `ui/src/lib/composables/domain/requests/useRequestsManagement.svelte.ts`

Similar pattern with request-specific operations and state management.

### Error Boundary Composables

**File**: `ui/src/lib/composables/useErrorBoundary.svelte.ts`

```typescript
export function useErrorBoundary(config: ErrorBoundaryConfig) {
  let state = $state({
    error: null as DomainError | null,
    isRetrying: false,
    retryCount: 0
  });

  const execute = async <T>(operation: Effect.Effect<T, DomainError>) => {
    try {
      const result = await Effect.runPromise(operation);
      state.error = null;
      state.retryCount = 0;
      return result;
    } catch (error) {
      handleError(error);
      throw error;
    }
  };

  const clearError = () => {
    state.error = null;
    state.retryCount = 0;
  };

  return { state, execute, clearError };
}
```

This composable layer provides clean business logic abstraction for components while maintaining proper error handling and state management.
