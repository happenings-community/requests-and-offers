<script lang="ts">
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { decodeHashFromBase64 } from '@holochain/client';
  import { useExchangeDetails } from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';
  import ProposalsList from '$lib/components/exchanges/ProposalsList.svelte';
  import AgreementsList from '$lib/components/exchanges/AgreementsList.svelte';
  import ReviewsList from '$lib/components/exchanges/ReviewsList.svelte';
  import DirectResponseModal from '$lib/components/exchanges/DirectResponseModal.svelte';
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ModalSettings } from '@skeletonlabs/skeleton';

  const modalStore = getModalStore();
  const exchangeDetails = useExchangeDetails();

  // Get proposal hash from URL
  const proposalId = $derived(page.params.id);
  const proposalHash = $derived.by(() => {
    try {
      return proposalId ? decodeHashFromBase64(proposalId) : null;
    } catch {
      return null;
    }
  });

  // Load proposal details
  onMount(async () => {
    const hash = proposalHash;
    if (hash) {
      await exchangeDetails.initialize(hash);
    }
  });

  const currentProposal = $derived(exchangeDetails.currentProposal());
  const relatedReviews = $derived(exchangeDetails.relatedReviews());
  const canApproveProposal = $derived(exchangeDetails.canApproveProposal());
  const canRejectProposal = $derived(exchangeDetails.canRejectProposal());

  // Handle proposal actions
  const handleProposalAction = async (action: string, proposalId: string) => {
    // TODO: Implement proposal actions (approve, reject)
    console.log(`Action: ${action} for proposal: ${proposalId}`);
  };

  // Handle direct response
  const openDirectResponse = () => {
    const modal: ModalSettings = {
      type: 'component',
      component: {
        ref: DirectResponseModal,
        props: {
          onSubmit: async (input: any) => {
            // TODO: Implement create proposal logic
            console.log('Create proposal:', input);
            modalStore.close();
          },
          onCancel: () => modalStore.close()
        }
      }
    };
    modalStore.trigger(modal);
  };
</script>

<svelte:head>
  <title>Exchange Proposal - Requests & Offers</title>
  <meta name="description" content="View and manage exchange proposal details" />
</svelte:head>

<div class="container mx-auto space-y-6 p-4">
  {#if exchangeDetails.isLoading}
    <div class="card p-6 text-center">
      <div class="placeholder animate-pulse"></div>
      <p class="mt-2">Loading proposal details...</p>
    </div>
  {:else if exchangeDetails.error}
    <div class="card variant-filled-error p-6 text-center">
      <h2 class="h3 mb-2">Error Loading Proposal</h2>
      <p>{exchangeDetails.error}</p>
      <button class="variant-filled btn mt-4" onclick={() => window.history.back()}>
        Go Back
      </button>
    </div>
  {:else if currentProposal}
    <!-- Proposal Details -->
    <div class="card p-6">
      <div class="mb-4 flex items-center justify-between">
        <h1 class="h1 font-bold">Exchange Proposal</h1>
        <div class="flex gap-2">
          {#if canApproveProposal}
            <button
              class="variant-filled-success btn"
              onclick={() => proposalId && handleProposalAction('approve', proposalId)}
            >
              Approve
            </button>
          {/if}
          {#if canRejectProposal}
            <button
              class="variant-filled-error btn"
              onclick={() => proposalId && handleProposalAction('reject', proposalId)}
            >
              Reject
            </button>
          {/if}
          <button class="variant-filled-secondary btn" onclick={openDirectResponse}>
            Respond
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <h3 class="h3 mb-2">Proposal Details</h3>
          <dl class="space-y-2">
            <div>
              <dt class="font-semibold">Status:</dt>
              <dd>
                <span
                  class={`badge ${
                    currentProposal.entry.status === 'Pending'
                      ? 'variant-soft-warning'
                      : currentProposal.entry.status === 'Approved'
                        ? 'variant-soft-success'
                        : 'variant-soft-error'
                  }`}
                >
                  {currentProposal.entry.status}
                </span>
              </dd>
            </div>
            <div>
              <dt class="font-semibold">Service Details:</dt>
              <dd>{currentProposal.entry.service_details}</dd>
            </div>
            <div>
              <dt class="font-semibold">Terms:</dt>
              <dd>{currentProposal.entry.terms}</dd>
            </div>
            <div>
              <dt class="font-semibold">Exchange Medium:</dt>
              <dd>{currentProposal.entry.exchange_medium}</dd>
            </div>
            {#if currentProposal.entry.exchange_value}
              <div>
                <dt class="font-semibold">Exchange Value:</dt>
                <dd>{currentProposal.entry.exchange_value}</dd>
              </div>
            {/if}
            {#if currentProposal.entry.delivery_timeframe}
              <div>
                <dt class="font-semibold">Delivery Timeframe:</dt>
                <dd>{currentProposal.entry.delivery_timeframe}</dd>
              </div>
            {/if}
            {#if currentProposal.entry.notes}
              <div>
                <dt class="font-semibold">Notes:</dt>
                <dd>{currentProposal.entry.notes}</dd>
              </div>
            {/if}
          </dl>
        </div>

        <div>
          <h3 class="h3 mb-2">Timeline</h3>
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="h-3 w-3 rounded-full bg-primary-500"></div>
              <div>
                <p class="font-medium">Created</p>
                <p class="text-sm text-surface-600 dark:text-surface-400">
                  {new Date(currentProposal.entry.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            {#if currentProposal.entry.updated_at !== currentProposal.entry.created_at}
              <div class="flex items-center gap-3">
                <div class="h-3 w-3 rounded-full bg-secondary-500"></div>
                <div>
                  <p class="font-medium">Last Updated</p>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {new Date(currentProposal.entry.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            {/if}
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
      <h2 class="h3 mb-2">Proposal Not Found</h2>
      <p class="mb-4 text-surface-600 dark:text-surface-400">
        The proposal you're looking for doesn't exist or has been removed.
      </p>
      <a href="/exchanges" class="variant-filled-primary btn"> Back to Exchanges </a>
    </div>
  {/if}
</div>
