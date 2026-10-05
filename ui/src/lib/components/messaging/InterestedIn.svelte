<script lang="ts">
  import { encodeHashToBase64, type ActionHash } from '@holochain/client';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import messagingStore from '$lib/stores/messaging.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { threadKeyOf } from '$lib/utils/messaging-threads';
  import { MESSAGING_STRINGS as S, fill } from '$lib/strings/messaging.strings';
  import { statusLabel } from '$lib/utils/exchange-ui';
  import { ListingStatus } from '$lib/types/holochain';
  import type { UIInterest } from '$lib/types/ui';

  /** One row: the interest, plus what we had to fetch to describe it. */
  type Row = {
    interest: UIInterest;
    title: string;
    author: ActionHash | undefined;
    authorName: string;
    archivedByAuthor: boolean;
  };

  let rows = $state<Row[]>([]);
  let loading = $state(true);

  async function load() {
    loading = true;
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
        title: listing?.title ?? 'A listing',
        author,
        authorName: user?.name ?? 'A member',
        // Shown rather than hidden: a member should know why nothing is happening on a
        // listing they are still interested in.
        archivedByAuthor: listing?.status === ListingStatus.Archived
      });
    }
    rows = built;
    loading = false;
  }

  $effect(() => {
    load();
  });

  /** The exchange state on this listing, when one has got that far. */
  const exchangeOn = (listing: ActionHash) =>
    exchangesStore.exchanges.find(
      (e) => encodeHashToBase64(e.agreement.listing) === encodeHashToBase64(listing)
    );

  const unreadWith = (author: ActionHash | undefined) =>
    author
      ? (messagingStore.threads.find((t) => t.key === threadKeyOf(author))?.unread ?? 0)
      : 0;

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
  }
</script>

<section class="space-y-3" data-testid="interested-in">
  <div class="flex flex-col gap-1">
    <h2 class="h3">{S.interested.title}</h2>
    <p class="text-surface-500 text-sm">{S.interested.intro}</p>
  </div>

  {#if loading}
    <p class="text-surface-500">Loading…</p>
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
              {row.interest.listing_type === 'Offer' ? '💡 Offer' : '📝 Request'}
            </span>
            <span class="font-semibold">{row.title}</span>
            {#if row.archivedByAuthor}
              <span class="variant-soft-surface badge">{S.interested.archived}</span>
            {/if}
            <span class="text-surface-500 ml-auto text-sm"
              >{fill(S.interested.since, { date: since(row.interest.created_at) })}</span
            >
          </div>
          <p class="text-surface-500 text-sm">
            {row.authorName} ·
            {#if exchange}{statusLabel(exchange)}{:else}{S.interested.noProposal}{/if}
          </p>
          <div class="flex flex-wrap items-center gap-2">
            {#if row.author}
              <a class="btn btn-sm variant-ghost" href="/messages/{encodeHashToBase64(row.author)}"
                >{S.exchanges.goToChat}</a
              >
              {#if unreadWith(row.author) > 0}
                <span class="variant-filled-primary badge"
                  >{fill(S.hub.unread, { count: unreadWith(row.author) })}</span
                >
              {/if}
            {/if}
            <a
              class="btn btn-sm variant-ghost"
              href="/{row.interest.listing_type === 'Offer' ? 'offers' : 'requests'}/{encodeHashToBase64(
                row.interest.listing
              )}">{S.card.interest.view}</a
            >
            <button
              type="button"
              class="btn btn-sm variant-ghost"
              onclick={() => withdraw(row.interest.interest_hash)}
              >{S.card.interest.withdraw}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>
