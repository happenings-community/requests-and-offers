import type { UIOffer } from '$lib/types/ui';
import { useDebounce } from '$lib/utils';

// Search state interface
export interface OfferSearchState {
  searchTerm: string;
}

// Search options
export interface OfferSearchOptions {
  debounceMs?: number;
  onStateChange?: (state: OfferSearchState) => void;
}

// Return type
export interface OfferSearchReturn {
  searchState: OfferSearchState;
  hasActiveFilters: boolean;
  filterOffers: (offers: UIOffer[]) => UIOffer[];
  clearAllFilters: () => void;
  updateSearchTerm: (term: string) => void;
}

export function useOfferSearch(options: OfferSearchOptions = {}): OfferSearchReturn {
  const { debounceMs = 300, onStateChange } = options;

  // Initialize search state
  const state = $state<OfferSearchState>({
    searchTerm: ''
  });

  // Use debounce utility for search term updates
  const debouncedOnStateChange = useDebounce(
    ((...args: unknown[]) => {
      const searchState = args[0] as OfferSearchState;
      onStateChange?.(searchState);
    }) as (...args: unknown[]) => unknown,
    { delay: debounceMs }
  );

  // Check if any filters are active
  const hasActiveFilters = $derived(state.searchTerm.length > 0);

  // Filter offers based on search criteria
  function filterOffers(offers: UIOffer[]): UIOffer[] {
    let filtered = offers;

    // Apply text search filter
    if (state.searchTerm) {
      const lowerSearchTerm = state.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (offer) =>
          offer.title.toLowerCase().includes(lowerSearchTerm) ||
          offer.description.toLowerCase().includes(lowerSearchTerm)
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
    filterOffers,
    clearAllFilters,
    updateSearchTerm
  };
}
