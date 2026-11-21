<script lang="ts">
  import { pageTitle } from '$lib/utils/page-title';
  import ServiceTypeSuggestionForm from '$lib/components/service-types/ServiceTypeSuggestionForm.svelte';
</script>

<svelte:head>
  <title>{pageTitle('Suggest a service type')}</title>
</svelte:head>

<div class="container mx-auto p-8">
  <ServiceTypeSuggestionForm />
</div>
