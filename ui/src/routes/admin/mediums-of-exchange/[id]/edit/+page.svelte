<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { decodeHashFromBase64 } from '@holochain/client';
  import MediumOfExchangeForm from '$lib/components/mediums-of-exchange/MediumOfExchangeForm.svelte';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { UIMediumOfExchange } from '$lib/schemas/mediums-of-exchange.schemas';

  let mediumOfExchange = $state<UIMediumOfExchange | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!browser) return;

    try {
      // Extract ID from current URL path client-side
      const pathParts = window.location.pathname.split('/');
      const mediumsIndex = pathParts.findIndex((part) => part === 'mediums-of-exchange');
      const idPart = pathParts[mediumsIndex + 1];

      if (!idPart || idPart === 'edit') {
        throw new Error('Medium ID not found in URL');
      }

      console.log('Extracted ID from URL:', idPart);
      const actionHash = decodeHashFromBase64(idPart);
      console.log('Decoded action hash:', actionHash);

      const result = await runEffect(mediumsOfExchangeStore.getMediumOfExchange(actionHash));
      console.log('Loaded medium of exchange:', result);
      mediumOfExchange = result;
    } catch (err) {
      error = 'Failed to load medium of exchange';
      console.error('Error loading medium of exchange:', err);
    } finally {
      loading = false;
    }
  });

  function handleSuccess(result: UIMediumOfExchange) {
    goto('/admin/mediums-of-exchange');
  }

  function handleCancel() {
    goto('/admin/mediums-of-exchange');
  }
</script>

<svelte:head>
  <title>Edit Medium of Exchange - Admin</title>
</svelte:head>

<div class="container mx-auto p-6">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="h1 text-3xl font-bold">Edit Medium of Exchange</h1>
      <p class="mt-2 text-surface-600 dark:text-surface-400">
        Modify the details of this currency or payment method.
      </p>
    </div>
    <button class="variant-soft btn" onclick={() => handleCancel()}> Back to List </button>
  </div>

  {#if loading}
    <div class="card p-8 text-center">
      <div class="loading loading-spinner loading-lg mx-auto mb-4"></div>
      <p>Loading medium of exchange...</p>
    </div>
  {:else if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="variant-filled btn" onclick={() => handleCancel()}> Back to List </button>
      </div>
    </div>
  {:else if mediumOfExchange}
    <MediumOfExchangeForm
      mode="edit"
      {mediumOfExchange}
      onSubmitSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  {:else}
    <div class="alert variant-filled-warning">
      <div class="alert-message">
        <h3 class="h3">Not Found</h3>
        <p>The requested medium of exchange could not be found.</p>
      </div>
      <div class="alert-actions">
        <button class="variant-filled btn" onclick={() => handleCancel()}> Back to List </button>
      </div>
    </div>
  {/if}
</div>
