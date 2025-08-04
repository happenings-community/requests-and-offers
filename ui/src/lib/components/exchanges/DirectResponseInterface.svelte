<script lang="ts">
  import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';
  import type { UIRequest, UIOffer } from '$lib/types/ui';
  import { useExchangeProposalsManagement } from '$lib/composables/domain/exchanges';
  import { isUserApproved } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';
  import { encodeHashToBase64 } from '@holochain/client';
  import { goto } from '$app/navigation';

  // Props
  interface Props {
    entity: UIRequest | UIOffer;
    entityType: 'request' | 'offer';
    entityHash: ActionHash;
  }
  
  let { entity, entityType, entityHash }: Props = $props();

  // Stores and composables
  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const exchangeProposals = useExchangeProposalsManagement();
  const { currentUser } = $derived(usersStore);

  // Form state
  let showResponseForm = $state(false);
  let isSubmitting = $state(false);
  let formData = $state({
    service_details: '',
    terms: '',
    exchange_medium: '',
    exchange_value: '',
    delivery_timeframe: '',
    notes: ''
  });

  // Check if user can respond
  const canRespond = $derived.by(() => {
    if (!currentUser || !isUserApproved(currentUser)) return false;
    
    // Users cannot respond to their own requests/offers
    if (entity.creator?.toString() === currentUser.original_action_hash?.toString()) {
      return false;
    }
    
    // Check if user is part of the organization (if it's an org entity)
    if (entity.organization && currentUser.organizations) {
      const isOrgMember = currentUser.organizations.some(
        org => org.toString() === entity.organization?.toString()
      );
      if (isOrgMember) return false;
    }
    
    return true;
  });

  // Generate helpful defaults based on entity
  const suggestionText = $derived(() => {
    const type = entityType === 'request' ? 'request' : 'offer';
    return `I'm interested in your ${type} for "${entity.title}".`;
  });

  const suggestedServiceDetails = $derived(() => {
    if (entityType === 'request') {
      return `I can provide the ${entity.title} service as requested.`;
    } else {
      return `I would like to use your ${entity.title} service.`;
    }
  });

  // Handle form submission
  async function handleSubmitResponse(event: SubmitEvent) {
    event.preventDefault();
    if (!canRespond || isSubmitting) return;

    isSubmitting = true;
    
    try {
      await exchangeProposals.createDirectResponse(
        entityHash,
        entityType,
        {
          service_details: formData.service_details || suggestedServiceDetails(),
          terms: formData.terms,
          exchange_medium: formData.exchange_medium,
          exchange_value: formData.exchange_value || undefined,
          delivery_timeframe: formData.delivery_timeframe || undefined,
          notes: formData.notes || undefined
        }
      );

      toastStore.trigger({
        message: 'Response sent successfully!',
        background: 'variant-filled-success'
      });

      // Reset form and hide it
      formData = {
        service_details: '',
        terms: '',
        exchange_medium: '',
        exchange_value: '',
        delivery_timeframe: '',
        notes: ''
      };
      showResponseForm = false;

      // Close modal and navigate to exchanges
      modalStore.close();
      goto('/exchanges');

    } catch (error) {
      console.error('Failed to create response:', error);
      toastStore.trigger({
        message: `Failed to send response: ${error instanceof Error ? error.message : String(error)}`,
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
    showResponseForm = false;
  }

  function fillSuggestion() {
    formData.service_details = suggestedServiceDetails();
  }
</script>

<!-- Direct Response Interface -->
{#if canRespond}
  <div class="border-primary-500/20 rounded-container-token border-2 bg-gradient-to-br from-primary-50 to-secondary-50 p-4 dark:from-primary-950/30 dark:to-secondary-950/30">
    <header class="mb-3 flex items-center gap-2">
      <span class="material-symbols-outlined text-primary-500">handshake</span>
      <h3 class="h4 font-semibold text-primary-700 dark:text-primary-300">Quick Response</h3>
    </header>

    {#if !showResponseForm}
      <!-- Response Button -->
      <div class="space-y-2">
        <p class="text-sm text-surface-600 dark:text-surface-300">
          Interested in this {entityType}?
          {#if entityType === 'request'}
            Let them know how you can help!
          {:else}
            Let them know you'd like their service!
          {/if}
        </p>
        <button 
          class="variant-filled-primary btn w-full"
          onclick={() => showResponseForm = true}
        >
          <span class="material-symbols-outlined">reply</span>
          <span>Respond to {entityType === 'request' ? 'Request' : 'Offer'}</span>
        </button>
      </div>
    {:else}
      <!-- Response Form -->
      <form class="space-y-4" onsubmit={handleSubmitResponse}>
        <!-- Service Details -->
        <div>
          <label class="label" for="service_details">
            <span>How can you help? *</span>
          </label>
          <div class="space-y-2">
            <textarea
              id="service_details"
              class="textarea"
              placeholder={suggestedServiceDetails()}
              bind:value={formData.service_details}
              rows="3"
              required
            ></textarea>
            <button 
              type="button"
              class="variant-ghost-primary btn-sm btn"
              onclick={fillSuggestion}
            >
              <span class="material-symbols-outlined">auto_fix_high</span>
              <span>Use Suggestion</span>
            </button>
          </div>
        </div>

        <!-- Terms -->
        <div>
          <label class="label" for="terms">
            <span>Your Terms & Conditions *</span>
          </label>
          <textarea
            id="terms"
            class="textarea"
            placeholder="Describe your availability, requirements, or any conditions..."
            bind:value={formData.terms}
            rows="2"
            required
          ></textarea>
        </div>

        <!-- Exchange Medium -->
        <div>
          <label class="label" for="exchange_medium">
            <span>What are you looking for in exchange? *</span>
          </label>
          <input
            id="exchange_medium"
            class="input"
            type="text"
            placeholder="e.g., Payment, Trade, Volunteer work, Skills exchange..."
            bind:value={formData.exchange_medium}
            required
          />
        </div>

        <!-- Exchange Value (Optional) -->
        <div>
          <label class="label" for="exchange_value">
            <span>Value/Amount (Optional)</span>
          </label>
          <input
            id="exchange_value"
            class="input"
            type="text"
            placeholder="e.g., $50/hour, 2 hours of design work, Negotiable..."
            bind:value={formData.exchange_value}
          />
        </div>

        <!-- Delivery Timeframe (Optional) -->
        <div>
          <label class="label" for="delivery_timeframe">
            <span>When can you deliver? (Optional)</span>
          </label>
          <input
            id="delivery_timeframe"
            class="input"
            type="text"
            placeholder="e.g., Within 1 week, By end of month, Flexible..."
            bind:value={formData.delivery_timeframe}
          />
        </div>

        <!-- Additional Notes (Optional) -->
        <div>
          <label class="label" for="notes">
            <span>Additional Notes (Optional)</span>
          </label>
          <textarea
            id="notes"
            class="textarea"
            placeholder="Any additional information, questions, or requirements..."
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
            class="variant-filled-primary btn"
            disabled={isSubmitting || !formData.service_details.trim() || !formData.terms.trim() || !formData.exchange_medium.trim()}
          >
            {#if isSubmitting}
              <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
              <span>Sending...</span>
            {:else}
              <span class="material-symbols-outlined">send</span>
              <span>Send Response</span>
            {/if}
          </button>
        </div>
      </form>
    {/if}
  </div>
{:else if currentUser && !isUserApproved(currentUser)}
  <!-- User needs approval -->
  <div class="variant-soft-warning rounded-container-token p-3">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">info</span>
      <p class="text-sm">Your account is pending approval before you can respond to {entityType}s.</p>
    </div>
  </div>
{:else if entity.creator?.toString() === currentUser?.original_action_hash?.toString()}
  <!-- Own entity -->
  <div class="variant-soft-surface rounded-container-token p-3">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">person</span>
      <p class="text-sm">This is your own {entityType}.</p>
    </div>
  </div>
{/if}