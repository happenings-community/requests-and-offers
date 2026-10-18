<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { EXCHANGE_STRINGS as S, fill } from '$lib/strings/exchanges.strings';
  import { reasonOf } from '$lib/utils/error-shape';
  import ReachPerson from './ReachPerson.svelte';
  import { statusLabel } from '$lib/utils/exchange-ui';
  import { ListingStatus } from '$lib/types/holochain';
  import type { UIInterest } from '$lib/types/ui';
  import { COMMON_STRINGS as C } from '$lib/strings/common.strings';

  /** One row: the interest, plus what we had to fetch to describe it. */
  type Row = {
    interest: UIInterest;
    title: string;
    author: ActionHash | undefined;
    authorName: string;
    archivedByAuthor: boolean;
  };

  /** Told when a withdrawal changes the list, so a count above it can follow. */
  const { onchange }: { onchange?: () => void } = $props();

  let rows = $state<Row[]>([]);
  let loading = $state(true);
  /** Why the list could not be read. Shown with a way to try again, never as "Loading…" for ever. */
  let loadError = $state<string | null>(null);

  async function load() {
    loading = true;
    loadError = null;
    try {
      await read();
    } catch (e) {
      loadError = reasonOf(e);
    } finally {
      loading = false;
    }
  }

  async function read() {
    const mine = (await runEffect(exchangesStore.getMyInterests())) ?? [];
    const built: Row[] = [];
    for (const interest of mine) {
      const listing =
        interest.listing_type === 'Request'
          ? await runEffect(requestsStore.getRequest(interest.listing))
          : await runEffect(offersStore.getOffer(interest.listing));
      const author = listing?.creator;
      const user = author ? await runEffect(usersStore.getUserByActionHash(author)) : null;
      built.push({
        interest,
        title: listing?.title ?? C.something,
        author,
        authorName: user?.name ?? C.someone,
        // Shown rather than hidden: a member should know why nothing is happening on a
        // listing they are still interested in.
        archivedByAuthor: listing?.status === ListingStatus.Archived
      });
    }
    rows = built;
  }

  $effect(() => {
    load();
  });

  /** The exchange state on this listing, when one has got that far. */
  const exchangeOn = (listing: ActionHash) =>
    exchangesStore.exchanges.find(
      (e) => encodeHashToBase64(e.agreement.listing) === encodeHashToBase64(listing)
    );

  const since = (at: number | undefined) =>
    at
      ? new Date(at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        })
      : '';

  async function withdraw(interest: ActionHash) {
    await runEffect(exchangesStore.withdrawInterest(interest));
    await load();
    onchange?.();
  }
</script>

<section class="space-y-3" data-testid="interested-in">
  <div class="flex flex-col gap-1">
    <h2 class="h3">{S.interested.title}</h2>
    <p class="text-sm text-surface-500">{S.interested.intro}</p>
  </div>

  {#if loadError}
    <div class="alert variant-soft-error flex flex-wrap items-center gap-3" role="alert">
      <span class="text-sm">{fill(S.interested.loadFailed, { reason: loadError })}</span>
      <button type="button" class="variant-filled btn btn-sm" onclick={load}>{C.tryAgain}</button>
    </div>
  {:else if loading}
    <p class="text-surface-500">{C.loading}</p>
  {:else if rows.length === 0}
    <div class="card p-6 text-center">
      <p class="text-surface-500">{S.interested.empty}</p>
    </div>
  {:else}
    <ul class="space-y-3">
      {#each rows as row (encodeHashToBase64(row.interest.interest_hash))}
        {@const exchange = exchangeOn(row.interest.listing)}
        <li class="card space-y-2 p-4">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="badge {row.interest.listing_type === 'Offer'
                ? 'variant-soft-warning'
                : 'variant-soft-secondary'}"
            >
              {row.interest.listing_type === 'Offer' ? C.listingType.offer : C.listingType.request}
            </span>
            <span class="font-semibold">{row.title}</span>
            {#if row.archivedByAuthor}
              <span class="variant-soft-surface badge">{S.interested.archived}</span>
            {/if}
            <span class="ml-auto text-sm text-surface-500"
              >{fill(S.interested.since, { date: since(row.interest.created_at) })}</span
            >
          </div>
          <p class="text-sm text-surface-500">
            {row.authorName} ·
            {#if exchange}{statusLabel(exchange)}{:else}{S.interested.noProposal}{/if}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            <ReachPerson
              person={row.author}
              listingType={row.interest.listing_type === 'Offer' ? 'offer' : 'request'}
              listingTitle={row.title}
            />
            <a
              class="variant-ghost btn btn-sm"
              href="/{row.interest.listing_type === 'Offer'
                ? 'offers'
                : 'requests'}/{encodeHashToBase64(row.interest.listing)}">{S.interest.view}</a
            >
            <button
              type="button"
              class="variant-ghost btn btn-sm"
              onclick={() => withdraw(row.interest.interest_hash)}>{S.interest.withdraw}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
