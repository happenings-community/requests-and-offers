## Composable Layer (Layer 5) in 7-Layer Effect-TS Architecture

This project uses sophisticated composable patterns that serve as Layer 5 of the 7-layer Effect-TS architecture. Composables provide business logic abstraction and bridge the gap between stores (Layer 2) and components (Layer 6).

### Architecture Position

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: Testing (Vitest + Playwright)                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Components (Svelte 5 + WCAG Compliance)           │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Composables (Business Logic Abstraction)           ← YOU ARE HERE
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Error Handling (Domain-Specific Tagged Errors)     │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Schema Validation (Effect Schema at Boundaries)    │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Store Layer (Svelte 5 Runes + Effect Integration)  │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Service Layer (Effect-Native Services)             │
└─────────────────────────────────────────────────────────────┘
```

### Composable Layer Responsibilities

The Composable Layer (Layer 5) is responsible for:
- **Business Logic Abstraction**: Encapsulating domain-specific business rules
- **Store Integration**: Consuming and managing Layer 2 stores
- **Data Transformation**: Preparing data for Layer 6 component consumption
- **State Composition**: Combining multiple store states into coherent views
- **Action Orchestration**: Coordinating complex operations across stores
- **Validation Logic**: Preparing validation for Layer 3 schema validation

### Core Composable Patterns

#### 1. Basic Composable Structure
```typescript
// Basic composable template - Layer 5 foundation
import type { ServiceTypesStore } from '$lib/stores/serviceTypes.store.svelte';
import { serviceTypesStore } from '$lib/stores/serviceTypes.store.svelte';

export const serviceTypeComposable = (store?: ServiceTypesStore) => {
  // Store integration - Layer 2 connection
  const currentStore = store || serviceTypesStore;

  // Reactive state from store
  const serviceTypes = $derived(currentStore.serviceTypes);
  const loading = $derived(currentStore.loading);
  const error = $derived(currentStore.error);

  // Business logic - Layer 5 domain logic
  const approvedServiceTypes = $derived(() =>
    serviceTypes.filter(st => st.status === 'approved')
  );

  const pendingServiceTypes = $derived(() =>
    serviceTypes.filter(st => st.status === 'pending')
  );

  // Actions - orchestrate Layer 2 operations
  const createServiceType = async (input: CreateServiceTypeInput) => {
    return Effect.runPromise(currentStore.createServiceType(input));
  };

  const refreshServiceTypes = async () => {
    return Effect.runPromise(currentStore.getAllServiceTypes());
  };

  // Event handling - respond to Layer 2 events
  currentStore.eventEmitters.onCreated((entity) => {
    console.log('Service type created:', entity.name);
  });

  return {
    // State for Layer 6 components
    serviceTypes,
    approvedServiceTypes,
    pendingServiceTypes,
    loading,
    error,

    // Actions for Layer 6 components
    createServiceType,
    refreshServiceTypes,
  };
};
```

#### 2. Form Composable Pattern
```typescript
// Form composable - handles form logic and validation
export const serviceTypeFormComposable = (serviceTypeId?: string) => {
  const store = serviceTypesStore;

  // Form state
  const formData = $state<CreateServiceTypeInput>({
    name: '',
    description: '',
    category: 'general'
  });

  const validationErrors = $state<Record<string, string>>({});
  const isSubmitting = $state(false);
  const isDirty = $state(false);

  // Load existing data if editing
  const existingServiceType = $derived(() =>
    serviceTypeId
      ? store.serviceTypes.find(st => st.id === serviceTypeId)
      : undefined
  );

  // Initialize form data when service type changes
  $effect(() => {
    if (existingServiceType) {
      formData.name = existingServiceType.name;
      formData.description = existingServiceType.description || '';
      formData.category = existingServiceType.category || 'general';
      isDirty = false;
    }
  });

  // Validation logic - prepares for Layer 3 schema validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Service type name is required';
    } else if (formData.name.length > 100) {
      errors.name = 'Service type name must be less than 100 characters';
    }

    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    validationErrors = errors;
    return Object.keys(errors).length === 0;
  };

  // Form actions
  const submit = async () => {
    if (!validateForm()) {
      return { success: false, errors: validationErrors };
    }

    isSubmitting = true;
    try {
      if (serviceTypeId && existingServiceType) {
        // Update existing
        const result = await Effect.runPromise(
          store.updateServiceType(existingServiceType.original_action_hash, formData)
        );
        return { success: true, data: result };
      } else {
        // Create new
        const result = await Effect.runPromise(
          store.createServiceType(formData)
        );
        return { success: true, data: result };
      }
    } catch (error) {
      return { success: false, error: String(error) };
    } finally {
      isSubmitting = false;
    }
  };

  const reset = () => {
    formData.name = '';
    formData.description = '';
    formData.category = 'general';
    validationErrors = {};
    isDirty = false;
  };

  // Watch for changes
  $effect(() => {
    if (existingServiceType) {
      isDirty = JSON.stringify(formData) !== JSON.stringify({
        name: existingServiceType.name,
        description: existingServiceType.description || '',
        category: existingServiceType.category || 'general'
      });
    }
  });

  return {
    // Form state for Layer 6 components
    formData,
    validationErrors,
    isSubmitting,
    isDirty,
    existingServiceType,

    // Form actions
    submit,
    reset,
    validateForm,
  };
};
```

#### 3. List Management Composable
```typescript
// List management composable - handles filtering, sorting, pagination
export const serviceTypesListComposable = () => {
  const store = serviceTypesStore;

  // List state
  const searchQuery = $state('');
  const selectedStatus = $state<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const sortBy = $state<'name' | 'created_at' | 'status'>('created_at');
  const sortOrder = $state<'asc' | 'desc'>('desc');
  const currentPage = $state(1);
  const itemsPerPage = 10;

  // Computed filtered and sorted data
  const filteredServiceTypes = $derived(() => {
    let filtered = store.serviceTypes;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(st =>
        st.name.toLowerCase().includes(query) ||
        (st.description && st.description.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(st => st.status === selectedStatus);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  });

  // Pagination
  const totalItems = $derived(() => filteredServiceTypes.length);
  const totalPages = $derived(() => Math.ceil(totalItems / itemsPerPage));
  const paginatedServiceTypes = $derived(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredServiceTypes.slice(start, end);
  });

  // List actions
  const setSearchQuery = (query: string) => {
    searchQuery = query;
    currentPage = 1; // Reset to first page when searching
  };

  const setStatusFilter = (status: typeof selectedStatus) => {
    selectedStatus = status;
    currentPage = 1; // Reset to first page when filtering
  };

  const setSorting = (field: typeof sortBy, order: typeof sortOrder) => {
    sortBy = field;
    sortOrder = order;
    currentPage = 1; // Reset to first page when sorting
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      currentPage++;
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      currentPage--;
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  };

  // Statistics
  const statistics = $derived(() => ({
    total: store.serviceTypes.length,
    approved: store.serviceTypes.filter(st => st.status === 'approved').length,
    pending: store.serviceTypes.filter(st => st.status === 'pending').length,
    rejected: store.serviceTypes.filter(st => st.status === 'rejected').length,
    filtered: filteredServiceTypes.length
  }));

  return {
    // List state for Layer 6 components
    searchQuery,
    selectedStatus,
    sortBy,
    sortOrder,
    currentPage,
    totalPages,
    paginatedServiceTypes,
    statistics,

    // List actions
    setSearchQuery,
    setStatusFilter,
    setSorting,
    nextPage,
    previousPage,
    goToPage,
  };
};
```

#### 4. Status Management Composable
```typescript
// Status management composable - handles status transitions and business rules
export const serviceTypeStatusComposable = (serviceTypeHash: ActionHash) => {
  const store = serviceTypesStore;

  // Current state
  const currentServiceType = $derived(() =>
    store.serviceTypes.find(st =>
      encodeHashToBase64(st.original_action_hash) === encodeHashToBase64(serviceTypeHash)
    )
  );

  const canApprove = $derived(() =>
    currentServiceType?.status === 'pending'
  );

  const canReject = $derived(() =>
    currentServiceType?.status === 'pending'
  );

  const canEdit = $derived(() =>
    currentServiceType?.status === 'approved' || currentServiceType?.status === 'rejected'
  );

  const canDelete = $derived(() => {
    // Business logic: can only delete if no related records exist
    if (!currentServiceType) return false;

    // Check if service type has associated requests or offers
    // This would typically involve checking other stores or services
    return true; // Simplified for example
  });

  // Status transition actions
  const approve = async () => {
    if (!canApprove || !currentServiceType) {
      throw new Error('Cannot approve this service type');
    }

    try {
      await Effect.runPromise(
        store.approveServiceType(currentServiceType.original_action_hash)
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  const reject = async (reason?: string) => {
    if (!canReject || !currentServiceType) {
      throw new Error('Cannot reject this service type');
    }

    try {
      await Effect.runPromise(
        store.rejectServiceType(currentServiceType.original_action_hash, reason)
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  const deleteServiceType = async () => {
    if (!canDelete || !currentServiceType) {
      throw new Error('Cannot delete this service type');
    }

    try {
      await Effect.runPromise(
        store.deleteServiceType(currentServiceType.original_action_hash)
      );
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  };

  return {
    // State
    currentServiceType,
    canApprove,
    canReject,
    canEdit,
    canDelete,

    // Actions
    approve,
    reject,
    deleteServiceType,
  };
};
```

#### 5. Cross-Domain Composable
```typescript
// Cross-domain composable - orchestrates operations across multiple stores
export const requestsWithServiceTypesComposable = () => {
  const serviceTypesStore = serviceTypesStore;
  const requestsStore = requestsStore; // Assume this exists

  // Combined state
  const serviceTypes = $derived(serviceTypesStore.serviceTypes);
  const requests = $derived(requestsStore.requests);

  // Enriched requests with service type information
  const enrichedRequests = $derived(() =>
    requests.map(request => ({
      ...request,
      serviceType: serviceTypes.find(st => st.id === request.serviceTypeId),
      serviceName: serviceTypes.find(st => st.id === request.serviceTypeId)?.name || 'Unknown Service'
    }))
  );

  // Statistics across domains
  const statistics = $derived(() => ({
    totalRequests: requests.length,
    requestsByServiceType: serviceTypes.map(serviceType => ({
      serviceTypeName: serviceType.name,
      count: requests.filter(r => r.serviceTypeId === serviceType.id).length
    })),
    pendingRequests: enrichedRequests.filter(r => r.status === 'pending'),
    activeRequests: enrichedRequests.filter(r => r.status === 'active')
  }));

  // Cross-domain actions
  const createRequest = async (input: CreateRequestInput) => {
    // Validate that the service type exists and is approved
    const serviceType = serviceTypes.find(st => st.id === input.serviceTypeId);
    if (!serviceType) {
      throw new Error('Service type not found');
    }
    if (serviceType.status !== 'approved') {
      throw new Error('Cannot create request for unapproved service type');
    }

    return Effect.runPromise(requestsStore.createRequest(input));
  };

  const getServiceTypeRequests = (serviceTypeId: string) => {
    return enrichedRequests.filter(r => r.serviceTypeId === serviceTypeId);
  };

  return {
    // Combined state
    serviceTypes,
    requests,
    enrichedRequests,
    statistics,

    // Cross-domain actions
    createRequest,
    getServiceTypeRequests,
  };
};
```

### Composable Integration Patterns

#### Component Integration (Layer 5 → Layer 6)
```svelte
<!-- ServiceTypePage.svelte - Component using composable -->
<script lang="ts">
  import { serviceTypeComposable } from '$lib/composables/serviceTypes.composable';
  import { serviceTypesListComposable } from '$lib/composables/serviceTypesListComposable';

  // Use composables - Layer 5 business logic
  const {
    serviceTypes,
    loading,
    error,
    createServiceType,
    refreshServiceTypes
  } = serviceTypeComposable();

  const {
    searchQuery,
    selectedStatus,
    paginatedServiceTypes,
    statistics,
    setSearchQuery,
    setStatusFilter
  } = serviceTypesListComposable();

  // Page-specific logic
  const handleCreate = async (input: CreateServiceTypeInput) => {
    try {
      await createServiceType(input);
      await refreshServiceTypes();
    } catch (error) {
      console.error('Failed to create service type:', error);
    }
  };

  // Reactive effects
  $effect(() => {
    console.log('Service types updated:', serviceTypes.length);
  });
</script>

<div class="service-types-page">
  <!-- Statistics from composable -->
  <div class="statistics">
    <div>Total: {statistics.total}</div>
    <div>Approved: {statistics.approved}</div>
    <div>Pending: {statistics.pending}</div>
  </div>

  <!-- Filters using composable state -->
  <div class="filters">
    <input
      type="text"
      placeholder="Search service types..."
      bind:value={searchQuery}
      oninput={(e) => setSearchQuery(e.target.value)}
    />

    <select bind:value={selectedStatus} onchange={(e) => setStatusFilter(e.target.value)}>
      <option value="all">All Status</option>
      <option value="approved">Approved</option>
      <option value="pending">Pending</option>
      <option value="rejected">Rejected</option>
    </select>
  </div>

  <!-- Loading and error states -->
  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">Error: {error}</div>
  {:else}
    <!-- Service types list from composable -->
    <div class="service-types-list">
      {#each paginatedServiceTypes as serviceType (serviceType.id)}
        <ServiceTypeCard {serviceType} />
      {/each}
    </div>
  {/if}
</div>
```

### Advanced Composable Patterns

#### 1. Async Composable with Effect Integration
```typescript
// Async composable with Effect-TS integration
export const asyncServiceTypeComposable = (serviceTypeId: string) => {
  const store = serviceTypesStore;

  // Async state
  const serviceType = $state<UIServiceType | null>(null);
  const loading = $state(false);
  const error = $state<string | null>(null);

  // Effect-based data fetching
  const loadServiceType = async () => {
    loading = true;
    error = null;

    try {
      const result = await Effect.runPromise(
        pipe(
          store.getServiceType(serviceTypeId),
          E.mapError((err) => {
            // Layer 4 error handling
            return ServiceTypeError.fromError(err, 'load_service_type');
          })
        )
      );

      serviceType = result;
    } catch (err) {
      error = String(err);
    } finally {
      loading = false;
    }
  };

  // Auto-load when serviceTypeId changes
  $effect(() => {
    if (serviceTypeId) {
      loadServiceType();
    }
  });

  // Auto-refresh on store events
  $effect(() => {
    const unsubscribe = store.eventEmitters.onUpdated((updatedEntity) => {
      if (updatedEntity.id === serviceTypeId) {
        serviceType = updatedEntity;
      }
    });

    return unsubscribe;
  });

  return {
    serviceType,
    loading,
    error,
    refresh: loadServiceType,
  };
};
```

#### 2. Validation Composable
```typescript
// Validation composable - prepares data for Layer 3 schema validation
export const serviceTypeValidationComposable = () => {
  const validationRules = {
    name: {
      required: true,
      minLength: 1,
      maxLength: 100,
      pattern: /^[a-zA-Z0-9\s\-_]+$/,
      message: 'Service type name must be 1-100 characters and contain only letters, numbers, spaces, hyphens, and underscores'
    },
    description: {
      required: false,
      maxLength: 500,
      message: 'Description must be less than 500 characters'
    },
    category: {
      required: true,
      allowedValues: ['general', 'technical', 'creative', 'professional', 'other'],
      message: 'Please select a valid category'
    }
  };

  const validateField = (field: string, value: unknown): string | null => {
    const rule = validationRules[field as keyof typeof validationRules];
    if (!rule) return null;

    // Required validation
    if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
      return `${field} is required`;
    }

    // Type-specific validation
    if (typeof value === 'string' && value.trim()) {
      if (rule.minLength && value.length < rule.minLength) {
        return rule.message;
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        return rule.message;
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        return rule.message;
      }
      if (rule.allowedValues && !rule.allowedValues.includes(value as any)) {
        return rule.message;
      }
    }

    return null;
  };

  const validateEntity = (entity: Partial<CreateServiceTypeInput>): Record<string, string> => {
    const errors: Record<string, string> = {};

    Object.keys(validationRules).forEach(field => {
      const error = validateField(field, entity[field as keyof CreateServiceTypeInput]);
      if (error) {
        errors[field] = error;
      }
    });

    return errors;
  };

  const isValidForSubmission = (entity: Partial<CreateServiceTypeInput>): boolean => {
    const errors = validateEntity(entity);
    return Object.keys(errors).length === 0;
  };

  return {
    validateField,
    validateEntity,
    isValidForSubmission,
    validationRules,
  };
};
```

### Testing Composable Patterns

#### Unit Testing Composables
```typescript
// serviceTypeComposable.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { serviceTypeComposable } from './serviceTypes.composable';
import { createMockServiceTypesStore } from '$lib/testing/mocks';

describe('serviceTypeComposable (Layer 5)', () => {
  let mockStore: any;

  beforeEach(() => {
    mockStore = createMockServiceTypesStore();
  });

  it('should provide reactive state from store', () => {
    const composable = serviceTypeComposable(mockStore);

    expect(composable.serviceTypes).toEqual([]);
    expect(composable.loading).toBe(false);
    expect(composable.error).toBe(null);
  });

  it('should filter service types by status', () => {
    mockStore.serviceTypes = [
      { id: '1', name: 'Service 1', status: 'approved' },
      { id: '2', name: 'Service 2', status: 'pending' },
      { id: '3', name: 'Service 3', status: 'approved' },
    ];

    const composable = serviceTypeComposable(mockStore);

    expect(composable.approvedServiceTypes).toHaveLength(2);
    expect(composable.pendingServiceTypes).toHaveLength(1);
    expect(composable.approvedServiceTypes[0].name).toBe('Service 1');
  });

  it('should orchestrate create operation', async () => {
    const composable = serviceTypeComposable(mockStore);
    const createSpy = vi.spyOn(mockStore, 'createServiceType');

    const input = { name: 'New Service', description: 'Test' };
    await composable.createServiceType(input);

    expect(createSpy).toHaveBeenCalledWith(input);
  });
});
```

#### Integration Testing (Layer 5 ↔ Layer 2)
```typescript
describe('Composable ↔ Store Integration (5 ↔ 2)', () => {
  it('should integrate with real store', async () => {
    const realStore = pipe(
      createServiceTypesStore(),
      E.provide(ServiceTypesServiceLive),
      E.runSync
    );

    const composable = serviceTypeComposable(realStore);

    // Test data flow through layers
    const input = { name: 'Integration Test' };
    await composable.createServiceType(input);

    expect(realStore.serviceTypes).toHaveLength(1);
    expect(composable.serviceTypes).toHaveLength(1);
    expect(composable.serviceTypes[0].name).toBe('Integration Test');
  });
});
```

### Best Practices

#### Composable Design Principles
1. **Single Responsibility**: Each composable should have one clear business purpose
2. **Store Integration**: Composables should consume stores, not replace them
3. **Business Logic Focus**: Keep business rules in composables, not components
4. **Reactive Design**: Use Svelte 5 reactivity for state management
5. **Error Handling**: Provide graceful error handling and recovery
6. **Testability**: Design composables to be easily testable
7. **Composition**: Compose multiple smaller composables for complex logic

#### Performance Considerations
1. **Derived State**: Use $derived for computed values
2. **Effect Cleanup**: Properly clean up effects and subscriptions
3. **Memoization**: Cache expensive computations
4. **Lazy Loading**: Load data only when needed
5. **Batch Updates**: Batch state updates where possible

#### Error Handling Guidelines
1. **Graceful Degradation**: Provide fallbacks for failed operations
2. **User Feedback**: Return actionable error messages
3. **Retry Logic**: Implement retry for transient failures
4. **Error Boundaries**: Contain errors within composables

These patterns ensure consistent, maintainable, and testable business logic development across all domains in the 7-layer Effect-TS architecture.