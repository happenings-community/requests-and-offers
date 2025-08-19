<script lang="ts">
  import { page } from '$app/state';
  import { Avatar, getModalStore } from '@skeletonlabs/skeleton';
  import ActionBar from '$lib/components/shared/ActionBar.svelte';
  import type { UIOrganization, UIStatus } from '$lib/types/ui';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { AdministrationEntity, type StatusInDHT } from '$lib/types/holochain';
  import { decodeRecords } from '$lib/utils';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import { Effect as E } from 'effect';

  const modalStore = getModalStore();
  const { organization } = $modalStore[0].meta as { organization: UIOrganization };

  let suspensionDate = $state('');
  let organizationStatus: UIStatus | null = $state(null);
  const isAdminPage = $state(page.url.pathname.startsWith('/admin'));

  let organizationPictureUrl: string = $derived(
    organization?.logo
      ? URL.createObjectURL(new Blob([new Uint8Array(organization.logo)]))
      : '/default_avatar.webp'
  );

  $effect(() => {
    if (organization) {
      E.runPromise(
        administrationStore.getLatestStatusForEntity(
          organization.original_action_hash!,
          AdministrationEntity.Organizations
        )
      ).then((status: UIStatus | null) => {
        organizationStatus = status;
      });
    }
  });
</script>

<article class="hcron-modal">
  {#if organization}
    {#if isAdminPage}
      <!-- Admin Actions -->
      <div class="mb-6">
        <ActionBar entity={organization} />
      </div>
    {/if}

    <!-- Header Section -->
    <div class="mb-6 flex flex-col items-center gap-6">
      <div class="shrink-0">
        <Avatar
          src={organizationPictureUrl}
          width="w-32"
          initials={organization.name.slice(0, 2)}
          background="bg-surface-100-800-token"
        />
      </div>
      <div class="flex min-w-0 flex-col items-center">
        <h2 class="h2 mb-1 truncate font-bold">{organization.name}</h2>
        {#if organization.description}
          <div class="text-center">
            <span class="text-xs font-medium text-surface-300 uppercase">Vision/Mission</span>
            <p class="leading-relaxed text-surface-100 mt-1">{organization.description}</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Status Section (Admin Only) -->
    {#if isAdminPage}
      <div class="mb-6 p-4">
        <h3 class="h4 mb-3 font-semibold">Status Information</h3>
        <div class="space-y-3">
          <div class="flex items-center">
            <span class="min-w-[120px] font-medium">Status:</span>
            <span
              class="chip"
              class:variant-ghost-primary={organization!.status?.status_type === 'pending'}
              class:variant-ghost-error={organization!.status?.status_type === 'rejected' ||
                organization!.status?.status_type === 'suspended indefinitely'}
              class:variant-ghost-success={organization!.status?.status_type === 'accepted'}
              class:variant-ghost-warning={organization!.status?.status_type ===
                `suspended temporarily`}
            >
              {organizationStatus?.status_type || 'Active'}
            </span>
          </div>
          {#if suspensionDate}
            <div class="flex items-center">
              <span class="min-w-[120px] font-medium">Suspended until:</span>
              <span class="text-error-500">{suspensionDate}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Contact Information -->
    <div class="space-y-6">
      <div class="rounded-lg border-2 border-slate-400 p-4">
        <h3 class="h4 mb-3 font-semibold">Contact Information</h3>
        <div class="space-y-3">
          {#if organization.full_legal_name}
            <div class="flex items-center">
              <span class="min-w-[120px] font-medium">Legal Name:</span>
              <span>{organization.full_legal_name}</span>
            </div>
          {/if}
          <div class="flex items-center">
            <span class="min-w-[120px] font-medium">Email:</span>
            <span class="cursor-pointer text-tertiary-500 hover:text-tertiary-600 hover:underline">
              {organization.email}
            </span>
          </div>
          {#if organization.location}
            <div class="flex items-center">
              <span class="min-w-[120px] font-medium">Location:</span>
              <span>{organization.location}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Links Section -->
      {#if organization.urls?.length}
        <div class="rounded-lg border-2 border-slate-400 p-4">
          <h3 class="h4 mb-3 font-semibold">Links & Resources</h3>
          <div class="space-y-2">
            {#each organization.urls as url}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                class="block truncate text-tertiary-500 transition-colors hover:text-tertiary-600 hover:underline"
              >
                {url}
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="py-8 text-center text-surface-500">
      <p>No organization details available</p>
    </div>
  {/if}

  <!-- Footer -->
  <div class="mt-6 space-x-2">
    <button
      class="variant-filled-secondary btn"
      onclick={() => {
        modalStore.close();
        if (organization.original_action_hash) {
          goto(`/organizations/${encodeHashToBase64(organization.original_action_hash)}`);
        }
      }}
    >
      View Full Details
    </button>
    <button class="variant-filled-surface btn" onclick={() => modalStore.close()}> Close </button>
  </div>
</article>
