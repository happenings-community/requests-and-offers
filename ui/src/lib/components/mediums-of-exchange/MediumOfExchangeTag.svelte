<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { Effect as E } from 'effect';
  import hc from '$lib/services/HolochainClientService.svelte';

  type Props = {
    mediumOfExchangeActionHash?: ActionHash;
  };

  const { mediumOfExchangeActionHash }: Props = $props();

  let mediumName = $state<string | null>(null);
  let mediumCode = $state<string | null>(null);
  let isLoadingMedium = $state(false);
  let mediumError = $state<string | null>(null);
  let retryAttempts = $state(0);
  const MAX_RETRY_ATTEMPTS = 2;

  // Helper function to normalize ActionHash format
  function normalizeActionHash(hash: any): ActionHash | null {
    if (!hash) return null;

    // If it's already a Uint8Array, return it
    if (hash instanceof Uint8Array) return hash;

    // If it's a string, try to decode it
    if (typeof hash === 'string') {
      try {
        // Only attempt decoding if it looks like base64
        if (hash.length > 0 && /^[A-Za-z0-9+/=]+$/.test(hash)) {
          return decodeHashFromBase64(hash);
        }
      } catch (error) {
        console.warn('Failed to decode hash string:', hash, error);
      }
    }

    return null;
  }

  // Helper function to safely encode hash for URLs
  function safeEncodeHash(hash: any): string {
    try {
      const normalizedHash = normalizeActionHash(hash);
      if (!normalizedHash) return '';
      return encodeHashToBase64(normalizedHash);
    } catch (error) {
      console.warn('Failed to encode hash for URL:', hash, error);
      return '';
    }
  }

  // Load medium of exchange name when actionHash changes
  $effect(() => {
    const normalizedHash = normalizeActionHash(mediumOfExchangeActionHash);
    if (!normalizedHash) {
      mediumName = null;
      mediumCode = null;
      mediumError = null;
      return;
    }

    // Reset state
    mediumError = null;
    isLoadingMedium = true;

    console.log('MediumOfExchangeTag: Loading medium for hash:', normalizedHash);

    const loadMedium = async () => {
      try {
        // Check if client is connected before making the call
        if (!hc.isConnected) {
          console.log('MediumOfExchangeTag: Client not connected, trying to connect...');
          await hc.connectClient();
        }

        const medium = await E.runPromise(
          mediumsOfExchangeStore.getMediumOfExchange(normalizedHash)
        );

        if (medium) {
          mediumName = medium.name || 'Unknown Medium';
          mediumCode = medium.code || '';
          console.log('MediumOfExchangeTag: Loaded medium:', {
            name: mediumName,
            code: mediumCode
          });
        } else {
          mediumName = 'Medium Not Found';
          mediumCode = '';
          console.log('MediumOfExchangeTag: No medium found for hash:', normalizedHash);
        }

        retryAttempts = 0;
      } catch (error) {
        console.error('MediumOfExchangeTag: Error loading medium of exchange:', error);

        // Handle specific error types
        const errorString = String(error);
        if (errorString.includes('Client not connected')) {
          mediumError = 'Connection Error';
          mediumName = 'Connection Error';

          // Try to retry a few times for connection issues
          if (retryAttempts < MAX_RETRY_ATTEMPTS) {
            retryAttempts++;
            console.log(
              `MediumOfExchangeTag: Retrying... (${retryAttempts}/${MAX_RETRY_ATTEMPTS})`
            );
            setTimeout(() => loadMedium(), 1000 * retryAttempts); // Exponential backoff
            return;
          }
        } else if (errorString.includes('timeout') || errorString.includes('Timeout')) {
          mediumError = 'Timeout Error';
          mediumName = 'Request Timeout';
        } else {
          mediumError = 'Failed to load medium';
          mediumName = 'Error Loading Medium';
        }

        mediumCode = '';
      } finally {
        isLoadingMedium = false;
      }
    };

    loadMedium();
  });

  const displayText = $derived(() => {
    if (isLoadingMedium) return 'Loading...';
    if (mediumError) return mediumError;
    if (mediumCode && mediumName) return `${mediumCode} - ${mediumName}`;
    if (mediumName) return mediumName;
    return 'Unknown Medium';
  });
</script>

{#if isLoadingMedium}
  <span class="variant-soft-surface chip animate-pulse"> Loading medium... </span>
{:else if mediumError}
  <span class="variant-soft-error chip" title="Error loading medium of exchange">
    {mediumError}
  </span>
{:else if !mediumOfExchangeActionHash}
  <span class="variant-soft-surface chip"> No medium specified </span>
{:else}
  <a
    href={`/mediums-of-exchange/${safeEncodeHash(mediumOfExchangeActionHash)}`}
    class="variant-filled-tertiary chip hover:variant-filled-secondary cursor-pointer transition-colors"
    title={`View ${mediumName} details`}
  >
    {displayText}
  </a>
{/if}
