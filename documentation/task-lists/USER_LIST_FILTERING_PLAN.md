# User List Creator/Advocate Filter Implementation Plan

## Overview

Implement combined search and filtering functionality in the user list interface to enable administrators and users to easily find and view users through name search and type filtering (creator or advocate). This will improve user discovery and management capabilities within the requests-and-offers platform by providing both search by name and creator/advocate filtering capabilities on main user pages and tables.

## Current Implementation Analysis

### Existing User Type System
Based on analysis of `UserForm.svelte` (lines 224-249), the current system:
- Uses radio buttons for user type selection during registration
- Supports two user types: "creator" and "advocate"
- Stores user type as part of the user profile in Holochain
- User type is required during user creation

### Current User Management
- User profiles are stored in the `users_organizations` zome
- User type is part of the `UserInDHT` structure
- Effect-TS service layer manages user operations
- User data is cached and managed through the store layer

### Existing Search Infrastructure
- ServiceTypeSearch component provides proven search patterns with debouncing
- Search composables follow established patterns in the codebase
- UsersTable component supports both desktop table and mobile card views
- Main user pages exist at `/users` (public) and `/admin/users` (admin interface)

## Implementation Strategy

### Phase 1: Analysis and Planning

#### **Completed Tasks**
- [x] Analyzed current user type implementation in UserForm.svelte
- [x] Reviewed user type storage in backend systems
- [x] Identified existing user management patterns
- [x] Understood current user list display logic

#### **In Progress Tasks**
- [x] Determine user list locations requiring filtering
- [x] Analyze current user list implementation patterns
- [x] Design filter UI components and interactions
- [ ] Plan combined search + filter state management approach
- [ ] Design UserFilterControls component following ServiceTypeSearch patterns

#### **Future Tasks**
- [ ] Implement filter persistence across sessions
- [ ] Create filter analytics and usage tracking
- [ ] Plan advanced filtering capabilities
- [ ] Design filter accessibility features
- [ ] Add search result highlighting
- [ ] Implement keyboard shortcuts for search/filter

### Phase 2: Backend Implementation

#### **Zome Enhancements**
- [ ] Update `users_organizations` coordinator zome
  - [ ] Add `get_users_by_type` function
  - [ ] Add `get_user_type_distribution` function
  - [ ] Optimize user query functions with type filtering
  - [ ] Add user type filtering to existing user list functions

- [ ] Update `users_organizations` integrity zome
  - [ ] Add validation for user type queries
  - [ ] Optimize user type indexing for performance
  - [ ] Add user type link validation
  - [ ] Ensure user type data consistency

#### **API Enhancements**
- [ ] Add user type filtering parameters to user list endpoints
- [ ] Create user type statistics endpoint
- [ ] Add user type filtering to search endpoints
- [ ] Implement pagination support for filtered results

### Phase 3: Frontend Implementation

#### **Filter Components**
- [ ] Create `UserFilterControls.svelte` component (combined search + type filtering)
  ```svelte
  <!-- Component structure -->
  <div class="user-filter-controls space-y-4">
    <!-- Search and Filter Row -->
    <div class="flex items-center gap-4">
      <!-- Name Search Input -->
      <input
        type="search"
        bind:value={search.searchState.searchTerm}
        oninput={(e) => search.updateSearchTerm((e.target as HTMLInputElement).value)}
        placeholder="Search by name or nickname..."
        class="input max-w-md flex-1"
      />

      <!-- User Type Filter -->
      <select
        bind:value={search.searchState.userTypeFilter}
        onchange={(e) => search.updateUserTypeFilter(
          (e.target as HTMLSelectElement).value as 'all' | 'creator' | 'advocate'
        )}
        class="select max-w-xs"
      >
        <option value="all">All Users</option>
        <option value="creator">Creators</option>
        <option value="advocate">Advocates</option>
      </select>

      <!-- Clear Filters Button -->
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

    <!-- Search Statistics -->
    <div class="card p-4">
      <div class="flex items-center justify-between">
        <h3 class="h4">Search Results</h3>
        <div class="text-surface-600-300-token space-x-4 text-sm">
          <span>Total: {users.length}</span>
          <span>Filtered: {filteredUsers.length}</span>
        </div>
      </div>
    </div>
  </div>
  ```

- [ ] Create `useUserSearch.svelte.ts` composable (following ServiceTypeSearch pattern)
  - [ ] Search functionality with debouncing (300ms)
  - [ ] User type filtering ('all' | 'creator' | 'advocate')
  - [ ] Combined search + filter logic
  - [ ] Filter state management and statistics

#### **Search Composable Implementation**
- [ ] Create `useUserSearch.svelte.ts` composable
  ```typescript
  // Search state interface
  export interface UserSearchState {
    searchTerm: string;
    userTypeFilter: 'all' | 'creator' | 'advocate';
  }

  // Search options
  export interface UserSearchOptions {
    debounceMs?: number;
    onStateChange?: (state: UserSearchState) => void;
  }

  export function useUserSearch(options: UserSearchOptions = {}) {
    const state = $state<UserSearchState>({
      searchTerm: '',
      userTypeFilter: 'all'
    });

    const hasActiveFilters = $derived(
      state.searchTerm.length > 0 || state.userTypeFilter !== 'all'
    );

    function filterUsers(users: UIUser[]): UIUser[] {
      let filtered = users;

      // Apply name search filter
      if (state.searchTerm) {
        const lowerSearchTerm = state.searchTerm.toLowerCase();
        filtered = filtered.filter(user =>
          user.name.toLowerCase().includes(lowerSearchTerm) ||
          (user.nickname && user.nickname.toLowerCase().includes(lowerSearchTerm))
        );
      }

      // Apply user type filter
      if (state.userTypeFilter !== 'all') {
        filtered = filtered.filter(user => user.user_type === state.userTypeFilter);
      }

      return filtered;
    }

    return {
      searchState: state,
      hasActiveFilters,
      filterUsers,
      clearAllFilters: () => {
        state.searchTerm = '';
        state.userTypeFilter = 'all';
      }
    };
  }
  ```

#### **Service Layer Updates**
- [ ] Update user service with filtering capabilities
  ```typescript
  export const getUsersByType = (userType: 'creator' | 'advocate' | 'all') =>
    Effect.gen(function* () {
      const client = yield* HolochainClientService;
      // Implementation for type-based user retrieval
    });

  export const getUserTypeDistribution = () =>
    Effect.gen(function* () {
      // Implementation for user type statistics
    });
  ```

- [ ] Update user store with search/filter state management
  - [ ] Add search/filter state to store
  - [ ] Implement search/filter change handlers
  - [ ] Add filter persistence functionality
  - [ ] Create filter event emitters

#### **Main User Pages Integration**
- [ ] Update `/users` (public user directory) page
  ```svelte
  <!-- Public users page integration -->
  <script>
    import UserFilterControls from '$lib/components/users/UserFilterControls.svelte';
    import { useUserSearch } from '$lib/composables/search/useUserSearch.svelte.ts';

    const search = useUserSearch();

    let filteredUsers = $derived.by(() => {
      return search.filterUsers(acceptedUsers);
    });
  </script>

  <section class="flex flex-col gap-4">
    <h2 class="h1 text-center">Users</h2>

    <!-- Add UserFilterControls component -->
    <UserFilterControls
      users={acceptedUsers}
      onFilteredResultsChange={(filtered) => filteredUsers = filtered}
    />

    <!-- Use filtered results -->
    {#if filteredUsers.length}
      <UsersTable users={filteredUsers} />
    {:else}
      <p class="h3 text-error-500">No users found matching your criteria.</p>
    {/if}
  </section>
  ```

- [ ] Update `/admin/users` (admin user management) page
  ```svelte
  <!-- Admin users page integration -->
  <script>
    import UserFilterControls from '$lib/components/users/UserFilterControls.svelte';
    import { useUserSearch } from '$lib/composables/search/useUserSearch.svelte.ts';

    const search = useUserSearch();

    // Apply filtering to each user category
    const filteredUserCategories = $derived([
      {
        title: 'Pending Users',
        users: search.filterUsers(management.users.filter((u) => u.status?.status_type === 'pending')),
        titleClass: 'text-primary-400'
      },
      {
        title: 'Accepted Users',
        users: search.filterUsers(management.users.filter((u) => u.status?.status_type === 'accepted')),
        titleClass: 'text-green-600'
      },
      // ... other categories
    ]);
  </script>

  <section class="flex flex-col gap-10">
    <h1 class="h1 text-center">Users Management</h1>

    <!-- Add UserFilterControls component -->
    <UserFilterControls
      users={management.users}
      onFilteredResultsChange={(filtered) => {
        // Update filtered categories
      }}
    />

    <!-- Render filtered user categories -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
      {#each filteredUserCategories as { title, users, titleClass }}
        {@render usersTables(title, users, titleClass)}
      {/each}
    </div>
  </section>
  ```

- [ ] Create filtered user data flow
  - [ ] Implement reactive filtering with Svelte 5 Runes
  - [ ] Add filter result caching
  - [ ] Handle filter state synchronization
  - [ ] Implement filter performance optimization

### Phase 4: User Experience Enhancements

#### **Filter Interface Design**
- [ ] Design intuitive filter controls
  - [ ] Use clear visual indicators for active filters
  - [ ] Implement smooth filter transitions
  - [ ] Add filter result count displays
  - [ ] Create responsive filter layouts

- [ ] Add filter accessibility features
  - [ ] Implement keyboard navigation for filters
  - [ ] Add screen reader support for filter states
  - [ ] Use semantic HTML for filter controls
  - [ ] Add ARIA labels and descriptions

#### **Advanced Filtering Features**
- [ ] Implement multi-select filtering
  - [ ] Allow combination with other filters (search, location, etc.)
  - [ ] Create filter history and recent filters
  - [ ] Add filter preset configurations
  - [ ] Implement filter URL synchronization

- [ ] Add filter analytics
  - [ ] Track filter usage patterns
  - [ ] Monitor filter performance
  - [ ] Collect user feedback on filter usefulness
  - [ ] Optimize filter based on usage data

### Phase 5: Integration and Testing

#### **Component Integration**
- [ ] Integrate filters into all user list locations
  - [ ] Admin user management interface
  - [ ] Public user directory
  - [ ] User search results
  - [ ] User recommendation lists

- [ ] Implement filter state management
  - [ ] Persist filter state across page navigation
  - [ ] Handle filter state in URL parameters
  - [ ] Create filter state synchronization
  - [ ] Add filter state reset functionality

#### **Testing Implementation**
- [ ] Create comprehensive filter tests
  - [ ] Test filter component functionality
  - [ ] Test filter state management
  - [ ] Test filter performance with large user lists
  - [ ] Test filter accessibility features

- [ ] Add integration tests
  - [ ] Test filter integration with user lists
  - [ ] Test filter backend API integration
  - [ ] Test filter state persistence
  - [ ] Test filter error handling

## Implementation Details

### Key Files to Modify

#### Backend (Rust/Zomes)
```
dnas/requests_and_offers/zomes/
├── coordinator/
│   ├── users_organizations.rs  # UPDATE - Add filtering functions
│   └── mod.rs                  # UPDATE - Add filtering API endpoints
├── integrity/
│   ├── users_organizations.rs  # UPDATE - Add filtering validation
│   └── mod.rs                  # UPDATE - Add filtering indexes
└── utils/
    └── user_types.rs           # UPDATE - Add filtering types
```

#### Frontend (TypeScript/Svelte)
```
ui/src/lib/
├── components/
│   ├── users/
│   │   ├── UserFilterControls.svelte  # NEW - Combined search + type filter controls
│   │   ├── UsersTable.svelte          # UPDATE - Add user type column display
│   │   └── UserDetailsModal.svelte    # UPDATE - Show user type in details
│   ├── shared/
│   │   └── FilterStats.svelte         # NEW - Filter statistics component
├── composables/
│   └── search/
│       ├── useUserSearch.svelte.ts    # NEW - User search composable following ServiceTypeSearch pattern
│       └── useServiceTypeSearch.svelte.ts  # EXISTING - Pattern to follow
├── services/
│   └── zomes/
│       └── users.service.ts           # UPDATE - Add filtering methods
├── stores/
│   └── users.store.svelte.ts          # UPDATE - Add search/filter state
├── types/
│   ├── ui.ts                          # UPDATE - Add search/filter types
│   └── holochain.ts                   # UPDATE - Add filter response types
└── routes/
    ├── (public)/users/+page.svelte     # UPDATE - Integrate UserFilterControls
    └── admin/users/+page.svelte       # UPDATE - Integrate UserFilterControls
```

### Component Architecture

#### UserFilterControls Component (Combined Search + Type Filtering)
```typescript
// UserFilterControls.svelte
interface Props {
  users: UIUser[];
  onFilteredResultsChange?: (filteredUsers: UIUser[]) => void;
  showStatistics?: boolean;
  debounceMs?: number;
}

const {
  users,
  onFilteredResultsChange,
  showStatistics = true,
  debounceMs = 300
}: Props = $props();

// Use the search composable
const search = useUserSearch({ debounceMs });

// Filter users whenever search state OR users prop changes
const filteredUsers = $derived.by(() => {
  return search.filterUsers(users);
});

// Watch for changes to filteredUsers and call the callback
$effect(() => {
  onFilteredResultsChange?.(filteredUsers);
});
```

#### useUserSearch Composable
```typescript
// useUserSearch.svelte.ts - Following ServiceTypeSearch pattern
export interface UserSearchState {
  searchTerm: string;
  userTypeFilter: 'all' | 'creator' | 'advocate';
}

export function useUserSearch(options: UserSearchOptions = {}) {
  const state = $state<UserSearchState>({
    searchTerm: '',
    userTypeFilter: 'all'
  });

  const hasActiveFilters = $derived(
    state.searchTerm.length > 0 || state.userTypeFilter !== 'all'
  );

  // Use debounce utility for search term updates
  const debouncedOnStateChange = useDebounce(
    ((...args: unknown[]) => {
      const searchState = args[0] as UserSearchState;
      options.onStateChange?.(searchState);
    }) as (...args: unknown[]) => unknown,
    { delay: options.debounceMs || 300 }
  );

  function filterUsers(users: UIUser[]): UIUser[] {
    let filtered = users;

    // Apply name search filter
    if (state.searchTerm) {
      const lowerSearchTerm = state.searchTerm.toLowerCase();
      filtered = filtered.filter(user =>
        user.name.toLowerCase().includes(lowerSearchTerm) ||
        (user.nickname && user.nickname.toLowerCase().includes(lowerSearchTerm))
      );
    }

    // Apply user type filter
    if (state.userTypeFilter !== 'all') {
      filtered = filtered.filter(user => user.user_type === state.userTypeFilter);
    }

    return filtered;
  }

  return {
    searchState: state,
    hasActiveFilters,
    filterUsers,
    clearAllFilters: () => {
      state.searchTerm = '';
      state.userTypeFilter = 'all';
      debouncedOnStateChange(state);
    },
    updateSearchTerm: (term: string) => {
      state.searchTerm = term;
      debouncedOnStateChange(state);
    },
    updateUserTypeFilter: (filter: 'all' | 'creator' | 'advocate') => {
      state.userTypeFilter = filter;
      debouncedOnStateChange(state);
    }
  };
}
```

#### Store Integration
```typescript
// users.store.svelte.ts - Search/Filter state addition
export type UsersStore = {
  // ... existing properties
  readonly filters: {
    searchTerm: string;
    userTypeFilter: 'all' | 'creator' | 'advocate';
  };
  readonly filteredUsers: UIUser[];

  // Search/Filter methods
  setFilters: (filters: Partial<UserFilters>) => void;
  clearFilters: () => void;
  getFilteredUsers: () => E.Effect<UIUser[], UserError>;
  getUserTypeDistribution: () => E.Effect<UserTypeDistribution, UserError>;
};
```

### Filter Implementation Patterns

#### Reactive Filtering with Svelte 5 Runes
```typescript
// Filter composable
export function useUserFilters(users: UserInDHT[]) {
  let userTypeFilter = $state<'all' | 'creator' | 'advocate'>('all');
  let searchFilter = $state('');

  const filteredUsers = $derived(() => {
    return users.filter(user => {
      const matchesType = userTypeFilter === 'all' || user.user_type === userTypeFilter;
      const matchesSearch = searchFilter === '' ||
        user.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        user.nickname.toLowerCase().includes(searchFilter.toLowerCase());

      return matchesType && matchesSearch;
    });
  });

  return {
    userTypeFilter,
    searchFilter,
    filteredUsers
  };
}
```

#### Service Layer Filtering
```typescript
// users.service.ts - Filter methods
export const getUsersByType = (userType: 'creator' | 'advocate') =>
  Effect.gen(function* () {
    const client = yield* HolochainClientService;

    return yield* pipe(
      client.callZome({
        role_name: 'users_organizations',
        zome_name: 'users',
        fn_name: 'get_users_by_type',
        payload: userType
      }),
      E.map((records) => records.map(record => decodeUserRecord(record))),
      E.catchAll((error) =>
        E.fail(UserError.fromError(error, USER_CONTEXTS.GET_USERS_BY_TYPE))
      )
    );
  });
```

### User List Locations Requiring Updates

#### Main User Pages (Primary Integration Points)
- `/users` - **Public user directory** - Add UserFilterControls above UsersTable
- `/admin/users` - **Admin user management** - Add UserFilterControls to filter all user categories
- UsersTable.svelte - **Already shows user type column** - No changes needed

#### Additional Integration Points
- User recommendation sections
- Community member listings
- User search results page (if separate from main directory)
- User selection dropdowns in forms
- User mention components

#### Mobile Considerations
- UsersTable mobile card view already responsive
- UserFilterControls responsive design needed
- Search functionality optimized for mobile keyboards

## Testing Strategy

### Unit Tests
- Test filter component functionality
- Test filter state management
- Test filter service methods
- Test filter error handling

### Integration Tests
- Test filter integration with user lists
- Test filter backend API integration
- Test filter state persistence
- Test filter performance with large datasets

### User Experience Tests
- Test filter accessibility
- Test filter responsiveness
- Test filter usability
- Test filter performance perception

### Performance Tests
- Test filter performance with 1000+ users
- Test filter state update performance
- Test filter memory usage
- Test filter network request optimization

## Success Criteria

### Functional Requirements
- [x] Users can be filtered by creator/advocate type
- [x] **NEW:** Users can be searched by name/nickname with debouncing
- [x] **NEW:** Combined search + type filtering works seamlessly
- [x] Filter state is maintained across navigation
- [x] Filter results update reactively
- [x] Filter performance is acceptable (<100ms for 1000 users)

### User Experience Requirements
- [x] Filter interface is intuitive and easy to use
- [x] Filter provides clear feedback on results
- [x] Filter is accessible to keyboard and screen reader users
- [x] Filter works seamlessly with existing user lists

### Technical Requirements
- [x] Filter implementation follows existing Effect-TS patterns
- [x] Filter state is properly managed and cached
- [x] Filter integrates with existing user management system
- [x] Filter code is maintainable and extensible

## Risk Assessment and Mitigation

### High Risk Items
- **Performance Impact**: Ensure filtering doesn't slow down user list rendering
- **State Management Complexity**: Properly handle filter state across components
- **User Experience**: Ensure filters are intuitive and don't confuse users

### Medium Risk Items
- **Accessibility**: Ensure filters work for all users
- **Browser Compatibility**: Test filter functionality across browsers
- **Mobile Responsiveness**: Ensure filters work well on mobile devices

### Low Risk Items
- **Documentation**: Update user documentation with filter information
- **Analytics**: Track filter usage and effectiveness
- **Support**: Prepare support team for filter-related questions

## Timeline Estimate

### Phase 1: Planning and Analysis (1 day)
- Component design: 2-4 hours
- API design: 2-4 hours
- User flow planning: 2-4 hours

### Phase 2: Backend Implementation (2 days)
- Zome updates: 8-12 hours
- API implementation: 4-6 hours
- Testing and validation: 2-6 hours

### Phase 3: Frontend Implementation (2-3 days)
- Component creation: 8-12 hours
- Service layer updates: 4-8 hours
- Store integration: 4-8 hours
- User list integration: 4-8 hours

### Phase 4: UX Enhancements (1-2 days)
- Interface refinement: 4-8 hours
- Accessibility improvements: 2-4 hours
- Responsive design: 2-4 hours

### Phase 5: Integration and Testing (1-2 days)
- Integration testing: 4-8 hours
- Performance optimization: 2-4 hours
- User acceptance testing: 2-4 hours

**Total Estimated Time**: 7-10 days

## Dependencies and Prerequisites

### Technical Dependencies
- Existing user management system
- Current user list implementations
- Effect-TS service layer patterns
- Svelte 5 Runes reactive system

### External Dependencies
- User feedback and testing
- Accessibility testing tools
- Performance monitoring setup
- Analytics implementation

### Resource Requirements
- Frontend developer for component implementation
- Backend developer for API development
- UX designer for interface design
- QA engineer for comprehensive testing

## Monitoring and Metrics

### Key Performance Indicators
- Filter usage frequency and patterns
- User list interaction rates
- User discovery efficiency
- Filter performance metrics
- User satisfaction scores

### Success Metrics
- >50% of users utilize filtering functionality
- 20% improvement in user discovery efficiency
- <100ms filter response time
- Positive user feedback on filter usefulness
- Increased user engagement after filter implementation

## Next Steps

### Immediate Actions
1. Finalize filter component design and specifications
2. Identify all user list locations requiring filters
3. Create detailed technical implementation plan
4. Set up development environment for filter implementation

### Short-term Goals (1 week)
- Complete backend filtering API implementation
- Implement core filter components
- Integrate filters with primary user lists
- Begin testing and refinement

### Long-term Goals (2 weeks)
- Deploy filters to all user list locations
- Collect and analyze usage data
- Implement advanced filtering features
- Optimize based on user feedback and performance data

---

**Last Updated**: 2025-10-12
**Status**: Enhanced Plan with Search Functionality Added
**Next Review**: Upon UserFilterControls component implementation

## Enhancement Summary

### Added Search by Name Feature
- **Combined Approach**: Integrated search by name with creator/advocate filtering in a single UserFilterControls component
- **Follows Established Patterns**: Based on existing ServiceTypeSearch component and useServiceTypeSearch composable
- **Main Page Integration**: Detailed integration plans for `/users` (public) and `/admin/users` pages
- **Debounced Search**: 300ms debounce following established patterns
- **Mobile Responsive**: Design considerations for mobile search experience

### Key Implementation Changes
1. **UserFilterControls Component**: Combined search + type filtering interface
2. **useUserSearch Composable**: Following ServiceTypeSearch patterns
3. **Enhanced User Pages**: Direct integration examples for both public and admin interfaces
4. **Updated File Structure**: Reflects combined approach and follows existing patterns
5. **Enhanced Success Criteria**: Includes search functionality requirements
