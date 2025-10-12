import type { UIUser } from '$lib/types/ui';
import { useDebounce } from '$lib/utils';

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

// Return type
export interface UserSearchReturn {
  searchState: UserSearchState;
  hasActiveFilters: boolean;
  filterUsers: (users: UIUser[]) => UIUser[];
  clearAllFilters: () => void;
  updateSearchTerm: (term: string) => void;
  updateUserTypeFilter: (filter: 'all' | 'creator' | 'advocate') => void;
}

export function useUserSearch(options: UserSearchOptions = {}): UserSearchReturn {
  const { debounceMs = 300, onStateChange } = options;

  // Initialize search state
  const state = $state<UserSearchState>({
    searchTerm: '',
    userTypeFilter: 'all'
  });

  // Use debounce utility for search term updates
  const debouncedOnStateChange = useDebounce(
    ((...args: unknown[]) => {
      const searchState = args[0] as UserSearchState;
      onStateChange?.(searchState);
    }) as (...args: unknown[]) => unknown,
    { delay: debounceMs }
  );

  // Check if any filters are active
  const hasActiveFilters = $derived(
    state.searchTerm.length > 0 || state.userTypeFilter !== 'all'
  );

  // Filter users based on search criteria
  function filterUsers(users: UIUser[]): UIUser[] {
    let filtered = users;

    // Apply text search filter
    if (state.searchTerm) {
      const lowerSearchTerm = state.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(lowerSearchTerm) ||
          (user.nickname && user.nickname.toLowerCase().includes(lowerSearchTerm))
      );
    }

    // Apply user type filter
    if (state.userTypeFilter !== 'all') {
      filtered = filtered.filter((user) => user.user_type === state.userTypeFilter);
    }

    return filtered;
  }

  // Clear all filters
  function clearAllFilters() {
    state.searchTerm = '';
    state.userTypeFilter = 'all';
    debouncedOnStateChange(state);
  }

  // Update search term
  function updateSearchTerm(term: string) {
    state.searchTerm = term;
    debouncedOnStateChange(state);
  }

  // Update user type filter
  function updateUserTypeFilter(filter: 'all' | 'creator' | 'advocate') {
    state.userTypeFilter = filter;
    debouncedOnStateChange(state);
  }

  return {
    searchState: state,
    hasActiveFilters,
    filterUsers,
    clearAllFilters,
    updateSearchTerm,
    updateUserTypeFilter
  };
}