/**
 * Error types related to offer operations
 */
import { Data } from 'effect';

/**
 * Base error for offer-related operations
 */
export class OfferError extends Data.TaggedError('OfferError')<{
  message: string;
  offerId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when offer creation fails
 */
export class OfferCreationError extends Data.TaggedError('OfferCreationError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when offer update fails
 */
export class OfferUpdateError extends Data.TaggedError('OfferUpdateError')<{
  message: string;
  offerId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when offer deletion fails
 */
export class OfferDeletionError extends Data.TaggedError('OfferDeletionError')<{
  message: string;
  offerId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when offer loading fails
 */
export class OfferLoadError extends Data.TaggedError('OfferLoadError')<{
  message: string;
  offerId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when offer store operations fail
 */
export class OfferStoreError extends Data.TaggedError('OfferStoreError')<{
  message: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'getAll';
  offerId?: string;
  cause?: unknown;
}> {}
