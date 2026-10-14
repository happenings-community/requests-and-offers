import { Data } from 'effect';

/**
 * Centralized error type for the Offers domain
 * Replaces OfferError, OfferStoreError, and OffersManagementError with a single unified approach
 */
export class OfferError extends Data.TaggedError('OfferError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly offerId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    offerId?: string,
    operation?: string
  ): OfferError {
    if (error instanceof OfferError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new OfferError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      offerId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    offerId?: string,
    operation?: string
  ): OfferError {
    return new OfferError({
      message,
      context,
      offerId,
      operation
    });
  }
}

/**
 * Legacy store error class for backward compatibility
 * @deprecated Use OfferError with appropriate context from error-contexts.ts
 */
export class OfferStoreError extends OfferError {}

/**
 * Legacy management error class for backward compatibility
 * @deprecated Use OfferError with appropriate context from error-contexts.ts
 */
export class OffersManagementError extends OfferError {}

// Legacy exports for backward compatibility
export { OfferError as OfferServiceError };
