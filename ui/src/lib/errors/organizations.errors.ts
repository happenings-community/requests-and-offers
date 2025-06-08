/**
 * Error types related to organization operations
 */
import { Data } from 'effect';

/**
 * Base error for organization-related operations
 */
export class OrganizationError extends Data.TaggedError('OrganizationError')<{
  message: string;
  organizationId?: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when organization creation fails
 */
export class OrganizationCreationError extends Data.TaggedError('OrganizationCreationError')<{
  message: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when organization update fails
 */
export class OrganizationUpdateError extends Data.TaggedError('OrganizationUpdateError')<{
  message: string;
  organizationId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when organization deletion fails
 */
export class OrganizationDeletionError extends Data.TaggedError('OrganizationDeletionError')<{
  message: string;
  organizationId: string;
  cause?: unknown;
}> {}

/**
 * Error thrown when organization loading fails
 */
export class OrganizationLoadError extends Data.TaggedError('OrganizationLoadError')<{
  message: string;
  organizationId?: string;
  cause?: unknown;
}> {}
