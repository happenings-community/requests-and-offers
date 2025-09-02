import { onMount } from 'svelte';
import usersStore from '$lib/stores/users.store.svelte';
import administrationStore from '$lib/stores/administration.store.svelte';
import { runEffect } from '$lib/utils/effect';
import type { UIUser } from '$lib/types/ui';

export type UserAccessStatus =
  | 'no-profile'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended'
  | 'unknown';

export type UserAccessResult = {
  hasAccess: boolean;
  status: UserAccessStatus;
  user: UIUser | null;
  isAdmin: boolean;
};

export type UserAccessAction = {
  label: string;
  href?: string;
  action?: string;
  variant: string;
  primary?: boolean;
};

export type UseUserAccessGuardOptions = {
  resourceType?: string;
  allowedStatuses?: UserAccessStatus[];
  autoCheck?: boolean;
};

export type UseUserAccessGuard = {
  // State
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly accessResult: UserAccessResult | null;
  readonly hasAccess: boolean;
  readonly status: UserAccessStatus;
  readonly currentUser: UIUser | null;
  readonly isAdmin: boolean;

  // Computed values
  readonly title: string;
  readonly message: string;
  readonly actions: UserAccessAction[];
  readonly tip: string | null;
  readonly adminGuidance: string | null;

  // Methods
  checkAccess: () => Promise<void>;
  retry: () => Promise<void>;
  reset: () => void;
};

/**
 * User Access Guard Composable
 *
 * Provides reactive user access checking with loading states,
 * error handling, and contextual guidance.
 *
 * @param options Configuration options
 * @returns UseUserAccessGuard interface
 */
export function useUserAccessGuard(options: UseUserAccessGuardOptions = {}): UseUserAccessGuard {
  const { resourceType = 'content', allowedStatuses = ['approved'], autoCheck = true } = options;

  // ========================================================================
  // STATE
  // ========================================================================

  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let accessResult = $state<UserAccessResult | null>(null);

  // ========================================================================
  // DERIVED STATE
  // ========================================================================

  const hasAccess = $derived(
    accessResult?.hasAccess ||
      (accessResult?.status && allowedStatuses.includes(accessResult.status)) ||
      accessResult?.isAdmin ||
      false
  );

  const status = $derived(accessResult?.status || 'unknown');
  const currentUser = $derived(accessResult?.user || null);
  const isAdmin = $derived(accessResult?.isAdmin || false);

  // Dynamic title based on status
  const title = $derived(getUserAccessTitle(status, resourceType));

  // Dynamic message based on status
  const message = $derived(getUserAccessMessage(status, resourceType));

  // Actions based on user status
  const actions = $derived(getUserAccessActions(status, isAdmin));

  // Helpful tip
  const tip = $derived(getUserAccessTip(status, resourceType));

  // Admin guidance
  const adminGuidance = $derived(getAdminGuidance(status, isAdmin));

  // ========================================================================
  // HELPER FUNCTIONS
  // ========================================================================

  function getUserAccessTitle(status: UserAccessStatus, resourceType: string): string {
    switch (status) {
      case 'no-profile':
        return 'Profile Required';
      case 'pending':
        return 'Approval Pending';
      case 'rejected':
        return 'Access Denied';
      case 'suspended':
        return 'Account Suspended';
      case 'unknown':
        return 'Access Issue';
      default:
        return `Access Required for ${resourceType}`;
    }
  }

  function getUserAccessMessage(status: UserAccessStatus, resourceType: string): string {
    switch (status) {
      case 'no-profile':
        return `You need to create a user profile to view and create ${resourceType}. Creating a profile allows you to participate in the community and share your ${resourceType}.`;

      case 'pending':
        return `Your profile is awaiting administrator approval. While waiting, you can browse the community and view other users' profiles, but you cannot create or view ${resourceType} yet.`;

      case 'rejected':
        return `Your profile application was not approved. Please contact an administrator if you believe this was an error, or review the community guidelines and apply again.`;

      case 'suspended':
        return `Your account has been suspended. Please contact an administrator for more information about your account status.`;

      case 'unknown':
        return `There was an issue checking your access permissions. Please try refreshing the page or contact an administrator if the problem persists.`;

      default:
        return `Access verification failed for ${resourceType}. Please try again or contact support.`;
    }
  }

  function getUserAccessActions(status: UserAccessStatus, isAdmin: boolean): UserAccessAction[] {
    const actions: UserAccessAction[] = [];

    switch (status) {
      case 'no-profile':
        actions.push(
          {
            label: 'Create Profile',
            href: '/user/create',
            variant: 'variant-filled-primary',
            primary: true
          },
          { label: 'Browse Community', href: '/users', variant: 'variant-soft' }
        );
        break;

      case 'pending':
        actions.push(
          { label: 'Check Status', action: 'retry', variant: 'variant-soft' },
          { label: 'View My Profile', href: '/user', variant: 'variant-soft' },
          { label: 'Browse Community', href: '/users', variant: 'variant-soft' }
        );
        break;

      case 'rejected':
      case 'suspended':
        actions.push(
          { label: 'View My Profile', href: '/user', variant: 'variant-soft' },
          { label: 'Browse Community', href: '/users', variant: 'variant-soft' }
        );
        if (isAdmin) {
          actions.push({ label: 'Admin Panel', href: '/admin', variant: 'variant-filled-warning' });
        }
        break;

      case 'unknown':
        actions.push(
          { label: 'Try Again', action: 'retry', variant: 'variant-filled-primary', primary: true },
          { label: 'Go Home', href: '/', variant: 'variant-soft' }
        );
        break;
    }

    return actions;
  }

  function getUserAccessTip(status: UserAccessStatus, resourceType: string): string | null {
    switch (status) {
      case 'no-profile':
        return `💡 You can still browse the community and view other users without creating a profile. Creating a profile unlocks the ability to create and view ${resourceType}.`;

      case 'pending':
        return '💡 Approval times vary. While waiting, feel free to explore the community and familiarize yourself with existing content.';

      case 'rejected':
        return '💡 If you believe your application was rejected in error, you can contact administrators through the community or create a new application.';

      case 'suspended':
        return '💡 Account suspensions are usually temporary. Contact administrators for information about restoring your account.';

      default:
        return null;
    }
  }

  function getAdminGuidance(status: UserAccessStatus, isAdmin: boolean): string | null {
    if (!isAdmin) return null;

    switch (status) {
      case 'pending':
        return 'As an administrator, you can approve or reject pending user applications from the Admin Users panel.';

      case 'rejected':
      case 'suspended':
        return 'As an administrator, you can modify user statuses and permissions from the Admin Users panel.';

      default:
        return null;
    }
  }

  function determineUserStatus(user: UIUser | null): UserAccessStatus {
    if (!user) return 'no-profile';

    const statusType = user.status?.status_type;

    switch (statusType) {
      case 'pending':
        return 'pending';
      case 'accepted': // Use 'accepted' to match existing isUserApproved function
        return 'approved';
      case 'rejected':
        return 'rejected';
      default:
        if (statusType?.includes('suspended')) {
          return 'suspended';
        }
        return 'unknown';
    }
  }

  // ========================================================================
  // METHODS
  // ========================================================================

  async function checkAccess(): Promise<void> {
    try {
      isLoading = true;
      error = null;

      // Check admin status first
      await runEffect(administrationStore.checkIfAgentIsAdministrator());
      const adminStatus = administrationStore.agentIsAdministrator;

      // Get current user - if still loading, try refreshing first
      let user = usersStore.currentUser;

      // If no user found and users store is not loading, try refreshing user data
      if (!user && !usersStore.loading) {
        console.log('🔄 UserAccessGuard: No user found, refreshing user data...');
        try {
          await runEffect(usersStore.refresh());
          user = usersStore.currentUser;
        } catch (refreshError) {
          console.warn('⚠️ UserAccessGuard: Failed to refresh user data:', refreshError);
          // Continue with null user - will show no-profile state
        }
      }

      if (!user) {
        accessResult = {
          hasAccess: false,
          status: 'no-profile',
          user: null,
          isAdmin: adminStatus
        };
        return;
      }

      const userStatus = determineUserStatus(user);
      const hasUserAccess = userStatus === 'approved' || adminStatus; // Admins can always access

      accessResult = {
        hasAccess: hasUserAccess,
        status: userStatus,
        user,
        isAdmin: adminStatus
      };
    } catch (err) {
      console.error('Failed to check user access:', err);
      error = 'Failed to verify access permissions';
      accessResult = {
        hasAccess: false,
        status: 'unknown',
        user: null,
        isAdmin: false
      };
    } finally {
      isLoading = false;
    }
  }

  async function retry(): Promise<void> {
    await checkAccess();
  }

  function reset(): void {
    isLoading = false;
    error = null;
    accessResult = null;
  }

  // ========================================================================
  // LIFECYCLE
  // ========================================================================

  // Auto-check on mount if enabled
  if (autoCheck) {
    onMount(() => {
      checkAccess();
    });
  }

  // ========================================================================
  // RETURN INTERFACE
  // ========================================================================

  return {
    // State (readonly)
    get isLoading() {
      return isLoading;
    },
    get error() {
      return error;
    },
    get accessResult() {
      return accessResult;
    },
    get hasAccess() {
      return hasAccess;
    },
    get status() {
      return status;
    },
    get currentUser() {
      return currentUser;
    },
    get isAdmin() {
      return isAdmin;
    },

    // Computed values (readonly)
    get title() {
      return title;
    },
    get message() {
      return message;
    },
    get actions() {
      return actions;
    },
    get tip() {
      return tip;
    },
    get adminGuidance() {
      return adminGuidance;
    },

    // Methods
    checkAccess,
    retry,
    reset
  };
}
