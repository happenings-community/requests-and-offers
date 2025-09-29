import { Effect as E, Context, Layer, Schedule, Duration, pipe } from 'effect';
import { AdministrationError } from '$lib/errors/administration.errors';
import administrationStore from '$lib/stores/administration.store.svelte';
import { runEffect } from '$lib/utils/effect';

/**
 * Admin Status Verification States
 */
export type AdminStatusState = 'unknown' | 'checking' | 'admin' | 'non-admin' | 'error';

/**
 * Effect-first admin status service for background verification
 * Similar to connection service but for administrator status checking
 */
export interface AdminStatusService {
  readonly verifyAdminStatus: () => E.Effect<boolean, AdministrationError>;
  readonly ensureAdminStatusChecked: () => E.Effect<void, AdministrationError>;
  readonly getAdminStatus: () => AdminStatusState;
  readonly isAdmin: () => boolean;
  readonly isChecking: () => boolean;
  readonly hasError: () => boolean;
}

export class AdminStatusServiceTag extends Context.Tag('AdminStatusService')<
  AdminStatusServiceTag,
  AdminStatusService
>() {}

/**
 * Reactive admin status state - accessed globally
 */
let adminStatusState: AdminStatusState = $state('unknown');
let lastCheckTime: number = 0;
let errorMessage: string | null = $state(null);

// Cache status for 30 seconds to avoid too frequent checks
const CACHE_DURATION_MS = 30 * 1000;

/**
 * Creates the admin status service implementation using Effect patterns
 */
const makeAdminStatusService = E.sync(() => {
  /**
   * Verifies admin status by calling the administration store
   */
  const verifyAdminStatus = (): E.Effect<boolean, AdministrationError> =>
    E.gen(function* () {
      yield* E.logInfo('🔍 Verifying administrator status');

      // Update state to checking
      adminStatusState = 'checking';
      errorMessage = null;

      try {
        // Use the administration store's method
        const isAdmin = yield* E.tryPromise({
          try: () => runEffect(administrationStore.checkIfAgentIsAdministrator()),
          catch: (error) =>
            AdministrationError.fromError(error, 'Failed to check administrator status')
        });

        // Update reactive state
        adminStatusState = isAdmin ? 'admin' : 'non-admin';
        lastCheckTime = Date.now();

        yield* E.logInfo(`✅ Administrator status verified: ${isAdmin ? 'ADMIN' : 'NON-ADMIN'}`);
        return isAdmin;
      } catch (error) {
        adminStatusState = 'error';
        errorMessage = error instanceof Error ? error.message : String(error);
        yield* E.logError(`❌ Failed to verify admin status: ${errorMessage}`);
        throw error;
      }
    });

  /**
   * Ensures admin status has been checked recently, with caching
   */
  const ensureAdminStatusChecked = (): E.Effect<void, AdministrationError> =>
    E.gen(function* () {
      const now = Date.now();
      const timeSinceLastCheck = now - lastCheckTime;

      // If we have a recent valid result, don't re-check
      if (
        timeSinceLastCheck < CACHE_DURATION_MS &&
        (adminStatusState === 'admin' || adminStatusState === 'non-admin')
      ) {
        yield* E.logInfo('✅ Admin status check skipped (recent cache hit)');
        return;
      }

      // Perform verification with retry logic
      yield* pipe(
        verifyAdminStatus(),
        // Retry with exponential backoff - max 2 attempts
        E.retry(
          Schedule.exponential('200 millis').pipe(
            Schedule.intersect(Schedule.recurs(1)) // Max 2 total attempts (initial + 1 retry)
          )
        ),
        // Timeout the check at 5 seconds
        E.timeout(Duration.seconds(5)),
        E.catchTag('TimeoutException', () =>
          E.fail(
            AdministrationError.fromError(
              new Error('Admin status check timeout after 5 seconds'),
              'Admin status verification timeout'
            )
          )
        ),
        E.asVoid,
        E.tapError((error) => {
          adminStatusState = 'error';
          errorMessage = error.message;
          return E.logError(`❌ Failed admin status check: ${error.message}`);
        })
      );
    });

  /**
   * Get current admin status state
   */
  const getAdminStatus = (): AdminStatusState => adminStatusState;

  /**
   * Check if user is admin (only returns true if verified as admin)
   */
  const isAdmin = (): boolean => adminStatusState === 'admin';

  /**
   * Check if verification is in progress
   */
  const isChecking = (): boolean => adminStatusState === 'checking';

  /**
   * Check if there was an error in verification
   */
  const hasError = (): boolean => adminStatusState === 'error';

  return {
    verifyAdminStatus,
    ensureAdminStatusChecked,
    getAdminStatus,
    isAdmin,
    isChecking,
    hasError
  };
});

/**
 * Live implementation layer for the admin status service
 */
export const AdminStatusServiceLive: Layer.Layer<AdminStatusServiceTag> = Layer.effect(
  AdminStatusServiceTag,
  makeAdminStatusService
);

/**
 * Composable for reactive admin status in components
 * Similar to connection guard but for admin status
 */
export function useAdminStatusCheck() {
  return {
    get adminStatusState() {
      return adminStatusState;
    },
    get isAdmin() {
      return adminStatusState === 'admin';
    },
    get isChecking() {
      return adminStatusState === 'checking';
    },
    get hasError() {
      return adminStatusState === 'error';
    },
    get errorMessage() {
      return errorMessage;
    },
    get isReady() {
      return adminStatusState === 'admin' || adminStatusState === 'non-admin';
    }
  };
}
