<script lang="ts">
  import type { UIUser, UIOrganization } from '$lib/types/ui';
  import { getUserPictureUrl, getOrganizationLogoUrl } from '$lib/utils';
  import { getToastStore } from '@skeletonlabs/skeleton';

  type Props = {
    user: UIUser | null;
    organization: UIOrganization | null;
  };

  // Props
  let { user = null, organization = null }: Props = $props();

  const toastStore = getToastStore();

  // Computed values
  const userPictureUrl = $derived(user ? getUserPictureUrl(user) : null);
  const organizationLogoUrl = $derived(organization ? getOrganizationLogoUrl(organization) : null);

  // Copy to clipboard functionality
  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toastStore.trigger({
        message: `${label} copied to clipboard!`,
        background: 'variant-filled-success',
        timeout: 2000
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      toastStore.trigger({
        message: `Failed to copy ${label}`,
        background: 'variant-filled-error',
        timeout: 3000
      });
    }
  }

  // Cleanup blob URLs when component is destroyed
  $effect(() => {
    return () => {
      if (userPictureUrl && userPictureUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(userPictureUrl);
      }
      if (organizationLogoUrl && organizationLogoUrl !== '/default_avatar.webp') {
        URL.revokeObjectURL(organizationLogoUrl);
      }
    };
  });
</script>

<div class="card p-4">
  <h3 class="h4 mb-3 font-semibold">Contact Information</h3>

  {#if organization}
    <!-- Organization Contact -->
    <div class="mb-4">
      <h4 class="font-medium">Organization</h4>
      <div class="mt-2 flex items-center gap-3">
        <div class="avatar h-10 w-10 overflow-hidden rounded-full">
          {#if organizationLogoUrl && organizationLogoUrl !== '/default_avatar.webp'}
            <img
              src={organizationLogoUrl}
              alt={organization.name}
              class="h-full w-full object-cover"
            />
          {:else}
            <div class="flex h-full w-full items-center justify-center bg-secondary-500 text-white">
              <span class="text-sm font-semibold">{organization.name.charAt(0).toUpperCase()}</span>
            </div>
          {/if}
        </div>
        <div class="flex-1">
          <p class="font-semibold">{organization.name}</p>
          <div
            class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-400"
          >
            <span>📧 {organization.email}</span>
            <button
              class="btn-icon btn-icon-sm ml-2 hover:variant-soft-primary"
              onclick={() => copyToClipboard(organization.email, 'Organization email')}
              title="Copy organization email"
            >
              📋
            </button>
          </div>
        </div>
      </div>

      {#if organization.urls && organization.urls.length > 0}
        <div class="mt-1">
          <div class="flex items-center justify-between text-sm">
            <div>
              <span class="font-medium">Website:</span>
              <a
                href={organization.urls[0]}
                target="_blank"
                rel="noopener noreferrer"
                class="ml-1 text-primary-500 hover:underline"
              >
                {organization.urls[0]}
              </a>
            </div>
            <button
              class="btn-icon btn-icon-sm hover:variant-soft-primary"
              onclick={() => copyToClipboard(organization.urls[0], 'Website URL')}
              title="Copy website URL"
            >
              📋
            </button>
          </div>
        </div>
      {/if}
    </div>
  {:else if user}
    <!-- User Contact -->
    <div class="mb-4">
      <h4 class="font-medium">Posted by</h4>
      <div class="mt-2 flex items-center gap-3">
        <div class="avatar h-10 w-10 overflow-hidden rounded-full">
          {#if userPictureUrl && userPictureUrl !== '/default_avatar.webp'}
            <img src={userPictureUrl} alt={user.name} class="h-full w-full object-cover" />
          {:else}
            <div
              class="flex h-full w-full items-center justify-center bg-primary-500 text-white dark:bg-primary-400"
            >
              <span class="text-sm font-semibold">{user.name.charAt(0).toUpperCase()}</span>
            </div>
          {/if}
        </div>
        <div>
          <p class="font-semibold">{user.name}</p>
          {#if user.nickname}
            <p class="text-sm text-surface-600 dark:text-surface-400">@{user.nickname}</p>
          {/if}
        </div>
      </div>

      {#if user.email}
        <div class="mt-2">
          <div class="flex items-center justify-between text-sm">
            <div>
              <span class="font-medium">📧 Email:</span>
              <span class="ml-1">{user.email}</span>
            </div>
            <button
              class="btn-icon btn-icon-sm hover:variant-soft-primary"
              onclick={() => copyToClipboard(user.email, 'Email')}
              title="Copy email address"
            >
              📋
            </button>
          </div>
        </div>
      {/if}

      {#if user.phone}
        <div class="mt-1">
          <div class="flex items-center justify-between text-sm">
            <div>
              <span class="font-medium">📞 Phone:</span>
              <span class="ml-1">{user.phone}</span>
            </div>
            <button
              class="btn-icon btn-icon-sm hover:variant-soft-primary"
              onclick={() => copyToClipboard(user.phone!, 'Phone number')}
              title="Copy phone number"
            >
              📋
            </button>
          </div>
        </div>
      {/if}

      {#if user.time_zone}
        <div class="mt-1">
          <p class="text-sm">
            <span class="font-medium">🌍 Time Zone:</span>
            <span class="ml-1">{user.time_zone}</span>
          </p>
        </div>
      {/if}
    </div>
  {/if}

  {#if user?.phone || organization?.email || user?.email}
    <div class="mt-3 border-t border-surface-200 pt-3 dark:border-surface-700">
      <p class="text-sm">
        <span class="font-medium">💬 Preferred Contact Method:</span>
        <span class="ml-1">
          {#if organization}
            📧 Email
          {:else if user?.phone && user?.email}
            📞 Phone or 📧 Email
          {:else if user?.phone}
            📞 Phone
          {:else if user?.email}
            📧 Email
          {:else}
            Direct contact
          {/if}
        </span>
      </p>
    </div>
  {/if}

  <div class="mt-4 text-sm text-surface-600 dark:text-surface-400">
    <p>✨ Please contact directly through the information provided above.</p>
  </div>
</div>
