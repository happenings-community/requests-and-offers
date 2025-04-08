<script lang="ts">
  import { Avatar, getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import type { UIOrganization } from '@lib/types/ui';
  import OrganizationDetailsModal from '@components/organizations/OrganizationDetailsModal.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { encodeHashToBase64 } from '@holochain/client';
  import { getOrganizationLogoUrl } from '@utils';

  type Props = {
    organizations: UIOrganization[];
    title?: string;
  };

  const { organizations, title }: Props = $props();

  const modalStore = getModalStore();
  const modalComponent: ModalComponent = { ref: OrganizationDetailsModal };

  function handleOrganizationAction(organization: UIOrganization) {
    if ($page.url.pathname.startsWith('/admin')) {
      modalStore.trigger({
        type: 'component',
        component: modalComponent,
        meta: { organization }
      });
    } else {
      console.log('organization:', organization);
      goto(`/organizations/${encodeHashToBase64(organization.original_action_hash!)}`);
    }
  }
</script>

<div class="flex flex-col gap-4">
  {#if title}
    <h2 class="h3 text-center font-semibold">{title}</h2>
  {/if}
  {#if organizations.length > 0}
    <!-- Table view for larger screens -->
    <div class="hidden overflow-x-auto md:block">
      <table class="table-hover table w-full drop-shadow-lg">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Logo</th>
            <th class="whitespace-nowrap">Name</th>
            <th class="whitespace-nowrap">Description</th>
            <th class="whitespace-nowrap">Members</th>
            <th class="whitespace-nowrap">Email</th>
            <th class="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each organizations as organization}
            <tr>
              <td>
                <Avatar src={getOrganizationLogoUrl(organization)} />
              </td>
              <td class="whitespace-nowrap">{organization.name}</td>
              <td class="max-w-md truncate">{organization.description}</td>
              <td class="whitespace-nowrap text-center">{organization.members.length}</td>
              <td class="whitespace-nowrap">{organization.email || 'N/A'}</td>
              <td class="whitespace-nowrap">
                <button
                  class="btn variant-filled-secondary"
                  onclick={() => handleOrganizationAction(organization)}
                >
                  {$page.url.pathname.startsWith('/admin') ? 'View' : 'Details'}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each organizations as organization}
        <div class="card variant-filled p-4">
          <div class="flex items-center gap-4">
            <Avatar src={getOrganizationLogoUrl(organization)} width="w-16" />
            <div class="min-w-0 flex-1">
              <h3 class="h4 truncate font-bold">{organization.name}</h3>
              <p class="line-clamp-2 text-sm opacity-80">{organization.description}</p>
            </div>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <div>
              <span class="text-sm opacity-70">Members:</span>
              <span class="font-semibold">{organization.members.length}</span>
            </div>
            <div class="truncate">
              <span class="text-sm opacity-70">Email:</span>
              <span class="font-semibold">{organization.email || 'N/A'}</span>
            </div>
          </div>
          <div class="mt-4">
            <button
              class="btn variant-filled-secondary w-full"
              onclick={() => handleOrganizationAction(organization)}
            >
              {$page.url.pathname.startsWith('/admin') ? 'View' : 'Details'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <p class="text-surface-500 text-center">No organizations found.</p>
  {/if}
</div>
