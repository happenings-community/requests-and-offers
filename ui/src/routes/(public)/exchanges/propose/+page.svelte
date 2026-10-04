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
  import { MESSAGING_STRINGS } from '$lib/strings/messaging.strings';
  import { runEffect } from '$lib/utils/effect';
  import ContactButton from '$lib/components/shared/listings/ContactButton.svelte';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import { reciprocalTermFor, termLabel, type ExchangeRole } from '$lib/utils/exchange-ui';
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

  let medium = $state('');
  let returnService = $state('');
  let timeframe = $state('Within 2 weeks');

  /** From the strings module, so Anita's review reaches this page too. */
  const FORM_TERMS_LOCKED = MESSAGING_STRINGS.form.termsLocked;
  const S = MESSAGING_STRINGS;

  /**
   * Where "Post an offer" goes.
   *
   * The ordinary create page, carrying the listing's author so it can offer a way back to
   * the conversation afterwards. One create flow, as everywhere else.
   */
  const postOfferHref = $derived(
    listing?.creator ? `/offers/create?from=${encodeHashToBase64(listing.creator)}` : '/offers/create'
  );

  /**
   * **Every term in a proposal comes from something already published on a listing**
   * (Sam, 4 October). Nothing here is typed in: what is being provided, how much of it,
   * and what comes back are all read off published records, so an agreement can always be
   * checked against the listing it came from. To change a term you change the listing, or
   * publish a new one, which is decision 9.
   *
   * What that replaced: a service picker, a free-text medium, a free hours box, a free
   * amount box, and a 300-character free-text "the agreement, exactly". All gone.
   */
  const service = $derived(services.join(', '));

  /**
   * Carried from the listing, joined when it names several.
   *
   * #256 ("one listing names one service") will make several impossible, and this does
   * not stack on it: with one service the string is that service, before and after, so
   * nothing changes when #256 merges. Joining rather than picking the first is what keeps
   * it from silently dropping half of what a listing says.
   */
  /**
   * **Only a request publishes a time estimate.** `RequestInDHT` has
   * `time_estimate_hours`; `OfferInDHT` has no such field, so a proposal from an offer
   * carries no quantity at all now that nothing is typed in. That is a real loss against
   * the old page and it is tracked in #307 rather than papered over: to put hours on an
   * offer-based agreement, the offer has to publish them.
   */
  const hours = $derived(
    listing && 'time_estimate_hours' in listing
      ? (listing as { time_estimate_hours?: number }).time_estimate_hours
      : undefined
  );

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
  const reciprocal = $derived(reciprocalTermFor({ medium, isCurrency, returnService }));

  /** True while the proposer has said none of the offers suit. Nothing can be
   * sent in that state, so the sentinel never becomes a term. */
  const noneSuit = $derived(medium === 'Service Exchange' && returnService === '__none__');

  /**
   * A listing that publishes no service, or no medium, cannot be proposed from at all.
   *
   * That is the point rather than a gap: with no free entry there is nothing to fall back
   * on, and inventing a term here is exactly what this change removes. The member is told
   * to edit the listing.
   */
  const canSubmit = $derived(
    !!params.interest &&
      !!params.listing &&
      !!service &&
      // **No medium is fine.** A listing that names none is still proposable and the
      // exchange is a gift; requiring one invented a rule the data does not have.
      !(medium === 'Service Exchange' && !returnService) &&
      !(medium === 'Service Exchange' && giverOffers.length === 0) &&
      !noneSuit
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
          // Empty, deliberately. This field held the old page's free-text agreement;
          // nothing types terms any more. Agreements already made with text in it keep
          // displaying it, because reading it is unchanged.
          terms: '',
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
      <h1 class="h2">Create a proposal</h1>
      <p class="text-lg">
        For <span class="font-semibold">{listing.title}</span>, with {otherName}.
      </p>
      <p class="text-sm text-surface-500">
        {otherName.split(' ')[0]} can accept, counter or decline what you send; nothing is binding
        until they accept.
      </p>
    </header>

    <div class="card space-y-2 p-4">
      <p class="text-xs uppercase tracking-wide text-surface-500">{otherName}'s {params.listingType?.toLowerCase()}</p>
      <p class="font-semibold">{listing.title}</p>
      {#if listing.description}<p class="line-clamp-3 text-sm text-surface-500">{listing.description}</p>{/if}
      <p class="text-sm">
        {#if services.length}Service: {services.join(', ')}.{/if}
        {#if mediums.length}Medium of exchange: {mediums.map((m) => m.name).join(', ')}.{/if}
      </p>
    </div>

    <div class="alert variant-soft-primary text-sm">
      Most exchanges are reciprocal (other than Free/Pay it Forward). The medium of exchange is
      the type of exchange, not the exchange itself. Under Service Exchange you name a second
      service in return, or ask to discuss options.
    </div>

    <div class="card space-y-4 p-4">
      <div class="card variant-soft-surface space-y-1 p-3 text-sm">
        <p class="text-surface-500 text-xs uppercase tracking-wide">From the listing</p>
        <p><span class="text-surface-500">Service</span> {service || '\u2014'}</p>
        <p>
          <span class="text-surface-500">{myRole === 'provider' ? 'Hours offered' : 'Hours requested'}</span>
          {hours ?? 'not stated on the listing'}
        </p>
        <p class="text-surface-500 text-xs">{FORM_TERMS_LOCKED}</p>
      </div>

      {#if services.length === 0}
        <div class="alert variant-soft-warning text-sm">
          This listing names no service, so there is nothing to propose. Edit the listing to add
          one.
        </div>
      {/if}

      <label class="label">
        <span>Requested medium of exchange</span>
        {#if mediums.length > 0}
          <select class="select" bind:value={medium}>
            {#each mediums as m (m.name)}<option value={m.name}>{m.name}</option>{/each}
          </select>
        {:else}
          <p class="alert variant-soft-surface text-sm">
            This listing names no medium of exchange, so this is a gift: nothing is expected in
            return. To ask for something back, add a medium to the listing.
          </p>
        {/if}
      </label>

      {#if medium === 'Service Exchange'}
        <label class="label">
          <span>Chosen service offer for proposal</span>
          {#if giverOffers.length > 0}
            <select class="select" bind:value={returnService}>
              <option value="" disabled>Choose one of {myRole === 'provider' ? `${otherName}'s` : 'your'} offers</option>
              {#each giverOffers as title (title)}<option value={title}>{title}</option>{/each}
              <option value="__none__">None of these &mdash; get in touch</option>
            </select>
            {#if noneSuit}
              <p class="alert variant-soft-warning text-sm">
                Nothing here suits. Get in touch to ask about other skills they could list as an
                offer, or a different medium of exchange; this proposal cannot be sent until one is
                chosen.
              </p>
              {#if creator}
                <ContactButton
                  user={creator}
                  organization={null}
                  listingType={params.listingType === 'Offer' ? 'offer' : 'request'}
                  listingTitle={listing.title}
                />
              {/if}
            {/if}
          {:else if myRole === 'provider'}
            <p class="alert variant-soft-warning text-sm">
              A Service Exchange names a real offer on both sides, and {otherName} has no active
              offer to name. Agree what it will be between you, and ask them to post it as an
              offer; this proposal cannot be sent until one exists.
            </p>
          {:else}
            <!--
              The proposer's own missing offer. Saying so and stopping there left them
              stuck on this page with nothing to press, so the way out is here: the
              ordinary create page, with a link back to the conversation afterwards.
            -->
            <div class="alert variant-soft-warning flex flex-col items-start gap-3 text-sm">
              <p>{S.form.needOffer}</p>
              <a class="btn btn-sm variant-filled-primary" href={postOfferHref}>
                {S.form.postOffer}
              </a>
            </div>
          {/if}
          {#if giverOffers.length > 0}
            <span class="text-xs text-surface-500">
              What {myRole === 'provider' ? otherName : 'you'} already offer{myRole === 'provider' ? 's' : ''}.
            </span>
          {/if}
        </label>
      {:else if medium === 'Free/Pay it Forward'}
        <p class="text-sm text-surface-500">This is a gift. Nothing is expected in return.</p>
      {/if}

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
