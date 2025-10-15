## Frontend Architecture Overview

This project uses a sophisticated frontend architecture built on **SvelteKit 2**, **Svelte 5 Runes**, **Effect-TS**, **TailwindCSS**, and **SkeletonUI**. The architecture follows a strict 7-layer pattern that ensures separation of concerns, maintainability, and scalability.

### Technology Stack

#### Core Framework
- **SvelteKit 2**: Modern full-stack framework with file-based routing
- **Svelte 5 Runes**: Fine-grained reactivity with `$state`, `$derived`, and `$effect`
- **TypeScript**: Full type safety across the entire application

#### Component Library
- **SkeletonUI**: Primary component library providing:
  - Accessible, customizable components (Button, Card, FormField, etc.)
  - Built-in dark mode support
  - Comprehensive theming system
  - WCAG 2.1 AA compliance
  - Integration with TailwindCSS

#### Styling System
- **TailwindCSS**: Utility-first CSS framework
- **SkeletonUI Plugin**: Enhanced component styling
- **Custom Design Tokens**: Project-specific colors, spacing, and typography

#### State Management
- **Effect-TS**: Functional programming with powerful error handling
- **7-Layer Architecture**: Clear separation of concerns
- **Svelte 5 Runes**: Reactive state management

#### Data Layer
- **Holochain Client**: Peer-to-peer network communication
- **EntityCache**: Performance optimization with intelligent caching
- **Real-time Updates**: Event-driven state synchronization

### 7-Layer Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 7: Testing (Vitest + Playwright)                      │
│   - Unit tests for individual functions and components         │
│   - Integration tests for layer interactions                  │
│   - E2E tests for complete user workflows                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 6: Components (Svelte 5 + WCAG Compliance)           │
│   - Pure UI elements using Svelte 5 syntax                   │
│   - SkeletonUI components for consistent design              │
│   - TailwindCSS utility classes for styling                 │
│   - Accessibility features (ARIA, keyboard navigation)      │
├─────────────────────────────────────────────────────────────┤
│ Layer 5: Composables (Business Logic Abstraction)           │
│   - Business logic orchestration                             │
│   - State composition from multiple stores                   │
│   - Data transformation for component consumption             │
│   - Form validation and submission handling                  │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: Error Handling (Domain-Specific Tagged Errors)     │
│   - Typed error definitions with context                     │
│   - Error recovery patterns                                  │
│   - User-friendly error messaging                           │
│   - Error boundary implementation                            │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Schema Validation (Effect Schema at Boundaries)    │
│   - Input validation using Effect Schema                     │
│   - Type-safe data transformation                           │
│   - Branded types for domain entities                        │
│   - Validation error handling                               │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Store Layer (Svelte 5 Runes + Effect Integration)  │
│   - Reactive state management with $state                   │
│   - Service integration with Effect-TS                       │
│   - EntityCache for performance optimization                 │
│   - Type-safe event emission                                 │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Service Layer (Effect-Native Services)             │
│   - Holochain zome communication                            │
│   - API abstraction with Effect-TS                          │
│   - Context.Tag dependency injection                         │
│   - Error handling and retry logic                          │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture with SkeletonUI

#### Component Hierarchy
```
src/routes/
├── (app)/                    # Root layout
│   ├── +layout.svelte        # App shell with navigation
│   └── +page.svelte          # Home page
├── service-types/
│   ├── +page.svelte          # Service types listing
│   ├── [id]/
│   │   ├── +page.svelte      # Service type details
│   │   └── edit/
│   │       └── +page.svelte  # Edit form
│   └── components/
│       ├── ServiceTypeCard.svelte    # Reusable card component
│       ├── ServiceTypeForm.svelte    # Form component
│       └── ServiceTypeList.svelte    # List component
└── shared/                    # Shared components
    ├── Layout/
    │   ├── Header.svelte
    │   ├── Sidebar.svelte
    │   └── Footer.svelte
    ├── Forms/
    │   ├── FormField.svelte
    │   ├── Input.svelte
    │   └── Select.svelte
    └── UI/
        ├── LoadingSpinner.svelte
        ├── ErrorBoundary.svelte
        └── Modal.svelte
```

#### SkeletonUI Integration Examples

##### Button Components
```svelte
<!-- Using SkeletonUI Button variants -->
<script lang="ts">
  import { Button } from '@skeletonlabs/skeleton';

  let loading = false;
  let primaryAction = () => console.log('Primary action');
  let secondaryAction = () => console.log('Secondary action');
</script>

<!-- Primary action button -->
<Button variant="filled" color="primary" loading={loading} onclick={primaryAction}>
  Create Service Type
</Button>

<!-- Secondary action button -->
<Button variant="outline" color="secondary" onclick={secondaryAction}>
  Cancel
</Button>

<!-- Ghost button for subtle actions -->
<Button variant="ghost" size="sm">
  Edit
</Button>
```

##### Form Components
```svelte
<!-- Form using SkeletonUI components -->
<script lang="ts">
  import { FormField, Input, Textarea, Select, Label } from '@skeletonlabs/skeleton';
  import { Button } from '@skeletonlabs/skeleton';

  let formData = {
    name: '',
    description: '',
    category: 'general'
  };

  let submitting = false;

  const handleSubmit = async () => {
    submitting = true;
    try {
      // Submit logic here
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      submitting = false;
    }
  };
</script>

<form onsubmit|preventDefault={handleSubmit} class="space-y-6">
  <FormField>
    <Label for="name">Service Type Name</Label>
    <Input
      id="name"
      bind:value={formData.name}
      placeholder="Enter service type name"
      required
    />
  </FormField>

  <FormField>
    <Label for="description">Description</Label>
    <Textarea
      id="description"
      bind:value={formData.description}
      placeholder="Describe the service type"
      rows={4}
    />
  </FormField>

  <FormField>
    <Label for="category">Category</Label>
    <Select bind:value={formData.category}>
      <option value="general">General</option>
      <option value="technical">Technical</option>
      <option value="creative">Creative</option>
      <option value="professional">Professional</option>
    </Select>
  </FormField>

  <div class="flex gap-4">
    <Button type="submit" variant="filled" loading={submitting}>
      {submitting ? 'Creating...' : 'Create Service Type'}
    </Button>
    <Button type="button" variant="outline">
      Cancel
    </Button>
  </div>
</form>
```

##### Card Components
```svelte
<!-- Card using SkeletonUI components -->
<script lang="ts">
  import { Card, CardHeader, CardContent, CardFooter } from '@skeletonlabs/skeleton';
  import { Button } from '@skeletonlabs/skeleton';

  export let serviceType: ServiceType;
  export let onEdit: () => void;
  export let onDelete: () => void;
</script>

<Card>
  <CardHeader>
    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
      {serviceType.name}
    </h3>
    <div class="flex items-center gap-2">
      <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        {serviceType.category}
      </span>
      <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {
        serviceType.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
        serviceType.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      }">
        {serviceType.status}
      </span>
    </div>
  </CardHeader>

  <CardContent>
    <p class="text-gray-600 dark:text-gray-400 text-sm">
      {serviceType.description || 'No description provided'}
    </p>
  </CardContent>

  <CardFooter class="flex justify-between items-center">
    <span class="text-xs text-gray-500 dark:text-gray-400">
      Created {new Date(serviceType.created_at).toLocaleDateString()}
    </span>
    <div class="flex gap-2">
      <Button variant="outline" size="sm" onclick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" size="sm" onclick={onDelete}>
        Delete
      </Button>
    </div>
  </CardFooter>
</Card>
```

### State Management Flow

#### Data Flow Through Layers
```
User Interaction (Layer 6)
    ↓
Composable Business Logic (Layer 5)
    ↓
Store State Management (Layer 2)
    ↓
Service Layer API Calls (Layer 1)
    ↓
Holochain DHT
    ↓
Response back through layers
```

#### Reactive State with Svelte 5 Runes
```typescript
// Layer 2 Store - reactive state
const serviceTypes: UIServiceType[] = $state([]);
const loading: boolean = $state(false);

// Layer 5 Composable - derived state
const approvedServiceTypes = $derived(() =>
  serviceTypes.filter(st => st.status === 'approved')
);

// Layer 6 Component - consuming reactive state
$: if (approvedServiceTypes.length > 0) {
  console.log('Found approved service types');
}
```

### Routing and Navigation

#### File-Based Routing
```
src/routes/
├── (app)/+layout.svelte          # Root layout
├── (app)/+page.svelte            # Home page (/)
├── service-types/+page.svelte    # Service types list (/service-types)
├── service-types/[id]/+page.svelte  # Service type details (/service-types/:id)
└── api/                          # API routes (if needed)
```

#### Navigation Components
```svelte
<!-- Navigation using SkeletonUI components -->
<script lang="ts">
  import { AppRail, AppRailRail, AppRailTile } from '@skeletonlabs/skeleton';
  import { page } from '$app/stores';

  const navigation = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/service-types', label: 'Service Types', icon: 'category' },
    { href: '/requests', label: 'Requests', icon: 'request' },
    { href: '/offers', label: 'Offers', icon: 'offer' },
  ];
</script>

<AppRail>
  <AppRailRail>
    {#each navigation as item}
      <AppRailTile
        href={item.href}
        active={$page.url.pathname === item.href}
        label={item.label}
      >
        <span slot="start">{item.icon}</span>
      </AppRailTile>
    {/each}
  </AppRailRail>
</AppRail>
```

### Performance Optimization

#### Code Splitting
```typescript
// Lazy loading heavy components
const HeavyChart = lazy(() => import('./HeavyChart.svelte'));

// Route-based code splitting (automatic with SvelteKit)
// Each route becomes its own chunk
```

#### Bundle Optimization
```javascript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['@skeletonlabs/skeleton', 'tailwindcss'],
          holochain: ['@holochain/client'],
        }
      }
    }
  }
});
```

### Development Workflow

#### Local Development
```bash
# Install dependencies
bun install

# Start development server with hot reload
bun run dev

# Type checking
bun run check

# Linting
bun run lint

# Formatting
bun run format
```

#### Component Development
```bash
# Storybook for component development (if configured)
bun run storybook

# Component testing
bun run test:unit

# Visual regression testing
bun run test:visual
```

### Best Practices

#### Component Development
1. **Single Responsibility**: Each component has one clear purpose
2. **Accessibility First**: WCAG 2.1 AA compliance with ARIA labels
3. **Responsive Design**: Mobile-first approach with Tailwind breakpoints
4. **Type Safety**: Full TypeScript coverage with prop validation
5. **SkeletonUI First**: Use SkeletonUI components before custom implementations

#### State Management
1. **Layer Separation**: Keep state in appropriate layers
2. **Reactive Patterns**: Use Svelte 5 runes for reactive state
3. **Effect-TS Integration**: Leverage Effect for async operations
4. **Error Boundaries**: Implement proper error handling
5. **Performance**: Use EntityCache for data optimization

#### Styling
1. **Utility-First**: Use Tailwind utilities for styling
2. **Design Tokens**: Follow established design system
3. **Dark Mode**: Implement dark mode support from start
4. **Performance**: Optimize CSS bundle size with purging
5. **Consistency**: Use SkeletonUI components for UI patterns

This architecture ensures a maintainable, scalable, and performant frontend application with excellent developer experience and user experience.
