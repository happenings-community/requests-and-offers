<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import {
    createListingFrom,
    paths,
    readProposeParams,
    readReciprocal,
    routeAfter
  } from '$lib/paths';
  import { encodeHashToBase64 } from '@holochain/client';
  import { type ActionHash } from '@holochain/client';
  import { getToastStore } from '@skeletonlabs/skeleton';
  import exchangesStore from '$lib/stores/exchanges.store.svelte';
  import usersStore from '$lib/stores/users.store.svelte';
  import offersStore from '$lib/stores/offers.store.svelte';
  import requestsStore from '$lib/stores/requests.store.svelte';
  import serviceTypesStore from '$lib/stores/serviceTypes.store.svelte';
  import mediumsOfExchangeStore from '$lib/stores/mediums_of_exchange.store.svelte';
  import { EXCHANGE_STRINGS } from '$lib/strings/exchanges.strings';
  import { runEffect } from '$lib/utils/effect';
  import ReachPerson from '$lib/components/exchanges/ReachPerson.svelte';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import { reciprocalTermFor, termLabel, type ExchangeRole } from '$lib/utils/exchange-ui';
  import type { ExchangeTerm, ListingType } from '$lib/types/holochain';
  import type { UIOffer, UIRequest, UIUser } from '$lib/types/ui';

  const toastStore = getToastStore();

  const TIMEFRAMES = ['Within a few days', 'Within 2 weeks', 'Within a month', 'Flexible'];

  type Medium = { name: string; currency: boolean };

  /**
   * Read through the module that builds these links, so the keys cannot drift apart.
   * `listingType` keeps its name here because the page uses it throughout; what matters
   * is that the query key it comes from is written in exactly one place.
   */
  const params = $derived.by(() => {
    const read = readProposeParams(page.url);
    return {
      interest: read.interest,
      listing: read.listing,
      listingType: read.type,
      from: read.from
    };
  });

  let listing = $state<UIOffer | UIRequest | null>(null);
  /**
   * The type of the listing that actually loaded.
   *
   * Taken from the fetch that succeeded rather than from the query string, so the label
   * on screen cannot name a type the listing does not have.
   */
  let loadedType = $state<ListingType | null>(null);
  let creator = $state<UIUser | null>(null);
  /** Whoever registered the interest being proposed against. */
  let interestedUser = $state<UIUser | null>(null);
  let services = $state<string[]>([]);
  let giverOffers = $state<string[]>([]);
  let mediums = $state<Medium[]>([]);
  /**
   * Whether the listing's terms have been read, and whether reading them worked.
   *
   * Services and mediums are separate records, fetched after the listing, so an empty
   * array means "not yet" as often as it means "none". The page believed the empty case
   * and said "this listing names no medium of exchange, so this is a gift" while the
   * records were still in flight; pressing Send then would have proposed a gift for
   * something that wanted paying. A lookup that fails is a third state again, and
   * silently dropping it the way `filter(Boolean)` did made a partial failure look like
   * a shorter list.
   */
  let termsLoad = $state<'loading' | 'ready' | 'failed'>('loading');
  let loadError = $state<string | null>(null);
  let busy = $state(false);

  let medium = $state('');
  let returnService = $state('');
  let timeframe = $state('Within 2 weeks');

  /** From the strings module, so Anita's review reaches this page too. */
  const FORM_TERMS_LOCKED = EXCHANGE_STRINGS.form.termsLocked;
  const S = EXCHANGE_STRINGS;

  /**
   * Where "Post an offer" goes.
   *
   * The ordinary create page, carrying the listing's author so it can offer a way back to
   * the conversation afterwards. One create flow, as everywhere else.
   */
  const postOfferHref = $derived.by(() => {
    // The proposal's own context travels, so the create page can offer "Continue your
    // proposal" rather than just a way back: publishing here is a step inside proposing.
    const { listing: hash, listingType, interest } = params;
    const counterparty = other?.original_action_hash;
    if (!hash || !listingType || !interest || !counterparty) return paths.offerCreate();
    return createListingFrom('Offer', {
      kind: 'proposal',
      counterparty,
      listing: hash,
      type: listingType,
      interest
    });
  });

  /**
   * **Every term in a proposal comes from something already published on a listing**
   * (Sam, 4 October). Nothing here is typed in: what is being provided, how much of it,
   * and what comes back are all read off published records, so an agreement can always be
   * checked against the listing it came from. To change a term you change the listing, or
   * publish a new one.
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
  /**
   * The other person in this proposal, which is not always the listing's author.
   *
   * Either side can propose: if the listing is mine, the other person is whoever showed
   * interest in it, and if it is theirs, it is its author. This read the author either
   * way, so proposing on your own listing addressed the page to yourself — "with Agent 1",
   * "Agent can accept", "Agent 1's request" — and never named the person it was going to.
   */
  const other = $derived(iAmAuthor ? interestedUser : creator);
  const otherName = $derived(other?.name ?? 'them');

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
    // Nothing is sendable until the terms are actually known. This is the guard that
    // stops a gift proposal being sent while the mediums are still loading.
    termsLoad === 'ready' &&
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

  /**
   * Read the listing and everything the proposal needs from it.
   *
   * A named function rather than the body of the effect, so the retry on a failed read
   * is the same path as the first attempt rather than a second one that could drift.
   */
  function loadListing() {
    const { listing: hash, listingType } = params;
    if (!hash || !listingType) {
      // Naming what is actually missing. This used to say "a listing and an interest"
      // whatever was wrong, which sent me looking for the interest when the type was
      // the thing absent.
      loadError = !hash
        ? 'This page needs a listing to propose against.'
        : 'This link is missing the listing type, so the listing cannot be looked up.';
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
        loadedType = listingType;
        if (item.creator) creator = await runEffect(usersStore.getUserByActionHash(item.creator));
        const names = await Promise.all(
          (item.service_type_hashes ?? []).map(async (h: ActionHash) => {
            const st = await runEffect(serviceTypesStore.getServiceType(h));
            return st?.name ?? null;
          })
        );
        const found = await Promise.all(
          (item.medium_of_exchange_hashes ?? []).map(async (h: ActionHash) => {
            const m = await runEffect(mediumsOfExchangeStore.getMediumOfExchange(h));
            return m ? { name: m.name, currency: m.exchange_type === 'currency' } : null;
          })
        );
        // A hash the listing names but that will not resolve is a failure, not a shorter
        // list. Saying so beats quietly proposing against terms that are not all there.
        // The rest of the page still loads, because the name of the person being
        // proposed to is worth having even when the terms are not readable.
        const everyTermRead = !names.some((n) => n === null) && !found.some((m) => m === null);
        services = names.filter((n): n is string => !!n);
        mediums = found.filter((m): m is Medium => !!m);
        medium = mediums[0]?.name ?? '';
        termsLoad = everyTermRead ? 'ready' : 'failed';
        // Under Service Exchange the return service is chosen from what the
        // reciprocal giver actually offers: the receiver of the primary.
        const interests = await runEffect(exchangesStore.getInterestsForListing(hash));
        const theInterest = interests.find(
          (i) => params.interest && i.interest_hash.toString() === params.interest.toString()
        );
        const authorHash = item.creator;
        const memberHash = theInterest?.user;
        if (memberHash) {
          interestedUser = await runEffect(usersStore.getUserByActionHash(memberHash));
        }
        const authorProvides = listingType === 'Offer';
        const giver = authorProvides ? memberHash : authorHash;
        if (giver) {
          const offers = await runEffect(offersStore.getUserActiveOffers(giver));
          giverOffers = [...new Set(offers.map((o) => o.title))];
          // A listing published part-way through this proposal comes back named in the
          // address, because by now it is one of several and nothing here could pick it
          // out. If it is not among them — published for somebody else, or not yet
          // readable — nothing is preselected and the member chooses as usual.
          const returned = readReciprocal(page.url);
          if (returned) {
            const match = offers.find(
              (o) =>
                o.original_action_hash &&
                encodeHashToBase64(o.original_action_hash) === encodeHashToBase64(returned)
            );
            if (match) returnService = match.title;
          }
        }
      } catch (e) {
        loadError = e instanceof Error ? e.message : String(e);
      }
    })();
  }

  function retryTerms() {
    termsLoad = 'loading';
    loadError = null;
    loadListing();
  }

  $effect(() => {
    loadListing();
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
      // Back to the conversation it was negotiated in, where the card now sits. A fresh
      // proposal is always `Proposed`, so this is the live branch of `routeAfter`.
      goto(routeAfter({ exchange: exchange.agreement_hash, from: params.from }));
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
        {otherName.split(' ')[0]} can accept, counter or decline what you send; nothing is binding until
        they accept.
      </p>
    </header>

    <div class="card space-y-2 p-4">
      <p class="text-xs uppercase tracking-wide text-surface-500">
        {otherName}'s {loadedType?.toLowerCase()}
      </p>
      <p class="font-semibold">{listing.title}</p>
      {#if listing.description}<p class="line-clamp-3 text-sm text-surface-500">
          {listing.description}
        </p>{/if}
      <p class="text-sm">
        {#if termsLoad === 'loading'}
          <span class="text-surface-500">{S.form.termsLoading}</span>
        {:else}
          {#if services.length}Service: {services.join(', ')}.{/if}
          {#if mediums.length}Medium of exchange: {mediums.map((m) => m.name).join(', ')}.{/if}
        {/if}
      </p>
    </div>

    <div class="alert variant-soft-primary text-sm">
      Most exchanges are reciprocal (other than Free/Pay it Forward). The medium of exchange is the
      type of exchange, not the exchange itself. Under Service Exchange you name a second service in
      return, or ask to discuss options.
    </div>

    {#if termsLoad === 'failed'}
      <!-- Never the empty-case wording: this says the terms could not be read, which is
           a different thing from a listing that names none. -->
      <div class="alert variant-filled-error flex flex-wrap items-center gap-3 text-sm">
        <span class="flex-1">{S.form.termsFailed}</span>
        <button type="button" class="variant-filled btn btn-sm" onclick={retryTerms}>
          {S.form.termsRetry}
        </button>
      </div>
    {/if}

    <div class="card space-y-4 p-4">
      <div class="card variant-soft-surface space-y-1 p-3 text-sm">
        <p class="text-xs uppercase tracking-wide text-surface-500">From the listing</p>
        <p><span class="text-surface-500">Service</span> {service || '\u2014'}</p>
        <p>
          <span class="text-surface-500"
            >{myRole === 'provider' ? 'Hours offered' : 'Hours requested'}</span
          >
          {hours ?? 'not stated on the listing'}
        </p>
        <p class="text-xs text-surface-500">{FORM_TERMS_LOCKED}</p>
      </div>

      {#if termsLoad === 'ready' && services.length === 0}
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
        {:else if termsLoad === 'loading'}
          <p class="text-sm text-surface-500">{S.form.termsLoading}</p>
        {:else if termsLoad === 'ready'}
          <!-- Only once the mediums are known. Shown while they were still loading, this
               offered a gift proposal for a listing that wanted paying. -->
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
              <option value="" disabled
                >Choose one of {myRole === 'provider' ? `${otherName}'s` : 'your'} offers</option
              >
              {#each giverOffers as title (title)}<option value={title}>{title}</option>{/each}
              <option value="__none__">None of these &mdash; get in touch</option>
            </select>
            {#if noneSuit}
              <p class="alert variant-soft-warning text-sm">
                Nothing here suits. Get in touch to ask about other skills they could list as an
                offer, or a different medium of exchange; this proposal cannot be sent until one is
                chosen.
              </p>
              <!--
                Whoever is on the other side of this proposal, which is not always the
                listing's author: proposing on your own listing offered your own contact
                details here. How to reach them is decided where the one component is
                plugged in, not by this page.
              -->
              <ReachPerson
                person={other?.original_action_hash}
                listingType={params.listingType === 'Offer' ? 'offer' : 'request'}
                listingTitle={listing.title}
              />
            {/if}
          {:else if myRole === 'provider'}
            <p class="alert variant-soft-warning text-sm">
              A Service Exchange names a real offer on both sides, and {otherName} has no active offer
              to name. Agree what it will be between you, and ask them to post it as an offer; this proposal
              cannot be sent until one exists.
            </p>
          {:else}
            <!--
              The proposer's own missing offer. Saying so and stopping there left them
              stuck on this page with nothing to press, so the way out is here: the
              ordinary create page, with a link back to the conversation afterwards.
            -->
            <div class="alert variant-soft-warning flex flex-col items-start gap-3 text-sm">
              <p>{S.form.needOffer}</p>
              <a class="variant-filled-primary btn btn-sm" href={postOfferHref}>
                {S.form.postOffer}
              </a>
            </div>
          {/if}
          {#if giverOffers.length > 0}
            <span class="text-xs text-surface-500">
              What {myRole === 'provider' ? otherName : 'you'} already offer{myRole === 'provider'
                ? 's'
                : ''}.
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
        <span class="variant-soft-surface badge">{medium || '...'}</span>
      </p>
      <p class="text-sm">
        You give <span class="font-semibold"
          >{termLabel(myRole === 'provider' ? primary : reciprocal) || '...'}</span
        >
        and receive
        <span class="font-semibold"
          >{termLabel(myRole === 'provider' ? reciprocal : primary) || '...'}</span
        >
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
