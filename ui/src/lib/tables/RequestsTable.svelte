<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { encodeHashToBase64 } from '@holochain/client';
  import type { UIRequest } from '@/types/ui';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import RequestCard from '@/lib/components/RequestCard.svelte';
  import RequestDetailsModal from '@/lib/modals/RequestDetailsModal.svelte';

  type Props = {
    requests: UIRequest[];
    title?: string;
    showOrganization?: boolean;
    showCreator?: boolean;
  };

  const { requests, title, showOrganization = false, showCreator = false }: Props = $props();

  const modalStore = getModalStore();
  const modalComponent: ModalComponent = { ref: RequestDetailsModal };

  function handleRequestAction(request: UIRequest) {
    if ($page.url.pathname.startsWith('/admin')) {
      // Use modal view for admin
      modalStore.trigger({
        type: 'component',
        component: modalComponent,
        meta: { request, canEdit: true, canDelete: true }
      });
    } else {
      // Navigate to request details page
      goto(`/requests/${encodeHashToBase64(request.original_action_hash!)}`);
    }
  }
</script>

<div class="flex flex-col gap-4">
  {#if title}
    <h2 class="h3 text-center font-semibold">{title}</h2>
  {/if}

  {#if requests.length > 0}
    <!-- Table view for larger screens -->
    <div class="hidden overflow-x-auto md:block">
      <table class="table-hover table w-full drop-shadow-lg">
        <thead>
          <tr>
            <th class="whitespace-nowrap">Title</th>
            <th class="whitespace-nowrap">Description</th>
            <th class="whitespace-nowrap">Skills</th>
            <th class="whitespace-nowrap">Status</th>
            {#if showCreator}
              <th class="whitespace-nowrap">Creator</th>
            {/if}
            {#if showOrganization}
              <th class="whitespace-nowrap">Organization</th>
            {/if}
            <th class="whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each requests as request}
            <tr>
              <td class="whitespace-nowrap">{request.title}</td>
              <td class="max-w-md truncate">{request.description}</td>
              <td class="whitespace-nowrap">
                {#if request.skills.length > 0}
                  <span class="badge variant-soft-primary">
                    {request.skills[0]}
                    {#if request.skills.length > 1}
                      <span class="ml-1">+{request.skills.length - 1}</span>
                    {/if}
                  </span>
                {/if}
              </td>
              <td class="whitespace-nowrap text-center">
                <span
                  class="badge variant-soft-{request.process_state === 'Proposed'
                    ? 'primary'
                    : request.process_state === 'Committed'
                      ? 'secondary'
                      : request.process_state === 'InProgress'
                        ? 'tertiary'
                        : request.process_state === 'Completed'
                          ? 'success'
                          : 'error'}"
                >
                  {request.process_state}
                </span>
              </td>
              {#if showCreator}
                <td class="whitespace-nowrap">
                  <!-- Creator info will be added later -->
                  <span class="text-surface-500 italic">Creator</span>
                </td>
              {/if}
              {#if showOrganization}
                <td class="whitespace-nowrap">
                  <!-- Organization info will be added later -->
                  <span class="text-surface-500 italic">Organization</span>
                </td>
              {/if}
              <td class="whitespace-nowrap">
                <button
                  class="btn variant-filled-secondary"
                  onclick={() => handleRequestAction(request)}
                >
                  {$page.url.pathname.startsWith('/admin') ? 'Manage' : 'Details'}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Card view for mobile screens -->
    <div class="grid grid-cols-1 gap-4 md:hidden">
      {#each requests as request}
        <button onclick={() => handleRequestAction(request)} class="cursor-pointer">
          <RequestCard {request} mode="compact" />
        </button>
      {/each}
    </div>
  {:else}
    <p class="text-surface-500 text-center">No requests found.</p>
  {/if}
</div>
