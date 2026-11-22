<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { waitForHolochainConnection } from '$lib/utils/holochain-client.utils';
  import ChipTip from '$lib/components/shared/ChipTip.svelte';
  import { isCut, measureOnHover } from '$lib/utils/truncation';
  import { Effect as E } from 'effect';
  import { paths } from '$lib/paths';

  type Props = {
    serviceTypeActionHash?: ActionHash;
    showLink?: boolean; // Whether to make it a clickable link
  };

  const { serviceTypeActionHash, showLink = true }: Props = $props();

  let serviceTypeName = $state<string | null>(null);
  let serviceTypeDescription = $state<string | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

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

  // Helper function to safely encode hash for URLs
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

  // Load service type when actionHash changes
  $effect(() => {
    const normalizedHash = normalizeActionHash(serviceTypeActionHash);
    if (!normalizedHash) {
      serviceTypeName = null;
      serviceTypeDescription = null;
      error = null;
      return;
    }

    // Reset state
    error = null;
    isLoading = true;

    const loadServiceType = async () => {
      try {
        await waitForHolochainConnection();
        const serviceType = await E.runPromise(serviceTypesStore.getServiceType(normalizedHash));

        if (serviceType) {
          serviceTypeName = serviceType.name || 'Unknown Service Type';
          serviceTypeDescription = serviceType.description || null;
        } else {
          serviceTypeName = 'Service Type Not Found';
          serviceTypeDescription = null;
        }
      } catch (err) {
        console.error('ServiceTypeTag: Error loading service type:', err);

        const errorString = String(err);
        if (errorString.includes('Client not connected')) {
          error = 'Connection Error';
          serviceTypeName = 'Connection Error';
        } else if (errorString.includes('timeout') || errorString.includes('Timeout')) {
          error = 'Timeout Error';
          serviceTypeName = 'Request Timeout';
        } else {
          error = 'Failed to load service type';
          serviceTypeName = 'Error Loading';
        }

        serviceTypeDescription = null;
      } finally {
        isLoading = false;
      }
    };

    loadServiceType();
  });

  // Computed display text
  let displayText = $state('Loading...');

  // Whether the text is cut short in its cell, measured on hover (and on focus where the tag
  // is a link): only then is it drawn in full above the chip (ChipTip), since Electron on
  // macOS shows no `title`. An error chip gets the same, with the whole error.
  let nameEl = $state<HTMLSpanElement>();
  let cut = $state(false);
  const measure = () => (cut = isCut(nameEl));

  $effect(() => {
    // A new text is measured afresh on the next hover.
    cut = false;
    if (isLoading) {
      displayText = 'Loading...';
    } else if (error) {
      displayText = error;
    } else if (serviceTypeName) {
      displayText = serviceTypeName;
    } else {
      displayText = 'Unknown Service Type';
    }
  });

  // Generate link URL
  const linkUrl = $derived(() => {
    if (!showLink || !serviceTypeActionHash) return null;
    const encodedHash = safeEncodeHash(serviceTypeActionHash);
    return encodedHash ? paths.serviceTypeDetail(encodedHash) : null;
  });
</script>

<!-- One line, whatever the name's length: a cell narrower than the name cuts it with an
     ellipsis (dogfooding, 21 November: "Holochain Zome Development (Rust)" wrapped onto four
     lines and made every listing row about 130px high). The whole name stays in the markup
     for a screen reader and in the title, and is drawn above the chip on hover when it is
     cut (ChipTip), since Electron on macOS does not show the title. -->
{#if isLoading}
  <span class="variant-soft-surface chip max-w-full animate-pulse whitespace-nowrap">
    <span class="truncate">Loading...</span>
  </span>
{:else if error}
  <span
    class="group variant-soft-error chip relative max-w-full whitespace-nowrap"
    title={`Error loading service type: ${error}`}
    use:measureOnHover={measure}
  >
    <span class="truncate" bind:this={nameEl}>{error}</span>
    {#if cut}<ChipTip text={`Error loading service type: ${error}`} />{/if}
  </span>
{:else if !serviceTypeActionHash}
  <span class="variant-soft-surface chip max-w-full whitespace-nowrap">
    <span class="truncate">No service type specified</span>
  </span>
{:else if showLink && linkUrl()}
  <a
    href={linkUrl()}
    class="group variant-soft-primary chip relative max-w-full whitespace-nowrap transition-colors hover:variant-soft-secondary"
    title={serviceTypeDescription
      ? `${serviceTypeName}: ${serviceTypeDescription}`
      : serviceTypeName || 'Service Type'}
    use:measureOnHover={measure}
  >
    <span class="truncate" bind:this={nameEl}>🏷️ {displayText}</span>
    {#if cut}<ChipTip text={displayText} />{/if}
  </a>
{:else}
  <span
    class="group variant-soft-primary chip relative max-w-full whitespace-nowrap"
    title={serviceTypeDescription
      ? `${serviceTypeName}: ${serviceTypeDescription}`
      : serviceTypeName || 'Service Type'}
    use:measureOnHover={measure}
  >
    <span class="truncate" bind:this={nameEl}>🏷️ {displayText}</span>
    {#if cut}<ChipTip text={displayText} />{/if}
  </span>
{/if}
