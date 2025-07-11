import { Data } from 'effect';

// ============================================================================
// SERVICE LAYER ERRORS
// ============================================================================

/**
 * Tagged error for user service operations
 */
export class UserError extends Data.TaggedError('UserError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly userId?: string;
  readonly operation?: string;
}> {
  static fromError(error: unknown, operation: string, userId?: string): UserError {
    if (error instanceof UserError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new UserError({
      message: `User service error: ${message}`,
      cause: error,
      userId,
      operation
    });
  }

  static createUser(error: unknown): UserError {
    return UserError.fromError(error, 'create_user');
  }

  static getUser(error: unknown, userId?: string): UserError {
    return UserError.fromError(error, 'get_user', userId);
  }

  static updateUser(error: unknown, userId?: string): UserError {
    return UserError.fromError(error, 'update_user', userId);
  }

  static getUserStatus(error: unknown, userId?: string): UserError {
    return UserError.fromError(error, 'get_user_status', userId);
  }

  static getUserAgents(error: unknown, userId?: string): UserError {
    return UserError.fromError(error, 'get_user_agents', userId);
  }

  static getAcceptedUsers(error: unknown): UserError {
    return UserError.fromError(error, 'get_accepted_users');
  }

  static getAgentUser(error: unknown): UserError {
    return UserError.fromError(error, 'get_agent_user');
  }
}

// ============================================================================
// STORE LAYER ERRORS
// ============================================================================

/**
 * Tagged error for user store operations
 */
export class UserStoreError extends Data.TaggedError('UserStoreError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly userId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    userId?: string,
    operation?: string
  ): UserStoreError {
    if (error instanceof UserStoreError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new UserStoreError({
      message: `User store error: ${message}`,
      cause: error,
      context,
      userId,
      operation
    });
  }

  static createUser(error: unknown, userId?: string): UserStoreError {
    return UserStoreError.fromError(error, 'Failed to create user', userId, 'create');
  }

  static getUser(error: unknown, userId?: string): UserStoreError {
    return UserStoreError.fromError(error, 'Failed to get user', userId, 'get');
  }

  static updateUser(error: unknown, userId?: string): UserStoreError {
    return UserStoreError.fromError(error, 'Failed to update user', userId, 'update');
  }

  static refreshCurrentUser(error: unknown): UserStoreError {
    return UserStoreError.fromError(error, 'Failed to refresh current user', undefined, 'refresh');
  }

  static setCurrentUser(error: unknown, userId?: string): UserStoreError {
    return UserStoreError.fromError(error, 'Failed to set current user', userId, 'set_current');
  }

  static getAcceptedUsers(error: unknown): UserStoreError {
    return UserStoreError.fromError(
      error,
      'Failed to get accepted users',
      undefined,
      'get_accepted'
    );
  }

  static getUsersByHashes(error: unknown): UserStoreError {
    return UserStoreError.fromError(
      error,
      'Failed to get users by hashes',
      undefined,
      'get_by_hashes'
    );
  }

  static getUserAgents(error: unknown, userId?: string): UserStoreError {
    return UserStoreError.fromError(error, 'Failed to get user agents', userId, 'get_agents');
  }

  static getUserByAgent(error: unknown): UserStoreError {
    return UserStoreError.fromError(
      error,
      'Failed to get user by agent',
      undefined,
      'get_by_agent'
    );
  }

  static cacheOperation(error: unknown, operation: string): UserStoreError {
    return UserStoreError.fromError(
      error,
      `Cache operation failed: ${operation}`,
      undefined,
      'cache'
    );
  }

  static eventEmission(error: unknown, eventType: string): UserStoreError {
    return UserStoreError.fromError(
      error,
      `Event emission failed: ${eventType}`,
      undefined,
      'event'
    );
  }
}

// ============================================================================
// COMPOSABLE LAYER ERRORS
// ============================================================================

/**
 * Tagged error for user management composable operations
 */
export class UsersManagementError extends Data.TaggedError('UsersManagementError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly userId?: string;
  readonly operation?: string;
  readonly userFriendly?: boolean;
}> {
  static fromError(
    error: unknown,
    context: string,
    userId?: string,
    operation?: string,
    userFriendly: boolean = false
  ): UsersManagementError {
    if (error instanceof UsersManagementError) {
      return error;
    }

    let message: string;

    if (userFriendly) {
      // User-friendly error messages
      if (context.includes('create')) {
        message = 'Unable to create user. Please check your information and try again.';
      } else if (context.includes('update')) {
        message = 'Unable to update user profile. Please try again.';
      } else if (context.includes('load') || context.includes('get')) {
        message = 'Unable to load user information. Please refresh the page.';
      } else {
        message = 'An error occurred while managing user data. Please try again.';
      }
    } else {
      message = error instanceof Error ? error.message : String(error);
    }

    return new UsersManagementError({
      message,
      cause: error,
      context,
      userId,
      operation,
      userFriendly
    });
  }

  static userCreation(error: unknown, userFriendly: boolean = true): UsersManagementError {
    return UsersManagementError.fromError(
      error,
      'User creation failed',
      undefined,
      'create_user',
      userFriendly
    );
  }

  static userUpdate(
    error: unknown,
    userId?: string,
    userFriendly: boolean = true
  ): UsersManagementError {
    return UsersManagementError.fromError(
      error,
      'User update failed',
      userId,
      'update_user',
      userFriendly
    );
  }

  static userProfileLoad(
    error: unknown,
    userId?: string,
    userFriendly: boolean = true
  ): UsersManagementError {
    return UsersManagementError.fromError(
      error,
      'User profile load failed',
      userId,
      'load_profile',
      userFriendly
    );
  }

  static currentUserRefresh(error: unknown, userFriendly: boolean = true): UsersManagementError {
    return UsersManagementError.fromError(
      error,
      'Current user refresh failed',
      undefined,
      'refresh_current',
      userFriendly
    );
  }

  static userSearch(error: unknown, userFriendly: boolean = true): UsersManagementError {
    return UsersManagementError.fromError(
      error,
      'User search failed',
      undefined,
      'search_users',
      userFriendly
    );
  }

  static userValidation(error: unknown, userFriendly: boolean = true): UsersManagementError {
    return UsersManagementError.fromError(
      error,
      'User data validation failed',
      undefined,
      'validate_user',
      userFriendly
    );
  }

  static serviceTypeAssignment(
    error: unknown,
    userId?: string,
    userFriendly: boolean = true
  ): UsersManagementError {
    return UsersManagementError.fromError(
      error,
      'Service type assignment failed',
      userId,
      'assign_service_types',
      userFriendly
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts unknown errors to user-friendly messages
 */
export const toUserFriendlyError = (error: unknown): string => {
  if (error instanceof UsersManagementError && error.userFriendly) {
    return error.message;
  }

  if (error instanceof UserStoreError) {
    return UsersManagementError.fromError(
      error,
      error.context || 'Unknown error',
      error.userId,
      error.operation,
      true
    ).message;
  }

  if (error instanceof UserError) {
    return UsersManagementError.fromError(
      error,
      error.operation || 'Unknown error',
      error.userId,
      error.operation,
      true
    ).message;
  }

  // Default user-friendly message
  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
};

/**
 * Checks if an error is recoverable (user can retry)
 */
export const isRecoverableError = (error: unknown): boolean => {
  if (
    error instanceof UserError ||
    error instanceof UserStoreError ||
    error instanceof UsersManagementError
  ) {
    const message = error.message.toLowerCase();

    // Non-recoverable errors
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('invalid schema') ||
      message.includes('validation failed')
    ) {
      return false;
    }

    // Recoverable errors (network, temporary issues)
    return true;
  }

  // Unknown errors are considered recoverable by default
  return true;
};
