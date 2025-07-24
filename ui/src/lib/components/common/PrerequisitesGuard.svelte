<script lang="ts">
  import { usePrerequisitesGuard } from '$lib/composables/ui/usePrerequisitesGuard.svelte';

  type Props = {
    children: any;
    serviceTypesRedirectPath?: string;
    mediumsOfExchangeRedirectPath?: string;
    title?: string;
    description?: string;
  };

  const {
    children,
    serviceTypesRedirectPath = '/admin/service-types',
    mediumsOfExchangeRedirectPath = '/admin/mediums-of-exchange',
    title = 'Prerequisites Required',
    description = 'Both service types and mediums of exchange must be created/approved by administrators before they can be used in requests and offers.'
  }: Props = $props();

  // Use the composable for all state management
  const guard = usePrerequisitesGuard({
    requireServiceTypes: true,
    requireMediumsOfExchange: true,
    serviceTypesRedirectPath,
    mediumsOfExchangeRedirectPath,
    autoCheck: true
  });

  // Dynamic title and description (use custom or fall back to composable)
  const dynamicTitle = $derived(title || guard.title);
  const dynamicDescription = $derived(description || guard.description);

  function handleActionClick(action: { action?: string; href?: string }) {
    if (action.action === 'retry') {
      guard.retry();
    }
    // href actions are handled by the anchor tags
  }
</script>

{#if guard.isLoading}
  <div class="flex h-64 items-center justify-center">
    <span class="loading loading-spinner text-primary"></span>
    <p class="ml-4">Checking prerequisites...</p>
  </div>
{:else if guard.error}
  <div class="container mx-auto p-4">
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{guard.error}</p>
      </div>
      <div class="alert-actions">
        <button class="variant-filled btn btn-sm" onclick={() => guard.retry()}> Try Again </button>
      </div>
    </div>
  </div>
{:else if !guard.allPrerequisitesMet}
  <!-- Prerequisites not met - show blocking message -->
  <div class="container mx-auto p-4">
    <div class="card variant-soft-warning mx-auto max-w-2xl p-8 text-center">
      <div class="mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="mx-auto mb-4 h-16 w-16 stroke-warning-500"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>

      <h1 class="h1 mb-4">{dynamicTitle}</h1>

      <div class="space-y-4 text-surface-600">
        <p class="text-lg">{dynamicDescription}</p>

        {#if guard.prerequisiteStatus && !guard.prerequisiteStatus.serviceTypes}
          <div class="bg-surface-100-800-token rounded-lg p-4">
            <h3 class="h4 mb-2 text-warning-600">❌ Service Types Missing</h3>
            <p class="text-sm">
              Service types categorize requests and offers, making it easier for users to find what
              they need. Examples include: "Web Development", "Graphic Design", "Consulting",
              "Tutoring", etc.
            </p>
          </div>
        {/if}

        {#if guard.prerequisiteStatus && !guard.prerequisiteStatus.mediumsOfExchange}
          <div class="bg-surface-100-800-token rounded-lg p-4">
            <h3 class="h4 mb-2 text-warning-600">❌ Mediums of Exchange Missing</h3>
            <p class="text-sm">
              Mediums of exchange define how value is exchanged for services. Examples include:
              "Hours", "Money", "Points", "Barter", "Gift Economy", etc.
            </p>
          </div>
        {/if}

        <div class="bg-surface-100-800-token rounded-lg p-4">
          <h3 class="h4 mb-2">What to do?</h3>
          <p class="text-sm">
            Contact your system administrators to create/approve the necessary prerequisites.
            Administrators can manage these from the admin panel.
          </p>
        </div>
      </div>

      <div class="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
        {#each guard.actions as action}
          {#if action.href}
            <a href={action.href} class="{action.variant} btn">
              {action.label}
            </a>
          {:else if action.action}
            <button class="{action.variant} btn" onclick={() => handleActionClick(action)}>
              {action.label}
            </button>
          {/if}
        {/each}
      </div>

      <!-- Admin note (only show if user is admin) -->
      {#if guard.adminGuidance}
        <div class="bg-info-100-800-token mt-6 rounded-lg p-4">
          <p class="text-info-600-400-token mb-2 text-sm">
            <strong>You are an Administrator:</strong>
          </p>
          <div class="flex flex-col gap-2 text-sm">
            {#if guard.prerequisiteStatus && !guard.prerequisiteStatus.serviceTypes}
              <div>
                • Create service types from the
                <a href={serviceTypesRedirectPath} class="underline hover:no-underline">
                  Admin Service Types page
                </a>
              </div>
            {/if}
            {#if guard.prerequisiteStatus && !guard.prerequisiteStatus.mediumsOfExchange}
              <div>
                • Approve mediums of exchange from the
                <a href={mediumsOfExchangeRedirectPath} class="underline hover:no-underline">
                  Admin Mediums of Exchange page
                </a>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <!-- All prerequisites met - render the actual content -->
  {@render children()}
{/if}
