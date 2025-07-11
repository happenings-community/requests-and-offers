<script lang="ts">
  import { page } from '$app/state';
  import { Avatar, getModalStore } from '@skeletonlabs/skeleton';
  import { onMount } from 'svelte';
  import ActionBar from '$lib/components/shared/ActionBar.svelte';
  import type { UIUser, UIStatus } from '$lib/types/ui';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { AdministrationEntity, type StatusInDHT } from '$lib/types/holochain';
  import { decodeRecords } from '$lib/utils';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import { Effect as E } from 'effect';

  type Props = {
    user: UIUser;
  };

  const modalStore = getModalStore();
  const { user }: Props = $modalStore[0].meta;

  let suspensionDate = $state('');
  let userStatus: UIStatus | null = $state(null);

  let userPictureUrl: string = $derived(
    user?.picture
      ? URL.createObjectURL(new Blob([new Uint8Array(user.picture)]))
      : '/default_avatar.webp'
  );

  onMount(() => {
    async function fetchDashboardData() {
      if (!user.original_action_hash) return;

      E.runPromise(
        administrationStore.getLatestStatusForEntity(
          user.original_action_hash!,
          AdministrationEntity.Users
        )
      ).then((status: UIStatus | null) => {
        userStatus = status;
      });

      if (userStatus?.suspended_until) {
        suspensionDate = new Date(userStatus.suspended_until).toLocaleString();
      }
    }

    fetchDashboardData();
  });
</script>

<article class="hcron-modal">
  {#if user}
    {#if page.url.pathname.startsWith('/admin')}
      <div class="pb-6">
        <ActionBar entity={user} />
      </div>
    {/if}

    <!-- Header Section -->
    <div class="mb-6 flex flex-col items-center gap-6">
      <div onload={() => URL.revokeObjectURL(userPictureUrl)}>
        <Avatar src={userPictureUrl} width="w-32" background="bg-surface-100-800-token" />
      </div>
      <div class="flex min-w-0 flex-col items-center">
        <h2 class="h2 mb-1 truncate font-bold">{user.name}</h2>
        <p class="text-surface-300">@{user.nickname}</p>
        {#if user.bio}
          <p class="text-surface-100 mt-3 text-center leading-relaxed">{user.bio}</p>
        {/if}
      </div>
    </div>

    <!-- Status Section (Admin Only) -->
    {#if page.url.pathname.startsWith('/admin')}
      <div class=" mb-6 p-4">
        <h3 class="h4 mb-3 font-semibold">Status Information</h3>
        <div class="space-y-3">
          <div class="flex items-center">
            <span class="min-w-[120px] font-medium">Status:</span>
            <span
              class="chip"
              class:variant-ghost-primary={user!.status?.status_type === 'pending'}
              class:variant-ghost-error={user!.status?.status_type === 'rejected' ||
                user!.status?.status_type === 'suspended indefinitely'}
              class:variant-ghost-success={user!.status?.status_type === 'accepted'}
              class:variant-ghost-warning={user!.status?.status_type === `suspended temporarily`}
            >
              {userStatus?.status_type || 'Active'}
            </span>
          </div>
          {#if suspensionDate}
            <div class="flex items-center">
              <span class="min-w-[120px] font-medium">Suspended until:</span>
              <span class="text-error-500">{suspensionDate}</span>
            </div>
          {/if}
          {#if userStatus?.status_type?.startsWith('suspended') && userStatus?.reason}
            <div class="flex items-start">
              <span class="min-w-[120px] font-medium">Reason:</span>
              <span class="text-surface-700-200-token">{userStatus.reason}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Basic Information -->
    <div class="space-y-6">
      <div class=" rounded-lg border-2 border-slate-400 p-4">
        <h3 class="h4 mb-3 font-semibold">Basic Information</h3>
        <div class="space-y-3">
          <div class="flex items-center">
            <span class="min-w-[120px] font-medium">Type:</span>
            <span class="chip variant-ghost-secondary">{user.user_type}</span>
          </div>
          <div class="flex items-center">
            <span class=" min-w-[120px] font-medium">Email:</span>
            <span class="text-tertiary-500 hover:text-tertiary-600 cursor-pointer hover:underline"
              >{user.email}</span
            >
          </div>
          {#if user.phone}
            <div class="flex items-center">
              <span class="min-w-[120px] font-medium">Phone:</span>
              <span>{user.phone}</span>
            </div>
          {/if}
        </div>
      </div>

      <!-- Additional Information -->
      {#if user.service_type_hashes?.length || user.time_zone || user.location}
        <div class=" rounded-lg border-2 border-slate-400 p-4">
          <h3 class="h4 mb-3 font-semibold">Additional Information</h3>
          <div class="space-y-3">
            {#if user.service_type_hashes?.length}
              <div class="flex items-start">
                <span class="mt-1 min-w-[120px] font-medium">Service Types:</span>
                <div class="flex flex-wrap gap-2">
                  {#each user.service_type_hashes as serviceTypeHash}
                    <ServiceTypeTag serviceTypeActionHash={serviceTypeHash} />
                  {/each}
                </div>
              </div>
            {/if}
            {#if user.time_zone}
              <div class="flex items-center">
                <span class="min-w-[120px] font-medium">Timezone:</span>
                <span>{user.time_zone}</span>
              </div>
            {/if}
            {#if user.location}
              <div class="flex items-center">
                <span class="min-w-[120px] font-medium">Location:</span>
                <span>{user.location}</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Footer -->
  <div class="mt-6 flex justify-end">
    <button class="btn variant-filled-surface" onclick={() => modalStore.close()}> Close </button>
  </div>
</article>
