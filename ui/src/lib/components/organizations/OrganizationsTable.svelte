<script lang="ts">
  import { Avatar, getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import type { UIOrganization } from '$lib/types/ui';
  import OrganizationDetailsModal from '$lib/components/organizations/OrganizationDetailsModal.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { encodeHashToBase64 } from '@holochain/client';
  import { getOrganizationLogoUrl } from '$lib/utils';

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
      goto(`/organizations/${encodeHashToBase64(organization.original_action_hash!)}`);
    }
  }
</script>

<div class="flex flex-col gap-4">
  {#if title}
    <h2 class="h3 text-center font-semibold">{title}</h2>
  {/if}

  {#if organizations.length > 0}
    <!-- Ultra-compact table designed for multi-column layouts -->
    <div class="hidden md:block">
      <table class="table table-hover w-full drop-shadow-lg">
        <!-- Simple header with only essential columns -->
        <thead>
          <tr>
            <th class="w-16">Logo</th>
            <th>Name</th>
            <!-- Only show members count on xl screens -->
            <th class="hidden w-24 text-center xl:table-cell">Members</th>
            <!-- Only show email on xl screens -->
            <th class="hidden xl:table-cell">Email</th>
            <th class="w-24 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each organizations as organization}
            <tr>
              <td>
                <Avatar
                  src={getOrganizationLogoUrl(organization)}
                  width="w-10"
                  alt={`Logo of ${organization.name}`}
                />
              </td>
              <td>
                <div class="font-medium">{organization.name}</div>
                <!-- Compact description display -->
                <div class="line-clamp-1 text-xs text-surface-400">{organization.description}</div>
                <!-- Show members and email inline on smaller screens where those columns are hidden -->
                <div class="flex gap-2 text-xs text-surface-400 xl:hidden">
                  <span>{organization.members.length} members</span>
                  {#if organization.email}
                    <span class="max-w-[8rem] truncate">{organization.email}</span>
                  {/if}
                </div>
              </td>
              <!-- Members only on xl screens -->
              <td class="hidden text-center xl:table-cell">{organization.members.length}</td>
              <!-- Email only on xl screens -->
              <td class="hidden xl:table-cell">
                <div class="max-w-[10rem] truncate">{organization.email || 'N/A'}</div>
              </td>
              <td class="text-right">
                <button
                  class="variant-filled-secondary btn btn-sm"
                  onclick={() => handleOrganizationAction(organization)}
                >
                  View
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens - ultra compact cards -->
    <div class="grid grid-cols-1 gap-2 md:hidden">
      {#each organizations as organization}
        <div class="card variant-filled p-3">
          <div class="flex items-center gap-3">
            <Avatar
              src={getOrganizationLogoUrl(organization)}
              width="w-12"
              alt={`Logo of ${organization.name}`}
            />
            <div class="min-w-0 flex-1">
              <h3 class="truncate text-base font-bold">{organization.name}</h3>
              <p class="line-clamp-1 text-xs opacity-80">{organization.description}</p>
              <div class="mt-1 flex gap-3 text-xs">
                <span>{organization.members.length} members</span>
                {#if organization.email}
                  <span class="max-w-[8rem] truncate">{organization.email}</span>
                {/if}
              </div>
            </div>
            <button
              class="variant-filled-secondary btn btn-sm ml-2 shrink-0"
              onclick={() => handleOrganizationAction(organization)}
            >
              View
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="card variant-ghost p-4">
      <p class="text-center text-surface-500">No organizations found.</p>
    </div>
  {/if}
</div>
