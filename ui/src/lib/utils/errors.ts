/**
 * Error management utilities for the Requests and Offers application
 *
 * This file provides utility functions for working with TaggedError and error conversion
 * in a consistent way across the application.
 */

import { Effect as E } from 'effect';

/**
 * Base interface for TaggedError constructor arguments
 */
interface TaggedErrorArgs {
  message: string;
  cause?: unknown;
}

/**
 * Converts an unknown error to a specific TaggedError type
 *
 * @param error - The unknown error to convert
 * @param ErrorClass - The TaggedError class to convert to
 * @param context - Additional context for the error message
 * @returns A new instance of the specified TaggedError
 */
export const toTypedError = <T>(
  error: unknown,
  ErrorClass: new (args: TaggedErrorArgs) => T,
  context: string
): T => {
  if (error instanceof Error) {
    return new ErrorClass({
      message: `${context}: ${error.message}`,
      cause: error
    });
  }

  if (typeof error === 'string') {
    return new ErrorClass({
      message: `${context}: ${error}`,
      cause: error
    });
  }

  return new ErrorClass({
    message: `${context}: ${String(error)}`,
    cause: error
  });
};

/**
 * Creates a higher-order function for converting errors to a specific type
 *
 * @param ErrorClass - The TaggedError class to convert to
 * @param context - Base context for error messages
 * @returns A function that converts unknown errors to the specified type
 */
export const createErrorConverter =
  <T>(ErrorClass: new (args: TaggedErrorArgs) => T, context: string) =>
  (error: unknown, additionalContext?: string): T => {
    const fullContext = additionalContext ? `${context}: ${additionalContext}` : context;
    return toTypedError(error, ErrorClass, fullContext);
  };

/**
 * Creates an error handler that converts errors to a specific type
 *
 * @param ErrorClass - The TaggedError class to convert to
 * @param context - Context for the error
 * @returns A function that handles errors
 */
export const createErrorHandler =
  <T>(ErrorClass: new (args: TaggedErrorArgs) => T, context: string) =>
  (error: unknown): E.Effect<never, T> =>
    E.fail(toTypedError(error, ErrorClass, context));

/**
 * Creates a type-safe error matcher for TaggedErrors
 *
 * @param error - The error to match
 * @returns An object with matching methods
 */
export const matchError = <E extends { _tag: string }>(error: E) => ({
  /**
   * Matches against a specific error type
   */
  when: <T extends string>(tag: T, handler: (error: Extract<E, { _tag: T }>) => void) => {
    if (error._tag === tag) {
      handler(error as Extract<E, { _tag: T }>);
      return true;
    }
    return false;
  },

  /**
   * Default handler for unmatched errors
   */
  otherwise: (handler: (error: E) => void) => {
    handler(error);
  }
});

/**
 * Creates a cache key from multiple parts
 *
 * @param parts - Parts to join into a cache key
 * @returns A cache key string
 */
export const createCacheKey = (...parts: (string | number | undefined)[]): string =>
  parts.filter(Boolean).join(':');

/**
 * Safely extracts a hash from a cache key
 * Assumes the hash is the last part of a colon-separated key
 *
 * @param key - The cache key
 * @returns The extracted hash or the original key if no separator found
 */
export const extractHashFromKey = (key: string): string => {
  const parts = key.split(':');
  return parts[parts.length - 1];
};
