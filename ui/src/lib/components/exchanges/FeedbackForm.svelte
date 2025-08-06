<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import type { UIAgreement } from '$lib/types/ui';
  import type {
    CreateMutualValidationInput,
    CreatePublicReviewInput
  } from '$lib/schemas/exchanges.schemas';
  import { useExchangeFeedbackManagement } from '$lib/composables/domain/exchanges';
  import { isUserApproved } from '$lib/utils';
  import usersStore from '$lib/stores/users.store.svelte';

  // Props
  interface Props {
    agreement: UIAgreement;
    agreementHash: ActionHash;
    onCancel?: () => void;
    onSuccess?: () => void;
    reviewType?: 'validation' | 'public' | 'both';
  }

  let { agreement, agreementHash, onCancel, onSuccess, reviewType = 'both' }: Props = $props();

  // Store and composable
  const { currentUser } = $derived(usersStore);
  const feedbackManager = useExchangeFeedbackManagement();

  // Form state
  let isSubmitting = $state(false);
  let currentStep = $state<'validation' | 'review'>('validation');

  // Validation form data
  let validationData = $state({
    provider_validation: false,
    receiver_validation: false
  });

  // Review form data
  let reviewData = $state({
    completed_on_time: true,
    completed_as_agreed: true,
    rating: 5,
    comments: '',
    reviewer_type: 'Provider' as 'Provider' | 'Receiver'
  });

  // Check if user can submit feedback
  const canSubmitFeedback = $derived.by(() => {
    if (!currentUser || !isUserApproved(currentUser)) return false;

    // Check if user is part of the agreement
    const userHash = currentUser.original_action_hash?.toString();
    const providerHash = agreement.provider_hash?.toString();
    const receiverHash = agreement.receiver_hash?.toString();

    return userHash === providerHash || userHash === receiverHash;
  });

  // Determine user's role in the agreement
  const userRole = $derived.by(() => {
    if (!currentUser?.original_action_hash) return null;

    const userHash = currentUser.original_action_hash.toString();
    if (agreement.provider_hash?.toString() === userHash) {
      return 'Provider';
    } else if (agreement.receiver_hash?.toString() === userHash) {
      return 'Receiver';
    }
    return null;
  });

  // Update reviewer type based on user role
  $effect(() => {
    if (userRole) {
      reviewData.reviewer_type = userRole as 'Provider' | 'Receiver';
    }
  });

  // Check what forms to show
  const showValidationOnly = $derived.by(() => reviewType === 'validation');
  const showReviewOnly = $derived.by(() => reviewType === 'public');
  const showBothSteps = $derived.by(() => reviewType === 'both');

  // Form validation
  const isValidationFormValid = $derived.by(() => {
    return validationData.provider_validation || validationData.receiver_validation;
  });

  const isReviewFormValid = $derived.by(() => {
    return reviewData.rating >= 0 && reviewData.rating <= 5 && !isSubmitting;
  });

  // Star rating component
  function setRating(rating: number) {
    reviewData.rating = rating;
  }

  // Form submission handlers
  async function handleValidationSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!canSubmitFeedback || !isValidationFormValid) return;

    isSubmitting = true;

    try {
      await feedbackManager.submitMutualValidation(agreementHash, {
        provider_validation: validationData.provider_validation,
        receiver_validation: validationData.receiver_validation
      });

      if (showValidationOnly) {
        // Reset form
        validationData = {
          provider_validation: false,
          receiver_validation: false
        };

        onSuccess?.();
      } else if (showBothSteps) {
        // Move to review step
        currentStep = 'review';
      }
    } catch (error) {
      console.error('Failed to submit validation:', error);
    } finally {
      isSubmitting = false;
    }
  }

  async function handleReviewSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (!canSubmitFeedback || !isReviewFormValid) return;

    isSubmitting = true;

    try {
      await feedbackManager.submitPublicReview(agreementHash, {
        completed_on_time: reviewData.completed_on_time,
        completed_as_agreed: reviewData.completed_as_agreed,
        rating: reviewData.rating,
        comments: reviewData.comments || undefined,
        reviewer_type: reviewData.reviewer_type,
        provider_validation: reviewData.completed_as_agreed, // Map to schema field
        receiver_validation: reviewData.completed_on_time // Map to schema field
      });

      // Reset form
      reviewData = {
        completed_on_time: true,
        completed_as_agreed: true,
        rating: 5,
        comments: '',
        reviewer_type: (userRole as 'Provider' | 'Receiver') || 'Provider'
      };

      onSuccess?.();
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    // Reset forms
    validationData = {
      provider_validation: false,
      receiver_validation: false
    };

    reviewData = {
      completed_on_time: true,
      completed_as_agreed: true,
      rating: 5,
      comments: '',
      reviewer_type: (userRole as 'Provider' | 'Receiver') || 'Provider'
    };

    currentStep = 'validation';
    onCancel?.();
  }
</script>

<!-- Feedback Collection Form -->
{#if canSubmitFeedback}
  <div class="card variant-soft-success p-6">
    <header class="mb-6 flex items-center gap-2">
      <span class="material-symbols-outlined text-success-600">rate_review</span>
      <h3 class="h4 font-semibold">Exchange Feedback</h3>
    </header>

    <!-- Step Indicator (for both validation and review) -->
    {#if showBothSteps}
      <div class="mb-6 flex items-center justify-center">
        <div class="flex items-center gap-2">
          <!-- Validation Step -->
          <div class="flex items-center gap-2">
            <div
              class="variant-filled-primary flex size-8 items-center justify-center rounded-full text-sm font-bold {currentStep ===
              'validation'
                ? ''
                : 'variant-filled-success'}"
            >
              {#if currentStep === 'review'}
                <span class="material-symbols-outlined text-sm">check</span>
              {:else}
                1
              {/if}
            </div>
            <span class="text-sm font-medium">Validation</span>
          </div>

          <!-- Connector -->
          <div class="border-surface-300 dark:border-surface-600 mx-4 h-px w-8 border-t-2"></div>

          <!-- Review Step -->
          <div class="flex items-center gap-2">
            <div
              class="flex size-8 items-center justify-center rounded-full text-sm font-bold {currentStep ===
              'review'
                ? 'variant-filled-primary'
                : 'variant-ghost-surface'}"
            >
              2
            </div>
            <span class="text-sm font-medium">Review</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- User Role Information -->
    {#if userRole}
      <div class="variant-soft-primary card mb-4 p-3">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary-500">badge</span>
          <span class="text-sm">
            You are providing feedback as the <strong>{userRole}</strong> in this exchange.
          </span>
        </div>
      </div>
    {/if}

    <!-- Validation Form -->
    {#if (showValidationOnly || showBothSteps) && currentStep === 'validation'}
      <form class="space-y-4" onsubmit={handleValidationSubmit}>
        <div class="space-y-3">
          <h4 class="font-semibold">Exchange Completion Validation</h4>
          <p class="text-surface-600 dark:text-surface-300 text-sm">
            Please confirm the completion status from your perspective as the {userRole?.toLowerCase()}.
          </p>

          <!-- Provider Completion -->
          <label class="flex items-center space-x-3">
            <input
              class="checkbox"
              type="checkbox"
              bind:checked={validationData.provider_validation}
            />
            <div class="label-text">
              <div class="font-medium">Service provider completed their part</div>
              <div class="text-surface-600 dark:text-surface-300 text-sm">
                The provider has fulfilled their obligations in this exchange
              </div>
            </div>
          </label>

          <!-- Receiver Completion -->
          <label class="flex items-center space-x-3">
            <input
              class="checkbox"
              type="checkbox"
              bind:checked={validationData.receiver_validation}
            />
            <div class="label-text">
              <div class="font-medium">Service receiver completed their part</div>
              <div class="text-surface-600 dark:text-surface-300 text-sm">
                The receiver has fulfilled their obligations (payment, feedback, etc.)
              </div>
            </div>
          </label>
        </div>

        <!-- Validation Actions -->
        <div class="flex justify-end gap-2 pt-4">
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
            class="variant-filled-success btn"
            disabled={!isValidationFormValid}
          >
            {#if isSubmitting}
              <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
              <span>Submitting...</span>
            {:else if showValidationOnly}
              <span class="material-symbols-outlined">check_circle</span>
              <span>Submit Validation</span>
            {:else}
              <span class="material-symbols-outlined">arrow_forward</span>
              <span>Continue to Review</span>
            {/if}
          </button>
        </div>
      </form>
    {/if}

    <!-- Review Form -->
    {#if showReviewOnly || (showBothSteps && currentStep === 'review')}
      <form class="space-y-6" onsubmit={handleReviewSubmit}>
        <div class="space-y-4">
          <h4 class="font-semibold">Public Review</h4>
          <p class="text-surface-600 dark:text-surface-300 text-sm">
            Share your experience to help the community (optional but recommended).
          </p>

          <!-- Completion Assessment -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label class="flex items-center space-x-3">
              <input class="checkbox" type="checkbox" bind:checked={reviewData.completed_on_time} />
              <div class="label-text">
                <div class="font-medium">Completed on time</div>
                <div class="text-surface-600 dark:text-surface-300 text-sm">
                  The service was delivered within the agreed timeframe
                </div>
              </div>
            </label>

            <label class="flex items-center space-x-3">
              <input
                class="checkbox"
                type="checkbox"
                bind:checked={reviewData.completed_as_agreed}
              />
              <div class="label-text">
                <div class="font-medium">Completed as agreed</div>
                <div class="text-surface-600 dark:text-surface-300 text-sm">
                  The service met the agreed-upon requirements
                </div>
              </div>
            </label>
          </div>

          <!-- Star Rating -->
          <div>
            <div class="label mb-2">
              <span class="font-medium">Overall Rating *</span>
            </div>
            <div class="flex items-center gap-1">
              {#each Array(6) as _, index}
                <button
                  type="button"
                  class="hover:text-warning-500 text-2xl transition-colors {reviewData.rating >=
                  index
                    ? 'text-warning-500'
                    : 'text-surface-300 dark:text-surface-600'}"
                  onclick={() => setRating(index)}
                >
                  {#if reviewData.rating >= index}
                    <span class="material-symbols-outlined">star</span>
                  {:else}
                    <span class="material-symbols-outlined">star_border</span>
                  {/if}
                </button>
              {/each}
              <span class="text-surface-600 dark:text-surface-300 ml-2 text-sm">
                {reviewData.rating}/5 stars
              </span>
            </div>
          </div>

          <!-- Written Review -->
          <div>
            <label class="label" for="review_comments">
              <span>Written Review (Optional)</span>
            </label>
            <textarea
              id="review_comments"
              class="textarea"
              placeholder="Share details about your experience, what went well, areas for improvement, or any other feedback..."
              bind:value={reviewData.comments}
              rows="4"
            ></textarea>
          </div>

          <!-- Note: Reviews are automatically public -->
          <div class="variant-soft-primary rounded-container-token p-3">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary-500">info</span>
              <p class="text-sm">
                <strong>Public Review:</strong> This review will be visible to other community members to help build trust and transparency.
              </p>
            </div>
          </div>
        </div>

        <!-- Review Actions -->
        <div class="flex justify-end gap-2 pt-4">
          {#if showBothSteps}
            <button
              type="button"
              class="variant-ghost-surface btn"
              onclick={() => (currentStep = 'validation')}
              disabled={isSubmitting}
            >
              <span class="material-symbols-outlined">arrow_back</span>
              <span>Back</span>
            </button>
          {/if}

          <button
            type="button"
            class="variant-ghost-surface btn"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button type="submit" class="variant-filled-primary btn" disabled={!isReviewFormValid}>
            {#if isSubmitting}
              <span class="material-symbols-outlined animate-spin">hourglass_empty</span>
              <span>Submitting...</span>
            {:else}
              <span class="material-symbols-outlined">rate_review</span>
              <span>Submit Review</span>
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
      <p class="text-sm">Your account is pending approval before you can submit feedback.</p>
    </div>
  </div>
{:else}
  <!-- User cannot submit feedback -->
  <div class="variant-soft-surface rounded-container-token p-3">
    <div class="flex items-center gap-2">
      <span class="material-symbols-outlined">info</span>
      <p class="text-sm">You are not authorized to submit feedback for this exchange.</p>
    </div>
  </div>
{/if}
