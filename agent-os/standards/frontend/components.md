## Component Architecture in 7-Layer Effect-TS Pattern

This project uses a sophisticated component architecture that serves as Layer 6 of the 7-layer Effect-TS pattern. Components are pure UI elements that consume composables (Layer 5) and provide the user interface for the entire application.

### Architecture Position

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: Testing (Vitest + Playwright)                      │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Components (Svelte 5 + WCAG Compliance)           ← YOU ARE HERE
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Composables (Business Logic Abstraction)           │
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

### Component Organization by Domain

```
src/routes/
├── service-types/
│   ├── +page.svelte                    # Service types listing page
│   ├── [id]/+page.svelte               # Service type details page
│   └── components/
│       ├── ServiceTypeCard.svelte      # Reusable service type card
│       ├── ServiceTypeForm.svelte      # Service type creation/editing form
│       └── ServiceTypeStatus.svelte    # Status management component
├── requests/
│   ├── +page.svelte                    # Requests listing page
│   ├── [id]/+page.svelte               # Request details page
│   └── components/
│       ├── RequestCard.svelte          # Reusable request card
│       ├── RequestForm.svelte          # Request creation/editing form
│       └── RequestFilter.svelte        # Request filtering component
├── offers/
│   ├── +page.svelte                    # Offers listing page
│   ├── [id]/+page.svelte               # Offer details page
│   └── components/
│       ├── OfferCard.svelte            # Reusable offer card
│       ├── OfferForm.svelte            # Offer creation/editing form
│       └── OfferFilter.svelte          # Offer filtering component
└── (app)/+layout.svelte               # Root layout component
```

### Component Design Principles in 7-Layer Architecture

#### 1. **Pure UI Responsibility**
Components are responsible ONLY for:
- Rendering UI elements and layouts
- Managing user interactions and events
- Providing accessibility features
- Handling responsive design
- Displaying loading and error states

#### 2. **Dependency Flow**
```typescript
// ✅ Correct: Component uses composable for business logic
<script lang="ts">
  import { serviceTypeComposable } from '$lib/composables/serviceTypes.composable';

  let { serviceTypeId } = $props();

  // Use composable (Layer 5) which handles all business logic
  const {
    serviceType,
    isLoading,
    error,
    updateServiceType
  } = serviceTypeComposable(serviceTypeId);
</script>

<!-- ❌ Avoid: Direct service calls in components -->
<script lang="ts">
  import { ServiceTypesService } from '$lib/services/serviceTypes.service';

  // Don't call services directly from components
  const service = ServiceTypesService;
</script>
```

#### 3. **State Management Pattern**
```typescript
// ✅ Correct: Use Svelte 5 Runes with composable-provided state
<script lang="ts">
  import { serviceTypeComposable } from '$lib/composables/serviceTypes.composable';

  let { serviceTypeId } = $props();

  const {
    serviceType,     // $state from composable
    isLoading,       // $state from composable
    error           // $state from composable
  } = serviceTypeComposable(serviceTypeId);

  // Derived state using $derived
  const canEdit = $derived(() => serviceType?.status === 'approved');
  const statusColor = $derived(() =>
    serviceType?.status === 'approved' ? 'text-green-600' : 'text-yellow-600'
  );
</script>
```

#### 4. **Error Handling Pattern**
```typescript
// ✅ Correct: Display errors from composables/stores
{#if error}
  <div class="error-banner" role="alert">
    <h2>Error</h2>
    <p>{error.message}</p>
    <button onclick={() => window.location.reload()}>Retry</button>
  </div>
{/if}

<!-- ❌ Avoid: Error handling logic in components -->
<script lang="ts">
  // Don't handle business logic errors in components
  try {
    // some business logic
  } catch (error) {
    console.error(error);
  }
</script>
```

### Component Patterns by Layer Integration

#### Pattern 1: Data Display Components
```svelte
<!-- ServiceTypeCard.svelte - Pure display component -->
<script lang="ts">
  import type { UIServiceType } from '$lib/types/ui';

  interface Props {
    serviceType: UIServiceType;
    onView?: (id: string) => void;
    onEdit?: (id: string) => void;
  }

  let { serviceType, onView, onEdit }: Props = $props();

  // Derived display logic only
  const formattedDate = $derived(() =>
    new Date(serviceType.createdAt).toLocaleDateString()
  );
  const statusBadge = $derived(() => ({
    text: serviceType.status,
    class: `status-${serviceType.status}`
  }));
</script>

<div class="service-type-card">
  <h3>{serviceType.name}</h3>
  <p>{serviceType.description}</p>
  <div class="status-badge {statusBadge.class}">
    {statusBadge.text}
  </div>
  <div class="card-actions">
    <button onclick={() => onView?.(serviceType.id)}>View</button>
    <button onclick={() => onEdit?.(serviceType.id)}>Edit</button>
  </div>
</div>
```

#### Pattern 2: Form Components
```svelte
<!-- ServiceTypeForm.svelte - Form component with validation display -->
<script lang="ts">
  import { serviceTypeFormComposable } from '$lib/composables/serviceTypes.composable';

  interface Props {
    serviceTypeId?: string;
    onSubmit?: (result: any) => void;
    onCancel?: () => void;
  }

  let { serviceTypeId, onSubmit, onCancel }: Props = $props();

  // Composable handles all form logic
  const {
    formData,
    validationErrors,
    isSubmitting,
    submit
  } = serviceTypeFormComposable(serviceTypeId);

  const handleSubmit = async () => {
    const result = await submit();
    onSubmit?.(result);
  };
</script>

<form onsubmit|preventDefault={handleSubmit}>
  <div class="form-group">
    <label for="name">Service Type Name</label>
    <input
      id="name"
      bind:value={formData.name}
      class:error={validationErrors.name}
      aria-invalid={!!validationErrors.name}
      aria-describedby={validationErrors.name ? 'name-error' : undefined}
    />
    {#if validationErrors.name}
      <div id="name-error" class="error-message" role="alert">
        {validationErrors.name}
      </div>
    {/if}
  </div>

  <div class="form-actions">
    <button type="button" onclick={onCancel}>Cancel</button>
    <button
      type="submit"
      disabled={isSubmitting}
      aria-busy={isSubmitting}
    >
      {isSubmitting ? 'Saving...' : 'Save'}
    </button>
  </div>
</form>
```

#### Pattern 3: List Container Components
```svelte
<!-- +page.svelte - Container component using composables -->
<script lang="ts">
  import { serviceTypesComposable } from '$lib/composables/serviceTypes.composable';
  import ServiceTypeCard from './components/ServiceTypeCard.svelte';
  import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';

  // Composable provides all data and operations
  const {
    serviceTypes,
    isLoading,
    error,
    filters,
    updateFilters,
    createServiceType,
    updateServiceType,
    deleteServiceType
  } = serviceTypesComposable();

  // Event handlers delegate to composable
  const handleView = (id: string) => {
    // Navigation handled by router
    window.location.href = `/service-types/${id}`;
  };

  const handleEdit = (id: string) => {
    window.location.href = `/service-types/${id}/edit`;
  };

  const handleCreate = () => {
    const newServiceType = {
      name: 'New Service Type',
      description: 'Description here'
    };
    createServiceType(newServiceType);
  };
</script>

<div class="page-container">
  <header class="page-header">
    <h1>Service Types</h1>
    <button onclick={handleCreate}>Add New</button>
  </header>

  {#if isLoading}
    <LoadingSpinner />
  {:else if error}
    <div class="error-banner" role="alert">
      <h2>Error loading service types</h2>
      <p>{error.message}</p>
    </div>
  {:else}
    <div class="filters">
      <!-- Filter components would use filters from composable -->
    </div>

    <div class="service-types-list">
      {#each serviceTypes as serviceType (serviceType.id)}
        <ServiceTypeCard
          {serviceType}
          onView={handleView}
          onEdit={handleEdit}
        />
      {/each}
    </div>
  {/if}
</div>
```

### Accessibility Standards (WCAG 2.1 AA)

#### 1. **Semantic HTML**
```svelte
<!-- ✅ Use semantic elements -->
<main role="main">
  <section aria-labelledby="service-types-heading">
    <h2 id="service-types-heading">Service Types</h2>
    <!-- content -->
  </section>
</main>

<!-- ✅ Proper form labeling -->
<label for="service-name">Service Name</label>
<input
  id="service-name"
  required
  aria-describedby="service-name-help"
/>
<div id="service-name-help" class="help-text">
  Enter a descriptive name for the service type
</div>
```

#### 2. **Keyboard Navigation**
```svelte
<!-- ✅ Keyboard accessible interactions -->
<div
  class="card"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleCardClick();
    }
  }}
  onclick={handleCardClick}
  role="button"
  aria-label="View service type details"
>
  Card content
</div>
```

#### 3. **Screen Reader Support**
```svelte
<!-- ✅ ARIA labels and live regions -->
<div
  class="loading-indicator"
  role="status"
  aria-live="polite"
  aria-busy={isLoading}
>
  {isLoading ? 'Loading content...' : ''}
</div>

<!-- ✅ Error announcements -->
<div
  class="error-message"
  role="alert"
  aria-live="assertive"
>
  {errorMessage}
</div>
```

### Component Testing Strategy

#### 1. **Unit Testing (Component Layer)**
```typescript
// ServiceTypeCard.test.ts
import { render, screen } from '@testing-library/svelte';
import ServiceTypeCard from './ServiceTypeCard.svelte';
import type { UIServiceType } from '$lib/types/ui';

describe('ServiceTypeCard', () => {
  const mockServiceType: UIServiceType = {
    id: 'test-id',
    name: 'Test Service',
    description: 'Test Description',
    status: 'approved',
    createdAt: new Date().toISOString()
  };

  it('renders service type information correctly', () => {
    render(ServiceTypeCard, {
      props: { serviceType: mockServiceType }
    });

    expect(screen.getByText('Test Service')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();
  });

  it('handles view and edit actions', async () => {
    const onView = vi.fn();
    const onEdit = vi.fn();

    render(ServiceTypeCard, {
      props: {
        serviceType: mockServiceType,
        onView,
        onEdit
      }
    });

    await userEvent.click(screen.getByText('View'));
    expect(onView).toHaveBeenCalledWith('test-id');

    await userEvent.click(screen.getByText('Edit'));
    expect(onEdit).toHaveBeenCalledWith('test-id');
  });
});
```

#### 2. **Integration Testing (Component + Composable)**
```typescript
// ServiceTypePage.test.ts
import { render, screen } from '@testing-library/svelte';
import { mockServiceTypesComposable } from '$lib/testing/mocks';
import ServiceTypePage from './+page.svelte';

// Mock the composable layer
vi.mock('$lib/composables/serviceTypes.composable', () => ({
  serviceTypesComposable: mockServiceTypesComposable
}));

describe('ServiceTypePage Integration', () => {
  it('loads and displays service types', async () => {
    mockServiceTypesComposable.mockReturnValue({
      serviceTypes: $state([
        { id: '1', name: 'Service 1', status: 'approved' },
        { id: '2', name: 'Service 2', status: 'pending' }
      ]),
      isLoading: $state(false),
      error: $state(null)
    });

    render(ServiceTypePage);

    expect(screen.getByText('Service Types')).toBeInTheDocument();
    expect(screen.getByText('Service 1')).toBeInTheDocument();
    expect(screen.getByText('Service 2')).toBeInTheDocument();
  });
});
```

### Performance Optimization

#### 1. **Lazy Loading**
```svelte
<!-- Route-based code splitting -->
<script>
  import { lazy } from '$app/navigation';

  // Heavy components loaded on demand
  const HeavyChart = lazy(() => import('./HeavyChart.svelte'));
</script>

{#if showChart}
  <Suspense>
    <HeavyChart {data} />
    <div slot="fallback">Loading chart...</div>
  </Suspense>
{/if}
```

#### 2. **Reactive Optimization**
```svelte
<script>
  // ✅ Use $derived for expensive computations
  const expensiveComputation = $derived(() => {
    // Complex calculation that only re-runs when dependencies change
    return largeDataSet.filter(item =>
      item.matchesCriteria(filters.search)
    );
  });

  // ❌ Avoid computations in template
  $: filteredData = largeDataSet.filter(item =>
    item.matchesCriteria(filters.search)  // Runs on every render
  );
</script>
```

### Component Development Guidelines

#### ✅ **DO:**
- Keep components focused on UI presentation only
- Use composables for all business logic
- Implement proper accessibility features
- Write comprehensive tests for UI behavior
- Follow consistent naming conventions
- Use TypeScript for type safety
- Handle loading and error states gracefully

#### ❌ **DON'T:**
- Call services directly from components
- Implement complex business logic in components
- Skip accessibility testing
- Create deeply nested component hierarchies
- Mix concerns (UI + business logic)
- Ignore responsive design requirements
- Use `any` types for props

### Component Best Practices Summary

- **Single Responsibility**: Each component should have one clear purpose and do it well
- **Reusability**: Design components to be reused across different contexts with configurable props
- **Composability**: Build complex UIs by combining smaller, simpler components rather than monolithic structures
- **Clear Interface**: Define explicit, well-documented props with sensible defaults for ease of use
- **Encapsulation**: Keep internal implementation details private and expose only necessary APIs
- **Consistent Naming**: Use clear, descriptive names that indicate the component's purpose and follow team conventions
- **State Management**: Keep state as local as possible; lift it up only when needed by multiple components
- **Minimal Props**: Keep the number of props manageable; if a component needs many props, consider composition or splitting it
- **Documentation**: Document component usage, props, and provide examples for easier adoption by team members