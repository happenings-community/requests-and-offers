## TailwindCSS + SkeletonUI Styling Standards

This project uses **TailwindCSS v3** with **SkeletonUI v2** utility classes as the primary styling approach. We leverage Skeleton's comprehensive utility class system that extends TailwindCSS with design system consistency and built-in theme support.

**Documentation Links:**
- TailwindCSS v3: https://v3.tailwindcss.com/docs/installation
- SkeletonUI v2: https://v2.skeleton.dev/

### TailwindCSS + Skeleton Configuration

#### Core Setup with Skeleton Plugin
```typescript
// tailwind.config.ts
import { join } from 'path';
import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import { skeleton } from '@skeletonlabs/tw-plugin';
import happeningTheme from './src/happening_theme';

export default {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
    join(require.resolve('@skeletonlabs/skeleton'), '../**/*.{html,js,svelte,ts}')
  ],
  theme: {
    extend: {} // Extended by Skeleton themes
  },
  plugins: [
    forms,
    typography,
    skeleton({
      themes: {
        preset: [
          {
            name: 'crimson',
            enhancements: true
          }
        ],
        custom: [happeningTheme]
      }
    })
  ]
} satisfies Config;
```

#### Custom Theme Configuration
```typescript
// src/happening_theme.ts
const happeningTheme: CustomThemeConfig = {
  name: 'happening-theme',
  properties: {
    // Theme properties
    '--theme-font-family-base': `system-ui`,
    '--theme-font-family-heading': `system-ui`,
    '--theme-font-color-base': '0 0 0',
    '--theme-font-color-dark': '255 255 255',
    '--theme-rounded-base': '9999px',
    '--theme-rounded-container': '8px',
    '--theme-border-base': '1px',

    // On-X colors for contrast
    '--on-primary': '255 255 255',
    '--on-secondary': '0 0 0',
    '--on-success': '0 0 0',
    '--on-error': '255 255 255',

    // Theme colors (primary: #4720b7, secondary: #ebc634, tertiary: #0EA5E9)
    '--color-primary-500': '71 32 183',
    '--color-secondary-500': '235 198 52',
    '--color-tertiary-500': '14 165 233',
    '--color-success-500': '132 204 22',
    '--color-warning-500': '255 136 0',
    '--color-error-500': '210 25 25',
    '--color-surface-500': '73 90 143'
  }
};
```
```

### SkeletonUI Utility Class System

#### Utility-First Development with Skeleton Classes
```svelte
<!-- ✅ Preferred: Use Skeleton utility classes for consistent styling -->
<div class="card p-6">
  <h2 class="h4 mb-4">Service Type Details</h2>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="space-y-2">
      <label class="text-sm font-medium">Name</label>
      <p>{serviceType.name}</p>
    </div>
    <div class="space-y-2">
      <label class="text-sm font-medium">Status</label>
      <span class="variant-filled-primary text-xs font-semibold rounded-container-token px-2 py-1">
        {serviceType.status}
      </span>
    </div>
  </div>
</div>

<!-- ✅ Using Skeleton's theme-aware color tokens -->
<div class="bg-surface-100-800-token text-surface-900-100-token p-4 rounded-container-token">
  <h3 class="text-primary-600-400-token">Theme-Aware Content</h3>
  <p class="text-surface-600-400-token">Content with automatic dark mode support</p>
</div>

<!-- ✅ Using Skeleton's component utility classes -->
<button class="btn variant-filled-primary">
  Primary Action
</button>

<button class="btn variant-outline-secondary">
  Secondary Action
</button>

<!-- ❌ Avoid: Standard Tailwind classes when Skeleton equivalents exist -->
<!-- Instead of: bg-blue-500 text-white, use: variant-filled-primary -->
<!-- Instead of: rounded-lg, use: rounded-container-token -->
```

#### Theme-Aware Styling Patterns
```svelte
<!-- Dark mode automatically handled by Skeleton classes -->
<div class="card bg-surface-50-900-token">
  <!-- Content automatically adapts to light/dark mode -->
</div>

<!-- Semantic color utilities with built-in contrast -->
<div class="bg-success-100-900-token text-success-900-100-token p-4 rounded-container-token">
  Success message with proper contrast in both modes
</div>

<div class="bg-error-100-900-token text-error-900-100-token p-4 rounded-container-token">
  Error message with proper contrast in both modes
</div>
```

#### Layout and Spacing Utilities
```svelte
<!-- Skeleton's spacing system -->
<div class="space-y-4">     <!-- Vertical spacing between children -->
  <div class="p-6">        <!-- Padding using theme spacing -->
    <div class="m-4">    <!-- Margin using theme spacing -->
      <div class="gap-2"> <!-- Flex gap using theme spacing -->
        <!-- Content -->
      </div>
    </div>
  </div>
</div>

<!-- Container utilities -->
<div class="container mx-auto max-w-4xl p-4">
  <!-- Responsive container with theme-aware padding -->
</div>
```

### SkeletonUI Theme System

#### Theme Setup in HTML
```typescript
// src/app.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width" />
    <title>Requests and Offers</title>
    %sveltekit.head%
  </head>
  <body data-theme="skeleton">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

### Component Usage Examples (Real Project Patterns)

#### Form Styling with Skeleton Classes
```svelte
<!-- From our actual ServiceTypeSearch component -->
<div class="flex items-center gap-4">
  <input
    type="search"
    bind:value={search.searchState.searchTerm}
    oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
    placeholder="Search by name or description..."
    class="input max-w-md flex-1"
  />

  <select
    bind:value={search.searchState.technicalFilter}
    onchange={(e) =>
      search.updateTechnicalFilter(
        (e.target as HTMLSelectElement).value as 'all' | 'technical' | 'non-technical'
      )}
    class="select max-w-xs"
  >
    <option value="all">All Types</option>
    <option value="technical">Technical Only</option>
    <option value="non-technical">Non-Technical Only</option>
  </select>

  {#if search.hasActiveFilters}
    <button
      type="button"
      class="variant-soft-error btn"
      onclick={search.clearAllFilters}
      title="Clear all filters"
    >
      Clear All
    </button>
  {/if}
</div>

<!-- Statistics card using Skeleton classes -->
<div class="card p-4">
  <div class="flex items-center justify-between">
    <h3 class="h4">Search Results</h3>
    <div class="text-surface-600-300-token space-x-4 text-sm">
      <span>Total: {serviceTypes.length}</span>
      <span>Filtered: {filteredServiceTypes.length}</span>
    </div>
  </div>
  <!-- Progress bar using theme colors -->
  <div class="bg-surface-200-700-token h-2 rounded-container-token">
    <div
      class="h-2 bg-primary-500 transition-all duration-300 rounded-container-token"
      style="width: {(filteredServiceTypes.length / serviceTypes.length) * 100}%"
    ></div>
  </div>
</div>
```

#### State-Based Styling Patterns
```svelte
<script lang="ts">
  export let status: 'pending' | 'approved' | 'rejected';
  export let loading = false;
  export let error: string | null = null;
</script>

<!-- Status-based styling using theme colors -->
<div class="p-4 rounded-container-token border-2 {
  status === 'approved' ? 'border-success-500 bg-success-50-900-token text-success-900-100-token' :
  status === 'pending' ? 'border-warning-500 bg-warning-50-900-token text-warning-900-100-token' :
  'border-error-500 bg-error-50-900-token text-error-900-100-token'
}">
  <p>Service type status: {status}</p>
</div>

<!-- Button with loading state -->
<button class="btn variant-filled-primary {
  loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary-600'
}" disabled={loading}>
  {loading ? 'Loading...' : 'Submit'}
</button>

<!-- Error state using theme colors -->
{#if error}
  <div class="bg-error-50-900-token border border-error-200-700-token text-error-700-200-token px-4 py-3 rounded-container-token">
    <p class="font-medium">Error:</p>
    <p class="text-sm">{error}</p>
  </div>
{/if}
```

#### Responsive Design with Skeleton Classes
```svelte
<!-- Mobile-first responsive design -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Single column on mobile, 2 columns on tablet, 3 on desktop -->
  <div class="card">
    <h3 class="text-lg font-semibold md:text-xl">Responsive Heading</h3>
    <p class="text-sm md:text-base">Responsive text</p>
  </div>
</div>

<!-- Container with responsive padding -->
<div class="container mx-auto p-4 md:p-6 lg:p-8">
  <!-- Responsive padding based on breakpoint -->
</div>
```

### Design System Standards

#### Happening Theme Color Palette
We use a custom theme called "happening-theme" with the following color scheme:

**Primary Colors**:
- **Primary**: #4720b7 (purple)
- **Secondary**: #ebc634 (yellow/gold)
- **Tertiary**: #0EA5E9 (blue)

**Semantic Colors**:
- **Success**: #84cc16 (green)
- **Warning**: #ff8800 (orange)
- **Error**: #d21919 (red)
- **Surface**: #495a8f (blue-gray)

#### Theme-Aware Color Classes
```svelte
<!-- ✅ Use Skeleton's theme-aware token classes for automatic dark mode -->
<div class="bg-primary-500 text-on-primary">Primary content</div>
<div class="bg-secondary-500 text-on-secondary">Secondary content</div>
<div class="bg-success-500 text-on-success">Success message</div>
<div class="bg-error-500 text-on-error">Error message</div>

<!-- ✅ Use responsive token classes for different themes -->
<div class="bg-surface-50-900-token text-surface-900-100-token">
  Surface color that adapts to theme
</div>

<div class="text-primary-600-400-token">
  Text color that adapts to theme
</div>
```

#### Typography Scale with Skeleton Classes
```svelte
<!-- Skeleton typography utilities -->
<h1 class="text-3xl font-bold">Page Title</h1>
<h2 class="text-2xl font-semibold">Section Title</h2>
<h3 class="text-xl font-medium">Subsection Title</h3>
<h4 class="text-lg font-semibold">Card Title</h4>
<p class="text-base">Body text content</p>
<span class="text-sm">Small caption text</span>

<!-- Theme-aware text colors -->
<p class="text-surface-600-400-token">Adaptive text color</p>
<p class="text-primary-600-400-token">Primary text color</p>
```

#### Spacing System
```svelte
<!-- Skeleton spacing utilities -->
<div class="space-y-4">     <!-- Vertical spacing between children -->
  <div class="p-6">        <!-- Padding using theme spacing -->
    <div class="m-4">    <!-- Margin using theme spacing -->
      <div class="gap-2"> <!-- Flex gap using theme spacing -->
        <!-- Content -->
      </div>
    </div>
  </div>
</div>

<!-- Container utilities -->
<div class="container mx-auto max-w-4xl p-4">
  <!-- Centered container with max width and theme padding -->
</div>
```

### Best Practices Summary

#### ✅ **DO:**
- Use Skeleton utility classes instead of standard Tailwind classes when available
- Leverage theme-aware token classes for automatic dark mode support
- Use the happening-theme color palette for consistent branding
- Follow mobile-first responsive design principles
- Use component utility classes (`btn`, `input`, `select`, `card`) for consistent UI
- Optimize for production with CSS purging
- Use semantic color classes (`variant-filled-primary`, `variant-soft-error`) for states
- Implement dark mode support with Skeleton's built-in theming

#### ❌ **DON'T:**
- Use standard Tailwind color classes (`bg-blue-500`, `text-white`) when Skeleton equivalents exist
- Write extensive custom CSS files for common patterns
- Override Skeleton theme styles unnecessarily
- Use arbitrary values repeatedly (define custom utilities instead)
- Ignore responsive design requirements
- Mix multiple CSS methodologies in the same component
- Include unused CSS in production builds

#### **Skeleton-Specific Patterns:**
- Use `variant-*` classes for button states (`variant-filled-primary`, `variant-outline-secondary`)
- Use theme token classes for adaptive colors (`bg-surface-50-900-token`)
- Use component classes for consistent form elements (`input`, `select`, `textarea`)
- Use layout utilities (`card`, `container`, `space-y-4`) for consistent spacing
- Use responsive token classes for breakpoint-aware styling

This TailwindCSS + SkeletonUI approach ensures consistent, maintainable, and theme-aware styling across the entire application while leveraging modern CSS best practices and our custom happening-theme design system.
```svelte
<!-- Mobile-first responsive design -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Single column on mobile, 2 columns on tablet, 3 on desktop -->
  <div class="card">
    <h3 class="text-lg font-semibold md:text-xl">Responsive Heading</h3>
    <p class="text-sm md:text-base">Responsive text</p>
  </div>
</div>

<!-- Responsive utility classes -->
<div class="hidden md:block">
  <!-- Hidden on mobile, visible on tablet and up -->
</div>

<div class="block md:hidden">
  <!-- Visible on mobile, hidden on tablet and up -->
</div>
```

#### State-Based Styling
```svelte
<script lang="ts">
  export let status: 'pending' | 'approved' | 'rejected';
  export let loading = false;
  export let error: string | null = null;
</script>

<!-- Status-based styling -->
<div class="p-4 rounded-lg border-2 {
  status === 'approved' ? 'border-green-500 bg-green-50' :
  status === 'pending' ? 'border-yellow-500 bg-yellow-50' :
  'border-red-500 bg-red-50'
}">
  <!-- Content -->
</div>

<!-- Loading state styling -->
<button class="btn btn-primary {
  loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
}" disabled={loading}>
  {loading ? 'Loading...' : 'Submit'}
</button>

<!-- Error state styling -->
{#if error}
  <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
    <p class="font-medium">Error:</p>
    <p class="text-sm">{error}</p>
  </div>
{/if}
```

#### Dark Mode Support
```svelte
<!-- Dark mode aware styling using Tailwind dark: prefix -->
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
    Dark mode compatible heading
  </h2>
  <p class="text-gray-600 dark:text-gray-400">
    Dark mode compatible text
  </p>

  <!-- SkeletonUI components automatically support dark mode -->
  <Card class="dark:variant-glass">
    <!-- Card content -->
  </Card>
</div>
```

### Performance Optimization

#### CSS Purging and Tree-Shaking
```bash
# Development - includes all Tailwind classes
bun run dev

# Production - purges unused CSS classes
bun run build

# Verify CSS size after build
ls -la build/assets/*.css
```

#### Critical CSS Patterns
```svelte
<!-- ✅ Efficient: Use utility classes directly -->
<div class="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
  <!-- Content -->
</div>

<!-- ❌ Inefficient: Arbitrary values in large quantities -->
<div class="flex items-center justify-between p-[17px] bg-[#ffffff] rounded-[8px] shadow-[0_1px_3px_0_rgba(0,0,0,0.1)]">
  <!-- Content -->
</div>

<!-- ✅ Better: Define custom utilities in tailwind.config.js for repeated patterns -->
```

### Custom CSS Guidelines

#### When to Use Custom CSS
```css
/* ✅ Use custom CSS for:
   - Complex animations not possible with Tailwind
   - Custom SVG styling
   - Third-party component overrides
*/

/* Custom animations */
@keyframes bounce-gentle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.bounce-gentle {
  animation: bounce-gentle 2s infinite;
}

/* Custom scrollbar styling */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}
```

#### Component-Specific Styles
```svelte
<!-- Use component-specific styles only when necessary -->
<style>
  /* Component-specific styles that can't be achieved with Tailwind */
  .service-type-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  /* Use CSS variables for dynamic values */
  .dynamic-spacing {
    gap: var(--dynamic-gap, 1rem);
  }
</style>

<div class="service-type-grid">
  <!-- Grid content -->
</div>
```

### Best Practices Summary

#### ✅ **DO:**
- Use Tailwind utility classes for all styling
- Leverage SkeletonUI components for consistent UI patterns
- Follow mobile-first responsive design principles
- Use semantic color tokens from the design system
- Implement dark mode support with Tailwind's dark: prefix
- Optimize for production with CSS purging
- Use custom CSS only when absolutely necessary

#### ❌ **DON'T:**
- Write extensive custom CSS files
- Override Tailwind utilities unnecessarily
- Use arbitrary values repeatedly (define custom utilities instead)
- Ignore responsive design requirements
- Mix multiple CSS methodologies in the same component
- Include unused CSS in production builds

This TailwindCSS + SkeletonUI approach ensures consistent, maintainable, and performant styling across the entire application while leveraging modern CSS best practices.