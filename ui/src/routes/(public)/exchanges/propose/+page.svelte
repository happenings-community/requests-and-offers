<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import type { ExchangeTerm, ListingType, ResourceKind } from '$lib/types/holochain';

  const toastStore = getToastStore();

  const params = $derived.by(() => {
    const q = page.url.searchParams;
    try {
      const listingType = q.get('type') as ListingType | null;
      return {
        interest: q.get('interest') ? decodeHashFromBase64(q.get('interest')!) : null,
        listing: q.get('listing') ? decodeHashFromBase64(q.get('listing')!) : null,
        listingType: listingType === 'Offer' || listingType === 'Request' ? listingType : null
      };
    } catch {
      return { interest: null, listing: null, listingType: null };
    }
  });

  let title = $state('');
  let serviceName = $state('');
  let mediumNames = $state<string[]>([]);
  let loadError = $state<string | null>(null);
  let busy = $state(false);

  let hours = $state<number | null>(null);
  let medium = $state('');
  let reciprocalKind = $state<ResourceKind>('Tbd');
  let reciprocalResource = $state('');
  let reciprocalAmount = $state<number | null>(null);
  let terms = $state('');
  let timeframe = $state('');

  const valid = $derived(
    !!params.interest && !!params.listing && !!params.listingType && timeframe.trim().length > 0
  );

  function fail(e: unknown) {
    toastStore.trigger({
      message: e instanceof Error ? e.message : String(e),
      background: 'variant-filled-error'
    });
  }

  async function nameOf(kind: 'service' | 'medium', hash: ActionHash): Promise<string | null> {
    const item =
      kind === 'service'
        ? await runEffect(serviceTypesStore.getServiceType(hash))
        : await runEffect(mediumsOfExchangeStore.getMediumOfExchange(hash));
    return item?.name ?? null;
  }

  $effect(() => {
    const { listing, listingType } = params;
    if (!listing || !listingType) {
      loadError = 'This page needs a listing and an interest to write up.';
      return;
    }
    (async () => {
      try {
        await runEffect(useConnectionGuard());
        const item =
          listingType === 'Offer'
            ? await runEffect(offersStore.getOffer(listing))
            : await runEffect(requestsStore.getRequest(listing));
        if (!item) {
          loadError = 'That listing could not be found.';
          return;
        }
        title = item.title;
        const firstService = item.service_type_hashes?.[0];
        serviceName = (firstService && (await nameOf('service', firstService))) || item.title;
        const names = await Promise.all(
          (item.medium_of_exchange_hashes ?? []).map((h) => nameOf('medium', h))
        );
        mediumNames = names.filter((n): n is string => !!n);
        medium = mediumNames[0] ?? '';
      } catch (e) {
        loadError = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  // Terms are written from the provider's side: they provide the primary and
  // receive the reciprocal.
  function buildTerms(): { primary: ExchangeTerm; reciprocal: ExchangeTerm } {
    const primary: ExchangeTerm = {
      direction: 'Provide',
      resource_conforms_to: serviceName,
      resource_kind: 'Service',
      quantity: hours ? { value: hours, unit: 'hours' } : null
    };
    const reciprocal: ExchangeTerm = {
      direction: 'Receive',
      resource_conforms_to:
        reciprocalKind === 'Currency'
          ? medium
          : reciprocalKind === 'Service'
            ? reciprocalResource
            : '',
      resource_kind: reciprocalKind,
      quantity:
        reciprocalKind === 'Currency' && reciprocalAmount
          ? { value: reciprocalAmount, unit: medium }
          : reciprocalKind === 'Service' && reciprocalAmount
            ? { value: reciprocalAmount, unit: 'hours' }
            : null
    };
    return { primary, reciprocal };
  }

  async function submit() {
    if (!valid) return;
    busy = true;
    try {
      const { primary, reciprocal } = buildTerms();
      const exchange = await runEffect(
        exchangesStore.createAgreement({
          listing: params.listing!,
          listing_type: params.listingType!,
          interest: params.interest!,
          primary,
          reciprocal,
          medium,
          terms: terms.trim(),
          delivery_timeframe: timeframe.trim()
        })
      );
      toastStore.trigger({ message: 'Agreement written up', background: 'variant-filled-success' });
      goto(`/exchanges/${encodeHashToBase64(exchange.agreement_hash)}`);
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Write up the agreement</title>
</svelte:head>

<section class="container mx-auto max-w-2xl space-y-6 p-4">
  <button class="variant-soft btn btn-sm" onclick={() => history.back()}>Back</button>

  {#if loadError}
    <div class="alert variant-filled-error">{loadError}</div>
  {:else}
    <header class="space-y-1">
      <h1 class="h2">Write up the agreement</h1>
      <p class="text-surface-500">
        For <span class="font-semibold">{title || '...'}</span>. The other party accepts or
        declines what you write here; nothing is binding until they do.
      </p>
    </header>

    <div class="card space-y-4 p-4">
      <p class="text-xs uppercase tracking-wide text-surface-500">What is provided</p>
      <p class="font-semibold">{serviceName || '...'}</p>
      <label class="label">
        <span>How much, in hours (optional)</span>
        <input class="input" type="number" min="0" step="0.5" bind:value={hours} />
      </label>
    </div>

    <div class="card space-y-4 p-4">
      <p class="text-xs uppercase tracking-wide text-surface-500">What is given in return</p>
      <label class="label">
        <span>Kind</span>
        <select class="select" bind:value={reciprocalKind}>
          <option value="Tbd">To be agreed later</option>
          <option value="Gift">Gift, nothing owed</option>
          <option value="Currency">A payment</option>
          <option value="Service">A service in return</option>
        </select>
      </label>
      {#if reciprocalKind === 'Currency'}
        <label class="label">
          <span>Medium</span>
          {#if mediumNames.length > 0}
            <select class="select" bind:value={medium}>
              {#each mediumNames as name (name)}<option value={name}>{name}</option>{/each}
            </select>
          {:else}
            <input class="input" type="text" bind:value={medium} placeholder="e.g. GBP, time credits" />
          {/if}
        </label>
        <label class="label">
          <span>Amount</span>
          <input class="input" type="number" min="0" step="0.01" bind:value={reciprocalAmount} />
        </label>
      {:else if reciprocalKind === 'Service'}
        <label class="label">
          <span>What service</span>
          <input class="input" type="text" bind:value={reciprocalResource} />
        </label>
        <label class="label">
          <span>How much, in hours (optional)</span>
          <input class="input" type="number" min="0" step="0.5" bind:value={reciprocalAmount} />
        </label>
      {/if}
    </div>

    <div class="card space-y-4 p-4">
      <label class="label">
        <span>When</span>
        <input class="input" type="text" bind:value={timeframe} placeholder="e.g. Saturday morning, or by the end of March" />
      </label>
      <label class="label">
        <span>Anything else you have agreed (optional)</span>
        <textarea class="textarea" rows="4" bind:value={terms}></textarea>
      </label>
    </div>

    <div class="flex justify-end">
      <button class="variant-filled-primary btn" onclick={submit} disabled={!valid || busy}>
        Send for acceptance
      </button>
    </div>
  {/if}
</section>
