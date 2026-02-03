<script lang="ts">
  import type { ActionHash } from '@holochain/client';
  import { encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import { waitForHolochainConnection } from '$lib/utils/holochain-client.utils';
  import { Effect as E } from 'effect';

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

  $effect(() => {
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
    return encodedHash ? `/service-types/${encodedHash}` : null;
  });
</script>

{#if isLoading}
  <span class="variant-soft-surface chip animate-pulse"> Loading... </span>
{:else if error}
  <span class="variant-soft-error chip" title="Error loading service type">
    {error}
  </span>
{:else if !serviceTypeActionHash}
  <span class="variant-soft-surface chip"> No service type specified </span>
{:else if showLink && linkUrl()}
  <a
    href={linkUrl()}
    class="variant-soft-primary chip transition-colors hover:variant-soft-secondary"
    title={serviceTypeDescription
      ? `${serviceTypeName}: ${serviceTypeDescription}`
      : serviceTypeName || 'Service Type'}
  >
    🏷️ {displayText}
  </a>
{:else}
  <span
    class="variant-soft-primary chip"
    title={serviceTypeDescription
      ? `${serviceTypeName}: ${serviceTypeDescription}`
      : serviceTypeName || 'Service Type'}
  >
    🏷️ {displayText}
  </span>
{/if}
