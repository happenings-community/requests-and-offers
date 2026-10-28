import { Either } from 'effect';
import { ArrayFormatter } from 'effect/ParseResult';
import { encodeHashToBase64, type ActionHash } from '@holochain/client';
import exchangesStore from '$lib/stores/exchanges.store.svelte';
import usersStore from '$lib/stores/users.store.svelte';
import offersStore from '$lib/stores/offers.store.svelte';
import requestsStore from '$lib/stores/requests.store.svelte';
import { runEffect } from '$lib/utils/effect';
import { showToast } from '$lib/utils/toast';
import { useConnectionGuard } from '$lib/composables/connection/useConnectionGuard';
import { decodeReviewInput } from '$lib/schemas/exchanges.schemas';
import {
  counterpartyOf,
  doneBy,
  otherRole,
  reviewedBy,
  roleOf,
  wroteIt
} from '$lib/utils/exchange-ui';
import type { ReviewInput } from '$lib/types/holochain';
import type { UIExchange, UIUser } from '$lib/types/ui';

/**
 * One exchange: what it says, whose move it is, and the six things a party can
 * do to it. Every write goes through the store; the review is checked against
 * the schema first, so an unrated review never reaches the DHT.
 */

/** The first thing wrong with the review, in the words the member should read. */
export function validateReview(input: ReviewInput): string | null {
  const decoded = decodeReviewInput(input);
  if (Either.isRight(decoded)) return null;
  const issues = ArrayFormatter.formatErrorSync(decoded.left);
  return issues[0]?.message ?? 'That review is not valid.';
}

/** Where a counter-proposal is written, carrying the agreement's own context. */
export function counterProposalHref(exchange: UIExchange): string {
  const { interest, listing, listing_type } = exchange.agreement;
  return (
    `/exchanges/propose?interest=${encodeHashToBase64(interest)}` +
    `&listing=${encodeHashToBase64(listing)}&type=${listing_type}`
  );
}

/** How often an open exchange page re-reads its exchange (#334). */
export const EXCHANGE_POLL_MS = 15_000;

/** Failed re-reads in a row before the page says it is showing the last update. */
export const STALE_AFTER_FAILURES = 3;

/**
 * True once nothing more can happen to an exchange, so its page can stop
 * re-reading it: both reviews are in, or it was declined or cancelled.
 */
export function isSettled(exchange: Pick<UIExchange, 'status'> | null | undefined): boolean {
  return (
    exchange?.status === 'Reviewed' ||
    exchange?.status === 'Declined' ||
    exchange?.status === 'Cancelled'
  );
}

export interface UseExchangeDetailsOptions {
  /** The agreement to load. Null while the route parameter is unreadable. */
  agreementHash: () => ActionHash | null;
}

export function useExchangeDetails(options: UseExchangeDetailsOptions) {
  const { agreementHash } = options;

  let exchange = $state<UIExchange | null>(null);
  let other = $state<UIUser | null>(null);
  let listingTitle = $state('');
  let loadError = $state<string | null>(null);
  let busy = $state(false);
  let failedReads = $state(0);

  let note = $state('');
  let rating = $state(0);
  let onTime = $state(false);
  let asAgreed = $state(false);
  let comment = $state('');

  const me = $derived(usersStore.currentUser?.original_action_hash);
  const role = $derived(exchange ? roleOf(exchange, me) : null);
  const iWroteIt = $derived(exchange ? wroteIt(exchange, me) : false);
  const myDone = $derived(exchange ? doneBy(exchange, role) : false);
  const theirDone = $derived(exchange ? doneBy(exchange, otherRole(role)) : false);
  const myReview = $derived(exchange ? reviewedBy(exchange, role) : false);
  const theirReview = $derived(exchange ? reviewedBy(exchange, otherRole(role)) : false);
  const myReviewText = $derived(
    role === 'provider' ? exchange?.provider_review : exchange?.receiver_review
  );
  const theirReviewText = $derived(
    role === 'provider' ? exchange?.receiver_review : exchange?.provider_review
  );
  const listingHref = $derived(
    exchange
      ? `/${exchange.agreement.listing_type === 'Offer' ? 'offers' : 'requests'}/${encodeHashToBase64(exchange.agreement.listing)}`
      : '#'
  );
  const reviewProblem = $derived(
    validateReview({ rating, on_time: onTime, as_agreed: asAgreed, comment })
  );

  function fail(e: unknown) {
    showToast(e instanceof Error ? e.message : String(e), 'error');
  }

  // Counts this member's own writes and the re-reads started, so a re-read can
  // tell whether its answer is still the newest thing the page knows. Not
  // reactive: nothing renders them.
  let writes = 0;
  let reads = 0;

  /** Runs one write, keeps the page honest about being busy, reports either way. */
  async function act(done: string, run: () => Promise<UIExchange>): Promise<boolean> {
    busy = true;
    writes += 1;
    try {
      exchange = await run();
      failedReads = 0;
      showToast(done, 'success');
      note = '';
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      busy = false;
    }
  }

  const hash = () => exchange!.agreement_hash;

  const accept = () =>
    act('Agreement accepted', () => runEffect(exchangesStore.respond(hash(), true, note)));

  const decline = () =>
    act('Agreement declined', () => runEffect(exchangesStore.respond(hash(), false, note)));

  /**
   * Declines, then hands back where the counter-proposal is written. Navigation
   * stays with the page: a composable that calls `goto` cannot be unit tested
   * without stubbing SvelteKit, and routing is the page's job anyway.
   */
  const counter = async (): Promise<string | null> => {
    if (!exchange) return null;
    const href = counterProposalHref(exchange);
    const declined = await act('Declined; make your counter-proposal', () =>
      runEffect(exchangesStore.respond(hash(), false, 'Countered with a new proposal'))
    );
    return declined ? href : null;
  };

  const complete = () => act('Marked as done', () => runEffect(exchangesStore.complete(hash())));

  const cancel = () =>
    act('Agreement cancelled', () => runEffect(exchangesStore.cancel(hash(), note)));

  const withdraw = () =>
    act('Proposal withdrawn', () =>
      runEffect(exchangesStore.cancel(hash(), 'Withdrawn by the proposer'))
    );

  /** Refused before the round trip when the rating is outside what a review is. */
  const review = async () => {
    const problem = reviewProblem;
    if (problem) {
      showToast(problem, 'error');
      return false;
    }
    return act('Review recorded', () =>
      runEffect(
        exchangesStore.review(hash(), {
          rating,
          on_time: onTime,
          as_agreed: asAgreed,
          comment
        })
      )
    );
  };

  /**
   * Re-reads the exchange so the other member's moves (marking done, a review,
   * a reply) show without a reload (#334). Skipped while this member's own
   * write is in flight, since that write returns the fresh exchange itself, and
   * an answer is dropped if the member wrote, or another re-read started, while
   * it was on its way: it would show the state from before that move. A
   * single failure is quiet and the next tick tries again; after several in a row
   * the page says it is showing the last update, so a lost connection is not
   * mistaken for nothing happening.
   */
  async function refresh(): Promise<void> {
    const target = agreementHash();
    if (!target || busy || !exchange) return;
    const writesAtStart = writes;
    const read = ++reads;
    try {
      const fresh = await runEffect(exchangesStore.getExchange(target));
      // Kept only if nothing newer arrived meanwhile: no write of this member's
      // began, even one already finished, and no later re-read was started.
      if (busy || writes !== writesAtStart || read !== reads) return;
      exchange = fresh;
      failedReads = 0;
    } catch {
      failedReads += 1;
    }
  }

  /** Starts re-reading while the exchange is unsettled; returns the function that stops it. */
  function watch(): () => void {
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      window.removeEventListener('focus', tick);
    };
    // Once settled nothing more can change, so the timer and listener go too.
    const tick = () => {
      if (isSettled(exchange)) stop();
      else void refresh();
    };
    const interval = setInterval(tick, EXCHANGE_POLL_MS);
    window.addEventListener('focus', tick);
    return stop;
  }

  async function initialize(): Promise<void> {
    const target = agreementHash();
    if (!target) {
      loadError = 'That exchange address is not valid.';
      return;
    }
    try {
      await runEffect(useConnectionGuard());
      const loaded = await runEffect(exchangesStore.getExchange(target));
      exchange = loaded;
      const [user, listing] = await Promise.all([
        runEffect(usersStore.getUserByActionHash(counterpartyOf(loaded, me))),
        loaded.agreement.listing_type === 'Offer'
          ? runEffect(offersStore.getOffer(loaded.agreement.listing))
          : runEffect(requestsStore.getRequest(loaded.agreement.listing))
      ]);
      other = user;
      listingTitle = listing?.title ?? 'A listing';
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    refresh,
    watch,
    get exchange() {
      return exchange;
    },
    /** True after repeated failed re-reads: the page is showing its last update. */
    get stale() {
      return failedReads >= STALE_AFTER_FAILURES;
    },
    get other() {
      return other;
    },
    get listingTitle() {
      return listingTitle;
    },
    get listingHref() {
      return listingHref;
    },
    get loadError() {
      return loadError;
    },
    get busy() {
      return busy;
    },
    get me() {
      return me;
    },
    get role() {
      return role;
    },
    get iWroteIt() {
      return iWroteIt;
    },
    get myDone() {
      return myDone;
    },
    get theirDone() {
      return theirDone;
    },
    get myReview() {
      return myReview;
    },
    get theirReview() {
      return theirReview;
    },
    get myReviewText() {
      return myReviewText;
    },
    get theirReviewText() {
      return theirReviewText;
    },
    get reviewProblem() {
      return reviewProblem;
    },
    get note() {
      return note;
    },
    set note(value: string) {
      note = value;
    },
    get rating() {
      return rating;
    },
    set rating(value: number) {
      rating = value;
    },
    get onTime() {
      return onTime;
    },
    set onTime(value: boolean) {
      onTime = value;
    },
    get asAgreed() {
      return asAgreed;
    },
    set asAgreed(value: boolean) {
      asAgreed = value;
    },
    get comment() {
      return comment;
    },
    set comment(value: string) {
      comment = value;
    },
    initialize,
    accept,
    decline,
    counter,
    complete,
    cancel,
    withdraw,
    review
  };
}

export type ExchangeDetails = ReturnType<typeof useExchangeDetails>;
