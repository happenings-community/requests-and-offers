<script lang="ts">
  import { goto } from '$app/navigation';
  import MediumOfExchangeForm from '$lib/components/mediums-of-exchange/MediumOfExchangeForm.svelte';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';
  import { paths } from '$lib/paths';

  function handleSuccess(result: UIMediumOfExchange) {
    goto(paths.adminMediumsOfExchange());
  }

  function handleCancel() {
    goto(paths.adminMediumsOfExchange());
  }
</script>

<svelte:head>
  <title>Create Medium of Exchange - Admin</title>
</svelte:head>

<div class="container mx-auto p-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="h1 text-3xl font-bold">Create Medium of Exchange</h1>
      <p class="mt-2 text-surface-600 dark:text-surface-400">
        Add a new currency or payment method to the system.
      </p>
    </div>
    <button class="variant-soft btn" onclick={() => handleCancel()}> Back to List </button>
  </div>

  <MediumOfExchangeForm mode="create" onSubmitSuccess={handleSuccess} onCancel={handleCancel} />
</div>
