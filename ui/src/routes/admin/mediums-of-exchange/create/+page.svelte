<script lang="ts">
  import { goto } from '$app/navigation';
  import MediumOfExchangeForm from '$lib/components/mediums-of-exchange/MediumOfExchangeForm.svelte';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';

  function handleSuccess(result: UIMediumOfExchange) {
    goto('/admin/mediums-of-exchange');
  }

  function handleCancel() {
    goto('/admin/mediums-of-exchange');
  }
</script>

<svelte:head>
  <title>Create Medium of Exchange - Admin</title>
</svelte:head>

<div class="container mx-auto p-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="h1 text-3xl font-bold">Create Medium of Exchange</h1>
      <p class="text-surface-600 dark:text-surface-400 mt-2">
        Add a new currency or payment method to the system.
      </p>
    </div>
    <button class="btn variant-soft" onclick={() => handleCancel()}> Back to List </button>
  </div>

  <MediumOfExchangeForm mode="create" onSubmitSuccess={handleSuccess} onCancel={handleCancel} />
</div>
