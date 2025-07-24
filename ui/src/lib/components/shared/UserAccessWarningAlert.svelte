<script lang="ts">
  import type { UIUser } from '$lib/types/ui';

  type Props = {
    error: string;
    currentUser: UIUser | null;
    onRetry?: () => void;
    resourceType?: string; // 'requests', 'offers', etc.
  };

  let { error, currentUser, onRetry, resourceType = 'content' }: Props = $props();

  // Determine the type of error and appropriate actions
  const errorType = $derived.by(() => {
    if (error?.includes('create a user profile') || !currentUser) {
      return 'no-profile';
    } else if (
      error?.includes('pending approval') ||
      currentUser?.status?.status_type === 'pending'
    ) {
      return 'pending-approval';
    } else if (error?.includes('rejected') || currentUser?.status?.status_type === 'rejected') {
      return 'rejected';
    } else if (
      error?.includes('suspended') ||
      currentUser?.status?.status_type?.includes('suspended')
    ) {
      return 'suspended';
    } else {
      return 'other';
    }
  });
</script>

<div class="alert variant-filled-warning mb-4">
  <div class="flex items-start gap-3">
    <span class="text-xl">⚠️</span>
    <div class="flex-1">
      <p class="mb-2 font-medium">{error}</p>

      <div class="flex flex-wrap gap-2">
        {#if errorType === 'no-profile'}
          <a href="/user/create" class="variant-filled-primary btn btn-sm"> Create Profile </a>
          <a href="/users" class="variant-soft btn btn-sm"> Browse Community </a>
        {:else if errorType === 'pending-approval'}
          {#if onRetry}
            <button class="variant-soft btn btn-sm" onclick={onRetry}> Check Status </button>
          {/if}
          <a href="/users" class="variant-soft btn btn-sm"> Browse Community </a>
          <a href="/user" class="variant-soft btn btn-sm"> View My Profile </a>
        {:else if errorType === 'rejected' || errorType === 'suspended'}
          <a href="/user" class="variant-soft btn btn-sm"> View My Profile </a>
          <a href="/users" class="variant-soft btn btn-sm"> Browse Community </a>
        {:else if onRetry}
          <button class="variant-soft btn btn-sm" onclick={onRetry}> Retry </button>
        {/if}
      </div>

      {#if errorType === 'no-profile'}
        <p class="mt-2 text-sm opacity-75">
          💡 <strong>Tip:</strong> You can browse the community and see other users without creating
          a profile. Creating a profile allows you to view and create {resourceType}.
        </p>
      {:else if errorType === 'pending-approval'}
        <p class="mt-2 text-sm opacity-75">
          💡 <strong>Note:</strong> While waiting for approval, you can still browse the community and
          view other users' profiles.
        </p>
      {/if}
    </div>
  </div>
</div>
