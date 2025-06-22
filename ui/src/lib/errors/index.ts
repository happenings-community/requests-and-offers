// Export all domain-specific errors
export * from './holochain-client.errors';
export * from './composables.errors';
export * from './service-types.errors';
export * from './cache.errors';

// Re-export service errors
export { RequestError } from '../services/zomes/requests.service';
export { OfferError } from '../services/zomes/offers.service';

// Re-export store errors
export { RequestStoreError } from '../stores/requests.store.svelte';
export { OfferStoreError } from '../stores/offers.store.svelte';

// Re-export composable errors
export { RequestsManagementError } from '../composables/domain/useRequestsManagement.svelte';
export { OffersManagementError } from '../composables/domain/useOffersManagement.svelte';
export { OrganizationsManagementError } from '../composables/domain/useOrganizationsManagement.svelte';
export { UsersManagementError } from '../composables/domain/useUsersManagement.svelte';

// Re-export utility errors
export { EventBusError } from '../utils/eventBus.effect';

// Export error handling utilities
export * from './error-handling';
