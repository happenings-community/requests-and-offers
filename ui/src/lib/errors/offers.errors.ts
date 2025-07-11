import { Data } from 'effect';

/**
 * Offers domain error management
 * Centralized error types for all offer-related operations
 */

// --- Base Error Type ---

export class OfferError extends Data.TaggedError('OfferError')<{
  message: string;
  cause?: unknown;
  offerId?: string;
  operation?: string;
  context?: Record<string, unknown>;
}> {
  static fromError(error: unknown, context: string, offerId?: string): OfferError {
    if (error instanceof Error) {
      return new OfferError({
        message: `${context}: ${error.message}`,
        cause: error,
        offerId,
        operation: context
      });
    }
    return new OfferError({
      message: `${context}: ${String(error)}`,
      cause: error,
      offerId,
      operation: context
    });
  }

  static withContext(
    error: unknown,
    context: string,
    additionalContext?: Record<string, unknown>
  ): OfferError {
    if (error instanceof Error) {
      return new OfferError({
        message: `${context}: ${error.message}`,
        cause: error,
        operation: context,
        context: additionalContext
      });
    }
    return new OfferError({
      message: `${context}: ${String(error)}`,
      cause: error,
      operation: context,
      context: additionalContext
    });
  }
}

// --- Error Context Constants ---

export const ERROR_CONTEXTS = {
  // CRUD Operations
  CREATE_OFFER: 'Failed to create offer',
  GET_OFFER: 'Failed to get offer',
  GET_LATEST_OFFER: 'Failed to get latest offer',
  GET_LATEST_OFFER_RECORD: 'Failed to get latest offer record',
  UPDATE_OFFER: 'Failed to update offer',
  DELETE_OFFER: 'Failed to delete offer',

  // Query Operations
  GET_ALL_OFFERS: 'Failed to get all offers',
  GET_USER_OFFERS: 'Failed to get user offers',
  GET_ORGANIZATION_OFFERS: 'Failed to get organization offers',
  GET_OFFERS_BY_TAG: 'Failed to get offers by tag',

  // Association Operations
  GET_OFFER_CREATOR: 'Failed to get offer creator',
  GET_OFFER_ORGANIZATION: 'Failed to get offer organization',
  GET_MEDIUMS_OF_EXCHANGE_FOR_OFFER: 'Failed to get mediums of exchange for offer',

  // Validation Operations
  VALIDATE_OFFER_INPUT: 'Failed to validate offer input',
  VALIDATE_OFFER_RESPONSE: 'Failed to validate offer response',

  // UI Operations
  PROCESS_OFFER_RECORD: 'Failed to process offer record',
  CREATE_UI_OFFER: 'Failed to create UI offer',
  MAP_OFFER_RECORD: 'Failed to map offer record',

  // Cache Operations
  CACHE_OFFER: 'Failed to cache offer',
  INVALIDATE_OFFER_CACHE: 'Failed to invalidate offer cache',
  SYNC_OFFER_CACHE: 'Failed to sync offer cache'
} as const;

// --- Error Utility Functions ---

/**
 * Converts an unknown error to a typed OfferError
 */
export function toOfferError(error: unknown, context: string, offerId?: string): OfferError {
  if (error instanceof OfferError) {
    return error;
  }
  return OfferError.fromError(error, context, offerId);
}

/**
 * Creates an OfferError with additional context
 */
export function createOfferError(
  message: string,
  cause?: unknown,
  additionalContext?: Record<string, unknown>
): OfferError {
  return new OfferError({
    message,
    cause,
    context: additionalContext
  });
}
