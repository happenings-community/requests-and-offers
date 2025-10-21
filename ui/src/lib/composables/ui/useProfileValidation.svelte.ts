import usersStore from '$lib/stores/users.store.svelte';

export type ProfileStatus =
  | 'missing'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'suspended_temporarily'
  | 'suspended_indefinitely'
  | 'unknown'
  | 'loading';

export type ProfileValidationResult = {
  status: ProfileStatus;
  canBrowse: boolean;
  canCreate: boolean;
  canJoinOrganizations: boolean;
  canManageAdmin: boolean;
  message: string;
  requiresAction: boolean;
  suggestedAction?: {
    type: 'create_profile' | 'contact_admin' | 'view_profile' | 'wait_approval';
    label: string;
    href?: string;
    description?: string;
  };
};

export type UseProfileValidationOptions = {
  autoRefresh?: boolean;
  refreshInterval?: number;
};

export function useProfileValidation(options: UseProfileValidationOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000 } = options;

  // Reactive validation result
  const validationResult = $derived(() => {
    const { currentUser, loading } = usersStore;

    if (loading) {
      return {
        status: 'loading',
        canBrowse: false,
        canCreate: false,
        canJoinOrganizations: false,
        canManageAdmin: false,
        message: 'Checking profile status...',
        requiresAction: false
      };
    }

    if (!currentUser) {
      return {
        status: 'missing',
        canBrowse: false,
        canCreate: false,
        canJoinOrganizations: false,
        canManageAdmin: false,
        message: 'You need to create a profile to participate in the community.',
        requiresAction: true,
        suggestedAction: {
          type: 'create_profile',
          label: 'Create Profile',
          href: '/user/create',
          description: 'Create your profile to start making requests and offers'
        }
      };
    }

    const status = currentUser.status?.status_type;
    const userName = currentUser.name || currentUser.nickname || 'User';

    switch (status) {
      case 'pending':
        return {
          status: 'pending',
          canBrowse: true,
          canCreate: false,
          canJoinOrganizations: false,
          canManageAdmin: false,
          message: `Hi ${userName}! Your profile is pending approval from administrators.`,
          requiresAction: true,
          suggestedAction: {
            type: 'wait_approval',
            label: 'Contact Admin',
            href: '/support',
            description: 'Your profile is under review. This typically takes 24-48 hours.'
          }
        };

      case 'accepted':
        return {
          status: 'accepted',
          canBrowse: true,
          canCreate: true,
          canJoinOrganizations: true,
          canManageAdmin: currentUser.user_type === 'creator',
          message: `Welcome back, ${userName}! Your profile is active.`,
          requiresAction: false,
          suggestedAction: {
            type: 'view_profile',
            label: 'View Profile',
            href: '/user/profile',
            description: 'Manage your profile information'
          }
        };

      case 'rejected':
        return {
          status: 'rejected',
          canBrowse: false,
          canCreate: false,
          canJoinOrganizations: false,
          canManageAdmin: false,
          message: `Hi ${userName}. Your profile has been rejected by administrators.`,
          requiresAction: true,
          suggestedAction: {
            type: 'contact_admin',
            label: 'Contact Support',
            href: '/support',
            description: 'Please reach out to understand why your profile was rejected.'
          }
        };

      case 'suspended temporarily':
        return {
          status: 'suspended_temporarily',
          canBrowse: true,
          canCreate: false,
          canJoinOrganizations: false,
          canManageAdmin: false,
          message: `Hi ${userName}. Your profile has been temporarily suspended.`,
          requiresAction: true,
          suggestedAction: {
            type: 'contact_admin',
            label: 'Learn More',
            href: '/help/profile-status',
            description: 'Your account is temporarily suspended. Contact support for details.'
          }
        };

      case 'suspended indefinitely':
        return {
          status: 'suspended_indefinitely',
          canBrowse: false,
          canCreate: false,
          canJoinOrganizations: false,
          canManageAdmin: false,
          message: `Hi ${userName}. Your profile has been permanently suspended.`,
          requiresAction: true,
          suggestedAction: {
            type: 'contact_admin',
            label: 'Get Help',
            href: '/help',
            description: 'Your account is suspended. Please contact support if this is an error.'
          }
        };

      default:
        return {
          status: 'unknown',
          canBrowse: false,
          canCreate: false,
          canJoinOrganizations: false,
          canManageAdmin: false,
          message: `Hi ${userName}. Your profile status is unknown.`,
          requiresAction: true,
          suggestedAction: {
            type: 'contact_admin',
            label: 'Get Help',
            href: '/help',
            description: 'There may be an issue with your profile. Please contact support.'
          }
        };
    }
  });

  // Helper functions for specific validations
  const canCreateOffers = $derived(validationResult().canCreate);

  const canCreateRequests = $derived(validationResult().canCreate);

  const canBrowseOffers = $derived(validationResult().canBrowse);

  const canBrowseRequests = $derived(validationResult().canBrowse);

  const needsProfileCreation = $derived(validationResult().status === 'missing');

  const isProfileActive = $derived(validationResult().status === 'accepted');

  const isProfilePending = $derived(validationResult().status === 'pending');

  const hasProfileIssues = $derived(
    ['rejected', 'suspended_temporarily', 'suspended_indefinitely', 'unknown'].includes(
      validationResult().status
    )
  );

  // Action functions
  const refreshProfile = () => {
    return usersStore.refreshCurrentUser();
  };

  const navigateToProfileAction = () => {
    const action = validationResult().suggestedAction;
    if (action?.href) {
      window.location.href = action.href;
    }
  };

  // Auto-refresh logic
  let refreshIntervalId: ReturnType<typeof setInterval> | null = null;

  const startAutoRefresh = () => {
    if (autoRefresh && !refreshIntervalId) {
      refreshIntervalId = setInterval(() => {
        refreshProfile();
      }, refreshInterval);
    }
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
      refreshIntervalId = null;
    }
  };

  // Start auto-refresh if enabled
  $effect(() => {
    if (autoRefresh) {
      startAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  });

  return {
    // Reactive state
    validationResult,
    canCreateOffers,
    canCreateRequests,
    canBrowseOffers,
    canBrowseRequests,
    needsProfileCreation,
    isProfileActive,
    isProfilePending,
    hasProfileIssues,

    // Methods
    refreshProfile,
    navigateToProfileAction,
    startAutoRefresh,
    stopAutoRefresh,

    // Cleanup
    cleanup: stopAutoRefresh
  };
}
