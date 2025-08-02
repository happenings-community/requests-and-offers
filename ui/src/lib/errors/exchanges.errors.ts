import { Schema } from 'effect';

/**
 * Tagged error class for exchange domain operations
 */
export class ExchangeError extends Error {
  readonly _tag = 'ExchangeError';

  constructor(
    readonly options: {
      readonly message: string;
      readonly cause?: unknown;
      readonly context?: string;
    }
  ) {
    super(options.message);
    this.name = 'ExchangeError';
  }

  /**
   * Create an ExchangeError from any error with additional context
   */
  static fromError(error: unknown, context: string): ExchangeError {
    const message = error instanceof Error ? error.message : String(error);
    return new ExchangeError({
      message: `${context}: ${message}`,
      cause: error,
      context
    });
  }

  /**
   * Create an ExchangeError with a simple message
   */
  static fromMessage(message: string, context?: string): ExchangeError {
    return new ExchangeError({
      message: context ? `${context}: ${message}` : message,
      context
    });
  }

  /**
   * Check if an error is an ExchangeError
   */
  static isExchangeError(error: unknown): error is ExchangeError {
    return error instanceof ExchangeError;
  }

  /**
   * Get the root cause of the error
   */
  getRootCause(): unknown {
    let current: unknown = this;
    while (current instanceof ExchangeError && current.options.cause) {
      current = current.options.cause;
    }
    return current;
  }

  /**
   * Get error chain as array
   */
  getErrorChain(): string[] {
    const chain: string[] = [this.message];
    let current: unknown = this.options.cause;
    
    while (current instanceof Error) {
      chain.push(current.message);
      if (current instanceof ExchangeError && current.options.cause) {
        current = current.options.cause;
      } else {
        break;
      }
    }
    
    return chain;
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON() {
    return {
      _tag: this._tag,
      name: this.name,
      message: this.message,
      context: this.options.context,
      cause: this.options.cause instanceof Error ? this.options.cause.message : this.options.cause,
      stack: this.stack
    };
  }
}

// Schema for validating ExchangeError
export const ExchangeErrorSchema = Schema.Class<ExchangeError>('ExchangeError')({
  _tag: Schema.Literal('ExchangeError'),
  options: Schema.Struct({
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
    context: Schema.optional(Schema.String)
  })
});

// Type guard for Effect operations
export const isExchangeError = (error: unknown): error is ExchangeError =>
  ExchangeError.isExchangeError(error);

// Utility function to wrap errors in ExchangeError
export const wrapError = (context: string) => (error: unknown): ExchangeError =>
  ExchangeError.fromError(error, context);