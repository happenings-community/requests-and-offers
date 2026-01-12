// Base types and interfaces are now in $lib/types/ui
export * from '$lib/types/ui';

// Domain composables
export { useRequestsManagement } from './domain/requests/useRequestsManagement.svelte';
export { useOffersManagement } from './domain/offers/useOffersManagement.svelte';
export { useServiceTypesManagement } from './domain/service-types/useServiceTypesManagement.svelte';
export { useServiceTypeFormManagement } from './domain/service-types/useServiceTypeFormManagement.svelte';
export { useServiceTypeDetails } from './domain/service-types/useServiceTypeDetails.svelte';
export { useUsersManagement } from './domain/users/useUsersManagement.svelte';
export { useOrganizationsManagement } from './domain/organizations/useOrganizationsManagement.svelte';

// UI composables - Guard composables
export { useUserAccessGuard } from './ui/useUserAccessGuard.svelte';
export { usePrerequisitesGuard } from './ui/usePrerequisitesGuard.svelte';

// Re-export utilities from main utils folder for convenience
export { useDebounce } from '$lib/utils';
export { useModal, useToast } from '$lib/utils/composables';

// Search composables
export {
  useServiceTypeSearch,
  type ServiceTypeSearchOptions
} from './search/useServiceTypeSearch.svelte';

export {
  useServiceTypeSorting,
  type ServiceTypeSortField,
  type ServiceTypeSortDirection,
  type ServiceTypeSortState
} from './search/useServiceTypeSorting.svelte';

export {
  useUserSearch,
  type UserSearchOptions,
  type UserSearchReturn,
  type UserSearchState
} from './search/useUserSearch.svelte';

export {
  useOfferSearch,
  type OfferSearchOptions,
  type OfferSearchReturn,
  type OfferSearchState
} from './search/useOfferSearch.svelte';

export {
  useRequestSearch,
  type RequestSearchOptions,
  type RequestSearchReturn,
  type RequestSearchState
} from './search/useRequestSearch.svelte';

export {
  useOrganizationSearch,
  type OrganizationSearchOptions,
  type OrganizationSearchReturn,
  type OrganizationSearchState
} from './search/useOrganizationSearch.svelte';
