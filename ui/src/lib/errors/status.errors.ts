/**
 * Error types related to status operations
 */
import { Data } from 'effect';

/**
 * Error thrown when status loading fails
 */
export class StatusLoadError extends Data.TaggedError('StatusLoadError')<{
  message: string;
  entityId?: string;
  entityType?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when status update fails
 */
export class StatusUpdateError extends Data.TaggedError('StatusUpdateError')<{
  message: string;
  entityId?: string;
  entityType?: string;
  newStatus?: string;
  cause?: unknown;
}> {}
