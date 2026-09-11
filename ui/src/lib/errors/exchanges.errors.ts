import { Data } from 'effect';

/**
 * Error type for the Exchanges domain, one per domain as the other zomes have.
 */
export class ExchangeError extends Data.TaggedError('ExchangeError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly agreementId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    agreementId?: string,
    operation?: string
  ): ExchangeError {
    if (error instanceof ExchangeError) {
      return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return new ExchangeError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      agreementId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    agreementId?: string,
    operation?: string
  ): ExchangeError {
    return new ExchangeError({ message, context, agreementId, operation });
  }
}
