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

  /** Runs one write, keeps the page honest about being busy, reports either way. */
  async function act(done: string, run: () => Promise<UIExchange>): Promise<boolean> {
    busy = true;
    try {
      exchange = await run();
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
    get exchange() {
      return exchange;
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
