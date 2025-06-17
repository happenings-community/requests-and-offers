import type {
  UsePaginationOptions,
  UsePaginationState,
  UsePaginationActions,
  UsePagination
} from '$lib/types/ui';

export function usePagination(options: UsePaginationOptions): UsePagination {
  let state = $state<UsePaginationState>({
    currentPage: options.initialPage || 1,
    pageSize: options.pageSize,
    totalItems: options.items.length,
    totalPages: Math.ceil(options.items.length / options.pageSize) || 1
  });

  let items = $state(options.items);
  const pageSizeOptions = $state(options.pageSizeOptions || [10, 20, 50]);

  const paginatedItems = $derived(() => {
    if (!items) return [];
    const startIndex = (state.currentPage - 1) * state.pageSize;
    const endIndex = startIndex + state.pageSize;
    return items.slice(startIndex, endIndex);
  });

  const canGoPrevious = $derived(state.currentPage > 1);
  const canGoNext = $derived(state.currentPage < state.totalPages);

  const actions: UsePaginationActions = {
    goToPage: (page: number) => {
      if (page >= 1 && page <= state.totalPages) {
        state.currentPage = page;
      }
    },
    nextPage: () => {
      if (canGoNext) {
        state.currentPage++;
      }
    },
    previousPage: () => {
      if (canGoPrevious) {
        state.currentPage--;
      }
    },
    updateItems: (newItems: readonly any[]) => {
      items = newItems;
      state.totalItems = newItems.length;
      state.totalPages = Math.ceil(newItems.length / state.pageSize) || 1;
      if (state.currentPage > state.totalPages) {
        state.currentPage = state.totalPages;
      }
    },
    setPageSize: (size: number) => {
      state.pageSize = size;
      state.totalPages = Math.ceil(state.totalItems / size) || 1;
      if (state.currentPage > state.totalPages) {
        state.currentPage = state.totalPages;
      }
    }
  };

  return {
    // from state
    get currentPage() {
      return state.currentPage;
    },
    get pageSize() {
      return state.pageSize;
    },
    get totalItems() {
      return state.totalItems;
    },
    get totalPages() {
      return state.totalPages;
    },

    // from derived
    get paginatedItems() {
      return paginatedItems as unknown as readonly any[];
    },
    get canGoPrevious() {
      return canGoPrevious;
    },
    get canGoNext() {
      return canGoNext;
    },

    // actions
    ...actions,
    get pageSizeOptions() {
      return pageSizeOptions;
    }
  };
}
