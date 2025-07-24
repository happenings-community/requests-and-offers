<script lang="ts">
  import { useUserAccessGuard } from '$lib/composables/ui/useUserAccessGuard.svelte';

  type Props = {
    children: any;
    resourceType?: string;
    title?: string;
    description?: string;
    allowedStatuses?: string[]; // Allow custom allowed statuses beyond just 'approved'
  };

  const {
    children,
    resourceType = 'content',
    title,
    description,
    allowedStatuses = ['approved'] // Default to requiring approved status
  }: Props = $props();

  // Use the composable for all state management
  const guard = useUserAccessGuard({
    resourceType,
    allowedStatuses: allowedStatuses as any, // Cast for now
    autoCheck: true
  });

  // Dynamic title and description (use custom or fall back to composable)
  const dynamicTitle = $derived(title || guard.title);
  const dynamicDescription = $derived(description || guard.message);

  function handleActionClick(action: { action?: string; href?: string }) {
    if (action.action === 'retry') {
      guard.retry();
    }
    // href actions are handled by the anchor tags
  }
</script>

{#if guard.isLoading}
  <div class="flex h-64 items-center justify-center">
    <div class="flex items-center gap-4">
      <span class="animate-spin text-2xl">⏳</span>
      <p class="text-lg">Checking access permissions...</p>
    </div>
  </div>
{:else if guard.error}
  <div class="container mx-auto p-4">
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Access Check Failed</h3>
        <p>{guard.error}</p>
      </div>
      <div class="alert-actions">
        <button class="variant-filled btn btn-sm" onclick={() => guard.retry()}> Try Again </button>
      </div>
    </div>
  </div>
{:else if !guard.hasAccess}
  <!-- User access denied - show blocking message -->
  <div class="container mx-auto p-4">
    <div class="card variant-soft-warning mx-auto max-w-2xl p-8 text-center">
      <div class="mb-6">
        <div
          class="bg-warning-500/20 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        >
          <span class="text-2xl">🚫</span>
        </div>
      </div>

      <h1 class="h1 mb-4">{dynamicTitle}</h1>

      <div class="text-surface-600-300-token space-y-4">
        <p class="text-lg">{dynamicDescription}</p>

        {#if guard.tip}
          <div class="bg-surface-100-800-token rounded-lg p-4">
            <p class="text-sm">{guard.tip}</p>
          </div>
        {/if}

        {#if guard.adminGuidance}
          <div class="bg-info-100-800-token rounded-lg p-4">
            <h3 class="h4 text-info-600-400-token mb-2">Administrator Note</h3>
            <p class="text-info-600-400-token text-sm">{guard.adminGuidance}</p>
          </div>
        {/if}
      </div>

      <div class="mt-8 flex flex-wrap justify-center gap-4">
        {#each guard.actions as action}
          {#if action.href}
            <a href={action.href} class="{action.variant} btn btn-sm">
              {action.label}
            </a>
          {:else if action.action}
            <button class="{action.variant} btn btn-sm" onclick={() => handleActionClick(action)}>
              {action.label}
            </button>
          {/if}
        {/each}

        <!-- Always provide a way back home -->
        {#if guard.actions.length === 0 || !guard.actions.some((a) => a.href === '/')}
          <a href="/" class="variant-soft-surface btn btn-sm"> Back to Home </a>
        {/if}
      </div>

      <!-- Current user info for debugging (only in development) -->
      {#if guard.accessResult && import.meta.env.DEV}
        <details class="mt-6 text-left">
          <summary class="cursor-pointer text-sm opacity-50">
            Debug Info (Development Only)
          </summary>
          <div class="bg-surface-100-800-token mt-2 rounded p-2 text-xs">
            <p><strong>Status:</strong> {guard.status}</p>
            <p><strong>Has Access:</strong> {guard.hasAccess}</p>
            <p><strong>Is Admin:</strong> {guard.isAdmin}</p>
            <p><strong>User:</strong> {guard.currentUser ? 'Present' : 'None'}</p>
            <p><strong>Allowed Statuses:</strong> {allowedStatuses.join(', ')}</p>
          </div>
        </details>
      {/if}
    </div>
  </div>
{:else}
  <!-- Access granted - render the actual content -->
  {@render children()}
{/if}
