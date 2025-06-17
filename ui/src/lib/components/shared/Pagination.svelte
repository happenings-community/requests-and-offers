<script lang="ts">
  import type { UsePagination } from '$lib/types/ui';

  type Props = {
    pagination: UsePagination;
  };

  const { pagination }: Props = $props();

  function handlePageSizeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    pagination.setPageSize(Number(target.value));
  }
</script>

<div class="flex items-center justify-between">
  <!-- Page Size Selector -->
  <div class="flex items-center space-x-2">
    <label for="pageSize" class="text-sm text-surface-500">Items per page:</label>
    <select
      id="pageSize"
      class="select select-sm"
      value={pagination.pageSize}
      onchange={handlePageSizeChange}
    >
      {#each pagination.pageSizeOptions as size}
        <option value={size}>{size}</option>
      {/each}
    </select>
  </div>

  <p class="text-sm text-surface-500">
    Page {pagination.currentPage} of {pagination.totalPages}
  </p>

  <!-- Navigation Buttons -->
  <div class="join">
    <button
      class="join-item btn"
      onclick={pagination.previousPage}
      disabled={!pagination.canGoPrevious}
    >
      «
    </button>
    <button class="join-item btn">Page {pagination.currentPage}</button>
    <button class="join-item btn" onclick={pagination.nextPage} disabled={!pagination.canGoNext}>
      »
    </button>
  </div>
</div> 