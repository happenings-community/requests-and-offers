<script lang="ts">
  import { encodeHashToBase64 } from '@holochain/client';
  import ServiceTypeTag from '$lib/components/service-types/ServiceTypeTag.svelte';
  import type { ListingType } from '$lib/types/holochain';
  import type { UIOffer, UIRequest } from '$lib/types/ui';

  /**
   * A listing as a card to read, not manage: the same chips, title,
   * description and service types as `MyListingCard`, with the title as the
   * link to the listing.
   */
  let { kind, listing }: { kind: ListingType; listing: UIRequest | UIOffer } = $props();

  const isOffer = $derived(kind === 'Offer');
  const href = $derived(
    `/${isOffer ? 'offers' : 'requests'}/${encodeHashToBase64(listing.original_action_hash)}`
  );
</script>

<div class="card flex flex-col gap-3 p-4" data-testid="listing-card">
  <div class="flex flex-wrap items-center gap-2 text-sm">
    <span class="badge {isOffer ? 'variant-soft-warning' : 'variant-soft-secondary'}"
      >{isOffer ? '💡 Offer' : '📝 Request'}</span
    >
    <span class="text-surface-600 dark:text-surface-300"
      >{listing.interaction_type === 'InPerson' ? 'In person' : 'Virtual'}</span
    >
  </div>

  <h3 class="h4"><a class="hover:underline" {href}>{listing.title}</a></h3>
  {#if listing.description}
    <p class="line-clamp-2 text-sm text-surface-600 dark:text-surface-300">
      {listing.description}
    </p>
  {/if}
  {#if listing.service_type_hash}
    <div class="flex flex-wrap gap-1">
      <ServiceTypeTag serviceTypeActionHash={listing.service_type_hash} />
    </div>
  {/if}
</div>
