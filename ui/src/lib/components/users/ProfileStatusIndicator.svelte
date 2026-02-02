<script lang="ts">
  import { goto } from '$app/navigation';
  import usersStore from '$lib/stores/users.store.svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    showText?: boolean;
    showIcon?: boolean;
    compact?: boolean;
    position?: 'navbar' | 'sidebar' | 'card';
    children?: Snippet;
  };

  const {
    showText = true,
    showIcon = true,
    compact = false,
    position = 'navbar',
    children
  }: Props = $props();

  // Get profile state with user-friendly display
  const profileInfo = $derived(() => {
    const { currentUser, loading } = usersStore;

    if (loading) {
      return {
        status: 'loading',
        text: 'Loading...',
        color: 'text-surface-400',
        bgColor: 'bg-surface-100',
        icon: '⏳',
        action: null
      };
    }

    if (!currentUser) {
      return {
        status: 'missing',
        text: compact ? 'Profile' : 'Create Profile',
        color: 'text-info-600',
        bgColor: 'bg-info-100',
        icon: '👤',
        action: '/user/create'
      };
    }

    const status = currentUser.status?.status_type;

    switch (status) {
      case 'pending':
        return {
          status: 'pending',
          text: compact ? 'Pending' : `${currentUser.name || 'User'} (Pending)`,
          color: 'text-warning-600',
          bgColor: 'bg-warning-100',
          icon: '⏱️',
          action: '/support'
        };
      case 'accepted':
        return {
          status: 'accepted',
          text: compact
            ? currentUser.nickname || currentUser.name || 'User'
            : `${currentUser.name || 'User'} ✓`,
          color: 'text-success-600',
          bgColor: 'bg-success-100',
          icon: '✓',
          action: '/user/profile'
        };
      case 'rejected':
        return {
          status: 'rejected',
          text: compact ? 'Rejected' : `${currentUser.name || 'User'} (Rejected)`,
          color: 'text-error-600',
          bgColor: 'bg-error-100',
          icon: '✕',
          action: '/support'
        };
      case 'suspended temporarily':
        return {
          status: 'suspended_temporarily',
          text: compact ? 'Suspended' : `${currentUser.name || 'User'} (Suspended)`,
          color: 'text-warning-600',
          bgColor: 'bg-warning-100',
          icon: '⚠️',
          action: '/help/profile-status'
        };
      case 'suspended indefinitely':
        return {
          status: 'suspended_indefinitely',
          text: compact ? 'Suspended' : `${currentUser.name || 'User'} (Suspended)`,
          color: 'text-error-600',
          bgColor: 'bg-error-100',
          icon: '🚫',
          action: '/help/profile-status'
        };
      default:
        return {
          status: 'unknown',
          text: compact ? 'Unknown' : `${currentUser.name || 'User'} (?)`,
          color: 'text-surface-600',
          bgColor: 'bg-surface-100',
          icon: '❓',
          action: '/help'
        };
    }
  });

  // Style classes based on position and compactness
  const containerClasses = $derived(() => {
    const base = 'inline-flex items-center gap-1.5 transition-all duration-200';
    const size = compact ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5';
    const rounded = compact ? 'rounded-md' : 'rounded-lg';
    const cursor = profileInfo().action ? 'cursor-pointer hover:opacity-80' : 'cursor-default';

    return `${base} ${size} ${rounded} ${profileInfo().bgColor} ${profileInfo().color} ${cursor}`;
  });

  const iconClasses = $derived(() => {
    return compact ? 'text-xs' : 'text-sm';
  });

  const textClasses = $derived(() => {
    const weight = profileInfo().status === 'accepted' ? 'font-medium' : 'font-normal';
    const truncate = position === 'navbar' ? 'max-w-24 truncate' : '';
    return `${weight} ${truncate}`;
  });

  function handleClick() {
    const action = profileInfo().action;
    if (action) {
      goto(action);
    }
  }

  // Tooltip text for compact mode
  const tooltipText = $derived(() => {
    if (!compact) return '';

    const { currentUser } = usersStore;
    if (!currentUser) return 'Create your profile to get started';

    const status = currentUser.status?.status_type;
    switch (status) {
      case 'pending':
        return 'Your profile is pending approval';
      case 'accepted':
        return `${currentUser.name || 'User'} - Profile active`;
      case 'rejected':
        return 'Your profile has been rejected';
      case 'suspended temporarily':
        return 'Your profile is temporarily suspended';
      case 'suspended indefinitely':
        return 'Your profile is suspended';
      default:
        return 'Profile status unknown';
    }
  });
</script>

{#if children}
  <!-- Custom slot mode -->
  <div 
    class={containerClasses} 
    onclick={handleClick} 
    title={compact ? tooltipText() : ''}
    role="button"
    tabindex={profileInfo().action ? 0 : -1}
    onkeydown={(e) => {
      if ((e.key === 'Enter' || e.key === ' ') && profileInfo().action) {
        e.preventDefault();
        handleClick();
      }
    }}
  >
    {@render children()}
  </div>
{:else}
  <!-- Default indicator mode -->
  <div
    class={containerClasses}
    onclick={handleClick}
    title={compact ? tooltipText() : ''}
    role="button"
    tabindex={profileInfo().action ? 0 : -1}
    onkeydown={(e) => {
      if ((e.key === 'Enter' || e.key === ' ') && profileInfo().action) {
        e.preventDefault();
        handleClick();
      }
    }}
  >
    {#if showIcon}
      <span class={iconClasses}>{profileInfo().icon}</span>
    {/if}

    {#if showText}
      <span class={textClasses}>
        {profileInfo().text}
      </span>
    {/if}

    <!-- Status indicator dot for accepted users (shows they're fully active) -->
    {#if profileInfo().status === 'accepted' && !compact}
      <span class="h-2 w-2 rounded-full bg-success-500" title="Profile active"></span>
    {/if}
  </div>
{/if}

<!-- Compact navigation version (merged indicator) -->
{#if position === 'navbar' && compact}
  <div class="relative inline-flex items-center" title={tooltipText()}>
    <div
      class={containerClasses}
      onclick={handleClick}
      role="button"
      tabindex={profileInfo().action ? 0 : -1}
      onkeydown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && profileInfo().action) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {#if showIcon}
        <span class={iconClasses}>{profileInfo().icon}</span>
      {/if}

      {#if showText}
        <span class={textClasses}>
          {profileInfo().text}
        </span>
      {/if}
    </div>

    <!-- Status indicator for quick visual feedback -->
    {#if profileInfo().status === 'pending'}
      <span
        class="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-warning-500"
        title="Pending approval"
      ></span>
    {:else if profileInfo().status === 'accepted'}
      <span
        class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-success-500"
        title="Profile active"
      ></span>
    {:else if ['rejected', 'suspended_temporarily', 'suspended_indefinitely'].includes(profileInfo().status)}
      <span class="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-error-500" title="Profile issue"
      ></span>
    {/if}
  </div>
{/if}
