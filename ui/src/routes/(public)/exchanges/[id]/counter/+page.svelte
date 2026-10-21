<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64 } from '@holochain/client';
  import { useCounterProposal } from '$lib/composables/domain/exchanges/useCounterProposal.svelte';
  import {
    describeQuantity,
    NOTHING_CHANGED,
    sameTimeframe,
    timeframeLabel
  } from '$lib/utils/counter-proposal';
  import { termLabel } from '$lib/utils/exchange-ui';

  const agreementHash = $derived.by(() => {
    try {
      return page.params.id ? decodeHashFromBase64(page.params.id) : null;
    } catch {
      return null;
    }
  });

  const counter = useCounterProposal({ agreementHash: () => agreementHash });

  const exchange = $derived(counter.exchange);
  const a = $derived(exchange?.agreement ?? null);
  const otherName = $derived(counter.other?.name ?? 'them');
  const youProvide = $derived(counter.role === 'provider');
  const backHref = $derived(page.params.id ? `/exchanges/${page.params.id}` : '/exchanges');

  /** "Nothing changed yet" is a hint, not an error, so the form opens quietly. */
  const unchanged = $derived(counter.problem === NOTHING_CHANGED);

  async function send() {
    const created = await counter.send();
    if (created) await goto(`/exchanges/${encodeHashToBase64(created)}`);
  }

  $effect(() => {
    counter.initialize();
  });
</script>

<svelte:head>
  <title>Counter-proposal</title>
</svelte:head>

<section class="container mx-auto max-w-2xl space-y-6 p-4">
  <div>
    <a class="variant-soft btn btn-sm" href={backHref}>Back to the proposal</a>
  </div>

  {#if counter.loadError}
    <div class="alert variant-filled-error">{counter.loadError}</div>
  {:else if !exchange || !a}
    <p class="text-surface-500">Loading the proposal...</p>
  {:else if !counter.canCounter}
    <div class="alert variant-soft-surface">
      Only the member a proposal was sent to can counter it, and only while it is still open.
    </div>
  {:else}
    <header class="space-y-2">
      <h1 class="h2">Counter-proposal</h1>
      <p class="text-surface-500">
        To {otherName}'s proposal on {counter.listingTitle || 'this listing'}. Change the hours, the
        amount or the timeframe; everything else stays as {otherName} proposed it.
      </p>
    </header>

    <div class="card variant-soft-surface space-y-1 p-4 text-sm">
      <p class="text-xs uppercase tracking-wide text-surface-500">Stays as proposed</p>
      <p><span class="text-surface-500">Service</span> {a.primary.resource_conforms_to || '—'}</p>
      {#if a.medium}<p><span class="text-surface-500">Medium of exchange</span> {a.medium}</p>{/if}
      <p>
        <span class="text-surface-500">In return</span>
        {termLabel({ ...a.reciprocal, quantity: null }) || '—'}
      </p>
      {#if a.terms}
        <p class="pt-2 text-xs uppercase tracking-wide text-surface-500">Proposal text</p>
        <p class="whitespace-pre-line">{a.terms}</p>
      {/if}
      <p class="pt-2 text-xs text-surface-500">
        To change the medium of exchange, the service type or the service offered in return, publish
        a new listing and propose from it.
      </p>
    </div>

    <form
      class="card space-y-4 p-4"
      onsubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label class="label">
        <span>{youProvide ? 'Hours you provide' : `Hours ${otherName} provides`}</span>
        <input
          class="input"
          type="number"
          min="0"
          step="0.5"
          bind:value={counter.primary}
          placeholder="Blank for no time estimate"
          data-testid="counter-primary"
        />
        <span class="text-xs text-surface-500">
          Proposed: {describeQuantity(a.primary.quantity?.value, 'hours')}
        </span>
      </label>

      {#if counter.figure}
        <label class="label">
          <span>
            {counter.figure === 'amount'
              ? `Amount in ${a.reciprocal.resource_conforms_to}`
              : `Hours of ${a.reciprocal.resource_conforms_to} in return`}
          </span>
          <input
            class="input"
            type="number"
            min="0"
            step="0.5"
            bind:value={counter.reciprocal}
            placeholder={counter.figure === 'amount'
              ? 'Blank for no amount'
              : 'Blank for no time estimate'}
            data-testid="counter-reciprocal"
          />
          <span class="text-xs text-surface-500">
            Proposed: {describeQuantity(
              a.reciprocal.quantity?.value,
              counter.figure,
              a.reciprocal.quantity?.unit ?? a.reciprocal.resource_conforms_to
            )}
          </span>
        </label>
      {/if}

      <label class="label">
        <span>Delivery timeframe</span>
        <!-- Bound by index: a timeframe is an object, and a select matches its options by identity. -->
        <select
          class="select"
          bind:value={
            () => counter.timeframes.findIndex((t) => sameTimeframe(t.value, counter.timeframe)),
            (i: number) => (counter.timeframe = counter.timeframes[i].value)
          }
          data-testid="counter-timeframe"
        >
          {#each counter.timeframes as t, i (t.label)}<option value={i}>{t.label}</option>{/each}
        </select>
        <span class="text-xs text-surface-500">Proposed: {timeframeLabel(a.delivery_timeframe)}</span>
      </label>

      <p class="text-xs text-surface-500">
        0 or blank means no quantity, for things like a digital file.
      </p>

      {#if unchanged}
        <p class="text-sm text-surface-500">{NOTHING_CHANGED}</p>
      {:else if counter.problem}
        <p class="text-sm text-error-500" role="alert">{counter.problem}</p>
      {/if}

      <p class="text-sm text-surface-500">
        Sending this declines {otherName}'s proposal and sends yours in its place. Until you send
        it, their proposal stays open.
      </p>

      <div class="flex flex-wrap justify-end gap-2">
        <a class="variant-ghost-surface btn" href={backHref}>Cancel</a>
        <button
          type="submit"
          class="variant-filled-primary btn"
          disabled={counter.sending || !!counter.problem}
          data-testid="send-counter">Send counter-proposal</button
        >
      </div>
    </form>
  {/if}
</section>
