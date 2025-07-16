<script lang="ts">
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { getToastStore } from '@skeletonlabs/skeleton';

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

  // Toast store for notifications
  const toastStore = getToastStore();

  // State
  let hasServiceTypes = $state<boolean | null>(null); // null = loading, boolean = result
  let hasMediumsOfExchange = $state<boolean | null>(null);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  // Derived state for overall prerequisites
  const allPrerequisitesMet = $derived(
    hasServiceTypes === true && hasMediumsOfExchange === true
  );
  const isStillLoading = $derived(
    isLoading || hasServiceTypes === null || hasMediumsOfExchange === null
  );

  // Check for prerequisites on mount
  $effect(() => {
    Promise.all([
      checkServiceTypes(),
      checkMediumsOfExchange(),
      administrationStore.checkIfAgentIsAdministrator()
    ]);
  });

  async function checkServiceTypes() {
    try {
      await runEffect(serviceTypesStore.getApprovedServiceTypes());
      hasServiceTypes = serviceTypesStore.approvedServiceTypes.length > 0;
    } catch (err) {
      console.error('Failed to check service types:', err);
      hasServiceTypes = false;
      if (!error) {
        error = 'Failed to check prerequisites';
        toastStore.trigger({
          message: 'Failed to check service types availability',
          background: 'variant-filled-warning'
        });
      }
    }
  }

  async function checkMediumsOfExchange() {
    try {
      await runEffect(mediumsOfExchangeStore.getApprovedMediumsOfExchange());
      hasMediumsOfExchange = mediumsOfExchangeStore.approvedMediumsOfExchange.length > 0;
    } catch (err) {
      console.error('Failed to check mediums of exchange:', err);
      hasMediumsOfExchange = false;
      if (!error) {
        error = 'Failed to check prerequisites';
        toastStore.trigger({
          message: 'Failed to check mediums of exchange availability',
          background: 'variant-filled-warning'
        });
      }
    } finally {
      isLoading = false;
    }
  }

  async function recheckPrerequisites() {
    isLoading = true;
    error = null;
    hasServiceTypes = null;
    hasMediumsOfExchange = null;
    
    await Promise.all([checkServiceTypes(), checkMediumsOfExchange()]);
  }
</script>

{#if isStillLoading}
  <div class="flex h-64 items-center justify-center">
    <span class="loading loading-spinner text-primary"></span>
    <p class="ml-4">Checking prerequisites...</p>
  </div>
{:else if error}
  <div class="container mx-auto p-4">
    <div class="alert variant-filled-error">
      <div class="alert-message">
        <h3 class="h3">Error</h3>
        <p>{error}</p>
      </div>
      <div class="alert-actions">
        <button class="variant-filled btn btn-sm" onclick={recheckPrerequisites}> Try Again </button>
      </div>
    </div>
  </div>
{:else if !allPrerequisitesMet}
  <!-- No service types available - show blocking message -->
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

      <h1 class="h1 mb-4">{title}</h1>

      <div class="space-y-4 text-surface-600">
        <p class="text-lg">{description}</p>

        {#if hasServiceTypes === false}
          <div class="bg-surface-100-800-token rounded-lg p-4">
            <h3 class="h4 mb-2 text-warning-600">❌ Service Types Missing</h3>
            <p class="text-sm">
              Service types categorize requests and offers, making it easier for users to find what
              they need. Examples include: "Web Development", "Graphic Design", "Consulting",
              "Tutoring", etc.
            </p>
          </div>
        {/if}

        {#if hasMediumsOfExchange === false}
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
        <a href="/" class="variant-soft-surface btn">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="mr-2 h-4 w-4"
          >
            <path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Home
        </a>

        <button class="variant-filled-primary btn" onclick={recheckPrerequisites}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="mr-2 h-4 w-4"
          >
            <path
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Check Again
        </button>
      </div>

      <!-- Admin note (only show if user might be admin) -->
      {#if administrationStore.agentIsAdministrator}
        <div class="bg-info-100-800-token mt-6 rounded-lg p-4">
          <p class="text-info-600-400-token text-sm mb-2">
            <strong>You are an Administrator:</strong>
          </p>
          <div class="flex flex-col gap-2 text-sm">
            {#if hasServiceTypes === false}
              <div>
                • Create service types from the
                <a href={serviceTypesRedirectPath} class="underline hover:no-underline">
                  Admin Service Types page
                </a>
              </div>
            {/if}
            {#if hasMediumsOfExchange === false}
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
