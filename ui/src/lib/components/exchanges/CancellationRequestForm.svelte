<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import type { UIAgreement } from '$lib/types/ui';
  import type { CancellationReason, CancellationInitiator } from '$lib/schemas/exchanges.schemas';
  import { useExchangeCancellationManagement } from '$lib/composables/domain/exchanges';
  import { isUserApproved } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';

  // Props
  interface Props {
    agreement: UIAgreement;
    agreementHash: ActionHash;
    onCancel?: () => void;
    onSuccess?: () => void;
  }

  let { agreement, agreementHash, onCancel, onSuccess }: Props = $props();

  // Store and composable
  const { currentUser } = $derived(usersStore);
  const cancellationManager = useExchangeCancellationManagement();

  // Form state
  let isSubmitting = $state(false);
  let formData = $state({
    reason: 'MutualAgreement' as CancellationReason,
    initiator: 'Provider' as CancellationInitiator,
    explanation: '',
    resolution_terms: ''
  });

  // Cancellation reasons with user-friendly labels
  const cancellationReasons: Array<{ value: CancellationReason; label: string; description: string }> = [
    {
      value: 'MutualAgreement',
      label: 'Mutual Agreement',
      description: 'Both parties agree to cancel this exchange'
    },
    {
      value: 'ProviderUnavailable',
      label: 'Provider Unavailable',
      description: 'Service provider cannot fulfill the service'
    },
    {
      value: 'ReceiverNoLongerNeeds',
      label: 'Receiver No Longer Needs',
      description: 'Service receiver no longer requires the service'
    },
    {
      value: 'ExternalCircumstances',
      label: 'External Circumstances',
      description: 'Circumstances beyond control prevent completion'
    },
    {
      value: 'TechnicalFailure',
      label: 'Technical Failure',
      description: 'Technical issues prevent service completion'
    }
  ];

  // Check if user can create cancellation
  const canInitiateCancellation = $derived.by(() => {
    if (!currentUser || !isUserApproved(currentUser)) return false;
    return cancellationManager.canUserInitiateCancellation(agreement);
  });

  // Check if form is valid
  const isFormValid = $derived.by(() => {
    return formData.explanation.trim().length >= 10 && 
           !isSubmitting;
  });

  // Determine user's role in the agreement
  const userRole = $derived.by(() => {
    if (!currentUser?.original_action_hash) return null;
    
    if (agreement.provider_hash?.toString() === currentUser.original_action_hash.toString()) {
      return 'Provider';
    } else if (agreement.receiver_hash?.toString() === currentUser.original_action_hash.toString()) {
      return 'Receiver';
    }
    return null;
  });

  // Update initiator based on user role
  $effect(() => {
    if (userRole) {
      formData.initiator = userRole as CancellationInitiator;
    }
  });

  async function handleSubmitCancellation(event: SubmitEvent) {
    event.preventDefault();
    
    if (!canInitiateCancellation || !isFormValid) return;

    isSubmitting = true;

    try {
      if (formData.reason === 'MutualAgreement') {
        // Use mutual cancellation for mutual agreement
        await cancellationManager.initiateMutualCancellation(
          agreementHash,
          formData.reason,
          formData.explanation
        );
      } else {
        // Use unilateral cancellation for other reasons
        await cancellationManager.initiateCancellation(
          agreementHash,
          formData.reason,
          formData.initiator,
          formData.explanation
        );
      }

      // Reset form
      formData = {
        reason: 'MutualAgreement',
        initiator: userRole as CancellationInitiator || 'Provider',
        explanation: '',
        resolution_terms: ''
      };

      onSuccess?.();
    } catch (error) {
      console.error('Failed to initiate cancellation:', error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    // Reset form
    formData = {
      reason: 'MutualAgreement',
      initiator: userRole as CancellationInitiator || 'Provider',
      explanation: '',
      resolution_terms: ''
    };
    
    onCancel?.();
  }
</script>

<!-- Cancellation Request Form -->
{#if canInitiateCancellation}
  <div class="card variant-soft-warning p-6">
    <header class="mb-4 flex items-center gap-2">
      <span class="material-symbols-outlined text-warning-600">warning</span>
      <h3 class="h4 font-semibold">Request Exchange Cancellation</h3>
    </header>

    <form class="space-y-4" onsubmit={handleSubmitCancellation}>
      <!-- Cancellation Reason -->
      <div>
        <label class="label" for="cancellation_reason">
          <span>Reason for Cancellation *</span>
        </label>
        <select
          id="cancellation_reason"
          class="select"
          bind:value={formData.reason}
          required
        >
          {#each cancellationReasons as reasonOption}
            <option value={reasonOption.value}>
              {reasonOption.label}
            </option>
          {/each}
        </select>
        
        <!-- Reason description -->
        {#each cancellationReasons as reasonOption}
          {#if reasonOption.value === formData.reason}
            <p class="text-surface-600 dark:text-surface-300 mt-1 text-sm">
              {reasonOption.description}
            </p>
          {/if}
        {/each}
      </div>

      <!-- User Role Information -->
      {#if userRole}
        <div class="variant-soft-surface card p-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary-500">person</span>
            <span class="text-sm">
              You are initiating this cancellation as the <strong>{userRole}</strong> in this exchange.
            </span>
          </div>
        </div>
      {/if}

      <!-- Explanation -->
      <div>
        <label class="label" for="cancellation_explanation">
          <span>Explanation *</span>
        </label>
        <textarea
          id="cancellation_explanation"
          class="textarea"
          placeholder="Please provide a detailed explanation for this cancellation request. This will help the other party understand the situation. (Minimum 10 characters)"
          bind:value={formData.explanation}
          rows="4"
          required
          minlength="10"
        ></textarea>
        <div class="text-surface-500 mt-1 text-xs">
          {formData.explanation.length}/10 minimum characters
        </div>
      </div>

      <!-- Resolution Terms (for Mutual Agreement) -->
      {#if formData.reason === 'MutualAgreement'}
        <div>
          <label class="label" for="resolution_terms">
            <span>Resolution Terms (Optional)</span>
          </label>
          <textarea
            id="resolution_terms"
            class="textarea"
            placeholder="Any specific terms or conditions for this mutual cancellation..."
            bind:value={formData.resolution_terms}
            rows="2"
          ></textarea>
        </div>
      {/if}

      <!-- Warning for Mutual Agreement -->
      {#if formData.reason === 'MutualAgreement'}
        <div class="alert variant-soft-primary">
          <div class="alert-message">
            <span class="material-symbols-outlined">info</span>
            <span class="text-sm">
              This will be processed as a mutual cancellation request. The other party will be notified and can confirm their agreement.
            </span>
          </div>
        </div>
      {:else}
        <div class="alert variant-soft-warning">
          <div class="alert-message">
            <span class="material-symbols-outlined">warning</span>
            <span class="text-sm">
              This will initiate a cancellation request that requires the other party's consent. They can accept or dispute this cancellation.
            </span>
          </div>
        </div>
      {/if}

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
          class="variant-filled-warning btn"
          disabled={!isFormValid}
        >
          {#if isSubmitting}
            <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
            <span>Submitting...</span>
          {:else}
            <span class="material-symbols-outlined">report_problem</span>
            <span>Request Cancellation</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
{:else if currentUser && !isUserApproved(currentUser)}
  <!-- User needs approval -->
  <div class="variant-soft-warning rounded-container-token p-3">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">info</span>
      <p class="text-sm">Your account is pending approval before you can initiate cancellation requests.</p>
    </div>
  </div>
{:else}
  <!-- User cannot initiate cancellation -->
  <div class="variant-soft-surface rounded-container-token p-3">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">info</span>
      <p class="text-sm">You are not authorized to initiate cancellation for this exchange.</p>
    </div>
  </div>
{/if}