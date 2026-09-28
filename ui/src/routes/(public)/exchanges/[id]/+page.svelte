<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import { getModalStore, type ModalComponent } from '@skeletonlabs/skeleton';
  import ContactModal from '$lib/components/shared/listings/ContactModal.svelte';
  import { useExchangeDetails } from '$lib/composables/domain/exchanges/useExchangeDetails.svelte';
  import {
    counterpartyOf,
    statusLabel,
    exchangeStatusVariant,
    formatWhen,
    termLabel
  } from '$lib/utils/exchange-ui';
  import type { ReviewInDHT } from '$lib/types/holochain';

  const modalStore = getModalStore();

  const agreementHash = $derived.by(() => {
    try {
      return page.params.id ? decodeHashFromBase64(page.params.id) : null;
    } catch {
      return null;
    }
  });

  const details = useExchangeDetails({ agreementHash: () => agreementHash });

  const exchange = $derived(details.exchange);
  const other = $derived(details.other);
  const listingTitle = $derived(details.listingTitle);
  const listingHref = $derived(details.listingHref);
  const loadError = $derived(details.loadError);
  const busy = $derived(details.busy);
  const me = $derived(details.me);
  const role = $derived(details.role);
  const iWroteIt = $derived(details.iWroteIt);
  const myDone = $derived(details.myDone);
  const theirDone = $derived(details.theirDone);
  const myReview = $derived(details.myReview);
  const myReviewText = $derived(details.myReviewText);
  const theirReviewText = $derived(details.theirReviewText);

  const { accept, decline, complete, cancel, withdraw, review } = details;

  /** The composable declines and hands back where the counter is written. */
  async function counter() {
    const href = await details.counter();
    if (href) await goto(href);
  }

  function discuss() {
    if (!other || !exchange) return;
    const component: ModalComponent = {
      ref: ContactModal,
      props: {
        user: other,
        organization: null,
        listingType: exchange.agreement.listing_type === 'Offer' ? 'offer' : 'request',
        listingTitle
      }
    };
    modalStore.trigger({ type: 'component', component, meta: { title: '', body: '' } });
  }

  $effect(() => {
    details.initialize();
  });
</script>

<svelte:head>
  <title>{listingTitle ? `Exchange: ${listingTitle}` : 'Exchange'}</title>
</svelte:head>

{#snippet reviewCard(label: string, r: (ReviewInDHT & { created_at: number }) | undefined)}
  <div class="card space-y-1 p-4">
    <p class="font-semibold">{label}</p>
    {#if r}
      <p>{'*'.repeat(r.rating)}{'.'.repeat(5 - r.rating)} {r.rating} of 5</p>
      <p class="text-sm text-surface-500">
        {r.on_time ? 'On time' : 'Not on time'}. {r.as_agreed ? 'As agreed' : 'Not as agreed'}.
      </p>
      {#if r.comment}<p class="text-sm">{r.comment}</p>{/if}
    {:else}
      <p class="text-sm text-surface-500">Not yet given.</p>
    {/if}
  </div>
{/snippet}

<section class="container mx-auto max-w-3xl space-y-6 p-4">
  <div class="flex items-center justify-between">
    <button class="variant-soft btn btn-sm" onclick={() => goto('/exchanges')}
      >Back to exchanges</button
    >
  </div>

  {#if loadError}
    <div class="alert variant-filled-error">{loadError}</div>
  {:else if !exchange}
    <p class="text-surface-500">Loading the exchange...</p>
  {:else}
    {@const a = exchange.agreement}
    <header class="space-y-2">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h1 class="h2"><a class="anchor" href={listingHref}>{listingTitle || '...'}</a></h1>
        <span class="badge {exchangeStatusVariant(exchange.status)}">
          {statusLabel(exchange)}
        </span>
      </div>
      <p class="text-surface-500">
        With
        <a class="anchor" href={`/users/${encodeHashToBase64(counterpartyOf(exchange, me))}`}>
          {other?.name ?? 'a member'}
        </a>. You are the {role ?? 'observer'}. Written up on {formatWhen(exchange.created_at)}
        {iWroteIt ? 'by you' : `by ${other?.name ?? 'them'}`}.
      </p>
    </header>

    <div class="grid gap-4 md:grid-cols-2">
      <div class="card space-y-1 p-4">
        <p class="text-xs uppercase tracking-wide text-surface-500">
          {role === 'provider' ? 'You provide' : 'They provide'}
        </p>
        <p class="font-semibold">{termLabel(a.primary)}</p>
      </div>
      <div class="card space-y-1 p-4">
        <p class="text-xs uppercase tracking-wide text-surface-500">
          {role === 'provider' ? 'You receive' : 'They receive'}
        </p>
        <p class="font-semibold">{termLabel(a.reciprocal)}</p>
        {#if a.medium}<p class="text-sm text-surface-500">via {a.medium}</p>{/if}
      </div>
    </div>

    {#if a.terms || a.delivery_timeframe}
      <div class="card space-y-2 p-4">
        {#if a.delivery_timeframe}<p>
            <span class="font-semibold">When:</span>
            {a.delivery_timeframe}
          </p>{/if}
        {#if a.terms}
          <p class="text-xs uppercase tracking-wide text-surface-500">
            {exchange.status === 'Proposed' || exchange.status === 'Declined'
              ? 'Proposal'
              : 'Agreement'}
          </p>
          <p class="whitespace-pre-line">{a.terms}</p>
        {/if}
      </div>
    {/if}

    {#if exchange.status === 'Declined' && exchange.response}
      <div class="alert variant-soft-surface">
        <p>Declined on {formatWhen(exchange.response.created_at)}.</p>
        {#if exchange.response.note}<p class="text-sm">{exchange.response.note}</p>{/if}
      </div>
    {:else if exchange.status === 'Cancelled' && exchange.cancellation}
      <div class="alert variant-soft-surface">
        <p>
          {exchange.response ? 'Cancelled' : 'Withdrawn'} on {formatWhen(
            exchange.cancellation.created_at
          )}.
        </p>
        {#if exchange.cancellation.note}<p class="text-sm">{exchange.cancellation.note}</p>{/if}
      </div>
    {/if}

    {#if role}
      <div class="card space-y-3 p-4">
        {#if exchange.status === 'Proposed'}
          {#if iWroteIt}
            <p>Waiting for {other?.name ?? 'them'} to accept, counter or decline.</p>
            <button class="variant-ghost-surface btn btn-sm" onclick={withdraw} disabled={busy}>
              Withdraw proposal
            </button>
          {:else}
            <p>
              {other?.name ?? 'They'} sent this proposal. Accept it to form the agreement, counter with
              your own, or decline.
            </p>
            <textarea
              class="textarea"
              rows="2"
              bind:value={details.note}
              placeholder="A note, if declining"
            ></textarea>
            <div class="flex flex-wrap gap-2">
              <button class="variant-soft-primary btn" onclick={discuss} disabled={busy || !other}
                >Discuss</button
              >
              <button class="variant-filled-secondary btn" onclick={counter} disabled={busy}
                >Counter</button
              >
              <button class="variant-ghost-surface btn" onclick={decline} disabled={busy}
                >Decline</button
              >
              <button class="variant-filled-primary btn" onclick={accept} disabled={busy}
                >Accept and form agreement</button
              >
            </div>
          {/if}
        {:else if exchange.status === 'Agreed' || exchange.status === 'ProviderDelivered'}
          {#if myDone}
            <p>You have marked your part done. Waiting for {other?.name ?? 'them'}.</p>
          {:else}
            <p>
              {#if theirDone}{other?.name ?? 'They'} has marked their part done.{/if}
              Mark yours when it is.
            </p>
            <button class="variant-filled-primary btn" onclick={complete} disabled={busy}>
              Mark my part done
            </button>
          {/if}
          <details class="mt-2">
            <summary class="cursor-pointer text-sm text-surface-500">Cancel this agreement</summary>
            <div class="mt-2 space-y-2">
              <textarea
                class="textarea"
                rows="2"
                bind:value={details.note}
                placeholder="Why, briefly"
              ></textarea>
              <button class="variant-ghost-error btn btn-sm" onclick={cancel} disabled={busy}>
                Cancel agreement
              </button>
            </div>
          </details>
        {:else if exchange.status === 'Complete'}
          {#if myReview}
            <p>Thanks for your review. Waiting for {other?.name ?? 'them'} to review.</p>
          {:else}
            <p>Both parts are done. How was your exchange with {other?.name ?? 'them'}?</p>
            <div class="flex items-center gap-1" role="radiogroup" aria-label="Rating">
              {#each [1, 2, 3, 4, 5] as n (n)}
                <button
                  type="button"
                  class="btn-icon btn-icon-sm {n <= details.rating
                    ? 'variant-filled-warning'
                    : 'variant-ghost-surface'}"
                  onclick={() => (details.rating = n)}
                  aria-label={`${n} of 5`}
                  aria-pressed={n <= details.rating}>{n}</button
                >
              {/each}
            </div>
            <div class="space-y-2 py-2">
              <label class="flex items-center gap-2"
                ><input class="checkbox" type="checkbox" bind:checked={details.onTime} /> Delivered on
                time</label
              >
              <label class="flex items-center gap-2"
                ><input class="checkbox" type="checkbox" bind:checked={details.asAgreed} /> Matched what
                we agreed</label
              >
            </div>
            <label class="label pt-2">
              <span>Comment <span class="text-xs text-surface-500">max 200</span></span>
              <textarea
                class="textarea"
                rows="3"
                maxlength="200"
                bind:value={details.comment}
                placeholder="A few words about the exchange"
              ></textarea>
              <span class="text-xs text-surface-500">{details.comment.length}/200</span>
            </label>
            {#if details.rating > 0 && details.rating <= 2}
              <p class="text-sm text-warning-600">
                A low rating is recorded against the exchange. Stewarding, where this opens a
                resolution, arrives in a later release.
              </p>
            {/if}
            <button
              class="variant-filled-warning btn"
              onclick={review}
              disabled={busy || !!details.reviewProblem}>Submit review</button
            >
          {/if}
        {:else if exchange.status === 'Reviewed'}
          {@const done = Math.max(
            exchange.provider_done?.created_at ?? 0,
            exchange.receiver_done?.created_at ?? 0
          )}
          <p>Completed {formatWhen(done)} and reviewed by both of you.</p>
        {/if}
      </div>
    {/if}

    {#if exchange.status === 'Complete' || exchange.status === 'Reviewed'}
      <div class="grid gap-4 md:grid-cols-2">
        {@render reviewCard('Your review', myReviewText)}
        {@render reviewCard(`${other?.name ?? 'Their'} review`, theirReviewText)}
      </div>
    {/if}

    <div class="space-y-1 text-sm text-surface-500">
      <p>Written up {formatWhen(exchange.created_at)}</p>
      {#if exchange.response}<p>
          {exchange.response.accepted ? 'Accepted' : 'Declined'}
          {formatWhen(exchange.response.created_at)}
        </p>{/if}
      {#if exchange.provider_done}<p>
          Provider done {formatWhen(exchange.provider_done.created_at)}
        </p>{/if}
      {#if exchange.receiver_done}<p>
          Receiver done {formatWhen(exchange.receiver_done.created_at)}
        </p>{/if}
      {#if exchange.cancellation}<p>
          Cancelled {formatWhen(exchange.cancellation.created_at)}
        </p>{/if}
    </div>
  {/if}
</section>
