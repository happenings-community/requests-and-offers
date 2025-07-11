<script lang="ts">
  import { ProgressBar } from '@skeletonlabs/skeleton';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import administrationStore from '$lib/stores/administration.store.svelte';
  import type { MediumOfExchangeInDHT } from '$lib/schemas/mediums-of-exchange.schemas';
  import { runEffect } from '$lib/utils/effect';
  import { Effect as E } from 'effect';
  import { decode } from '@msgpack/msgpack';

  const toastStore = getToastStore();

  let isInitializing = $state(false);
  let initializationProgress = $state(0);
  let initializationStatus = $state('');
  let hasExistingMediums = $state<boolean | null>(null); // null = loading, boolean = result
  let isCheckingExistence = $state(true);

  const { suggestMediumOfExchange, approveMediumOfExchange, getAllMediumsOfExchangeByStatus } =
    mediumsOfExchangeStore;

  const { agentIsAdministrator } = $derived(administrationStore);

  // Predefined Medium of Exchange options based on user requirements
  const predefinedMediums: MediumOfExchangeInDHT[] = [
    // Currencies with codes (from dropdown specification)
    { code: 'EUR', name: '€EUR - Euro' },
    { code: 'GBP', name: '£GBP - British Pound' },
    { code: 'USD', name: '$USD - US Dollar' },
    { code: 'AUD', name: '$AUD - Australian Dollar' },
    { code: 'CAD', name: '$CAD - Canadian Dollar' },
    { code: 'NZD', name: '$NZD - New Zealand Dollar' },
    { code: 'USDT', name: '#USDT - Tether' },
    { code: 'ETH', name: '#ETH - Ethereum' },

    // Service exchange options (multiple choice preferences)
    { code: 'EXCHANGE_SERVICES', name: 'I prefer to exchange services' },
    { code: 'PAY_IT_FORWARD', name: 'Pay it Forward/Free' },
    { code: 'OPEN_DISCUSSION', name: "Hit me up, I'm open" }
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

  // Check for existing mediums on component mount
  $effect(() => {
    checkExistingMediums();
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

          // Small delay to allow for DHT propagation
          await new Promise((resolve) => setTimeout(resolve, 100));

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
  };
</script>

{#if isCheckingExistence}
  <div class="card p-4">
    <div class="flex items-center justify-center space-x-2">
      <div class="border-primary-500 h-4 w-4 animate-spin rounded-full border-b-2"></div>
      <span class="text-sm">Checking existing mediums of exchange...</span>
    </div>
  </div>
{:else if !agentIsAdministrator}
  <!-- Don't show anything if not admin -->
{:else if hasExistingMediums}
  <!-- Don't show initializer if mediums already exist -->
{:else}
  <div class="card p-4">
    <h4 class="h4 mb-4">Initialize Basic Mediums of Exchange</h4>

    <div class="mb-4">
      <p class="text-surface-600-300-token mb-2 text-sm">
        No mediums of exchange have been created yet. Click the button below to automatically create
        and approve the basic set:
      </p>

      <div class="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
        <div>
          <strong>Currencies:</strong>
          <ul class="ml-2 list-inside list-disc text-xs">
            <li>€EUR - Euro</li>
            <li>£GBP - British Pound</li>
            <li>$USD - US Dollar</li>
            <li>$AUD - Australian Dollar</li>
            <li>$CAD - Canadian Dollar</li>
            <li>$NZD - New Zealand Dollar</li>
            <li>#USDT - Tether</li>
            <li>#ETH - Ethereum</li>
          </ul>
        </div>

        <div>
          <strong>Exchange Options:</strong>
          <ul class="ml-2 list-inside list-disc text-xs">
            <li>I prefer to exchange services</li>
            <li>Pay it Forward/Free</li>
            <li>Hit me up, I'm open</li>
          </ul>
        </div>
      </div>
    </div>

    {#if isInitializing}
      <div class="space-y-3">
        <div class="text-sm font-medium">{initializationStatus}</div>
        <ProgressBar
          value={initializationProgress}
          max={100}
          meter="bg-primary-500"
          track="bg-surface-200-700-token"
        />
        <div class="text-surface-500-400-token text-xs">
          {Math.round(initializationProgress)}% complete
        </div>
      </div>
    {:else}
      <button class="variant-filled-primary btn" onclick={initializeBasicMediums}>
        Initialize Basic Mediums of Exchange
      </button>
    {/if}

    <div class="rounded-container-token bg-surface-100-800-token mt-4 p-3">
      <p class="text-surface-600-300-token text-xs">
        <strong>Note:</strong> This will only create mediums that don't already exist. All created mediums
        will be automatically approved and ready for use in offers and requests.
      </p>
    </div>
  </div>
{/if}
