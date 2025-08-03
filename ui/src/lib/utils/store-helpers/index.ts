// ============================================================================
// STORE HELPERS - CENTRALIZED UTILITIES FOR STORES
// ============================================================================

// Export all types
export type * from '$lib/types/store-helpers.js';

// Export core utilities
export {
  withLoadingState,
  createErrorHandler,
  createGenericErrorHandler,
  createLoadingStateSetter,
  createCacheInvalidator,
  withClientConnectionFallback,
  createSafeOperation,
  createRequiredFieldValidator,
  createHashValidator
} from './core.js';

// Export cache helpers
export {
  createGenericCacheSyncHelper,
  createCacheLookupFunction,
  createCacheOperationHelpers,
  processMultipleRecordCollections,
  createStatusTransitionHelper,
  parseHashFromCacheKey,
  createCacheKey,
  createBatchCacheUpdater
} from './cache-helpers.js';

// Export event helpers
export {
  createEventEmitterFactory,
  createStandardEventEmitters,
  createStatusAwareEventEmitters,
  createServiceTypeEventEmitters,
  createRequestEventEmitters,
  createOfferEventEmitters,
  createUserEventEmitters,
  createOrganizationEventEmitters,
  createMediumOfExchangeEventEmitters,
  createBatchEventEmitter,
  createConditionalEventEmitter,
  createEventSubscriptions,
  createCrossDomainEventEmitter
} from './event-helpers.js';

// Export record helpers
export {
  createUIEntityFromRecord,
  createEntityFactory,
  mapRecordsToUIEntities,
  createRecordProcessor,
  createEntityCreationHelper,
  createStatusAwareEntityCreator,
  createTimestampedEntityCreator,
  createBatchRecordProcessor,
  createRecordValidator,
  createSafeRecordConverter,
  createRecordUpdateHelper
} from './record-helpers.js';

// Export fetching helpers
export {
  createEntityFetcher,
  createEntityFetcherWithFallback,
  createCollectionFetcher,
  createIndividualEntityFetcher,
  createStatusAwareFetcher,
  createPaginatedFetcher,
  createFilteredFetcher,
  createRefreshFunction,
  createCacheIntegratedFetcher,
  createDependencyAwareFetcher
} from './fetching-helpers.js';

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

// Common Effect utilities that stores often need
export { Effect as E, pipe } from 'effect';

// Common Holochain types
export type { ActionHash, Record as HolochainRecord } from '@holochain/client';

// MessagePack decoder
export { decode } from '@msgpack/msgpack';
