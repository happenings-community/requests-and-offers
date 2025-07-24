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

/**
 * Checks the current user's access status for viewing/creating content.
 *
 * @returns Promise<UserAccessResult> - comprehensive user access information
 */
export async function checkUserAccess(): Promise<UserAccessResult> {
  try {
    // Check admin status first
    await runEffect(administrationStore.checkIfAgentIsAdministrator());
    const isAdmin = administrationStore.agentIsAdministrator;

    // The current user is already available as a getter, no need to call a method
    const currentUser = usersStore.currentUser;

    if (!currentUser) {
      return {
        hasAccess: false,
        status: 'no-profile',
        user: null,
        isAdmin
      };
    }

    const status = determineUserStatus(currentUser);
    const hasAccess = status === 'approved' || isAdmin; // Admins can always access

    return {
      hasAccess,
      status,
      user: currentUser,
      isAdmin
    };
  } catch (error) {
    console.error('Failed to check user access:', error);
    return {
      hasAccess: false,
      status: 'unknown',
      user: null,
      isAdmin: false
    };
  }
}

/**
 * Determines the user's status based on their profile data.
 *
 * @param user - the user object
 * @returns UserAccessStatus
 */
export function determineUserStatus(user: UIUser): UserAccessStatus {
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

/**
 * Gets a user-friendly title for the user's access status.
 *
 * @param status - the user access status
 * @param resourceType - type of resource being accessed (requests, offers, etc.)
 * @returns string
 */
export function getUserAccessTitle(
  status: UserAccessStatus,
  resourceType: string = 'content'
): string {
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

/**
 * Gets a detailed explanation message for the user's access status.
 *
 * @param status - the user access status
 * @param resourceType - type of resource being accessed
 * @returns string
 */
export function getUserAccessMessage(
  status: UserAccessStatus,
  resourceType: string = 'content'
): string {
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

/**
 * Gets appropriate action suggestions based on the user's status.
 *
 * @param status - the user access status
 * @param isAdmin - whether the current user is an admin
 * @returns array of action objects
 */
export function getUserAccessActions(
  status: UserAccessStatus,
  isAdmin: boolean = false
): Array<{
  label: string;
  href?: string;
  action?: string;
  variant: string;
  primary?: boolean;
}> {
  const actions = [];

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

/**
 * Gets a helpful tip message based on the user's status.
 *
 * @param status - the user access status
 * @param resourceType - type of resource being accessed
 * @returns string or null
 */
export function getUserAccessTip(
  status: UserAccessStatus,
  resourceType: string = 'content'
): string | null {
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

/**
 * Gets admin-specific guidance when there are user access issues.
 *
 * @param status - the user access status
 * @param isAdmin - whether the current user is an admin
 * @returns string or null
 */
export function getAdminGuidance(status: UserAccessStatus, isAdmin: boolean): string | null {
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
