<script lang="ts">
  import { Modal, getModalStore } from '@skeletonlabs/skeleton';
  import type { UIUser } from '@types/ui';

  type Props = {
    entity: UIUser;
    onUpdate: (status: string) => void;
  };

  const { entity, onUpdate }: Props = $props();

  let selectedStatus = $state(entity.status?.status_type || '');
  let loading = $state(false);

  const statusOptions = [
    { value: 'active', label: 'Active', class: 'variant-filled-success' },
    { value: 'suspended', label: 'Suspended', class: 'variant-filled-warning' },
    { value: 'inactive', label: 'Inactive', class: 'variant-filled-error' }
  ];

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!selectedStatus) return;
    onUpdate(selectedStatus);
    getModalStore().close();
  }
</script>

<Modal background="bg-surface-100-800-token" width="w-modal-sm">
  <div class="card p-4">
    <header class="card-header">
      <h3 class="h3">Update Status for {entity.name}</h3>
      <hr class="my-4 !border-t-2" />
    </header>

    <form class="space-y-4" onsubmit={handleSubmit}>
      <label class="label">
        <span>Status</span>
        <select class="select w-full" bind:value={selectedStatus} disabled={loading} required>
          <option value="">Select a status...</option>
          {#each statusOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>

      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="btn variant-ghost-surface"
          onclick={() => getModalStore().close()}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          class="btn variant-filled-primary"
          disabled={loading || !selectedStatus}
        >
          {#if loading}
            <span class="loading loading-spinner loading-sm"></span>
          {:else}
            Update Status
          {/if}
        </button>
      </div>
    </form>
  </div>
</Modal>
