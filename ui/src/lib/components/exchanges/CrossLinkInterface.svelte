<script lang="ts">
  import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOffer } from '$lib/types/ui';
  import { useExchangeProposalsManagement } from '$lib/composables/domain/exchanges';
  import { isUserApproved } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import { encodeHashToBase64 } from '@holochain/client';
  import { goto } from '$app/navigation';
  import { runEffect } from '$lib/utils/effect';

  // Props - either provide entities or let user search
  interface Props {
    preselectedRequest?: UIRequest;
    preselectedRequestHash?: ActionHash;
    preselectedOffer?: UIOffer;
    preselectedOfferHash?: ActionHash;
  }
  
  let { 
    preselectedRequest,
    preselectedRequestHash,
    preselectedOffer,
    preselectedOfferHash
  }: Props = $props();

  // Stores and composables
  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const exchangeProposals = useExchangeProposalsManagement();
  const { currentUser } = $derived(usersStore);

  // State
  let isSubmitting = $state(false);
  let showForm = $state(false);
  let isLoadingEntities = $state(false);
  
  // Entity selection state
  let selectedRequest: UIRequest | null = $state(preselectedRequest || null);
  let selectedOffer: UIOffer | null = $state(preselectedOffer || null);
  let requestSearchQuery = $state('');
  let offerSearchQuery = $state('');
  let availableRequests: UIRequest[] = $state([]);
  let availableOffers: UIOffer[] = $state([]);

  // Form state
  let formData = $state({
    service_details: '',
    terms: '',
    exchange_medium: '',
    exchange_value: '',
    delivery_timeframe: '',
    notes: ''
  });

  // Check if user can create cross-link proposals
  const canCreateProposal = $derived.by(() => {
    if (!currentUser || !isUserApproved(currentUser)) return false;
    return exchangeProposals.canUserCreateProposals();
  });

  // Check if proposal can be submitted
  const canSubmit = $derived.by(() => {
    return selectedRequest && 
           selectedOffer && 
           formData.service_details.trim() && 
           formData.terms.trim() && 
           formData.exchange_medium.trim() &&
           !isSubmitting;
  });

  // Generate helpful defaults
  const suggestedServiceDetails = $derived(() => {
    if (!selectedRequest || !selectedOffer) return '';
    return `Linking "${selectedOffer.title}" offer with "${selectedRequest.title}" request for mutual benefit.`;
  });

  // Load entities on component mount
  $effect(() => {
    if (preselectedRequestHash && !selectedRequest) {
      loadRequestByHash(preselectedRequestHash);
    }
    if (preselectedOfferHash && !selectedOffer) {
      loadOfferByHash(preselectedOfferHash);
    }
  });

  // Load available entities for selection
  $effect(() => {
    if (showForm && (!selectedRequest || !selectedOffer)) {
      loadAvailableEntities();
    }
  });

  async function loadRequestByHash(hash: ActionHash) {
    try {
      isLoadingEntities = true;
      selectedRequest = await runEffect(requestsStore.getRequest(hash));
    } catch (error) {
      console.error('Failed to load request:', error);
      toastStore.trigger({
        message: 'Failed to load request details',
        background: 'variant-filled-error'
      });
    } finally {
      isLoadingEntities = false;
    }
  }

  async function loadOfferByHash(hash: ActionHash) {
    try {
      isLoadingEntities = true;
      selectedOffer = await runEffect(offersStore.getOffer(hash));
    } catch (error) {
      console.error('Failed to load offer:', error);
      toastStore.trigger({
        message: 'Failed to load offer details',
        background: 'variant-filled-error'
      });
    } finally {
      isLoadingEntities = false;
    }
  }

  async function loadAvailableEntities() {
    try {
      isLoadingEntities = true;
      
      // Load available requests if none selected
      if (!selectedRequest) {
        const fetchedRequests = await runEffect(requestsStore.getAllRequests());
        availableRequests = fetchedRequests;
      }
      
      // Load available offers if none selected
      if (!selectedOffer) {
        const fetchedOffers = await runEffect(offersStore.getAllOffers());
        availableOffers = fetchedOffers;
      }
    } catch (error) {
      console.error('Failed to load entities:', error);
      toastStore.trigger({
        message: 'Failed to load available requests and offers',
        background: 'variant-filled-error'
      });
    } finally {
      isLoadingEntities = false;
    }
  }

  // Filter entities based on search
  const filteredRequests = $derived(() => {
    if (!requestSearchQuery.trim()) return availableRequests.slice(0, 10);
    return availableRequests.filter(request => 
      request.title.toLowerCase().includes(requestSearchQuery.toLowerCase()) ||
      request.description.toLowerCase().includes(requestSearchQuery.toLowerCase())
    ).slice(0, 10);
  });

  const filteredOffers = $derived(() => {
    if (!offerSearchQuery.trim()) return availableOffers.slice(0, 10);
    return availableOffers.filter(offer => 
      offer.title.toLowerCase().includes(offerSearchQuery.toLowerCase()) ||
      offer.description.toLowerCase().includes(offerSearchQuery.toLowerCase())
    ).slice(0, 10);
  });

  function handleRequestSelect(request: UIRequest) {
    selectedRequest = request;
    requestSearchQuery = '';
  }

  function handleOfferSelect(offer: UIOffer) {
    selectedOffer = offer;
    offerSearchQuery = '';
  }

  function clearRequestSelection() {
    selectedRequest = null;
    requestSearchQuery = '';
  }

  function clearOfferSelection() {
    selectedOffer = null;
    offerSearchQuery = '';
  }

  function fillSuggestion() {
    formData.service_details = suggestedServiceDetails();
  }

  async function handleSubmitProposal(event: SubmitEvent) {
    event.preventDefault();
    
    if (!canSubmit || !selectedRequest?.original_action_hash || !selectedOffer?.original_action_hash) {
      return;
    }

    isSubmitting = true;
    
    try {
      await exchangeProposals.createCrossLinkProposal(
        selectedRequest.original_action_hash,
        selectedOffer.original_action_hash,
        {
          service_details: formData.service_details,
          terms: formData.terms,
          exchange_medium: formData.exchange_medium,
          exchange_value: formData.exchange_value || undefined,
          delivery_timeframe: formData.delivery_timeframe || undefined,
          notes: formData.notes || undefined
        }
      );

      toastStore.trigger({
        message: 'Cross-link proposal created successfully!',
        background: 'variant-filled-success'
      });

      // Reset form
      formData = {
        service_details: '',
        terms: '',
        exchange_medium: '',
        exchange_value: '',
        delivery_timeframe: '',
        notes: ''
      };
      selectedRequest = preselectedRequest || null;
      selectedOffer = preselectedOffer || null;
      showForm = false;

      // Navigate to proposals
      goto('/exchanges/proposals');

    } catch (error) {
      console.error('Failed to create cross-link proposal:', error);
      toastStore.trigger({
        message: `Failed to create proposal: ${error instanceof Error ? error.message : String(error)}`,
        background: 'variant-filled-error'
      });
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    formData = {
      service_details: '',
      terms: '',
      exchange_medium: '',
      exchange_value: '',
      delivery_timeframe: '',
      notes: ''
    };
    selectedRequest = preselectedRequest || null;
    selectedOffer = preselectedOffer || null;
    showForm = false;
  }
</script>

<!-- Cross-Link Interface -->
{#if canCreateProposal}
  <div class="border-secondary-500/20 rounded-container-token border-2 bg-gradient-to-br from-secondary-50 to-tertiary-50 p-4 dark:from-secondary-950/30 dark:to-tertiary-950/30">
    <header class="mb-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-secondary-500">link</span>
      <h3 class="h4 font-semibold text-secondary-700 dark:text-secondary-300">Cross-Link Proposal</h3>
    </header>

    {#if !showForm}
      <!-- Create Proposal Button -->
      <div class="space-y-2">
        <p class="text-sm text-surface-600 dark:text-surface-300">
          Create formal proposals by linking existing requests with matching offers.
          Perfect for professional transactions with detailed terms.
        </p>
        <button 
          class="variant-filled-secondary btn w-full"
          onclick={() => showForm = true}
          disabled={isLoadingEntities}
        >
          {#if isLoadingEntities}
            <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
            <span>Loading...</span>
          {:else}
            <span class="material-symbols-outlined">add_link</span>
            <span>Create Cross-Link Proposal</span>
          {/if}
        </button>
      </div>
    {:else}
      <!-- Cross-Link Form -->
      <form class="space-y-6" onsubmit={handleSubmitProposal}>
        <!-- Entity Selection -->
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <!-- Request Selection -->
          <div class="space-y-2">
            <label class="label" for="request_selection">
              <span>Select Request *</span>
            </label>
            
            {#if selectedRequest}
              <!-- Selected Request Display -->
              <div class="variant-soft-primary card p-3">
                <div class="flex items-start justify-between">
                  <div class="flex-grow">
                    <h4 class="font-semibold">{selectedRequest.title}</h4>
                    <p class="text-sm text-surface-600 dark:text-surface-300">
                      {selectedRequest.description?.substring(0, 100)}...
                    </p>
                  </div>
                  {#if !preselectedRequest}
                    <button 
                      type="button"
                      class="variant-ghost-surface btn-icon-sm btn"
                      onclick={clearRequestSelection}
                    >
                      <span class="material-symbols-outlined">close</span>
                    </button>
                  {/if}
                </div>
              </div>
            {:else}
              <!-- Request Search -->
              <div class="space-y-2">
                <label class="label" for="request_search">
                  <span class="sr-only">Search requests</span>
                </label>
                <input
                  id="request_search"
                  class="input"
                  type="text"
                  placeholder="Search requests..."
                  bind:value={requestSearchQuery}
                />
                
                {#if filteredRequests().length > 0}
                  <div class="variant-soft-surface card max-h-64 overflow-y-auto p-2">
                    {#each filteredRequests() as request (request.original_action_hash)}
                      <button
                        type="button"
                        class="hover:variant-soft-primary w-full rounded p-2 text-left"
                        onclick={() => handleRequestSelect(request)}
                      >
                        <div class="font-medium">{request.title}</div>
                        <div class="text-sm text-surface-600 dark:text-surface-300">
                          {request.description?.substring(0, 80)}...
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Offer Selection -->
          <div class="space-y-2">
            <label class="label" for="offer_selection">
              <span>Select Offer *</span>
            </label>
            
            {#if selectedOffer}
              <!-- Selected Offer Display -->
              <div class="variant-soft-secondary card p-3">
                <div class="flex items-start justify-between">
                  <div class="flex-grow">
                    <h4 class="font-semibold">{selectedOffer.title}</h4>
                    <p class="text-sm text-surface-600 dark:text-surface-300">
                      {selectedOffer.description?.substring(0, 100)}...
                    </p>
                  </div>
                  {#if !preselectedOffer}
                    <button 
                      type="button"
                      class="variant-ghost-surface btn-icon-sm btn"
                      onclick={clearOfferSelection}
                    >
                      <span class="material-symbols-outlined">close</span>
                    </button>
                  {/if}
                </div>
              </div>
            {:else}
              <!-- Offer Search -->
              <div class="space-y-2">
                <label class="label" for="offer_search">
                  <span class="sr-only">Search offers</span>
                </label>
                <input
                  id="offer_search"
                  class="input"
                  type="text"
                  placeholder="Search offers..."
                  bind:value={offerSearchQuery}
                />
                
                {#if filteredOffers().length > 0}
                  <div class="variant-soft-surface card max-h-64 overflow-y-auto p-2">
                    {#each filteredOffers() as offer (offer.original_action_hash)}
                      <button
                        type="button"
                        class="hover:variant-soft-secondary w-full rounded p-2 text-left"
                        onclick={() => handleOfferSelect(offer)}
                      >
                        <div class="font-medium">{offer.title}</div>
                        <div class="text-sm text-surface-600 dark:text-surface-300">
                          {offer.description?.substring(0, 80)}...
                        </div>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <!-- Proposal Details -->
        {#if selectedRequest && selectedOffer}
          <!-- Service Details -->
          <div>
            <label class="label" for="cross_service_details">
              <span>Proposal Description *</span>
            </label>
            <div class="space-y-2">
              <textarea
                id="cross_service_details"
                class="textarea"
                placeholder={suggestedServiceDetails()}
                bind:value={formData.service_details}
                rows="3"
                required
              ></textarea>
              <button 
                type="button"
                class="variant-ghost-secondary btn-sm btn"
                onclick={fillSuggestion}
              >
                <span class="material-symbols-outlined">auto_fix_high</span>
                <span>Use Suggestion</span>
              </button>
            </div>
          </div>

          <!-- Terms & Conditions -->
          <div>
            <label class="label" for="cross_terms">
              <span>Terms & Conditions *</span>
            </label>
            <textarea
              id="cross_terms"
              class="textarea"
              placeholder="Detailed terms, conditions, and expectations for this cross-link arrangement..."
              bind:value={formData.terms}
              rows="3"
              required
            ></textarea>
          </div>

          <!-- Exchange Medium -->
          <div>
            <label class="label" for="cross_exchange_medium">
              <span>Exchange Medium *</span>
            </label>
            <input
              id="cross_exchange_medium"
              class="input"
              type="text"
              placeholder="e.g., Payment, Barter, Skills exchange, Mutual service..."
              bind:value={formData.exchange_medium}
              required
            />
          </div>

          <!-- Exchange Value -->
          <div>
            <label class="label" for="cross_exchange_value">
              <span>Exchange Value (Optional)</span>
            </label>
            <input
              id="cross_exchange_value"
              class="input"
              type="text"
              placeholder="e.g., $100, 5 hours of work, Negotiable..."
              bind:value={formData.exchange_value}
            />
          </div>

          <!-- Delivery Timeframe -->
          <div>
            <label class="label" for="cross_delivery_timeframe">
              <span>Delivery Timeframe (Optional)</span>
            </label>
            <input
              id="cross_delivery_timeframe"
              class="input"
              type="text"
              placeholder="e.g., 2 weeks, By end of month, Flexible schedule..."
              bind:value={formData.delivery_timeframe}
            />
          </div>

          <!-- Additional Notes -->
          <div>
            <label class="label" for="cross_notes">
              <span>Additional Notes (Optional)</span>
            </label>
            <textarea
              id="cross_notes"
              class="textarea"
              placeholder="Any additional information, special requirements, or clarifications..."
              bind:value={formData.notes}
              rows="2"
            ></textarea>
          </div>

          <!-- Form Actions -->
          <div class="flex justify-end gap-2">
            <button 
              type="button"
              class="variant-ghost-surface btn"
              onclick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit"
              class="variant-filled-secondary btn"
              disabled={!canSubmit}
            >
              {#if isSubmitting}
                <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
                <span>Creating...</span>
              {:else}
                <span class="material-symbols-outlined">send</span>
                <span>Create Proposal</span>
              {/if}
            </button>
          </div>
        {/if}
      </form>
    {/if}
  </div>
{:else if currentUser && !isUserApproved(currentUser)}
  <!-- User needs approval -->
  <div class="variant-soft-warning rounded-container-token p-3">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">info</span>
      <p class="text-sm">Your account is pending approval before you can create cross-link proposals.</p>
    </div>
  </div>
{/if}