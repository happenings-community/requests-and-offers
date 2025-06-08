/**
 * Error types related to service type operations
 */
import { Data } from 'effect';

/**
 * Base error for service type-related operations
 */
export class ServiceTypeError extends Data.TaggedError('ServiceTypeError')<{
  message: string;
  serviceTypeId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when service type creation fails
 */
export class ServiceTypeCreationError extends Data.TaggedError('ServiceTypeCreationError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when service type update fails
 */
export class ServiceTypeUpdateError extends Data.TaggedError('ServiceTypeUpdateError')<{
  message: string;
  serviceTypeId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when service type deletion fails
 */
export class ServiceTypeDeletionError extends Data.TaggedError('ServiceTypeDeletionError')<{
  message: string;
  serviceTypeId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when service type loading fails
 */
export class ServiceTypeLoadError extends Data.TaggedError('ServiceTypeLoadError')<{
  message: string;
  serviceTypeId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when service type store operations fail
 */
export class ServiceTypeStoreError extends Data.TaggedError('ServiceTypeStoreError')<{
  message: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'getAll';
  serviceTypeId?: string;
  cause?: unknown;
}> {}
