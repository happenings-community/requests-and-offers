<script lang="ts">
  import { onMount } from 'svelte';
  import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIExchangeCancellation, UIUser } from '$lib/types/ui';
  import { useExchangeCancellationManagement } from '$lib/composables/domain/exchanges';
  import { formatDate, isUserApproved } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';
  import { encodeHashToBase64 } from '@holochain/client';

  const modalStore = getModalStore();
  const toastStore = getToastStore();
  
  // Store and composables
  const { currentUser } = $derived(usersStore);
  const cancellationManager = useExchangeCancellationManagement();

  // Filter state
  let activeTab = $state<'pending' | 'resolved' | 'disputed'>('pending');

  // Check if user is approved
  const userApproved = $derived.by(() => {
    return currentUser && isUserApproved(currentUser);
  });

  // Filtered cancellations based on active tab
  const filteredCancellations = $derived.by(() => {
    const all = cancellationManager.cancellationRequests;
    
    switch (activeTab) {
      case 'pending':
        return all.filter(c => 
          c.other_party_consent === undefined || 
          c.other_party_consent === null
        );
      case 'resolved':
        return all.filter(c => 
          c.other_party_consent !== undefined && 
          c.other_party_consent !== null &&
          !isDisputed(c)
        );
      case 'disputed':
        return cancellationManager.disputedCancellations;
      default:
        return all;
    }
  });

  // Helper functions
  function isDisputed(cancellation: UIExchangeCancellation): boolean {
    return cancellation.other_party_consent === false;
  }

  function getCancellationStatusColor(cancellation: UIExchangeCancellation): string {
    if (isDisputed(cancellation)) return 'text-error-500';
    if (cancellation.other_party_consent === true) return 'text-success-500';
    if (cancellation.other_party_consent === false) return 'text-error-500';
    return 'text-warning-500';
  }

  function getCancellationStatusText(cancellation: UIExchangeCancellation): string {
    if (isDisputed(cancellation)) return 'Disputed';
    if (cancellation.other_party_consent === true) return 'Agreed';
    if (cancellation.other_party_consent === false) return 'Rejected';
    return 'Pending Response';
  }

  function getCancellationReasonText(reason: any): string {
    if (typeof reason === 'string') {
      const reasons: Record<string, string> = {
        'MutualAgreement': 'Mutual Agreement',
        'ProviderUnavailable': 'Provider Unavailable',
        'ReceiverNoLongerNeeds': 'Receiver No Longer Needs',
        'ExternalCircumstances': 'External Circumstances',
        'TechnicalFailure': 'Technical Failure'
      };
      return reasons[reason] || reason;
    }
    
    // Handle { Other: string } type
    if (typeof reason === 'object' && reason && 'Other' in reason) {
      return reason.Other;
    }
    
    return 'Unknown';
  }

  function getUserRoleDisplayText(role: string): { text: string; color: string } {
    switch (role) {
      case 'initiator':
        return { text: 'You initiated', color: 'text-primary-500' };
      case 'responder':
        return { text: 'Awaiting your response', color: 'text-warning-500' };
      default:
        return { text: 'Observer', color: 'text-surface-500' };
    }
  }

  async function handleRespondToCancellation(cancellation: UIExchangeCancellation, consent: boolean) {
    if (!cancellation.original_action_hash) return;

    const action = consent ? 'accept' : 'reject';
    
    modalStore.trigger({
      type: 'confirm',
      title: `${consent ? 'Accept' : 'Reject'} Cancellation`,
      body: `Are you sure you want to ${action} this cancellation request?`,
      response: async (confirmed: boolean) => {
        if (confirmed && cancellation.original_action_hash) {
          try {
            await cancellationManager.respondToCancellation(
              cancellation.original_action_hash,
              consent,
              `${consent ? 'Accepted' : 'Rejected'} cancellation request`
            );
            
            toastStore.trigger({
              message: `Cancellation request ${consent ? 'accepted' : 'rejected'}`,
              background: consent ? 'variant-filled-success' : 'variant-filled-warning'
            });
          } catch (error) {
            console.error(`Failed to ${action} cancellation:`, error);
            toastStore.trigger({
              message: `Failed to ${action} cancellation request`,
              background: 'variant-filled-error'
            });
          }
        }
      }
    });
  }

  async function handleEscalateToAdmin(cancellation: UIExchangeCancellation) {
    if (!cancellation.original_action_hash) return;

    modalStore.trigger({
      type: 'prompt',
      title: 'Escalate to Administrator',
      body: 'Please provide a reason for escalating this cancellation to an administrator:',
      value: '',
      response: async (disputeReason: string | false) => {
        if (disputeReason && cancellation.original_action_hash) {
          try {
            await cancellationManager.escalateToAdmin(
              cancellation.original_action_hash,
              disputeReason
            );
            
            toastStore.trigger({
              message: 'Cancellation escalated to administrator',
              background: 'variant-filled-success'
            });
          } catch (error) {
            console.error('Failed to escalate cancellation:', error);
            toastStore.trigger({
              message: 'Failed to escalate cancellation',
              background: 'variant-filled-error'
            });
          }
        }
      }
    });
  }

  // Initialize on mount
  onMount(async () => {
    if (userApproved) {
      try {
        await cancellationManager.initialize();
      } catch (error) {
        console.error('Failed to initialize cancellation manager:', error);
      }
    }
  });
</script>

<!-- Cancellation Management Dashboard -->
{#if userApproved}
  <div class="space-y-6">
    <header class="flex items-center justify-between">
      <div>
        <h2 class="h3 font-bold">Cancellation Requests</h2>
        <p class="text-surface-600 dark:text-surface-300 text-sm">
          Manage your exchange cancellation requests and responses
        </p>
      </div>
      
      <button 
        class="variant-ghost-surface btn"
        onclick={() => cancellationManager.refreshCancellations()}
        disabled={cancellationManager.isLoading}
      >
        <span class="material-symbols-outlined">refresh</span>
        <span>Refresh</span>
      </button>
    </header>

    <!-- Tab Navigation -->
    <nav class="card p-2">
      <div class="grid grid-cols-3 gap-2">
        <button
          class="btn {activeTab === 'pending' ? 'variant-filled-primary' : 'variant-ghost-surface'}"
          onclick={() => activeTab = 'pending'}
        >
          <span class="material-symbols-outlined">hourglass_empty</span>
          <span>Pending</span>
        </button>
        <button
          class="btn {activeTab === 'resolved' ? 'variant-filled-success' : 'variant-ghost-surface'}"
          onclick={() => activeTab = 'resolved'}
        >
          <span class="material-symbols-outlined">check_circle</span>
          <span>Resolved</span>
        </button>
        <button
          class="btn {activeTab === 'disputed' ? 'variant-filled-error' : 'variant-ghost-surface'}"
          onclick={() => activeTab = 'disputed'}
        >
          <span class="material-symbols-outlined">report</span>
          <span>Disputed</span>
        </button>
      </div>
    </nav>

    <!-- Loading State -->
    {#if cancellationManager.isLoading}
      <div class="card p-8">
        <div class="flex items-center justify-center gap-2">
          <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
          <span>Loading cancellation requests...</span>
        </div>
      </div>
    {:else if filteredCancellations.length === 0}
      <!-- Empty State -->
      <div class="card p-8">
        <div class="text-center">
          <span class="material-symbols-outlined mb-2 text-4xl text-surface-400">inbox</span>
          <h3 class="h4 mb-2 font-semibold">No {activeTab} cancellations</h3>
          <p class="text-surface-600 dark:text-surface-300 text-sm">
            {#if activeTab === 'pending'}
              No pending cancellation requests at this time.
            {:else if activeTab === 'resolved'}
              No resolved cancellation requests to display.
            {:else}
              No disputed cancellations requiring attention.
            {/if}
          </p>
        </div>
      </div>
    {:else}
      <!-- Cancellation List -->
      <div class="space-y-4">
        {#each filteredCancellations as cancellation (cancellation.original_action_hash)}
          {@const userRole = cancellationManager.getUserRoleInCancellation(cancellation)}
          {@const roleDisplay = getUserRoleDisplayText(userRole)}
          {@const canRespond = cancellationManager.canUserRespondToCancellation(cancellation)}
          
          <div class="card p-6">
            <!-- Cancellation Header -->
            <header class="mb-4 flex items-start justify-between">
              <div class="flex-grow">
                <div class="mb-2 flex items-center gap-2">
                  <h3 class="font-semibold">
                    {getCancellationReasonText(cancellation.reason)}
                  </h3>
                  <span class="badge variant-soft-surface text-xs">
                    ID: {cancellation.original_action_hash ? 
                      encodeHashToBase64(cancellation.original_action_hash).slice(0, 8) + '...' : 
                      'Unknown'}
                  </span>
                </div>
                
                <div class="flex items-center gap-4 text-sm">
                  <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">schedule</span>
                    <span class="text-surface-600 dark:text-surface-300">
                      {cancellation.created_at ? formatDate(new Date(Number(cancellation.created_at))) : 'Unknown date'}
                    </span>
                  </div>
                  
                  <div class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">person</span>
                    <span class="{roleDisplay.color} font-medium">
                      {roleDisplay.text}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="text-right">
                <div class="font-medium {getCancellationStatusColor(cancellation)}">
                  {getCancellationStatusText(cancellation)}
                </div>
              </div>
            </header>

            <!-- Cancellation Details -->
            {#if cancellation.explanation}
              <div class="mb-4">
                <h4 class="mb-1 font-medium text-sm">Explanation:</h4>
                <p class="text-surface-700 dark:text-surface-200 text-sm">
                  {cancellation.explanation}
                </p>
              </div>
            {/if}

            {#if cancellation.resolution_terms}
              <div class="mb-4">
                <h4 class="mb-1 font-medium text-sm">Resolution Terms:</h4>
                <p class="text-surface-700 dark:text-surface-200 text-sm">
                  {cancellation.resolution_terms}
                </p>
              </div>
            {/if}

            <!-- Admin Notes (if reviewed) -->
            {#if cancellation.admin_reviewed && cancellation.admin_notes}
              <div class="mb-4">
                <h4 class="mb-1 font-medium text-sm">Administrator Notes:</h4>
                <div class="variant-soft-primary rounded-container-token p-3">
                  <p class="text-sm">{cancellation.admin_notes}</p>
                </div>
              </div>
            {/if}

            <!-- Action Buttons -->
            {#if canRespond && activeTab === 'pending'}
              <div class="flex justify-end gap-2">
                <button
                  class="variant-filled-error btn-sm btn"
                  onclick={() => handleRespondToCancellation(cancellation, false)}
                >
                  <span class="material-symbols-outlined">close</span>
                  <span>Reject</span>
                </button>
                <button
                  class="variant-filled-success btn-sm btn"
                  onclick={() => handleRespondToCancellation(cancellation, true)}
                >
                  <span class="material-symbols-outlined">check</span>
                  <span>Accept</span>
                </button>
              </div>
            {:else if isDisputed(cancellation) && userRole === 'initiator' && !cancellation.admin_reviewed}
              <div class="flex justify-end">
                <button
                  class="variant-filled-warning btn-sm btn"
                  onclick={() => handleEscalateToAdmin(cancellation)}
                >
                  <span class="material-symbols-outlined">escalator_warning</span>
                  <span>Escalate to Admin</span>
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <!-- Error State -->
    {#if cancellationManager.error}
      <div class="alert variant-filled-error">
        <div class="alert-message">
          <span class="material-symbols-outlined">error</span>
          <span>{cancellationManager.error}</span>
        </div>
      </div>
    {/if}
  </div>
{:else if currentUser && !isUserApproved(currentUser)}
  <!-- User needs approval -->
  <div class="card variant-soft-warning p-6">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">info</span>
      <p>Your account is pending approval before you can manage cancellation requests.</p>
    </div>
  </div>
{:else}
  <!-- Not logged in -->
  <div class="card variant-soft-surface p-6">
    <div class="text-center">
      <span class="material-symbols-outlined mb-2 text-4xl text-surface-400">login</span>
      <h3 class="h4 mb-2 font-semibold">Login Required</h3>
      <p class="text-surface-600 dark:text-surface-300">
        Please log in to view your cancellation requests.
      </p>
    </div>
  </div>
{/if}