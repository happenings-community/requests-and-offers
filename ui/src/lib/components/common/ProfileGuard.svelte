<script lang="ts">
  import { goto } from '$app/navigation';
  import usersStore from '$lib/stores/users.store.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    children: Snippet;
    allowBrowsing?: boolean;
    allowCreating?: boolean;
    title?: string;
    description?: string;
    showProfileActions?: boolean;
    redirectToProfile?: boolean;
  };

  const {
    children,
    allowBrowsing = true,
    allowCreating = false,
    title = 'Profile Required',
    description = 'A user profile is required to access this feature.',
    showProfileActions = true,
    redirectToProfile = false
  }: Props = $props();

  // Derived profile state
  const profileState = $derived(() => {
    const { currentUser, loading } = usersStore;

    if (loading) {
      return { state: 'loading', message: 'Checking profile status...', user: null };
    }

    if (!currentUser) {
      return {
        state: 'missing',
        message: 'You need to create a profile to participate in the community.',
        user: null
      };
    }

    const status = currentUser.status?.status_type;

    switch (status) {
      case 'pending':
        return {
          state: 'pending',
          message: 'Your profile is pending approval from administrators.',
          user: currentUser
        };
      case 'accepted':
        return {
          state: 'accepted',
          message: 'Your profile is active and approved.',
          user: currentUser
        };
      case 'rejected':
        return {
          state: 'rejected',
          message: 'Your profile has been rejected. Please contact administrators.',
          user: currentUser
        };
      case 'suspended temporarily':
        return {
          state: 'suspended_temporarily',
          message: 'Your profile has been temporarily suspended.',
          user: currentUser
        };
      case 'suspended indefinitely':
        return {
          state: 'suspended_indefinitely',
          message: 'Your profile has been permanently suspended.',
          user: currentUser
        };
      default:
        return {
          state: 'unknown',
          message: 'Profile status is unknown. Please contact administrators.',
          user: currentUser
        };
    }
  });

  // Check if current action is allowed based on profile state
  const canBrowse = $derived(() => {
    if (!allowBrowsing) return false;
    const state = profileState().state;
    return ['accepted', 'pending'].includes(state);
  });

  const canCreate = $derived(() => {
    if (!allowCreating) return false;
    return profileState().state === 'accepted';
  });

  // Actions based on profile state
  const primaryAction = $derived(() => {
    const state = profileState().state;

    switch (state) {
      case 'missing':
        return {
          label: 'Create Profile',
          href: '/user/create',
          variant: 'variant-filled-primary'
        };
      case 'pending':
        return {
          label: 'Contact Admin',
          href: '/support',
          variant: 'variant-filled-warning'
        };
      case 'rejected':
        return {
          label: 'Contact Support',
          href: '/support',
          variant: 'variant-filled-error'
        };
      case 'suspended_temporarily':
      case 'suspended_indefinitely':
        return {
          label: 'Learn More',
          href: '/help/profile-status',
          variant: 'variant-filled-tertiary'
        };
      case 'unknown':
        return {
          label: 'Get Help',
          href: '/help',
          variant: 'variant-filled-tertiary'
        };
      default:
        return null;
    }
  });

  const secondaryAction = $derived(() => {
    const state = profileState().state;

    if (state === 'missing' || state === 'unknown') {
      return {
        label: 'Browse Community',
        href: '/users',
        variant: 'variant-soft'
      };
    }

    return null;
  });

  function handlePrimaryAction() {
    const action = primaryAction();
    if (action?.href) {
      goto(action.href);
    }
  }

  function handleSecondaryAction() {
    const action = secondaryAction();
    if (action?.href) {
      goto(action.href);
    }
  }

  // Auto-redirect if enabled and profile is missing
  $effect(() => {
    if (redirectToProfile && profileState().state === 'missing') {
      goto('/user/create');
    }
  });
</script>

{#if profileState().state === 'loading'}
  <div class="flex h-64 items-center justify-center">
    <span class="loading loading-spinner text-primary"></span>
    <p class="ml-4">{profileState().message}</p>
  </div>
{:else if canCreate()}
  <!-- Full access - user can create and browse -->
  {@render children()}
{:else if canBrowse()}
  <!-- Browse-only access - show content with restricted features -->
  {@render children()}
{:else}
  <!-- No access - show blocking message -->
  <div class="container mx-auto p-4">
    <div class="card variant-soft-warning mx-auto max-w-2xl p-8 text-center">
      <div class="mb-6">
        {#if profileState().state === 'missing'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="mx-auto mb-4 h-16 w-16 stroke-info-500"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
            />
          </svg>
        {:else if profileState().state === 'pending'}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="mx-auto mb-4 h-16 w-16 stroke-warning-500"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        {:else}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="mx-auto mb-4 h-16 w-16 stroke-error-500"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        {/if}
      </div>

      <h1 class="h1 mb-4">{title}</h1>

      <div class="space-y-4 text-surface-600">
        <p class="text-lg">{description}</p>
        <p class="text-base">{profileState().message}</p>

        {#if profileState().state === 'missing'}
          <div class="bg-surface-100-800-token rounded-lg p-4">
            <h3 class="h4 mb-2 text-info-600">Why create a profile?</h3>
            <p class="text-sm">
              Creating a profile allows you to:
            </p>
            <ul class="mt-2 text-left text-sm">
              <li>• Create and manage requests and offers</li>
              <li>• Join organizations and communities</li>
              <li>• Build your reputation in the network</li>
              <li>• Connect with other community members</li>
            </ul>
          </div>
        {:else if profileState().state === 'pending'}
          <div class="bg-surface-100-800-token rounded-lg p-4">
            <h3 class="h4 mb-2 text-warning-600">What happens next?</h3>
            <p class="text-sm">
              Your profile is currently under review by administrators. This typically takes 24-48 hours.
              You'll be notified once your profile is approved.
            </p>
          </div>
        {:else if ['rejected', 'suspended_temporarily', 'suspended_indefinitely'].includes(profileState().state)}
          <div class="bg-surface-100-800-token rounded-lg p-4">
            <h3 class="h4 mb-2 text-error-600">Need assistance?</h3>
            <p class="text-sm">
              If you believe this is an error or need clarification about your profile status,
              please reach out to our support team for help.
            </p>
          </div>
        {/if}
      </div>

      {#if showProfileActions}
        <div class="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          {#if primaryAction()}
            {#if primaryAction()?.href}
              <a href={primaryAction()?.href} class="{primaryAction()?.variant} btn">
                {primaryAction()?.label}
              </a>
            {:else}
              <button class="{primaryAction()?.variant} btn" onclick={handlePrimaryAction}>
                {primaryAction()?.label}
              </button>
            {/if}
          {/if}

          {#if secondaryAction()}
            {#if secondaryAction()?.href}
              <a href={secondaryAction()?.href} class="{secondaryAction()?.variant} btn">
                {secondaryAction()?.label}
              </a>
            {:else}
              <button class="{secondaryAction()?.variant} btn" onclick={handleSecondaryAction}>
                {secondaryAction()?.label}
              </button>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Show user info if profile exists -->
      {#if profileState().user}
        <div class="mt-6 border-t pt-6">
          <p class="text-sm text-surface-500">
            <strong>Profile:</strong> {profileState().user?.name || 'Unnamed User'}
            {#if profileState().user?.nickname}
              ({profileState().user?.nickname})
            {/if}
          </p>
          <p class="text-sm text-surface-500">
            <strong>Status:</strong> {profileState().user?.status?.status_type || 'Unknown'}
          </p>
        </div>
      {/if}
    </div>
  </div>
{/if}