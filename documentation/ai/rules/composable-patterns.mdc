---
description: 
globs: ui/src/lib/composables/*.svelte.ts
alwaysApply: false
---
# Composable Patterns for Svelte 5 + Effect TS

This document defines the standardized patterns for creating composables in the Requests and Offers project.

## Purpose and Architecture Role

Composables serve as a **Component Logic Abstraction Layer** that:
- Extract complex component logic into reusable functions
- Provide consistent interfaces for common patterns (CRUD, search, filtering)
- Bridge the gap between Svelte components and Effect-based stores/services
- Enable better testing through isolated business logic
- Prevent infinite reactive loops through proper state encapsulation

## Standard Composable Structure

### 1. File Organization

```
ui/src/lib/composables/
├── domain/
│   ├── useServiceTypesManagement.svelte.ts
│   ├── useOffersManagement.svelte.ts
│   └── useRequestsManagement.svelte.ts
├── search/
│   ├── useEntitySearch.svelte.ts (generic)
│   ├── useServiceTypeSearch.svelte.ts
│   └── useTagSearch.svelte.ts
├── ui/
│   ├── useModal.svelte.ts
│   ├── useToast.svelte.ts
│   └── usePagination.svelte.ts
└── utils/
    ├── useUrlParams.svelte.ts
    └── useDebounce.svelte.ts
```

### 2. Standard Interface Pattern

```typescript
// Standard composable interface
export interface UseComposableOptions<TState = {}> {
  initialState?: Partial<TState>;
  onStateChange?: (state: TState) => void;
  dependencies?: Record<string, unknown>;
}

export interface UseComposableReturn<TState, TActions> {
  // State (always derived for reactivity)
  state: TState;
  
  // Computed/derived values
  computed?: Record<string, unknown>;
  
  // Actions (Effect-based functions)
  actions: TActions;
  
  // Cleanup function
  cleanup?: () => void;
}
```

### 3. Naming Conventions

- **Files**: `use{Domain}{Purpose}.svelte.ts` (e.g., `useServiceTypesManagement.svelte.ts`)
- **Functions**: `use{Domain}{Purpose}` (e.g., `useServiceTypesManagement`)
- **State Types**: `{Domain}{Purpose}State` (e.g., `ServiceTypesManagementState`)
- **Error Types**: `{Domain}{Purpose}Error` (e.g., `ServiceTypesManagementError`)
- **Options Types**: `Use{Domain}{Purpose}Options` (e.g., `UseServiceTypesManagementOptions`)

### 4. Standard Error Handling

```typescript
import { Data } from 'effect';

export class ComposableNameError extends Data.TaggedError('ComposableNameError')<{
  message: string;
  context?: string;
  cause?: unknown;
}> {
  static fromError(error: unknown, context: string): ComposableNameError {
    if (error instanceof Error) {
      return new ComposableNameError({
        message: error.message,
        context,
        cause: error
      });
    }
    return new ComposableNameError({
      message: String(error),
      context,
      cause: error
    });
  }
}
```

### 5. State Management Pattern

```typescript
export interface ComposableState {
  isLoading: boolean;
  error: string | null;
  // Domain-specific state...
}

export function useComposableName(options: UseComposableOptions = {}) {
  const { initialState = {}, onStateChange } = options;
  
  // Internal state using Svelte 5 runes
  let state = $state<ComposableState>({
    isLoading: false,
    error: null,
    ...initialState
  });
  
  // Derived state for external consumption
  const derivedState = $derived(state);
  
  // Effect for state change notifications
  $effect(() => {
    onStateChange?.(derivedState);
  });
  
  return {
    state: derivedState,
    actions: {
      // Effect-based action functions
    }
  };
}
```

### 6. Effect Integration Pattern

```typescript
import { Effect as E, pipe } from 'effect';
import { runEffect } from '$lib/utils/effect';

// Effect-based action with proper error handling
const actionEffect = (param: string): E.Effect<void, ComposableError> =>
  pipe(
    E.sync(() => {
      state.isLoading = true;
      state.error = null;
    }),
    E.flatMap(() => 
      // Call store/service method
      someStore.someMethod(param)
    ),
    E.mapError((error) => 
      ComposableError.fromError(error, 'actionName')
    ),
    E.tap(() => {
      // Update state on success
    }),
    E.catchAll((error) =>
      pipe(
        E.sync(() => {
          state.error = error.message;
        }),
        E.flatMap(() => E.fail(error))
      )
    ),
    E.ensuring(
      E.sync(() => {
        state.isLoading = false;
      })
    )
  );

// Public action function
function performAction(param: string): Promise<void> {
  return pipe(
    actionEffect(param),
    E.orElse(() => E.void), // Handle errors gracefully
    runEffect
  );
}
```

## Specialized Composable Types

### 1. Management Composables

For CRUD operations and complex state management:

```typescript
export interface UseManagementOptions<TEntity> {
  autoLoad?: boolean;
  cacheEnabled?: boolean;
  onEntityChange?: (entities: TEntity[]) => void;
}

export interface UseManagementActions<TEntity, TInput> {
  load: () => Promise<void>;
  create: (input: TInput) => Promise<TEntity>;
  update: (id: string, input: Partial<TInput>) => Promise<TEntity>;
  delete: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}
```

### 2. Search Composables

For search and filtering functionality:

```typescript
export interface UseSearchOptions<TEntity> {
  debounceMs?: number;
  minSearchLength?: number;
  urlParamSync?: boolean;
  onResultsChange?: (results: TEntity[]) => void;
}

export interface UseSearchActions<TEntity> {
  search: (term: string) => void;
  filter: (filters: Record<string, unknown>) => void;
  clearSearch: () => void;
  clearFilters: () => void;
  clearAll: () => void;
}
```

### 3. Modal Composables

For modal and dialog management:

```typescript
export interface UseModalOptions {
  autoFocus?: boolean;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
}

export interface UseModalActions {
  open: (component: any, props?: Record<string, unknown>) => Promise<unknown>;
  close: (result?: unknown) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}
```

## Testing Pattern

```typescript
// composables.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useComposableName } from './useComposableName.svelte';

describe('useComposableName', () => {
  it('should initialize with default state', () => {
    const { state } = useComposableName();
    
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });
  
  it('should handle state changes', async () => {
    const onStateChange = vi.fn();
    const { actions } = useComposableName({ onStateChange });
    
    await actions.someAction();
    
    expect(onStateChange).toHaveBeenCalled();
  });
});
```

## Migration Guidelines

1. **Identify Common Patterns**: Extract shared logic into generic composables
2. **Standardize Interfaces**: Update existing composables to follow the standard structure
3. **Add Type Safety**: Ensure all composables are fully typed
4. **Improve Testing**: Add unit tests for all composables
5. **Documentation**: Document the purpose and usage of each composable

## Best Practices

- ✅ **DO**: Use Effect TS for all async operations
- ✅ **DO**: Implement proper error boundaries and recovery
- ✅ **DO**: Keep composables focused on a single responsibility
- ✅ **DO**: Use Svelte 5 runes correctly (`$state`, `$derived`, `$effect`)
- ✅ **DO**: Provide cleanup functions for resource management

- ❌ **DON'T**: Mix multiple concerns in a single composable
- ❌ **DON'T**: Directly manipulate external state from composables
- ❌ **DON'T**: Use promises directly - always wrap in Effect
- ❌ **DON'T**: Create infinite reactive loops with improper state management

## Integration with Store Pattern

Composables should complement, not replace, the store pattern:

- **Stores**: Manage global application state and data persistence
- **Composables**: Handle component-specific logic and UI state
- **Services**: Encapsulate business logic and external API calls

```typescript
// Good: Composable uses store methods
export function useEntityManagement() {
  // Use store methods via Effect
  const loadEffect = () => entityStore.loadEntities();
  
  // Manage component-specific state
  let componentState = $state({ selectedId: null });
}
```

This pattern ensures a clean separation of concerns while maintaining the benefits of both approaches. 