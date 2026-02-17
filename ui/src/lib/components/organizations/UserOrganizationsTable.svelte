<script lang="ts">
  import { Avatar } from '@skeletonlabs/skeleton';
  import type { UIOrganization } from '$lib/types/ui';
  import { OrganizationRole } from '$lib/types/ui';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import { getOrganizationLogoUrl } from '$lib/utils';
  import MarkdownRenderer from '$lib/components/shared/MarkdownRenderer.svelte';
  import { stripMarkdown } from '$lib/utils/markdown';

  type Props = {
    organizations: UIOrganization[];
    title: string;
    role: OrganizationRole;
  };

  const { organizations, title, role }: Props = $props();
</script>

<div class="card space-y-4 p-4">
  <header class="card-header">
    <h3 class="h3">{title}</h3>
  </header>

  {#if organizations.length === 0}
    <div class="flex justify-center p-4">
      <p class="text-surface-600-300-token">No organizations found</p>
    </div>
  {:else}
    <div class="hidden overflow-x-auto md:block">
      <table class="table table-hover w-full drop-shadow-lg">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Logo</th>
            <th class="whitespace-nowrap">Name</th>
            <th class="whitespace-nowrap">Description</th>
            <th class="whitespace-nowrap">Role</th>
            <th class="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each organizations as organization (organization.original_action_hash)}
            <tr>
              <td>
                <Avatar
                  src={getOrganizationLogoUrl(organization)}
                  width="w-10"
                  rounded="rounded-full"
                />
              </td>
              <td class="whitespace-nowrap">{organization.name}</td>
              <td class="max-w-md"><MarkdownRenderer content={organization.description} /></td>
              <td class="whitespace-nowrap">
                <span
                  class="badge {role === OrganizationRole.Coordinator
                    ? 'variant-filled-primary'
                    : 'variant-filled-surface'}"
                >
                  {role}
                </span>
              </td>
              <td class="whitespace-nowrap">
                <div class="flex gap-2">
                  <button
                    class="variant-filled-surface btn btn-sm"
                    onclick={() =>
                      goto(
                        `/organizations/${encodeHashToBase64(organization.original_action_hash!)}`
                      )}
                  >
                    View
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each organizations as organization (organization.original_action_hash)}
        <div class="card variant-filled p-4">
          <div class="flex items-center gap-4">
            <Avatar
              src={getOrganizationLogoUrl(organization)}
              width="w-16"
              rounded="rounded-full"
            />
            <div class="min-w-0 flex-1">
              <h3 class="h4 truncate font-bold">{organization.name}</h3>
              <p class="line-clamp-2 text-sm opacity-80">{stripMarkdown(organization.description)}</p>
            </div>
          </div>
          <div class="mt-4">
            <button
              class="variant-filled-surface btn w-full"
              onclick={() =>
                goto(`/organizations/${encodeHashToBase64(organization.original_action_hash!)}`)}
            >
              View
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
