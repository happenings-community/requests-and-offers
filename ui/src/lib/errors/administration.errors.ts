import { Data } from 'effect';
import type { ActionHash, AgentPubKey } from '@holochain/client';
import { AdministrationEntity } from '$lib/types/holochain';

// ============================================================================
// BASE ADMINISTRATION ERROR
// ============================================================================

export class AdministrationError extends Data.TaggedError('AdministrationError')<{
  message: string;
  cause?: unknown;
  context?: string;
  entityType?: AdministrationEntity;
  entityHash?: string;
  agentPubKey?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    entityType?: AdministrationEntity,
    entityHash?: string,
    agentPubKey?: string
  ): AdministrationError {
    if (error instanceof Error) {
      return new AdministrationError({
        message: error.message,
        cause: error,
        context,
        entityType,
        entityHash,
        agentPubKey
      });
    }
    return new AdministrationError({
      message: String(error),
      cause: error,
      context,
      entityType,
      entityHash,
      agentPubKey
    });
  }

  // Administrator management errors
  static registerAdministrator(
    error: unknown,
    entityType: AdministrationEntity,
    entityHash: string
  ): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to register administrator',
      entityType,
      entityHash
    );
  }

  static addAdministrator(
    error: unknown,
    entityType: AdministrationEntity,
    entityHash: string
  ): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to add administrator',
      entityType,
      entityHash
    );
  }

  static removeAdministrator(
    error: unknown,
    entityType: AdministrationEntity,
    entityHash: string
  ): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to remove administrator',
      entityType,
      entityHash
    );
  }

  static checkAdministrator(
    error: unknown,
    entityType: AdministrationEntity,
    agentPubKey: string
  ): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to check administrator status',
      entityType,
      undefined,
      agentPubKey
    );
  }

  static getAllAdministrators(
    error: unknown,
    entityType: AdministrationEntity
  ): AdministrationError {
    return AdministrationError.fromError(error, 'Failed to get all administrators', entityType);
  }

  // Status management errors
  static createStatus(error: unknown): AdministrationError {
    return AdministrationError.fromError(error, 'Failed to create status');
  }

  static getStatus(error: unknown, statusHash: string): AdministrationError {
    return AdministrationError.fromError(error, 'Failed to get status', undefined, statusHash);
  }

  static updateEntityStatus(
    error: unknown,
    entityType: AdministrationEntity,
    entityHash: string
  ): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to update entity status',
      entityType,
      entityHash
    );
  }

  static getEntityStatus(
    error: unknown,
    entityType: AdministrationEntity,
    entityHash: string
  ): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to get entity status',
      entityType,
      entityHash
    );
  }

  static getAllStatusRevisions(error: unknown, statusHash: string): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to get status revisions',
      undefined,
      statusHash
    );
  }

  // User-specific operations
  static getAllUsers(error: unknown): AdministrationError {
    return AdministrationError.fromError(error, 'Failed to get all users');
  }

  static registerNetworkAdministrator(error: unknown, entityHash: string): AdministrationError {
    return AdministrationError.fromError(
      error,
      'Failed to register network administrator',
      AdministrationEntity.Network,
      entityHash
    );
  }
}

// ============================================================================
// STORE-LEVEL ERRORS
// ============================================================================

export class AdministrationStoreError extends Data.TaggedError('AdministrationStoreError')<{
  message: string;
  cause?: unknown;
  context?: string;
  operation?: string;
  entityType?: AdministrationEntity;
  entityHash?: string;
  agentPubKey?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    operation?: string,
    entityType?: AdministrationEntity,
    entityHash?: string,
    agentPubKey?: string
  ): AdministrationStoreError {
    if (error instanceof AdministrationError) {
      return new AdministrationStoreError({
        message: error.message,
        cause: error,
        context,
        operation,
        entityType: error.entityType || entityType,
        entityHash: error.entityHash || entityHash,
        agentPubKey: error.agentPubKey || agentPubKey
      });
    }
    if (error instanceof Error) {
      return new AdministrationStoreError({
        message: error.message,
        cause: error,
        context,
        operation,
        entityType,
        entityHash,
        agentPubKey
      });
    }
    return new AdministrationStoreError({
      message: String(error),
      cause: error,
      context,
      operation,
      entityType,
      entityHash,
      agentPubKey
    });
  }

  // Store operation errors
  static loadAdministrators(
    error: unknown,
    entityType: AdministrationEntity
  ): AdministrationStoreError {
    return AdministrationStoreError.fromError(
      error,
      'Failed to load administrators in store',
      'load',
      entityType
    );
  }

  static loadUsers(error: unknown): AdministrationStoreError {
    return AdministrationStoreError.fromError(error, 'Failed to load users in store', 'load');
  }

  static manageAdministrator(
    error: unknown,
    operation: 'add' | 'remove' | 'register',
    entityType: AdministrationEntity,
    entityHash: string
  ): AdministrationStoreError {
    return AdministrationStoreError.fromError(
      error,
      `Failed to ${operation} administrator in store`,
      operation,
      entityType,
      entityHash
    );
  }

  static manageStatus(
    error: unknown,
    operation: 'create' | 'update' | 'get',
    entityType?: AdministrationEntity,
    entityHash?: string
  ): AdministrationStoreError {
    return AdministrationStoreError.fromError(
      error,
      `Failed to ${operation} status in store`,
      operation,
      entityType,
      entityHash
    );
  }

  static checkPermissions(
    error: unknown,
    agentPubKey: string,
    entityType: AdministrationEntity
  ): AdministrationStoreError {
    return AdministrationStoreError.fromError(
      error,
      'Failed to check permissions in store',
      'check',
      entityType,
      undefined,
      agentPubKey
    );
  }
}

// ============================================================================
// MANAGEMENT-LEVEL ERRORS (for components and composables)
// ============================================================================

export class AdministrationManagementError extends Data.TaggedError(
  'AdministrationManagementError'
)<{
  message: string;
  cause?: unknown;
  context?: string;
  component?: string;
  operation?: string;
  entityType?: AdministrationEntity;
  entityHash?: string;
  agentPubKey?: string;
}> {
  static fromError(
    error: unknown,
    context: string,
    component?: string,
    operation?: string,
    entityType?: AdministrationEntity,
    entityHash?: string,
    agentPubKey?: string
  ): AdministrationManagementError {
    if (error instanceof AdministrationStoreError || error instanceof AdministrationError) {
      return new AdministrationManagementError({
        message: error.message,
        cause: error,
        context,
        component,
        operation,
        entityType: error.entityType || entityType,
        entityHash: error.entityHash || entityHash,
        agentPubKey: error.agentPubKey || agentPubKey
      });
    }
    if (error instanceof Error) {
      return new AdministrationManagementError({
        message: error.message,
        cause: error,
        context,
        component,
        operation,
        entityType,
        entityHash,
        agentPubKey
      });
    }
    return new AdministrationManagementError({
      message: String(error),
      cause: error,
      context,
      component,
      operation,
      entityType,
      entityHash,
      agentPubKey
    });
  }

  // Component-specific errors
  static adminTable(
    error: unknown,
    operation: string,
    entityType: AdministrationEntity
  ): AdministrationManagementError {
    return AdministrationManagementError.fromError(
      error,
      'Administration table error',
      'AdminTable',
      operation,
      entityType
    );
  }

  static userManagement(error: unknown, operation: string): AdministrationManagementError {
    return AdministrationManagementError.fromError(
      error,
      'User management error',
      'UserManagement',
      operation
    );
  }

  static statusManagement(
    error: unknown,
    operation: string,
    entityType: AdministrationEntity,
    entityHash: string
  ): AdministrationManagementError {
    return AdministrationManagementError.fromError(
      error,
      'Status management error',
      'StatusManagement',
      operation,
      entityType,
      entityHash
    );
  }

  static permissionCheck(
    error: unknown,
    component: string,
    agentPubKey: string
  ): AdministrationManagementError {
    return AdministrationManagementError.fromError(
      error,
      'Permission check error',
      component,
      'permission-check',
      undefined,
      undefined,
      agentPubKey
    );
  }

  // Validation errors
  static validation(
    error: unknown,
    component: string,
    field: string
  ): AdministrationManagementError {
    return AdministrationManagementError.fromError(
      error,
      `Validation error in ${field}`,
      component,
      'validation'
    );
  }

  // Form errors
  static form(error: unknown, component: string, action: string): AdministrationManagementError {
    return AdministrationManagementError.fromError(
      error,
      `Form ${action} error`,
      component,
      'form'
    );
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Converts unknown errors to AdministrationError
 */
export const toAdministrationError = (
  error: unknown,
  context: string,
  entityType?: AdministrationEntity,
  entityHash?: string,
  agentPubKey?: string
): AdministrationError => {
  if (error instanceof AdministrationError) {
    return error;
  }
  return AdministrationError.fromError(error, context, entityType, entityHash, agentPubKey);
};

/**
 * Converts unknown errors to AdministrationStoreError
 */
export const toAdministrationStoreError = (
  error: unknown,
  context: string,
  operation?: string,
  entityType?: AdministrationEntity,
  entityHash?: string,
  agentPubKey?: string
): AdministrationStoreError => {
  if (error instanceof AdministrationStoreError) {
    return error;
  }
  return AdministrationStoreError.fromError(
    error,
    context,
    operation,
    entityType,
    entityHash,
    agentPubKey
  );
};

/**
 * Converts unknown errors to AdministrationManagementError
 */
export const toAdministrationManagementError = (
  error: unknown,
  context: string,
  component?: string,
  operation?: string,
  entityType?: AdministrationEntity,
  entityHash?: string,
  agentPubKey?: string
): AdministrationManagementError => {
  if (error instanceof AdministrationManagementError) {
    return error;
  }
  return AdministrationManagementError.fromError(
    error,
    context,
    component,
    operation,
    entityType,
    entityHash,
    agentPubKey
  );
};
