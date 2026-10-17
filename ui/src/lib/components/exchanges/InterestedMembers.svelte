<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import { useListingInterest } from '$lib/composables/domain/exchanges/useListingInterest.svelte';
  import { formatWhen, latestOnInterest, statusLabel } from '$lib/utils/exchange-ui';
  import type { ListingType } from '$lib/types/holochain';

  /**
   * Who is interested in one of my listings (#344), for My Listings: a chip with
   * the count, opening to each member with Send a proposal, or where the
   * exchange on their interest stands. Nothing shows until someone is interested.
   */
  let { listingHash, listingType }: { listingHash: ActionHash; listingType: ListingType } =
    $props();

  const interest = useListingInterest({
    listingHash: () => listingHash,
    listingType: () => listingType,
    quiet: true
  });

  let open = $state(false);
  const others = $derived(interest.others);

  $effect(() => {
    listingHash;
    interest.load();
  });
</script>

{#if interest.loadFailed}
  <p class="text-xs text-surface-500" data-testid="interested-members-failed">
    Couldn't check who is interested.
    <button type="button" class="anchor" onclick={() => interest.load()}>Try again</button>
  </p>
{:else if interest.loaded && others.length > 0}
  <div class="space-y-2" data-testid="interested-members">
    <button
      type="button"
      class="variant-soft-primary badge"
      aria-expanded={open}
      onclick={() => (open = !open)}
    >
      {others.length} interested
    </button>

    {#if open}
      <ul class="card space-y-2 p-3 text-sm">
        {#each others as item (encodeHashToBase64(item.interest_hash))}
          {@const person = interest.personOf(item)}
          {@const exchange = latestOnInterest(item.interest_hash, exchangesStore.exchanges)}
          <li class="flex flex-wrap items-center gap-2">
            <a class="anchor" href={`/users/${encodeHashToBase64(item.user)}`}
              >{person?.name ?? 'A member'}</a
            >
            <span class="text-surface-500">{formatWhen(item.created_at)}</span>
            {#if exchange}
              <a
                class="variant-soft-surface btn btn-sm ml-auto"
                href={`/exchanges/${encodeHashToBase64(exchange.agreement_hash)}`}
                >{statusLabel(exchange)} &rarr;</a
              >
            {:else}
              <a class="variant-filled-primary btn btn-sm ml-auto" href={interest.hrefFor(item)}
                >Send a proposal</a
              >
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}
