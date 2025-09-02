<!-- StatusReasonModal.svelte - Modal for entering reason when approving/rejecting proposals -->
<script lang="ts">
  import { getModalStore } from '@skeletonlabs/skeleton';
  import type { ActionHash } from '@holochain/client';

  interface Props {
    responseHash?: ActionHash;
    action: 'approve' | 'reject';
    onConfirm?: (reason?: string) => Promise<void>;
  }

  const { responseHash: _responseHash, action, onConfirm }: Props = $props();

  const modalStore = getModalStore();

  let reason = $state('');
  let isSubmitting = $state(false);

  // Computed values
  const isApproval = $derived(action === 'approve');
  const title = $derived(isApproval ? 'Approve Proposal' : 'Reject Proposal');
  const buttonText = $derived(isApproval ? 'Approve' : 'Reject');
  const buttonVariant = $derived(isApproval ? 'variant-filled-success' : 'variant-filled-error');
  const placeholder = $derived(
    isApproval
      ? "Optional: Add a note about why you're approving this proposal..."
      : "Please explain why you're rejecting this proposal (recommended)..."
  );

  // Actions
  const handleSubmit = async () => {
    if (isSubmitting) return;

    try {
      isSubmitting = true;

      if (onConfirm) {
        await onConfirm(reason.trim() || undefined);
      }

      modalStore.close();
    } catch (error) {
      console.error(`Failed to ${action} proposal:`, error);
      // Error handling is done by the parent component
    } finally {
      isSubmitting = false;
    }
  };

  const handleCancel = () => {
    modalStore.close();
  };

  // Keyboard shortcuts
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      handleSubmit();
    } else if (event.key === 'Escape') {
      handleCancel();
    }
  };
</script>

<article class="hcron-modal max-w-lg">
  <header class="mb-6">
    <h2 class="h2 font-bold">{title}</h2>
    <p class="mt-2 text-surface-200">
      {#if isApproval}
        You're about to approve this proposal. You can optionally add a note to explain your
        decision.
      {:else}
        You're about to reject this proposal. Please consider providing a reason to help the
        proposer understand your decision.
      {/if}
    </p>
  </header>

  <div class="space-y-4">
    <!-- Reason Input -->
    <label class="label">
      <span class="font-medium">Reason {isApproval ? '(Optional)' : '(Recommended)'}</span>
      <textarea
        bind:value={reason}
        {placeholder}
        class="textarea text-surface-600"
        rows="4"
        maxlength="500"
        onkeydown={handleKeydown}
        disabled={isSubmitting}
      ></textarea>
      <div class="mt-1 text-xs text-surface-200">
        {reason.length}/500 characters
      </div>
    </label>

    <!-- Keyboard shortcuts hint -->
    <div class="text-xs text-surface-200">
      <div class="flex gap-4">
        <span><kbd class="kbd text-surface-500">Ctrl+Enter</kbd> to submit</span>
        <span><kbd class="kbd text-surface-500">Esc</kbd> to cancel</span>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="mt-6 flex justify-end gap-3">
    <button class="variant-ghost btn" onclick={handleCancel} disabled={isSubmitting}>
      Cancel
    </button>
    <button class="{buttonVariant} btn" onclick={handleSubmit} disabled={isSubmitting}>
      {#if isSubmitting}
        <i class="fas fa-spinner fa-spin mr-2"></i>
        {isApproval ? 'Approving...' : 'Rejecting...'}
      {:else}
        {buttonText}
      {/if}
    </button>
  </footer>
</article>
