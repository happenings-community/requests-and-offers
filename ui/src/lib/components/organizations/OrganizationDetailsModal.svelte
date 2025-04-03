<script lang="ts">
  import { page } from '$app/stores';
  import { Avatar, getModalStore } from '@skeletonlabs/skeleton';
  import ActionBar from '../ActionBar.svelte';
  import type { UIOrganization, UIStatus } from '@types/ui';
  import administrationStore from '@stores/administration.store.svelte';
  import { AdministrationEntity, type StatusInDHT } from '@types/holochain';
  import { decodeRecords } from '@utils';

  const modalStore = getModalStore();
  const { organization } = $modalStore[0].meta as { organization: UIOrganization };

  let suspensionDate = $state('');
  let organizationStatus: UIStatus | null = $state(null);

  let organizationPictureUrl: string = $derived(
    organization?.logo
      ? URL.createObjectURL(new Blob([new Uint8Array(organization.logo)]))
      : '/default_avatar.webp'
  );

  $effect(() => {
    if (organization) {
      administrationStore
        .getLatestStatusRecordForEntity(
          organization.original_action_hash!,
          AdministrationEntity.Organizations
        )
        .then((record) => {
          organizationStatus = record ? decodeRecords<StatusInDHT>([record])[0] : null;
        });
    }
  });
</script>

<article class="hcron-modal">
  {#if organization}
    {#if $page.url.pathname.startsWith('/admin')}
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
      <div class="min-w-0 flex-1">
        <h2 class="h2 mb-1 truncate font-bold">{organization.name}</h2>
        {#if organization.description}
          <p class="text-surface-100 leading-relaxed">{organization.description}</p>
        {/if}
      </div>
    </div>

    <!-- Status Section (Admin Only) -->
    {#if $page.url.pathname.startsWith('/admin')}
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
          <div class="flex items-center">
            <span class="min-w-[120px] font-medium">Email:</span>
            <span class="text-tertiary-500 hover:text-tertiary-600 cursor-pointer hover:underline">
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
                class="text-tertiary-500 hover:text-tertiary-600 block truncate transition-colors hover:underline"
              >
                {url}
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <div class="text-surface-500 py-8 text-center">
      <p>No organization details available</p>
    </div>
  {/if}

  <!-- Footer -->
  <div class="mt-6 flex justify-end">
    <button class="btn variant-filled-surface" onclick={() => modalStore.close()}> Close </button>
  </div>
</article>
