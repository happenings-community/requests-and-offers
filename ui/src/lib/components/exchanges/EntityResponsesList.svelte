<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { formatTimestamp } from '$lib/utils';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import usersStore from '$lib/stores/users.store.svelte';
  
  // Props
  interface Props {
    entityHash: ActionHash;
    entityType: 'request' | 'offer';
    showAsOwner?: boolean; // Whether to show actions for the entity owner
  }
  
  const {
    entityHash,
    entityType,
    showAsOwner = false
  }: Props = $props();
  
  const exchangesStore = createExchangesStore();
  const toastStore = getToastStore();
  const { currentUser } = $derived(usersStore);
  
  // State
  let responses = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  
  // Create loading state setter
  const responsesSetters = {
    setLoading: (loading: boolean) => { isLoading = loading; },
    setError: (errorMsg: string | null) => { error = errorMsg; }
  };
  
  // Load responses for this entity
  $effect(() => {
    async function loadResponses() {
      try {
        isLoading = true;
        const entityResponses = await runEffect(exchangesStore.fetchResponsesForEntity(entityHash)(responsesSetters));
        responses = Array.isArray(entityResponses) ? entityResponses : [];
        
        console.log(`✅ Loaded ${responses.length} responses for ${entityType}`);
        error = null;
      } catch (err) {
        console.error('Failed to load responses:', err);
        error = 'Failed to load responses. Please try again.';
      } finally {
        isLoading = false;
      }
    }
    
    if (entityHash) {
      loadResponses();
    }
  });
  
  // Handle response actions (approve/reject)
  async function handleResponseAction(action: 'approve' | 'reject', responseHash: ActionHash) {
    try {
      await runEffect(
        exchangesStore.updateExchangeResponseStatus({
          response_hash: responseHash,
          new_status: action === 'approve' ? 'Approved' : 'Rejected',
          reason: null
        })
      );
      
      toastStore.trigger({
        message: `Response ${action}d successfully!`,
        background: action === 'approve' ? 'variant-filled-success' : 'variant-filled-warning'
      });
      
      // Reload responses
      const entityResponses = await runEffect(exchangesStore.fetchResponsesForEntity(entityHash)(responsesSetters));
      responses = Array.isArray(entityResponses) ? entityResponses : [];
    } catch (err) {
      console.error(`Failed to ${action} response:`, err);
      toastStore.trigger({
        message: `Failed to ${action} response: ${err instanceof Error ? err.message : String(err)}`,
        background: 'variant-filled-error'
      });
    }
  }
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="h4 font-semibold">
      Responses for this {entityType}
      {#if responses.length > 0}
        <span class="variant-soft-primary badge ml-2">{responses.length}</span>
      {/if}
    </h3>
  </div>

  {#if isLoading}
    <div class="flex items-center justify-center p-6">
      <div class="flex items-center gap-3">
        <div class="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-500"></div>
        <span class="text-sm">Loading responses...</span>
      </div>
    </div>
  {:else if error}
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
    </div>
  {:else if responses.length === 0}
    <div class="card p-6 text-center">
      <div class="mb-3 text-surface-500">
        <span class="text-2xl">📝</span>
      </div>
      <h4 class="h4 mb-2">No Responses Yet</h4>
      <p class="text-sm text-surface-600 dark:text-surface-400">
        No one has responded to this {entityType} yet. Share it to get more visibility!
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each responses as response}
        <div class="card p-4">
          <div class="flex items-start justify-between">
            <div class="flex-1 space-y-3">
              <!-- Response Header -->
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                  <div class="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
                    {response.proposerPubkey ? response.proposerPubkey.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <p class="text-sm font-medium">Response from</p>
                    <p class="text-xs text-surface-500">{response.proposerPubkey || 'Unknown user'}</p>
                  </div>
                </div>
                
                <!-- Status Badge -->
                <div class="flex gap-2">
                  {#if response.entry.status === 'Pending'}
                    <span class="variant-soft-warning badge text-xs">Pending</span>
                  {:else if response.entry.status === 'Approved'}
                    <span class="variant-soft-success badge text-xs">Approved</span>
                  {:else if response.entry.status === 'Rejected'}
                    <span class="variant-soft-error badge text-xs">Rejected</span>
                  {/if}
                </div>
              </div>
              
              <!-- Response Content -->
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <h5 class="text-sm font-medium mb-1">Service Details</h5>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {response.entry.service_details || 'No details provided'}
                  </p>
                </div>
                
                <div>
                  <h5 class="text-sm font-medium mb-1">Terms</h5>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {response.entry.terms || 'No terms specified'}
                  </p>
                </div>
                
                <div>
                  <h5 class="text-sm font-medium mb-1">Exchange Medium</h5>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {response.entry.exchange_medium || 'Not specified'}
                  </p>
                </div>
                
                {#if response.entry.exchange_value}
                  <div>
                    <h5 class="text-sm font-medium mb-1">Exchange Value</h5>
                    <p class="text-sm text-surface-600 dark:text-surface-400">
                      {response.entry.exchange_value}
                    </p>
                  </div>
                {/if}
                
                {#if response.entry.delivery_timeframe}
                  <div>
                    <h5 class="text-sm font-medium mb-1">Timeframe</h5>
                    <p class="text-sm text-surface-600 dark:text-surface-400">
                      {response.entry.delivery_timeframe}
                    </p>
                  </div>
                {/if}
                
                {#if response.entry.notes}
                  <div class="md:col-span-2">
                    <h5 class="text-sm font-medium mb-1">Notes</h5>
                    <p class="text-sm text-surface-600 dark:text-surface-400">
                      {response.entry.notes}
                    </p>
                  </div>
                {/if}
              </div>
              
              <!-- Metadata -->
              <div class="flex items-center justify-between text-xs text-surface-500">
                <span>
                  Submitted {response.entry.created_at ? formatTimestamp(response.entry.created_at) : 'recently'}
                </span>
              </div>
            </div>
            
            <!-- Actions (for entity owner) -->
            {#if showAsOwner && response.entry.status === 'Pending' && currentUser}
              <div class="ml-4 flex flex-col gap-2">
                <button 
                  class="variant-filled-success btn btn-sm"
                  onclick={() => handleResponseAction('approve', response.actionHash)}
                >
                  Approve
                </button>
                <button 
                  class="variant-filled-error btn btn-sm"
                  onclick={() => handleResponseAction('reject', response.actionHash)}
                >
                  Reject
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>