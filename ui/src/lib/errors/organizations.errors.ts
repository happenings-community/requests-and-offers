import { Data } from 'effect';

// ============================================================================
// SERVICE LAYER ERRORS
// ============================================================================

/**
 * Tagged error for organization service operations
 */
export class OrganizationError extends Data.TaggedError('OrganizationError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    operation: string,
    organizationId?: string,
    userId?: string
  ): OrganizationError {
    if (error instanceof OrganizationError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new OrganizationError({
      message: `Organization service error: ${message}`,
      cause: error,
      organizationId,
      userId,
      operation
    });
  }

  static createOrganization(error: unknown): OrganizationError {
    return OrganizationError.fromError(error, 'create_organization');
  }

  static getOrganization(error: unknown, organizationId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'get_organization', organizationId);
  }

  static updateOrganization(error: unknown, organizationId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'update_organization', organizationId);
  }

  static deleteOrganization(error: unknown, organizationId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'delete_organization', organizationId);
  }

  static getOrganizationStatus(error: unknown, organizationId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'get_organization_status', organizationId);
  }

  static getOrganizationMembers(error: unknown, organizationId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'get_organization_members', organizationId);
  }

  static getOrganizationCoordinators(error: unknown, organizationId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'get_organization_coordinators', organizationId);
  }

  static addOrganizationMember(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationError {
    return OrganizationError.fromError(error, 'add_organization_member', organizationId, userId);
  }

  static removeOrganizationMember(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationError {
    return OrganizationError.fromError(error, 'remove_organization_member', organizationId, userId);
  }

  static addOrganizationCoordinator(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationError {
    return OrganizationError.fromError(
      error,
      'add_organization_coordinator',
      organizationId,
      userId
    );
  }

  static removeOrganizationCoordinator(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationError {
    return OrganizationError.fromError(
      error,
      'remove_organization_coordinator',
      organizationId,
      userId
    );
  }

  static getUserOrganizations(error: unknown, userId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'get_user_organizations', undefined, userId);
  }

  static getAcceptedOrganizations(error: unknown): OrganizationError {
    return OrganizationError.fromError(error, 'get_accepted_organizations');
  }

  static getAllOrganizations(error: unknown): OrganizationError {
    return OrganizationError.fromError(error, 'get_all_organizations');
  }

  static leaveOrganization(error: unknown, organizationId?: string): OrganizationError {
    return OrganizationError.fromError(error, 'leave_organization', organizationId);
  }

  static isOrganizationCoordinator(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationError {
    return OrganizationError.fromError(
      error,
      'is_organization_coordinator',
      organizationId,
      userId
    );
  }
}

// ============================================================================
// STORE LAYER ERRORS
// ============================================================================

/**
 * Tagged error for organization store operations
 */
export class OrganizationStoreError extends Data.TaggedError('OrganizationStoreError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly operation?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    organizationId?: string,
    userId?: string,
    operation?: string
  ): OrganizationStoreError {
    if (error instanceof OrganizationStoreError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);

    return new OrganizationStoreError({
      message: `Organization store error: ${message}`,
      cause: error,
      context,
      organizationId,
      userId,
      operation
    });
  }

  static createOrganization(error: unknown, organizationId?: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to create organization',
      organizationId,
      undefined,
      'create'
    );
  }

  static getOrganization(error: unknown, organizationId?: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to get organization',
      organizationId,
      undefined,
      'get'
    );
  }

  static updateOrganization(error: unknown, organizationId?: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to update organization',
      organizationId,
      undefined,
      'update'
    );
  }

  static deleteOrganization(error: unknown, organizationId?: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to delete organization',
      organizationId,
      undefined,
      'delete'
    );
  }

  static getAcceptedOrganizations(error: unknown): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to get accepted organizations',
      undefined,
      undefined,
      'get_accepted'
    );
  }

  static getAllOrganizations(error: unknown): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to get all organizations',
      undefined,
      undefined,
      'get_all'
    );
  }

  static getOrganizationsByHashes(error: unknown): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to get organizations by hashes',
      undefined,
      undefined,
      'get_by_hashes'
    );
  }

  static getUserOrganizations(error: unknown, userId?: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to get user organizations',
      undefined,
      userId,
      'get_user_organizations'
    );
  }

  static addOrganizationMember(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to add organization member',
      organizationId,
      userId,
      'add_member'
    );
  }

  static removeOrganizationMember(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to remove organization member',
      organizationId,
      userId,
      'remove_member'
    );
  }

  static addOrganizationCoordinator(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to add organization coordinator',
      organizationId,
      userId,
      'add_coordinator'
    );
  }

  static removeOrganizationCoordinator(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to remove organization coordinator',
      organizationId,
      userId,
      'remove_coordinator'
    );
  }

  static leaveOrganization(error: unknown, organizationId?: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to leave organization',
      organizationId,
      undefined,
      'leave'
    );
  }

  static isOrganizationCoordinator(
    error: unknown,
    organizationId?: string,
    userId?: string
  ): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      'Failed to check coordinator status',
      organizationId,
      userId,
      'check_coordinator'
    );
  }

  static cacheOperation(error: unknown, operation: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      `Cache operation failed: ${operation}`,
      undefined,
      undefined,
      'cache'
    );
  }

  static eventEmission(error: unknown, eventType: string): OrganizationStoreError {
    return OrganizationStoreError.fromError(
      error,
      `Event emission failed: ${eventType}`,
      undefined,
      undefined,
      'event'
    );
  }
}

// ============================================================================
// COMPOSABLE LAYER ERRORS
// ============================================================================

/**
 * Tagged error for organization management composable operations
 */
export class OrganizationsManagementError extends Data.TaggedError('OrganizationsManagementError')<{
  readonly message: string;
  readonly cause?: unknown;
  readonly context?: string;
  readonly organizationId?: string;
  readonly userId?: string;
  readonly operation?: string;
  readonly userFriendly?: boolean;
}> {
  static fromError(
    error: unknown,
    context: string,
    organizationId?: string,
    userId?: string,
    operation?: string,
    userFriendly: boolean = false
  ): OrganizationsManagementError {
    if (error instanceof OrganizationsManagementError) {
      return error;
    }

    let message: string;

    if (userFriendly) {
      // User-friendly error messages
      if (context.includes('create')) {
        message = 'Unable to create organization. Please check your information and try again.';
      } else if (context.includes('update')) {
        message = 'Unable to update organization. Please try again.';
      } else if (context.includes('delete')) {
        message = 'Unable to delete organization. Please try again.';
      } else if (context.includes('member')) {
        message = 'Unable to manage organization members. Please try again.';
      } else if (context.includes('coordinator')) {
        message = 'Unable to manage organization coordinators. Please try again.';
      } else if (context.includes('load') || context.includes('get')) {
        message = 'Unable to load organization information. Please refresh the page.';
      } else if (context.includes('leave')) {
        message = 'Unable to leave organization. Please try again.';
      } else {
        message = 'An error occurred while managing organization data. Please try again.';
      }
    } else {
      message = error instanceof Error ? error.message : String(error);
    }

    return new OrganizationsManagementError({
      message,
      cause: error,
      context,
      organizationId,
      userId,
      operation,
      userFriendly
    });
  }

  static organizationCreation(
    error: unknown,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Organization creation failed',
      undefined,
      undefined,
      'create_organization',
      userFriendly
    );
  }

  static organizationUpdate(
    error: unknown,
    organizationId?: string,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Organization update failed',
      organizationId,
      undefined,
      'update_organization',
      userFriendly
    );
  }

  static organizationDeletion(
    error: unknown,
    organizationId?: string,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Organization deletion failed',
      organizationId,
      undefined,
      'delete_organization',
      userFriendly
    );
  }

  static organizationLoad(
    error: unknown,
    organizationId?: string,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Organization load failed',
      organizationId,
      undefined,
      'load_organization',
      userFriendly
    );
  }

  static memberManagement(
    error: unknown,
    organizationId?: string,
    userId?: string,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Member management failed',
      organizationId,
      userId,
      'manage_member',
      userFriendly
    );
  }

  static coordinatorManagement(
    error: unknown,
    organizationId?: string,
    userId?: string,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Coordinator management failed',
      organizationId,
      userId,
      'manage_coordinator',
      userFriendly
    );
  }

  static organizationLeave(
    error: unknown,
    organizationId?: string,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Leave organization failed',
      organizationId,
      undefined,
      'leave_organization',
      userFriendly
    );
  }

  static organizationSearch(
    error: unknown,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Organization search failed',
      undefined,
      undefined,
      'search_organizations',
      userFriendly
    );
  }

  static organizationValidation(
    error: unknown,
    userFriendly: boolean = true
  ): OrganizationsManagementError {
    return OrganizationsManagementError.fromError(
      error,
      'Organization data validation failed',
      undefined,
      undefined,
      'validate_organization',
      userFriendly
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts unknown organization errors to user-friendly messages
 */
export const toUserFriendlyOrganizationError = (error: unknown): string => {
  if (error instanceof OrganizationsManagementError && error.userFriendly) {
    return error.message;
  }

  if (error instanceof OrganizationStoreError) {
    return OrganizationsManagementError.fromError(
      error,
      error.context || 'Unknown error',
      error.organizationId,
      error.userId,
      error.operation,
      true
    ).message;
  }

  if (error instanceof OrganizationError) {
    return OrganizationsManagementError.fromError(
      error,
      error.operation || 'Unknown error',
      error.organizationId,
      error.userId,
      error.operation,
      true
    ).message;
  }

  // Default user-friendly message
  return 'An unexpected error occurred with organization management. Please try again or contact support if the problem persists.';
};

/**
 * Checks if an organization error is recoverable (user can retry)
 */
export const isRecoverableOrganizationError = (error: unknown): boolean => {
  if (
    error instanceof OrganizationError ||
    error instanceof OrganizationStoreError ||
    error instanceof OrganizationsManagementError
  ) {
    const message = error.message.toLowerCase();

    // Non-recoverable errors
    if (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('not found') ||
      message.includes('invalid schema') ||
      message.includes('validation failed') ||
      message.includes('already exists') ||
      message.includes('not a member') ||
      message.includes('not a coordinator')
    ) {
      return false;
    }

    // Recoverable errors (network, temporary issues)
    return true;
  }

  // Unknown errors are considered recoverable by default
  return true;
};
