// Base types and interfaces are now in $lib/types/ui
export * from '$lib/types/ui';
export * from '$lib/types/error';

// Domain-specific composables
export { useServiceTypesManagement } from './domain/useServiceTypesManagement.svelte';
export { useOffersManagement } from './domain/useOffersManagement.svelte';
export { useRequestsManagement } from './domain/useRequestsManagement.svelte';
export { useOrganizationsManagement } from './domain/useOrganizationsManagement.svelte';
export { useUsersManagement } from './domain/useUsersManagement.svelte';

// Search composables
export {
  useServiceTypeSearch,
  type ServiceTypeSearchOptions
} from './search/useServiceTypeSearch.svelte';

// Re-export utilities from main utils folder for convenience
export { useDebounce } from '$lib/utils';
export { useModal, useToast } from '$lib/utils/composables';

// UI composables
export { usePagination } from './ui/usePagination.svelte';

// Legacy exports (for backward compatibility during migration)
// export { useUrlParams } from './utils/useUrlParams.svelte';
// export { usePagination } from './ui/usePagination.svelte';
// export { useEntitySearch } from './search/useEntitySearch.svelte';
// export { useTagSearch } from './search/useTagSearch.svelte';
// export { useOffersManagement } from './domain/useOffersManagement.svelte';
// export { useRequestsManagement } from './domain/useRequestsManagement.svelte';
// export { useOrganizationsManagement } from './domain/useOrganizationsManagement.svelte';
// export { useUsersManagement } from './domain/useUsersManagement.svelte';
