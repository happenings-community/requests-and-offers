<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { decodeHashFromBase64, encodeHashToBase64, type ActionHash } from '@holochain/client';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { runEffect } from '$lib/utils/effect';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import { termLabel, type ExchangeRole } from '$lib/utils/exchange-ui';
  import type { ExchangeTerm, ListingType } from '$lib/types/holochain';
  import type { UIOffer, UIRequest, UIUser } from '$lib/types/ui';

  const toastStore = getToastStore();

  const TIMEFRAMES = ['Within a few days', 'Within 2 weeks', 'Within a month', 'Flexible'];

  type Medium = { name: string; currency: boolean };

  const params = $derived.by(() => {
    const q = page.url.searchParams;
    try {
      const t = q.get('type');
      return {
        interest: q.get('interest') ? decodeHashFromBase64(q.get('interest')!) : null,
        listing: q.get('listing') ? decodeHashFromBase64(q.get('listing')!) : null,
        listingType: (t === 'Offer' || t === 'Request' ? t : null) as ListingType | null
      };
    } catch {
      return { interest: null, listing: null, listingType: null };
    }
  });

  let listing = $state<UIOffer | UIRequest | null>(null);
  let creator = $state<UIUser | null>(null);
  let services = $state<string[]>([]);
  let giverOffers = $state<string[]>([]);
  let mediums = $state<Medium[]>([]);
  let loadError = $state<string | null>(null);
  let busy = $state(false);

  let service = $state('');
  let medium = $state('');
  let hours = $state<number | undefined>(undefined);
  let returnService = $state('');
  let amount = $state<number | undefined>(undefined);
  let terms = $state('');
  let timeframe = $state('Within 2 weeks');

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const iAmAuthor = $derived(
    !!listing?.creator && !!me && listing.creator.toString() === me.toString()
  );
  // An offer's author provides; a request's author receives.
  const myRole = $derived<ExchangeRole>(
    (params.listingType === 'Offer') === iAmAuthor ? 'provider' : 'receiver'
  );
  const isCurrency = $derived(mediums.find((m) => m.name === medium)?.currency ?? false);
  const otherName = $derived(creator?.name ?? 'them');

  const primary = $derived<ExchangeTerm>({
    direction: 'Provide',
    resource_conforms_to: service,
    resource_kind: 'Service',
    quantity: hours ? { value: hours, unit: 'hours' } : null
  });
  const reciprocal = $derived<ExchangeTerm>(
    isCurrency
      ? {
          direction: 'Receive',
          resource_conforms_to: medium,
          resource_kind: 'Currency',
          quantity: amount != null ? { value: amount, unit: medium } : null
        }
      : medium === 'Service Exchange'
        ? { direction: 'Receive', resource_conforms_to: returnService, resource_kind: 'Service', quantity: null }
        : medium === 'Free/Pay it Forward'
          ? { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Gift', quantity: null }
          : { direction: 'Receive', resource_conforms_to: '', resource_kind: 'Tbd', quantity: null }
  );

  const canSubmit = $derived(
    !!params.interest &&
      !!params.listing &&
      !!service &&
      !!medium &&
      terms.trim().length > 0 &&
      !(medium === 'Service Exchange' && !returnService) &&
      !(isCurrency && amount == null)
  );

  function fail(e: unknown) {
    toastStore.trigger({
      message: e instanceof Error ? e.message : String(e),
      background: 'variant-filled-error'
    });
  }

  $effect(() => {
    const { listing: hash, listingType } = params;
    if (!hash || !listingType) {
      loadError = 'This page needs a listing and an interest to propose against.';
      return;
    }
    (async () => {
      try {
        await runEffect(useConnectionGuard());
        const item =
          listingType === 'Offer'
            ? await runEffect(offersStore.getOffer(hash))
            : await runEffect(requestsStore.getRequest(hash));
        if (!item) {
          loadError = 'That listing could not be found.';
          return;
        }
        listing = item;
        if (item.creator) creator = await runEffect(usersStore.getUserByActionHash(item.creator));
        const names = await Promise.all(
          (item.service_type_hashes ?? []).map(async (h: ActionHash) => {
            const st = await runEffect(serviceTypesStore.getServiceType(h));
            return st?.name ?? null;
          })
        );
        services = names.filter((n): n is string => !!n);
        service = services[0] ?? item.title;
        const found = await Promise.all(
          (item.medium_of_exchange_hashes ?? []).map(async (h: ActionHash) => {
            const m = await runEffect(mediumsOfExchangeStore.getMediumOfExchange(h));
            return m ? { name: m.name, currency: m.exchange_type === 'currency' } : null;
          })
        );
        mediums = found.filter((m): m is Medium => !!m);
        medium = mediums[0]?.name ?? '';
        // Under Service Exchange the return service is chosen from what the
        // reciprocal giver actually offers: the receiver of the primary.
        const interests = await runEffect(exchangesStore.getInterestsForListing(hash));
        const theInterest = interests.find(
          (i) => params.interest && i.interest_hash.toString() === params.interest.toString()
        );
        const authorHash = item.creator;
        const memberHash = theInterest?.user;
        const authorProvides = listingType === 'Offer';
        const giver = authorProvides ? memberHash : authorHash;
        if (giver) {
          const offers = await runEffect(offersStore.getUserActiveOffers(giver));
          giverOffers = [...new Set(offers.map((o) => o.title))];
        }
      } catch (e) {
        loadError = e instanceof Error ? e.message : String(e);
      }
    })();
  });

  async function submit() {
    if (!canSubmit) return;
    busy = true;
    try {
      const exchange = await runEffect(
        exchangesStore.createAgreement({
          listing: params.listing!,
          listing_type: params.listingType!,
          interest: params.interest!,
          primary,
          reciprocal,
          medium,
          terms: terms.trim(),
          delivery_timeframe: timeframe
        })
      );
      toastStore.trigger({ message: 'Proposal sent', background: 'variant-filled-success' });
      goto(`/exchanges/${encodeHashToBase64(exchange.agreement_hash)}`);
    } catch (e) {
      fail(e);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Make a proposal</title>
</svelte:head>

<section class="container mx-auto max-w-2xl space-y-6 p-4">
  <button class="variant-soft btn btn-sm" onclick={() => history.back()}>Back</button>

  {#if loadError}
    <div class="alert variant-filled-error">{loadError}</div>
  {:else if !listing}
    <p class="text-surface-500">Loading the listing...</p>
  {:else}
    <header class="space-y-1">
      <h1 class="h2">Make a proposal</h1>
      <p class="text-surface-500">
        For <span class="font-semibold">{listing.title}</span>, with {otherName}. They accept,
        counter or decline what you send; nothing is binding until they accept.
      </p>
    </header>

    <div class="card space-y-2 p-4">
      <p class="text-xs uppercase tracking-wide text-surface-500">The {params.listingType?.toLowerCase()} as listed</p>
      <p class="font-semibold">{listing.title}</p>
      {#if listing.description}<p class="line-clamp-3 text-sm text-surface-500">{listing.description}</p>{/if}
      <p class="text-sm">
        {#if services.length}Service: {services.join(', ')}.{/if}
        {#if mediums.length}Medium of exchange: {mediums.map((m) => m.name).join(', ')}.{/if}
      </p>
    </div>

    <div class="alert variant-soft-primary text-sm">
      Every exchange is reciprocal, and the medium of exchange is the frame it happens under, not
      itself a thing you give. Under Service Exchange you name a second service in return; under
      Let's Discuss you make your opening proposition in the terms; under Free/Pay it Forward
      nothing flows back.
    </div>

    <div class="card space-y-4 p-4">
      <label class="label">
        <span>Service</span>
        {#if services.length > 1}
          <select class="select" bind:value={service}>
            {#each services as s (s)}<option value={s}>{s}</option>{/each}
          </select>
        {:else}
          <input class="input" type="text" bind:value={service} />
        {/if}
      </label>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="label">
          <span>Medium of exchange</span>
          {#if mediums.length > 0}
            <select class="select" bind:value={medium}>
              {#each mediums as m (m.name)}<option value={m.name}>{m.name}</option>{/each}
            </select>
          {:else}
            <input class="input" type="text" bind:value={medium} placeholder="As agreed" />
          {/if}
        </label>
        <label class="label">
          <span>{myRole === 'provider' ? 'Hours offered' : 'Hours requested'}</span>
          <input class="input" type="number" min="0" step="0.5" bind:value={hours} placeholder="e.g. 3" />
        </label>
      </div>

      {#if isCurrency}
        <label class="label">
          <span>Amount in {medium}</span>
          <input class="input" type="number" min="0" step="0.5" bind:value={amount} placeholder="e.g. 50" />
        </label>
      {:else if medium === 'Service Exchange'}
        <label class="label">
          <span>Return service</span>
          {#if giverOffers.length > 0}
            <select class="select" bind:value={returnService}>
              <option value="" disabled>Choose one of {myRole === 'provider' ? `${otherName}'s` : 'your'} offers</option>
              {#each giverOffers as title (title)}<option value={title}>{title}</option>{/each}
            </select>
          {:else}
            <p class="alert variant-soft-warning text-sm">
              A Service Exchange names a service on both sides, and {myRole === 'provider' ? otherName : 'you'}
              {myRole === 'provider' ? 'has' : 'have'} no active offer to name. Agree what it will be between you,
              post it as an offer, and it can be named here. To settle it as you go instead, use Let's Discuss.
            </p>
          {/if}
          {#if giverOffers.length > 0}
            <span class="text-xs text-surface-500">
              What {myRole === 'provider' ? otherName : 'you'} already offer{myRole === 'provider' ? 's' : ''}.
            </span>
          {/if}
        </label>
      {:else if medium === "Let's Discuss"}
        <p class="text-sm text-surface-500">Nothing is named as the reciprocal here; make your opening proposition in the terms.</p>
      {:else if medium === 'Free/Pay it Forward'}
        <p class="text-sm text-surface-500">This is a gift. Nothing is expected in return.</p>
      {/if}

      <label class="label">
        <span>Your proposal <span class="text-xs text-surface-500">{medium === "Let's Discuss" ? 'your opening proposition' : 'what exactly is being exchanged'}, max 300</span></span>
        <textarea class="textarea" rows="4" maxlength="300" bind:value={terms}></textarea>
        <span class="text-xs text-surface-500">{terms.length}/300</span>
      </label>

      <label class="label">
        <span>Delivery timeframe</span>
        <select class="select" bind:value={timeframe}>
          {#each TIMEFRAMES as t (t)}<option value={t}>{t}</option>{/each}
        </select>
      </label>
    </div>

    <div class="card space-y-2 p-4">
      <p class="text-xs uppercase tracking-wide text-surface-500">Preview</p>
      <p>
        <span class="badge variant-soft-surface">{medium || '...'}</span>
      </p>
      <p class="text-sm">
        You give <span class="font-semibold">{termLabel(myRole === 'provider' ? primary : reciprocal) || '...'}</span>
        and receive <span class="font-semibold">{termLabel(myRole === 'provider' ? reciprocal : primary) || '...'}</span>
      </p>
    </div>

    <div class="flex justify-end gap-2">
      <button class="variant-ghost-surface btn" onclick={() => history.back()}>Cancel</button>
      <button class="variant-filled-primary btn" onclick={submit} disabled={!canSubmit || busy}>
        Send proposal
      </button>
    </div>
  {/if}
</section>
