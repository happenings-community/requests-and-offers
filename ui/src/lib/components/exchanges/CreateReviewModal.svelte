<script lang="ts">
  import { getToastStore, getModalStore } from '@skeletonlabs/skeleton';
  import { createExchangesStore } from '$lib/stores/exchanges.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import type { ActionHash } from '@holochain/client';

  // Props from modal store
  const modalStore = getModalStore();
  const toastStore = getToastStore();
  const exchangesStore = createExchangesStore();

  // Get props from modal meta
  const {
    agreementHash,
    agreementTitle,
    onSuccess
  }: {
    agreementHash: ActionHash;
    agreementTitle: string;
    onSuccess?: () => void;
  } = $modalStore[0].meta;

  // Form state
  let formData = $state({
    rating: 5,
    comments: '',
    reviewer_type: 'Provider' as 'Provider' | 'Receiver'
  });

  let isLoading = $state(false);
  let formErrors = $state<Record<string, string>>({});

  // Validation
  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (formData.rating < 1 || formData.rating > 5) {
      errors.rating = 'Rating must be between 1 and 5';
    }

    formErrors = errors;
    return Object.keys(errors).length === 0;
  }

  // Submit handler
  async function handleSubmit() {
    if (!validateForm()) {
      return;
    }

    isLoading = true;
    try {
      const reviewInput = {
        agreement_hash: agreementHash,
        rating: formData.rating,
        comments: formData.comments.trim() || null,
        reviewer_type: formData.reviewer_type
      };

      await runEffect(exchangesStore.createReview(reviewInput));

      toastStore.trigger({
        message: 'Review created successfully!',
        background: 'variant-filled-success'
      });

      modalStore.close();

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to create review:', error);
      toastStore.trigger({
        message: `Failed to create review: ${error instanceof Error ? error.message : String(error)}`,
        background: 'variant-filled-error'
      });
    } finally {
      isLoading = false;
    }
  }

  function handleCancel() {
    modalStore.close();
  }
</script>

<article class="hcron-modal max-w-lg">
  <header class="mb-6">
    <h2 class="h2 font-bold">Create Review</h2>
    <p class="mt-2 text-surface-200">
      Share your experience for: <strong>{agreementTitle}</strong>
    </p>
  </header>

  <div class="space-y-4">
    <!-- Rating -->
    <label class="label">
      <span class="font-medium">Rating <span class="text-error-500">*</span></span>
      <div class="flex items-center gap-2">
        {#each [1, 2, 3, 4, 5] as star}
          <button
            type="button"
            class="text-2xl transition-colors hover:text-warning-500"
            class:text-warning-500={star <= formData.rating}
            class:text-surface-400={star > formData.rating}
            onclick={() => (formData.rating = star)}
            disabled={isLoading}
          >
            ★
          </button>
        {/each}
        <span class="ml-2 text-sm text-surface-600 dark:text-surface-400">
          {formData.rating} / 5 stars
        </span>
      </div>
      {#if formErrors.rating}
        <span class="mt-1 text-sm text-error-500">{formErrors.rating}</span>
      {/if}
    </label>

    <!-- Reviewer Type -->
    <label class="label">
      <span class="font-medium">Your Role</span>
      <select bind:value={formData.reviewer_type} class="select" disabled={isLoading}>
        <option value="Provider">Provider (I provided the service)</option>
        <option value="Receiver">Receiver (I received the service)</option>
      </select>
    </label>

    <!-- Comments -->
    <label class="label">
      <span class="font-medium">Comments</span>
      <textarea
        bind:value={formData.comments}
        class="textarea text-surface-600"
        rows="4"
        placeholder="Share your experience, what went well, areas for improvement..."
        disabled={isLoading}
      ></textarea>
    </label>
  </div>

  <!-- Footer -->
  <footer class="mt-6 flex justify-end gap-3">
    <button class="variant-ghost btn" onclick={handleCancel} disabled={isLoading}>
      Cancel
    </button>
    <button class="variant-filled-primary btn" onclick={handleSubmit} disabled={isLoading}>
      {#if isLoading}
        <i class="fas fa-spinner fa-spin mr-2"></i>
        Creating...
      {:else}
        Create Review
      {/if}
    </button>
  </footer>
</article>