import type { UIOrganization } from '$lib/types/ui';
import { useDebounce } from '$lib/utils';

// Search state interface
export interface OrganizationSearchState {
  searchTerm: string;
}

// Search options
export interface OrganizationSearchOptions {
  debounceMs?: number;
  onStateChange?: (state: OrganizationSearchState) => void;
}

// Return type
export interface OrganizationSearchReturn {
  searchState: OrganizationSearchState;
  hasActiveFilters: boolean;
  filterOrganizations: (organizations: UIOrganization[]) => UIOrganization[];
  clearAllFilters: () => void;
  updateSearchTerm: (term: string) => void;
}

export function useOrganizationSearch(options: OrganizationSearchOptions = {}): OrganizationSearchReturn {
  const { debounceMs = 300, onStateChange } = options;

  // Initialize search state
  const state = $state<OrganizationSearchState>({
    searchTerm: ''
  });

  // Use debounce utility for search term updates
  const debouncedOnStateChange = useDebounce(
    ((...args: unknown[]) => {
      const searchState = args[0] as OrganizationSearchState;
      onStateChange?.(searchState);
    }) as (...args: unknown[]) => unknown,
    { delay: debounceMs }
  );

  // Check if any filters are active
  const hasActiveFilters = $derived(state.searchTerm.length > 0);

  // Filter organizations based on search criteria
  function filterOrganizations(organizations: UIOrganization[]): UIOrganization[] {
    let filtered = organizations;

    // Apply text search filter
    if (state.searchTerm) {
      const lowerSearchTerm = state.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (organization) =>
          organization.name.toLowerCase().includes(lowerSearchTerm) ||
          organization.description.toLowerCase().includes(lowerSearchTerm) ||
          organization.full_legal_name.toLowerCase().includes(lowerSearchTerm) ||
          organization.email.toLowerCase().includes(lowerSearchTerm) ||
          organization.location.toLowerCase().includes(lowerSearchTerm)
      );
    }

    return filtered;
  }

  // Clear all filters
  function clearAllFilters() {
    state.searchTerm = '';
    debouncedOnStateChange(state);
  }

  // Update search term
  function updateSearchTerm(term: string) {
    state.searchTerm = term;
    debouncedOnStateChange(state);
  }

  return {
    searchState: state,
    hasActiveFilters,
    filterOrganizations,
    clearAllFilters,
    updateSearchTerm
  };
}
