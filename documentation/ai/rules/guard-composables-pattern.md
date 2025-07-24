# Guard Composables Pattern

## Overview

We've established a **Guard Composables Pattern** for handling access control and prerequisites in a reactive, reusable way using Svelte 5 runes. This pattern replaces utility-based approaches with proper composables that provide reactive state management.

## Architecture

### Core Composables

#### 1. `useUserAccessGuard.svelte.ts`
**Purpose**: Manages user authentication and authorization states
**Location**: `ui/src/lib/composables/ui/useUserAccessGuard.svelte.ts`

```typescript
import { useUserAccessGuard } from '$lib/composables';

const guard = useUserAccessGuard({
  resourceType: 'requests',
  allowedStatuses: ['approved'],
  autoCheck: true
});
```

#### 2. `usePrerequisitesGuard.svelte.ts`
**Purpose**: Manages system prerequisites (service types, mediums of exchange)
**Location**: `ui/src/lib/composables/ui/usePrerequisitesGuard.svelte.ts`

```typescript
import { usePrerequisitesGuard } from '$lib/composables';

const guard = usePrerequisitesGuard({
  requireServiceTypes: true,
  requireMediumsOfExchange: true,
  autoCheck: true
});
```

### Common Features

Both composables share these reactive patterns:

1. **Reactive State**: Uses Svelte 5 `$state` for loading, error, and result states
2. **Computed Values**: Uses `$derived` for dynamic titles, messages, actions
3. **Auto-checking**: Automatic validation on mount
4. **Error Handling**: Comprehensive error states with retry mechanisms
5. **Admin Detection**: Special handling for administrator users
6. **Loading States**: Proper loading indicators during async operations

## Usage Patterns

### 1. Component-Level Protection

```svelte
<!-- ProtectedPage.svelte -->
<script>
  import { useUserAccessGuard } from '$lib/composables';
  
  const guard = useUserAccessGuard({
    resourceType: 'requests',
    allowedStatuses: ['approved']
  });
</script>

{#if guard.isLoading}
  <LoadingSpinner />
{:else if !guard.hasAccess}
  <AccessDenied 
    title={guard.title}
    message={guard.message}
    actions={guard.actions}
  />
{:else}
  <!-- Protected content -->
  <MyComponent />
{/if}
```

### 2. Guard Component Wrapper

```svelte
<!-- UserAccessGuard.svelte -->
<script>
  import { useUserAccessGuard } from '$lib/composables';
  
  const guard = useUserAccessGuard(options);
</script>

{#if guard.hasAccess}
  {@render children()}
{:else}
  <AccessDeniedUI {guard} />
{/if}
```

### 3. Manual Control

```svelte
<script>
  const guard = useUserAccessGuard({ autoCheck: false });
  
  async function checkAccess() {
    await guard.checkAccess();
    
    if (guard.hasAccess) {
      // Proceed with action
    } else {
      // Show appropriate message
      toast.error(guard.message);
    }
  }
</script>
```

## State Management

### State Properties

```typescript
interface UseUserAccessGuard {
  // State
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly hasAccess: boolean;
  readonly status: UserAccessStatus;
  readonly currentUser: UIUser | null;
  readonly isAdmin: boolean;
  
  // Computed values
  readonly title: string;
  readonly message: string;
  readonly actions: UserAccessAction[];
  readonly tip: string | null;
  readonly adminGuidance: string | null;
  
  // Methods
  checkAccess: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
}
```

### User Access Statuses

```typescript
type UserAccessStatus = 
  | 'no-profile'     // User needs to create profile
  | 'pending'        // Profile awaiting approval
  | 'approved'       // Profile approved, can access
  | 'rejected'       // Profile rejected
  | 'suspended'      // Account suspended
  | 'unknown';       // Error determining status
```

## Integration Examples

### Current Implementation

The pattern is currently implemented in:

1. **UserAccessGuard.svelte**: General-purpose access guard component
2. **PrerequisitesGuard.svelte**: System prerequisites guard component
3. **Requests Page**: Uses UserAccessGuard to protect requests access
4. **Offers Page**: Uses UserAccessGuard to protect offers access

### Page Integration

```svelte
<!-- /requests/+page.svelte -->
<UserAccessGuard resourceType="requests">
  {#snippet children()}
    <RequestsContent />
  {/snippet}
</UserAccessGuard>
```

## Benefits

### 1. **Consistent UX**
- Unified error states and loading patterns
- Contextual messaging based on user status
- Consistent action buttons and guidance

### 2. **Reactive State Management**
- Automatic reactivity with Svelte 5 runes
- No manual state synchronization needed
- Clean separation of concerns

### 3. **Developer Experience**
- Type-safe interfaces
- Comprehensive documentation
- Easy to test and mock
- Follows established project patterns

### 4. **Maintainability**
- Centralized access logic
- Reusable across components
- Easy to extend with new features
- Consistent error handling

## Future Enhancements

### Potential Extensions

1. **Role-Based Access**: Extend to support specific user roles
2. **Permission-Based**: Support fine-grained permissions
3. **Route Guards**: Integration with SvelteKit routing
4. **Caching**: Add intelligent caching of access checks
5. **Real-time Updates**: React to user status changes in real-time

### Usage in Other Domains

This pattern can be applied to:
- Organization access control
- Feature flags and beta access
- Payment/subscription gates
- Age verification
- Geographic restrictions

## Migration Guide

### From Utility Functions

**Before** (utility-based):
```typescript
import { checkUserAccess, getUserAccessMessage } from '$lib/utils/userAccessGuard';

let isLoading = true;
let hasAccess = false;
let message = '';

onMount(async () => {
  try {
    const result = await checkUserAccess();
    hasAccess = result.hasAccess;
    message = getUserAccessMessage(result.status);
  } catch (err) {
    // manual error handling
  } finally {
    isLoading = false;
  }
});
```

**After** (composable-based):
```typescript
import { useUserAccessGuard } from '$lib/composables';

const guard = useUserAccessGuard({
  resourceType: 'content',
  autoCheck: true
});

// All state is reactive and managed automatically
// guard.isLoading, guard.hasAccess, guard.message are reactive
```

## Testing

### Unit Testing

```typescript
import { useUserAccessGuard } from '$lib/composables';

test('user access guard - no profile', async () => {
  const guard = useUserAccessGuard({ autoCheck: false });
  
  // Mock no current user
  vi.mocked(usersStore.currentUser).mockReturnValue(null);
  
  await guard.checkAccess();
  
  expect(guard.hasAccess).toBe(false);
  expect(guard.status).toBe('no-profile');
  expect(guard.title).toBe('Profile Required');
});
```

### Integration Testing

```typescript
test('requests page access control', async () => {
  render(RequestsPage);
  
  // Should show access denied initially
  expect(screen.getByText('Profile Required')).toBeInTheDocument();
  
  // Mock approved user
  await mockApprovedUser();
  
  // Should show content
  expect(screen.getByText('Requests')).toBeInTheDocument();
});
```

## Best Practices

### 1. **Configuration**
- Always provide meaningful `resourceType` values
- Use `autoCheck: true` for page-level guards
- Use `autoCheck: false` for action-level guards

### 2. **Error Handling**
- Let composables handle standard error cases
- Only override messages for very specific scenarios
- Provide fallback actions for all error states

### 3. **Performance**
- Guard composables include built-in caching
- Avoid multiple guards on the same page
- Use component-level guards when possible

### 4. **Accessibility**
- Ensure error messages are screen-reader friendly
- Provide keyboard navigation for action buttons
- Include proper ARIA labels for loading states

This pattern establishes a robust, scalable foundation for access control throughout the application while maintaining consistency with the project's reactive architecture. 