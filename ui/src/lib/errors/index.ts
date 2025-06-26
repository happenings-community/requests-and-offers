// Export all domain-specific errors
export * from './holochain-client.errors';
export * from './composables.errors';
export * from './service-types.errors';
export * from './requests.errors';
export * from './cache.errors';

// Re-export service errors (to be removed after full refactoring)
export { OfferError } from '../services/zomes/offers.service';

// Re-export store errors (to be removed after full refactoring)
export { OfferStoreError } from '../stores/offers.store.svelte';

// Re-export composable errors (to be removed after full refactoring)
export { OffersManagementError } from '../composables/domain/offers/useOffersManagement.svelte';
export { OrganizationsManagementError } from '../composables/domain/organizations/useOrganizationsManagement.svelte';
export { UsersManagementError } from '../composables/domain/users/useUsersManagement.svelte';

// Re-export utility errors
export { EventBusError } from '../utils/eventBus.effect';

// Export error handling utilities
export * from './error-handling';
