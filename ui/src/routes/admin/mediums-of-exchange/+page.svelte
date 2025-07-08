<script lang="ts">
  import MoEManagementTable from '$lib/components/moe/MoEManagementTable.svelte';
  import MoEInitializer from '$lib/components/moe/MoEInitializer.svelte';
</script>

<div class="container mx-auto p-4">
  <h1 class="h1 mb-4">Manage Mediums of Exchange</h1>
  <p class="mb-6">
    Review and manage mediums of exchange suggestions. Approve currencies to make them available for
    users when creating offers and requests, or reject them to remove them from the queue.
  </p>

  <!-- Initialization Section -->
  <div class="mb-8">
    <MoEInitializer />
  </div>

  <!-- Management Table -->
  <MoEManagementTable />
</div>
