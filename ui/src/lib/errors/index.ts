/**
 * Centralized error management system
 *
 * This file exports all error types used across the application.
 * Import errors from this file rather than from individual error files.
 */

// Common errors
export * from './common.errors';

// Cache errors
export * from './cache.errors';

// Event bus errors
export * from './eventBus.errors';

// Domain-specific errors
export * from './requests.errors';
export * from './offers.errors';
export * from './serviceTypes.errors';
export * from './users.errors';
export * from './organizations.errors';
export * from './status.errors';

// Re-export utilities from utils (they are now organized there)
export {
  toTypedError,
  createErrorConverter,
  createErrorHandler,
  matchError,
  createCacheKey,
  extractHashFromKey
} from '$lib/utils/errors';

export {
  wrapPromise,
  toOption,
  safeRun,
  sequenceWithExits,
  collectSuccesses,
  debugEffect,
  timeEffect
} from '$lib/utils/effect';

export {
  withUiState,
  createStateManager,
  createLoadingState,
  withAsyncState
} from '$lib/utils/state';

// Re-export Data from effect for convenience
export { Data } from 'effect';
