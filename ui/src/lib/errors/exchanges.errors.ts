import { Data } from 'effect';

/**
 * Tagged error type for Exchanges domain
 * Provides type-safe error handling across the exchange workflow
 */
export class ExchangeError extends Data.TaggedError('ExchangeError')<{
  readonly code: // Proposal-related errors
  | 'PROPOSAL_CREATE_FAILED'
    | 'PROPOSAL_UPDATE_FAILED'
    | 'PROPOSAL_NOT_FOUND'
    | 'PROPOSAL_ALREADY_APPROVED'
    | 'PROPOSAL_ALREADY_REJECTED'
    | 'INVALID_PROPOSAL_STATUS'
    | 'UNAUTHORIZED_PROPOSAL_ACTION'

    // Agreement-related errors
    | 'AGREEMENT_CREATE_FAILED'
    | 'AGREEMENT_UPDATE_FAILED'
    | 'AGREEMENT_NOT_FOUND'
    | 'AGREEMENT_ALREADY_COMPLETED'
    | 'AGREEMENT_COMPLETION_FAILED'
    | 'INVALID_COMPLETION_ROLE'
    | 'UNAUTHORIZED_AGREEMENT_ACTION'

    // Review-related errors
    | 'REVIEW_CREATE_FAILED'
    | 'REVIEW_NOT_FOUND'
    | 'REVIEW_ALREADY_EXISTS'
    | 'INVALID_REVIEW_RATING'
    | 'INVALID_REVIEW_DATA'
    | 'UNAUTHORIZED_REVIEW_ACTION'

    // Data validation errors
    | 'INVALID_INPUT_DATA'
    | 'MISSING_REQUIRED_FIELD'
    | 'INVALID_FIELD_LENGTH'
    | 'INVALID_EXCHANGE_VALUE'
    | 'INVALID_DELIVERY_TIMEFRAME'

    // Business logic errors
    | 'TARGET_ENTITY_NOT_FOUND'
    | 'RESPONDER_ENTITY_NOT_FOUND'
    | 'EXCHANGE_WORKFLOW_VIOLATION'
    | 'INSUFFICIENT_PERMISSIONS'
    | 'EXCHANGE_ALREADY_IN_PROGRESS'
    | 'INVALID_EXCHANGE_STATE'

    // Network/system errors
    | 'NETWORK_ERROR'
    | 'TIMEOUT_ERROR'
    | 'SERIALIZATION_ERROR'
    | 'UNKNOWN_ERROR';

  readonly message: string;
  readonly cause?: unknown;
  readonly details?: Record<string, unknown>;
}> {}

// Factory functions for common error scenarios

export const createProposalError = (
  code: Extract<
    ExchangeError['code'],
    | 'PROPOSAL_CREATE_FAILED'
    | 'PROPOSAL_UPDATE_FAILED'
    | 'PROPOSAL_NOT_FOUND'
    | 'PROPOSAL_ALREADY_APPROVED'
    | 'PROPOSAL_ALREADY_REJECTED'
    | 'INVALID_PROPOSAL_STATUS'
    | 'UNAUTHORIZED_PROPOSAL_ACTION'
  >,
  message: string,
  cause?: unknown,
  details?: Record<string, unknown>
): ExchangeError => new ExchangeError({ code, message, cause, details });

export const createAgreementError = (
  code: Extract<
    ExchangeError['code'],
    | 'AGREEMENT_CREATE_FAILED'
    | 'AGREEMENT_UPDATE_FAILED'
    | 'AGREEMENT_NOT_FOUND'
    | 'AGREEMENT_ALREADY_COMPLETED'
    | 'AGREEMENT_COMPLETION_FAILED'
    | 'INVALID_COMPLETION_ROLE'
    | 'UNAUTHORIZED_AGREEMENT_ACTION'
  >,
  message: string,
  cause?: unknown,
  details?: Record<string, unknown>
): ExchangeError => new ExchangeError({ code, message, cause, details });

export const createReviewError = (
  code: Extract<
    ExchangeError['code'],
    | 'REVIEW_CREATE_FAILED'
    | 'REVIEW_NOT_FOUND'
    | 'REVIEW_ALREADY_EXISTS'
    | 'INVALID_REVIEW_RATING'
    | 'INVALID_REVIEW_DATA'
    | 'UNAUTHORIZED_REVIEW_ACTION'
  >,
  message: string,
  cause?: unknown,
  details?: Record<string, unknown>
): ExchangeError => new ExchangeError({ code, message, cause, details });

export const createValidationError = (
  code: Extract<
    ExchangeError['code'],
    | 'INVALID_INPUT_DATA'
    | 'MISSING_REQUIRED_FIELD'
    | 'INVALID_FIELD_LENGTH'
    | 'INVALID_EXCHANGE_VALUE'
    | 'INVALID_DELIVERY_TIMEFRAME'
  >,
  message: string,
  cause?: unknown,
  details?: Record<string, unknown>
): ExchangeError => new ExchangeError({ code, message, cause, details });

export const createBusinessLogicError = (
  code: Extract<
    ExchangeError['code'],
    | 'TARGET_ENTITY_NOT_FOUND'
    | 'RESPONDER_ENTITY_NOT_FOUND'
    | 'EXCHANGE_WORKFLOW_VIOLATION'
    | 'INSUFFICIENT_PERMISSIONS'
    | 'EXCHANGE_ALREADY_IN_PROGRESS'
    | 'INVALID_EXCHANGE_STATE'
  >,
  message: string,
  cause?: unknown,
  details?: Record<string, unknown>
): ExchangeError => new ExchangeError({ code, message, cause, details });

export const createSystemError = (
  code: Extract<
    ExchangeError['code'],
    'NETWORK_ERROR' | 'TIMEOUT_ERROR' | 'SERIALIZATION_ERROR' | 'UNKNOWN_ERROR'
  >,
  message: string,
  cause?: unknown,
  details?: Record<string, unknown>
): ExchangeError => new ExchangeError({ code, message, cause, details });

// Error message constants for consistency

export const EXCHANGE_ERROR_MESSAGES = {
  // Proposal messages
  PROPOSAL_CREATE_FAILED: 'Failed to create exchange proposal',
  PROPOSAL_UPDATE_FAILED: 'Failed to update proposal status',
  PROPOSAL_NOT_FOUND: 'Exchange proposal not found',
  PROPOSAL_ALREADY_APPROVED: 'Proposal has already been approved',
  PROPOSAL_ALREADY_REJECTED: 'Proposal has already been rejected',
  INVALID_PROPOSAL_STATUS: 'Invalid proposal status transition',
  UNAUTHORIZED_PROPOSAL_ACTION: 'Unauthorized to perform this proposal action',

  // Agreement messages
  AGREEMENT_CREATE_FAILED: 'Failed to create exchange agreement',
  AGREEMENT_UPDATE_FAILED: 'Failed to update agreement status',
  AGREEMENT_NOT_FOUND: 'Exchange agreement not found',
  AGREEMENT_ALREADY_COMPLETED: 'Agreement has already been marked complete',
  AGREEMENT_COMPLETION_FAILED: 'Failed to mark agreement as complete',
  INVALID_COMPLETION_ROLE: 'Invalid role for marking completion',
  UNAUTHORIZED_AGREEMENT_ACTION: 'Unauthorized to perform this agreement action',

  // Review messages
  REVIEW_CREATE_FAILED: 'Failed to create exchange review',
  REVIEW_NOT_FOUND: 'Exchange review not found',
  REVIEW_ALREADY_EXISTS: 'Review already exists for this exchange',
  INVALID_REVIEW_RATING: 'Review rating must be between 1 and 5',
  INVALID_REVIEW_DATA: 'Invalid review data provided',
  UNAUTHORIZED_REVIEW_ACTION: 'Unauthorized to perform this review action',

  // Validation messages
  INVALID_INPUT_DATA: 'Invalid input data provided',
  MISSING_REQUIRED_FIELD: 'Missing required field',
  INVALID_FIELD_LENGTH: 'Field length exceeds maximum allowed',
  INVALID_EXCHANGE_VALUE: 'Invalid exchange value format',
  INVALID_DELIVERY_TIMEFRAME: 'Invalid delivery timeframe',

  // Business logic messages
  TARGET_ENTITY_NOT_FOUND: 'Target request or offer not found',
  RESPONDER_ENTITY_NOT_FOUND: 'Responder entity not found',
  EXCHANGE_WORKFLOW_VIOLATION: 'Action violates exchange workflow rules',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this action',
  EXCHANGE_ALREADY_IN_PROGRESS: 'Exchange is already in progress',
  INVALID_EXCHANGE_STATE: 'Invalid state for this exchange operation',

  // System messages
  NETWORK_ERROR: 'Network error occurred',
  TIMEOUT_ERROR: 'Operation timed out',
  SERIALIZATION_ERROR: 'Data serialization error',
  UNKNOWN_ERROR: 'An unknown error occurred'
} as const;
