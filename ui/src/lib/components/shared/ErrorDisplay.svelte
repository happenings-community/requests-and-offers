<script lang="ts">
  import { UIErrorHandling } from '$lib/errors';
  import { createEventDispatcher } from 'svelte';

  type Props = {
    error: any;
    showRetry?: boolean;
    showDismiss?: boolean;
    context?: string;
    variant?: 'toast' | 'inline' | 'banner' | 'modal';
    size?: 'sm' | 'md' | 'lg';
    retryLabel?: string;
    dismissLabel?: string;
    retryDisabled?: boolean;
  };

  const {
    error,
    showRetry = false,
    showDismiss = true,
    context,
    variant = 'inline',
    size = 'md',
    retryLabel = 'Retry',
    dismissLabel = 'Dismiss',
    retryDisabled = false
  }: Props = $props();

  const dispatch = createEventDispatcher<{
    retry: void;
    dismiss: void;
  }>();

  const errorMessage = $derived(() => {
    if (!error) return '';

    let message = UIErrorHandling.formatForUser(error);

    if (context) {
      message = `${context}: ${message}`;
    }

    return message;
  });

  let shouldShow = $state(false);
  $effect(() => {
    shouldShow = !!(error && UIErrorHandling.shouldDisplayToUser(error));
  });

  const variantClasses = $derived(() => {
    switch (variant) {
      case 'toast':
        return 'alert variant-filled-error rounded-lg shadow-lg';
      case 'inline':
        return 'alert variant-ghost-error';
      case 'banner':
        return 'alert variant-filled-error rounded-none border-0 border-l-4 border-error-500';
      case 'modal':
        return 'card variant-filled-error p-6';
      default:
        return 'alert variant-ghost-error';
    }
  });

  const sizeClasses = $derived(() => {
    switch (size) {
      case 'sm':
        return 'text-sm p-3';
      case 'md':
        return 'text-base p-4';
      case 'lg':
        return 'text-lg p-6';
      default:
        return 'text-base p-4';
    }
  });

  const iconClasses = $derived(() => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4';
      case 'md':
        return 'w-5 h-5';
      case 'lg':
        return 'w-6 h-6';
      default:
        return 'w-5 h-5';
    }
  });

  function handleRetry() {
    dispatch('retry');
  }

  function handleDismiss() {
    dispatch('dismiss');
  }
</script>

{#if shouldShow}
  <div
    class={`${variantClasses} ${sizeClasses} flex items-start gap-3`}
    role="alert"
    aria-live="polite"
  >
    <!-- Error Icon -->
    <div class="flex-shrink-0">
      <svg
        class={`${iconClasses} text-error-500`}
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
          clip-rule="evenodd"
        />
      </svg>
    </div>

    <!-- Error Content -->
    <div class="min-w-0 flex-1">
      <p class="font-medium">
        {errorMessage}
      </p>

      <!-- Additional error details for development -->
      {#if import.meta.env.DEV && error?._tag}
        <p class="mt-1 text-xs opacity-75">
          Error Type: {error._tag}
          {#if error?.cause}
            | Cause: {String(error.cause).substring(0, 100)}
          {/if}
        </p>
      {/if}
    </div>

    <!-- Action Buttons -->
    {#if showRetry || showDismiss}
      <div class="flex flex-shrink-0 gap-2">
        {#if showRetry}
          <button
            type="button"
            class="variant-ghost-surface btn btn-sm"
            onclick={handleRetry}
            disabled={retryDisabled}
            aria-label="Retry the failed operation"
          >
            {retryLabel}
          </button>
        {/if}

        {#if showDismiss}
          <button
            type="button"
            class="variant-ghost-surface btn btn-sm p-1"
            onclick={handleDismiss}
            aria-label="Dismiss this error"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
              />
            </svg>
            <span class="sr-only">{dismissLabel}</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
