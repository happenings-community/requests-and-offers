import { Data } from 'effect';
import { reasonOf } from '$lib/utils/messaging-threads';

/**
 * Centralised error type for the Messaging domain.
 *
 * One error for the whole domain, following `ServiceTypeError`: the context string
 * says which operation failed, so a caller can show the zome's own reason rather than
 * a generic failure. That matters more here than elsewhere, because several messaging
 * calls are refusals by design (an unaccepted sender, a report addressed to someone
 * who is not an administrator) and the reason is the whole message to the member.
 */
export class MessagingError extends Data.TaggedError('MessagingError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly conversationId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    conversationId?: string,
    operation?: string
  ): MessagingError {
    if (error instanceof MessagingError) {
      return error;
    }

    // Read by shape, never by class. `instanceof Error` misses an error from another
    // copy of a library or one that has crossed a realm, and `String(error)` throws on an
    // object made with `Object.create(null)` — which is what a structured clone produces,
    // and this message is shown to a member.
    const message = reasonOf(error);

    return new MessagingError({
      message: `${context}: ${message}`,
      cause: error,
      context,
      conversationId,
      operation
    });
  }

  static create(
    message: string,
    context?: string,
    conversationId?: string,
    operation?: string
  ): MessagingError {
    return new MessagingError({
      message,
      context,
      conversationId,
      operation
    });
  }
}
