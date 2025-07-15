<script lang="ts">
  type Props = {
    pendingCount: number;
  };

  const { pendingCount }: Props = $props();
</script>

<div class="flex items-center justify-between">
  <h1 class="h1">Service Types Management</h1>
  <div class="flex gap-2">
    <a href="/admin/service-types/moderate" class="variant-filled-secondary btn">
      Moderate Suggestions
      {#if pendingCount > 0}
        <span class="badge-icon ml-2 bg-primary-500 text-white">{pendingCount}</span>
      {/if}
    </a>
    <a href="/admin/service-types/create" class="variant-filled-primary btn">
      Create Service Type
    </a>
  </div>
</div>
