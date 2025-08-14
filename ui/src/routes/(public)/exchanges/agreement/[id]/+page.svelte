<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { decodeHashFromBase64 } from '@holochain/client';
  import { useExchangeDetails } from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';
  import ReviewsList from '$lib/components/exchanges/ReviewsList.svelte';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalSettings } from '@skeletonlabs/skeleton';
  
  const modalStore = getModalStore();
  const exchangeDetails = useExchangeDetails();
  
  // Get agreement hash from URL
  const agreementId = $derived(page.params.id);
  const agreementHash = $derived.by(() => {
    try {
      return agreementId ? decodeHashFromBase64(agreementId) : null;
    } catch {
      return null;
    }
  });

  // Load agreement details
  onMount(async () => {
    const hash = agreementHash;
    if (hash) {
      await exchangeDetails.initialize(undefined, hash);
    }
  });

  const currentAgreement = $derived(exchangeDetails.currentAgreement());
  const relatedReviews = $derived(exchangeDetails.relatedReviews());
  const canMarkComplete = $derived(exchangeDetails.canMarkComplete());
  const canCreateReview = $derived(exchangeDetails.canCreateReview());
  
  // Handle agreement actions
  const handleMarkComplete = async () => {
    // TODO: Implement mark complete logic
    console.log('Mark agreement complete:', agreementId);
  };

  // Handle create review
  const openCreateReview = () => {
    const modal: ModalSettings = {
      type: 'prompt',
      title: 'Create Review',
      body: 'How would you rate this exchange?',
      value: '',
      valueAttr: { type: 'number', min: 1, max: 5, step: 1 },
      response: (r: any) => {
        if (r) {
          // TODO: Implement create review logic
          console.log('Create review with rating:', r);
        }
      }
    };
    modalStore.trigger(modal);
  };
</script>

<svelte:head>
  <title>Exchange Agreement - Requests & Offers</title>
  <meta name="description" content="View and manage exchange agreement details" />
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
  {#if exchangeDetails.isLoading}
    <div class="card p-6 text-center">
      <div class="placeholder animate-pulse"></div>
      <p class="mt-2">Loading agreement details...</p>
    </div>
  {:else if exchangeDetails.error}
    <div class="card variant-filled-error p-6 text-center">
      <h2 class="h3 mb-2">Error Loading Agreement</h2>
      <p>{exchangeDetails.error}</p>
      <button class="btn variant-filled mt-4" onclick={() => window.history.back()}>
        Go Back
      </button>
    </div>
  {:else if currentAgreement}
    <!-- Agreement Details -->
    <div class="card p-6">
      <div class="flex items-center justify-between mb-4">
        <h1 class="h1 font-bold">Exchange Agreement</h1>
        <div class="flex gap-2">
          {#if canMarkComplete}
            <button 
              class="btn variant-filled-success"
              onclick={handleMarkComplete}
            >
              Mark Complete
            </button>
          {/if}
          {#if canCreateReview}
            <button 
              class="btn variant-filled-secondary"
              onclick={openCreateReview}
            >
              Add Review
            </button>
          {/if}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 class="h3 mb-2">Agreement Details</h3>
          <dl class="space-y-2">
            <div>
              <dt class="font-semibold">Status:</dt>
              <dd>
                <span class={`badge ${
                  currentAgreement.entry.status === 'Active' ? 'variant-soft-warning' :
                  'variant-soft-success'
                }`}>
                  {currentAgreement.entry.status}
                </span>
              </dd>
            </div>
            <div>
              <dt class="font-semibold">Service Details:</dt>
              <dd>{currentAgreement.entry.service_details}</dd>
            </div>
            <!-- Remove terms field as it's not in the Agreement schema -->
            <div>
              <dt class="font-semibold">Exchange Medium:</dt>
              <dd>{currentAgreement.entry.exchange_medium}</dd>
            </div>
            {#if currentAgreement.entry.exchange_value}
              <div>
                <dt class="font-semibold">Exchange Value:</dt>
                <dd>{currentAgreement.entry.exchange_value}</dd>
              </div>
            {/if}
            {#if currentAgreement.entry.delivery_timeframe}
              <div>
                <dt class="font-semibold">Delivery Timeframe:</dt>
                <dd>{currentAgreement.entry.delivery_timeframe}</dd>
              </div>
            {/if}
            <!-- Remove notes field as it's not in the Agreement schema -->
          </dl>
        </div>

        <div>
          <h3 class="h3 mb-2">Progress</h3>
          <div class="space-y-4">
            <!-- Completion Status -->
            <div class="space-y-3">
              <h4 class="font-semibold">Completion Status</h4>
              <div class="flex items-center gap-3">
                <div class={`w-3 h-3 rounded-full ${currentAgreement.entry.provider_completed ? 'bg-success-500' : 'bg-surface-300'}`}></div>
                <span class={currentAgreement.entry.provider_completed ? 'text-success-600' : 'text-surface-600'}>
                  Provider {currentAgreement.entry.provider_completed ? 'Completed' : 'Pending'}
                </span>
              </div>
              <div class="flex items-center gap-3">
                <div class={`w-3 h-3 rounded-full ${currentAgreement.entry.receiver_completed ? 'bg-success-500' : 'bg-surface-300'}`}></div>
                <span class={currentAgreement.entry.receiver_completed ? 'text-success-600' : 'text-surface-600'}>
                  Receiver {currentAgreement.entry.receiver_completed ? 'Completed' : 'Pending'}
                </span>
              </div>
            </div>

            <!-- Timeline -->
            <div class="space-y-3">
              <h4 class="font-semibold">Timeline</h4>
              <div class="flex items-center gap-3">
                <div class="w-3 h-3 rounded-full bg-primary-500"></div>
                <div>
                  <p class="font-medium">Created</p>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {new Date(currentAgreement.entry.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {#if currentAgreement.entry.updated_at !== currentAgreement.entry.created_at}
                <div class="flex items-center gap-3">
                  <div class="w-3 h-3 rounded-full bg-secondary-500"></div>
                  <div>
                    <p class="font-medium">Last Updated</p>
                    <p class="text-sm text-surface-600 dark:text-surface-400">
                      {new Date(currentAgreement.entry.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Related Reviews -->
    {#if relatedReviews.length > 0}
      <div class="card p-6">
        <h2 class="h2 mb-4">Reviews</h2>
        <ReviewsList reviews={relatedReviews} />
      </div>
    {/if}
  {:else}
    <div class="card p-6 text-center">
      <h2 class="h3 mb-2">Agreement Not Found</h2>
      <p class="text-surface-600 dark:text-surface-400 mb-4">
        The agreement you're looking for doesn't exist or has been removed.
      </p>
      <a href="/exchanges" class="btn variant-filled-primary">
        Back to Exchanges
      </a>
    </div>
  {/if}
</div>

