// Base types and interfaces are now in $lib/types/ui
export * from '$lib/types/ui';

// Domain-specific composables
export { useServiceTypesManagement } from './domain/service-types/useServiceTypesManagement.svelte';
export { useServiceTypeFormManagement } from './domain/service-types/useServiceTypeFormManagement.svelte';
export { useServiceTypeDetails } from './domain/service-types/useServiceTypeDetails.svelte';
export { useRequestFormManagement } from './domain/requests/useRequestFormManagement.svelte';
export { useRequestDetails } from './domain/requests/useRequestDetails.svelte';
export { useOffersManagement } from './domain/offers/useOffersManagement.svelte';
export { useRequestsManagement } from './domain/requests/useRequestsManagement.svelte';
export { useOrganizationsManagement } from './domain/organizations/useOrganizationsManagement.svelte';
export { useUsersManagement } from './domain/users/useUsersManagement.svelte';

// Search composables
export {
  useServiceTypeSearch,
  type ServiceTypeSearchOptions
} from './search/useServiceTypeSearch.svelte';

// Re-export utilities from main utils folder for convenience
export { useDebounce } from '$lib/utils';
export { useModal, useToast } from '$lib/utils/composables';

// UI composables
export { useErrorBoundary } from './ui/useErrorBoundary.svelte';
export { useFormValidation } from './ui/useFormValidation.svelte';

// Legacy exports (for backward compatibility during migration)
// export { useUrlParams } from './utils/useUrlParams.svelte';

// export { useEntitySearch } from './search/useEntitySearch.svelte';
// export { useTagSearch } from './search/useTagSearch.svelte';
// export { useOffersManagement } from './domain/useOffersManagement.svelte';
// export { useRequestsManagement } from './domain/useRequestsManagement.svelte';
// export { useOrganizationsManagement } from './domain/useOrganizationsManagement.svelte';
// export { useUsersManagement } from './domain/useUsersManagement.svelte';
