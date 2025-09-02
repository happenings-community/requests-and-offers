<script lang="ts">
  import { onMount } from 'svelte';
  import { ProgressBar } from '@skeletonlabs/skeleton';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import type { MediumOfExchangeInDHT } from '$lib/schemas/mediums-of-exchange.schemas';
  import { runEffect } from '$lib/utils/effect';
  import { decode } from '@msgpack/msgpack';
  import { initializationLock } from '$lib/utils/initialization-lock';

  const toastStore = getToastStore();

  let isInitializing = $state(false);
  let initializationProgress = $state(0);
  let initializationStatus = $state('');
  let hasExistingMediums = $state<boolean | null>(null); // null = loading, boolean = result
  let isCheckingExistence = $state(true);

  // Check if other initializations are running
  const isOtherInitializationRunning = $derived(
    initializationLock.isLocked && !initializationLock.lockedDomains.includes('mediums-of-exchange')
  );

  const { suggestMediumOfExchange, approveMediumOfExchange, getAllMediumsOfExchangeByStatus } =
    mediumsOfExchangeStore;

  const { agentIsAdministrator } = $derived(administrationStore);

  // Predefined Medium of Exchange options based on user requirements
  const predefinedMediums: MediumOfExchangeInDHT[] = [
    // Base exchange categories (foundational types)
    { code: 'PAY_IT_FORWARD', name: 'Pay it Forward/Free', exchange_type: 'base' },
    { code: 'EXCHANGE_SERVICES', name: 'Service Exchange', exchange_type: 'base' },
    { code: 'OPEN_DISCUSSION', name: 'Flexible Exchange', exchange_type: 'base' }
  ];

  // Check if there are existing mediums of exchange
  const checkExistingMediums = async () => {
    try {
      isCheckingExistence = true;

      const existingMediums = await runEffect(getAllMediumsOfExchangeByStatus());

      // Get all existing records and extract their codes
      const allExistingRecords = [
        ...existingMediums.pending,
        ...existingMediums.approved,
        ...existingMediums.rejected
      ];

      hasExistingMediums = allExistingRecords.length > 0;
    } catch (error) {
      console.error('Failed to check existing mediums:', error);
      hasExistingMediums = false; // Assume no mediums on error to allow initialization
    } finally {
      isCheckingExistence = false;
    }
  };

  // Check for existing mediums after a small delay to allow store initialization
  onMount(() => {
    // Small delay to ensure the admin page's store initialization has started
    setTimeout(() => {
      checkExistingMediums();
    }, 100);
  });

  const initializeBasicMediums = async () => {
    if (isInitializing) return;

    // Double-check admin permissions
    if (!agentIsAdministrator) {
      toastStore.trigger({
        message: 'Only administrators can initialize mediums of exchange',
        background: 'variant-filled-error'
      });
      return;
    }

    // Use the initialization lock to prevent race conditions
    await initializationLock.withLock('mediums-of-exchange', async () => {
      try {
        isInitializing = true;
        initializationProgress = 0;
        initializationStatus = 'Starting initialization...';

        // First, check what already exists
        initializationStatus = 'Checking existing mediums...';
        const existingMediums = await runEffect(getAllMediumsOfExchangeByStatus());

        // Get all existing records and extract their codes
        const allExistingRecords = [
          ...existingMediums.pending,
          ...existingMediums.approved,
          ...existingMediums.rejected
        ];

        // Extract codes from the records by decoding the entries
        const existingCodes = new Set();
        for (const record of allExistingRecords) {
          try {
            const entry = decode((record.entry as any).Present.entry) as MediumOfExchangeInDHT;
            existingCodes.add(entry.code);
          } catch (error) {
            console.warn('Failed to decode medium record:', error);
          }
        }

        const mediumsToCreate = predefinedMediums.filter((m) => !existingCodes.has(m.code));

        if (mediumsToCreate.length === 0) {
          toastStore.trigger({
            message: 'All predefined mediums of exchange already exist!',
            background: 'variant-filled-warning'
          });
          return;
        }

        initializationStatus = `Creating ${mediumsToCreate.length} new mediums...`;

        // Create and approve each medium
        const createdHashes: any[] = [];

        for (let i = 0; i < mediumsToCreate.length; i++) {
          const medium = mediumsToCreate[i];
          initializationStatus = `Creating: ${medium.name}`;

          try {
            // Suggest the medium
            const record = await runEffect(suggestMediumOfExchange(medium));
            const actionHash = record.signed_action.hashed.hash;
            createdHashes.push(actionHash);

            // Longer delay to allow for DHT propagation and prevent race conditions
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Auto-approve the medium
            await runEffect(approveMediumOfExchange(actionHash));

            initializationProgress = ((i + 1) / mediumsToCreate.length) * 100;
          } catch (error) {
            console.error(`Failed to create medium ${medium.name}:`, error);
            toastStore.trigger({
              message: `Failed to create ${medium.name}: ${error}`,
              background: 'variant-filled-error'
            });
          }
        }

        initializationStatus = 'Refreshing data...';
        await runEffect(getAllMediumsOfExchangeByStatus());

        toastStore.trigger({
          message: `Successfully initialized ${mediumsToCreate.length} mediums of exchange!`,
          background: 'variant-filled-success'
        });

        initializationStatus = 'Completed!';
      } catch (error) {
        console.error('Initialization failed:', error);
        toastStore.trigger({
          message: `Initialization failed: ${error}`,
          background: 'variant-filled-error'
        });
        initializationStatus = 'Failed';
      } finally {
        isInitializing = false;
        // Reset progress after a delay
        setTimeout(() => {
          initializationProgress = 0;
          initializationStatus = '';
        }, 3000);
      }
    });
  };
</script>

{#if isCheckingExistence}
  <div class="card p-4">
    <div class="flex items-center justify-center space-x-2">
      <div
        class="h-4 w-4 animate-spin rounded-full border-b-2 border-primary-500 dark:border-primary-400"
      ></div>
      <span class="text-sm">Checking existing mediums of exchange...</span>
    </div>
  </div>
{:else if !agentIsAdministrator}
  <!-- Don't show anything if not admin -->
{:else if hasExistingMediums}
  <!-- Don't show initializer if mediums already exist -->
{:else}
  <div class="card p-4">
    <h4 class="h4 mb-4">Initialize Mediums of Exchange</h4>

    <div class="mb-4">
      <p class="text-surface-600-300-token mb-2 text-sm">
        No mediums of exchange have been created yet. Click the button below to automatically create
        and approve both base exchange types and common currencies:
      </p>

      <div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-lg">📂</span>
            <strong class="text-primary-600 dark:text-primary-400"
              >Base Categories (Exchange Types)</strong
            >
          </div>
          <ul class="ml-2 list-inside list-disc space-y-1 text-xs">
            <li>Service Exchange</li>
            <li>Pay it Forward/Free</li>
            <li>Flexible Exchange</li>
          </ul>
          <p class="text-xs italic text-surface-500">
            Foundational exchange frameworks for non-monetary trades
          </p>
        </div>
      </div>
    </div>

    {#if isInitializing}
      <div class="space-y-3">
        <div class="text-sm font-medium">{initializationStatus}</div>
        <ProgressBar
          value={initializationProgress}
          max={100}
          meter="bg-primary-500 dark:bg-primary-400"
          track="bg-surface-200-700-token"
        />
        <div class="text-surface-500-400-token text-xs">
          {Math.round(initializationProgress)}% complete
        </div>
      </div>
    {:else}
      <button
        class="variant-filled-primary btn"
        onclick={initializeBasicMediums}
        disabled={isOtherInitializationRunning}
      >
        {#if isOtherInitializationRunning}
          <div class="flex items-center space-x-2">
            <div class="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
            <span>Waiting for other initialization...</span>
          </div>
        {:else}
          Initialize Mediums of Exchange
        {/if}
      </button>
    {/if}

    <div class="bg-surface-100-800-token mt-4 p-3 rounded-container-token">
      <p class="text-surface-600-300-token text-xs">
        <strong>Note:</strong> This will only create mediums that don't already exist. All created mediums
        will be automatically approved and ready for use in offers and requests.
      </p>
    </div>
  </div>
{/if}
