import type { UIServiceType } from '$lib/types/ui';
import { useDebounce } from '$lib/utils';
import {
  useServiceTypeSorting,
  type ServiceTypeSortField,
  type ServiceTypeSortDirection
} from './useServiceTypeSorting.svelte';

// Search state interface
export interface ServiceTypeSearchState {
  searchTerm: string;
  technicalFilter: 'all' | 'technical' | 'non-technical';
}

// Search options
export interface ServiceTypeSearchOptions {
  debounceMs?: number;
  onStateChange?: (state: ServiceTypeSearchState) => void;
  enableSorting?: boolean;
  initialSortField?: ServiceTypeSortField;
  initialSortDirection?: ServiceTypeSortDirection;
}

// Return type
export interface ServiceTypeSearchReturn {
  searchState: ServiceTypeSearchState;
  hasActiveFilters: boolean;
  filterServiceTypes: (serviceTypes: UIServiceType[]) => UIServiceType[];
  clearAllFilters: () => void;
  updateSearchTerm: (term: string) => void;
  updateTechnicalFilter: (filter: 'all' | 'technical' | 'non-technical') => void;
  // Sorting functionality (optional)
  sorting?: ReturnType<typeof useServiceTypeSorting>;
}

export function useServiceTypeSearch(
  options: ServiceTypeSearchOptions = {}
): ServiceTypeSearchReturn {
  const {
    debounceMs = 300,
    onStateChange,
    enableSorting = false,
    initialSortField = 'type',
    initialSortDirection = 'asc'
  } = options;

  // Initialize search state
  const state = $state<ServiceTypeSearchState>({
    searchTerm: '',
    technicalFilter: 'all'
  });

  // Initialize sorting if enabled
  const sorting = enableSorting
    ? useServiceTypeSorting(initialSortField, initialSortDirection)
    : undefined;

  // Use debounce utility for search term updates
  const debouncedOnStateChange = useDebounce(
    (searchState: ServiceTypeSearchState) => {
      onStateChange?.(searchState);
    },
    { delay: debounceMs }
  );

  // Check if any filters are active
  const hasActiveFilters = $derived(state.searchTerm.length > 0 || state.technicalFilter !== 'all');

  // Filter service types based on search criteria
  function filterServiceTypes(serviceTypes: UIServiceType[]): UIServiceType[] {
    let filtered = serviceTypes;

    // Apply text search filter
    if (state.searchTerm) {
      const lowerSearchTerm = state.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (serviceType) =>
          serviceType.name.toLowerCase().includes(lowerSearchTerm) ||
          serviceType.description.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Apply technical filter
    if (state.technicalFilter !== 'all') {
      const isTechnical = state.technicalFilter === 'technical';
      filtered = filtered.filter((serviceType) => serviceType.technical === isTechnical);
    }

    // Apply sorting if enabled
    if (sorting) {
      filtered = sorting.sortServiceTypes(filtered);
    }

    return filtered;
  }

  // Clear all filters
  function clearAllFilters() {
    state.searchTerm = '';
    state.technicalFilter = 'all';
    debouncedOnStateChange(state);
  }

  // Update search term
  function updateSearchTerm(term: string) {
    state.searchTerm = term;
    debouncedOnStateChange(state);
  }

  // Update technical filter
  function updateTechnicalFilter(filter: 'all' | 'technical' | 'non-technical') {
    state.technicalFilter = filter;
    debouncedOnStateChange(state);
  }

  return {
    searchState: state,
    hasActiveFilters,
    filterServiceTypes,
    clearAllFilters,
    updateSearchTerm,
    updateTechnicalFilter,
    sorting
  };
}
