<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { waitForHolochainConnection } from '$lib/utils/holochain-client.utils';
  import ChipTip from '$lib/components/shared/ChipTip.svelte';
  import { isCut, measureOnHover } from '$lib/utils/truncation';
  import { Effect as E } from 'effect';

  type Props = {
    mediumOfExchangeActionHash?: ActionHash;
  };

  const { mediumOfExchangeActionHash }: Props = $props();

  let mediumName = $state<string | null>(null);
  let mediumCode = $state<string | null>(null);
  let exchangeType = $state<'base' | 'currency' | null>(null);
  let isLoadingMedium = $state(false);
  let mediumError = $state<string | null>(null);

  // Helper function to normalize ActionHash format
  function normalizeActionHash(hash: unknown): ActionHash | null {
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

  // Helper function to safely encode hash for URLs (currently unused but kept for future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function safeEncodeHash(hash: unknown): string {
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
      exchangeType = null;
      mediumError = null;
      return;
    }

    // Reset state
    mediumError = null;
    isLoadingMedium = true;

    console.log('MediumOfExchangeTag: Loading medium for hash:', normalizedHash);

    const loadMedium = async () => {
      try {
        await waitForHolochainConnection();
        const medium = await E.runPromise(
          mediumsOfExchangeStore.getMediumOfExchange(normalizedHash)
        );

        if (medium) {
          mediumName = medium.name || 'Unknown Medium';
          mediumCode = medium.code || '';
          exchangeType = medium.exchange_type || 'currency';
          console.log('MediumOfExchangeTag: Loaded medium:', {
            name: mediumName,
            code: mediumCode,
            exchangeType
          });
        } else {
          mediumName = 'Medium Not Found';
          mediumCode = '';
          exchangeType = null;
          console.log('MediumOfExchangeTag: No medium found for hash:', normalizedHash);
        }
      } catch (error) {
        console.error('MediumOfExchangeTag: Error loading medium of exchange:', error);

        // Handle specific error types
        const errorString = String(error);
        if (errorString.includes('Client not connected')) {
          mediumError = 'Connection Error';
          mediumName = 'Connection Error';
        } else if (errorString.includes('timeout') || errorString.includes('Timeout')) {
          mediumError = 'Timeout Error';
          mediumName = 'Request Timeout';
        } else {
          mediumError = 'Failed to load medium';
          mediumName = 'Error Loading Medium';
        }

        mediumCode = '';
        exchangeType = null;
      } finally {
        isLoadingMedium = false;
      }
    };

    loadMedium();
  });

  // Simplified display text calculation
  let displayText = $state('Loading...');

  // Whether the text is cut short in its cell, measured on hover: only then is it drawn in
  // full above the chip (ChipTip), since Electron on macOS shows no `title`. An error chip
  // gets the same, with the whole error.
  let nameEl = $state<HTMLSpanElement>();
  let cut = $state(false);
  const measure = () => (cut = isCut(nameEl));

  // Update display text when state changes
  $effect(() => {
    // A new text is measured afresh on the next hover.
    cut = false;
    if (isLoadingMedium) {
      displayText = 'Loading...';
    } else if (mediumError) {
      displayText = mediumError;
    } else if (mediumCode && mediumName) {
      // No 📂 or 💰 in front: in the desktop app it showed as a blank gap that pushed
      // the name off centre (Sam, 21 November). The chip's tone and its title already
      // say base category or currency.
      displayText = `${mediumName}`;
    } else if (mediumName) {
      displayText = mediumName;
    } else {
      displayText = 'Unknown Medium';
    }
  });
</script>

<!-- One line, cut with an ellipsis in a narrow cell; the whole name stays in the markup
     and in the title (see ServiceTypeTag). -->
{#if isLoadingMedium}
  <span class="variant-soft-surface chip max-w-full animate-pulse whitespace-nowrap">
    <span class="truncate">Loading medium...</span>
  </span>
{:else if mediumError}
  <span
    class="group variant-soft-error chip relative max-w-full whitespace-nowrap"
    title={`Error loading medium of exchange: ${mediumError}`}
    use:measureOnHover={measure}
  >
    <span class="truncate" bind:this={nameEl}>{mediumError}</span>
    {#if cut}<ChipTip text={`Error loading medium of exchange: ${mediumError}`} />{/if}
  </span>
{:else if !mediumOfExchangeActionHash}
  <span class="variant-soft-surface chip max-w-full whitespace-nowrap">
    <span class="truncate">No medium specified</span>
  </span>
{:else}
  <span
    class="group chip relative max-w-full whitespace-nowrap {exchangeType === 'base'
      ? 'variant-soft-primary'
      : 'variant-soft-secondary'}"
    title={mediumName
      ? `${exchangeType === 'base' ? 'Base Category' : 'Currency'}: ${mediumName}`
      : 'Medium of Exchange'}
    use:measureOnHover={measure}
  >
    <span class="truncate" bind:this={nameEl}>{displayText}</span>
    {#if cut}<ChipTip text={displayText} />{/if}
  </span>
{/if}
