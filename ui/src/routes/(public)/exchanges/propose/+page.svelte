<script lang="ts">
  import {
    DEFAULT_TIMEFRAME,
    hasEnded,
    sameTimeframe,
    timeframeOptions
  } from '$lib/utils/timeframe';
  import type { Timeframe } from '$lib/types/holochain';
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
  import ErrorState from '$lib/components/shared/ErrorState.svelte';
  import { proposeUnavailable, type ProposeProblem } from '$lib/utils/propose-unavailable';
  import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
  import {
    namedInterest,
    proposalCounterparty,
    reciprocalTermFor,
    termLabel,
    type ExchangeRole
  } from '$lib/utils/exchange-ui';
  import { decimalProblem, isZeroDecimal } from '$lib/utils/decimal';
  import type { ExchangeTerm, ListingType } from '$lib/types/holochain';
  import type { UIOffer, UIRequest, UIUser } from '$lib/types/ui';

  const toastStore = getToastStore();

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
  let member = $state<UIUser | null>(null);
  let memberHash = $state<ActionHash | undefined>(undefined);
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
  /**
   * Whether the interest this page was opened from is one the listing actually has.
   *
   * The link carries a hash; only the listing's own interests say whether it means
   * anything. Read and absent is its own state: the interest may have been withdrawn, or
   * the link kept from an older one, and either way nothing here can be proposed. Without
   * this the page filled itself in from the query string, addressed the proposal to
   * "them", and met the zome's refusal at Send.
   */
  let interestOnListing = $state<'loading' | 'found' | 'missing'>('loading');
  /** Why the page cannot show the form, if it cannot; `proposeUnavailable` says it. */
  let problem = $state<ProposeProblem | null>(null);
  const unavailable = $derived(
    problem
      ? proposeUnavailable(problem, { listing: params.listing, type: params.listingType })
      : null
  );
  let busy = $state(false);

  let medium = $state('');
  let returnService = $state('');

  /** From the strings module, so Anita's review reaches this page too. */
  const FORM_TERMS_LOCKED = EXCHANGE_STRINGS.form.termsLocked;
  const S = EXCHANGE_STRINGS;

  /**
   * Where "Post an offer" goes.
   *
   * The ordinary create page, carrying the proposal so it can offer "Continue your
   * proposal" afterwards. One create flow, as everywhere else.
   */
  const postOfferHref = $derived.by(() => {
    // The proposal's own context travels: publishing here is a step inside proposing.
    // The conversation travels only if the page was reached from one (`from`), never the
    // listing's author: that turned a proposal started on the listing into one that
    // ended in Messages.
    const { listing: hash, listingType, interest } = params;
    if (!hash || !listingType || !interest) return paths.offerCreate();
    return createListingFrom('Offer', {
      kind: 'proposal',
      counterparty: params.from,
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
   *
   * A listing names one service type (#256), so `services` holds that one name, or
   * nothing when the listing names none or its name could not be read.
   */
  const service = $derived(services.join(', '));

  /**
   * **The proposal starts from the listing's figures** (#380). Both a request and an
   * offer can publish them.
   *
   * - The hours: the listing's estimate of the task, an exact decimal string, becomes the
   *   service's hours as written, so 1.1 stays 1.1. A quantity is above zero, so an
   *   estimate of none gives the proposal no hours. A counter can change them.
   * - The amount: see `reciprocalTermFor`, which carries the listing's own amount when it
   *   is in the medium chosen.
   * - The timeframe: the listing's own, while it can still be met; otherwise the
   *   default preset. Validation refuses a window that has ended.
   */
  const estimate = $derived(listing?.time_estimate_hours ?? null);
  const hoursDecimal = $derived(
    estimate !== null && decimalProblem(estimate) === null && !isZeroDecimal(estimate)
      ? estimate
      : null
  );
  const listingTimeframe = $derived.by(() => {
    const own = listing?.timeframe ?? null;
    return own && !hasEnded(own, Date.now() * 1000) ? own : null;
  });
  /** What the member picked, once they pick; until then, the listing's own. */
  let chosenTimeframe = $state<Timeframe | null>(null);
  const timeframe = $derived<Timeframe>(chosenTimeframe ?? listingTimeframe ?? DEFAULT_TIMEFRAME);
  const timeframes = $derived(timeframeOptions(listingTimeframe));

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const iAmAuthor = $derived(
    !!listing?.creator && !!me && listing.creator.toString() === me.toString()
  );
  // An offer's author provides; a request's author receives.
  const myRole = $derived<ExchangeRole>(
    (params.listingType === 'Offer') === iAmAuthor ? 'provider' : 'receiver'
  );
  const isCurrency = $derived(mediums.find((m) => m.name === medium)?.currency ?? false);
  // The other party: the interested member when the author proposes, the author otherwise.
  const other = $derived(
    proposalCounterparty(listing?.creator, memberHash, me) === listing?.creator ? creator : member
  );
  const otherName = $derived(other?.name ?? 'them');

  const primary = $derived<ExchangeTerm>({
    direction: 'Provide',
    resource_conforms_to: service,
    resource_kind: 'Service',
    quantity: hoursDecimal ? { value: hoursDecimal, unit: 'hours' } : null
  });
  const reciprocal = $derived(
    reciprocalTermFor({ medium, isCurrency, returnService, amount: listing?.amount })
  );

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
      // The hash in the link is not enough: it has to be an interest this listing has.
      interestOnListing === 'found' &&
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
      problem = { kind: !hash ? 'no-listing' : 'no-type' };
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
          problem = { kind: 'not-found' };
          return;
        }
        listing = item;
        loadedType = listingType;
        if (item.creator) creator = await runEffect(usersStore.getUserByActionHash(item.creator));
        // One listing names one service type (#256). A hash that will not resolve is a
        // failure, as for the mediums below, so it stays in the list as null.
        const st = item.service_type_hash
          ? await runEffect(serviceTypesStore.getServiceType(item.service_type_hash))
          : null;
        const names: (string | null)[] = item.service_type_hash ? [st?.name ?? null] : [];
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
        const theInterest = namedInterest(interests, params.interest);
        interestOnListing = theInterest ? 'found' : 'missing';
        const authorHash = item.creator;
        memberHash = theInterest?.user;
        if (memberHash) member = await runEffect(usersStore.getUserByActionHash(memberHash));
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
        problem = { kind: 'failed', detail: e instanceof Error ? e.message : String(e) };
      }
    })();
  }

  function retryTerms() {
    termsLoad = 'loading';
    interestOnListing = 'loading';
    problem = null;
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

<section class="container mx-auto max-w-reading space-y-6 p-4">
  <button class="variant-soft btn btn-sm" onclick={() => history.back()}>Back</button>

  {#if unavailable}
    <ErrorState
      icon={unavailable.icon}
      eyebrow={unavailable.eyebrow}
      title={unavailable.title}
      body={unavailable.body}
      detail={unavailable.detail}
      detailLabel={S.unavailable.detail}
      actions={unavailable.actions}
      retryLabel={S.unavailable.retry}
      onretry={unavailable.retry ? retryTerms : undefined}
    />
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
        {iAmAuthor ? 'Your' : creator ? `${creator.name}'s` : 'Their'}
        {loadedType?.toLowerCase()}
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

    {#if interestOnListing === 'missing'}
      <div class="alert variant-filled-warning text-sm" data-testid="interest-missing">
        {S.form.interestMissing}
      </div>
    {/if}

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
          {hoursDecimal ??
            (estimate === null
              ? S.form.hoursNotStated
              : decimalProblem(estimate) === null
                ? S.form.hoursNone
                : S.form.hoursUnusable)}
        </p>
        <p class="text-xs text-surface-500">{FORM_TERMS_LOCKED}</p>
      </div>

      {#if termsLoad === 'ready' && services.length === 0}
        <div class="alert variant-soft-warning text-sm">
          This listing names no service, so there is nothing to propose. Edit the listing to add
          one.
        </div>
      {/if}

      <!-- A container, not a label: it also holds notices with no control to name. -->
      <div class="label">
        {#if mediums.length > 0}
          <label for="propose-medium">Requested medium of exchange</label>
          <select id="propose-medium" class="select" bind:value={medium}>
            {#each mediums as m (m.name)}<option value={m.name}>{m.name}</option>{/each}
          </select>
        {:else if termsLoad === 'loading'}
          <span>Requested medium of exchange</span>
          <p class="text-sm text-surface-500">{S.form.termsLoading}</p>
        {:else if termsLoad === 'ready'}
          <span>Requested medium of exchange</span>
          <!-- Only once the mediums are known. Shown while they were still loading, this
               offered a gift proposal for a listing that wanted paying. -->
          <p class="alert variant-soft-surface text-sm">
            This listing names no medium of exchange, so this is a gift: nothing is expected in
            return. To ask for something back, add a medium to the listing.
          </p>
        {/if}
      </div>

      {#if medium === 'Service Exchange'}
        <!-- A container, not a label: it holds links, buttons and notices beside the one
             control it names, and a label may hold only that control. -->
        <div class="label">
          {#if giverOffers.length > 0}
            <label for="propose-return-service">Chosen service offer for proposal</label>
            <select
              id="propose-return-service"
              class="select"
              aria-describedby="propose-return-service-hint"
              bind:value={returnService}
            >
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
            <span>Chosen service offer for proposal</span>
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
            <span>Chosen service offer for proposal</span>
            <div class="alert variant-soft-warning flex flex-col items-start gap-3 text-sm">
              <p>{S.form.needOffer}</p>
              <a class="variant-filled-primary btn btn-sm" href={postOfferHref}>
                {S.form.postOffer}
              </a>
            </div>
          {/if}
          {#if giverOffers.length > 0}
            <span id="propose-return-service-hint" class="text-xs text-surface-500">
              What {myRole === 'provider' ? otherName : 'you'} already offer{myRole === 'provider'
                ? 's'
                : ''}.
            </span>
          {/if}
        </div>
      {:else if medium === 'Free/Pay it Forward'}
        <p class="text-sm text-surface-500">This is a gift. Nothing is expected in return.</p>
      {/if}

      <label class="label">
        <span>Delivery timeframe</span>
        <!-- Bound by index: a timeframe is an object, compared with sameTimeframe. -->
        <select
          class="select"
          bind:value={
            () => timeframes.findIndex((t) => sameTimeframe(t.value, timeframe)),
            (i) => (chosenTimeframe = timeframes[i].value)
          }
          data-testid="propose-timeframe"
        >
          {#each timeframes as t, i (i)}<option value={i}>{t.label}</option>{/each}
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
      <button
        class="variant-filled-primary btn"
        onclick={submit}
        disabled={!canSubmit || busy}
        data-testid="send-proposal"
      >
        {S.form.send}
      </button>
    </div>
  {/if}
</section>
