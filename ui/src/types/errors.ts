/**
 * Base error type for Requests and Offers system
 */
export interface BaseError {
  type: string;
  message: string;
  details?: unknown;
  _tag: string;
  name: string;
}

export interface EventEmissionError extends BaseError {
  type: 'EventEmissionError';
  _tag: 'EventEmissionError';
  name: 'EventEmissionError';
  event: string;
}

export interface EventSubscriptionError extends BaseError {
  type: 'EventSubscriptionError';
  _tag: 'EventSubscriptionError';
  name: 'EventSubscriptionError';
  event: string;
}

/**
 * Error type for request creation failures
 */
export interface RequestCreationError extends BaseError {
  type: 'RequestCreationError';
  _tag: 'RequestCreationError';
  name: 'RequestCreationError';
}

/**
 * Error type for request retrieval failures
 */
export interface RequestRetrievalError extends BaseError {
  type: 'RequestRetrievalError';
  _tag: 'RequestRetrievalError';
  name: 'RequestRetrievalError';
}

/**
 * Error type for request update failures
 */
export interface RequestUpdateError extends BaseError {
  type: 'RequestUpdateError';
  _tag: 'RequestUpdateError';
  name: 'RequestUpdateError';
}

/**
 * Error type for request deletion failures
 */
export interface RequestDeletionError extends BaseError {
  type: 'RequestDeletionError';
  _tag: 'RequestDeletionError';
  name: 'RequestDeletionError';
}
