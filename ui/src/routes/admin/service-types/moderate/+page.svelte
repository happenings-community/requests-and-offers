<script lang="ts">
  import { pageTitle } from '$lib/utils/document';
  import ServiceTypeModerationTable from '$lib/components/service-types/ServiceTypeModerationTable.svelte';
</script>

<svelte:head>
  <title>{pageTitle('Moderate Suggestions', 'Admin')}</title>
</svelte:head>

<div class="container mx-auto p-4">
  <h1 class="h1 mb-4">Moderate Service Type Suggestions</h1>
  <p class="mb-6">
    Review pending service type suggestions. Approve them to make them available for use, or reject
    them to remove them from the queue.
  </p>
  <ServiceTypeModerationTable />
</div>
