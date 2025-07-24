/**
 * Application-wide constants for consistent configuration across domains.
 * These constants provide standardized values for caching, timeouts, and other system parameters.
 */

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/**
 * Cache expiry times in milliseconds for different entity types.
 * Longer-lived entities have longer cache times to improve performance.
 */
export const CACHE_EXPIRY = {
  /** Service types change less frequently - 10 minutes */
  SERVICE_TYPES: 10 * 60 * 1000,
  /** Requests are more dynamic - 5 minutes */
  REQUESTS: 5 * 60 * 1000,
  /** Offers are moderately dynamic - 5 minutes */
  OFFERS: 5 * 60 * 1000,
  /** User data is relatively stable - 10 minutes */
  USERS: 10 * 60 * 1000,
  /** Organizations are stable - 15 minutes */
  ORGANIZATIONS: 15 * 60 * 1000,
  /** Mediums of exchange are very stable - 20 minutes */
  MEDIUMS_OF_EXCHANGE: 20 * 60 * 1000,
  /** hREA data is stable - 15 minutes */
  HREA: 15 * 60 * 1000,
  /** Administration data is stable - 10 minutes */
  ADMINISTRATION: 10 * 60 * 1000
} as const;

// ============================================================================
// PAGINATION AND LIMITS
// ============================================================================

export const PAGINATION = {
  /** Default page size for entity lists */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum page size to prevent performance issues */
  MAX_PAGE_SIZE: 100,
  /** Search results limit */
  SEARCH_LIMIT: 50
} as const;

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export const UI = {
  /** Default debounce time for search inputs (ms) */
  SEARCH_DEBOUNCE_MS: 300,
  /** Toast notification duration (ms) */
  TOAST_DURATION_MS: 5000,
  /** Animation duration for transitions (ms) */
  ANIMATION_DURATION_MS: 300
} as const;

// ============================================================================
// VALIDATION
// ============================================================================

export const VALIDATION = {
  /** Maximum length for entity names */
  MAX_NAME_LENGTH: 100,
  /** Maximum length for descriptions */
  MAX_DESCRIPTION_LENGTH: 1000,
  /** Maximum number of tags per entity */
  MAX_TAGS_PER_ENTITY: 10,
  /** Maximum tag length */
  MAX_TAG_LENGTH: 50
} as const;

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

export const NETWORK = {
  /** Default timeout for Holochain calls (ms) */
  DEFAULT_TIMEOUT_MS: 30000,
  /** Retry attempts for failed requests */
  MAX_RETRY_ATTEMPTS: 3,
  /** Delay between retry attempts (ms) */
  RETRY_DELAY_MS: 1000
} as const;
