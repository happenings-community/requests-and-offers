<script lang="ts">
  import { Avatar } from '@skeletonlabs/skeleton';
  import type { UIRequest } from '@/types/ui';
  import RequestStatusBadge from './RequestStatusBadge.svelte';
  import RequestSkillsTags from './RequestSkillsTags.svelte';

  type Props = {
    request: UIRequest;
    mode?: 'compact' | 'expanded';
    showActions?: boolean;
  };

  const { request, mode = 'compact', showActions = false }: Props = $props();

  const creatorPictureUrl = $derived(
    request.creator
      ? '/default_avatar.webp' // For now, use default until we can fetch the actual user
      : '/default_avatar.webp'
  );

  // Determine if request is editable based on current user
  const isEditable = $derived(false); // TODO: Implement actual logic

  // Handle edit action
  function handleEdit() {
    // TODO: Implement edit navigation or modal
    console.log('Edit request', request);
  }

  // Handle delete action
  function handleDelete() {
    // TODO: Implement delete confirmation and action
    console.log('Delete request', request);
  }
</script>

<div
  class="card variant-soft flex flex-col gap-3 p-4
  {mode === 'compact' ? 'text-sm' : 'text-base'}"
>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Avatar src={creatorPictureUrl} width="w-10" rounded="rounded-full" />
      <div>
        <h3 class="font-semibold">{request.title}</h3>
        {#if mode === 'expanded'}
          <p class="text-surface-600-300-token opacity-80">
            {request.description}
          </p>
        {/if}
      </div>
    </div>

    {#if request.process_state}
      <RequestStatusBadge state={request.process_state} showLabel={mode === 'expanded'} />
    {/if}
  </div>

  {#if mode === 'expanded'}
    <RequestSkillsTags skills={request.skills} maxVisible={5} />
  {/if}

  {#if showActions && isEditable}
    <div class="mt-2 flex gap-2">
      <button class="btn variant-filled-secondary btn-sm" onclick={handleEdit}> Edit </button>
      <button class="btn variant-filled-error btn-sm" onclick={handleDelete}> Delete </button>
    </div>
  {/if}
</div>
