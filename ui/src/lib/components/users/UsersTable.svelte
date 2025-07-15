<script lang="ts">
  import { Avatar, getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import { page } from '$app/state';
  import type { UIUser } from '$lib/types/ui';
  import { getUserPictureUrl } from '$lib/utils';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import UserDetailsModal from '$lib/components/users/UserDetailsModal.svelte';

  type Props = {
    users: UIUser[];
    title?: string;
  };

  const { users, title }: Props = $props();
  const modalStore = getModalStore();
  const modalComponent: ModalComponent = { ref: UserDetailsModal };

  function handleViewUser(user: UIUser) {
    if (!user.original_action_hash) return;

    if (page.url.pathname.startsWith('/admin')) {
      modalStore.trigger({
        type: 'component',
        component: modalComponent,
        meta: { user }
      });
    } else {
      goto(`/users/${encodeHashToBase64(user.original_action_hash)}`);
    }
  }

  function formatRemainingTimeInDays(remainingTime?: number): string {
    if (!remainingTime) return 'Expired';
    const days = Math.floor(remainingTime / 1000 / 60 / 60 / 24);
    const hours = Math.floor((remainingTime / 1000 / 60 / 60) % 24);
    return `${days}d ${hours}h`;
  }
</script>

<div class="flex flex-col gap-4">
  {#if title}
    <h2 class="h3 text-center font-semibold">{title}</h2>
  {/if}

  {#if users.length > 0}
    <div class="hidden overflow-x-auto md:block">
      <table class="table table-hover w-full drop-shadow-lg">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Avatar</th>
            <th class="whitespace-nowrap">Name</th>
            <th class="whitespace-nowrap">Type</th>
            {#if users.some((user) => user.remaining_time)}
              <th class="whitespace-nowrap">Remaining time</th>
            {/if}
            <th class="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each users as user}
            <tr>
              <td>
                <Avatar src={getUserPictureUrl(user)} alt={`Avatar of ${user.name}`} />
              </td>
              <td class="whitespace-nowrap">{user.name}</td>
              <td class="whitespace-nowrap">
                {#if user.user_type}
                  {user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1)}
                {:else}
                  <span class="text-surface-500">Unknown</span>
                {/if}
              </td>
              {#if user.remaining_time}
                <td class="whitespace-nowrap text-center">
                  {#if user.remaining_time <= 0}
                    <span class="font-bold text-red-600">expired</span>
                  {:else}
                    {formatRemainingTimeInDays(user.remaining_time)}
                  {/if}
                </td>
              {/if}
              <td class="whitespace-nowrap">
                <button class="variant-filled-secondary btn" onclick={() => handleViewUser(user)}>
                  View Profile
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each users as user}
        <div class="card variant-filled p-4">
          <div class="flex items-center gap-4">
            <Avatar src={getUserPictureUrl(user)} width="w-16" />
            <div class="min-w-0 flex-1">
              <h3 class="h4 truncate font-bold">{user.name}</h3>
              <p class="text-sm opacity-80">
                {user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1)}
              </p>
            </div>
          </div>
          <div class="mt-4">
            <button
              class="variant-filled-secondary btn w-full"
              onclick={() => handleViewUser(user)}
            >
              View Profile
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-center text-surface-500">No users found.</p>
  {/if}
</div>
