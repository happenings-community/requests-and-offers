<script lang="ts">
  import type { UIUser, UIOrganization } from '$lib/types/ui';
  import { getUserPictureUrl, getOrganizationLogoUrl } from '$lib/utils';
  import { Avatar, getToastStore } from '@skeletonlabs/skeleton';

  type Props = {
    user: UIUser | null;
    organization: UIOrganization | null;
    listingType?: 'request' | 'offer';
    listingTitle?: string;
  };

  // Props
  let {
    user = null,
    organization = null,
    listingType = 'request',
    listingTitle = ''
  }: Props = $props();

  const toastStore = getToastStore();

  // Computed values
  const userPictureUrl = $derived(user ? getUserPictureUrl(user) : null);
  const organizationLogoUrl = $derived(organization ? getOrganizationLogoUrl(organization) : null);

  // Copy to clipboard functionality with better visual feedback
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

<article class="hcron-modal">
  <!-- Modal Header -->
  <header class="mb-6 space-y-4 text-center">
    <h4 class="h4 font-semibold text-white">🤝 Interested in this {listingType}?</h4>
    {#if listingTitle}
      <p class="italic text-surface-300">"{listingTitle}"</p>
    {/if}
    <p class="text-sm text-surface-400">Get in touch directly with the contact information below</p>
  </header>

  {#if organization}
    <!-- Organization Contact -->
    <section class="space-y-4">
      <div class="card variant-soft bg-surface-600 p-4">
        <div class="flex items-center gap-4">
          <Avatar src={organizationLogoUrl!} initials={organization.name.charAt(0).toUpperCase()} />
          <div class="flex-1">
            <h5 class="h5 font-medium text-white">{organization.name}</h5>
            <p class="text-sm text-surface-300">Organization</p>
          </div>
        </div>
      </div>

      <!-- Email -->
      <div class="card variant-soft bg-surface-600 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <span class="text-xl">📧</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-surface-300">Email</p>
              <p class="break-all font-mono text-sm text-white">{organization.email}</p>
            </div>
          </div>
          <button
            class="variant-filled-secondary btn btn-sm ml-2"
            onclick={() => copyToClipboard(organization.email, 'Organization email')}
          >
            📋 Copy
          </button>
        </div>
      </div>

      {#if organization.urls && organization.urls.length > 0}
        <!-- Website -->
        <div class="card variant-soft bg-surface-600 p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <span class="text-xl">🌐</span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-surface-300">Website</p>
                <a
                  href={organization.urls[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="break-all text-sm text-secondary-400 transition-colors hover:text-secondary-300"
                >
                  {organization.urls[0]}
                </a>
              </div>
            </div>
            <button
              class="variant-filled-secondary btn btn-sm ml-2"
              onclick={() => copyToClipboard(organization.urls[0], 'Website URL')}
            >
              📋 Copy
            </button>
          </div>
        </div>
      {/if}
    </section>
  {:else if user}
    <!-- User Contact -->
    <section class="space-y-4">
      <div class="card variant-soft bg-surface-600 p-4">
        <div class="flex items-center gap-4">
          <Avatar src={userPictureUrl!} initials={user.name.charAt(0).toUpperCase()} />
          <div class="flex-1">
            <h5 class="h5 font-medium text-white">{user.name}</h5>
            {#if user.nickname}
              <p class="text-sm text-surface-300">@{user.nickname}</p>
            {/if}
          </div>
        </div>
      </div>

      {#if user.email}
        <!-- Email -->
        <div class="card variant-soft bg-surface-600 p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <span class="text-xl">📧</span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-surface-300">Email</p>
                <p class="break-all font-mono text-sm text-white">{user.email}</p>
              </div>
            </div>
            <button
              class="variant-filled-secondary btn btn-sm ml-2"
              onclick={() => copyToClipboard(user.email, 'Email')}
            >
              📋 Copy
            </button>
          </div>
        </div>
      {/if}

      {#if user.phone}
        <!-- Phone -->
        <div class="card variant-soft bg-surface-600 p-4">
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-center gap-3">
              <span class="text-xl">📞</span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-surface-300">Phone</p>
                <p class="font-mono text-sm text-white">{user.phone}</p>
              </div>
            </div>
            <button
              class="variant-filled-secondary btn btn-sm ml-2"
              onclick={() => copyToClipboard(user.phone!, 'Phone number')}
            >
              📋 Copy
            </button>
          </div>
        </div>
      {/if}

      {#if user.time_zone}
        <!-- Time Zone -->
        <div class="card variant-soft bg-surface-600 p-4">
          <div class="flex items-center gap-3">
            <span class="text-xl">🌍</span>
            <div>
              <p class="text-sm font-medium text-surface-300">Time Zone</p>
              <p class="text-sm text-white">{user.time_zone}</p>
            </div>
          </div>
        </div>
      {/if}
    </section>
  {/if}

  {#if user?.phone || organization?.email || user?.email}
    <div class="card variant-soft mt-6 bg-primary-500/20 p-4">
      <div class="flex items-start gap-3">
        <span class="text-xl">💬</span>
        <div>
          <p class="font-medium text-white">Preferred Contact Method:</p>
          <p class="mt-1 text-sm text-surface-300">
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
          </p>
        </div>
      </div>
    </div>
  {/if}

  <footer class="mt-6 text-center">
    <p class="text-sm text-surface-400">✨ Please contact directly using the information above</p>
  </footer>
</article>
