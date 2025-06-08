/**
 * Error types related to event bus operations
 */
import { Data } from 'effect';

/**
 * Error thrown when event bus operations fail
 */
export class EventBusError extends Data.TaggedError('EventBusError')<{
  message: string;
  eventType?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when event subscription fails
 */
export class EventSubscriptionError extends Data.TaggedError('EventSubscriptionError')<{
  message: string;
  eventType: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when event publishing fails
 */
export class EventPublishError extends Data.TaggedError('EventPublishError')<{
  message: string;
  eventType: string;
  cause?: unknown;
}> {}
